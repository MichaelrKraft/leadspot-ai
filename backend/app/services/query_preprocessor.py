"""
Query Preprocessor Service

Preprocesses user queries to:
1. Expand temporal references (last month, yesterday, etc.) to actual dates
2. Add context hints for email-specific queries
3. Normalize query format

This improves search relevance for time-sensitive queries, especially for emails.
"""

import re
from calendar import monthrange
from datetime import datetime, timedelta
from typing import Any


class QueryPreprocessor:
    """Preprocesses queries for improved search relevance."""

    # Temporal patterns to match
    TEMPORAL_PATTERNS = {
        # Relative days
        r'\byesterday\b': lambda: _days_ago(1),
        r'\btoday\b': lambda: _days_ago(0),
        r'\blast\s+week\b': lambda: _weeks_ago(1),
        r'\bthis\s+week\b': lambda: _this_week(),
        r'\blast\s+month\b': lambda: _months_ago(1),
        r'\bthis\s+month\b': lambda: _this_month(),
        r'\blast\s+year\b': lambda: _years_ago(1),
        r'\bthis\s+year\b': lambda: _this_year(),
        # Specific day references
        r'\b(\d+)\s+days?\s+ago\b': lambda m: _days_ago(int(m.group(1))),
        r'\b(\d+)\s+weeks?\s+ago\b': lambda m: _weeks_ago(int(m.group(1))),
        r'\b(\d+)\s+months?\s+ago\b': lambda m: _months_ago(int(m.group(1))),
        # Month names
        r'\bin\s+(january|jan)\b': lambda: _specific_month(1),
        r'\bin\s+(february|feb)\b': lambda: _specific_month(2),
        r'\bin\s+(march|mar)\b': lambda: _specific_month(3),
        r'\bin\s+(april|apr)\b': lambda: _specific_month(4),
        r'\bin\s+(may)\b': lambda: _specific_month(5),
        r'\bin\s+(june|jun)\b': lambda: _specific_month(6),
        r'\bin\s+(july|jul)\b': lambda: _specific_month(7),
        r'\bin\s+(august|aug)\b': lambda: _specific_month(8),
        r'\bin\s+(september|sep|sept)\b': lambda: _specific_month(9),
        r'\bin\s+(october|oct)\b': lambda: _specific_month(10),
        r'\bin\s+(november|nov)\b': lambda: _specific_month(11),
        r'\bin\s+(december|dec)\b': lambda: _specific_month(12),
    }

    # Email-related query patterns
    EMAIL_PATTERNS = [
        r'\bemail\b',
        r'\binbox\b',
        r'\bsent\s+me\b',
        r'\breceived\b',
        r'\bfrom\s+\w+@',
        r'\bmessage\b',
        r'\bgmail\b',
        r'\bmail\b',
    ]

    def __init__(self):
        pass

    def preprocess(self, query: str) -> tuple[str, dict[str, Any]]:
        """
        Preprocess a query for improved search relevance.

        Args:
            query: Original user query

        Returns:
            Tuple of (enhanced_query, metadata)
            - enhanced_query: Query with expanded temporal references
            - metadata: Information about the preprocessing applied
        """
        metadata = {
            "original_query": query,
            "temporal_references_found": [],
            "is_email_query": False,
            "date_range": None,
        }

        enhanced_query = query.lower()

        # Check if this is an email-related query
        for pattern in self.EMAIL_PATTERNS:
            if re.search(pattern, enhanced_query, re.IGNORECASE):
                metadata["is_email_query"] = True
                break

        # Expand temporal references
        date_ranges = []
        for pattern, resolver in self.TEMPORAL_PATTERNS.items():
            match = re.search(pattern, enhanced_query, re.IGNORECASE)
            if match:
                try:
                    # Get the date range for this temporal reference
                    if callable(resolver):
                        # Check if resolver needs the match object
                        import inspect
                        sig = inspect.signature(resolver)
                        if len(sig.parameters) > 0:
                            date_range = resolver(match)
                        else:
                            date_range = resolver()

                        if date_range:
                            date_ranges.append(date_range)
                            metadata["temporal_references_found"].append({
                                "pattern": pattern,
                                "matched_text": match.group(0),
                                "date_range": {
                                    "start": date_range[0].isoformat(),
                                    "end": date_range[1].isoformat(),
                                }
                            })

                            # Enhance the query with the date range
                            start_date, end_date = date_range
                            date_context = f" (between {start_date.strftime('%B %d, %Y')} and {end_date.strftime('%B %d, %Y')})"

                            # Replace the temporal reference with the date context
                            enhanced_query = re.sub(
                                pattern,
                                match.group(0) + date_context,
                                enhanced_query,
                                flags=re.IGNORECASE
                            )
                except Exception:
                    # If date parsing fails, continue without enhancement
                    pass

        # Combine all date ranges into a single range if multiple found
        if date_ranges:
            min_start = min(dr[0] for dr in date_ranges)
            max_end = max(dr[1] for dr in date_ranges)
            metadata["date_range"] = {
                "start": min_start.isoformat(),
                "end": max_end.isoformat(),
            }

        return enhanced_query, metadata

    def add_email_context(self, query: str) -> str:
        """
        Add email-specific context hints to a query.

        Args:
            query: User query

        Returns:
            Query with email context hints
        """
        # If the query seems to be asking about emails, add context
        email_hints = []

        if re.search(r'\bwho\s+sent\b', query, re.IGNORECASE):
            email_hints.append("email from sender")
        if re.search(r'\bwhat\s+company\b', query, re.IGNORECASE):
            email_hints.append("company email domain")
        if re.search(r'\boffer\b|\bdeal\b|\bpromotion\b', query, re.IGNORECASE):
            email_hints.append("promotional email offer")

        if email_hints:
            return f"{query} (Context: {', '.join(email_hints)})"

        return query


# Helper functions for date calculations
def _days_ago(days: int) -> tuple[datetime, datetime]:
    """Get date range for N days ago."""
    target = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    return (target, target + timedelta(days=1) - timedelta(seconds=1))


def _weeks_ago(weeks: int) -> tuple[datetime, datetime]:
    """Get date range for N weeks ago."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    # Go back to Monday of that week
    target_end = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks - 1)
    target_start = target_end - timedelta(days=7)
    return (target_start, target_end - timedelta(seconds=1))


def _this_week() -> tuple[datetime, datetime]:
    """Get date range for this week."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=7) - timedelta(seconds=1)
    return (monday, sunday)


def _months_ago(months: int) -> tuple[datetime, datetime]:
    """Get date range for N months ago."""
    today = datetime.utcnow()
    # Calculate target month
    target_month = today.month - months
    target_year = today.year

    while target_month <= 0:
        target_month += 12
        target_year -= 1

    # Get first and last day of that month
    first_day = datetime(target_year, target_month, 1)
    last_day_num = monthrange(target_year, target_month)[1]
    last_day = datetime(target_year, target_month, last_day_num, 23, 59, 59)

    return (first_day, last_day)


def _this_month() -> tuple[datetime, datetime]:
    """Get date range for this month."""
    today = datetime.utcnow()
    first_day = datetime(today.year, today.month, 1)
    last_day_num = monthrange(today.year, today.month)[1]
    last_day = datetime(today.year, today.month, last_day_num, 23, 59, 59)
    return (first_day, last_day)


def _years_ago(years: int) -> tuple[datetime, datetime]:
    """Get date range for N years ago."""
    today = datetime.utcnow()
    target_year = today.year - years
    first_day = datetime(target_year, 1, 1)
    last_day = datetime(target_year, 12, 31, 23, 59, 59)
    return (first_day, last_day)


def _this_year() -> tuple[datetime, datetime]:
    """Get date range for this year."""
    today = datetime.utcnow()
    first_day = datetime(today.year, 1, 1)
    last_day = datetime(today.year, 12, 31, 23, 59, 59)
    return (first_day, last_day)


def _specific_month(month: int) -> tuple[datetime, datetime]:
    """Get date range for a specific month (assumes current year or last year if future)."""
    today = datetime.utcnow()
    year = today.year

    # If the month is in the future, assume last year
    if month > today.month:
        year -= 1

    first_day = datetime(year, month, 1)
    last_day_num = monthrange(year, month)[1]
    last_day = datetime(year, month, last_day_num, 23, 59, 59)
    return (first_day, last_day)


# Singleton instance
_preprocessor = None


def get_query_preprocessor() -> QueryPreprocessor:
    """Get singleton QueryPreprocessor instance."""
    global _preprocessor
    if _preprocessor is None:
        _preprocessor = QueryPreprocessor()
    return _preprocessor


# ============================================================================
# Research Mode - Query Decomposition
# ============================================================================

async def decompose_query(query: str) -> dict[str, Any]:
    """
    Analyze a query and decompose it into sub-queries for Research Mode.

    Research Mode breaks complex questions into simpler sub-queries,
    searches each independently, and synthesizes a comprehensive answer.

    Args:
        query: Original user query

    Returns:
        Dictionary with:
        - is_complex: Whether the query benefits from decomposition
        - sub_queries: List of simpler sub-queries (2-4 items)
        - synthesis_strategy: How to combine results (compare|aggregate|sequence)
        - reasoning: Why the decomposition was chosen
    """
    from app.services import synthesis_service

    system_prompt = """You are a research query analyzer. Analyze the given question and determine if it would benefit from being broken into sub-queries.

A query is COMPLEX and should be decomposed if it:
- Asks about multiple distinct aspects or entities
- Requires comparison between things
- Spans multiple time periods or contexts
- Needs information from different domains

A query is SIMPLE and should NOT be decomposed if it:
- Asks a single, focused question
- Is looking for a specific fact or definition
- Can be answered directly from one source

Output JSON with this exact structure:
{
  "is_complex": true/false,
  "sub_queries": ["query1", "query2", ...],
  "synthesis_strategy": "compare|aggregate|sequence",
  "reasoning": "Brief explanation"
}

Strategies:
- compare: Results should be compared/contrasted
- aggregate: Results should be combined into comprehensive answer
- sequence: Results should be presented in logical order"""

    prompt = f"Analyze this query: {query}"

    try:
        result = await synthesis_service.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=500
        )

        if result.get("success") and result.get("response"):
            import json
            response_text = result["response"].strip()

            # Try to extract JSON from response
            # Handle cases where response might have extra text
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1

            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                parsed = json.loads(json_str)

                return {
                    "is_complex": parsed.get("is_complex", False),
                    "sub_queries": parsed.get("sub_queries", [query]),
                    "synthesis_strategy": parsed.get("synthesis_strategy", "aggregate"),
                    "reasoning": parsed.get("reasoning", ""),
                    "original_query": query
                }

        # Default: treat as simple query
        return {
            "is_complex": False,
            "sub_queries": [query],
            "synthesis_strategy": "aggregate",
            "reasoning": "Could not analyze query complexity",
            "original_query": query
        }

    except Exception as e:
        # On error, treat as simple query
        return {
            "is_complex": False,
            "sub_queries": [query],
            "synthesis_strategy": "aggregate",
            "reasoning": f"Analysis failed: {e!s}",
            "original_query": query
        }


def is_query_complex(query: str) -> bool:
    """
    Quick heuristic check if a query might be complex.
    Used to decide whether to offer Research Mode.

    Args:
        query: User query

    Returns:
        True if query appears complex
    """
    # Heuristic indicators of complexity
    complexity_indicators = [
        # Comparison keywords
        r'\bcompare\b',
        r'\bvs\.?\b',
        r'\bversus\b',
        r'\bdifference\s+between\b',
        r'\bhow\s+does\s+.+\s+differ\b',
        # Multiple aspects
        r'\band\s+also\b',
        r'\bboth\b.+\band\b',
        r'\bmultiple\b',
        # Sequence/process
        r'\bsteps?\s+to\b',
        r'\bhow\s+to\s+.+\s+and\s+.+\b',
        r'\bprocess\s+of\b',
        # Broad questions
        r'\beverything\s+about\b',
        r'\bcomprehensive\b',
        r'\boverview\s+of\b',
        r'\bexplain\s+.+\s+in\s+detail\b',
    ]

    query_lower = query.lower()

    for pattern in complexity_indicators:
        if re.search(pattern, query_lower):
            return True

    # Also check word count - longer queries tend to be more complex
    word_count = len(query.split())
    if word_count > 20:
        return True

    # Check for multiple question marks
    if query.count("?") > 1:
        return True

    return False
