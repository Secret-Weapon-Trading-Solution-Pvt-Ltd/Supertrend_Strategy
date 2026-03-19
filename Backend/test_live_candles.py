"""
test_live_candles.py — Continuously fetch and print latest candles from Zerodha every 1s.

Shows the last N candles on each fetch so you can see:
  - When a new candle appears (timestamp changes)
  - How close/high/low/volume update on the forming candle

Usage:
  python test_live_candles.py
  python test_live_candles.py --symbol RELIANCE --token 738561 --interval minute --count 5
"""

import argparse
import time
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import psycopg2
from config.settings import settings
from broker.zerodha import ZerodhaBroker


# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--symbol",   default="RELIANCE", help="Symbol name (display only)")
parser.add_argument("--token",    default=738561,      type=int, help="Instrument token")
parser.add_argument("--interval", default="minute",    help="Candle interval")
parser.add_argument("--count",    default=5,           type=int, help="Candles to show per fetch")
args = parser.parse_args()


# ── Load access token from DB ─────────────────────────────────────────────────
def load_access_token():
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
        print("ERROR: No active account in DB. Login at http://localhost:8000 first.")
        sys.exit(1)
    return row


access_token, user_id = load_access_token()
print(f"Logged in as : {user_id}")
print(f"Symbol       : {args.symbol}  |  Token: {args.token}")
print(f"Interval     : {args.interval}  |  Showing last {args.count} candles")
print(f"{'─'*72}")
print(f"  {'Timestamp':<22} {'Open':>9} {'High':>9} {'Low':>9} {'Close':>9} {'Volume':>10}")
print(f"{'─'*72}")

broker = ZerodhaBroker()
broker.set_access_token(access_token)

prev_ts   = None
iteration = 0

while True:
    iteration += 1
    try:
        df = broker.get_candles(
            instrument_token = args.token,
            interval         = args.interval,
            candle_count     = args.count,
        )

        if df.empty:
            print(f"  [{iteration:04d}] No data returned")
            time.sleep(1)
            continue

        latest_ts  = df.index[-1]
        new_candle = (prev_ts is not None and latest_ts != prev_ts)
        prev_ts    = latest_ts

        # Print header for each iteration
        tag = "  << NEW CANDLE" if new_candle else ""
        print(f"\n  [fetch #{iteration}]{tag}")

        for ts, row in df.iterrows():
            marker = "  <-- latest" if ts == latest_ts else ""
            print(
                f"  {str(ts):<22}"
                f" {row['open']:>9.2f}"
                f" {row['high']:>9.2f}"
                f" {row['low']:>9.2f}"
                f" {row['close']:>9.2f}"
                f" {int(row['volume']):>10}"
                f"{marker}"
            )

    except Exception as e:
        print(f"  [{iteration:04d}] ERROR: {e}")

    time.sleep(1)
