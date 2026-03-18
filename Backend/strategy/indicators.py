"""
strategy/indicators.py — Supertrend + ATR calculation using stockstats.

Usage:
    from strategy.indicators import calculate_supertrend, calculate_atr

    df = kite.get_candles(...)          # DataFrame with open/high/low/close/volume
    df = calculate_supertrend(df)       # adds: supertrend, st_direction columns
    df = calculate_atr(df)              # adds: atr column
"""

import pandas as pd
from stockstats import StockDataFrame

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

    # Configure stockstats Supertrend parameters
    StockDataFrame.SUPERTREND_MUL         = settings.st_multiplier
    StockDataFrame.SUPERTREND_EMA_PERIOD  = settings.st_length

    stock = StockDataFrame.retype(df.copy())
    stock["supertrend"]  # trigger calculation — adds supertrend, supertrend_ub, supertrend_lb

    result = df.copy()
    result["supertrend"] = stock["supertrend"].values

    # Derive direction: close above supertrend line = bullish (+1), below = bearish (-1)
    close = df["close"].to_numpy()
    st    = result["supertrend"].to_numpy()
    direction = pd.array(
        [1 if c > s else -1 if c < s else 0 for c, s in zip(close, st)],
        dtype=int,
    )
    result["st_direction"] = direction

    return result


def calculate_atr(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute ATR and add column:
      - atr : float — Average True Range value

    Uses settings: atr_period
    """
    if df.empty or len(df) < settings.atr_period + 1:
        df["atr"] = float("nan")
        return df

    stock = StockDataFrame.retype(df.copy())
    atr_col = f"atr_{settings.atr_period}"
    stock[atr_col]  # trigger calculation

    result = df.copy()
    result["atr"] = stock[atr_col].values
    return result
