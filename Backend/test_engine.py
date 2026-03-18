"""
test_engine.py — Test signal generation + order placement for RELIANCE 1m.

What this tests:
  1. Load access_token from DB
  2. Fetch 100 candles for RELIANCE (1m) via ZerodhaBroker
  3. Run Supertrend + ATR indicators
  4. Check if a BUY signal is generated
  5. Simulate a BUY order via ForwardTestBroker
  6. Run a second tick to verify position is tracked
  7. Force an EXIT to verify SELL order + P&L calculation

No real orders are placed — ForwardTestBroker handles everything in memory.

Run from Backend/:
    python test_engine.py
"""

import asyncio
import sys
import logging
from datetime import datetime
from sqlalchemy import select

# ── Patch event_bus before importing engine ───────────────────────────────────
# The engine calls emit_sync() which needs a running Socket.IO loop.
# In this test we just print the events instead.
import events.event_bus as _eb

_emitted: list[dict] = []

def _mock_emit_sync(event: str, data: dict):
    _emitted.append({"event": event, "data": data})
    print(f"  [EMIT] {event:25s} -> {data}")

_eb.emit_sync = _mock_emit_sync

# ── Patch save_trade_sync before importing engine ────────────────────────────
import models.trade as _trade

def _mock_save_trade_sync(data: dict):
    print(f"  [DB SAVE] trade -> {data}")

_trade.save_trade_sync = _mock_save_trade_sync

# ── Now safe to import engine ─────────────────────────────────────────────────
from models.database import async_session, init_db
from models.account import Account
from models.instrument import Instrument
from broker.zerodha import ZerodhaBroker
from broker.forward_test import ForwardTestBroker
from strategy.indicators import calculate_supertrend, calculate_atr
from strategy.signals import get_signal
from engine.trading_engine import TradingEngine
from config.settings import settings

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("test_engine")

PASS = "  [PASS]"
FAIL = "  [FAIL]"
INFO = "  [INFO]"

SYMBOL   = "RELIANCE"
INTERVAL = "minute"          # Zerodha's name for 1-minute candles
QTY      = 1


async def load_credentials() -> tuple[str, str]:
    """Load api_key + access_token from DB."""
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
        print(FAIL, "No connected account in DB — run auto-login first")
        sys.exit(1)

    return account.api_key, account.access_token


async def load_instrument_token(symbol: str) -> int:
    """Load instrument token for a symbol from DB."""
    async with async_session() as db:
        result = await db.execute(
            select(Instrument).where(
                Instrument.tradingsymbol  == symbol,
                Instrument.exchange       == "NSE",
                Instrument.instrument_type == "EQ",
            )
        )
        row = result.scalars().first()

    if not row:
        print(FAIL, f"{symbol} not found in instruments table")
        sys.exit(1)

    return row.instrument_token


async def main():
    print("\n" + "=" * 65)
    print("  SWTS — Engine Signal + Order Test  |  RELIANCE  1m")
    print("=" * 65)

    await init_db()

    # ── Step 1: Credentials ───────────────────────────────────────────────────
    print("\n[Step 1] Loading credentials from DB...")
    api_key, access_token = await load_credentials()
    print(PASS, f"api_key={api_key}  token=...{access_token[-6:]}")

    # ── Step 2: Instrument token ──────────────────────────────────────────────
    print(f"\n[Step 2] Resolving {SYMBOL} instrument token...")
    token = await load_instrument_token(SYMBOL)
    print(PASS, f"{SYMBOL} -> token: {token}")

    # ── Step 3: Setup broker ──────────────────────────────────────────────────
    print("\n[Step 3] Setting up brokers...")
    real_broker = ZerodhaBroker()
    real_broker.set_access_token(access_token)
    broker = ForwardTestBroker(zerodha_broker=real_broker)
    print(PASS, "ZerodhaBroker + ForwardTestBroker ready")

    # ── Step 4: Fetch candles ─────────────────────────────────────────────────
    print(f"\n[Step 4] Fetching 100 candles for {SYMBOL} [{INTERVAL}]...")
    df = broker.get_candles(
        instrument_token = token,
        interval         = INTERVAL,
        candle_count     = 100,
    )

    if df.empty:
        print(FAIL, "No candles returned — market may be closed or token invalid")
        sys.exit(1)

    print(PASS, f"Got {len(df)} candles  |  last close: {df['close'].iloc[-1]:.2f}")
    print(INFO, f"Range: {df.index[0].strftime('%Y-%m-%d %H:%M')} -> {df.index[-1].strftime('%Y-%m-%d %H:%M')}")

    # Last 3 candles preview
    print(f"\n       {'Timestamp':<20} {'Open':>9} {'High':>9} {'Low':>9} {'Close':>9} {'Vol':>10}")
    for ts, row in df.tail(3).iterrows():
        print(f"       {str(ts)[:19]:<20} {row['open']:>9.2f} {row['high']:>9.2f} "
              f"{row['low']:>9.2f} {row['close']:>9.2f} {int(row['volume']):>10}")

    # ── Step 5: Run indicators ────────────────────────────────────────────────
    print(f"\n[Step 5] Running Supertrend (len={settings.st_length}, mul={settings.st_multiplier}) + ATR (period={settings.atr_period})...")
    df = calculate_supertrend(df)
    df = calculate_atr(df)

    last = df.iloc[-1]
    prev = df.iloc[-2]

    st_val  = round(float(last["supertrend"]), 2)
    st_dir  = int(last["st_direction"])
    atr_val = round(float(last["atr"]), 2) if "atr" in df.columns else None
    close   = round(float(last["close"]), 2)
    direction = "GREEN (+1)" if st_dir == 1 else "RED (-1)" if st_dir == -1 else "NEUTRAL"

    print(PASS, f"close={close}  |  supertrend={st_val}  |  direction={direction}  |  atr={atr_val}")
    print(INFO, f"prev direction={int(prev['st_direction'])}  ->  curr direction={st_dir}")

    # ── Step 6: Signal check ──────────────────────────────────────────────────
    print(f"\n[Step 6] Checking signal from last 2 candles...")
    signal = get_signal(df)
    print(f"  Signal -> {signal}")

    if signal == "BUY":
        print(PASS, "BUY signal detected — Supertrend flipped GREEN")
    elif signal == "EXIT":
        print(INFO, "EXIT signal detected — Supertrend flipped RED")
    else:
        print(INFO, "HOLD — no flip on last candle (this is normal outside of a flip)")
        print(INFO, "Forcing a simulated BUY to test order flow...")

    # ── Step 7: Simulate BUY order ────────────────────────────────────────────
    print(f"\n[Step 7] Placing simulated BUY order ({SYMBOL} qty={QTY} @ {close})...")
    order_id = broker.place_order(
        symbol           = SYMBOL,
        token            = token,
        qty              = QTY,
        transaction_type = "BUY",
        product          = "MIS",
        order_type       = "MARKET",
        price            = close,
    )
    print(PASS, f"BUY order placed  |  order_id={order_id}")

    positions = broker.get_positions()
    if not positions:
        print(FAIL, "No position opened after BUY")
        sys.exit(1)

    pos = positions[0]
    print(PASS, f"Position open  |  entry={pos['entry_price']}  qty={pos['qty']}  peak={pos['peak_price']}")

    # ── Step 8: Simulate price move + SELL ────────────────────────────────────
    simulated_exit_price = round(close + 15.0, 2)   # simulate +15 points profit
    print(f"\n[Step 8] Simulating price move to {simulated_exit_price} (target hit) -> SELL order...")

    sell_id = broker.place_order(
        symbol           = SYMBOL,
        token            = token,
        qty              = QTY,
        transaction_type = "SELL",
        product          = "MIS",
        order_type       = "MARKET",
        price            = simulated_exit_price,
    )
    print(PASS, f"SELL order placed  |  order_id={sell_id}")

    positions = broker.get_positions()
    if positions:
        print(FAIL, "Position still open after SELL — something went wrong")
    else:
        print(PASS, "Position closed successfully")

    # ── Step 9: Trade summary ─────────────────────────────────────────────────
    print(f"\n[Step 9] Trade summary:")
    summary = broker.summary()
    print(f"  total_trades : {summary['total_trades']}")
    print(f"  total_pnl    : {summary['total_pnl']}")
    print(f"  wins         : {summary['wins']}")
    print(f"  losses       : {summary['losses']}")

    for t in summary.get("trades", []):
        result_label = "PROFIT" if t["pnl"] >= 0 else "LOSS"
        print(f"  {t['symbol']}  entry={t['entry_price']}  exit={t['exit_price']}  "
              f"pnl={t['pnl']:+.2f}  [{result_label}]")

    # ── Step 10: Full engine _tick() test ─────────────────────────────────────
    print(f"\n[Step 10] Running full TradingEngine._tick() (fresh broker, real candles)...")
    fresh_broker = ForwardTestBroker(zerodha_broker=real_broker)
    engine = TradingEngine(
        broker           = fresh_broker,
        instrument_token = token,
        symbol           = SYMBOL,
        qty              = QTY,
        interval         = INTERVAL,
        candle_count     = 100,
    )

    print(INFO, "Calling engine._tick() once — watch for EMIT lines above...")
    _emitted.clear()
    engine._tick()

    tick_events = [e["event"] for e in _emitted]
    print(PASS if "tick" in tick_events else FAIL, f"Events emitted: {tick_events}")

    # ── Done ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  TEST COMPLETE")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
