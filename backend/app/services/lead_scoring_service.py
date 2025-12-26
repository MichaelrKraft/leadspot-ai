"""
LeadSpot Lead Scoring Service

Calculates engagement scores for contacts based on their activity.
Automatically tags leads as hot/warm/cold based on thresholds.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from app.services.mautic_client import MauticClient

logger = logging.getLogger(__name__)


# Scoring configuration
ACTIVITY_SCORES = {
    # High-value actions
    "email.click": 15,
    "page.hit": 8,
    "form.submit": 25,
    "asset.download": 20,

    # Medium-value actions
    "email.open": 5,
    "email.send": 2,

    # Low-value/automated actions
    "lead.imported": 1,
    "lead.created": 1,
    "lead.stage_change": 3,
    "lead.utm_tags": 2,

    # Campaign engagement
    "campaign.event": 5,
    "campaign.kicked_off": 3,
}

# Special page bonuses
PAGE_BONUSES = {
    "pricing": 20,
    "demo": 25,
    "contact": 15,
    "quote": 20,
    "trial": 25,
    "signup": 20,
}

# Recency multipliers (how recent is the activity)
RECENCY_MULTIPLIERS = {
    "24h": 1.5,      # Activity in last 24 hours
    "7d": 1.2,       # Activity in last 7 days
    "30d": 1.0,      # Activity in last 30 days
    "90d": 0.7,      # Activity in last 90 days
    "older": 0.5,    # Older than 90 days
}

# Score thresholds for tagging
SCORE_THRESHOLDS = {
    "hot": 75,       # >= 75 points = hot-lead
    "warm": 40,      # >= 40 points = warm-lead
    "cold": 0,       # < 40 points = cold-lead
}


class LeadScoringService:
    """
    Service for calculating and managing lead engagement scores.

    Combines Mautic's built-in points with behavioral analysis to provide
    a comprehensive engagement score.
    """

    def __init__(self, mautic_client: MauticClient):
        self.mautic_client = mautic_client

    async def calculate_score(self, contact_id: int) -> dict:
        """
        Calculate engagement score for a contact.

        Args:
            contact_id: Mautic contact ID

        Returns:
            Dictionary with score breakdown
        """
        try:
            # Get contact data
            contact_data = await self.mautic_client.get_contact(contact_id)
            contact = contact_data.get("contact", {})

            # Get base points from Mautic
            base_points = contact.get("points", 0) or 0

            # Get activity timeline
            activity_data = await self.mautic_client.get_contact_activity(contact_id, limit=50)
            events = activity_data.get("events", [])

            # Calculate activity score
            activity_score, activity_breakdown = self._calculate_activity_score(events)

            # Calculate recency multiplier
            recency_mult, recency_category = self._get_recency_multiplier(events)

            # Calculate final score
            raw_score = base_points + activity_score
            final_score = int(raw_score * recency_mult)

            # Determine lead tier
            tier = self._get_lead_tier(final_score)

            return {
                "contact_id": contact_id,
                "final_score": final_score,
                "base_points": base_points,
                "activity_score": activity_score,
                "recency_multiplier": recency_mult,
                "recency_category": recency_category,
                "tier": tier,
                "breakdown": activity_breakdown,
                "calculated_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error calculating score for contact {contact_id}: {e}")
            raise

    def _calculate_activity_score(self, events: list) -> tuple[int, dict]:
        """
        Calculate score from activity events.

        Args:
            events: List of activity events

        Returns:
            Tuple of (total_score, breakdown_dict)
        """
        total = 0
        breakdown = {}

        for event in events:
            event_type = event.get("event", "")
            details = event.get("eventLabel", "").lower() if event.get("eventLabel") else ""

            # Get base score for event type
            score = ACTIVITY_SCORES.get(event_type, 0)

            # Apply page bonuses for page hits
            if event_type == "page.hit":
                for keyword, bonus in PAGE_BONUSES.items():
                    if keyword in details:
                        score += bonus
                        break

            total += score

            # Track breakdown
            if event_type:
                key = event_type
                if key not in breakdown:
                    breakdown[key] = {"count": 0, "points": 0}
                breakdown[key]["count"] += 1
                breakdown[key]["points"] += score

        return total, breakdown

    def _get_recency_multiplier(self, events: list) -> tuple[float, str]:
        """
        Calculate recency multiplier based on most recent activity.

        Args:
            events: List of activity events

        Returns:
            Tuple of (multiplier, category_name)
        """
        if not events:
            return RECENCY_MULTIPLIERS["older"], "older"

        # Find most recent event
        now = datetime.utcnow()
        most_recent = None

        for event in events:
            timestamp_str = event.get("timestamp")
            if timestamp_str:
                try:
                    # Parse timestamp (format: "2024-01-15T10:30:00+00:00")
                    timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                    timestamp = timestamp.replace(tzinfo=None)  # Make naive for comparison
                    if most_recent is None or timestamp > most_recent:
                        most_recent = timestamp
                except (ValueError, TypeError):
                    continue

        if most_recent is None:
            return RECENCY_MULTIPLIERS["older"], "older"

        # Calculate age
        age = now - most_recent

        if age <= timedelta(hours=24):
            return RECENCY_MULTIPLIERS["24h"], "24h"
        elif age <= timedelta(days=7):
            return RECENCY_MULTIPLIERS["7d"], "7d"
        elif age <= timedelta(days=30):
            return RECENCY_MULTIPLIERS["30d"], "30d"
        elif age <= timedelta(days=90):
            return RECENCY_MULTIPLIERS["90d"], "90d"
        else:
            return RECENCY_MULTIPLIERS["older"], "older"

    def _get_lead_tier(self, score: int) -> str:
        """Get lead tier based on score."""
        if score >= SCORE_THRESHOLDS["hot"]:
            return "hot"
        elif score >= SCORE_THRESHOLDS["warm"]:
            return "warm"
        else:
            return "cold"

    async def auto_tag_contact(self, contact_id: int, score: int) -> dict:
        """
        Apply lead tier tags based on score.

        Args:
            contact_id: Mautic contact ID
            score: Calculated engagement score

        Returns:
            Dictionary with tagging result
        """
        tier = self._get_lead_tier(score)
        tag = f"{tier}-lead"  # e.g., "hot-lead", "warm-lead", "cold-lead"

        try:
            # Add the appropriate tag
            result = await self.mautic_client.add_contact_tag(contact_id, tag)

            return {
                "contact_id": contact_id,
                "score": score,
                "tier": tier,
                "tag_applied": tag,
                "success": True,
            }
        except Exception as e:
            logger.error(f"Error tagging contact {contact_id}: {e}")
            return {
                "contact_id": contact_id,
                "score": score,
                "tier": tier,
                "tag_applied": None,
                "success": False,
                "error": str(e),
            }

    async def score_and_tag(self, contact_id: int) -> dict:
        """
        Calculate score and apply appropriate tag.

        Convenience method that combines scoring and tagging.

        Args:
            contact_id: Mautic contact ID

        Returns:
            Combined result with score and tagging info
        """
        score_result = await self.calculate_score(contact_id)
        tag_result = await self.auto_tag_contact(contact_id, score_result["final_score"])

        return {
            **score_result,
            "tag_applied": tag_result["tag_applied"],
            "tagging_success": tag_result["success"],
        }

    async def batch_score_contacts(
        self,
        limit: int = 100,
        auto_tag: bool = True,
    ) -> dict:
        """
        Score multiple contacts in batch.

        Args:
            limit: Maximum contacts to score
            auto_tag: Whether to apply tags

        Returns:
            Batch scoring results
        """
        results = []
        errors = []

        try:
            # Get contacts ordered by most recent first
            contacts_data = await self.mautic_client.get_contacts(
                limit=limit,
                order_by="date_added",
                order_direction="DESC"
            )

            contacts = contacts_data.get("contacts", {})

            for contact_id, contact in contacts.items():
                try:
                    if auto_tag:
                        result = await self.score_and_tag(int(contact_id))
                    else:
                        result = await self.calculate_score(int(contact_id))
                    results.append(result)
                except Exception as e:
                    errors.append({
                        "contact_id": contact_id,
                        "error": str(e),
                    })

        except Exception as e:
            logger.error(f"Error in batch scoring: {e}")
            raise

        # Summarize results
        tier_counts = {"hot": 0, "warm": 0, "cold": 0}
        for r in results:
            tier = r.get("tier", "cold")
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

        return {
            "total_scored": len(results),
            "errors": len(errors),
            "tier_summary": tier_counts,
            "results": results,
            "error_details": errors if errors else None,
        }
