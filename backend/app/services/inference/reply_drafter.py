"""
In-voice reply drafter — Fyxer-style AI drafts for "To Respond" mail.

Voice comes from two layers (ported from inbox-concierge):
  1. Style profile — a one-time LLM distillation of the mailbox's sent mail
     (greetings, sign-off, formality, length), stored in style_profiles.
  2. Exemplars — semantically similar past sent replies retrieved from the
     local vector store (indexed during backfill), used as few-shot examples.

Drafts are saved to the emails table (status="Draft") and NEVER sent.
Guard rails: per-org daily cap and never-draft sender rules (SenderRule rows
with the NO_DRAFT sentinel category).
"""

import logging
from datetime import datetime, time

import anthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_category import SenderRule
from app.models.email_event import EmailEvent
from app.models.style_profile import StyleProfile
from app.services import local_vector_store

logger = logging.getLogger(__name__)

DRAFT_MODEL = "claude-sonnet-5"
STYLE_MODEL = "claude-sonnet-5"
DAILY_DRAFT_CAP = 40
NO_DRAFT_SENTINEL = "__no_draft__"
EXEMPLAR_LIMIT = 3
BODY_CAP = 6000


async def never_draft(db: AsyncSession, org_id: str, from_address: str) -> bool:
    """True when a never-draft sender rule matches the sender."""
    rules = (
        await db.execute(
            select(SenderRule).where(
                SenderRule.org_id == org_id,
                SenderRule.category_name == NO_DRAFT_SENTINEL,
            )
        )
    ).scalars().all()
    sender = (from_address or "").lower()
    return any(r.pattern.lower() in sender for r in rules)


async def under_daily_cap(db: AsyncSession, org_id: str, cap: int = DAILY_DRAFT_CAP) -> bool:
    today_start = datetime.combine(datetime.utcnow().date(), time.min)
    count = (
        await db.execute(
            select(func.count(EmailEvent.id)).where(
                EmailEvent.org_id == org_id,
                EmailEvent.action == "drafted",
                EmailEvent.created_at >= today_start,
            )
        )
    ).scalar() or 0
    return count < cap


async def get_style_profile(
    db: AsyncSession, org_id: str, mailbox_email: str
) -> str | None:
    profile = (
        await db.execute(
            select(StyleProfile).where(
                StyleProfile.org_id == org_id,
                StyleProfile.mailbox_email == mailbox_email,
            )
        )
    ).scalar_one_or_none()
    return profile.profile_md if profile else None


STYLE_PROMPT = """Below are emails written by {mailbox_email}. Distill their writing voice into a compact style guide another writer could follow to draft replies indistinguishable from theirs.

Cover: typical greeting and sign-off, formality level, sentence length and rhythm, typical email length, punctuation/emoji habits, and any recurring phrases. Output only the style guide as markdown bullet points — no preamble.

SENT EMAILS:
{sent_bodies}"""


async def build_style_profile(
    db: AsyncSession,
    org_id: str,
    mailbox_email: str,
    sent_bodies: list[str],
    client: anthropic.AsyncAnthropic,
) -> str | None:
    """Build (or rebuild) the style profile from sent-mail bodies."""
    usable = [b.strip()[:2000] for b in sent_bodies if b and len(b.strip()) > 40]
    if len(usable) < 3:
        logger.info(f"reply_drafter: too few sent emails ({len(usable)}) for a style profile")
        return None

    prompt = STYLE_PROMPT.format(
        mailbox_email=mailbox_email,
        sent_bodies="\n\n---\n\n".join(usable[:60]),
    )
    try:
        response = await client.messages.create(
            model=STYLE_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        logger.error(f"reply_drafter: style profile build failed: {e}")
        return None

    profile_md = "".join(b.text for b in response.content if b.type == "text").strip()
    if not profile_md:
        return None

    existing = (
        await db.execute(
            select(StyleProfile).where(
                StyleProfile.org_id == org_id,
                StyleProfile.mailbox_email == mailbox_email,
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.profile_md = profile_md
        existing.built_at = datetime.utcnow()
    else:
        db.add(StyleProfile(org_id=org_id, mailbox_email=mailbox_email, profile_md=profile_md))
    await db.commit()
    logger.info(f"reply_drafter: style profile built for {mailbox_email}")
    return profile_md


def index_sent_exemplar(org_id: str, message_id: str, subject: str, body: str) -> None:
    """Index one sent email into the vector store for exemplar retrieval."""
    if not body or len(body.strip()) < 40:
        return
    if not local_vector_store.is_available():
        return
    local_vector_store.index_document(
        document_id=f"exemplar-{message_id}",
        organization_id=org_id,
        title=subject or "(no subject)",
        content=body[:2000],
        metadata={"type": "sent_exemplar", "source_id": message_id},
    )


def retrieve_exemplars(org_id: str, inbound_text: str) -> list[str]:
    """Past sent replies most similar to the inbound email."""
    if not local_vector_store.is_available():
        return []
    try:
        results = local_vector_store.search(
            query=inbound_text[:1000], organization_id=org_id, limit=10, min_score=0.25
        )
    except Exception as e:
        logger.warning(f"reply_drafter: exemplar search failed: {e}")
        return []
    exemplars = [
        r["content"] for r in results
        if r.get("metadata", {}).get("type") == "sent_exemplar"
    ]
    return exemplars[:EXEMPLAR_LIMIT]


DRAFT_PROMPT = """Draft a reply to the email below, writing as {mailbox_email}.

{style_section}{exemplar_section}Rules:
- Write ONLY the reply body — no subject line, no commentary, no placeholders like [name] (if you don't know something, write around it).
- Match the sender's language.
- Be concise; answer what was asked and advance the conversation.
- Do not invent facts, prices, dates, or commitments not present in the thread.

EMAIL TO ANSWER:
From: {from_address}
Subject: {subject}

{body}"""


async def draft_reply(
    db: AsyncSession,
    org_id: str,
    mailbox_email: str,
    from_address: str,
    subject: str,
    body: str,
    client: anthropic.AsyncAnthropic,
) -> str | None:
    """Generate a reply draft. Returns the draft text, or None on failure."""
    style = await get_style_profile(db, org_id, mailbox_email)
    style_section = (
        f"WRITING STYLE GUIDE (follow this voice):\n{style}\n\n" if style else ""
    )
    exemplars = retrieve_exemplars(org_id, f"{subject}\n{body}")
    exemplar_section = (
        "EXAMPLES OF PAST REPLIES BY THIS WRITER:\n"
        + "\n\n---\n\n".join(exemplars)
        + "\n\n"
        if exemplars
        else ""
    )

    prompt = DRAFT_PROMPT.format(
        mailbox_email=mailbox_email,
        style_section=style_section,
        exemplar_section=exemplar_section,
        from_address=from_address,
        subject=subject or "(no subject)",
        body=(body or "")[:BODY_CAP],
    )
    try:
        response = await client.messages.create(
            model=DRAFT_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        logger.error(f"reply_drafter: draft failed: {e}")
        return None

    draft = "".join(b.text for b in response.content if b.type == "text").strip()
    return draft or None
