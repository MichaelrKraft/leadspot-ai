"""
Query analytics and logging service
"""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Query as QueryModel


class AnalyticsService:
    """Tracks and analyzes query usage patterns"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_query(
        self,
        user_id: UUID,
        organization_id: UUID,
        query_text: str,
        response_time_ms: int,
        sources_cited: int,
        total_sources_found: int,
        tokens_used: int | None = None,
        cache_hit: bool = False
    ) -> QueryModel:
        """
        Log a query to the database

        Args:
            user_id: User who made the query
            organization_id: Organization ID
            query_text: The query text
            response_time_ms: Response time in milliseconds
            sources_cited: Number of sources cited in answer
            total_sources_found: Total sources retrieved
            tokens_used: Total tokens used (optional)
            cache_hit: Whether result was from cache

        Returns:
            QueryModel object
        """
        query_record = QueryModel(
            user_id=user_id,
            organization_id=organization_id,
            query_text=query_text,
            response_time_ms=response_time_ms,
            sources_cited=sources_cited,
            total_sources_found=total_sources_found,
            tokens_used=tokens_used,
            cache_hit=cache_hit
        )

        self.db.add(query_record)
        await self.db.commit()
        await self.db.refresh(query_record)

        return query_record

    async def get_user_query_history(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> list[QueryModel]:
        """
        Get query history for a user

        Args:
            user_id: User ID
            limit: Maximum queries to return
            offset: Number of queries to skip

        Returns:
            List of QueryModel objects
        """
        result = await self.db.execute(
            select(QueryModel)
            .where(QueryModel.user_id == user_id)
            .order_by(QueryModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return result.scalars().all()

    async def get_organization_query_history(
        self,
        organization_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> list[QueryModel]:
        """
        Get query history for an organization

        Args:
            organization_id: Organization ID
            limit: Maximum queries to return
            offset: Number of queries to skip

        Returns:
            List of QueryModel objects
        """
        result = await self.db.execute(
            select(QueryModel)
            .where(QueryModel.organization_id == organization_id)
            .order_by(QueryModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return result.scalars().all()

    async def get_query_statistics(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> dict[str, any]:
        """
        Get query statistics for an organization

        Args:
            organization_id: Organization ID
            days: Number of days to analyze

        Returns:
            Dictionary with statistics
        """
        since_date = datetime.utcnow() - timedelta(days=days)

        # Total queries
        total_result = await self.db.execute(
            select(func.count(QueryModel.query_id))
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        total_queries = total_result.scalar()

        # Average response time
        avg_time_result = await self.db.execute(
            select(func.avg(QueryModel.response_time_ms))
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        avg_response_time = avg_time_result.scalar() or 0

        # Average sources cited
        avg_sources_result = await self.db.execute(
            select(func.avg(QueryModel.sources_cited))
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        avg_sources_cited = avg_sources_result.scalar() or 0

        # Total tokens used (if tracked)
        tokens_result = await self.db.execute(
            select(func.sum(QueryModel.tokens_used))
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        total_tokens = tokens_result.scalar() or 0

        # Cache hit rate
        cache_hits_result = await self.db.execute(
            select(func.count(QueryModel.query_id))
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date,
                    QueryModel.cache_hit == True
                )
            )
        )
        cache_hits = cache_hits_result.scalar() or 0

        cache_hit_rate = (cache_hits / total_queries * 100) if total_queries > 0 else 0

        # Unique users
        unique_users_result = await self.db.execute(
            select(func.count(func.distinct(QueryModel.user_id)))
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        unique_users = unique_users_result.scalar() or 0

        return {
            "period_days": days,
            "total_queries": total_queries,
            "unique_users": unique_users,
            "avg_response_time_ms": round(avg_response_time, 2),
            "avg_sources_cited": round(avg_sources_cited, 2),
            "total_tokens_used": total_tokens,
            "cache_hit_rate_percent": round(cache_hit_rate, 2),
            "queries_per_day": round(total_queries / days, 2) if days > 0 else 0
        }

    async def get_popular_queries(
        self,
        organization_id: UUID,
        limit: int = 10,
        days: int = 30
    ) -> list[dict[str, any]]:
        """
        Get most common query patterns

        Args:
            organization_id: Organization ID
            limit: Number of queries to return
            days: Number of days to analyze

        Returns:
            List of popular query patterns
        """
        since_date = datetime.utcnow() - timedelta(days=days)

        # Group similar queries and count occurrences
        result = await self.db.execute(
            select(
                QueryModel.query_text,
                func.count(QueryModel.query_id).label('count'),
                func.avg(QueryModel.response_time_ms).label('avg_time')
            )
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
            .group_by(QueryModel.query_text)
            .order_by(func.count(QueryModel.query_id).desc())
            .limit(limit)
        )

        rows = result.all()

        return [
            {
                "query_text": row.query_text,
                "times_asked": row.count,
                "avg_response_time_ms": round(row.avg_time, 2)
            }
            for row in rows
        ]

    async def get_user_statistics(
        self,
        user_id: UUID,
        days: int = 30
    ) -> dict[str, any]:
        """
        Get statistics for a specific user

        Args:
            user_id: User ID
            days: Number of days to analyze

        Returns:
            Dictionary with user statistics
        """
        since_date = datetime.utcnow() - timedelta(days=days)

        # Total queries by this user
        total_result = await self.db.execute(
            select(func.count(QueryModel.query_id))
            .where(
                and_(
                    QueryModel.user_id == user_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        total_queries = total_result.scalar()

        # Average response time for this user
        avg_time_result = await self.db.execute(
            select(func.avg(QueryModel.response_time_ms))
            .where(
                and_(
                    QueryModel.user_id == user_id,
                    QueryModel.created_at >= since_date
                )
            )
        )
        avg_response_time = avg_time_result.scalar() or 0

        return {
            "period_days": days,
            "total_queries": total_queries,
            "avg_response_time_ms": round(avg_response_time, 2),
            "queries_per_day": round(total_queries / days, 2) if days > 0 else 0
        }

    async def get_performance_trends(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> list[dict[str, any]]:
        """
        Get daily performance trends

        Args:
            organization_id: Organization ID
            days: Number of days to analyze

        Returns:
            List of daily statistics
        """
        since_date = datetime.utcnow() - timedelta(days=days)

        # Group by date
        result = await self.db.execute(
            select(
                func.date(QueryModel.created_at).label('date'),
                func.count(QueryModel.query_id).label('query_count'),
                func.avg(QueryModel.response_time_ms).label('avg_time'),
                func.avg(QueryModel.sources_cited).label('avg_sources')
            )
            .where(
                and_(
                    QueryModel.organization_id == organization_id,
                    QueryModel.created_at >= since_date
                )
            )
            .group_by(func.date(QueryModel.created_at))
            .order_by(func.date(QueryModel.created_at))
        )

        rows = result.all()

        return [
            {
                "date": str(row.date),
                "query_count": row.query_count,
                "avg_response_time_ms": round(row.avg_time, 2),
                "avg_sources_cited": round(row.avg_sources, 2)
            }
            for row in rows
        ]


def get_analytics_service(db: AsyncSession) -> AnalyticsService:
    """
    Get AnalyticsService instance

    Args:
        db: Database session

    Returns:
        AnalyticsService instance
    """
    return AnalyticsService(db)
