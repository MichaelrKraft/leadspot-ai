"""
Main query orchestration service - wires together the full RAG pipeline
"""

import time
from uuid import UUID

from anthropic import AsyncAnthropic

from app.config import settings
from app.core.prompts import SYNTHESIS_PROMPT
from app.schemas.query import Source
from app.services.cache_service import CacheService
from app.services.citation_service import get_citation_service
from app.services.context_builder import get_context_builder
from app.services.embedding_service import generate_embedding
from app.services.synthesis_service import generate_follow_up_questions
from app.services.vector_service import search_similar_documents


class QueryService:
    """Orchestrates the complete RAG query pipeline"""

    def __init__(self, cache_service: CacheService | None = None):
        self.cache_service = cache_service
        self.context_builder = get_context_builder()
        self.citation_service = get_citation_service()
        self.claude_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def process_query(
        self,
        query: str,
        organization_id: UUID,
        max_sources: int = 10,
        use_cache: bool = True
    ) -> dict[str, any]:
        """
        Process complete query through RAG pipeline

        Pipeline: embed → search → context → synthesize → cite

        Args:
            query: User's query
            organization_id: Organization ID for filtering
            max_sources: Maximum sources to retrieve
            use_cache: Whether to use cached results

        Returns:
            Dictionary with answer, sources, citations, and metadata
        """
        start_time = time.time()
        pipeline_metrics = {
            "embed_time_ms": 0,
            "search_time_ms": 0,
            "context_time_ms": 0,
            "synthesis_time_ms": 0,
            "citation_time_ms": 0,
            "total_time_ms": 0,
            "cache_hit": False,
            "tokens_used": 0
        }

        try:
            # Step 0: Check cache
            cached_result = None
            if use_cache and self.cache_service:
                cache_start = time.time()
                cached_result = await self.cache_service.get_query_result(
                    query,
                    str(organization_id),
                    max_sources
                )
                if cached_result:
                    pipeline_metrics["cache_hit"] = True
                    pipeline_metrics["total_time_ms"] = int((time.time() - start_time) * 1000)
                    cached_result["metrics"] = pipeline_metrics
                    return cached_result

            # Step 1: Generate embedding for query
            embed_start = time.time()
            query_embedding = await self._get_or_generate_embedding(query)
            pipeline_metrics["embed_time_ms"] = int((time.time() - embed_start) * 1000)

            # Step 2: Search for relevant documents in vector DB
            search_start = time.time()
            similar_docs = await search_similar_documents(
                embedding=query_embedding,
                organization_id=organization_id,
                max_results=max_sources * 2  # Retrieve more than needed for better context
            )
            pipeline_metrics["search_time_ms"] = int((time.time() - search_start) * 1000)

            if not similar_docs:
                return self._empty_result(pipeline_metrics)

            # Step 3: Build context from retrieved chunks
            context_start = time.time()
            context, context_metadata = self.context_builder.build_context(
                query=query,
                sources=similar_docs,
                max_sources=max_sources
            )
            pipeline_metrics["context_time_ms"] = int((time.time() - context_start) * 1000)
            pipeline_metrics["context_metadata"] = context_metadata

            # Step 4: Synthesize answer using Claude
            synthesis_start = time.time()
            answer, synthesis_tokens = await self._synthesize_answer(query, context)
            pipeline_metrics["synthesis_time_ms"] = int((time.time() - synthesis_start) * 1000)
            pipeline_metrics["tokens_used"] = synthesis_tokens

            # Use only the sources that were included in context
            sources_used = similar_docs[:context_metadata["sources_included"]]

            # Step 5: Extract and match citations
            citation_start = time.time()
            citations = self.citation_service.extract_citations(answer, sources_used)
            citation_coverage = self.citation_service.calculate_citation_coverage(
                answer,
                sources_used
            )
            pipeline_metrics["citation_time_ms"] = int((time.time() - citation_start) * 1000)

            # Calculate total time
            pipeline_metrics["total_time_ms"] = int((time.time() - start_time) * 1000)

            # Step 6: Generate follow-up questions
            followup_start = time.time()
            follow_up_questions = await generate_follow_up_questions(query, answer)
            pipeline_metrics["followup_time_ms"] = int((time.time() - followup_start) * 1000)

            # Build result
            result = {
                "answer": answer,
                "sources": [self._source_to_dict(s) for s in sources_used],
                "citations": citations,
                "citation_coverage": citation_coverage,
                "metrics": pipeline_metrics,
                "total_sources_found": len(similar_docs),
                "sources_used": len(sources_used),
                "follow_up_questions": follow_up_questions
            }

            # Cache the result
            if use_cache and self.cache_service:
                await self.cache_service.set_query_result(
                    query,
                    str(organization_id),
                    max_sources,
                    result
                )

            return result

        except Exception as e:
            pipeline_metrics["total_time_ms"] = int((time.time() - start_time) * 1000)
            pipeline_metrics["error"] = str(e)
            raise Exception(f"Query pipeline failed: {e!s}")

    async def _get_or_generate_embedding(self, text: str) -> list[float]:
        """
        Get embedding from cache or generate new one

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        # Check cache
        if self.cache_service:
            cached_embedding = await self.cache_service.get_embedding(text)
            if cached_embedding:
                return cached_embedding

        # Generate new embedding
        embedding = await generate_embedding(text)

        # Cache for future use
        if self.cache_service:
            await self.cache_service.set_embedding(text, embedding)

        return embedding

    async def _synthesize_answer(
        self,
        query: str,
        context: str
    ) -> tuple[str, int]:
        """
        Synthesize answer using Claude

        Args:
            query: User's query
            context: Formatted context from sources

        Returns:
            Tuple of (answer, tokens_used)
        """
        # Build user prompt
        user_prompt = self.context_builder.build_user_prompt(query, context)

        # Call Claude
        response = await self.claude_client.messages.create(
            model=settings.SYNTHESIS_MODEL,
            max_tokens=4000,
            temperature=0.3,  # Lower temperature for more focused answers
            system=SYNTHESIS_PROMPT,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )

        # Extract answer
        answer = response.content[0].text

        # Calculate tokens used (input + output)
        tokens_used = response.usage.input_tokens + response.usage.output_tokens

        return answer, tokens_used

    def _source_to_dict(self, source: Source) -> dict:
        """
        Convert Source object to dictionary

        Args:
            source: Source object

        Returns:
            Dictionary representation
        """
        return {
            "document_id": str(source.document_id),
            "title": source.title,
            "url": source.url,
            "excerpt": source.excerpt,
            "relevance_score": source.relevance_score
        }

    def _empty_result(self, metrics: dict) -> dict:
        """
        Return empty result when no sources found

        Args:
            metrics: Pipeline metrics

        Returns:
            Empty result dictionary
        """
        return {
            "answer": "I couldn't find any relevant documents to answer your question. This might be because:\n\n1. No documents have been indexed yet\n2. Your query doesn't match any content in the knowledge base\n3. Try rephrasing your question or using different keywords",
            "sources": [],
            "citations": [],
            "citation_coverage": {
                "total_sources_available": 0,
                "sources_cited": 0,
                "total_citations": 0,
                "citation_coverage_percent": 0,
                "average_citations_per_source": 0,
                "uncited_source_count": 0
            },
            "metrics": metrics,
            "total_sources_found": 0,
            "sources_used": 0,
            "follow_up_questions": []
        }

    async def get_follow_up_suggestions(
        self,
        query: str,
        answer: str,
        sources: list[Source]
    ) -> list[str]:
        """
        Generate follow-up question suggestions

        Args:
            query: Original query
            answer: Synthesized answer
            sources: Sources used

        Returns:
            List of follow-up questions
        """
        # This is a placeholder for future AI-powered follow-up generation
        # For now, return empty list
        return []


# Singleton instance
_query_service = None


async def get_query_service(
    cache_service: CacheService | None = None
) -> QueryService:
    """
    Get singleton QueryService instance

    Args:
        cache_service: Optional cache service

    Returns:
        QueryService instance
    """
    global _query_service
    if _query_service is None:
        _query_service = QueryService(cache_service=cache_service)
    return _query_service
