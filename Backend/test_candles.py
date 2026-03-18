"""
test_candles.py — Test historical candle fetch using data stored in PostgreSQL.

Reads from DB:
  accounts    → access_token  (set after login)
  instruments → instrument_token  (by symbol + exchange)
  timeframes  → validates the interval is a known Kite interval

Usage:
    python test_candles.py                          # defaults: RELIANCE, 5minute, 100 candles
    python test_candles.py INFY 15minute
    python test_candles.py HDFCBANK day 50
"""

import sys
import asyncio
import logging
from datetime import datetime, timedelta

from kiteconnect import KiteConnect
from sqlalchemy import select

from models.database import async_session
from models.account import Account
from models.instrument import Instrument
from models.timeframe import Timeframe

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s — %(message)s")
log = logging.getLogger(__name__)

# How many calendar days to go back per interval to guarantee 100 trading candles
LOOKBACK_DAYS = {
    "minute":   5,
    "3minute":  5,
    "5minute":  7,
    "10minute": 10,
    "15minute": 10,
    "30minute": 15,
    "60minute": 30,
    "day":      150,
}


async def get_account(db) -> Account:
    """Fetch api_key + access_token from the first active connected account in DB."""
    result = await db.execute(
        select(Account).where(
            Account.is_active    == True,
            Account.is_connected == True,
            Account.access_token != None,
        )
    )
    account = result.scalars().first()
    if not account:
        raise RuntimeError(
            "No connected account found in DB.\n"
            "Fix: Run the app, login via Zerodha, then re-run this test."
        )
    log.info("Using account: %s (%s) | api_key: %s", account.label, account.user_id, account.api_key)
    return account


async def get_instrument_token(db, symbol: str, exchange: str) -> int:
    """Fetch instrument_token from instruments table by tradingsymbol + exchange."""
    result = await db.execute(
        select(Instrument).where(
            Instrument.tradingsymbol == symbol.upper(),
            Instrument.exchange      == exchange.upper(),
        )
    )
    instrument = result.scalars().first()
    if not instrument:
        raise ValueError(
            f"Symbol '{symbol}' not found on {exchange} in instruments table.\n"
            "Fix: Instruments table may be empty — run refresh_instruments() first."
        )
    log.info("Instrument: %s | token=%s | type=%s", instrument.tradingsymbol,
             instrument.instrument_token, instrument.instrument_type)
    return instrument.instrument_token


async def validate_interval(db, interval: str) -> None:
    """Check the requested interval exists in the timeframes table."""
    result = await db.execute(
        select(Timeframe).where(
            Timeframe.interval  == interval,
            Timeframe.is_active == True,
        )
    )
    tf = result.scalars().first()
    if not tf:
        # Fetch all valid intervals to show in error
        all_tf = await db.execute(select(Timeframe).where(Timeframe.is_active == True))
        valid = [r.interval for r in all_tf.scalars().all()]
        raise ValueError(f"Interval '{interval}' not found in timeframes table.\nValid: {valid}")
    log.info("Interval: %s (%s)", tf.interval, tf.label)


async def main():
    symbol       = sys.argv[1] if len(sys.argv) > 1 else "RELIANCE"
    interval     = sys.argv[2] if len(sys.argv) > 2 else "5minute"
    candle_count = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    exchange     = "NSE"

    print(f"\n{'='*55}")
    print(f"  Symbol   : {exchange}:{symbol}")
    print(f"  Interval : {interval}")
    print(f"  Candles  : {candle_count}")
    print(f"{'='*55}\n")

    from models.database import init_db
    await init_db()

    async with async_session() as db:

        # Step 1: Get api_key + access_token from accounts table
        print("Step 1: Loading api_key + access_token from DB (accounts table)...")
        account = await get_account(db)
        print("  Done.\n")

        # Step 2: Validate interval against timeframes table
        print("Step 2: Validating interval against timeframes table...")
        await validate_interval(db, interval)
        print("  Done.\n")

        # Step 3: Get instrument_token from instruments table
        print(f"Step 3: Fetching instrument_token for {exchange}:{symbol}...")
        instrument_token = await get_instrument_token(db, symbol, exchange)
        print(f"  instrument_token = {instrument_token}\n")

    # Step 4: Set api_key + access_token from DB on KiteConnect and fetch candles
    print("Step 4: Fetching historical candles from Zerodha...")
    kite = KiteConnect(api_key=account.api_key)
    kite.set_access_token(account.access_token)

    days      = LOOKBACK_DAYS.get(interval, 30)
    to_date   = datetime.now()
    from_date = to_date - timedelta(days=days)

    log.info("Date range: %s → %s", from_date.strftime("%Y-%m-%d"), to_date.strftime("%Y-%m-%d"))

    raw = kite.historical_data(
        instrument_token = instrument_token,
        from_date        = from_date,
        to_date          = to_date,
        interval         = interval,
        continuous       = False,
        oi               = False,
    )

    if not raw:
        print("  ERROR: No data returned. Market may be closed or token is invalid.")
        sys.exit(1)

    # Step 5: Convert to readable output
    import pandas as pd
    df = pd.DataFrame(raw)
    df.rename(columns={"date": "timestamp"}, inplace=True)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)
    df = df.tail(candle_count)

    # Step 6: Print results
    print(f"\n  Total rows returned : {len(raw)}")
    print(f"  After tail({candle_count})    : {len(df)}")
    print(f"  Columns             : {list(df.columns)}")
    print(f"  From                : {df.index[0]}")
    print(f"  To                  : {df.index[-1]}")
    print(f"\n--- First 3 candles ---")
    print(df.head(3).to_string())
    print(f"\n--- Last 3 candles ---")
    print(df.tail(3).to_string())
    print(f"\n{'='*55}")
    print("  TEST PASSED")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    asyncio.run(main())
