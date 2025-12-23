"""
Health Scanner Service

Scans documents to detect:
- Conflicts (similar content with different information)
- Outdated documents (old timestamps)
- Knowledge gaps (topics with low coverage)

Uses local vector store for similarity detection.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.services import local_embedding_service, local_vector_store
from app.services.health.alert_service import AlertService

logger = logging.getLogger(__name__)


class HealthScanner:
    """Scans knowledge base for health issues."""

    def __init__(self, alert_service: AlertService):
        self.alert_service = alert_service
        # Thresholds
        self.SIMILARITY_THRESHOLD = 0.85  # Documents this similar may conflict
        self.OUTDATED_DAYS = 180  # Documents older than this are outdated
        self.STALE_DAYS = 90  # Documents older than this need review

    async def scan_all(
        self,
        org_id: str,
        db: AsyncSession
    ) -> dict[str, Any]:
        """
        Run all health scans for an organization.

        Args:
            org_id: Organization ID
            db: Database session

        Returns:
            Dictionary with scan results
        """
        logger.info(f"Starting full health scan for org {org_id}")

        results = {
            "org_id": org_id,
            "scanned_at": datetime.utcnow().isoformat(),
            "conflicts_detected": 0,
            "outdated_detected": 0,
            "alerts_created": 0
        }

        # Get all documents for the organization
        query = select(Document).where(Document.organization_id == org_id)
        result = await db.execute(query)
        documents = result.scalars().all()

        if not documents:
            logger.info(f"No documents found for org {org_id}")
            return results

        # Run scans
        conflicts = await self._scan_conflicts(org_id, documents)
        outdated = await self._scan_outdated(documents)

        # Create alerts for findings
        alerts_created = 0

        for conflict in conflicts:
            await self.alert_service.create_alert(
                org_id=org_id,
                alert_type="conflict",
                severity=conflict.get("severity", "medium"),
                description=conflict["description"],
                metadata=conflict.get("metadata", {})
            )
            alerts_created += 1

        for outdated_doc in outdated:
            await self.alert_service.create_alert(
                org_id=org_id,
                alert_type="outdated",
                severity=outdated_doc.get("severity", "low"),
                description=outdated_doc["description"],
                metadata=outdated_doc.get("metadata", {})
            )
            alerts_created += 1

        results["conflicts_detected"] = len(conflicts)
        results["outdated_detected"] = len(outdated)
        results["alerts_created"] = alerts_created

        logger.info(
            f"Health scan complete for org {org_id}: "
            f"{len(conflicts)} conflicts, {len(outdated)} outdated"
        )

        return results

    async def _scan_conflicts(
        self,
        org_id: str,
        documents: list[Document]
    ) -> list[dict[str, Any]]:
        """
        Scan for conflicting documents using semantic similarity.

        Documents with high similarity but different content may indicate conflicts.
        """
        conflicts = []

        # Need at least 2 documents for conflict detection
        if len(documents) < 2:
            return conflicts

        # Check if embeddings are available
        if not local_embedding_service.is_available():
            logger.warning("Embedding service not available for conflict detection")
            return conflicts

        # Get titles for similarity comparison
        doc_titles = [doc.title or doc.filename for doc in documents]

        # Generate embeddings for titles to find similar documents
        try:
            title_embeddings = local_embedding_service.generate_embeddings_batch(doc_titles)
        except Exception as e:
            logger.error(f"Error generating title embeddings: {e}")
            return conflicts

        import numpy as np

        # Compare each pair of documents
        checked_pairs = set()
        for i, doc_i in enumerate(documents):
            for j, doc_j in enumerate(documents):
                if i >= j:
                    continue

                pair_key = tuple(sorted([str(doc_i.document_id), str(doc_j.document_id)]))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)

                # Calculate cosine similarity
                emb_i = np.array(title_embeddings[i])
                emb_j = np.array(title_embeddings[j])

                norm_i = np.linalg.norm(emb_i)
                norm_j = np.linalg.norm(emb_j)

                if norm_i == 0 or norm_j == 0:
                    continue

                similarity = float(np.dot(emb_i, emb_j) / (norm_i * norm_j))

                # High similarity could indicate conflict
                if similarity >= self.SIMILARITY_THRESHOLD:
                    # Check if documents have different modification dates
                    # (might indicate one supersedes the other)
                    time_diff = abs(
                        (doc_i.last_modified or doc_i.created_at) -
                        (doc_j.last_modified or doc_j.created_at)
                    ).days if (doc_i.last_modified or doc_i.created_at) and (doc_j.last_modified or doc_j.created_at) else 0

                    severity = "high" if similarity >= 0.95 else "medium"

                    conflicts.append({
                        "description": f"Potential conflict: '{doc_i.title}' and '{doc_j.title}' "
                                     f"are {similarity*100:.0f}% similar",
                        "severity": severity,
                        "metadata": {
                            "doc1_id": str(doc_i.document_id),
                            "doc1_title": doc_i.title,
                            "doc2_id": str(doc_j.document_id),
                            "doc2_title": doc_j.title,
                            "similarity": round(similarity, 3),
                            "time_difference_days": time_diff
                        }
                    })

        return conflicts

    async def _scan_outdated(self, documents: list[Document]) -> list[dict[str, Any]]:
        """
        Scan for outdated documents based on age.
        """
        outdated = []
        now = datetime.utcnow()

        for doc in documents:
            doc_date = doc.last_modified or doc.created_at
            if not doc_date:
                continue

            # Handle timezone-naive vs timezone-aware comparison
            if doc_date.tzinfo is not None:
                doc_date = doc_date.replace(tzinfo=None)

            age_days = (now - doc_date).days

            if age_days >= self.OUTDATED_DAYS:
                severity = "high" if age_days >= 365 else "medium"
                outdated.append({
                    "description": f"Outdated: '{doc.title}' hasn't been updated in {age_days} days",
                    "severity": severity,
                    "metadata": {
                        "document_id": str(doc.document_id),
                        "title": doc.title,
                        "age_days": age_days,
                        "last_updated": doc_date.isoformat()
                    }
                })
            elif age_days >= self.STALE_DAYS:
                outdated.append({
                    "description": f"Needs review: '{doc.title}' is {age_days} days old",
                    "severity": "low",
                    "metadata": {
                        "document_id": str(doc.document_id),
                        "title": doc.title,
                        "age_days": age_days,
                        "last_updated": doc_date.isoformat()
                    }
                })

        return outdated

    async def scan_document(
        self,
        doc_id: str,
        org_id: str,
        db: AsyncSession
    ) -> dict[str, Any]:
        """
        Scan a single document for issues.

        Args:
            doc_id: Document ID
            org_id: Organization ID
            db: Database session

        Returns:
            Scan results for this document
        """
        results = {
            "document_id": doc_id,
            "issues": []
        }

        # Get the document
        query = select(Document).where(
            Document.document_id == doc_id,
            Document.organization_id == org_id
        )
        result = await db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            results["error"] = "Document not found"
            return results

        # Check if outdated
        now = datetime.utcnow()
        doc_date = document.last_modified or document.created_at
        if doc_date:
            if doc_date.tzinfo is not None:
                doc_date = doc_date.replace(tzinfo=None)
            age_days = (now - doc_date).days

            if age_days >= self.OUTDATED_DAYS:
                results["issues"].append({
                    "type": "outdated",
                    "severity": "high" if age_days >= 365 else "medium",
                    "message": f"Document is {age_days} days old"
                })
            elif age_days >= self.STALE_DAYS:
                results["issues"].append({
                    "type": "stale",
                    "severity": "low",
                    "message": f"Document is {age_days} days old and may need review"
                })

        # Check for similar documents (potential conflicts)
        if document.title and local_embedding_service.is_available():
            similar_docs = local_vector_store.search_deduplicated(
                query=document.title,
                organization_id=org_id,
                limit=3,
                min_score=self.SIMILARITY_THRESHOLD
            )

            for sim_doc in similar_docs:
                sim_doc_id = sim_doc['metadata'].get('document_id')
                if sim_doc_id and sim_doc_id != doc_id:
                    results["issues"].append({
                        "type": "potential_conflict",
                        "severity": "medium",
                        "message": f"Similar to '{sim_doc['metadata'].get('title', 'Unknown')}' "
                                 f"({sim_doc['similarity']*100:.0f}% similar)"
                    })

        return results
