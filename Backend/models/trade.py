"""
models/trade.py — Completed trades table.

One row per closed trade (BUY → SELL cycle).
Written by TradingEngine after every SELL order is placed.
Works for both forward_test and live modes.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime, func
from sqlalchemy import select

from models.database import Base, async_session

log = logging.getLogger(__name__)

# ── Event loop reference — set by main.py at startup ──────────────────────────
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


# ── SQLAlchemy model ──────────────────────────────────────────────────────────

class Trade(Base):
    __tablename__ = "trades"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    symbol           = Column(String,  nullable=False, index=True)
    instrument_token = Column(Integer, nullable=False)
    qty              = Column(Integer, nullable=False)
    entry_price      = Column(Float,   nullable=False)
    exit_price       = Column(Float,   nullable=False)
    pnl_points       = Column(Float,   nullable=False)
    pnl_amount       = Column(Float,   nullable=False)
    result           = Column(String,  nullable=False)   # "PROFIT" | "LOSS"
    exit_reason      = Column(String,  nullable=False)   # "TARGET" | "FIXED_SL" | etc.
    broker_mode      = Column(String,  nullable=False)   # "forward_test" | "live"
    interval         = Column(String,  nullable=False)   # "5minute" | "day" | etc.
    entry_time       = Column(DateTime, nullable=True)
    exit_time        = Column(DateTime, nullable=False)
    created_at       = Column(DateTime, server_default=func.now())


# ── Async save ────────────────────────────────────────────────────────────────

async def _save_trade(data: dict) -> None:
    """Persist one completed trade to DB."""
    async with async_session() as session:
        trade = Trade(
            symbol           = data["symbol"],
            instrument_token = data["instrument_token"],
            qty              = data["qty"],
            entry_price      = data["entry_price"],
            exit_price       = data["exit_price"],
            pnl_points       = data["pnl_points"],
            pnl_amount       = data["pnl_amount"],
            result           = data["result"],
            exit_reason      = data["exit_reason"],
            broker_mode      = data["broker_mode"],
            interval         = data["interval"],
            entry_time       = data.get("entry_time"),
            exit_time        = data.get("exit_time", datetime.now(timezone.utc)),
        )
        session.add(trade)
        await session.commit()
        log.info(
            "Trade saved: %s %s | entry=%.2f exit=%.2f | P&L=%.2f (%s)",
            data["symbol"], data["exit_reason"],
            data["entry_price"], data["exit_price"],
            data["pnl_amount"], data["result"],
        )


def save_trade_sync(data: dict) -> None:
    """
    Thread-safe trade save — call from TradingEngine background thread.
    Schedules the async save on the main event loop.
    """
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(_save_trade(data), _loop)
    else:
        log.warning("Trade not saved — event loop not available")


# ── Query helpers ─────────────────────────────────────────────────────────────

async def get_trade_history(limit: int = 100) -> list[dict]:
    """Fetch last N completed trades ordered by exit_time desc."""
    async with async_session() as session:
        result = await session.execute(
            select(Trade)
            .order_by(Trade.exit_time.desc())
            .limit(limit)
        )
        trades = result.scalars().all()

    return [
        {
            "id":           t.id,
            "symbol":       t.symbol,
            "qty":          t.qty,
            "entry_price":  t.entry_price,
            "exit_price":   t.exit_price,
            "pnl_points":   t.pnl_points,
            "pnl_amount":   t.pnl_amount,
            "result":       t.result,
            "exit_reason":  t.exit_reason,
            "broker_mode":  t.broker_mode,
            "interval":     t.interval,
            "entry_time":   t.entry_time.isoformat() if t.entry_time else None,
            "exit_time":    t.exit_time.isoformat()  if t.exit_time  else None,
        }
        for t in trades
    ]
