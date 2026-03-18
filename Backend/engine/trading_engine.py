"""
engine/trading_engine.py — Core trading engine polling loop.

Responsibilities:
  1. Poll kite.historical_data() every 1 second via broker
  2. Feed candles to strategy/indicators.py (Supertrend + ATR)
  3. Generate signals via strategy/signals.py
  4. Check exit conditions via strategy/exit_manager.py
  5. Place BUY / SELL orders via broker (real or simulated)

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

from broker.base import BrokerABC
from strategy.indicators import calculate_supertrend, calculate_atr
from strategy import signals as sig
from strategy import exit_manager
from config.settings import settings
from events.event_bus import emit_sync
from models.trade import save_trade_sync

log = logging.getLogger(__name__)


class EngineState(Enum):
    IDLE    = "IDLE"
    RUNNING = "RUNNING"
    PAUSED  = "PAUSED"
    STOPPED = "STOPPED"


class TradingEngine:

    def __init__(
        self,
        broker:           BrokerABC,
        instrument_token: int,
        symbol:           str,
        qty:              int = 1,
        interval:         str = None,
        candle_count:     int = 100,
        poll_interval:    float = 1.0,
    ):
        self.broker           = broker
        self.instrument_token = instrument_token
        self.symbol           = symbol
        self.qty              = qty
        self.interval         = interval or settings.timeframe
        self.candle_count     = candle_count
        self.poll_interval    = poll_interval

        self.state            = EngineState.IDLE
        self._thread: threading.Thread | None = None
        self._stop_event      = threading.Event()

        # Latest computed data — readable from outside
        self.latest_df: pd.DataFrame = pd.DataFrame()
        self.last_error: str         = ""
        self.last_signal: str        = "HOLD"
        self.last_exit_reason: str   = ""

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
          1. Fetch latest candles
          2. Run Supertrend + ATR indicators
          3. Generate entry signal
          4. If no position — check for BUY
          5. If in position — update peak, check exits, place SELL if triggered
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

        # Step 2 — indicators
        if settings.use_supertrend:
            df = calculate_supertrend(df)

        if settings.use_atr:
            df = calculate_atr(df)

        self.latest_df = df

        # Extract last row values
        last      = df.iloc[-1]
        ts        = df.index[-1].strftime("%H:%M:%S")
        close     = float(last["close"])
        st_dir    = int(last.get("st_direction", 0))   if "st_direction" in df.columns else 0
        st_val    = round(float(last.get("supertrend", float("nan"))), 2) if "supertrend" in df.columns else float("nan")
        atr_val   = float(last.get("atr", 0.0))        if "atr"          in df.columns else None
        direction = "GREEN" if st_dir == 1 else "RED" if st_dir == -1 else "?"

        log.info(
            "[%s] %s | close=%.2f | ST=%.2f (%s) | ATR=%s",
            ts, self.symbol, close, st_val, direction,
            round(atr_val, 2) if atr_val else "-",
        )

        # Emit tick to frontend
        emit_sync("tick", {
            "timestamp":   ts,
            "symbol":      self.symbol,
            "close":       close,
            "supertrend":  st_val,
            "atr":         round(atr_val, 2) if atr_val else None,
            "direction":   direction,
        })

        # Step 3 — need at least 2 rows for signal
        if len(df) < 2:
            return

        # Step 4 — check for entry (no open position)
        positions = self.broker.get_positions()
        in_position = bool(positions)

        if not in_position:
            signal = sig.get_signal(df)
            self.last_signal = signal

            if signal == "BUY":
                log.info("[ENGINE] BUY signal — placing order for %s qty=%d", self.symbol, self.qty)
                emit_sync("signal:buy", {
                    "symbol": self.symbol,
                    "price":  close,
                    "time":   ts,
                })
                order_id = self.broker.place_order(
                    symbol           = self.symbol,
                    token            = self.instrument_token,
                    qty              = self.qty,
                    transaction_type = "BUY",
                    product          = "MIS",
                    order_type       = "MARKET",
                )
                emit_sync("order:placed", {
                    "type":     "BUY",
                    "symbol":   self.symbol,
                    "qty":      self.qty,
                    "price":    close,
                    "order_id": order_id,
                })

        # Step 5 — manage open position
        else:
            position = positions[0]

            # Update trailing SL peak (ForwardTestBroker has this; real broker tracks via Kite)
            if hasattr(self.broker, "update_peak_price"):
                self.broker.update_peak_price(close)

            # Emit live position update to frontend
            emit_sync("position:update", {
                "symbol":          position.get("symbol", self.symbol),
                "entry_price":     position.get("entry_price", 0),
                "current_price":   close,
                "peak_price":      position.get("peak_price", 0),
                "unrealized_pnl":  round((close - position.get("entry_price", close)) * position.get("qty", self.qty), 2),
            })

            # Sync peak_price for exit_manager (real broker positions won't have this key)
            if "peak_price" not in position:
                position["peak_price"] = position.get("entry_price", close)

            exit_reason = exit_manager.check(
                position      = position,
                current_price = close,
                st_direction  = st_dir,
                atr_value     = atr_val,
            )

            if exit_reason != exit_manager.HOLD:
                summary = exit_manager.exit_summary(exit_reason, position, close)
                log.info(
                    "[ENGINE] EXIT — reason=%s | entry=%.2f | exit=%.2f | P&L=%.2f (%s)",
                    exit_reason,
                    summary["entry_price"],
                    summary["exit_price"],
                    summary["pnl_points"],
                    summary["result"],
                )
                self.last_exit_reason = exit_reason
                emit_sync("exit:triggered", {
                    "reason":      exit_reason,
                    "entry_price": summary["entry_price"],
                    "exit_price":  summary["exit_price"],
                    "pnl_points":  summary["pnl_points"],
                    "pnl_amount":  summary["pnl_amount"],
                    "result":      summary["result"],
                })

                order_id = self.broker.place_order(
                    symbol           = self.symbol,
                    token            = self.instrument_token,
                    qty              = position.get("qty", self.qty),
                    transaction_type = "SELL",
                    product          = "MIS",
                    order_type       = "MARKET",
                )
                emit_sync("order:placed", {
                    "type":     "SELL",
                    "symbol":   self.symbol,
                    "qty":      position.get("qty", self.qty),
                    "price":    close,
                    "order_id": order_id,
                })

                # Persist completed trade to DB
                save_trade_sync({
                    "symbol":           self.symbol,
                    "instrument_token": self.instrument_token,
                    "qty":              position.get("qty", self.qty),
                    "entry_price":      summary["entry_price"],
                    "exit_price":       summary["exit_price"],
                    "pnl_points":       summary["pnl_points"],
                    "pnl_amount":       summary["pnl_amount"],
                    "result":           summary["result"],
                    "exit_reason":      exit_reason,
                    "broker_mode":      settings.broker_mode,
                    "interval":         self.interval,
                    "entry_time":       position.get("entry_time"),
                    "exit_time":        None,   # defaults to now() in save_trade
                })

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

        result["last_signal"]      = self.last_signal
        result["last_exit_reason"] = self.last_exit_reason

        positions = self.broker.get_positions()
        if positions:
            p = positions[0]
            result["position"] = {
                "symbol":      p.get("symbol", self.symbol),
                "qty":         p.get("qty", 0),
                "entry_price": p.get("entry_price", 0),
                "peak_price":  p.get("peak_price", 0),
            }
        else:
            result["position"] = None

        if self.last_error:
            result["last_error"] = self.last_error

        return result
