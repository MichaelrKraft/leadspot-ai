"""
Citation extraction and matching service
"""

import re

from app.schemas.query import Source


class CitationService:
    """Extracts and matches citations from synthesized answers"""

    def __init__(self):
        # Patterns for detecting citations in text
        # Use tighter patterns to reduce false positives
        self.citation_patterns = [
            r'\[([^\]]+)\]',  # [Document Title] - explicit brackets
            r'\baccording\s+to\s+"([^"]+)"',  # according to "Document Title" - quoted
            r'\bas\s+stated\s+in\s+"([^"]+)"',  # as stated in "Document Title" - quoted
            r'\baccording\s+to\s+([A-Z][^,.]+?)(?:\s+(?:said|noted|stated|mentioned|reported)|,)',  # according to Title said/noted/,
            r'\bas\s+(?:mentioned|noted|stated|described)\s+in\s+([A-Z][^,.]+?)(?:,|\.|\s+the)',  # as mentioned in Title,
            r'\bper\s+the\s+([A-Z][^,.]+?)(?:,|\.)',  # per the Document Title,
        ]

    def extract_citations(
        self,
        answer: str,
        sources: list[Source]
    ) -> list[dict[str, any]]:
        """
        Extract and match citations from synthesized answer

        Args:
            answer: Synthesized answer text
            sources: List of source documents used

        Returns:
            List of citation objects with matched sources
        """
        citations = []
        cited_sources = set()

        # Create mapping of titles to sources for quick lookup
        title_to_source = {source.title.lower(): source for source in sources}
        source_id_to_source = {str(source.document_id): source for source in sources}

        # Extract all potential citations
        for pattern in self.citation_patterns:
            matches = re.finditer(pattern, answer, re.IGNORECASE)

            for match in matches:
                citation_text = match.group(1).strip()

                # Try to match to a source
                matched_source = self._match_citation_to_source(
                    citation_text,
                    title_to_source,
                    source_id_to_source
                )

                if matched_source and str(matched_source.document_id) not in cited_sources:
                    # Extract context around citation
                    start = max(0, match.start() - 100)
                    end = min(len(answer), match.end() + 100)
                    context = answer[start:end].strip()

                    citation = {
                        "citation_text": citation_text,
                        "document_id": matched_source.document_id,
                        "document_title": matched_source.title,
                        "url": matched_source.url,
                        "excerpt": matched_source.excerpt[:200] + "..." if len(matched_source.excerpt) > 200 else matched_source.excerpt,
                        "relevance_score": matched_source.relevance_score,
                        "context": context,
                        "position_in_answer": match.start()
                    }

                    citations.append(citation)
                    cited_sources.add(str(matched_source.document_id))

        # Sort citations by position in answer
        citations.sort(key=lambda c: c["position_in_answer"])

        return citations

    def _match_citation_to_source(
        self,
        citation_text: str,
        title_to_source: dict[str, Source],
        source_id_to_source: dict[str, Source]
    ) -> Source:
        """
        Match a citation text to a source document

        Args:
            citation_text: Citation text extracted from answer
            title_to_source: Mapping of lowercase titles to sources
            source_id_to_source: Mapping of source IDs to sources

        Returns:
            Matched Source object or None
        """
        citation_lower = citation_text.lower().strip()

        # Exact match
        if citation_lower in title_to_source:
            return title_to_source[citation_lower]

        # Fuzzy match: check if citation is substring of any title
        for title, source in title_to_source.items():
            if citation_lower in title or title in citation_lower:
                return source

        # Check if it's a source number reference (e.g., "Source 1")
        source_num_match = re.match(r'source\s+(\d+)', citation_lower)
        if source_num_match:
            # This shouldn't happen with proper prompting, but handle it
            # Note: We can't reliably map this without the original source list order
            pass

        return None

    def get_cited_sources(
        self,
        answer: str,
        sources: list[Source]
    ) -> list[Source]:
        """
        Get list of sources that were actually cited in the answer

        Args:
            answer: Synthesized answer
            sources: All available sources

        Returns:
            List of cited Source objects
        """
        citations = self.extract_citations(answer, sources)
        cited_source_ids = {c["document_id"] for c in citations}

        return [s for s in sources if s.document_id in cited_source_ids]

    def get_uncited_sources(
        self,
        answer: str,
        sources: list[Source]
    ) -> list[Source]:
        """
        Get list of sources that were NOT cited in the answer

        Args:
            answer: Synthesized answer
            sources: All available sources

        Returns:
            List of uncited Source objects
        """
        citations = self.extract_citations(answer, sources)
        cited_source_ids = {c["document_id"] for c in citations}

        return [s for s in sources if s.document_id not in cited_source_ids]

    def calculate_citation_coverage(
        self,
        answer: str,
        sources: list[Source]
    ) -> dict[str, any]:
        """
        Calculate citation coverage metrics

        Args:
            answer: Synthesized answer
            sources: All available sources

        Returns:
            Dictionary with citation metrics
        """
        citations = self.extract_citations(answer, sources)
        cited_sources = self.get_cited_sources(answer, sources)

        total_sources = len(sources)
        cited_count = len(cited_sources)
        citation_count = len(citations)

        return {
            "total_sources_available": total_sources,
            "sources_cited": cited_count,
            "total_citations": citation_count,
            "citation_coverage_percent": round((cited_count / total_sources * 100), 2) if total_sources > 0 else 0,
            "average_citations_per_source": round(citation_count / cited_count, 2) if cited_count > 0 else 0,
            "uncited_source_count": total_sources - cited_count
        }

    def format_citations_for_display(
        self,
        citations: list[dict[str, any]]
    ) -> list[dict[str, any]]:
        """
        Format citations for frontend display

        Args:
            citations: List of citation objects

        Returns:
            List of formatted citation objects
        """
        formatted = []

        for idx, citation in enumerate(citations, 1):
            formatted.append({
                "citation_number": idx,
                "title": citation["document_title"],
                "url": citation["url"],
                "excerpt": citation["excerpt"],
                "relevance_score": citation["relevance_score"],
                "context": citation["context"]
            })

        return formatted


# Singleton instance
_citation_service = None


def get_citation_service() -> CitationService:
    """
    Get singleton CitationService instance

    Returns:
        CitationService instance
    """
    global _citation_service
    if _citation_service is None:
        _citation_service = CitationService()
    return _citation_service
