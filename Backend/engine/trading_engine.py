"""
engine/trading_engine.py — Core trading engine with NumPy ring buffer.

Design:
  Startup  : fetch 100 candles ONCE → fill NumPy buffer → compute indicators (warmup)
  Runtime  : poll every CHECK_INTERVAL seconds → fetch 3 latest candles
             → if new candle detected → roll buffer → recalculate → signal check
             → no new candle → emit tick with last known data, skip signal check

Benefits over old approach:
  - API calls   : 100 candles once, then 3 candles per check (not 100 every second)
  - Memory      : fixed-size NumPy arrays, in-place roll (no new objects per tick)
  - Signal logic: only runs on confirmed new candle close (no false flips)
"""

import logging
import time
import threading
from enum import Enum

import numpy as np
import pandas as pd

import zeroda
from broker.base import BrokerABC
from strategy.indicators import calculate_supertrend, calculate_atr
from strategy import signals as sig
from strategy import exit_manager
from config.settings import settings
from events.event_bus import emit_sync
from models.trade import save_trade_sync

log = logging.getLogger(__name__)

# Seconds per candle interval
_CANDLE_SECONDS = {
    "minute":   60,
    "3minute":  180,
    "5minute":  300,
    "10minute": 600,
    "15minute": 900,
    "30minute": 1800,
    "60minute": 3600,
    "day":      86400,
}

# How often to check Zerodha for a new candle (seconds)
_CHECK_INTERVAL = 1


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
        exchange:         str = "NSE",
    ):
        self.broker           = broker
        self.instrument_token = instrument_token
        self.symbol           = symbol
        self.qty              = qty
        self.interval         = interval or settings.timeframe
        self.exchange         = exchange
        self.candle_count     = candle_count

        self.state            = EngineState.IDLE
        self._thread: threading.Thread | None = None
        self._stop_event      = threading.Event()

        # ── NumPy ring buffer (fixed size, pre-allocated) ──────────────────
        self._opens      = np.zeros(candle_count, dtype=np.float64)
        self._highs      = np.zeros(candle_count, dtype=np.float64)
        self._lows       = np.zeros(candle_count, dtype=np.float64)
        self._closes     = np.zeros(candle_count, dtype=np.float64)
        self._volumes    = np.zeros(candle_count, dtype=np.float64)
        self._timestamps = np.empty(candle_count, dtype="datetime64[s]")

        self._buffer_ready   = False
        self._last_candle_ts = None   # timestamp of last processed candle

        # Latest computed state — readable from status()
        self.latest_df:        pd.DataFrame = pd.DataFrame()
        self.last_error:       str          = ""
        self.last_signal:      str          = "HOLD"
        self.last_exit_reason: str          = ""

    # ── State machine ──────────────────────────────────────────────────────────

    def start(self) -> None:
        if self.state == EngineState.RUNNING:
            log.warning("Engine already running")
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        self.state = EngineState.RUNNING
        log.info("Engine RUNNING — %s %s", self.symbol, self.interval)

    def pause(self) -> None:
        if self.state == EngineState.RUNNING:
            self.state = EngineState.PAUSED
            log.info("Engine PAUSED")

    def resume(self) -> None:
        if self.state == EngineState.PAUSED:
            self.state = EngineState.RUNNING
            log.info("Engine RESUMED")

    def stop(self) -> None:
        """Exit all open positions and block new entries. Data + indicators keep running."""
        self._exit_all_positions(reason="ENGINE_STOP")
        self.state = EngineState.STOPPED
        log.info("Engine STOPPED — positions exited, data loop still running")

    def shutdown(self) -> None:
        """Fully kill the loop — called only on app shutdown."""
        self._exit_all_positions(reason="ENGINE_STOP")
        self._stop_event.set()
        self.state = EngineState.STOPPED
        log.info("Engine SHUTDOWN — loop killed")

    # ── Main loop ──────────────────────────────────────────────────────────────

    def _loop(self) -> None:
        log.info("Poll loop started for %s [%s]", self.symbol, self.interval)

        # Warmup once — fetch full history, fill buffer, compute indicators
        self._warmup()

        # Poll every CHECK_INTERVAL seconds for new candle
        while not self._stop_event.is_set():
            try:
                self._tick()
            except Exception as exc:
                self.last_error = str(exc)
                log.error("Engine tick error: %s", exc)
            time.sleep(_CHECK_INTERVAL)

        log.info("Poll loop exited for %s", self.symbol)

    # ── Warmup — fetch full history once ──────────────────────────────────────

    def _warmup(self) -> None:
        """
        Fetch candle_count candles once at startup.
        Fill NumPy buffer → compute indicators → ready for polling.
        """
        log.info("[WARMUP] Fetching %d candles for %s [%s]...", self.candle_count, self.symbol, self.interval)

        df = self.broker.get_candles(
            instrument_token = self.instrument_token,
            interval         = self.interval,
            candle_count     = self.candle_count,
        )

        if df.empty:
            log.error("[WARMUP] No candle data — engine cannot start")
            self.stop()
            return

        # Fill buffer from DataFrame
        self._fill_buffer(df)

        # Build DataFrame from buffer + compute indicators
        df = self._to_dataframe()
        if settings.use_supertrend:
            df = calculate_supertrend(df)
        if settings.use_atr:
            df = calculate_atr(df)

        self.latest_df       = df
        self._last_candle_ts = self._timestamps[-1]
        self._buffer_ready   = True

        last      = df.iloc[-1]
        close     = float(last["close"])
        st_val    = round(float(last.get("supertrend", float("nan"))), 2) if "supertrend" in df.columns else float("nan")
        atr_val   = round(float(last.get("atr", 0.0)), 2) if "atr" in df.columns else None
        direction = "GREEN" if int(last.get("st_direction", 0)) == 1 else "RED"

        log.info(
            "[WARMUP] Done — %d candles | close=%.2f | ST=%.2f (%s) | ATR=%s",
            len(df), close, st_val, direction, atr_val,
        )

    # ── Tick — check for new candle, act only on close ────────────────────────

    def _tick(self) -> None:
        """
        Fetch 3 latest candles (cheap).
        If new candle closed → roll NumPy buffer → recalculate indicators → check signal/exit.
        Always emit tick event with latest known data.
        """
        if not self._buffer_ready:
            return

        # Fetch only 3 candles — lightweight API call
        recent = self.broker.get_candles(
            instrument_token = self.instrument_token,
            interval         = self.interval,
            candle_count     = 3,
        )

        if recent.empty:
            return

        latest_ts  = recent.index[-1].to_datetime64().astype("datetime64[s]")
        latest_row = recent.iloc[-1]
        new_candle = (latest_ts != self._last_candle_ts)

        if new_candle:
            # Roll buffer left by 1 → insert new candle at end
            self._opens[:-1]      = self._opens[1:];      self._opens[-1]      = float(latest_row["open"])
            self._highs[:-1]      = self._highs[1:];      self._highs[-1]      = float(latest_row["high"])
            self._lows[:-1]       = self._lows[1:];       self._lows[-1]       = float(latest_row["low"])
            self._closes[:-1]     = self._closes[1:];     self._closes[-1]     = float(latest_row["close"])
            self._volumes[:-1]    = self._volumes[1:];    self._volumes[-1]    = float(latest_row["volume"])
            self._timestamps[:-1] = self._timestamps[1:]; self._timestamps[-1] = latest_ts

            self._last_candle_ts = latest_ts

            # Rebuild DataFrame + recalculate indicators on updated buffer
            df = self._to_dataframe()
            if settings.use_supertrend:
                df = calculate_supertrend(df)
            if settings.use_atr:
                df = calculate_atr(df)

            self.latest_df = df

        else:
            df = self.latest_df
            if df.empty:
                return

        # Extract latest values
        last      = df.iloc[-1]
        ts        = df.index[-1].strftime("%H:%M:%S")
        close     = float(last["close"])

        # Override with WebSocket last_price for display — no HTTP lag
        _tick = zeroda.get_ticks().get(self.instrument_token)
        if _tick and _tick.get("last_price"):
            close = float(_tick["last_price"])

        st_dir    = int(last.get("st_direction", 0))    if "st_direction" in df.columns else 0
        st_val    = round(float(last.get("supertrend", float("nan"))), 2) if "supertrend" in df.columns else float("nan")
        atr_val   = float(last.get("atr", 0.0))         if "atr"          in df.columns else None
        direction = "GREEN" if st_dir == 1 else "RED" if st_dir == -1 else "?"

        log.info(
            "[%s] %s | close=%.2f | ST=%.2f (%s) | ATR=%s%s",
            ts, self.symbol, close, st_val, direction,
            round(atr_val, 2) if atr_val else "-",
            " [NEW CANDLE]" if new_candle else "",
        )

        emit_sync("tick", {
            "timestamp":  ts,
            "symbol":     self.symbol,
            "close":      close,
            "supertrend": st_val,
            "atr":        round(atr_val, 2) if atr_val else None,
            "direction":  direction,
            "new_candle": new_candle,
        })

        # Position update + exit checks — every tick
        positions   = self.broker.get_positions()
        in_position = bool(positions)

        if in_position:
            position = positions[0]

            if hasattr(self.broker, "update_peak_price"):
                self.broker.update_peak_price(close)

            # Refresh position after peak update
            position = self.broker.get_positions()[0]

            emit_sync("position:update", {
                "symbol":         position.get("symbol", self.symbol),
                "qty":            position.get("qty", self.qty),
                "entry_price":    position.get("entry_price", 0),
                "current_price":  close,
                "peak_price":     position.get("peak_price", 0),
                "unrealized_pnl": round(
                    (close - position.get("entry_price", close)) * position.get("qty", self.qty), 2
                ),
            })

            # Exit checks — every tick (SL/Target/Session/ST Red fire immediately)
            if "peak_price" not in position:
                position["peak_price"] = position.get("entry_price", close)

            exit_reason = exit_manager.check(
                position=position, current_price=close,
                st_direction=st_dir, atr_value=atr_val,
            )

            if exit_reason != exit_manager.HOLD:
                summary = exit_manager.exit_summary(exit_reason, position, close)
                log.info(
                    "[ENGINE] EXIT — reason=%s | entry=%.2f | exit=%.2f | P&L=%.2f (%s)",
                    exit_reason, summary["entry_price"], summary["exit_price"],
                    summary["pnl_points"], summary["result"],
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
                    symbol=self.symbol, token=self.instrument_token,
                    qty=position.get("qty", self.qty), transaction_type="SELL",
                    product="MIS", order_type="MARKET",
                    exchange=self.exchange,
                )
                emit_sync("order:placed", {
                    "type": "SELL", "symbol": self.symbol,
                    "qty": position.get("qty", self.qty),
                    "price": close, "order_id": order_id,
                })

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
                    "exit_time":        None,
                })
                return   # position closed — skip signal check this tick

        # BUY signal check — only on confirmed candle close
        if not new_candle or len(df) < 2:
            return

        if not in_position:
            signal = sig.get_signal(df)
            self.last_signal = signal

            if signal == "BUY" and self.state == EngineState.RUNNING:
                log.info("[ENGINE] BUY signal — %s qty=%d @ %.2f", self.symbol, self.qty, close)

                # ── Funds check before placing order ──────────────────────
                required = self.broker.get_order_margin(
                    symbol=self.symbol, qty=self.qty,
                    transaction_type="BUY", product="MIS",
                    exchange=self.exchange,
                )
                funds    = self.broker.get_funds()
                available = funds.get("live_balance", 0.0)

                log.info(
                    "[ENGINE] Margin check — required=₹%.2f available=₹%.2f",
                    required, available,
                )

                if required > 0 and available < required:
                    log.warning(
                        "[ENGINE] BUY BLOCKED — insufficient funds | required=₹%.2f available=₹%.2f",
                        required, available,
                    )
                    emit_sync("funds:insufficient", {
                        "symbol":    self.symbol,
                        "required":  required,
                        "available": available,
                    })
                    return

                emit_sync("signal:buy", {"symbol": self.symbol, "price": close, "time": ts})
                order_id = self.broker.place_order(
                    symbol=self.symbol, token=self.instrument_token,
                    qty=self.qty, transaction_type="BUY",
                    product="MIS", order_type="MARKET",
                    exchange=self.exchange,
                )
                emit_sync("order:placed", {
                    "type": "BUY", "symbol": self.symbol,
                    "qty": self.qty, "price": close, "order_id": order_id,
                })

    # ── Exit all positions (called on engine stop) ─────────────────────────────

    def _exit_all_positions(self, reason: str = "ENGINE_STOP") -> None:
        """Close any open position at current market price before engine stops."""
        positions = self.broker.get_positions()
        if not positions:
            return

        # Best available exit price: live tick → confirmed close
        exit_price = 0.0
        ticks = self.broker.get_latest_ticks()
        tick  = ticks.get(self.instrument_token)
        if tick and tick.get("last_price"):
            exit_price = float(tick["last_price"])
        elif not self.latest_df.empty:
            exit_price = float(self.latest_df.iloc[-1]["close"])

        for position in positions:
            qty         = position.get("qty", self.qty)
            entry_price = position.get("entry_price", 0.0)
            pnl_points  = round(exit_price - entry_price, 2)
            pnl_amount  = round(pnl_points * qty, 2)
            result      = "PROFIT" if pnl_points >= 0 else "LOSS"

            log.info(
                "[ENGINE] STOP EXIT — reason=%s | entry=%.2f | exit=%.2f | P&L=%.2f (%s)",
                reason, entry_price, exit_price, pnl_points, result,
            )

            emit_sync("exit:triggered", {
                "reason":      reason,
                "entry_price": entry_price,
                "exit_price":  exit_price,
                "pnl_points":  pnl_points,
                "pnl_amount":  pnl_amount,
                "result":      result,
            })

            order_id = self.broker.place_order(
                symbol=self.symbol, token=self.instrument_token,
                qty=qty, transaction_type="SELL",
                product="MIS", order_type="MARKET",
                price=exit_price, exchange=self.exchange,
            )
            emit_sync("order:placed", {
                "type": "SELL", "symbol": self.symbol,
                "qty": qty, "price": exit_price, "order_id": order_id,
            })

            save_trade_sync({
                "symbol":           self.symbol,
                "instrument_token": self.instrument_token,
                "qty":              qty,
                "entry_price":      entry_price,
                "exit_price":       exit_price,
                "pnl_points":       pnl_points,
                "pnl_amount":       pnl_amount,
                "result":           result,
                "exit_reason":      reason,
                "broker_mode":      settings.broker_mode,
                "interval":         self.interval,
                "entry_time":       position.get("entry_time"),
                "exit_time":        None,
            })

    # ── Buffer helpers ─────────────────────────────────────────────────────────

    def _fill_buffer(self, df: pd.DataFrame) -> None:
        """Load DataFrame into NumPy arrays (called once at warmup)."""
        n = min(len(df), self.candle_count)
        self._opens[-n:]      = df["open"].values[-n:].astype(np.float64)
        self._highs[-n:]      = df["high"].values[-n:].astype(np.float64)
        self._lows[-n:]       = df["low"].values[-n:].astype(np.float64)
        self._closes[-n:]     = df["close"].values[-n:].astype(np.float64)
        self._volumes[-n:]    = df["volume"].values[-n:].astype(np.float64)
        self._timestamps[-n:] = df.index[-n:].values.astype("datetime64[s]")

    def _to_dataframe(self) -> pd.DataFrame:
        """Convert NumPy buffer to DataFrame for indicator calculation."""
        return pd.DataFrame(
            {
                "open":   self._opens,
                "high":   self._highs,
                "low":    self._lows,
                "close":  self._closes,
                "volume": self._volumes,
            },
            index=pd.to_datetime(self._timestamps),
        )

    # ── Status ─────────────────────────────────────────────────────────────────

    def status(self) -> dict:
        result = {
            "state":    self.state.value,
            "symbol":   self.symbol,
            "interval": self.interval,
        }

        if not self.latest_df.empty:
            last = self.latest_df.iloc[-1]
            result.update({
                "timestamp":    self.latest_df.index[-1].strftime("%Y-%m-%d %H:%M:%S"),
                "close":        round(last["close"], 2),
                "supertrend":   round(float(last.get("supertrend", float("nan"))), 2) if "supertrend"   in self.latest_df.columns else None,
                "st_direction": int(last.get("st_direction", 0))                      if "st_direction" in self.latest_df.columns else None,
                "atr":          round(float(last.get("atr", float("nan"))), 2)        if "atr"          in self.latest_df.columns else None,
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
