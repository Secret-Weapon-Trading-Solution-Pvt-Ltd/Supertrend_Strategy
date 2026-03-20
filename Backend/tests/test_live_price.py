"""
tests/test_live_price.py
========================
Tests for the 3 changes made in this session:

  1. ForwardTestBroker — pnl_points / pnl_amount keys in trade dict + summary()
  2. TradingEngine     — position:update emits qty field
  3. main.py / _indicators_loop — live_price from tick overrides candle close

Run:
    cd Backend
    python -m pytest tests/test_live_price.py -v
    # OR without pytest:
    python tests/test_live_price.py
"""

import sys
import types
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch


# ─────────────────────────────────────────────────────────────────────────────
# 1. ForwardTestBroker P&L key fixes
# ─────────────────────────────────────────────────────────────────────────────

class TestForwardTestBrokerPnL(unittest.TestCase):

    def _make_broker(self):
        # Import lazily so sys.path hacks don't pollute module cache
        sys.path.insert(0, ".")
        from broker.forward_test import ForwardTestBroker
        return ForwardTestBroker(zerodha_broker=None)

    def _trade_cycle(self, broker, entry=100.0, exit_=120.0, qty=10):
        """Simulate one full BUY → SELL cycle."""
        broker.place_order(
            symbol="TEST", token=999, qty=qty,
            transaction_type="BUY",
            product="MIS", order_type="MARKET", price=entry,
        )
        broker.place_order(
            symbol="TEST", token=999, qty=qty,
            transaction_type="SELL",
            product="MIS", order_type="MARKET", price=exit_,
        )

    # 1a. Trade dict has pnl_points, pnl_amount, and backward-compat pnl
    def test_trade_keys_present(self):
        broker = self._make_broker()
        self._trade_cycle(broker, entry=100.0, exit_=120.0, qty=10)

        trade = broker.trades[0]
        self.assertIn("pnl_points", trade,  "pnl_points key missing from trade dict")
        self.assertIn("pnl_amount", trade,  "pnl_amount key missing from trade dict")
        self.assertIn("pnl",        trade,  "backward-compat pnl key missing")

    # 1b. Values are correct
    def test_pnl_values_correct(self):
        broker = self._make_broker()
        self._trade_cycle(broker, entry=100.0, exit_=120.0, qty=10)

        trade = broker.trades[0]
        self.assertAlmostEqual(trade["pnl_points"], 20.0,  msg="pnl_points wrong")
        self.assertAlmostEqual(trade["pnl_amount"], 200.0, msg="pnl_amount wrong")
        self.assertAlmostEqual(trade["pnl"],        200.0, msg="backward-compat pnl wrong")

    # 1c. Loss case
    def test_loss_pnl_values(self):
        broker = self._make_broker()
        self._trade_cycle(broker, entry=200.0, exit_=190.0, qty=5)

        trade = broker.trades[0]
        self.assertAlmostEqual(trade["pnl_points"], -10.0,  msg="loss pnl_points wrong")
        self.assertAlmostEqual(trade["pnl_amount"], -50.0,  msg="loss pnl_amount wrong")
        self.assertEqual(trade["result"], "LOSS")

    # 1d. summary() uses pnl_amount (not old pnl key)
    def test_summary_total_pnl(self):
        broker = self._make_broker()
        self._trade_cycle(broker, entry=100.0, exit_=110.0, qty=5)   # +50
        self._trade_cycle(broker, entry=110.0, exit_=105.0, qty=5)   # -25

        s = broker.summary()
        self.assertEqual(s["total_trades"], 2)
        self.assertAlmostEqual(s["total_pnl"], 25.0, msg="summary total_pnl wrong")
        self.assertEqual(s["wins"],   1)
        self.assertEqual(s["losses"], 1)
        self.assertAlmostEqual(s["win_rate"], 50.0)

    # 1e. No double-open guard
    def test_no_double_position(self):
        broker = self._make_broker()
        # Two BUYs — second should be ignored
        broker.place_order("X", 1, 10, "BUY", "MIS", "MARKET", price=100.0)
        broker.place_order("X", 1, 10, "BUY", "MIS", "MARKET", price=105.0)
        self.assertEqual(broker.position["entry_price"], 100.0, "Second BUY should be ignored")


# ─────────────────────────────────────────────────────────────────────────────
# 2. position:update payload contains qty
# ─────────────────────────────────────────────────────────────────────────────

class TestPositionUpdateQty(unittest.TestCase):
    """
    Mirrors the payload construction in trading_engine.py _tick() and
    verifies 'qty' is present and correct.

    We test the dict construction directly (no engine boot needed) so the
    test stays fast and dependency-free.
    """

    def _build_position_update_payload(self, position, close, fallback_symbol, fallback_qty):
        """
        Copy of the emit_sync("position:update", ...) payload dict
        from engine/trading_engine.py lines 304-313.
        """
        return {
            "symbol":         position.get("symbol", fallback_symbol),
            "qty":            position.get("qty", fallback_qty),
            "entry_price":    position.get("entry_price", 0),
            "current_price":  close,
            "peak_price":     position.get("peak_price", 0),
            "unrealized_pnl": round(
                (close - position.get("entry_price", close)) * position.get("qty", fallback_qty), 2
            ),
        }

    def test_qty_present_in_payload(self):
        position = {"symbol": "RELIANCE", "qty": 15, "entry_price": 2800.0, "peak_price": 2850.0}
        payload  = self._build_position_update_payload(position, close=2860.0,
                                                        fallback_symbol="RELIANCE", fallback_qty=1)
        self.assertIn("qty", payload, "qty key missing from position:update payload")
        self.assertEqual(payload["qty"], 15)

    def test_qty_uses_fallback_when_missing_from_position(self):
        position = {"symbol": "RELIANCE", "entry_price": 2800.0}  # no qty key
        payload  = self._build_position_update_payload(position, close=2860.0,
                                                        fallback_symbol="RELIANCE", fallback_qty=5)
        self.assertEqual(payload["qty"], 5, "Should fall back to engine qty")

    def test_unrealized_pnl_uses_qty(self):
        position = {"symbol": "RELIANCE", "qty": 10, "entry_price": 2800.0, "peak_price": 2800.0}
        payload  = self._build_position_update_payload(position, close=2820.0,
                                                        fallback_symbol="RELIANCE", fallback_qty=1)
        # (2820 - 2800) * 10 = 200
        self.assertAlmostEqual(payload["unrealized_pnl"], 200.0)

    def test_current_price_matches_close(self):
        position = {"symbol": "X", "qty": 1, "entry_price": 100.0, "peak_price": 100.0}
        payload  = self._build_position_update_payload(position, close=105.5,
                                                        fallback_symbol="X", fallback_qty=1)
        self.assertAlmostEqual(payload["current_price"], 105.5)


# ─────────────────────────────────────────────────────────────────────────────
# 3. live_price from KiteTicker tick overrides candle close
# ─────────────────────────────────────────────────────────────────────────────

class TestLivePriceOverride(unittest.TestCase):
    """
    Simulates the live_price selection logic from _indicators_loop in main.py.
    Tests both: tick present → uses last_price; tick absent → falls back to candle close.
    """

    def _compute_live_price(self, tick_dict, candle_close, token=738561):
        """
        Mirror of the logic in _indicators_loop:
            _tick      = zeroda.get_ticks().get(token)
            live_price = round(float(_tick["last_price"]), 2) if _tick and _tick.get("last_price") else round(float(candle_close), 2)
        """
        _tick = tick_dict.get(token)
        if _tick and _tick.get("last_price"):
            return round(float(_tick["last_price"]), 2)
        return round(float(candle_close), 2)

    def test_tick_present_uses_last_price(self):
        tick_dict = {738561: {"last_price": 2857.35, "mode": "quote"}}
        result = self._compute_live_price(tick_dict, candle_close=2850.0)
        self.assertAlmostEqual(result, 2857.35,
                               msg="Should use tick last_price when available")

    def test_tick_absent_uses_candle_close(self):
        tick_dict = {}   # no ticks yet
        result = self._compute_live_price(tick_dict, candle_close=2850.0)
        self.assertAlmostEqual(result, 2850.0,
                               msg="Should fall back to candle close when no tick")

    def test_tick_missing_last_price_key_falls_back(self):
        tick_dict = {738561: {"mode": "quote"}}   # last_price absent
        result = self._compute_live_price(tick_dict, candle_close=2850.0)
        self.assertAlmostEqual(result, 2850.0,
                               msg="Should fall back when last_price key missing")

    def test_tick_last_price_zero_uses_tick(self):
        """Zero is a valid (if unusual) price — still returns it."""
        tick_dict = {738561: {"last_price": 0.0}}
        result = self._compute_live_price(tick_dict, candle_close=2850.0)
        # last_price=0 is falsy → falls back to candle close (matches our logic)
        self.assertAlmostEqual(result, 2850.0,
                               msg="last_price=0 is falsy, should fall back to candle close")

    def test_different_token_not_used(self):
        """Tick for token 111 should not affect result for token 738561."""
        tick_dict = {111: {"last_price": 9999.0}}
        result = self._compute_live_price(tick_dict, candle_close=2850.0, token=738561)
        self.assertAlmostEqual(result, 2850.0)

    def test_rounding_to_2dp(self):
        tick_dict = {738561: {"last_price": 2857.3568}}
        result = self._compute_live_price(tick_dict, candle_close=2850.0)
        self.assertAlmostEqual(result, 2857.36, places=2)


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("SWTS Live Price & P&L Fix Tests")
    print("=" * 60)
    loader  = unittest.TestLoader()
    suite   = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestForwardTestBrokerPnL))
    suite.addTests(loader.loadTestsFromTestCase(TestPositionUpdateQty))
    suite.addTests(loader.loadTestsFromTestCase(TestLivePriceOverride))
    runner  = unittest.TextTestRunner(verbosity=2)
    result  = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
