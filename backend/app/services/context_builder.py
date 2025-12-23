"""
Context builder service for constructing Claude-ready context from retrieved chunks
"""


import tiktoken

from app.schemas.query import Source

# Initialize tokenizer for accurate token counting
try:
    tokenizer = tiktoken.encoding_for_model("gpt-4")
except Exception:
    tokenizer = tiktoken.get_encoding("cl100k_base")


class ContextBuilder:
    """Builds optimized context for Claude synthesis"""

    # Claude 3.5 Sonnet has 200k context window, but we'll be conservative
    MAX_CONTEXT_TOKENS = 100000
    # Reserve tokens for system prompt, user query, and response
    RESERVED_TOKENS = 5000
    AVAILABLE_TOKENS = MAX_CONTEXT_TOKENS - RESERVED_TOKENS

    def __init__(self):
        self.tokenizer = tokenizer

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using tiktoken

        Args:
            text: Input text

        Returns:
            Number of tokens
        """
        try:
            return len(self.tokenizer.encode(text))
        except Exception:
            # Fallback: approximate 1 token ≈ 4 characters
            return len(text) // 4

    def build_context(
        self,
        query: str,
        sources: list[Source],
        max_sources: int = None
    ) -> tuple[str, dict[str, any]]:
        """
        Build context from sources with token limit management

        Args:
            query: User's query
            sources: List of source documents
            max_sources: Maximum sources to include (None = auto)

        Returns:
            Tuple of (formatted_context, metadata)
        """
        if not sources:
            return "", {"sources_included": 0, "total_tokens": 0, "truncated": False}

        # Calculate query tokens
        query_tokens = self.count_tokens(query)
        available_for_sources = self.AVAILABLE_TOKENS - query_tokens

        context_parts = []
        total_tokens = 0
        sources_included = 0
        truncated = False

        # Sort sources by relevance
        sorted_sources = sorted(sources, key=lambda s: s.relevance_score, reverse=True)

        # If max_sources specified, limit the list
        if max_sources:
            sorted_sources = sorted_sources[:max_sources]

        for idx, source in enumerate(sorted_sources, 1):
            # Format source entry
            source_text = self._format_source(idx, source)
            source_tokens = self.count_tokens(source_text)

            # Check if adding this source would exceed limit
            if total_tokens + source_tokens > available_for_sources:
                # Try truncating the excerpt
                truncated_source = self._truncate_source(
                    idx,
                    source,
                    available_for_sources - total_tokens
                )

                if truncated_source:
                    context_parts.append(truncated_source)
                    total_tokens += self.count_tokens(truncated_source)
                    sources_included += 1

                truncated = True
                break

            context_parts.append(source_text)
            total_tokens += source_tokens
            sources_included += 1

        # Join all context parts
        full_context = "\n\n".join(context_parts)

        metadata = {
            "sources_included": sources_included,
            "total_sources_available": len(sources),
            "total_tokens": total_tokens,
            "query_tokens": query_tokens,
            "available_tokens": available_for_sources,
            "truncated": truncated,
            "utilization_percent": round((total_tokens / available_for_sources) * 100, 2)
        }

        return full_context, metadata

    def _format_source(self, index: int, source: Source) -> str:
        """
        Format a single source for context

        Args:
            index: Source number (1-indexed)
            source: Source object

        Returns:
            Formatted source string
        """
        # Check if this is an email source
        if source.source_system == "gmail":
            return self._format_email_source(index, source)

        parts = [
            f"[Source {index}]",
            f"Document ID: {source.document_id}",
            f"Title: {source.title}",
        ]

        if source.url:
            parts.append(f"URL: {source.url}")

        parts.extend([
            f"Relevance Score: {source.relevance_score:.3f}",
            f"\nContent:\n{source.excerpt}",
            "---"
        ])

        return "\n".join(parts)

    def _format_email_source(self, index: int, source: Source) -> str:
        """
        Format an email source with email-specific metadata

        Args:
            index: Source number (1-indexed)
            source: Source object from Gmail

        Returns:
            Formatted email source string
        """
        # Extract email metadata from title/content (emails are formatted with headers)
        # The email content includes: Subject, From, To, Date in the indexed content
        parts = [
            f"[Email Source {index}]",
            f"Subject: {source.title}",
        ]

        if source.url:
            parts.append(f"Gmail Link: {source.url}")

        parts.extend([
            f"Relevance Score: {source.relevance_score:.3f}",
            f"\nEmail Content:\n{source.excerpt}",
            "---"
        ])

        return "\n".join(parts)

    def _truncate_source(
        self,
        index: int,
        source: Source,
        max_tokens: int
    ) -> str:
        """
        Truncate source excerpt to fit within token limit

        Args:
            index: Source number
            source: Source object
            max_tokens: Maximum tokens allowed

        Returns:
            Truncated source string or empty string if can't fit
        """
        # Reserve tokens for metadata
        metadata_template = f"""[Source {index}]
Document ID: {source.document_id}
Title: {source.title}
URL: {source.url or 'N/A'}
Relevance Score: {source.relevance_score:.3f}

Content:
[CONTENT]
---"""

        metadata_tokens = self.count_tokens(metadata_template.replace("[CONTENT]", ""))
        available_for_content = max_tokens - metadata_tokens

        if available_for_content < 50:  # Minimum meaningful content
            return ""

        # Truncate excerpt to fit
        excerpt = source.excerpt
        excerpt_tokens = self.count_tokens(excerpt)

        if excerpt_tokens <= available_for_content:
            truncated_excerpt = excerpt
        else:
            # Binary search for optimal length
            chars = len(excerpt)
            left, right = 0, chars

            while left < right:
                mid = (left + right + 1) // 2
                candidate = excerpt[:mid] + "..."

                if self.count_tokens(candidate) <= available_for_content:
                    left = mid
                else:
                    right = mid - 1

            truncated_excerpt = excerpt[:left] + "... [truncated]"

        # Build truncated source
        return f"""[Source {index}]
Document ID: {source.document_id}
Title: {source.title}
URL: {source.url or 'N/A'}
Relevance Score: {source.relevance_score:.3f}

Content:
{truncated_excerpt}
---"""

    def build_user_prompt(self, query: str, context: str, has_email_sources: bool = False) -> str:
        """
        Build complete user prompt with query and context

        Args:
            query: User's query
            context: Formatted context from sources
            has_email_sources: Whether context includes email sources

        Returns:
            Complete user prompt
        """
        base_prompt = f"""Question: {query}

Source Documents:
{context}

Please synthesize a comprehensive answer based on these sources."""

        # Add citation instructions based on source types
        if has_email_sources:
            base_prompt += """

Citation Guidelines:
- For email sources: cite as "Email from [sender] on [date]" or "[Email Subject]"
- For document sources: cite as [Document Title]
- When quoting email content, note if it's from the email body, subject, or attachments
- Pay special attention to dates mentioned in emails when the query involves time references"""
        else:
            base_prompt += """
Cite sources using [Document Title] notation, not [Source N]."""

        base_prompt += """
Focus on providing actionable insights and strategic value."""

        return base_prompt

    def estimate_response_tokens(self) -> int:
        """
        Estimate tokens needed for Claude's response

        Returns:
            Estimated response tokens
        """
        # Conservative estimate: allow 2000 tokens for response
        return 2000


# Singleton instance
_context_builder = None


def get_context_builder() -> ContextBuilder:
    """
    Get singleton ContextBuilder instance

    Returns:
        ContextBuilder instance
    """
    global _context_builder
    if _context_builder is None:
        _context_builder = ContextBuilder()
    return _context_builder
