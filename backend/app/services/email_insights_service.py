"""
Email-based Daily Insights Service

Generates AI-powered daily briefings from real synced email activity
(the Unified Inbox's email_messages table) instead of Mautic. Replaces
InsightsService (Mautic-backed) for the /insights/daily dashboard card.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.email_message import EmailMessage
from app.services.inference.llm_client import get_anthropic_client

logger = logging.getLogger(__name__)

RECENT_WINDOW_DAYS = 14
STATS_WINDOW_DAYS = 30


def _thread_key(m: EmailMessage) -> str:
    return m.thread_id or m.provider_message_id


class EmailInsightsService:
    """Aggregates email_messages activity and synthesizes AI insights for an org."""

    def __init__(self, db: AsyncSession, org_id: str):
        self.db = db
        self.org_id = org_id

    async def _recent_messages(self, days: int) -> list[EmailMessage]:
        since = datetime.utcnow() - timedelta(days=days)
        rows = (
            await self.db.execute(
                select(EmailMessage)
                .where(
                    EmailMessage.org_id == self.org_id,
                    EmailMessage.received_at >= since,
                )
                .order_by(EmailMessage.received_at.desc())
            )
        ).scalars().all()
        return list(rows)

    async def _contact_names(self, contact_ids: set[str]) -> dict[str, str]:
        if not contact_ids:
            return {}
        contacts = (
            await self.db.execute(
                select(Contact).where(
                    Contact.organization_id == self.org_id,
                    Contact.id.in_(contact_ids),
                )
            )
        ).scalars().all()
        return {c.id: f"{c.first_name} {c.last_name}".strip() or c.email for c in contacts}

    async def get_hot_leads(self, limit: int = 5) -> list[dict]:
        """
        Contacts with the most recent inbound activity, weighted toward
        threads where an inbound message hasn't been replied to yet
        (the "reply while it's hot" signal an owner cares about).
        """
        try:
            messages = await self._recent_messages(RECENT_WINDOW_DAYS)
            if not messages:
                return []

            threads: dict[str, list[EmailMessage]] = {}
            for m in messages:
                threads.setdefault(_thread_key(m), []).append(m)

            contact_ids = {m.contact_id for m in messages if m.contact_id}
            names = await self._contact_names(contact_ids)

            scored: list[dict] = []
            for thread in threads.values():
                thread.sort(key=lambda m: m.received_at or datetime.min)
                latest = thread[-1]
                if latest.direction != "inbound":
                    continue  # last touch was ours — not awaiting a reply
                contact_id = next((m.contact_id for m in thread if m.contact_id), None)
                name = names.get(contact_id, "") if contact_id else ""
                first_name, _, last_name = name.partition(" ")
                scored.append({
                    "id": contact_id or latest.from_address,
                    "firstname": first_name or latest.from_address,
                    "lastname": last_name,
                    "email": latest.from_address,
                    "company": "",
                    "points": len(thread),  # thread depth as an engagement proxy
                    "last_active": latest.received_at.isoformat() if latest.received_at else None,
                })

            scored.sort(key=lambda x: x["last_active"] or "", reverse=True)
            return scored[:limit]

        except Exception as e:
            logger.error(f"Error computing hot leads from email activity: {e}")
            return []

    async def get_recent_contacts(self, limit: int = 5) -> list[dict]:
        """Contacts with the most recent email activity of any direction."""
        try:
            messages = await self._recent_messages(RECENT_WINDOW_DAYS)
            if not messages:
                return []

            seen: dict[str, EmailMessage] = {}
            for m in messages:
                key = m.contact_id or m.from_address
                if key not in seen or (m.received_at or datetime.min) > (seen[key].received_at or datetime.min):
                    seen[key] = m

            contact_ids = {m.contact_id for m in seen.values() if m.contact_id}
            names = await self._contact_names(contact_ids)

            recent = []
            for key, m in seen.items():
                name = names.get(m.contact_id, "") if m.contact_id else ""
                first_name, _, last_name = name.partition(" ")
                recent.append({
                    "id": m.contact_id or m.from_address,
                    "firstname": first_name or m.from_address,
                    "lastname": last_name,
                    "email": m.from_address,
                    "company": "",
                    "date_added": m.received_at.isoformat() if m.received_at else None,
                })

            recent.sort(key=lambda x: x["date_added"] or "", reverse=True)
            return recent[:limit]

        except Exception as e:
            logger.error(f"Error computing recent contacts from email activity: {e}")
            return []

    async def get_summary_stats(self) -> dict:
        try:
            total_contacts = (
                await self.db.execute(
                    select(Contact).where(Contact.organization_id == self.org_id)
                )
            ).scalars().all()

            recent_messages = await self._recent_messages(STATS_WINDOW_DAYS)
            active_threads = {_thread_key(m) for m in recent_messages}

            return {
                "total_contacts": len(total_contacts),
                "total_emails": len(recent_messages),
                "total_campaigns": len(active_threads),  # active email threads, not Mautic campaigns
                "total_segments": 0,
            }
        except Exception as e:
            logger.error(f"Error getting summary stats: {e}")
            return {
                "total_contacts": 0,
                "total_emails": 0,
                "total_campaigns": 0,
                "total_segments": 0,
            }

    async def generate_ai_insights(
        self,
        hot_leads: list[dict],
        stats: dict,
    ) -> str:
        """Use Claude (org BYOK key first) to synthesize actionable insights from email activity."""
        client = await get_anthropic_client(self.db, self.org_id)
        if client is None:
            return "Configure your AI key to get personalized insights."

        if not hot_leads and stats.get("total_emails", 0) == 0:
            return "No recent email activity yet. Connect your inbox in Settings to start seeing insights."

        try:
            prompt = f"""You are LeadSpot AI. Based on the following recent email activity, provide 2-3 brief, actionable insights for the user.

**Summary (last {STATS_WINDOW_DAYS} days):**
- Total Contacts: {stats.get('total_contacts', 0)}
- Emails: {stats.get('total_emails', 0)}
- Active Threads: {stats.get('total_campaigns', 0)}

**Contacts awaiting a reply (most recent inbound activity):**
{self._format_leads_for_prompt(hot_leads)}

Provide 2-3 brief insights (1-2 sentences each). Focus on who needs a follow-up and why, based on the thread activity shown. Use emoji sparingly (one per insight max). Don't repeat the raw data - synthesize it."""

            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )

            return response.content[0].text if response.content else ""

        except Exception as e:
            logger.error(f"Error generating AI insights: {e}")
            return "Unable to generate AI insights at this time."

    def _format_leads_for_prompt(self, leads: list[dict]) -> str:
        if not leads:
            return "No contacts currently awaiting a reply"

        lines = []
        for lead in leads[:5]:
            name = f"{lead.get('firstname', '')} {lead.get('lastname', '')}".strip() or "Unknown"
            thread_depth = lead.get("points", 0)
            lines.append(f"- {name} ({lead.get('email', '')}): {thread_depth} message(s) in thread, last active {lead.get('last_active', 'unknown')}")

        return "\n".join(lines)

    async def get_daily_insights(self) -> dict:
        """Generate the complete daily insights package. Main entry point for the API endpoint."""
        hot_leads = await self.get_hot_leads(limit=5)
        recent_contacts = await self.get_recent_contacts(limit=5)
        stats = await self.get_summary_stats()

        ai_insights = await self.generate_ai_insights(hot_leads, stats)

        return {
            "hot_leads": hot_leads,
            "recent_contacts": recent_contacts,
            "stats": stats,
            "campaigns": [],  # no email-derived campaign concept; kept for response shape compat
            "ai_insights": ai_insights,
            "generated_at": datetime.utcnow().isoformat(),
        }
