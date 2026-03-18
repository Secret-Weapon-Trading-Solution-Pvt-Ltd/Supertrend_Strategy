"""
strategy/exit_manager.py — Exit condition checker.

Evaluated every tick while a position is open.
Works for BOTH live and forward test — broker-agnostic.
The engine calls check() and if exit is triggered, calls broker.place_order(SELL).

Exit priority (from plan):
  1. Session End   — time >= 15:15 IST → square off everything
  2. Fixed SL      — price dropped sl_value below entry
  3. Trailing SL   — price dropped trail_value below peak
  4. Target        — price gained target_value above entry
  5. ST Red        — Supertrend flipped bearish

All thresholds read from config/settings.py.
"""

from datetime import datetime
import pytz
import pandas as pd

from config.settings import settings

IST = pytz.timezone("Asia/Kolkata")

# Exit reason constants
SESSION_END  = "SESSION_END"
FIXED_SL     = "FIXED_SL"
TRAILING_SL  = "TRAILING_SL"
TARGET       = "TARGET"
ST_RED       = "ST_RED"
HOLD         = "HOLD"


def check(
    position:      dict,
    current_price: float,
    st_direction:  int,
    atr_value:     float = None,
) -> str:
    """
    Check all exit conditions in priority order.

    Args:
        position      : dict from broker — must have keys: entry_price, peak_price
        current_price : latest close price
        st_direction  : +1 (green) or -1 (red) from indicators
        atr_value     : latest ATR value (used if target_type = "atr_multiple")

    Returns:
        Exit reason string or "HOLD"
    """
    entry_price = position["entry_price"]
    peak_price  = position.get("peak_price", entry_price)

    # ── 1. Session End ────────────────────────────────────────────────────────
    if _is_session_end():
        return SESSION_END

    # ── 2. Fixed Stop Loss ────────────────────────────────────────────────────
    sl_level = _calc_sl_level(entry_price, atr_value)
    if current_price <= sl_level:
        return FIXED_SL

    # ── 3. Trailing Stop Loss ─────────────────────────────────────────────────
    if settings.trailing_sl:
        trailing_level = peak_price - settings.trail_value
        if current_price <= trailing_level:
            return TRAILING_SL

    # ── 4. Target (Take Profit) ───────────────────────────────────────────────
    target_level = _calc_target_level(entry_price, atr_value)
    if current_price >= target_level:
        return TARGET

    # ── 5. Supertrend Red ─────────────────────────────────────────────────────
    if settings.exit_on_st_red and st_direction == -1:
        return ST_RED

    return HOLD


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_session_end() -> bool:
    """True if current IST time is at or past session_end_time."""
    now_ist = datetime.now(IST)
    h, m    = map(int, settings.session_end_time.split(":"))
    end_time = now_ist.replace(hour=h, minute=m, second=0, microsecond=0)
    return now_ist >= end_time


def _calc_sl_level(entry_price: float, atr_value: float = None) -> float:
    """Compute stop loss price based on sl_type."""
    if settings.sl_type == "points":
        return entry_price - settings.sl_value

    if settings.sl_type == "percentage":
        return entry_price * (1 - settings.sl_value / 100)

    # Default fallback
    return entry_price - settings.sl_value


def _calc_target_level(entry_price: float, atr_value: float = None) -> float:
    """Compute target price based on target_type."""
    if settings.target_type == "points":
        return entry_price + settings.target_value

    if settings.target_type == "percentage":
        return entry_price * (1 + settings.target_value / 100)

    if settings.target_type == "atr_multiple":
        if atr_value and atr_value > 0:
            return entry_price + (atr_value * settings.target_value)
        # fallback to points if ATR not available
        return entry_price + settings.target_value

    # Default fallback
    return entry_price + settings.target_value


def exit_summary(reason: str, position: dict, current_price: float) -> dict:
    """
    Build a summary dict when an exit is triggered.
    Logged by the engine before placing the exit order.
    """
    entry_price = position["entry_price"]
    pnl_points  = current_price - entry_price
    pnl_amount  = pnl_points * position.get("qty", 1)

    return {
        "exit_reason":  reason,
        "entry_price":  entry_price,
        "exit_price":   current_price,
        "pnl_points":   round(pnl_points, 2),
        "pnl_amount":   round(pnl_amount, 2),
        "result":       "PROFIT" if pnl_points >= 0 else "LOSS",
    }
