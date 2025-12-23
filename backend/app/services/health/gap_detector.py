"""Detect knowledge gaps based on user queries and failed searches."""

import logging
import re
from collections import Counter
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class GapDetector:
    """Detects knowledge gaps based on query patterns and search failures."""

    def __init__(self):
        # In-memory storage for query tracking (move to database later)
        self.failed_queries: list[dict] = []
        self.low_confidence_queries: list[dict] = []
        self.frequent_queries: Counter = Counter()

        # Configuration
        self.low_confidence_threshold = 0.6
        self.frequent_query_threshold = 10  # queries per month
        self.gap_detection_window_days = 30

    def track_query(
        self,
        org_id: str,
        query: str,
        confidence: float,
        result_count: int,
        user_id: str | None = None
    ) -> None:
        """
        Track a query for gap detection.

        Args:
            org_id: Organization ID
            query: Query text
            confidence: Confidence score (0-1)
            result_count: Number of results returned
            user_id: Optional user ID
        """
        query_data = {
            "org_id": org_id,
            "query": query,
            "confidence": confidence,
            "result_count": result_count,
            "user_id": user_id,
            "timestamp": datetime.utcnow()
        }

        # Track failed queries (no results)
        if result_count == 0:
            self.failed_queries.append(query_data)
            logger.info(f"Tracked failed query for org {org_id}: {query}")

        # Track low confidence queries
        if confidence < self.low_confidence_threshold:
            self.low_confidence_queries.append(query_data)
            logger.info(f"Tracked low confidence query for org {org_id}: {query} (confidence: {confidence})")

        # Track query frequency
        query_normalized = self._normalize_query(query)
        self.frequent_queries[f"{org_id}:{query_normalized}"] += 1

    async def detect_gaps(self, org_id: str) -> list[dict]:
        """
        Detect knowledge gaps for an organization.

        Args:
            org_id: Organization ID

        Returns:
            List of gap alerts with severity and suggestions
        """
        logger.info(f"Starting gap detection for org {org_id}")
        gaps = []
        cutoff_date = datetime.utcnow() - timedelta(days=self.gap_detection_window_days)

        try:
            # 1. Analyze failed queries (no results)
            failed_gaps = self._analyze_failed_queries(org_id, cutoff_date)
            gaps.extend(failed_gaps)

            # 2. Analyze low confidence queries
            low_confidence_gaps = self._analyze_low_confidence_queries(org_id, cutoff_date)
            gaps.extend(low_confidence_gaps)

            # 3. Analyze frequent queries (might need better documentation)
            frequent_gaps = self._analyze_frequent_queries(org_id)
            gaps.extend(frequent_gaps)

            # 4. Detect topic clusters in gaps
            clustered_gaps = self._cluster_gaps(gaps)

            logger.info(f"Detected {len(clustered_gaps)} knowledge gaps for org {org_id}")
            return clustered_gaps

        except Exception as e:
            logger.error(f"Error detecting gaps for org {org_id}: {e}", exc_info=True)
            return gaps

    def _analyze_failed_queries(self, org_id: str, cutoff_date: datetime) -> list[dict]:
        """Analyze queries that returned no results."""
        gaps = []

        # Filter recent failed queries for this org
        recent_failures = [
            q for q in self.failed_queries
            if q["org_id"] == org_id and q["timestamp"] >= cutoff_date
        ]

        # Group by normalized query
        query_groups = {}
        for query_data in recent_failures:
            normalized = self._normalize_query(query_data["query"])
            if normalized not in query_groups:
                query_groups[normalized] = []
            query_groups[normalized].append(query_data)

        # Create gap alerts for repeated failures
        for normalized_query, occurrences in query_groups.items():
            if len(occurrences) >= 2:  # At least 2 failed attempts
                gaps.append({
                    "type": "knowledge_gap",
                    "severity": "high" if len(occurrences) >= 5 else "medium",
                    "description": f"No documentation found for '{normalized_query}' ({len(occurrences)} queries)",
                    "query_pattern": normalized_query,
                    "occurrence_count": len(occurrences),
                    "suggested_topics": self._extract_topics(normalized_query),
                    "detected_at": datetime.utcnow().isoformat(),
                    "status": "active",
                    "gap_source": "failed_queries"
                })

        return gaps

    def _analyze_low_confidence_queries(self, org_id: str, cutoff_date: datetime) -> list[dict]:
        """Analyze queries with low confidence results."""
        gaps = []

        # Filter recent low confidence queries for this org
        recent_low_confidence = [
            q for q in self.low_confidence_queries
            if q["org_id"] == org_id and q["timestamp"] >= cutoff_date
        ]

        # Group by normalized query
        query_groups = {}
        for query_data in recent_low_confidence:
            normalized = self._normalize_query(query_data["query"])
            if normalized not in query_groups:
                query_groups[normalized] = []
            query_groups[normalized].append(query_data)

        # Create gap alerts for repeated low confidence
        for normalized_query, occurrences in query_groups.items():
            if len(occurrences) >= 3:  # At least 3 low confidence attempts
                avg_confidence = sum(q["confidence"] for q in occurrences) / len(occurrences)

                gaps.append({
                    "type": "knowledge_gap",
                    "severity": "medium",
                    "description": f"Low confidence results for '{normalized_query}' (avg: {avg_confidence:.2f})",
                    "query_pattern": normalized_query,
                    "occurrence_count": len(occurrences),
                    "average_confidence": avg_confidence,
                    "suggested_topics": self._extract_topics(normalized_query),
                    "detected_at": datetime.utcnow().isoformat(),
                    "status": "active",
                    "gap_source": "low_confidence"
                })

        return gaps

    def _analyze_frequent_queries(self, org_id: str) -> list[dict]:
        """Analyze frequently asked queries that might need better documentation."""
        gaps = []

        # Get queries for this org
        org_prefix = f"{org_id}:"
        org_queries = {
            k.replace(org_prefix, ""): v
            for k, v in self.frequent_queries.items()
            if k.startswith(org_prefix) and v >= self.frequent_query_threshold
        }

        # Create alerts for very frequent queries
        for query, count in org_queries.items():
            if count >= self.frequent_query_threshold:
                gaps.append({
                    "type": "knowledge_gap",
                    "severity": "low",
                    "description": f"Frequently asked about '{query}' ({count} times) - may need dedicated documentation",
                    "query_pattern": query,
                    "occurrence_count": count,
                    "suggested_topics": self._extract_topics(query),
                    "detected_at": datetime.utcnow().isoformat(),
                    "status": "active",
                    "gap_source": "frequent_queries"
                })

        return gaps

    def _normalize_query(self, query: str) -> str:
        """
        Normalize query text for grouping.

        Args:
            query: Raw query text

        Returns:
            Normalized query text
        """
        # Convert to lowercase
        normalized = query.lower().strip()

        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)

        # Remove common question words
        question_words = ['what', 'how', 'why', 'when', 'where', 'who', 'which']
        words = normalized.split()
        if words and words[0] in question_words:
            words = words[1:]
        normalized = ' '.join(words)

        # Remove punctuation at the end
        normalized = normalized.rstrip('?!.')

        return normalized

    def _extract_topics(self, query: str) -> list[str]:
        """
        Extract potential topics from query.

        Args:
            query: Query text

        Returns:
            List of topic keywords
        """
        # Simple keyword extraction (can be enhanced with NLP)
        words = query.lower().split()

        # Remove common stop words
        stop_words = {'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
                      'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
                      'that', 'the', 'to', 'was', 'will', 'with'}

        keywords = [w for w in words if w not in stop_words and len(w) > 3]

        return keywords[:5]  # Return top 5 keywords

    def _cluster_gaps(self, gaps: list[dict]) -> list[dict]:
        """
        Group similar gaps together.

        Args:
            gaps: List of gap dictionaries

        Returns:
            Clustered gaps with combined occurrence counts
        """
        if not gaps:
            return gaps

        # Simple clustering by query pattern similarity
        clustered = []
        processed = set()

        for i, gap in enumerate(gaps):
            if i in processed:
                continue

            pattern = gap.get("query_pattern", "")
            cluster = [gap]
            processed.add(i)

            # Find similar patterns
            for j, other_gap in enumerate(gaps[i + 1:], start=i + 1):
                if j in processed:
                    continue

                other_pattern = other_gap.get("query_pattern", "")
                if self._patterns_similar(pattern, other_pattern):
                    cluster.append(other_gap)
                    processed.add(j)

            # Merge cluster if multiple similar gaps
            if len(cluster) > 1:
                merged = self._merge_gaps(cluster)
                clustered.append(merged)
            else:
                clustered.append(gap)

        return clustered

    def _patterns_similar(self, pattern1: str, pattern2: str) -> bool:
        """Check if two query patterns are similar."""
        words1 = set(pattern1.lower().split())
        words2 = set(pattern2.lower().split())

        # Jaccard similarity
        intersection = words1.intersection(words2)
        union = words1.union(words2)

        if not union:
            return False

        similarity = len(intersection) / len(union)
        return similarity >= 0.6  # 60% word overlap

    def _merge_gaps(self, cluster: list[dict]) -> dict:
        """Merge similar gaps into a single alert."""
        total_occurrences = sum(g.get("occurrence_count", 0) for g in cluster)
        patterns = [g.get("query_pattern", "") for g in cluster]

        # Use the most severe severity
        severities = [g.get("severity", "low") for g in cluster]
        severity_order = {"high": 3, "medium": 2, "low": 1}
        max_severity = max(severities, key=lambda s: severity_order.get(s, 0))

        # Combine topics
        all_topics = []
        for gap in cluster:
            all_topics.extend(gap.get("suggested_topics", []))
        unique_topics = list(dict.fromkeys(all_topics))[:10]  # Top 10 unique topics

        return {
            "type": "knowledge_gap",
            "severity": max_severity,
            "description": f"Multiple related queries ({total_occurrences} total): {', '.join(patterns[:3])}...",
            "query_patterns": patterns,
            "occurrence_count": total_occurrences,
            "suggested_topics": unique_topics,
            "detected_at": datetime.utcnow().isoformat(),
            "status": "active",
            "gap_source": "clustered",
            "cluster_size": len(cluster)
        }
