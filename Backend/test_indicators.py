"""
test_indicators.py — Test candle fetch + indicator calculation.

Tests:
  1. Fetch 100 candles from Zerodha for a given symbol + interval
  2. Calculate Supertrend + ATR on fetched candles
  3. Print latest values
  4. Continuous mode — repeat every 1s to verify live updates

Usage:
  python test_indicators.py                      # single fetch
  python test_indicators.py --live               # continuous every 1s
  python test_indicators.py --symbol INFY --interval 5minute --live
"""

import argparse
import time
import sys
import os

# ── Make sure Backend modules are importable ──────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from broker.zerodha import ZerodhaBroker
from strategy.indicators import calculate_supertrend, calculate_atr
from strategy.signals import get_signal, get_direction_label
from config.settings import settings
import zeroda


# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--symbol",   default="INFY",     help="Trading symbol (default: INFY)")
parser.add_argument("--interval", default="5minute",  help="Candle interval (default: 5minute)")
parser.add_argument("--token",    default=408065,     type=int, help="Instrument token (default: INFY=408065)")
parser.add_argument("--live",     action="store_true", help="Continuous mode — repeat every 1s")
args = parser.parse_args()


def fetch_and_calculate():
    """Fetch candles, calculate indicators, print latest values."""

    broker = ZerodhaBroker()

    # ── Fetch access token from PostgreSQL ────────────────────────────────────
    try:
        import psycopg2
        conn = psycopg2.connect(settings.database_url.replace("+asyncpg", ""))
        cur  = conn.cursor()
        cur.execute("""
            SELECT access_token, user_id FROM accounts
            WHERE is_active = true AND is_connected = true AND access_token IS NOT NULL
            ORDER BY last_login_at DESC NULLS LAST
            LIMIT 1
        """)
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            print("ERROR: No active account with access_token found in DB.")
            print("       Login via http://localhost:8000 first.")
            sys.exit(1)

        access_token, user_id = row
        print(f"Token loaded from DB — user: {user_id}")
        broker.set_access_token(access_token)
        zeroda.kite.set_access_token(access_token)

    except Exception as e:
        print(f"ERROR fetching token from DB: {e}")
        sys.exit(1)

    # ── Fetch candles ─────────────────────────────────────────────────────────
    print(f"\nFetching candles: {args.symbol} [{args.interval}] token={args.token}")
    df = broker.get_candles(
        instrument_token = args.token,
        interval         = args.interval,
        candle_count     = 100,
    )

    if df.empty:
        print("ERROR: No candles returned. Market may be closed or token is wrong.")
        return

    print(f"Got {len(df)} candles  |  from {df.index[0]}  to  {df.index[-1]}")

    # ── Calculate Supertrend ──────────────────────────────────────────────────
    df = calculate_supertrend(df)
    df = calculate_atr(df)

    # ── Latest values ─────────────────────────────────────────────────────────
    last      = df.iloc[-1]
    close     = round(float(last["close"]), 2)
    st_val    = round(float(last.get("supertrend", float("nan"))), 2) if "supertrend" in df.columns else None
    atr_val   = round(float(last.get("atr", 0.0)), 2)                if "atr"        in df.columns else None
    direction = get_direction_label(df)
    signal    = get_signal(df)

    # ── Print ─────────────────────────────────────────────────────────────────
    ts = df.index[-1].strftime("%Y-%m-%d %H:%M:%S")

    print(f"\n{'-'*50}")
    print(f"  Symbol    : {args.symbol}")
    print(f"  Interval  : {args.interval}")
    print(f"  Timestamp : {ts}")
    print(f"  Close     : {close}")
    print(f"  Supertrend: {st_val}  ({direction})")
    print(f"  ATR       : {atr_val}")
    print(f"  Signal    : {signal}")
    print(f"{'─'*50}")

    return True


# ── Main ──────────────────────────────────────────────────────────────────────
if args.live:
    print(f"LIVE MODE — fetching every 1s  (Ctrl+C to stop)")
    iteration = 0
    while True:
        iteration += 1
        print(f"\n[Iteration {iteration}]", end="")
        try:
            fetch_and_calculate()
        except Exception as e:
            print(f"  ERROR: {e}")
        time.sleep(1)
else:
    fetch_and_calculate()
