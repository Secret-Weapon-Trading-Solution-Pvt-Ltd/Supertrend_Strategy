"""
broker/zerodha.py — ZerodhaBroker class.
Wraps the KiteConnect API and implements BrokerABC.
Credentials come from config/settings.py (read from .env).
"""

import logging
import pandas as pd
import pytz
from datetime import datetime, timedelta

_IST = pytz.timezone("Asia/Kolkata")

from kiteconnect.connect import KiteConnect
from broker.base import BrokerABC
from config.settings import settings

log = logging.getLogger(__name__)

# How many calendar days to go back per interval to guarantee 100 trading candles.
# Accounts for weekends + NSE holidays.
_LOOKBACK_DAYS = {
    "minute":   5,
    "3minute":  5,
    "5minute":  7,
    "10minute": 10,
    "15minute": 10,
    "30minute": 15,
    "60minute": 30,
    "day":      150,
}


class ZerodhaBroker(BrokerABC):

    def __init__(self):
        self.kite = KiteConnect(api_key=settings.kite_api_key)
        self._ticks: dict        = {}
        self._subscribed_tokens: list = []
        self._ticker_connected: bool  = False
        self._ticker = None

    # ── Session ───────────────────────────────────────────────────────────────

    def set_access_token(self, access_token: str) -> None:
        self.kite.set_access_token(access_token)
        log.info("ZerodhaBroker: access token set")

    # ── Historical Candles ────────────────────────────────────────────────────

    def get_candles(self, instrument_token: int, interval: str,
                    candle_count: int = 100) -> pd.DataFrame:
        """
        Fetch the last `candle_count` candles for the given instrument and interval.

        Steps:
          1. Look up how many calendar days to go back for this interval so that
             Zerodha returns at least `candle_count` candles (accounts for weekends
             and NSE holidays).
          2. Call kite.historical_data() with that date range.
          3. Slice the last `candle_count` rows from the result.

        Returns a DataFrame with columns: open, high, low, close, volume
        indexed by timestamp (datetime).
        Returns an empty DataFrame if no data is returned.
        """
        days = _LOOKBACK_DAYS.get(interval, 30)
        to_date   = datetime.now(_IST)
        from_date = to_date - timedelta(days=days)

        from_str = from_date.strftime("%Y-%m-%d %H:%M:%S")
        to_str   = to_date.strftime("%Y-%m-%d %H:%M:%S")

        log.info(
            "Fetching candles: token=%s interval=%s from=%s to=%s",
            instrument_token, interval, from_str, to_str,
        )

        raw = self.kite.historical_data(
            instrument_token = instrument_token,
            from_date        = from_str,
            to_date          = to_str,
            interval         = interval,
            continuous       = False,
            oi               = False,
        )

        if not raw:
            log.warning("No candle data returned for token=%s interval=%s", instrument_token, interval)
            return pd.DataFrame()

        df = pd.DataFrame(raw)
        df.rename(columns={"date": "timestamp"}, inplace=True)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.set_index("timestamp", inplace=True)

        # Keep only the last candle_count rows
        df = df.tail(candle_count)

        log.info("Got %d candles for token=%s interval=%s", len(df), instrument_token, interval)
        return df

    # ── Market Data ───────────────────────────────────────────────────────────

    def get_ltp(self, tokens: list[int]) -> dict:
        """Returns {instrument_token: last_price} for given tokens."""
        raw = self.kite.ltp(tokens)
        return {int(k): v["last_price"] for k, v in raw.items()}

    def get_instruments(self, exchange: str = "NSE") -> list[dict]:
        return self.kite.instruments(exchange=exchange)

    # ── Orders ────────────────────────────────────────────────────────────────

    def place_order(self, symbol: str, token: int, qty: int,
                    transaction_type: str, product: str,
                    order_type: str, price: float = 0) -> str:
        """
        Place a real order on Zerodha via Kite Connect.
        Returns order_id on success, raises exception on failure.
        """
        log.info(
            "Placing order: %s %s | qty=%d | type=%s | product=%s | price=%s",
            transaction_type, symbol, qty, order_type, product,
            price if price else "MARKET",
        )

        try:
            order_id = self.kite.place_order(
                variety          = self.kite.VARIETY_REGULAR,
                exchange         = self.kite.EXCHANGE_NSE,
                tradingsymbol    = symbol,
                transaction_type = transaction_type,
                quantity         = qty,
                product          = product,
                order_type       = order_type,
                price            = price if price else None,
            )
            log.info("Order placed successfully: order_id=%s | %s %s qty=%d", order_id, transaction_type, symbol, qty)
            return order_id

        except Exception as e:
            log.error("Order placement failed: %s %s qty=%d | error=%s", transaction_type, symbol, qty, e)
            raise

    def cancel_order(self, order_id: str) -> None:
        """Cancel an existing order by order_id."""
        try:
            self.kite.cancel_order(variety=self.kite.VARIETY_REGULAR, order_id=order_id)
            log.info("Order cancelled: order_id=%s", order_id)
        except Exception as e:
            log.error("Cancel failed: order_id=%s | error=%s", order_id, e)
            raise

    def get_positions(self) -> list[dict]:
        """Returns list of net positions."""
        return self.kite.positions()["net"]

    def get_order_status(self, order_id: str) -> dict:
        """Returns the latest status of an order."""
        history = self.kite.order_history(order_id)
        return history[-1] if history else {}

    # ── WebSocket Ticker ──────────────────────────────────────────────────────

    def subscribe_ticks(self, tokens: list[int]) -> None:
        new = [t for t in tokens if t not in self._subscribed_tokens]
        if not new:
            return
        self._subscribed_tokens.extend(new)
        if self._ticker and self._ticker_connected:
            self._ticker.subscribe(new)
            self._ticker.set_mode(self._ticker.MODE_FULL, new)
        log.info("Subscribed tokens: %s", new)

    def get_latest_ticks(self) -> dict:
        return dict(self._ticks)

    def init_ticker(self, access_token: str) -> None:
        """Connect KiteTicker WebSocket in a background thread."""
        from kiteconnect.ticker import KiteTicker

        if self._ticker:
            try:
                self._ticker.close()
            except Exception:
                pass

        self._ticker = KiteTicker(settings.kite_api_key, access_token)

        def on_connect(ws, response):
            self._ticker_connected = True
            log.info("KiteTicker connected")
            if self._subscribed_tokens:
                ws.subscribe(self._subscribed_tokens)
                ws.set_mode(ws.MODE_FULL, self._subscribed_tokens)

        def on_ticks(ws, ticks):
            for tick in ticks:
                self._ticks[tick["instrument_token"]] = tick

        def on_close(ws, code, reason):
            self._ticker_connected = False
            log.warning("KiteTicker closed: %s %s", code, reason)

        def on_error(ws, code, reason):
            log.error("KiteTicker error: %s %s", code, reason)

        def on_reconnect(ws, attempts_count):
            log.info("KiteTicker reconnecting (attempt %d)...", attempts_count)

        self._ticker.on_connect   = on_connect
        self._ticker.on_ticks     = on_ticks
        self._ticker.on_close     = on_close
        self._ticker.on_error     = on_error
        self._ticker.on_reconnect = on_reconnect

        self._ticker.connect(threaded=True)
        log.info("KiteTicker connecting in background...")
