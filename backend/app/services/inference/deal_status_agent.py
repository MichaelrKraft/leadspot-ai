"""
Deal-status inference agent.

Given the text of an inbound email or document plus the org's open leasing
deals, asks Claude to decide whether the source implies a deal-stage change.
Never applies changes itself — it writes a DealSuggestion row that a human
accepts or rejects in the UI.
"""

import json
import logging
from datetime import datetime
from typing import Any

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal
from app.models.deal_suggestion import DealSuggestion
from app.services.claude_service import _get_api_key

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-5"

SUGGESTION_TOOL = {
    "name": "report_deal_status",
    "description": "Report whether this source implies a deal stage change.",
    "input_schema": {
        "type": "object",
        "properties": {
            "deal_id": {
                "type": ["string", "null"],
                "description": "The id of the matched deal, or null if the source matches no listed deal.",
            },
            "suggested_stage": {
                "type": ["string", "null"],
                "description": "The stage the deal should move to, or null for no change.",
            },
            "confidence": {
                "type": "integer",
                "description": "0-100 confidence in the suggestion.",
            },
            "evidence": {
                "type": "string",
                "description": "Short verbatim quote from the source that justifies the suggestion.",
            },
        },
        "required": ["deal_id", "suggested_stage", "confidence", "evidence"],
    },
}

PROMPT_TEMPLATE = """You monitor a commercial real estate leasing pipeline. Below are the open leasing deals, then the text of a new {source_type}. Decide whether this {source_type} indicates that one deal should move to a different stage.

Pipeline stages, in order: inquiry, loi_negotiation, construction_pricing, lease_drafting, lease_negotiation, signed, lost.

Rules:
- Match the {source_type} to at most ONE deal, using property names, contact names, and context.
- Only suggest a stage change when the text clearly implies it (e.g. "sending the first lease draft" implies lease_drafting).
- If the {source_type} matches no deal, or implies no change, report deal_id or suggested_stage as null.
- Never suggest the stage the deal is already in.
- The evidence field must be a short verbatim quote from the {source_type}.

OPEN DEALS:
{deals_json}

NEW {source_type_upper}:
{source_text}"""


async def analyze_source_for_deal_status(
    db: AsyncSession,
    org_id: str,
    source_type: str,  # "email" | "document"
    source_id: str,
    source_text: str,
    client: anthropic.AsyncAnthropic | None = None,
) -> DealSuggestion | None:
    """Run inference over one source item. Returns the created suggestion, or None."""
    result = await db.execute(
        select(Deal).where(
            Deal.org_id == org_id,
            Deal.pipeline == "leasing",
            Deal.stage.notin_(["signed", "lost"]),
        )
    )
    deals = result.scalars().all()
    if not deals:
        return None

    deals_json = json.dumps(
        [
            {
                "deal_id": d.id,
                "title": d.title,
                "property": d.property_name,
                "contact": d.contact_name,
                "current_stage": d.stage,
            }
            for d in deals
        ],
        indent=2,
    )

    if client is None:
        api_key = _get_api_key()
        if not api_key:
            logger.warning("deal_status_agent: no ANTHROPIC_API_KEY, skipping inference")
            return None
        client = anthropic.AsyncAnthropic(api_key=api_key)

    prompt = PROMPT_TEMPLATE.format(
        source_type=source_type,
        source_type_upper=source_type.upper(),
        deals_json=deals_json,
        source_text=source_text[:8000],
    )

    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1024,
            tools=[SUGGESTION_TOOL],
            tool_choice={"type": "tool", "name": "report_deal_status"},
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        logger.error(f"deal_status_agent: Claude call failed: {e}")
        return None

    tool_input: dict[str, Any] = {}
    for block in response.content:
        if block.type == "tool_use" and block.name == "report_deal_status":
            tool_input = block.input
            break

    deal_id = tool_input.get("deal_id")
    suggested_stage = tool_input.get("suggested_stage")
    if not deal_id or not suggested_stage:
        return None

    deal = next((d for d in deals if d.id == deal_id), None)
    if deal is None:
        logger.warning(f"deal_status_agent: model returned unknown deal_id {deal_id}")
        return None
    if suggested_stage == deal.stage:
        return None

    valid_stages = {
        "inquiry", "loi_negotiation", "construction_pricing",
        "lease_drafting", "lease_negotiation", "signed", "lost",
    }
    if suggested_stage not in valid_stages:
        logger.warning(f"deal_status_agent: model returned invalid stage {suggested_stage}")
        return None

    # Don't stack duplicate pending suggestions for the same deal/stage
    existing = await db.execute(
        select(DealSuggestion).where(
            DealSuggestion.org_id == org_id,
            DealSuggestion.deal_id == deal.id,
            DealSuggestion.suggested_stage == suggested_stage,
            DealSuggestion.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        return None

    suggestion = DealSuggestion(
        org_id=org_id,
        deal_id=deal.id,
        current_stage=deal.stage,
        suggested_stage=suggested_stage,
        confidence=max(0, min(100, int(tool_input.get("confidence", 0)))),
        evidence=str(tool_input.get("evidence", ""))[:2000],
        source_type=source_type,
        source_id=source_id,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion)
    logger.info(
        f"deal_status_agent: suggested {deal.stage} -> {suggested_stage} "
        f"for deal {deal.id} (confidence {suggestion.confidence})"
    )
    return suggestion
