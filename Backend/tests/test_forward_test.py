"""
tests/test_forward_test.py — Simulate ST flip and verify entry + exit logic.

Tests:
  1.  ST flip RED → GREEN  → BUY signal generated
  2.  ST stays GREEN       → HOLD (no re-entry on already green)
  3.  ST stays RED         → HOLD
  4.  ST flip GREEN → RED  → EXIT signal
  5.  ForwardTestBroker    → opens position on BUY
  6.  ForwardTestBroker    → closes position + correct P&L on SELL
  7.  Capital              → deducted on BUY, returned on SELL
  8.  Capital              → insufficient capital blocks BUY
  9.  Exit: Fixed SL       → triggers when price drops below entry - sl_value
  10. Exit: Target         → triggers when price rises above entry + target_value
  11. Exit: Trailing SL    → triggers when price drops below peak - trail_value
  12. Exit: ST Red         → triggers when st_direction = -1
"""

import pytest
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import patch

from strategy.signals import get_signal
from strategy.exit_manager import check as check_exit
from strategy.exit_manager import FIXED_SL, TARGET, TRAILING_SL, ST_RED, HOLD
from broker.forward_test import ForwardTestBroker


# ── Helper — build a DataFrame with manually set st_direction ─────────────────

def make_df(directions: list[int], closes: list[float] = None) -> pd.DataFrame:
    """
    Build a DataFrame with st_direction + atr columns for signal testing.
    No real indicator calculation — directions are set directly.

    directions: list of +1 (GREEN) or -1 (RED) per candle
    closes:     optional list of close prices (defaults to 100, 101, 102, ...)
    """
    n = len(directions)
    if closes is None:
        closes = [100.0 + i for i in range(n)]

    timestamps = [datetime(2024, 1, 2, 9, 15) + timedelta(minutes=i) for i in range(n)]

    return pd.DataFrame(
        {
            "open":         closes,
            "high":         [c + 2.0 for c in closes],
            "low":          [c - 2.0 for c in closes],
            "close":        closes,
            "volume":       [10_000] * n,
            "supertrend":   [c - 5.0 if d == 1 else c + 5.0 for c, d in zip(closes, directions)],
            "st_direction": directions,
            "atr":          [5.0] * n,
        },
        index=pd.to_datetime(timestamps),
    )


# ── Mock settings used by exit_manager ────────────────────────────────────────

MOCK_SETTINGS = {
    "sl_type":        "points",
    "sl_value":       10.0,
    "trailing_sl":    True,
    "trail_value":    5.0,
    "target_type":    "points",
    "target_value":   20.0,
    "exit_on_st_red": True,
    "session_end_time": "23:59",   # far future so session end never triggers in tests
    "use_atr":        True,
    "atr_threshold":  1.0,
}


def mock_settings(**overrides):
    """Return a mock settings object with overrideable fields."""
    from unittest.mock import MagicMock
    s = MagicMock()
    cfg = {**MOCK_SETTINGS, **overrides}
    for k, v in cfg.items():
        setattr(s, k, v)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# 1-4 — Signal Detection
# ══════════════════════════════════════════════════════════════════════════════

def test_signal_buy_on_st_flip_red_to_green():
    """ST flips RED → GREEN on last candle → BUY signal."""
    # prev = RED (-1), curr = GREEN (+1)
    df = make_df([-1, -1, -1, -1, +1])
    with patch("strategy.signals.settings", mock_settings()):
        signal = get_signal(df)
    assert signal == "BUY", f"Expected BUY, got {signal}"


def test_signal_hold_when_st_stays_green():
    """ST already GREEN and stays GREEN → HOLD (no re-entry)."""
    df = make_df([-1, +1, +1, +1, +1])
    with patch("strategy.signals.settings", mock_settings()):
        signal = get_signal(df)
    assert signal == "HOLD", f"Expected HOLD, got {signal}"


def test_signal_hold_when_st_stays_red():
    """ST stays RED throughout → HOLD."""
    df = make_df([-1, -1, -1, -1, -1])
    with patch("strategy.signals.settings", mock_settings()):
        signal = get_signal(df)
    assert signal == "HOLD", f"Expected HOLD, got {signal}"


def test_signal_exit_on_st_flip_green_to_red():
    """ST flips GREEN → RED on last candle → EXIT signal."""
    df = make_df([+1, +1, +1, +1, -1])
    with patch("strategy.signals.settings", mock_settings(exit_on_st_red=True)):
        signal = get_signal(df)
    assert signal == "EXIT", f"Expected EXIT, got {signal}"


def test_signal_atr_gate_blocks_buy():
    """ST flips green but ATR < threshold → HOLD (ATR gate)."""
    df = make_df([-1, +1])
    # Set ATR values below threshold
    df["atr"] = 0.5
    with patch("strategy.signals.settings", mock_settings(use_atr=True, atr_threshold=2.0)):
        signal = get_signal(df)
    assert signal == "HOLD", f"Expected HOLD (ATR gate), got {signal}"


# ══════════════════════════════════════════════════════════════════════════════
# 5-8 — ForwardTestBroker Entry + Capital
# ══════════════════════════════════════════════════════════════════════════════

def test_forward_broker_opens_position_on_buy():
    """BUY order → position recorded with correct entry price."""
    broker = ForwardTestBroker(initial_capital=100_000)
    broker.place_order(
        symbol="RELIANCE", token=738561, qty=10,
        transaction_type="BUY", product="MIS",
        order_type="MARKET", price=2500.0,
    )
    assert broker.position is not None
    assert broker.position["entry_price"] == 2500.0
    assert broker.position["qty"] == 10
    assert broker.position["symbol"] == "RELIANCE"


def test_forward_broker_closes_position_with_pnl():
    """SELL order → position closed, P&L calculated correctly."""
    broker = ForwardTestBroker(initial_capital=100_000)
    broker.place_order("RELIANCE", 738561, 10, "BUY",  "MIS", "MARKET", price=2500.0)
    broker.place_order("RELIANCE", 738561, 10, "SELL", "MIS", "MARKET", price=2520.0)

    assert broker.position is None
    assert len(broker.trades) == 1
    trade = broker.trades[0]
    assert trade["pnl_points"] == 20.0
    assert trade["pnl_amount"] == 200.0   # 20 points × 10 qty
    assert trade["result"] == "PROFIT"


def test_capital_deducted_on_buy_returned_on_sell():
    """Capital reduces on BUY and is returned (with P&L) on SELL."""
    broker = ForwardTestBroker(initial_capital=100_000)

    broker.place_order("RELIANCE", 738561, 10, "BUY",  "MIS", "MARKET", price=2500.0)
    assert broker.available_capital == pytest.approx(100_000 - 2500 * 10)  # 75,000

    broker.place_order("RELIANCE", 738561, 10, "SELL", "MIS", "MARKET", price=2520.0)
    assert broker.available_capital == pytest.approx(75_000 + 2520 * 10)   # 100,200


def test_insufficient_capital_blocks_buy():
    """BUY blocked when cost exceeds available capital."""
    broker = ForwardTestBroker(initial_capital=1_000)   # only ₹1,000
    broker.place_order("RELIANCE", 738561, 10, "BUY", "MIS", "MARKET", price=2500.0)

    # Position should NOT be opened — cost ₹25,000 > capital ₹1,000
    assert broker.position is None
    assert broker.available_capital == 1_000   # unchanged


# ══════════════════════════════════════════════════════════════════════════════
# 9-12 — Exit Conditions
# ══════════════════════════════════════════════════════════════════════════════

BASE_POSITION = {
    "entry_price": 1000.0,
    "peak_price":  1000.0,
    "qty":         10,
}


def test_exit_fixed_sl():
    """Price drops below entry - sl_value → FIXED_SL exit."""
    position = {**BASE_POSITION, "peak_price": 1000.0}
    with patch("strategy.exit_manager.settings", mock_settings(sl_value=10.0)):
        # price = 989 → below 1000 - 10 = 990
        result = check_exit(position, current_price=989.0, st_direction=1)
    assert result == FIXED_SL


def test_exit_target():
    """Price rises above entry + target_value → TARGET exit."""
    position = {**BASE_POSITION, "peak_price": 1010.0}
    with patch("strategy.exit_manager.settings", mock_settings(target_value=20.0)):
        # price = 1021 → above 1000 + 20 = 1020
        result = check_exit(position, current_price=1021.0, st_direction=1)
    assert result == TARGET


def test_exit_trailing_sl():
    """Price drops below peak - trail_value → TRAILING_SL exit."""
    position = {**BASE_POSITION, "peak_price": 1030.0}
    with patch("strategy.exit_manager.settings", mock_settings(
        trailing_sl=True, trail_value=5.0,
        sl_value=100.0,        # set fixed SL far away so it doesn't trigger first
        target_value=1000.0,   # set target far away
    )):
        # price = 1024 → below peak(1030) - trail(5) = 1025
        result = check_exit(position, current_price=1024.0, st_direction=1)
    assert result == TRAILING_SL


def test_exit_st_red():
    """ST flips red → ST_RED exit."""
    position = {**BASE_POSITION, "peak_price": 1000.0}
    with patch("strategy.exit_manager.settings", mock_settings(
        exit_on_st_red=True,
        sl_value=100.0,       # fixed SL far away
        target_value=1000.0,  # target far away
        trailing_sl=False,
    )):
        result = check_exit(position, current_price=1005.0, st_direction=-1)
    assert result == ST_RED


def test_hold_when_no_exit_condition_met():
    """No exit condition met → HOLD."""
    position = {**BASE_POSITION, "peak_price": 1005.0}
    with patch("strategy.exit_manager.settings", mock_settings(
        sl_value=100.0,
        target_value=1000.0,
        trailing_sl=False,
        exit_on_st_red=False,
    )):
        result = check_exit(position, current_price=1010.0, st_direction=1)
    assert result == HOLD


# ══════════════════════════════════════════════════════════════════════════════
# Full cycle — BUY → price moves → exit triggered → P&L correct
# ══════════════════════════════════════════════════════════════════════════════

def test_full_cycle_profit():
    """
    Full forward test cycle:
    ST flips green → BUY at 2500 → price rises to 2521 → TARGET exit → PROFIT
    """
    broker = ForwardTestBroker(initial_capital=100_000)

    # Step 1: ST flip detected → BUY
    df = make_df([-1, -1, +1])
    with patch("strategy.signals.settings", mock_settings()):
        signal = get_signal(df)
    assert signal == "BUY"

    # Step 2: Place BUY order
    broker.place_order("RELIANCE", 738561, 10, "BUY", "MIS", "MARKET", price=2500.0)
    assert broker.position is not None

    # Step 3: Price hits target → exit_manager triggers TARGET
    position = broker.position
    with patch("strategy.exit_manager.settings", mock_settings(target_value=20.0)):
        exit_reason = check_exit(position, current_price=2521.0, st_direction=1)
    assert exit_reason == TARGET

    # Step 4: Place SELL order
    broker.place_order("RELIANCE", 738561, 10, "SELL", "MIS", "MARKET", price=2521.0)
    assert broker.position is None
    assert broker.trades[0]["result"] == "PROFIT"
    assert broker.trades[0]["pnl_amount"] == pytest.approx(210.0)  # 21 pts × 10


def test_full_cycle_loss():
    """
    Full forward test cycle:
    ST flips green → BUY at 2500 → price drops to 2488 → FIXED_SL exit → LOSS
    """
    broker = ForwardTestBroker(initial_capital=100_000)

    broker.place_order("RELIANCE", 738561, 10, "BUY", "MIS", "MARKET", price=2500.0)

    position = broker.position
    with patch("strategy.exit_manager.settings", mock_settings(sl_value=10.0)):
        exit_reason = check_exit(position, current_price=2488.0, st_direction=1)
    assert exit_reason == FIXED_SL

    broker.place_order("RELIANCE", 738561, 10, "SELL", "MIS", "MARKET", price=2488.0)
    assert broker.trades[0]["result"] == "LOSS"
    assert broker.trades[0]["pnl_amount"] == pytest.approx(-120.0)  # -12 pts × 10
