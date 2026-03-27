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

    def __init__(self, zerodha_broker=None, initial_capital: float = 100_000.0):
        """
        zerodha_broker:   optional ZerodhaBroker instance for real market data.
        initial_capital:  virtual capital to trade with (default ₹1,00,000).
        """
        self._real = zerodha_broker          # underlying real broker for market data

        # Capital tracking
        self.initial_capital:   float = initial_capital
        self.available_capital: float = initial_capital

        # Active virtual position (only one at a time — long only)
        self.position: dict | None = None    # {order_id, symbol, token, qty, entry_price, entry_time}

        # Completed trade log
        self.trades: list[dict] = []

        # Virtual order book {order_id: order_dict}
        self._orders: dict[str, dict] = {}

        # symbol → token cache — populated on every place_order call
        # Used by get_order_margin() to fetch correct LTP for margin estimate
        self._token_cache: dict[str, int] = {}

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
        exchange:         str   = "NSE",
    ) -> str:
        """
        Simulate order placement.
        BUY  → open a virtual position at current price.
        SELL → close position, compute P&L, log trade.
        Returns a fake order_id.
        """
        order_id  = str(uuid.uuid4())[:8]
        timestamp = datetime.now()

        # Cache symbol → token for use in get_order_margin()
        self._token_cache[symbol] = token

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
        """
        Returns order status with Zerodha-compatible keys so _wait_for_fill()
        in the engine works identically in both forward_test and live mode.
          fill_price  → average_price
          qty         → filled_quantity
        """
        order = self._orders.get(order_id, {})
        if not order:
            return {}
        return {
            "status":           order.get("status", ""),
            "average_price":    order.get("fill_price", 0.0),
            "filled_quantity":  order.get("qty", 0),
            "status_message":   "",
        }

    # ── Position ──────────────────────────────────────────────────────────────

    def _open_position(self, order: dict) -> None:
        if self.position:
            log.warning("[FT] Already in a position — ignoring BUY for %s", order["symbol"])
            return

        cost = order["fill_price"] * order["qty"]
        if cost > self.available_capital:
            log.warning(
                "[FT] Insufficient capital — need ₹%.2f, have ₹%.2f — BUY blocked",
                cost, self.available_capital,
            )
            return

        self.available_capital -= cost

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
            "[FT] BUY  %s | qty=%d | entry=%.2f | capital_used=₹%.2f | capital_left=₹%.2f | time=%s",
            order["symbol"], order["qty"], order["fill_price"],
            cost, self.available_capital,
            order["timestamp"].strftime("%H:%M:%S"),
        )

    def _close_position(self, order: dict) -> None:
        if not self.position:
            log.warning("[FT] No open position to close for %s", order["symbol"])
            return

        entry      = self.position["entry_price"]
        exit_      = order["fill_price"]
        qty        = self.position["qty"]
        pnl_points = round(exit_ - entry, 2)
        pnl_amount = round(pnl_points * qty, 2)

        trade = {
            "symbol":      self.position["symbol"],
            "qty":         qty,
            "entry_price": entry,
            "exit_price":  exit_,
            "entry_time":  self.position["entry_time"],
            "exit_time":   order["timestamp"],
            "pnl_points":  pnl_points,
            "pnl_amount":  pnl_amount,
            "pnl":         pnl_amount,   # kept for backward compat
            "result":      "PROFIT" if pnl_amount >= 0 else "LOSS",
        }
        self.trades.append(trade)

        # Return proceeds to available capital
        self.available_capital += exit_ * qty

        log.info(
            "[FT] SELL %s | qty=%d | entry=%.2f | exit=%.2f | P&L=%.2f (%s) | capital=₹%.2f",
            trade["symbol"], qty, entry, exit_, pnl_amount, trade["result"],
            self.available_capital,
        )

        self.position = None

    def get_positions(self) -> list[dict]:
        return [self.position] if self.position else []

    def get_holdings(self) -> list[dict]:
        """
        Forward test has no real DEMAT holdings.
        Returns virtual capital summary as a single holding-like entry.
        """
        total_pnl = sum(t["pnl_amount"] for t in self.trades) if self.trades else 0.0
        return [{
            "mode":              "forward_test",
            "initial_capital":   self.initial_capital,
            "available_capital": round(self.available_capital, 2),
            "total_pnl":         round(total_pnl, 2),
            "total_trades":      len(self.trades),
            "wins":              sum(1 for t in self.trades if t["pnl_amount"] >= 0),
            "losses":            sum(1 for t in self.trades if t["pnl_amount"] < 0),
        }]

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

    def get_funds(self) -> dict:
        """Returns virtual capital as funds summary."""
        return {
            "live_balance": round(self.available_capital, 2),
            "collateral":   0.0,
            "net":          round(self.available_capital, 2),
        }

    def get_order_margin(self, symbol: str, qty: int, transaction_type: str,
                         product: str, exchange: str = "NSE") -> float:
        """
        In forward test, required margin = LTP × qty.
        Looks up the correct token from _token_cache (populated on place_order).
        Falls back to position token if cache miss, then 0 if neither available.
        """
        token = self._token_cache.get(symbol) or (
            self.position["token"] if self.position else 0
        )
        ltp = self._get_ltp(token)
        return round(ltp * qty, 2) if ltp else 0.0

    # ── Summary ───────────────────────────────────────────────────────────────

    def summary(self) -> dict:
        """Return P&L summary of all completed trades."""
        if not self.trades:
            return {
                "total_trades":      0,
                "total_pnl":         0.0,
                "wins":              0,
                "losses":            0,
                "initial_capital":   self.initial_capital,
                "available_capital": round(self.available_capital, 2),
                "trades":            [],
            }

        total_pnl = sum(t["pnl_amount"] for t in self.trades)
        wins      = sum(1 for t in self.trades if t["pnl_amount"] >= 0)
        losses    = len(self.trades) - wins

        return {
            "total_trades":      len(self.trades),
            "total_pnl":         round(total_pnl, 2),
            "wins":              wins,
            "losses":            losses,
            "win_rate":          round(wins / len(self.trades) * 100, 1),
            "initial_capital":   self.initial_capital,
            "available_capital": round(self.available_capital, 2),
            "trades":            self.trades,
        }
