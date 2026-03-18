"""
engine/trading_engine.py — Core trading engine polling loop.

Responsibilities (current scope):
  1. Poll kite.historical_data() every 1 second via ZerodhaBroker
  2. Feed candles to strategy/indicators.py (Supertrend + ATR)
  3. Log indicator values each poll

State machine:
  IDLE → RUNNING → PAUSED → STOPPED

Usage:
    engine = TradingEngine(broker, instrument_token, interval)
    engine.start()
    engine.stop()
"""

import logging
import time
import threading
from enum import Enum

import pandas as pd

from broker.zerodha import ZerodhaBroker
from strategy.indicators import calculate_supertrend, calculate_atr
from config.settings import settings

log = logging.getLogger(__name__)


class EngineState(Enum):
    IDLE    = "IDLE"
    RUNNING = "RUNNING"
    PAUSED  = "PAUSED"
    STOPPED = "STOPPED"


class TradingEngine:

    def __init__(
        self,
        broker:           ZerodhaBroker,
        instrument_token: int,
        symbol:           str,
        interval:         str = None,
        candle_count:     int = 100,
        poll_interval:    float = 1.0,
    ):
        self.broker           = broker
        self.instrument_token = instrument_token
        self.symbol           = symbol
        self.interval         = interval or settings.timeframe
        self.candle_count     = candle_count
        self.poll_interval    = poll_interval

        self.state            = EngineState.IDLE
        self._thread: threading.Thread | None = None
        self._stop_event      = threading.Event()

        # Latest computed data — readable from outside
        self.latest_df: pd.DataFrame = pd.DataFrame()
        self.last_error: str         = ""

    # ── State machine ─────────────────────────────────────────────────────────

    def start(self) -> None:
        if self.state == EngineState.RUNNING:
            log.warning("Engine already running")
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        self.state = EngineState.RUNNING
        log.info("Engine RUNNING — %s %s every %.1fs", self.symbol, self.interval, self.poll_interval)

    def pause(self) -> None:
        if self.state == EngineState.RUNNING:
            self.state = EngineState.PAUSED
            log.info("Engine PAUSED")

    def resume(self) -> None:
        if self.state == EngineState.PAUSED:
            self.state = EngineState.RUNNING
            log.info("Engine RESUMED")

    def stop(self) -> None:
        self._stop_event.set()
        self.state = EngineState.STOPPED
        log.info("Engine STOPPED")

    # ── Polling loop ─────────────────────────────────────────────────────────

    def _loop(self) -> None:
        """Main polling loop — runs in background thread."""
        log.info("Poll loop started for %s [%s]", self.symbol, self.interval)

        while not self._stop_event.is_set():

            if self.state == EngineState.PAUSED:
                time.sleep(self.poll_interval)
                continue

            try:
                self._tick()
            except Exception as exc:
                self.last_error = str(exc)
                log.error("Engine tick error: %s", exc)

            time.sleep(self.poll_interval)

        log.info("Poll loop exited for %s", self.symbol)

    def _tick(self) -> None:
        """
        One poll cycle:
          1. Fetch latest candles from Zerodha
          2. Run Supertrend (if enabled)
          3. Run ATR (if enabled)
          4. Store result in self.latest_df
        """
        # Step 1 — fetch candles
        df = self.broker.get_candles(
            instrument_token = self.instrument_token,
            interval         = self.interval,
            candle_count     = self.candle_count,
        )

        if df.empty:
            log.warning("Empty candle data for %s", self.symbol)
            return

        # Step 2 — Supertrend
        if settings.use_supertrend:
            df = calculate_supertrend(df)

        # Step 3 — ATR
        if settings.use_atr:
            df = calculate_atr(df)

        # Store latest
        self.latest_df = df

        # Log last row
        last = df.iloc[-1]
        ts   = df.index[-1].strftime("%H:%M:%S")

        st_val  = round(last.get("supertrend",   float("nan")), 2) if "supertrend"   in df.columns else "-"
        st_dir  = int(last.get("st_direction", 0))                  if "st_direction" in df.columns else "-"
        atr_val = round(last.get("atr",          float("nan")), 2) if "atr"          in df.columns else "-"

        direction = "GREEN" if st_dir == 1 else "RED" if st_dir == -1 else "?"

        log.info(
            "[%s] %s | close=%.2f | ST=%.2f (%s) | ATR=%s",
            ts, self.symbol, last["close"], st_val, direction, atr_val,
        )

    # ── Status ────────────────────────────────────────────────────────────────

    def status(self) -> dict:
        """Return current engine state and latest indicator values."""
        result = {
            "state":    self.state.value,
            "symbol":   self.symbol,
            "interval": self.interval,
        }

        if not self.latest_df.empty:
            last = self.latest_df.iloc[-1]
            result.update({
                "timestamp":   self.latest_df.index[-1].strftime("%Y-%m-%d %H:%M:%S"),
                "close":       round(last["close"], 2),
                "supertrend":  round(last.get("supertrend",   float("nan")), 2) if "supertrend"   in self.latest_df.columns else None,
                "st_direction": int(last.get("st_direction", 0))                if "st_direction" in self.latest_df.columns else None,
                "atr":         round(last.get("atr",          float("nan")), 2) if "atr"          in self.latest_df.columns else None,
            })

        if self.last_error:
            result["last_error"] = self.last_error

        return result
