"""
models/database.py — Async SQLAlchemy engine, session factory, Base class.
All models import Base from here. All routes use get_db() as a dependency.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from config.settings import settings


engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables on startup and seed static data if not present."""
    from models import account, trade, position, instrument, timeframe, trade_log   # noqa: F401 — register models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_timeframes()


async def _seed_timeframes():
    """Insert the 8 Zerodha Kite candle intervals if the table is empty."""
    from models.timeframe import Timeframe
    from sqlalchemy import select

    TIMEFRAMES = [
        {"interval": "minute",   "label": "1 Minute",   "minutes": 1},
        {"interval": "3minute",  "label": "3 Minutes",  "minutes": 3},
        {"interval": "5minute",  "label": "5 Minutes",  "minutes": 5},
        {"interval": "10minute", "label": "10 Minutes", "minutes": 10},
        {"interval": "15minute", "label": "15 Minutes", "minutes": 15},
        {"interval": "30minute", "label": "30 Minutes", "minutes": 30},
        {"interval": "60minute", "label": "1 Hour",     "minutes": 60},
        {"interval": "day",      "label": "1 Day",      "minutes": 1440},
    ]

    async with async_session() as session:
        result = await session.execute(select(Timeframe))
        existing = result.scalars().all()
        if existing:
            return   # already seeded

        for tf in TIMEFRAMES:
            session.add(Timeframe(**tf))
        await session.commit()


async def get_db():
    """FastAPI dependency — yields a DB session per request, closes after."""
    async with async_session() as session:
        yield session
