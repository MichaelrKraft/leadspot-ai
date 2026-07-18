"""
Email triage classifier — assigns each inbound email one per-org category.

Sender rules short-circuit the LLM; otherwise Claude Haiku picks from the
org's enabled categories via forced tool choice (same validated-tool-output
pattern as deal_status_agent). Categories are seeded with the 8 Fyxer-style
defaults on an org's first classification.
"""

import logging
from dataclasses import dataclass

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_category import DEFAULT_CATEGORIES, EmailCategory, SenderRule
from app.services.inference.llm_client import get_anthropic_client

logger = logging.getLogger(__name__)

CLASSIFY_MODEL = "claude-haiku-4-5-20251001"
BODY_CAP = 4000


@dataclass
class Classification:
    category: str
    reason: str  # "sender rule" | "llm" | "fallback"
    drafts_enabled: bool


async def ensure_categories(db: AsyncSession, org_id: str) -> list[EmailCategory]:
    """Return the org's categories, seeding the defaults on first use."""
    categories = (
        await db.execute(
            select(EmailCategory)
            .where(EmailCategory.org_id == org_id)
            .order_by(EmailCategory.position)
        )
    ).scalars().all()
    if categories:
        return list(categories)

    seeded = [
        EmailCategory(
            org_id=org_id, name=name, description=desc,
            position=i, enabled=True, drafts_enabled=drafts,
        )
        for i, (name, desc, drafts) in enumerate(DEFAULT_CATEGORIES)
    ]
    db.add_all(seeded)
    await db.commit()
    logger.info(f"email_classifier: seeded default categories for org {org_id[:8]}")
    return seeded


async def match_sender_rule(
    db: AsyncSession, org_id: str, from_address: str
) -> str | None:
    rules = (
        await db.execute(select(SenderRule).where(SenderRule.org_id == org_id))
    ).scalars().all()
    sender = (from_address or "").lower()
    for rule in rules:
        if rule.pattern.lower() in sender:
            return rule.category_name
    return None


def _classify_tool(category_names: list[str]) -> dict:
    return {
        "name": "classify_email",
        "description": "Assign the email exactly one triage category.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "enum": category_names},
            },
            "required": ["category"],
        },
    }


PROMPT_TEMPLATE = """Classify this email into exactly one of the categories below. These triage a busy professional's inbox inside their CRM.

CATEGORIES:
{category_lines}

Notes:
- "To Respond" is for mail that needs a direct human reply — a real person asking or advancing something.
- Automated mail is "Notification" (app/service events) or "Marketing" (bulk/promotional/cold outreach).
- Calendar-related logistics are "Meeting Update".

EMAIL:
From: {from_address}
Subject: {subject}

{body}"""


async def classify_email(
    db: AsyncSession,
    org_id: str,
    from_address: str,
    subject: str,
    body: str,
    client: anthropic.AsyncAnthropic | None = None,
) -> Classification | None:
    """Classify one inbound email. Returns None when no LLM is configured
    and no rule matched — the message simply stays uncategorized."""
    categories = await ensure_categories(db, org_id)
    # Awaiting Reply / Actioned are thread states driven by SENT-mail flow,
    # not classifier outputs.
    selectable = [
        c for c in categories
        if c.enabled and c.name not in ("Awaiting Reply", "Actioned")
    ]
    if not selectable:
        return None
    by_name = {c.name: c for c in selectable}

    ruled = await match_sender_rule(db, org_id, from_address)
    if ruled and ruled in by_name:
        return Classification(ruled, "sender rule", by_name[ruled].drafts_enabled)

    if client is None:
        client = await get_anthropic_client(db, org_id)
    if client is None:
        logger.warning("email_classifier: no Anthropic key configured, skipping")
        return None

    names = [c.name for c in selectable]
    prompt = PROMPT_TEMPLATE.format(
        category_lines="\n".join(
            f"- {c.name}: {c.description or ''}" for c in selectable
        ),
        from_address=from_address,
        subject=subject or "(no subject)",
        body=(body or "")[:BODY_CAP],
    )

    try:
        response = await client.messages.create(
            model=CLASSIFY_MODEL,
            max_tokens=256,
            tools=[_classify_tool(names)],
            tool_choice={"type": "tool", "name": "classify_email"},
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        logger.error(f"email_classifier: Claude call failed: {e}")
        return None

    category = ""
    for block in response.content:
        if block.type == "tool_use" and block.name == "classify_email":
            category = str(block.input.get("category", ""))
            break

    if category not in by_name:
        # Model returned something outside the enum (shouldn't happen with
        # forced tool choice) — fall back to the safest bucket.
        fallback = "FYI" if "FYI" in by_name else names[0]
        return Classification(fallback, "fallback", by_name[fallback].drafts_enabled)

    return Classification(category, "llm", by_name[category].drafts_enabled)
