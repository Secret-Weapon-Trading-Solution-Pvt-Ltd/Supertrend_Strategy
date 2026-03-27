"""
models/trade_log.py — Trade activity log table.

One row per significant trading event (signal, order, exit, etc.).
Written by TradingEngine for both live and forward_test modes.
Streamed to frontend in real-time via Socket.IO "tradelog" event.
Frontend fetches history via "tradelog:fetch" on connect.

Event types:
  SIGNAL_BUY        — Supertrend flipped green, BUY signal generated
  ORDER_PLACED      — Order sent to broker
  ORDER_FILLED      — Order confirmed filled (with fill price)
  ORDER_REJECTED    — Order rejected or cancelled by broker/exchange
  ORDER_TIMEOUT     — No fill confirmation within timeout window
  EXIT_TRIGGERED    — Position exited (SL / target / ST red / session end)
  FUNDS_INSUFFICIENT — BUY blocked due to insufficient margin
"""

import asyncio
import logging

from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy import select

try:
    from sqlalchemy import JSON
except ImportError:
    from sqlalchemy import Text as JSON  # fallback for older SQLAlchemy

from models.database import Base, async_session
from events.event_bus import sio

log = logging.getLogger(__name__)

# ── Event loop reference — set by main.py at startup ──────────────────────────
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


# ── SQLAlchemy model ──────────────────────────────────────────────────────────

class TradeLog(Base):
    __tablename__ = "trade_logs"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    event_type  = Column(String,  nullable=False, index=True)   # see event types above
    symbol      = Column(String,  nullable=True,  index=True)
    broker_mode = Column(String,  nullable=False)               # "live" | "forward_test"
    details     = Column(JSON,    nullable=True)                # event-specific data
    created_at  = Column(DateTime, server_default=func.now())


# ── Async save ────────────────────────────────────────────────────────────────

async def _save_trade_log(data: dict) -> None:
    """Persist one trade log entry to DB and push to frontend via Socket.IO."""
    async with async_session() as session:
        entry = TradeLog(
            event_type  = data["event_type"],
            symbol      = data.get("symbol"),
            broker_mode = data.get("broker_mode", "forward_test"),
            details     = data.get("details", {}),
        )
        session.add(entry)
        await session.commit()
        await session.refresh(entry)   # load id + created_at assigned by DB

    # Push to all connected frontend clients in real-time
    await sio.emit("tradelog", {
        "id":          entry.id,
        "event_type":  entry.event_type,
        "symbol":      entry.symbol,
        "broker_mode": entry.broker_mode,
        "details":     entry.details or {},
        "created_at":  entry.created_at.isoformat() if entry.created_at else None,
    })


def save_trade_log_sync(data: dict) -> None:
    """
    Thread-safe trade log save — call from TradingEngine background thread.
    Schedules the async save on the main event loop.
    """
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(_save_trade_log(data), _loop)
    else:
        log.warning("TradeLog not saved — event loop not available")


# ── Query helpers ─────────────────────────────────────────────────────────────

async def get_trade_logs(limit: int = 100) -> list[dict]:
    """Fetch last N trade log entries ordered by created_at desc."""
    async with async_session() as session:
        result = await session.execute(
            select(TradeLog)
            .order_by(TradeLog.created_at.desc())
            .limit(limit)
        )
        entries = result.scalars().all()

    return [
        {
            "id":          e.id,
            "event_type":  e.event_type,
            "symbol":      e.symbol,
            "broker_mode": e.broker_mode,
            "details":     e.details or {},
            "created_at":  e.created_at.isoformat() if e.created_at else None,
        }
        for e in reversed(entries)   # oldest first so frontend can append in order
    ]
