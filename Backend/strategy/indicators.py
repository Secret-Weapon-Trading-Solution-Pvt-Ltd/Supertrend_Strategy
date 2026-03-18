"""
strategy/indicators.py — Supertrend + ATR calculation using pandas_ta.

Usage:
    from strategy.indicators import calculate_supertrend, calculate_atr

    df = kite.get_candles(...)          # DataFrame with open/high/low/close/volume
    df = calculate_supertrend(df)       # adds: supertrend, st_direction columns
    df = calculate_atr(df)              # adds: atr column
"""

import pandas as pd
import pandas_ta as ta

from config.settings import settings


def calculate_supertrend(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute Supertrend and add two columns to df:
      - supertrend   : float  — the Supertrend line value
      - st_direction : int    — +1 = green (bullish), -1 = red (bearish)

    Uses settings: st_length, st_multiplier
    """
    if df.empty or len(df) < settings.st_length + 1:
        df["supertrend"]   = float("nan")
        df["st_direction"] = 0
        return df

    st = ta.supertrend(
        high       = df["high"],
        low        = df["low"],
        close      = df["close"],
        length     = settings.st_length,
        multiplier = settings.st_multiplier,
    )

    # pandas_ta returns columns like:
    #   SUPERT_7_3.0   — the ST line
    #   SUPERTd_7_3.0  — direction: 1 = bullish, -1 = bearish
    st_col  = [c for c in st.columns if c.startswith("SUPERT_")  and "d" not in c][0]
    dir_col = [c for c in st.columns if c.startswith("SUPERTd_")][0]

    df["supertrend"]   = st[st_col]
    df["st_direction"] = st[dir_col]

    return df


def calculate_atr(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute ATR and add column:
      - atr : float — Average True Range value

    Uses settings: atr_period
    """
    if df.empty or len(df) < settings.atr_period + 1:
        df["atr"] = float("nan")
        return df

    df["atr"] = ta.atr(
        high   = df["high"],
        low    = df["low"],
        close  = df["close"],
        length = settings.atr_period,
    )

    return df
