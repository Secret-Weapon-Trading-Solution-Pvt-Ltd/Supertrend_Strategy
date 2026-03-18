"""
events/log_handler.py — Streams all Python logs to the frontend via Socket.IO.

How it works:
  - Adds a custom logging.Handler to the root logger at startup
  - Every log.info / log.warning / log.error anywhere in the codebase
    automatically gets pushed to the frontend as a "log" Socket.IO event
  - No changes needed in any other module

Frontend receives:
  {
    "level":     "INFO" | "WARNING" | "ERROR" | "DEBUG",
    "logger":    "engine.trading_engine",
    "message":   "[ENGINE] BUY signal — placing order ...",
    "timestamp": "2026-03-18 09:32:15"
  }
"""

import logging
from datetime import datetime, timezone

from events.event_bus import emit_sync


class SocketIOLogHandler(logging.Handler):
    """Intercepts all log records and emits them to connected frontend clients."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            data = {
                "level":     record.levelname,
                "logger":    record.name,
                "message":   self.format(record),
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            }
            emit_sync("log", data)
        except Exception:
            self.handleError(record)


def install(level: int = logging.INFO) -> None:
    """
    Add SocketIOLogHandler to the root logger.
    Call once at startup (after event loop is running).
    """
    handler = SocketIOLogHandler()
    handler.setLevel(level)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s")
    )
    logging.getLogger().addHandler(handler)
