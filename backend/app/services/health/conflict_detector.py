"""Detect conflicting information across documents."""

import logging
from datetime import datetime
from typing import Any

from app.services.synthesis_service import SynthesisService
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


class ConflictDetector:
    """Detects conflicting information across knowledge base documents."""

    def __init__(self, vector_service: VectorService, synthesis_service: SynthesisService):
        self.vector_service = vector_service
        self.synthesis_service = synthesis_service
        self.similarity_threshold = 0.85  # Documents must be similar enough to conflict
        self.conflict_cache: dict[str, Any] = {}

    async def detect_conflicts(self, org_id: str, limit: int = 50) -> list[dict]:
        """
        Find documents with conflicting information.

        Args:
            org_id: Organization ID
            limit: Maximum number of conflicts to return

        Returns:
            List of conflict alerts with severity and details
        """
        logger.info(f"Starting conflict detection for org {org_id}")
        conflicts = []

        try:
            # 1. Get all document embeddings from Pinecone
            all_docs = await self.vector_service.get_all_documents(org_id)

            if len(all_docs) < 2:
                logger.info(f"Not enough documents ({len(all_docs)}) for conflict detection")
                return conflicts

            # 2. Find similar document pairs (cosine similarity > threshold)
            similar_pairs = await self._find_similar_pairs(all_docs, org_id)
            logger.info(f"Found {len(similar_pairs)} similar document pairs")

            # 3. Use Claude to verify if content actually contradicts
            for doc1, doc2, similarity in similar_pairs[:limit]:
                conflict_result = await self.analyze_conflict(
                    doc1_content=doc1.get("content", ""),
                    doc2_content=doc2.get("content", ""),
                    doc1_metadata=doc1.get("metadata", {}),
                    doc2_metadata=doc2.get("metadata", {})
                )

                if conflict_result.get("has_conflict"):
                    conflicts.append({
                        "type": "conflict",
                        "severity": conflict_result.get("severity", "medium"),
                        "description": conflict_result.get("description", ""),
                        "doc1_id": doc1.get("id"),
                        "doc1_title": doc1.get("metadata", {}).get("title", "Untitled"),
                        "doc2_id": doc2.get("id"),
                        "doc2_title": doc2.get("metadata", {}).get("title", "Untitled"),
                        "similarity_score": similarity,
                        "detected_at": datetime.utcnow().isoformat(),
                        "status": "active"
                    })

            logger.info(f"Detected {len(conflicts)} conflicts for org {org_id}")
            return conflicts

        except Exception as e:
            logger.error(f"Error detecting conflicts for org {org_id}: {e}", exc_info=True)
            return conflicts

    async def _find_similar_pairs(
        self,
        documents: list[dict],
        org_id: str
    ) -> list[tuple]:
        """
        Find pairs of documents with high similarity scores.

        Args:
            documents: List of document dictionaries
            org_id: Organization ID

        Returns:
            List of (doc1, doc2, similarity_score) tuples
        """
        similar_pairs = []

        # For each document, query Pinecone for similar documents
        for doc in documents:
            doc_id = doc.get("id")

            # Query vector store for similar documents
            similar_docs = await self.vector_service.similarity_search(
                org_id=org_id,
                query_embedding=doc.get("embedding"),
                top_k=10,
                filter_metadata={"org_id": org_id}
            )

            # Filter for high similarity (excluding self)
            for similar_doc in similar_docs:
                if similar_doc.get("id") != doc_id:
                    similarity = similar_doc.get("score", 0.0)
                    if similarity >= self.similarity_threshold:
                        # Avoid duplicate pairs (doc1, doc2) and (doc2, doc1)
                        pair_key = tuple(sorted([doc_id, similar_doc.get("id")]))
                        if pair_key not in self.conflict_cache:
                            similar_pairs.append((doc, similar_doc, similarity))
                            self.conflict_cache[pair_key] = True

        # Sort by similarity score descending
        similar_pairs.sort(key=lambda x: x[2], reverse=True)
        return similar_pairs

    async def analyze_conflict(
        self,
        doc1_content: str,
        doc2_content: str,
        doc1_metadata: dict | None = None,
        doc2_metadata: dict | None = None
    ) -> dict:
        """
        Use Claude to analyze if two documents contain conflicting information.

        Args:
            doc1_content: Content of first document
            doc2_content: Content of second document
            doc1_metadata: Metadata for first document
            doc2_metadata: Metadata for second document

        Returns:
            Dict with has_conflict, description, severity, and conflicting_sections
        """
        doc1_metadata = doc1_metadata or {}
        doc2_metadata = doc2_metadata or {}

        # Truncate content to avoid token limits (keep first 2000 chars)
        doc1_excerpt = doc1_content[:2000]
        doc2_excerpt = doc2_content[:2000]

        prompt = f"""You are a knowledge base analyzer. Compare these two documents for CONTRADICTING information.

Document 1 ({doc1_metadata.get('title', 'Untitled')}):
{doc1_excerpt}

Document 2 ({doc2_metadata.get('title', 'Untitled')}):
{doc2_excerpt}

IMPORTANT: Only report conflicts if the documents make CONTRADICTORY claims about the same topic.
- Different topics = NOT a conflict
- Different details about same topic = NOT a conflict
- Opposite claims about same fact = IS a conflict

Return ONLY valid JSON (no markdown):
{{
  "has_conflict": boolean,
  "description": "Brief description of the conflict",
  "severity": "high|medium|low",
  "conflicting_sections": ["section1", "section2"]
}}

Severity levels:
- high: Critical contradictions (policies, procedures, compliance)
- medium: Important contradictions (workflows, guidelines)
- low: Minor contradictions (recommendations, suggestions)
"""

        try:
            # Call Claude through synthesis service
            response = await self.synthesis_service.generate_completion(
                prompt=prompt,
                max_tokens=500,
                temperature=0.1  # Low temperature for consistent analysis
            )

            # Parse JSON response
            import json
            result = json.loads(response.strip())

            # Validate response structure
            if not isinstance(result, dict):
                raise ValueError("Response is not a dictionary")

            return {
                "has_conflict": result.get("has_conflict", False),
                "description": result.get("description", ""),
                "severity": result.get("severity", "low"),
                "conflicting_sections": result.get("conflicting_sections", [])
            }

        except Exception as e:
            logger.error(f"Error analyzing conflict: {e}", exc_info=True)
            # Return safe default (no conflict)
            return {
                "has_conflict": False,
                "description": f"Error analyzing conflict: {e!s}",
                "severity": "low",
                "conflicting_sections": []
            }

    async def resolve_conflict(
        self,
        org_id: str,
        conflict_id: str,
        resolution: str
    ) -> bool:
        """
        Mark a conflict as resolved.

        Args:
            org_id: Organization ID
            conflict_id: Conflict identifier
            resolution: Resolution description

        Returns:
            True if successfully resolved
        """
        # This will be implemented when we add database persistence
        logger.info(f"Conflict {conflict_id} resolved for org {org_id}: {resolution}")
        return True
