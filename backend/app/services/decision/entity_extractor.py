"""Entity extraction from decision queries using Claude."""

import json

from anthropic import AsyncAnthropic

from app.config import settings


class EntityExtractor:
    """Extract decisions, people, projects, dates, and keywords from queries."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def extract_entities(self, query: str) -> dict[str, list[str]]:
        """
        Extract entities from a query about a past decision.

        Args:
            query: User's natural language query about a decision

        Returns:
            Dictionary containing extracted entities:
            {
                "decisions": ["decision title 1", ...],
                "people": ["person name 1", ...],
                "projects": ["project name 1", ...],
                "dates": ["2023-01", ...],
                "keywords": ["keyword1", ...]
            }
        """
        prompt = f"""You are an expert at extracting structured information from queries about past business decisions.

Query: "{query}"

Extract the following entities from this query:
1. **Decisions**: What decision(s) is the user asking about? (e.g., "hire a CTO", "launch product X")
2. **People**: Any people mentioned (names, roles, or descriptions)
3. **Projects**: Any projects or initiatives mentioned
4. **Dates**: Any dates or time periods mentioned (normalize to YYYY-MM format if possible)
5. **Keywords**: Important keywords that might help search (technologies, concepts, outcomes)

Return ONLY a valid JSON object in this exact format:
{{
  "decisions": ["decision 1", "decision 2"],
  "people": ["person 1", "person 2"],
  "projects": ["project 1"],
  "dates": ["2023-01", "2024-06"],
  "keywords": ["keyword1", "keyword2"]
}}

If a category has no entities, use an empty array [].
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1500,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract text content from response
            content = response.content[0].text

            # Parse JSON response
            entities = json.loads(content)

            # Validate structure
            required_keys = ["decisions", "people", "projects", "dates", "keywords"]
            for key in required_keys:
                if key not in entities:
                    entities[key] = []

            return entities

        except json.JSONDecodeError as e:
            # Fallback if JSON parsing fails
            print(f"JSON parsing error: {e}")
            return {
                "decisions": [],
                "people": [],
                "projects": [],
                "dates": [],
                "keywords": query.split()[:5]  # Use first 5 words as keywords
            }
        except Exception as e:
            print(f"Entity extraction error: {e}")
            return {
                "decisions": [],
                "people": [],
                "projects": [],
                "dates": [],
                "keywords": []
            }

    async def extract_decision_context(self, decision_text: str) -> dict[str, any]:
        """
        Extract structured context from a decision description.

        Args:
            decision_text: Full description of a decision

        Returns:
            Dictionary with decision context including rationale, outcomes, etc.
        """
        prompt = f"""Analyze this decision and extract key information:

Decision: "{decision_text}"

Extract:
1. **Main Decision**: One-sentence summary
2. **Rationale**: Why was this decision made? (bullet points)
3. **Key Factors**: What influenced this decision? (bullet points)
4. **Expected Outcomes**: What outcomes were anticipated?
5. **Stakeholders**: Who was involved or affected?

Return as JSON:
{{
  "summary": "one sentence",
  "rationale": ["reason 1", "reason 2"],
  "factors": ["factor 1", "factor 2"],
  "expected_outcomes": ["outcome 1"],
  "stakeholders": ["stakeholder 1"]
}}
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2000,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text
            context = json.loads(content)
            return context

        except Exception as e:
            print(f"Context extraction error: {e}")
            return {
                "summary": decision_text[:100],
                "rationale": [],
                "factors": [],
                "expected_outcomes": [],
                "stakeholders": []
            }
