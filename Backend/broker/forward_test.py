"""
broker/forward_test.py — ForwardTestBroker.

Simulates order execution using live market prices — no real orders placed.
Implements BrokerABC so it can be swapped with ZerodhaBroker via config.

Virtual position tracking:
  place_order(BUY)  → records entry price + qty in memory
  place_order(SELL) → calculates P&L, logs completed trade, clears position

All trade history stored in self.trades list (in memory).
"""

import logging
import uuid
from datetime import datetime

import pandas as pd

from broker.base import BrokerABC

log = logging.getLogger(__name__)


class ForwardTestBroker(BrokerABC):

    def __init__(self, zerodha_broker=None):
        """
        zerodha_broker: optional ZerodhaBroker instance.
        Used to fetch real candles and LTP for simulation.
        If None, get_candles() and get_ltp() return empty/zero.
        """
        self._real = zerodha_broker          # underlying real broker for market data

        # Active virtual position (only one at a time — long only)
        self.position: dict | None = None    # {order_id, symbol, token, qty, entry_price, entry_time}

        # Completed trade log
        self.trades: list[dict] = []

        # Virtual order book {order_id: order_dict}
        self._orders: dict[str, dict] = {}

    # ── Orders ────────────────────────────────────────────────────────────────

    def place_order(
        self,
        symbol:           str,
        token:            int,
        qty:              int,
        transaction_type: str,   # "BUY" or "SELL"
        product:          str,   # "MIS" etc.
        order_type:       str,   # "MARKET" etc.
        price:            float = 0,
    ) -> str:
        """
        Simulate order placement.
        BUY  → open a virtual position at current price.
        SELL → close position, compute P&L, log trade.
        Returns a fake order_id.
        """
        order_id  = str(uuid.uuid4())[:8]
        timestamp = datetime.now()

        # Determine fill price
        fill_price = price if price > 0 else self._get_ltp(token)

        order = {
            "order_id":         order_id,
            "symbol":           symbol,
            "token":            token,
            "qty":              qty,
            "transaction_type": transaction_type,
            "product":          product,
            "order_type":       order_type,
            "fill_price":       fill_price,
            "timestamp":        timestamp,
            "status":           "COMPLETE",
        }
        self._orders[order_id] = order

        if transaction_type == "BUY":
            self._open_position(order)
        elif transaction_type == "SELL":
            self._close_position(order)

        return order_id

    def cancel_order(self, order_id: str) -> None:
        if order_id in self._orders:
            self._orders[order_id]["status"] = "CANCELLED"
            log.info("[FT] Order %s cancelled", order_id)

    def get_order_status(self, order_id: str) -> dict:
        return self._orders.get(order_id, {})

    # ── Position ──────────────────────────────────────────────────────────────

    def _open_position(self, order: dict) -> None:
        if self.position:
            log.warning("[FT] Already in a position — ignoring BUY for %s", order["symbol"])
            return

        self.position = {
            "order_id":    order["order_id"],
            "symbol":      order["symbol"],
            "token":       order["token"],
            "qty":         order["qty"],
            "entry_price": order["fill_price"],
            "entry_time":  order["timestamp"],
            "peak_price":  order["fill_price"],   # for trailing SL tracking
        }

        log.info(
            "[FT] BUY  %s | qty=%d | entry=%.2f | time=%s",
            order["symbol"], order["qty"],
            order["fill_price"],
            order["timestamp"].strftime("%H:%M:%S"),
        )

    def _close_position(self, order: dict) -> None:
        if not self.position:
            log.warning("[FT] No open position to close for %s", order["symbol"])
            return

        entry = self.position["entry_price"]
        exit_ = order["fill_price"]
        qty   = self.position["qty"]
        pnl   = (exit_ - entry) * qty

        trade = {
            "symbol":      self.position["symbol"],
            "qty":         qty,
            "entry_price": entry,
            "exit_price":  exit_,
            "entry_time":  self.position["entry_time"],
            "exit_time":   order["timestamp"],
            "pnl":         round(pnl, 2),
            "result":      "PROFIT" if pnl >= 0 else "LOSS",
        }
        self.trades.append(trade)

        log.info(
            "[FT] SELL %s | qty=%d | entry=%.2f | exit=%.2f | P&L=%.2f (%s)",
            trade["symbol"], qty, entry, exit_, pnl, trade["result"],
        )

        self.position = None

    def get_positions(self) -> list[dict]:
        return [self.position] if self.position else []

    def update_peak_price(self, current_price: float) -> None:
        """Call each tick to keep peak_price updated for trailing SL."""
        if self.position and current_price > self.position["peak_price"]:
            self.position["peak_price"] = current_price

    # ── Market Data — delegates to real broker ────────────────────────────────

    def get_candles(self, instrument_token: int, interval: str,
                    candle_count: int = 100) -> pd.DataFrame:
        if self._real:
            return self._real.get_candles(instrument_token, interval, candle_count)
        return pd.DataFrame()

    def get_ltp(self, tokens: list[int]) -> dict:
        if self._real:
            return self._real.get_ltp(tokens)
        return {t: 0.0 for t in tokens}

    def _get_ltp(self, token: int) -> float:
        """Get single LTP for fill price — falls back to 0."""
        if self._real:
            result = self._real.get_ltp([token])
            return result.get(token, 0.0)
        return 0.0

    def get_instruments(self, exchange: str) -> list[dict]:
        if self._real:
            return self._real.get_instruments(exchange)
        return []

    def subscribe_ticks(self, tokens: list[int]) -> None:
        if self._real:
            self._real.subscribe_ticks(tokens)

    def get_latest_ticks(self) -> dict:
        if self._real:
            return self._real.get_latest_ticks()
        return {}

    # ── Summary ───────────────────────────────────────────────────────────────

    def summary(self) -> dict:
        """Return P&L summary of all completed trades."""
        if not self.trades:
            return {"total_trades": 0, "total_pnl": 0.0, "wins": 0, "losses": 0}

        total_pnl = sum(t["pnl"] for t in self.trades)
        wins      = sum(1 for t in self.trades if t["pnl"] >= 0)
        losses    = len(self.trades) - wins

        return {
            "total_trades": len(self.trades),
            "total_pnl":    round(total_pnl, 2),
            "wins":         wins,
            "losses":       losses,
            "win_rate":     round(wins / len(self.trades) * 100, 1),
            "trades":       self.trades,
        }
