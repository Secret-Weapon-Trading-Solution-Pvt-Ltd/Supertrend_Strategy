"""
backtest.py — Full Supertrend + ATR backtest on RELIANCE 1m (all available history).

- No DB dependency — credentials hardcoded below
- Fetches all available 1m candles from Zerodha (max 60 days)
- Applies Supertrend (length=10, multiplier=3.0) + ATR (period=14, threshold=1.0)
- Simulates trades: BUY on ST flip green + ATR > threshold, EXIT on 5 rules
- Prints full trade log + performance summary

Run from Backend/:
    python backtest.py
"""

import sys
import logging
from datetime import datetime, timedelta

import pandas as pd
from kiteconnect import KiteConnect

from strategy.indicators import calculate_supertrend, calculate_atr
from config.settings import settings

# --- Credentials (no DB needed) ----------------------------------------------
API_KEY      = settings.kite_api_key
ACCESS_TOKEN = "FwZEaPC1YPr0TkvVtI4uXqGowcG1YcJB"

# --- Backtest config ----------------------------------------------------------
SYMBOL   = "RELIANCE"
TOKEN    = 738561          # NSE:RELIANCE instrument token
INTERVAL = "minute"        # 1m
QTY      = 1

# Strategy params (from settings)
ST_LENGTH     = settings.st_length        # 10
ST_MUL        = settings.st_multiplier    # 3.0
ATR_PERIOD    = settings.atr_period       # 14
ATR_THRESHOLD = settings.atr_threshold    # 1.0

# Exit params
TARGET_PTS    = settings.target_value     # 20 points
SL_PTS        = settings.sl_value         # 10 points
TRAIL_PTS     = settings.trail_value      # 5 points
USE_TRAILING  = settings.trailing_sl      # True
EXIT_ON_RED   = settings.exit_on_st_red   # True
SESSION_END   = "15:15"

# Zerodha 1m data: max 60 days back, but each call limited to ~60 days
LOOKBACK_DAYS = 58

# --- Logging ------------------------------------------------------------------
logging.basicConfig(level=logging.WARNING)   # suppress info noise

PASS = "[PASS]"
FAIL = "[FAIL]"
INFO = "[INFO]"
SEP  = "-" * 70


# --- Fetch all 1m candles -----------------------------------------------------

def fetch_all_candles(kite: KiteConnect) -> pd.DataFrame:
    """
    Zerodha limits 1m data to 60 days.
    We fetch in 30-day chunks to be safe and stitch together.
    """
    to_date   = datetime.now()
    from_date = to_date - timedelta(days=LOOKBACK_DAYS)

    all_chunks = []
    chunk_start = from_date
    chunk_size  = timedelta(days=30)

    print(f"\n{INFO} Fetching 1m candles from {from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')}...")

    while chunk_start < to_date:
        chunk_end = min(chunk_start + chunk_size, to_date)
        try:
            raw = kite.historical_data(
                instrument_token = TOKEN,
                from_date        = chunk_start,
                to_date          = chunk_end,
                interval         = INTERVAL,
                continuous       = False,
                oi               = False,
            )
            if raw:
                all_chunks.extend(raw)
                print(f"  Chunk {chunk_start.strftime('%Y-%m-%d')} -> {chunk_end.strftime('%Y-%m-%d')}: {len(raw)} candles")
        except Exception as e:
            print(f"  Chunk error: {e}")
        chunk_start = chunk_end + timedelta(minutes=1)

    if not all_chunks:
        print(FAIL, "No data returned")
        sys.exit(1)

    df = pd.DataFrame(all_chunks)
    df.rename(columns={"date": "timestamp"}, inplace=True)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)
    df = df[~df.index.duplicated(keep="first")].sort_index()

    return df


# --- Backtest engine ----------------------------------------------------------

def run_backtest(df: pd.DataFrame) -> list[dict]:
    """
    Walk candle by candle, apply entry/exit logic.
    Returns list of completed trades.
    """
    trades      = []
    position    = None   # dict when in trade, None when flat
    peak_price  = None

    rows = df[["close", "st_direction", "atr"]].to_dict("index")
    timestamps = list(rows.keys())

    for i in range(1, len(timestamps)):
        ts       = timestamps[i]
        prev_ts  = timestamps[i - 1]
        close    = rows[ts]["close"]
        st_dir   = rows[ts]["st_direction"]
        atr_val  = rows[ts]["atr"]
        prev_dir = rows[prev_ts]["st_direction"]

        time_str = ts.strftime("%H:%M")

        # -- Not in position: check for BUY -----------------------------------
        if position is None:
            # Supertrend flipped green
            if prev_dir != 1 and st_dir == 1:
                # ATR gate
                if pd.isna(atr_val) or atr_val < ATR_THRESHOLD:
                    continue
                position   = {"entry_price": close, "entry_time": ts, "qty": QTY}
                peak_price = close

        # -- In position: update peak + check exits ----------------------------
        else:
            entry = position["entry_price"]

            # Update trailing peak
            if close > peak_price:
                peak_price = close

            exit_reason = None

            # 1. End of session
            if time_str >= SESSION_END:
                exit_reason = "SESSION_END"

            # 2. Fixed stop loss
            elif close <= entry - SL_PTS:
                exit_reason = "STOP_LOSS"

            # 3. Trailing stop loss
            elif USE_TRAILING and close <= peak_price - TRAIL_PTS:
                exit_reason = "TRAILING_SL"

            # 4. Target
            elif close >= entry + TARGET_PTS:
                exit_reason = "TARGET"

            # 5. Supertrend turned red
            elif EXIT_ON_RED and st_dir == -1 and prev_dir == 1:
                exit_reason = "ST_RED"

            if exit_reason:
                pnl_pts = round(close - entry, 2)
                pnl_amt = round(pnl_pts * QTY, 2)
                trades.append({
                    "entry_time":  position["entry_time"],
                    "exit_time":   ts,
                    "entry_price": entry,
                    "exit_price":  close,
                    "pnl_pts":     pnl_pts,
                    "pnl_amt":     pnl_amt,
                    "result":      "WIN" if pnl_pts > 0 else "LOSS",
                    "exit_reason": exit_reason,
                })
                position   = None
                peak_price = None

    return trades


# --- Print results ------------------------------------------------------------

def print_results(trades: list[dict], df: pd.DataFrame):
    if not trades:
        print("\n[!] No trades generated.")
        return

    total     = len(trades)
    wins      = sum(1 for t in trades if t["result"] == "WIN")
    losses    = total - wins
    win_rate  = round(wins / total * 100, 1)
    total_pnl = round(sum(t["pnl_pts"] for t in trades), 2)
    avg_win   = round(sum(t["pnl_pts"] for t in trades if t["result"] == "WIN") / max(wins, 1), 2)
    avg_loss  = round(sum(t["pnl_pts"] for t in trades if t["result"] == "LOSS") / max(losses, 1), 2)
    max_win   = max(t["pnl_pts"] for t in trades)
    max_loss  = min(t["pnl_pts"] for t in trades)

    # Exit reason breakdown
    from collections import Counter
    reason_counts = Counter(t["exit_reason"] for t in trades)

    # Consecutive stats
    max_cons_win = max_cons_loss = cur_win = cur_loss = 0
    for t in trades:
        if t["result"] == "WIN":
            cur_win += 1; cur_loss = 0
        else:
            cur_loss += 1; cur_win = 0
        max_cons_win  = max(max_cons_win,  cur_win)
        max_cons_loss = max(max_cons_loss, cur_loss)

    print(f"\n{'=' * 70}")
    print(f"  BACKTEST RESULTS — {SYMBOL} 1m  |  ST({ST_LENGTH},{ST_MUL}) + ATR({ATR_PERIOD}) threshold={ATR_THRESHOLD}")
    print(f"  Data: {df.index[0].strftime('%Y-%m-%d')} -> {df.index[-1].strftime('%Y-%m-%d')}  |  {len(df):,} candles")
    print(f"{'=' * 70}")
    print(f"\n  {'Total Trades':<25} {total}")
    print(f"  {'Wins':<25} {wins}  ({win_rate}%)")
    print(f"  {'Losses':<25} {losses}")
    print(f"  {'Total P&L (points)':<25} {total_pnl:+.2f}")
    print(f"  {'Avg Win':<25} {avg_win:+.2f} pts")
    print(f"  {'Avg Loss':<25} {avg_loss:+.2f} pts")
    print(f"  {'Max Win':<25} {max_win:+.2f} pts")
    print(f"  {'Max Loss':<25} {max_loss:+.2f} pts")
    print(f"  {'Max Consec. Wins':<25} {max_cons_win}")
    print(f"  {'Max Consec. Losses':<25} {max_cons_loss}")

    print(f"\n  Exit Reason Breakdown:")
    for reason, count in reason_counts.most_common():
        pct = round(count / total * 100, 1)
        print(f"    {reason:<20} {count:>4}  ({pct}%)")

    print(f"\n{SEP}")
    print(f"  {'#':<5} {'Entry Time':<18} {'Exit Time':<18} {'Entry':>8} {'Exit':>8} {'P&L':>8} {'Result':<8} {'Exit Reason'}")
    print(SEP)

    for i, t in enumerate(trades, 1):
        pnl_str    = f"{t['pnl_pts']:+.2f}"
        result_sym = "+" if t["result"] == "WIN" else "-"
        print(f"  {i:<5} {t['entry_time'].strftime('%m-%d %H:%M'):<18} "
              f"{t['exit_time'].strftime('%m-%d %H:%M'):<18} "
              f"{t['entry_price']:>8.2f} {t['exit_price']:>8.2f} "
              f"{pnl_str:>8}  {result_sym:<7}  {t['exit_reason']}")

    print(f"{'=' * 70}\n")


# --- Main ---------------------------------------------------------------------

def main():
    print(f"\n{'=' * 70}")
    print(f"  SWTS Backtest — {SYMBOL} 1m — Supertrend + ATR")
    print(f"{'=' * 70}")

    # Connect to Kite
    kite = KiteConnect(api_key=API_KEY)
    kite.set_access_token(ACCESS_TOKEN)

    try:
        profile = kite.profile()
        print(f"\n{PASS} Connected: {profile['user_name']} ({profile['user_id']})")
    except Exception as e:
        print(f"{FAIL} Auth failed: {e}")
        sys.exit(1)

    # Fetch all 1m data
    df = fetch_all_candles(kite)
    print(f"\n{PASS} Total candles fetched: {len(df):,}")
    print(f"     Range : {df.index[0].strftime('%Y-%m-%d %H:%M')} -> {df.index[-1].strftime('%Y-%m-%d %H:%M')}")
    print(f"     Last close : {df['close'].iloc[-1]:.2f}")

    # Apply indicators
    print(f"\n{INFO} Applying Supertrend(len={ST_LENGTH}, mul={ST_MUL}) + ATR(period={ATR_PERIOD})...")
    df = calculate_supertrend(df)
    df = calculate_atr(df)

    valid = df["st_direction"].ne(0).sum()
    print(f"{PASS} Indicators applied — {valid:,} candles with valid Supertrend direction")

    # Run backtest
    print(f"\n{INFO} Running backtest (ATR threshold={ATR_THRESHOLD}, target={TARGET_PTS}pts, SL={SL_PTS}pts, trail={TRAIL_PTS}pts)...")
    trades = run_backtest(df)
    print(f"{PASS} Backtest complete — {len(trades)} trades")

    # Print results
    print_results(trades, df)


if __name__ == "__main__":
    main()
