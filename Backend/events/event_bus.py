"""
events/event_bus.py — Shared Socket.IO server instance.

Imported by:
  - main.py             : mounts ASGI app + registers socket event handlers
  - trading_engine.py   : emits tick / signal / order / exit events
  - log_handler.py      : emits log events

Two emit helpers:
  - emit()       async — use inside async context (FastAPI handlers, socket events)
  - emit_sync()  sync  — use from background threads (TradingEngine polling loop)
"""

import asyncio
import socketio

# ── Shared Socket.IO server ────────────────────────────────────────────────────

sio = socketio.AsyncServer(
    async_mode     = "asgi",
    cors_allowed_origins = "*",   # tighten to frontend origin in production
)

# ── Event loop reference (set once at startup) ────────────────────────────────
# Needed so background threads can schedule async emits safely.

_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Call once at startup with the running event loop."""
    global _loop
    _loop = loop


# ── Emit helpers ──────────────────────────────────────────────────────────────

async def emit(event: str, data: dict) -> None:
    """Broadcast to all connected clients — call from async context."""
    await sio.emit(event, data)


def emit_sync(event: str, data: dict) -> None:
    """
    Broadcast from a synchronous background thread.
    Schedules the async emit on the main event loop.
    """
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(sio.emit(event, data), _loop)
