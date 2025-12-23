"""
Integration tests for query pipeline

Tests the complete RAG pipeline: embed → search → context → synthesize → cite
"""

from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.schemas.query import Source
from app.services.cache_service import CacheService
from app.services.citation_service import CitationService
from app.services.context_builder import ContextBuilder
from app.services.query_service import QueryService


@pytest.fixture
def mock_sources():
    """Create mock source documents"""
    return [
        Source(
            document_id=uuid4(),
            title="Strategic Planning Document",
            url="https://example.com/doc1",
            excerpt="This document outlines our strategic planning process for Q4 2024. Key initiatives include market expansion and product development.",
            relevance_score=0.95
        ),
        Source(
            document_id=uuid4(),
            title="Product Roadmap 2024",
            url="https://example.com/doc2",
            excerpt="Our product roadmap focuses on three core areas: AI integration, mobile experience, and enterprise features.",
            relevance_score=0.87
        ),
        Source(
            document_id=uuid4(),
            title="Market Analysis Report",
            url="https://example.com/doc3",
            excerpt="Market analysis shows strong demand for AI-powered solutions in the enterprise space.",
            relevance_score=0.82
        )
    ]


@pytest.fixture
def mock_cache_service():
    """Create mock cache service"""
    cache = AsyncMock(spec=CacheService)
    cache.get_query_result = AsyncMock(return_value=None)
    cache.set_query_result = AsyncMock(return_value=True)
    cache.get_embedding = AsyncMock(return_value=None)
    cache.set_embedding = AsyncMock(return_value=True)
    return cache


@pytest.mark.asyncio
async def test_context_builder_token_management(mock_sources):
    """Test context builder properly manages token limits"""
    builder = ContextBuilder()

    # Build context
    context, metadata = builder.build_context(
        query="What are our strategic priorities?",
        sources=mock_sources,
        max_sources=3
    )

    # Verify context was built
    assert context != ""
    assert len(context) > 0

    # Verify metadata
    assert metadata["sources_included"] <= 3
    assert metadata["total_tokens"] > 0
    assert metadata["total_tokens"] < builder.AVAILABLE_TOKENS
    assert "utilization_percent" in metadata


@pytest.mark.asyncio
async def test_citation_service_extraction(mock_sources):
    """Test citation service extracts citations correctly"""
    service = CitationService()

    # Mock answer with citations
    answer = """Based on the available documents, our strategic priorities include:

1. Market Expansion: According to Strategic Planning Document, we're focusing on Q4 2024 initiatives.

2. Product Development: As stated in Product Roadmap 2024, we're prioritizing AI integration, mobile experience, and enterprise features.

3. Market Positioning: Per Market Analysis Report, there's strong demand for AI-powered solutions.

These priorities align with our overall business strategy."""

    # Extract citations
    citations = service.extract_citations(answer, mock_sources)

    # Verify citations were found
    assert len(citations) > 0

    # Check citation structure
    for citation in citations:
        assert "citation_text" in citation
        assert "document_id" in citation
        assert "document_title" in citation
        assert "context" in citation


@pytest.mark.asyncio
async def test_citation_coverage_calculation(mock_sources):
    """Test citation coverage metrics"""
    service = CitationService()

    answer = """According to Strategic Planning Document, our Q4 priorities are clear.
The Product Roadmap 2024 outlines our development plans."""

    # Calculate coverage
    coverage = service.calculate_citation_coverage(answer, mock_sources)

    # Verify coverage metrics
    assert coverage["total_sources_available"] == len(mock_sources)
    assert coverage["sources_cited"] >= 0
    assert coverage["total_citations"] >= 0
    assert "citation_coverage_percent" in coverage
    assert "average_citations_per_source" in coverage


@pytest.mark.asyncio
@patch('app.services.query_service.generate_embedding')
@patch('app.services.query_service.search_similar_documents')
async def test_query_pipeline_end_to_end(
    mock_search,
    mock_embed,
    mock_sources,
    mock_cache_service
):
    """Test complete query pipeline execution"""

    # Setup mocks
    mock_embed.return_value = [0.1] * 1536  # Mock embedding
    mock_search.return_value = mock_sources

    # Mock Claude API response
    with patch('app.services.query_service.AsyncAnthropic') as mock_anthropic:
        mock_response = Mock()
        mock_response.content = [Mock(text="Test answer based on Strategic Planning Document")]
        mock_response.usage = Mock(input_tokens=500, output_tokens=200)

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        mock_anthropic.return_value = mock_client

        # Create service
        service = QueryService(cache_service=mock_cache_service)

        # Process query
        result = await service.process_query(
            query="What are our strategic priorities?",
            organization_id=uuid4(),
            max_sources=10,
            use_cache=True
        )

        # Verify result structure
        assert "answer" in result
        assert "sources" in result
        assert "citations" in result
        assert "citation_coverage" in result
        assert "metrics" in result

        # Verify metrics
        metrics = result["metrics"]
        assert "embed_time_ms" in metrics
        assert "search_time_ms" in metrics
        assert "context_time_ms" in metrics
        assert "synthesis_time_ms" in metrics
        assert "citation_time_ms" in metrics
        assert "total_time_ms" in metrics
        assert "tokens_used" in metrics

        # Verify tokens were counted
        assert metrics["tokens_used"] == 700  # 500 + 200


@pytest.mark.asyncio
async def test_empty_sources_handling(mock_cache_service):
    """Test pipeline handles no sources gracefully"""

    with patch('app.services.query_service.generate_embedding') as mock_embed:
        with patch('app.services.query_service.search_similar_documents') as mock_search:
            mock_embed.return_value = [0.1] * 1536
            mock_search.return_value = []  # No sources found

            service = QueryService(cache_service=mock_cache_service)

            result = await service.process_query(
                query="Find nothing",
                organization_id=uuid4(),
                max_sources=10,
                use_cache=False
            )

            # Verify empty result
            assert "answer" in result
            assert "couldn't find" in result["answer"].lower()
            assert result["sources"] == []
            assert result["total_sources_found"] == 0


@pytest.mark.asyncio
async def test_cache_hit_scenario(mock_sources):
    """Test cache hit returns cached result"""

    cached_result = {
        "answer": "Cached answer",
        "sources": [],
        "citations": [],
        "citation_coverage": {},
        "metrics": {
            "cache_hit": True,
            "total_time_ms": 5
        },
        "total_sources_found": 3,
        "sources_used": 3
    }

    mock_cache = AsyncMock(spec=CacheService)
    mock_cache.get_query_result = AsyncMock(return_value=cached_result)

    service = QueryService(cache_service=mock_cache)

    result = await service.process_query(
        query="Test query",
        organization_id=uuid4(),
        max_sources=10,
        use_cache=True
    )

    # Verify cache was used
    assert result["metrics"]["cache_hit"] == True
    assert result["answer"] == "Cached answer"


def test_context_builder_truncation():
    """Test context builder truncates long excerpts"""
    builder = ContextBuilder()

    # Create source with very long excerpt
    long_excerpt = "word " * 10000  # Very long text
    source = Source(
        document_id=uuid4(),
        title="Long Document",
        url="https://example.com/long",
        excerpt=long_excerpt,
        relevance_score=0.9
    )

    # Build context with limited tokens
    context, metadata = builder.build_context(
        query="Short query",
        sources=[source],
        max_sources=1
    )

    # Verify truncation occurred if needed
    assert metadata["total_tokens"] < builder.AVAILABLE_TOKENS
    assert metadata["sources_included"] > 0


def test_token_counting_accuracy():
    """Test token counting is reasonably accurate"""
    builder = ContextBuilder()

    # Test with known text
    text = "Hello world, this is a test of token counting."
    tokens = builder.count_tokens(text)

    # Should be roughly 10-12 tokens
    assert 8 <= tokens <= 15


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
