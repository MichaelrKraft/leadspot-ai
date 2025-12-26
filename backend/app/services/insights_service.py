"""
LeadSpot Daily Insights Service

Generates AI-powered daily briefings with hot leads, follow-ups, and campaign insights.
This is the core service for the Daily AI Dashboard feature.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from anthropic import AsyncAnthropic

from app.config import settings
from app.services.mautic_client import MauticClient

logger = logging.getLogger(__name__)


class InsightsService:
    """
    Service for generating daily CRM insights.

    This service aggregates data from Mautic and uses Claude to synthesize
    actionable insights for the user.
    """

    def __init__(self, mautic_client: MauticClient):
        self.mautic_client = mautic_client

    async def get_hot_leads(self, limit: int = 5) -> list[dict]:
        """
        Get top leads sorted by engagement points.

        Args:
            limit: Maximum number of leads to return

        Returns:
            List of contact dictionaries with key fields
        """
        try:
            result = await self.mautic_client.get_contacts(
                limit=limit,
                order_by="points",
                order_direction="DESC"
            )

            contacts = result.get("contacts", {})
            hot_leads = []

            for contact_id, contact in contacts.items():
                if isinstance(contact, dict):
                    fields = contact.get("fields", {}).get("all", {})
                    hot_leads.append({
                        "id": contact_id,
                        "firstname": fields.get("firstname", ""),
                        "lastname": fields.get("lastname", ""),
                        "email": fields.get("email", ""),
                        "company": fields.get("company", ""),
                        "points": contact.get("points", 0),
                        "last_active": fields.get("last_active"),
                    })

            # Sort by points (highest first)
            hot_leads.sort(key=lambda x: x.get("points", 0), reverse=True)
            return hot_leads[:limit]

        except Exception as e:
            logger.error(f"Error getting hot leads: {e}")
            return []

    async def get_recent_contacts(self, limit: int = 5) -> list[dict]:
        """
        Get most recently added contacts.

        Args:
            limit: Maximum number of contacts to return

        Returns:
            List of recently added contacts
        """
        try:
            result = await self.mautic_client.get_contacts(
                limit=limit,
                order_by="date_added",
                order_direction="DESC"
            )

            contacts = result.get("contacts", {})
            recent = []

            for contact_id, contact in contacts.items():
                if isinstance(contact, dict):
                    fields = contact.get("fields", {}).get("all", {})
                    recent.append({
                        "id": contact_id,
                        "firstname": fields.get("firstname", ""),
                        "lastname": fields.get("lastname", ""),
                        "email": fields.get("email", ""),
                        "company": fields.get("company", ""),
                        "date_added": contact.get("dateAdded"),
                    })

            return recent[:limit]

        except Exception as e:
            logger.error(f"Error getting recent contacts: {e}")
            return []

    async def get_campaign_insights(self, limit: int = 5) -> list[dict]:
        """
        Get insights about recent campaigns.

        Args:
            limit: Maximum campaigns to analyze

        Returns:
            List of campaign insights
        """
        try:
            result = await self.mautic_client.get_campaigns(limit=limit)
            campaigns = result.get("campaigns", {})

            insights = []
            for campaign_id, campaign in campaigns.items():
                if isinstance(campaign, dict):
                    insights.append({
                        "id": campaign_id,
                        "name": campaign.get("name", ""),
                        "is_published": campaign.get("isPublished", False),
                        "date_added": campaign.get("dateAdded"),
                        "date_modified": campaign.get("dateModified"),
                    })

            return insights[:limit]

        except Exception as e:
            logger.error(f"Error getting campaign insights: {e}")
            return []

    async def get_summary_stats(self) -> dict:
        """
        Get overall CRM summary statistics.

        Returns:
            Dictionary with counts for contacts, emails, campaigns, segments
        """
        try:
            return await self.mautic_client.get_summary_stats()
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
        campaigns: list[dict],
    ) -> str:
        """
        Use Claude to synthesize human-readable insights.

        Args:
            hot_leads: List of hot lead data
            stats: Summary statistics
            campaigns: Campaign insights

        Returns:
            AI-generated insights text
        """
        if not settings.ANTHROPIC_API_KEY:
            return "Configure your AI key to get personalized insights."

        try:
            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            # Build context for Claude
            prompt = f"""You are LeadSpot AI. Based on the following CRM data, provide 2-3 brief, actionable insights for the user.

**Summary Stats:**
- Total Contacts: {stats.get('total_contacts', 0)}
- Total Emails: {stats.get('total_emails', 0)}
- Total Campaigns: {stats.get('total_campaigns', 0)}
- Total Segments: {stats.get('total_segments', 0)}

**Top Leads by Points:**
{self._format_leads_for_prompt(hot_leads)}

**Recent Campaigns:**
{self._format_campaigns_for_prompt(campaigns)}

Provide 2-3 brief insights (1-2 sentences each). Focus on actionable recommendations. Use emoji sparingly (one per insight max). Don't repeat the raw data - synthesize it."""

            response = await client.messages.create(
                model="claude-3-5-haiku-20241022",  # Fast model for insights
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )

            return response.content[0].text if response.content else ""

        except Exception as e:
            logger.error(f"Error generating AI insights: {e}")
            return "Unable to generate AI insights at this time."

    def _format_leads_for_prompt(self, leads: list[dict]) -> str:
        """Format leads list for the AI prompt."""
        if not leads:
            return "No leads data available"

        lines = []
        for lead in leads[:5]:
            name = f"{lead.get('firstname', '')} {lead.get('lastname', '')}".strip() or "Unknown"
            points = lead.get("points", 0)
            company = lead.get("company", "")
            company_str = f" ({company})" if company else ""
            lines.append(f"- {name}{company_str}: {points} points")

        return "\n".join(lines)

    def _format_campaigns_for_prompt(self, campaigns: list[dict]) -> str:
        """Format campaigns list for the AI prompt."""
        if not campaigns:
            return "No campaign data available"

        lines = []
        for campaign in campaigns[:5]:
            name = campaign.get("name", "Unnamed")
            status = "Active" if campaign.get("is_published") else "Draft"
            lines.append(f"- {name} ({status})")

        return "\n".join(lines)

    async def get_daily_insights(self) -> dict:
        """
        Generate complete daily insights package.

        This is the main method called by the API endpoint.

        Returns:
            Dictionary containing all insight data
        """
        # Fetch all data in parallel would be nice, but let's keep it simple
        hot_leads = await self.get_hot_leads(limit=5)
        recent_contacts = await self.get_recent_contacts(limit=5)
        stats = await self.get_summary_stats()
        campaigns = await self.get_campaign_insights(limit=5)

        # Generate AI synthesis
        ai_insights = await self.generate_ai_insights(hot_leads, stats, campaigns)

        return {
            "hot_leads": hot_leads,
            "recent_contacts": recent_contacts,
            "stats": stats,
            "campaigns": campaigns,
            "ai_insights": ai_insights,
            "generated_at": datetime.utcnow().isoformat(),
        }
