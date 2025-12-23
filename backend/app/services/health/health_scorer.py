"""Calculate organization knowledge health score."""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class HealthScorer:
    """Calculates comprehensive health score for organization knowledge base."""

    def __init__(self):
        # Scoring weights (must sum to 1.0)
        self.weights = {
            "completeness": 0.25,      # Coverage of expected topics
            "freshness": 0.25,         # How up-to-date documents are
            "consistency": 0.20,       # Absence of conflicts
            "usage": 0.15,             # Query success rate
            "coverage": 0.15           # Gap analysis
        }

    async def calculate_health_score(
        self,
        org_id: str,
        conflicts: list[dict],
        outdated_docs: list[dict],
        gaps: list[dict],
        total_docs: int,
        total_queries: int,
        successful_queries: int,
        avg_doc_age_days: float
    ) -> dict:
        """
        Calculate comprehensive health score.

        Args:
            org_id: Organization ID
            conflicts: List of conflict alerts
            outdated_docs: List of outdated document alerts
            gaps: List of knowledge gap alerts
            total_docs: Total number of documents
            total_queries: Total number of queries
            successful_queries: Number of successful queries
            avg_doc_age_days: Average document age in days

        Returns:
            Dict with overall score and component scores
        """
        logger.info(f"Calculating health score for org {org_id}")

        try:
            # Calculate component scores (0-100)
            completeness_score = self._calculate_completeness_score(total_docs)
            freshness_score = self._calculate_freshness_score(outdated_docs, total_docs, avg_doc_age_days)
            consistency_score = self._calculate_consistency_score(conflicts, total_docs)
            usage_score = self._calculate_usage_score(total_queries, successful_queries)
            coverage_score = self._calculate_coverage_score(gaps, total_queries)

            # Calculate weighted overall score
            overall_score = (
                completeness_score * self.weights["completeness"] +
                freshness_score * self.weights["freshness"] +
                consistency_score * self.weights["consistency"] +
                usage_score * self.weights["usage"] +
                coverage_score * self.weights["coverage"]
            )

            # Determine health status
            health_status = self._get_health_status(overall_score)

            # Generate recommendations
            recommendations = self._generate_recommendations(
                completeness_score,
                freshness_score,
                consistency_score,
                usage_score,
                coverage_score
            )

            result = {
                "org_id": org_id,
                "overall_score": round(overall_score, 1),
                "health_status": health_status,
                "component_scores": {
                    "completeness": round(completeness_score, 1),
                    "freshness": round(freshness_score, 1),
                    "consistency": round(consistency_score, 1),
                    "usage": round(usage_score, 1),
                    "coverage": round(coverage_score, 1)
                },
                "metrics": {
                    "total_documents": total_docs,
                    "total_queries": total_queries,
                    "successful_queries": successful_queries,
                    "active_conflicts": len(conflicts),
                    "outdated_documents": len(outdated_docs),
                    "knowledge_gaps": len(gaps),
                    "avg_doc_age_days": round(avg_doc_age_days, 1)
                },
                "recommendations": recommendations,
                "calculated_at": datetime.utcnow().isoformat()
            }

            logger.info(f"Health score for org {org_id}: {overall_score:.1f} ({health_status})")
            return result

        except Exception as e:
            logger.error(f"Error calculating health score for org {org_id}: {e}", exc_info=True)
            return self._get_error_response(org_id)

    def _calculate_completeness_score(self, total_docs: int) -> float:
        """
        Calculate completeness score based on document count.

        Args:
            total_docs: Total number of documents

        Returns:
            Score from 0-100
        """
        # Score based on document count (adjust thresholds as needed)
        if total_docs >= 100:
            return 100.0
        elif total_docs >= 50:
            return 90.0
        elif total_docs >= 25:
            return 75.0
        elif total_docs >= 10:
            return 60.0
        elif total_docs >= 5:
            return 40.0
        elif total_docs >= 1:
            return 20.0
        else:
            return 0.0

    def _calculate_freshness_score(
        self,
        outdated_docs: list[dict],
        total_docs: int,
        avg_doc_age_days: float
    ) -> float:
        """
        Calculate freshness score based on document age and staleness.

        Args:
            outdated_docs: List of outdated document alerts
            total_docs: Total number of documents
            avg_doc_age_days: Average document age in days

        Returns:
            Score from 0-100
        """
        if total_docs == 0:
            return 100.0  # No docs = no staleness problem

        # Factor 1: Percentage of outdated docs
        outdated_ratio = len(outdated_docs) / total_docs
        freshness_by_ratio = max(0, 100 - (outdated_ratio * 100))

        # Factor 2: Average document age
        # Ideal: < 90 days, Acceptable: 90-180 days, Poor: > 180 days
        if avg_doc_age_days <= 90:
            freshness_by_age = 100.0
        elif avg_doc_age_days <= 180:
            freshness_by_age = 100 - ((avg_doc_age_days - 90) / 90 * 30)  # Linear decline
        else:
            freshness_by_age = max(0, 70 - ((avg_doc_age_days - 180) / 180 * 70))

        # Combined score (weighted average)
        return (freshness_by_ratio * 0.6) + (freshness_by_age * 0.4)

    def _calculate_consistency_score(self, conflicts: list[dict], total_docs: int) -> float:
        """
        Calculate consistency score based on conflicts.

        Args:
            conflicts: List of conflict alerts
            total_docs: Total number of documents

        Returns:
            Score from 0-100
        """
        if total_docs == 0:
            return 100.0  # No docs = no conflicts

        # Weight conflicts by severity
        severity_weights = {"high": 3, "medium": 2, "low": 1}
        weighted_conflicts = sum(
            severity_weights.get(c.get("severity", "low"), 1)
            for c in conflicts
        )

        # Calculate conflict ratio
        conflict_ratio = weighted_conflicts / total_docs

        # Score decreases with conflicts (exponential penalty)
        if conflict_ratio == 0:
            return 100.0
        elif conflict_ratio < 0.05:  # Less than 5%
            return 95.0
        elif conflict_ratio < 0.10:  # Less than 10%
            return 85.0
        elif conflict_ratio < 0.20:  # Less than 20%
            return 70.0
        else:
            return max(0, 70 - (conflict_ratio * 100))

    def _calculate_usage_score(self, total_queries: int, successful_queries: int) -> float:
        """
        Calculate usage score based on query success rate.

        Args:
            total_queries: Total number of queries
            successful_queries: Number of successful queries

        Returns:
            Score from 0-100
        """
        if total_queries == 0:
            return 50.0  # Neutral score if no usage data

        success_rate = successful_queries / total_queries

        # Linear scoring based on success rate
        return success_rate * 100

    def _calculate_coverage_score(self, gaps: list[dict], total_queries: int) -> float:
        """
        Calculate coverage score based on knowledge gaps.

        Args:
            gaps: List of knowledge gap alerts
            total_queries: Total number of queries

        Returns:
            Score from 0-100
        """
        if total_queries == 0:
            return 100.0  # No queries = no detected gaps

        # Weight gaps by severity
        severity_weights = {"high": 3, "medium": 2, "low": 1}
        weighted_gaps = sum(
            severity_weights.get(g.get("severity", "low"), 1)
            for g in gaps
        )

        # Calculate gap ratio
        gap_ratio = weighted_gaps / max(total_queries, 1)

        # Score decreases with gaps
        if gap_ratio == 0:
            return 100.0
        elif gap_ratio < 0.10:
            return 90.0
        elif gap_ratio < 0.20:
            return 75.0
        elif gap_ratio < 0.30:
            return 60.0
        else:
            return max(0, 60 - (gap_ratio * 100))

    def _get_health_status(self, score: float) -> str:
        """
        Determine health status from score.

        Args:
            score: Overall health score (0-100)

        Returns:
            Status: excellent, good, fair, poor, critical
        """
        if score >= 90:
            return "excellent"
        elif score >= 75:
            return "good"
        elif score >= 60:
            return "fair"
        elif score >= 40:
            return "poor"
        else:
            return "critical"

    def _generate_recommendations(
        self,
        completeness: float,
        freshness: float,
        consistency: float,
        usage: float,
        coverage: float
    ) -> list[str]:
        """
        Generate actionable recommendations based on scores.

        Args:
            completeness: Completeness score
            freshness: Freshness score
            consistency: Consistency score
            usage: Usage score
            coverage: Coverage score

        Returns:
            List of recommendation strings
        """
        recommendations = []

        # Completeness recommendations
        if completeness < 60:
            recommendations.append("📚 Add more documents to improve knowledge base coverage")

        # Freshness recommendations
        if freshness < 70:
            recommendations.append("🔄 Review and update outdated documents")
            recommendations.append("📅 Implement a regular document review schedule")

        # Consistency recommendations
        if consistency < 70:
            recommendations.append("⚠️ Resolve conflicting information across documents")
            recommendations.append("✅ Establish a content approval process")

        # Usage recommendations
        if usage < 70:
            recommendations.append("🔍 Improve search relevance and document quality")
            recommendations.append("📊 Analyze failed queries to identify issues")

        # Coverage recommendations
        if coverage < 70:
            recommendations.append("📝 Create documentation for frequently asked topics")
            recommendations.append("🎯 Address identified knowledge gaps")

        # If all scores are good
        if not recommendations:
            recommendations.append("✨ Knowledge base is healthy - maintain current practices")

        return recommendations

    def _get_error_response(self, org_id: str) -> dict:
        """Return error response when calculation fails."""
        return {
            "org_id": org_id,
            "overall_score": 0.0,
            "health_status": "unknown",
            "component_scores": {
                "completeness": 0.0,
                "freshness": 0.0,
                "consistency": 0.0,
                "usage": 0.0,
                "coverage": 0.0
            },
            "metrics": {},
            "recommendations": ["❌ Error calculating health score - please try again"],
            "calculated_at": datetime.utcnow().isoformat()
        }
