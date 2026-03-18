"""
test_ltp.py — Test live LTP data from Zerodha KiteTicker WebSocket.

Everything (api_key, access_token, instrument tokens) is loaded from the DB.
No hardcoded values.

Run from Backend/:
    python test_ltp.py

Stages:
  1. Load api_key + access_token from accounts table
  2. Verify token with Zerodha profile check
  3. Resolve instrument tokens from instruments table
  4. Connect KiteTicker WebSocket in LTP mode
  5. Print live LTP updates for DURATION seconds, then disconnect
"""

import asyncio
import sys
import time
import threading
from sqlalchemy import select

from models.database import async_session, init_db
from models.account import Account
from models.instrument import Instrument
from kiteconnect import KiteConnect
from kiteconnect.ticker import KiteTicker

PASS = "  [PASS]"
FAIL = "  [FAIL]"
SKIP = "  [SKIP]"
INFO = "  [INFO]"

# Symbols to subscribe — must exist in instruments table
TEST_SYMBOLS = ["INFY", "RELIANCE", "TCS"]

# How long to receive ticks before disconnecting (seconds)
DURATION = 30


async def load_account_and_tokens():
    """Load account and instrument tokens from DB."""
    await init_db()

    # Stage 1: account
    print("\n[Stage 1] Loading api_key + access_token from DB...")
    async with async_session() as db:
        result = await db.execute(
            select(Account).where(
                Account.is_active    == True,
                Account.is_connected == True,
                Account.access_token != None,
            )
        )
        account = result.scalars().first()

    if not account:
        print(FAIL, "No connected account — run test_autologin.py first")
        sys.exit(1)

    api_key      = account.api_key
    access_token = account.access_token
    print(PASS, f"api_key={api_key}  user={account.user_id}  token=...{access_token[-6:]}")

    # Stage 2: verify token
    print("\n[Stage 2] Verifying token with Zerodha...")
    kite = KiteConnect(api_key=api_key)
    kite.set_access_token(access_token)
    try:
        profile = kite.profile()
        print(PASS, f"Authenticated — {profile['user_name']} ({profile['user_id']})")
    except Exception as e:
        print(FAIL, f"Token invalid: {e} — run test_autologin.py first")
        sys.exit(1)

    # Stage 3: instrument tokens
    print("\n[Stage 3] Resolving instrument tokens from DB...")
    tokens: dict[int, str] = {}  # token -> symbol

    async with async_session() as db:
        for symbol in TEST_SYMBOLS:
            result = await db.execute(
                select(Instrument).where(
                    Instrument.tradingsymbol  == symbol,
                    Instrument.exchange       == "NSE",
                    Instrument.instrument_type == "EQ",
                )
            )
            row = result.scalars().first()
            if row:
                tokens[row.instrument_token] = symbol
                print(PASS, f"{symbol:12s} -> token: {row.instrument_token}")
            else:
                print(SKIP, f"{symbol:12s} -> not in DB (run server once to refresh instruments)")

    if not tokens:
        print(FAIL, "No instrument tokens resolved.")
        sys.exit(1)

    return api_key, access_token, tokens


def run_ticker(api_key: str, access_token: str, tokens: dict[int, str]):
    """Connect KiteTicker, subscribe in LTP mode, print ticks for DURATION seconds."""

    print(f"\n[Stage 4] Connecting KiteTicker WebSocket (LTP mode, {DURATION}s)...")

    kws = KiteTicker(api_key, access_token)

    tick_count  = 0
    connected   = threading.Event()
    stop_event  = threading.Event()

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_connect(ws, response):
        connected.set()
        print(PASS, "KiteTicker connected")
        token_list = list(tokens.keys())
        ws.subscribe(token_list)
        ws.set_mode(ws.MODE_LTP, token_list)
        print(INFO, f"Subscribed {len(token_list)} tokens in LTP mode: {token_list}")
        print(f"\n{'-'*60}")
        print(f"  {'Symbol':<12} {'Token':>12} {'LTP':>12}  {'Time'}")
        print(f"{'-'*60}")

    def on_ticks(ws, ticks):
        nonlocal tick_count
        for tick in ticks:
            tick_count += 1
            token  = tick.get("instrument_token")
            ltp    = tick.get("last_price", 0)
            symbol = tokens.get(token, str(token))
            ts     = time.strftime("%H:%M:%S")
            print(f"  {symbol:<12} {token:>12} {ltp:>12.2f}  {ts}")

    def on_close(ws, code, reason):
        print(f"\n{INFO} KiteTicker closed: {code} — {reason}")

    def on_error(ws, code, reason):
        print(f"\n{FAIL} KiteTicker error: {code} — {reason}")

    def on_reconnect(ws, attempt):
        print(f"{INFO} Reconnecting (attempt {attempt})...")

    def on_noreconnect(ws):
        print(f"{FAIL} KiteTicker gave up reconnecting")

    # ── Wire callbacks ─────────────────────────────────────────────────────────
    kws.on_connect     = on_connect
    kws.on_ticks       = on_ticks
    kws.on_close       = on_close
    kws.on_error       = on_error
    kws.on_reconnect   = on_reconnect
    kws.on_noreconnect = on_noreconnect

    # ── Connect in background thread ───────────────────────────────────────────
    kws.connect(threaded=True)

    # Wait for connection (max 10s)
    if not connected.wait(timeout=10):
        print(FAIL, "KiteTicker did not connect within 10 seconds")
        kws.close()
        sys.exit(1)

    # Run for DURATION seconds then disconnect
    print(f"\n{INFO} Receiving ticks for {DURATION} seconds...")
    time.sleep(DURATION)

    print(f"\n{'─'*60}")
    print(f"{INFO} Disconnecting. Total ticks received: {tick_count}")
    kws.close()

    print("\n" + "=" * 60)
    if tick_count > 0:
        print("  LTP TEST PASSED — live data received from Zerodha")
    else:
        print("  LTP TEST FAILED — no ticks received (market may be closed)")
    print("=" * 60 + "\n")

    return tick_count


def main():
    print("\n" + "=" * 60)
    print("  SWTS — Live LTP Fetch Test (KiteTicker WebSocket)")
    print("=" * 60)

    # Run async DB lookups
    api_key, access_token, tokens = asyncio.run(load_account_and_tokens())

    # Run synchronous ticker (KiteTicker uses its own thread)
    run_ticker(api_key, access_token, tokens)


if __name__ == "__main__":
    main()
