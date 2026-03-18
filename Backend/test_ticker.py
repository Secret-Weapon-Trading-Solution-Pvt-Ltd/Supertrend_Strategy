"""
test_ticker.py — Test KiteTicker WebSocket live data.

Connects to Zerodha WebSocket, subscribes to a symbol, and prints
live ticks for 30 seconds then disconnects.

Usage:
    python test_ticker.py                   # default: RELIANCE, FULL mode
    python test_ticker.py INFY              # custom symbol
    python test_ticker.py INFY LTP          # custom symbol + mode (LTP | QUOTE | FULL)
"""

import sys
import time
import asyncio
import logging
from sqlalchemy import select

from kiteconnect import KiteTicker
from models.database import async_session, init_db
from models.account import Account
from models.instrument import Instrument
from config.settings import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s — %(message)s")
log = logging.getLogger(__name__)


async def get_access_token_and_token(symbol: str, exchange: str):
    """Fetch access_token and instrument_token from DB."""
    async with async_session() as db:

        # access_token from accounts table
        result = await db.execute(
            select(Account).where(
                Account.is_active    == True,
                Account.is_connected == True,
                Account.access_token != None,
            )
        )
        account = result.scalars().first()
        if not account:
            raise RuntimeError("No connected account in DB. Run test_autologin.py first.")

        # instrument_token from instruments table
        result = await db.execute(
            select(Instrument).where(
                Instrument.tradingsymbol == symbol.upper(),
                Instrument.exchange      == exchange.upper(),
            )
        )
        instrument = result.scalars().first()
        if not instrument:
            raise ValueError(f"{symbol} not found on {exchange} in instruments table.")

        return account.access_token, instrument.instrument_token


def main():
    symbol   = sys.argv[1] if len(sys.argv) > 1 else "RELIANCE"
    exchange = sys.argv[2].upper() if len(sys.argv) > 2 else "NSE"
    mode_arg = sys.argv[3].upper() if len(sys.argv) > 3 else "FULL"
    duration = 30   # seconds to listen

    print(f"\n{'='*55}")
    print(f"  Symbol   : {exchange}:{symbol}")
    print(f"  Mode     : {mode_arg}")
    print(f"  Duration : {duration} seconds")
    print(f"{'='*55}\n")

    # ── Step 1: Get credentials from DB ──────────────────────────────────────
    print("Step 1: Loading access_token and instrument_token from DB...")

    async def setup():
        await init_db()
        return await get_access_token_and_token(symbol, exchange)

    access_token, instrument_token = asyncio.run(setup())
    print(f"  access_token    : {access_token[:10]}...{access_token[-6:]}")
    print(f"  instrument_token: {instrument_token}\n")

    # ── Step 2: Map mode string to KiteTicker constant ────────────────────────
    ticker = KiteTicker(settings.kite_api_key, access_token)

    MODE_MAP = {
        "LTP":   ticker.MODE_LTP,
        "QUOTE": ticker.MODE_QUOTE,
        "FULL":  ticker.MODE_FULL,
    }
    if mode_arg not in MODE_MAP:
        print(f"  Invalid mode '{mode_arg}'. Use: LTP | QUOTE | FULL")
        sys.exit(1)
    mode = MODE_MAP[mode_arg]

    tick_count = [0]

    # ── Step 3: Define WebSocket callbacks ────────────────────────────────────
    def on_connect(ws, response):
        print(f"Step 3: WebSocket connected. Subscribing to token={instrument_token}...\n")
        ws.subscribe([instrument_token])
        ws.set_mode(mode, [instrument_token])

    def on_ticks(ws, ticks):
        for tick in ticks:
            tick_count[0] += 1
            token = tick.get("instrument_token")
            ltp   = tick.get("last_price")

            if mode_arg == "LTP":
                print(f"  [{tick_count[0]:>4}] token={token} | LTP={ltp}")

            elif mode_arg == "QUOTE":
                print(
                    f"  [{tick_count[0]:>4}] token={token} | LTP={ltp} | "
                    f"O={tick.get('ohlc',{}).get('open')} "
                    f"H={tick.get('ohlc',{}).get('high')} "
                    f"L={tick.get('ohlc',{}).get('low')} "
                    f"C={tick.get('ohlc',{}).get('close')} | "
                    f"Vol={tick.get('volume_traded')}"
                )

            elif mode_arg == "FULL":
                print(
                    f"  [{tick_count[0]:>4}] token={token} | LTP={ltp} | "
                    f"O={tick.get('ohlc',{}).get('open')} "
                    f"H={tick.get('ohlc',{}).get('high')} "
                    f"L={tick.get('ohlc',{}).get('low')} "
                    f"C={tick.get('ohlc',{}).get('close')} | "
                    f"Vol={tick.get('volume_traded')} | "
                    f"OI={tick.get('oi')} | "
                    f"Buy={tick.get('total_buy_quantity')} "
                    f"Sell={tick.get('total_sell_quantity')}"
                )

    def on_close(ws, code, reason):
        print(f"\n  WebSocket closed: code={code} reason={reason}")

    def on_error(ws, code, reason):
        print(f"\n  WebSocket error: code={code} reason={reason}")

    def on_reconnect(ws, attempts):
        print(f"  Reconnecting... attempt {attempts}")

    # ── Step 4: Connect and listen ────────────────────────────────────────────
    ticker.on_connect   = on_connect
    ticker.on_ticks     = on_ticks
    ticker.on_close     = on_close
    ticker.on_error     = on_error
    ticker.on_reconnect = on_reconnect

    print(f"Step 2: Connecting to KiteTicker WebSocket...")
    ticker.connect(threaded=True)

    print(f"  Listening for {duration} seconds... (Ctrl+C to stop early)\n")
    try:
        time.sleep(duration)
    except KeyboardInterrupt:
        pass

    # ── Step 5: Results ───────────────────────────────────────────────────────
    ticker.close()
    print(f"\n{'='*55}")
    print(f"  Total ticks received : {tick_count[0]}")
    if tick_count[0] > 0:
        print(f"  TEST PASSED — live data is working")
    else:
        print(f"  No ticks received — market may be closed (ticks only arrive during trading hours 9:15–15:30 IST)")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
