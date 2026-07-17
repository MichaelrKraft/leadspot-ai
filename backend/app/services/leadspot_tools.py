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

from app.models.calendar_event import CalendarEvent
from app.models.campaign import Campaign
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.deal_suggestion import DealSuggestion
from app.models.email_message import EmailMessage
from app.models.segment import Segment

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
        "description": "List AI deal-stage suggestions (deal, proposed stage move, confidence, evidence). Defaults to pending; can also show accepted/rejected history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "accepted", "rejected"],
                    "description": "Which suggestions to list (default pending)",
                },
            },
        },
    },
    {
        "name": "get_deal_details",
        "description": "Deep-dive on one deal found by (partial) title or property name: full deal record plus its AI suggestion history and any linked inbound emails.",
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Deal title or property name (partial match)"},
            },
            "required": ["search"],
        },
    },
    {
        "name": "list_recent_emails",
        "description": "List recent inbound emails synced into the CRM (subject, sender, date, matched deal), newest first.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "Look-back window in days (default 14)"},
                "limit": {"type": "integer", "description": "Max emails (default 15)"},
            },
        },
    },
    {
        "name": "list_campaigns",
        "description": "List marketing campaigns with status, type, and lead/open/reply counts.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_segments",
        "description": "List contact segments with their contact counts.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_calendar_events",
        "description": "List upcoming calendar events (calls, meetings, demos, tasks).",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "How many days ahead (default 14)"},
            },
        },
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


async def _list_suggestions(db: AsyncSession, org_id: str, tool_input: dict) -> list[dict]:
    status = tool_input.get("status") or "pending"
    suggestions = (
        await db.execute(
            select(DealSuggestion, Deal.title)
            .join(Deal, Deal.id == DealSuggestion.deal_id, isouter=True)
            .where(DealSuggestion.org_id == org_id, DealSuggestion.status == status)
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
            "status": s.status,
        }
        for s, title in suggestions
    ]


async def _get_deal_details(db: AsyncSession, org_id: str, tool_input: dict) -> dict | None:
    like = f"%{(tool_input.get('search') or '').strip()}%"
    deal = (
        await db.execute(
            select(Deal).where(
                Deal.org_id == org_id,
                (Deal.title.ilike(like)) | (Deal.property_name.ilike(like)),
            ).limit(1)
        )
    ).scalars().first()
    if not deal:
        return None

    suggestions = (
        await db.execute(
            select(DealSuggestion)
            .where(DealSuggestion.deal_id == deal.id)
            .order_by(DealSuggestion.created_at.desc())
        )
    ).scalars().all()
    emails = (
        await db.execute(
            select(EmailMessage)
            .where(EmailMessage.org_id == org_id, EmailMessage.deal_id == deal.id)
            .order_by(EmailMessage.received_at.desc())
            .limit(10)
        )
    ).scalars().all()

    return {
        "deal": {
            "title": deal.title,
            "pipeline": deal.pipeline,
            "stage": deal.stage,
            "value": deal.value,
            "property": deal.property_name,
            "contact": deal.contact_name,
            "priority": deal.priority,
            "notes": deal.notes,
            "stage_changed_at": deal.stage_changed_at,
            "created_at": deal.created_at,
        },
        "suggestion_history": [
            {
                "from_stage": s.current_stage,
                "to_stage": s.suggested_stage,
                "confidence": s.confidence,
                "evidence": s.evidence,
                "status": s.status,
            }
            for s in suggestions
        ],
        "linked_emails": [
            {
                "subject": m.subject,
                "from": m.from_address,
                "received_at": m.received_at,
                "preview": (m.body_preview or "")[:300],
            }
            for m in emails
        ],
    }


async def _list_recent_emails(db: AsyncSession, org_id: str, tool_input: dict) -> list[dict]:
    days = min(int(tool_input.get("days") or 14), 90)
    limit = min(int(tool_input.get("limit") or 15), 50)
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        await db.execute(
            select(EmailMessage, Deal.title)
            .join(Deal, Deal.id == EmailMessage.deal_id, isouter=True)
            .where(EmailMessage.org_id == org_id, EmailMessage.received_at >= since)
            .order_by(EmailMessage.received_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            "subject": m.subject,
            "from": m.from_address,
            "received_at": m.received_at,
            "matched_deal": deal_title,
            "preview": (m.body_preview or "")[:200],
        }
        for m, deal_title in rows
    ]


async def _list_campaigns(db: AsyncSession, user_id: str) -> list[dict]:
    campaigns = (
        await db.execute(
            select(Campaign).where(Campaign.user_id == user_id).limit(50)
        )
    ).scalars().all()
    return [
        {
            "name": c.name,
            "status": c.status,
            "type": c.type,
            "leads": c.leads,
            "opened": c.opened,
            "replied": c.replied,
        }
        for c in campaigns
    ]


async def _list_segments(db: AsyncSession, user_id: str) -> list[dict]:
    segments = (
        await db.execute(
            select(Segment).where(Segment.user_id == user_id).limit(50)
        )
    ).scalars().all()
    return [
        {
            "name": s.name,
            "description": s.description,
            "contact_count": s.contact_count,
            "filter_type": s.filter_type,
        }
        for s in segments
    ]


async def _list_calendar_events(db: AsyncSession, org_id: str, tool_input: dict) -> list[dict]:
    days = min(int(tool_input.get("days") or 14), 90)
    now = datetime.utcnow()
    events = (
        await db.execute(
            select(CalendarEvent)
            .where(
                CalendarEvent.org_id == org_id,
                CalendarEvent.start >= now,
                CalendarEvent.start <= now + timedelta(days=days),
            )
            .order_by(CalendarEvent.start.asc())
            .limit(50)
        )
    ).scalars().all()
    return [
        {
            "title": e.title,
            "start": e.start,
            "end": e.end,
            "type": e.type,
            "contact": e.contact_name,
            "notes": e.notes,
        }
        for e in events
    ]


async def execute_leadspot_tool(
    tool_name: str,
    tool_input: dict,
    org_id: str,
    db: AsyncSession,
    user_id: str = "",
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
            result = await _list_suggestions(db, org_id, tool_input)
        elif tool_name == "get_deal_details":
            result = await _get_deal_details(db, org_id, tool_input)
            if result is None:
                return {"success": False, "error": f"No deal matched '{tool_input.get('search')}'", "error_type": "not_found"}
        elif tool_name == "list_recent_emails":
            result = await _list_recent_emails(db, org_id, tool_input)
        elif tool_name == "list_campaigns":
            result = await _list_campaigns(db, user_id)
        elif tool_name == "list_segments":
            result = await _list_segments(db, user_id)
        elif tool_name == "list_calendar_events":
            result = await _list_calendar_events(db, org_id, tool_input)
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
