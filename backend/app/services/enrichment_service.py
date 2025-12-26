"""
LeadSpot Contact Enrichment Service

Provides contact data enrichment features:
- Duplicate detection
- Email signature extraction
- Data validation and cleanup
- Smart merge suggestions
"""

import logging
import re
from typing import Optional

from anthropic import AsyncAnthropic

from app.config import settings
from app.services.mautic_client import MauticClient

logger = logging.getLogger(__name__)


# Email validation regex
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

# Phone number cleanup regex
PHONE_CLEANUP = re.compile(r"[^\d+]")


class EnrichmentService:
    """
    Service for enriching and cleaning contact data.
    """

    def __init__(self, mautic_client: MauticClient):
        self.mautic_client = mautic_client

    # =========================================================================
    # Duplicate Detection
    # =========================================================================

    async def find_duplicates(self, limit: int = 500) -> dict:
        """
        Find potential duplicate contacts.

        Looks for contacts with matching emails or similar names.

        Args:
            limit: Maximum contacts to analyze

        Returns:
            Dictionary with duplicate groups
        """
        try:
            contacts_data = await self.mautic_client.get_contacts(limit=limit)
            contacts = contacts_data.get("contacts", {})

            # Group by email
            email_groups = {}
            name_similarities = []

            for contact_id, contact in contacts.items():
                fields = contact.get("fields", {}).get("all", {})
                email = (fields.get("email") or "").lower().strip()
                firstname = (fields.get("firstname") or "").lower().strip()
                lastname = (fields.get("lastname") or "").lower().strip()

                # Group by email
                if email:
                    if email not in email_groups:
                        email_groups[email] = []
                    email_groups[email].append({
                        "id": contact_id,
                        "email": email,
                        "firstname": fields.get("firstname", ""),
                        "lastname": fields.get("lastname", ""),
                        "company": fields.get("company", ""),
                    })

            # Find email duplicates (more than one contact with same email)
            email_duplicates = {
                email: contacts
                for email, contacts in email_groups.items()
                if len(contacts) > 1
            }

            return {
                "email_duplicates": email_duplicates,
                "duplicate_count": sum(len(v) for v in email_duplicates.values()),
                "unique_duplicate_emails": len(email_duplicates),
                "contacts_analyzed": len(contacts),
            }

        except Exception as e:
            logger.error(f"Error finding duplicates: {e}")
            raise

    async def suggest_merge(self, contact_ids: list[int]) -> dict:
        """
        Suggest how to merge duplicate contacts.

        Analyzes multiple contacts and suggests which fields to keep.

        Args:
            contact_ids: List of contact IDs to merge

        Returns:
            Merge suggestion with recommended values
        """
        contacts = []
        for cid in contact_ids:
            try:
                data = await self.mautic_client.get_contact(cid)
                contacts.append(data.get("contact", {}))
            except Exception as e:
                logger.warning(f"Could not fetch contact {cid}: {e}")

        if len(contacts) < 2:
            return {"error": "Need at least 2 contacts to merge"}

        # Analyze fields and pick best values
        merged = {}
        field_names = ["firstname", "lastname", "email", "company", "phone", "title"]

        for field in field_names:
            values = []
            for contact in contacts:
                fields = contact.get("fields", {}).get("all", {})
                val = fields.get(field)
                if val and val.strip():
                    values.append(val.strip())

            # Pick the longest/most complete value
            if values:
                merged[field] = max(values, key=len)

        # Combine points (keep highest)
        points = max(c.get("points", 0) or 0 for c in contacts)
        merged["points"] = points

        # Combine tags
        all_tags = set()
        for contact in contacts:
            tags = contact.get("tags", [])
            for tag in tags:
                tag_name = tag.get("tag", tag) if isinstance(tag, dict) else tag
                all_tags.add(tag_name)

        return {
            "contact_ids": contact_ids,
            "merged_values": merged,
            "combined_tags": list(all_tags),
            "recommendation": f"Keep contact with most complete data, transfer tags and points",
        }

    # =========================================================================
    # Email Signature Extraction
    # =========================================================================

    async def extract_signature_data(self, email_body: str) -> dict:
        """
        Extract contact information from an email signature.

        Uses AI to parse email signatures and extract structured data.

        Args:
            email_body: Raw email body text

        Returns:
            Extracted contact information
        """
        if not settings.ANTHROPIC_API_KEY:
            return {"error": "AI key not configured"}

        try:
            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            prompt = f"""Extract contact information from this email signature. Return ONLY a JSON object with these fields:
- name (full name)
- title (job title)
- company (company name)
- email (email address)
- phone (phone number)
- website (company website)

If a field is not found, use null. Here's the email:

{email_body}

Return only the JSON object, no other text."""

            response = await client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )

            # Try to parse the response as JSON
            import json
            text = response.content[0].text.strip()

            # Try to extract JSON from the response
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                # Try to find JSON in the text
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    data = json.loads(text[start:end])
                else:
                    data = {"raw": text}

            return {
                "extracted": data,
                "success": True,
            }

        except Exception as e:
            logger.error(f"Error extracting signature: {e}")
            return {"error": str(e), "success": False}

    # =========================================================================
    # Data Validation
    # =========================================================================

    async def validate_contact(self, contact_id: int) -> dict:
        """
        Validate contact data quality.

        Checks for valid email format, phone format, required fields.

        Args:
            contact_id: Mautic contact ID

        Returns:
            Validation results with issues and suggestions
        """
        try:
            data = await self.mautic_client.get_contact(contact_id)
            contact = data.get("contact", {})
            fields = contact.get("fields", {}).get("all", {})

            issues = []
            suggestions = []

            # Check email
            email = fields.get("email", "")
            if not email:
                issues.append({"field": "email", "issue": "missing", "severity": "high"})
            elif not EMAIL_REGEX.match(email):
                issues.append({"field": "email", "issue": "invalid_format", "severity": "high"})

            # Check name
            firstname = fields.get("firstname", "")
            lastname = fields.get("lastname", "")
            if not firstname and not lastname:
                issues.append({"field": "name", "issue": "missing", "severity": "medium"})
                suggestions.append("Consider extracting name from email address")

            # Check phone
            phone = fields.get("phone", "")
            if phone:
                cleaned = PHONE_CLEANUP.sub("", phone)
                if len(cleaned) < 7:
                    issues.append({"field": "phone", "issue": "too_short", "severity": "low"})

            # Check for spam indicators
            if email:
                if any(x in email.lower() for x in ["noreply", "no-reply", "donotreply"]):
                    issues.append({"field": "email", "issue": "no_reply_address", "severity": "medium"})
                    suggestions.append("This appears to be a no-reply address")

            return {
                "contact_id": contact_id,
                "email": email,
                "issues": issues,
                "issue_count": len(issues),
                "suggestions": suggestions,
                "quality_score": self._calculate_quality_score(fields, issues),
            }

        except Exception as e:
            logger.error(f"Error validating contact {contact_id}: {e}")
            raise

    def _calculate_quality_score(self, fields: dict, issues: list) -> int:
        """Calculate a 0-100 quality score for the contact."""
        score = 100

        # Deduct for issues
        for issue in issues:
            severity = issue.get("severity", "low")
            if severity == "high":
                score -= 25
            elif severity == "medium":
                score -= 15
            else:
                score -= 5

        # Bonus for complete fields
        completeness_fields = ["email", "firstname", "lastname", "company", "phone"]
        filled = sum(1 for f in completeness_fields if fields.get(f))
        completeness_bonus = (filled / len(completeness_fields)) * 20

        score = max(0, min(100, int(score + completeness_bonus)))
        return score

    async def batch_validate(self, limit: int = 100) -> dict:
        """
        Validate multiple contacts and return summary.

        Args:
            limit: Maximum contacts to validate

        Returns:
            Batch validation results with statistics
        """
        try:
            contacts_data = await self.mautic_client.get_contacts(limit=limit)
            contacts = contacts_data.get("contacts", {})

            results = []
            total_issues = 0
            quality_scores = []

            for contact_id, contact in contacts.items():
                try:
                    fields = contact.get("fields", {}).get("all", {})
                    issues = []

                    # Quick validation without API calls
                    email = fields.get("email", "")
                    if not email or not EMAIL_REGEX.match(email):
                        issues.append("email_issue")

                    if not fields.get("firstname") and not fields.get("lastname"):
                        issues.append("no_name")

                    quality = self._calculate_quality_score(fields, [{"severity": "medium"} for _ in issues])
                    quality_scores.append(quality)
                    total_issues += len(issues)

                    if issues:
                        results.append({
                            "contact_id": contact_id,
                            "email": email,
                            "issues": issues,
                            "quality": quality,
                        })

                except Exception as e:
                    logger.warning(f"Error validating contact {contact_id}: {e}")

            avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0

            return {
                "contacts_analyzed": len(contacts),
                "contacts_with_issues": len(results),
                "total_issues": total_issues,
                "average_quality_score": round(avg_quality, 1),
                "issues": results[:20],  # Top 20 issues
            }

        except Exception as e:
            logger.error(f"Error in batch validation: {e}")
            raise
