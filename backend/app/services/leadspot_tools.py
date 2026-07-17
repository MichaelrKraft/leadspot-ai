"""
Native LeadSpot CRM tools for the AI Command Center.

These query the local database directly (org-scoped), so the chat can act on
real CRM data without any external integration. Mautic tools remain an
optional add-on when that connection exists.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.deal import Deal
from app.models.deal_suggestion import DealSuggestion
from app.models.email_message import EmailMessage

logger = logging.getLogger(__name__)


LEADSPOT_READ_TOOLS: list[dict] = [
    {
        "name": "get_crm_overview",
        "description": "Get a full overview of the CRM: contact count, deal pipelines with per-stage counts and values, campaign counts, pending AI suggestions, and recent inbound email volume. Use this whenever the user asks for an overview, summary, snapshot, or status of their CRM or business.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_contacts",
        "description": "List CRM contacts, optionally filtered by a search term matched against name, email, and company.",
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Optional search term"},
                "limit": {"type": "integer", "description": "Max contacts to return (default 10)"},
            },
        },
    },
    {
        "name": "list_deals",
        "description": "List deals in a pipeline with title, property, contact, stage, and value.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pipeline": {
                    "type": "string",
                    "enum": ["sales", "leasing"],
                    "description": "Which pipeline to list (default: both)",
                },
                "stage": {"type": "string", "description": "Optional stage filter"},
            },
        },
    },
    {
        "name": "list_pending_suggestions",
        "description": "List pending AI deal-stage suggestions awaiting human review (deal, proposed stage move, confidence, evidence).",
        "input_schema": {"type": "object", "properties": {}},
    },
]

LEADSPOT_TOOL_NAMES = {t["name"] for t in LEADSPOT_READ_TOOLS}


async def _get_crm_overview(db: AsyncSession, org_id: str) -> dict[str, Any]:
    contact_count = (
        await db.execute(
            select(func.count()).select_from(Contact).where(Contact.organization_id == org_id)
        )
    ).scalar() or 0

    pipelines: dict[str, Any] = {}
    for pipeline in ("sales", "leasing"):
        rows = (
            await db.execute(
                select(Deal.stage, func.count(), func.coalesce(func.sum(Deal.value), 0))
                .where(Deal.org_id == org_id, Deal.pipeline == pipeline)
                .group_by(Deal.stage)
            )
        ).all()
        pipelines[pipeline] = {
            "total_deals": sum(r[1] for r in rows),
            "total_value": float(sum(r[2] for r in rows)),
            "by_stage": {r[0]: {"count": r[1], "value": float(r[2])} for r in rows},
        }

    pending_suggestions = (
        await db.execute(
            select(func.count())
            .select_from(DealSuggestion)
            .where(DealSuggestion.org_id == org_id, DealSuggestion.status == "pending")
        )
    ).scalar() or 0

    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_emails = (
        await db.execute(
            select(func.count())
            .select_from(EmailMessage)
            .where(EmailMessage.org_id == org_id, EmailMessage.received_at >= week_ago)
        )
    ).scalar() or 0

    return {
        "contacts": contact_count,
        "pipelines": pipelines,
        "pending_ai_suggestions": pending_suggestions,
        "inbound_emails_last_7_days": recent_emails,
    }


async def _list_contacts(db: AsyncSession, org_id: str, tool_input: dict) -> list[dict]:
    limit = min(int(tool_input.get("limit") or 10), 50)
    query = select(Contact).where(Contact.organization_id == org_id)
    search = (tool_input.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.where(
            (Contact.first_name.ilike(like))
            | (Contact.last_name.ilike(like))
            | (Contact.email.ilike(like))
            | (Contact.company.ilike(like))
        )
    contacts = (await db.execute(query.limit(limit))).scalars().all()
    return [
        {
            "id": c.id,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "email": c.email,
            "company": c.company,
        }
        for c in contacts
    ]


async def _list_deals(db: AsyncSession, org_id: str, tool_input: dict) -> list[dict]:
    query = select(Deal).where(Deal.org_id == org_id)
    pipeline = tool_input.get("pipeline")
    if pipeline in ("sales", "leasing"):
        query = query.where(Deal.pipeline == pipeline)
    stage = tool_input.get("stage")
    if stage:
        query = query.where(Deal.stage == stage)
    deals = (await db.execute(query.order_by(Deal.updated_at.desc()).limit(50))).scalars().all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "pipeline": d.pipeline,
            "stage": d.stage,
            "value": d.value,
            "property": d.property_name,
            "contact": d.contact_name,
            "priority": d.priority,
        }
        for d in deals
    ]


async def _list_pending_suggestions(db: AsyncSession, org_id: str) -> list[dict]:
    suggestions = (
        await db.execute(
            select(DealSuggestion, Deal.title)
            .join(Deal, Deal.id == DealSuggestion.deal_id, isouter=True)
            .where(DealSuggestion.org_id == org_id, DealSuggestion.status == "pending")
            .order_by(DealSuggestion.created_at.desc())
            .limit(25)
        )
    ).all()
    return [
        {
            "deal": title,
            "from_stage": s.current_stage,
            "to_stage": s.suggested_stage,
            "confidence": s.confidence,
            "evidence": s.evidence,
        }
        for s, title in suggestions
    ]


async def execute_leadspot_tool(
    tool_name: str,
    tool_input: dict,
    org_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Execute a native LeadSpot tool. Result shape mirrors mautic execute_tool."""
    try:
        if tool_name == "get_crm_overview":
            result = await _get_crm_overview(db, org_id)
        elif tool_name == "list_contacts":
            result = await _list_contacts(db, org_id, tool_input)
        elif tool_name == "list_deals":
            result = await _list_deals(db, org_id, tool_input)
        elif tool_name == "list_pending_suggestions":
            result = await _list_pending_suggestions(db, org_id)
        else:
            return {"success": False, "error": f"Unknown tool: {tool_name}", "error_type": "unknown"}
        return {"success": True, "result": result}
    except Exception as e:
        logger.exception(f"leadspot tool {tool_name} failed: {e}")
        return {"success": False, "error": str(e), "error_type": "unknown"}


def format_leadspot_result_for_display(tool_name: str, result: dict) -> str:
    """Short human-readable summary of a tool result for the chat transcript."""
    if not result.get("success"):
        return f"{tool_name}: failed — {result.get('error', 'unknown error')}"
    data = result.get("result")
    if tool_name == "get_crm_overview":
        leasing = data.get("pipelines", {}).get("leasing", {})
        sales = data.get("pipelines", {}).get("sales", {})
        return (
            f"Overview: {data.get('contacts', 0)} contacts, "
            f"{sales.get('total_deals', 0)} sales deals (${sales.get('total_value', 0):,.0f}), "
            f"{leasing.get('total_deals', 0)} leasing deals (${leasing.get('total_value', 0):,.0f}), "
            f"{data.get('pending_ai_suggestions', 0)} pending AI suggestions"
        )
    if isinstance(data, list):
        return f"{tool_name}: {len(data)} results"
    return f"{tool_name}: done"
