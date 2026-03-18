"""
test_supertrend.py — Live Supertrend signal test.

Polls kite.historical_data() every 1 second, runs Supertrend + ATR,
prints the latest signal in real time.

Run from Backend/:
    python test_supertrend.py

Press Ctrl+C to stop.
"""

import asyncio
import sys
import time
from sqlalchemy import select

from models.database import async_session, init_db
from models.account import Account
from models.instrument import Instrument
from broker.zerodha import ZerodhaBroker

from strategy.indicators import calculate_supertrend, calculate_atr
from strategy.signals import get_signal, get_direction_label
from config.settings import settings

PASS = "  [PASS]"
FAIL = "  [FAIL]"

# Symbol to track
SYMBOL   = "INFY"
EXCHANGE = "NSE"
INTERVAL = "minute"    # 1 minute candles

# How many candles to fetch (ZerodhaBroker.get_candles handles lookback automatically)
CANDLE_COUNT = 100


async def setup():
    """Load credentials and instrument token from DB."""
    await init_db()

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

    broker = ZerodhaBroker()
    broker.set_access_token(account.access_token)

    # Verify token
    profile = broker.kite.profile()
    print(PASS, f"Authenticated — {profile['user_name']} ({profile['user_id']})")

    # Resolve instrument token
    async with async_session() as db:
        result = await db.execute(
            select(Instrument).where(
                Instrument.tradingsymbol   == SYMBOL,
                Instrument.exchange        == EXCHANGE,
                Instrument.instrument_type == "EQ",
            )
        )
        row = result.scalars().first()

    if not row:
        print(FAIL, f"{SYMBOL} not in instruments DB — run server once to refresh")
        sys.exit(1)

    print(PASS, f"{SYMBOL} token: {row.instrument_token}")
    return broker, row.instrument_token


def fetch_and_analyse(broker: ZerodhaBroker, token: int) -> dict:  # noqa
    """Fetch latest 100 candles via ZerodhaBroker, run ST + ATR, return result dict."""
    df = broker.get_candles(token, INTERVAL, candle_count=CANDLE_COUNT)

    if df.empty:
        return {"error": "empty response"}

    # Run indicators
    if settings.use_supertrend:
        df = calculate_supertrend(df)
    if settings.use_atr:
        df = calculate_atr(df)

    signal    = get_signal(df)
    direction = get_direction_label(df)

    last = df.iloc[-1]
    return {
        "time"      : df.index[-1].strftime("%H:%M:%S"),
        "close"     : last["close"],
        "supertrend": round(last.get("supertrend", float("nan")), 2),
        "atr"       : round(last.get("atr", float("nan")), 2),
        "direction" : direction,
        "signal"    : signal,
        "candles"   : len(df),
    }


def main():
    print("\n" + "=" * 65)
    print(f"  SWTS — Live Supertrend  |  {SYMBOL}  |  {INTERVAL}")
    print(f"  ST: length={settings.st_length}  multiplier={settings.st_multiplier}")
    print(f"  ATR: period={settings.atr_period}  threshold={settings.atr_threshold}")
    print("=" * 65)

    broker, token = asyncio.run(setup())

    print(f"\n  Polling every 1s — Press Ctrl+C to stop\n")
    print(f"  {'Time':<10} {'Close':>10} {'SuperTrend':>12} {'ATR':>8} {'Dir':<8} {'Signal'}")
    print(f"  {'-'*65}")

    prev_signal = "HOLD"

    while True:
        try:
            r = fetch_and_analyse(broker, token)

            if "error" in r:
                print(f"  [WARN] {r['error']}")
            else:
                signal = r["signal"]

                # Highlight BUY/EXIT signals
                tag = ""
                if signal == "BUY":
                    tag = "  <<< BUY"
                elif signal == "EXIT":
                    tag = "  <<< EXIT"

                print(
                    f"  {r['time']:<10} "
                    f"{r['close']:>10.2f} "
                    f"{r['supertrend']:>12.2f} "
                    f"{r['atr']:>8.2f} "
                    f"{r['direction']:<8} "
                    f"{signal}{tag}"
                )

            time.sleep(1)

        except KeyboardInterrupt:
            print("\n\n  Stopped.\n")
            break
        except Exception as e:
            print(f"  [ERR] {e}")
            time.sleep(1)


if __name__ == "__main__":
    main()
