"""
strategy/signals.py — Signal detection from Supertrend + ATR.

Confluence rules (long-only):
  ST only        : BUY when ST flips green, EXIT when ST flips red
  ST + ATR       : BUY when ST flips green AND ATR > threshold
  ATR only       : cannot generate signals (filter only)

Signal values:
  "BUY"          — open a long position
  "EXIT"         — close existing long position
  "HOLD"         — no action

Usage:
    from strategy.signals import get_signal

    signal = get_signal(df)   # pass DataFrame with st_direction + atr columns
    # returns "BUY" | "EXIT" | "HOLD"
"""

import pandas as pd
from config.settings import settings


def get_signal(df: pd.DataFrame) -> str:
    """
    Detect signal from the last two candles of df.

    Requires columns: st_direction (and optionally atr).
    Returns: "BUY" | "EXIT" | "HOLD"
    """
    if df.empty or len(df) < 2:
        return "HOLD"

    if "st_direction" not in df.columns:
        return "HOLD"

    prev = df.iloc[-2]
    curr = df.iloc[-1]

    prev_dir = prev["st_direction"]
    curr_dir = curr["st_direction"]

    # Supertrend flipped green (bearish → bullish)
    if prev_dir == -1 and curr_dir == 1:
        if settings.use_atr and "atr" in df.columns:
            atr_val = curr["atr"]
            if pd.isna(atr_val) or atr_val < settings.atr_threshold:
                return "HOLD"   # ATR gate blocks entry
        return "BUY"

    # Supertrend flipped red (bullish → bearish)
    if prev_dir == 1 and curr_dir == -1:
        if settings.exit_on_st_red:
            return "EXIT"

    return "HOLD"


def get_direction_label(df: pd.DataFrame) -> str:
    """Returns human-readable current ST direction: 'GREEN' | 'RED' | 'UNKNOWN'"""
    if df.empty or "st_direction" not in df.columns:
        return "UNKNOWN"
    d = df["st_direction"].iloc[-1]
    if d == 1:
        return "GREEN"
    if d == -1:
        return "RED"
    return "UNKNOWN"
