"""
Database connection and session management
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.config import settings

# Create async engine with SQLite-compatible settings
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}

# Only add pool settings for non-SQLite databases
if not settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

# Create session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base class for models
Base = declarative_base()


async def init_db():
    """Initialize database connection"""
    try:
        async with engine.begin() as conn:
            # Import all models to ensure they're registered

            # Create tables - use checkfirst=True to handle race conditions
            # with multiple workers trying to create tables simultaneously
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True)
            )
    except Exception as e:
        # Log but don't fail - another worker may have created the tables
        import logging
        logging.warning(f"Database init warning (may be normal with multiple workers): {e}")


async def close_db():
    """Close database connection"""
    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session

    Usage:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
