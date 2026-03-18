"""
test_candles.py — Test historical candle fetching.

Everything (api_key, access_token, instrument tokens, intervals) is
loaded from the DB — no hardcoded values.

Run from Backend/:
    python test_candles.py

Stages:
  1. Load api_key + access_token from accounts table
  2. Load active intervals from timeframes table
  3. Load instrument tokens for test symbols from instruments table
  4. Fetch & validate candles for each symbol × interval
  5. Print sample output (last 5 candles)
"""

import asyncio
import sys
import traceback
from datetime import datetime, timedelta
from sqlalchemy import select

from models.database import async_session, init_db
from models.account import Account
from models.instrument import Instrument
from models.timeframe import Timeframe
from kiteconnect import KiteConnect

PASS = "  [PASS]"
FAIL = "  [FAIL]"
SKIP = "  [SKIP]"

# Symbols to test — must exist in instruments table
TEST_SYMBOLS = ["INFY", "RELIANCE", "TCS"]

# Only test these intervals (subset of all 8 — keeps test fast)
TEST_INTERVALS = ["5minute", "15minute", "day"]

REQUIRED_COLUMNS = {"open", "high", "low", "close", "volume"}

# How many calendar days to look back per interval to guarantee ~100 candles
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


async def main():
    print("\n" + "=" * 65)
    print("  SWTS — Historical Candles Fetch Test")
    print("=" * 65)

    await init_db()

    # ── Stage 1: api_key + access_token from DB ───────────────
    print("\n[Stage 1] Loading api_key + access_token from DB...")
    api_key = access_token = None

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

    # Init KiteConnect from DB credentials
    kite = KiteConnect(api_key=api_key)
    kite.set_access_token(access_token)

    # Quick profile check
    try:
        profile = kite.profile()
        print(PASS, f"KiteConnect authenticated — {profile['user_name']} ({profile['user_id']})")
    except Exception as e:
        print(FAIL, f"Auth check failed: {e} — run test_autologin.py first")
        sys.exit(1)

    # ── Stage 2: Intervals from timeframes table ──────────────
    print("\n[Stage 2] Loading intervals from timeframes table...")
    db_intervals = []

    async with async_session() as db:
        result = await db.execute(
            select(Timeframe)
            .where(Timeframe.is_active == True)
            .order_by(Timeframe.minutes)
        )
        timeframes = result.scalars().all()

    if not timeframes:
        print(FAIL, "No timeframes in DB — run test_autologin.py / server startup to seed")
        sys.exit(1)

    for tf in timeframes:
        marker = " <-- testing" if tf.interval in TEST_INTERVALS else ""
        print(f"       {tf.interval:12s}  {tf.label}{marker}")
        if tf.interval in TEST_INTERVALS:
            db_intervals.append(tf.interval)

    print(PASS, f"{len(timeframes)} timeframes in DB, testing {len(db_intervals)}: {db_intervals}")

    # ── Stage 3: Instrument tokens from instruments table ─────
    print("\n[Stage 3] Resolving instrument tokens from DB...")
    instruments: dict[str, tuple[int, str]] = {}  # symbol -> (token, name)

    async with async_session() as db:
        for symbol in TEST_SYMBOLS:
            result = await db.execute(
                select(Instrument).where(
                    Instrument.tradingsymbol == symbol,
                    Instrument.exchange      == "NSE",
                    Instrument.instrument_type == "EQ",
                )
            )
            row = result.scalars().first()
            if row:
                instruments[symbol] = (row.instrument_token, row.name)
                print(PASS, f"{symbol:12s} -> token: {row.instrument_token:10d}  {row.name}")
            else:
                print(SKIP, f"{symbol:12s} -> not in DB (instruments may need refresh)")

    if not instruments:
        print(FAIL, "No instruments resolved.")
        print("       Hint: Instruments are refreshed on server startup.")
        print("       Run the server once or call refresh_instruments() manually.")
        sys.exit(1)

    # ── Stage 4: Fetch & validate candles ────────────────────
    print("\n[Stage 4] Fetching candles (api_key + access_token from DB)...")
    all_passed = True

    for symbol, (token, name) in instruments.items():
        for interval in db_intervals:
            try:
                days      = LOOKBACK_DAYS.get(interval, 30)
                to_date   = datetime.now()
                from_date = to_date - timedelta(days=days)

                raw = kite.historical_data(
                    instrument_token = token,
                    from_date        = from_date.strftime("%Y-%m-%d %H:%M:%S"),
                    to_date          = to_date.strftime("%Y-%m-%d %H:%M:%S"),
                    interval         = interval,
                    continuous       = False,
                    oi               = False,
                )

                if not raw:
                    print(FAIL, f"{symbol:12s} {interval:10s} -> empty response")
                    all_passed = False
                    continue

                # Keep last 100 candles
                raw = raw[-100:]

                # Validate all required fields present
                missing = REQUIRED_COLUMNS - set(raw[0].keys())
                if missing:
                    print(FAIL, f"{symbol:12s} {interval:10s} -> missing fields: {missing}")
                    all_passed = False
                    continue

                # Validate OHLC sanity
                bad = [r for r in raw if r["high"] < r["low"]]
                if bad:
                    print(FAIL, f"{symbol:12s} {interval:10s} -> {len(bad)} candles where high < low")
                    all_passed = False
                    continue

                first_ts  = raw[0]["date"].strftime("%Y-%m-%d %H:%M")
                last_ts   = raw[-1]["date"].strftime("%Y-%m-%d %H:%M")
                last_close = raw[-1]["close"]

                print(PASS, f"{symbol:12s} {interval:10s} -> {len(raw):3d} candles "
                            f"| {first_ts} -> {last_ts} "
                            f"| last close: {last_close:.2f}")

            except Exception as e:
                print(FAIL, f"{symbol:12s} {interval:10s} -> {e}")
                traceback.print_exc()
                all_passed = False

    # ── Stage 5: Sample output ────────────────────────────────
    sample_symbol = "INFY" if "INFY" in instruments else list(instruments.keys())[0]
    sample_token, _ = instruments[sample_symbol]
    print(f"\n[Stage 5] Sample — last 5 candles of {sample_symbol} 5minute:")

    try:
        to_date   = datetime.now()
        from_date = to_date - timedelta(days=7)

        raw = kite.historical_data(
            instrument_token = sample_token,
            from_date        = from_date.strftime("%Y-%m-%d %H:%M:%S"),
            to_date          = to_date.strftime("%Y-%m-%d %H:%M:%S"),
            interval         = "5minute",
            continuous       = False,
            oi               = False,
        )
        if raw:
            for r in raw[-5:]:
                print(f"       {r['date'].strftime('%Y-%m-%d %H:%M')}  "
                      f"O:{r['open']:>9.2f}  H:{r['high']:>9.2f}  "
                      f"L:{r['low']:>9.2f}  C:{r['close']:>9.2f}  "
                      f"V:{r['volume']:>10}")
        else:
            print(SKIP, "Empty response")
    except Exception as e:
        print(FAIL, str(e))

    print("\n" + "=" * 65)
    if all_passed:
        print("  ALL CANDLE TESTS PASSED")
    else:
        print("  SOME TESTS FAILED — see above")
    print("=" * 65 + "\n")

    if not all_passed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
