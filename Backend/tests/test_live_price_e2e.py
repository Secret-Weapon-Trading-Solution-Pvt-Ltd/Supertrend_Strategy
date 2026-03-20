"""
tests/test_live_price_e2e.py
=============================
End-to-end check: is the live price from KiteTicker actually arriving?

Steps:
  1. Check /ticker/status  — is KiteTicker connected?
  2. Subscribe a token     — via indicators:subscribe Socket.IO event
  3. Watch indicators:data — print each close price + source (TICK vs CANDLE)
  4. Hit /ticker/ticks     — dump raw tick dict so you can see last_price

Run:
    cd Backend
    python tests/test_live_price_e2e.py [TOKEN] [SYMBOL]

    Defaults: TOKEN=738561 (RELIANCE), SYMBOL=RELIANCE, INTERVAL=minute
"""

import sys
import time
import json
import threading
import urllib.request

SERVER = "http://localhost:8000"

# ── CLI args ──────────────────────────────────────────────────────────────────
TOKEN    = int(sys.argv[1]) if len(sys.argv) > 1 else 738561
SYMBOL   = sys.argv[2]      if len(sys.argv) > 2 else "RELIANCE"
INTERVAL = "minute"

# ─────────────────────────────────────────────────────────────────────────────
# Helper: simple GET
# ─────────────────────────────────────────────────────────────────────────────

def get_json(path):
    try:
        with urllib.request.urlopen(f"{SERVER}{path}", timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def post_json(path, data):
    body = json.dumps(data).encode()
    req  = urllib.request.Request(
        f"{SERVER}{path}",
        data    = body,
        headers = {"Content-Type": "application/json"},
        method  = "POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Ticker status
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 60)
print(f"SWTS Live Price E2E — token={TOKEN} symbol={SYMBOL}")
print("=" * 60)

print("\n[1] Ticker status...")
status = get_json("/ticker/status")
print(f"    connected  : {status.get('connected')}")
print(f"    subscribed : {status.get('subscribed_tokens')}")
print(f"    tick_count : {status.get('tick_count')}")

if not status.get("connected"):
    print("\n    WARNING: KiteTicker is NOT connected.")
    print("    Live prices will fall back to candle close.")
    print("    Make sure server started successfully and market is open.\n")

# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Manually subscribe the token via REST
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n[2] Subscribing token {TOKEN} via /ticker/subscribe ...")
sub = post_json("/ticker/subscribe", {"tokens": [TOKEN]})
print(f"    result: {sub}")

# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Wait 2s then dump raw ticks
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n[3] Waiting 2s for ticks to arrive...")
time.sleep(2)

ticks = get_json("/ticker/ticks")
tick  = ticks.get(str(TOKEN)) or ticks.get(TOKEN)

if tick:
    print(f"\n    RAW TICK for {TOKEN}:")
    for k, v in tick.items():
        print(f"      {k}: {v}")
    last_price = tick.get("last_price")
    print(f"\n    last_price (live) = {last_price}  <-- this is what _indicators_loop uses")
else:
    print(f"\n    No tick found for token {TOKEN}.")
    print("    Possible reasons:")
    print("      - Market is closed (no ticks outside 9:15–15:30)")
    print("      - KiteTicker not connected")
    print("      - Token not yet subscribed (subscribe just fired, give it a moment)")

# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Socket.IO live watch (requires python-socketio[client])
# ─────────────────────────────────────────────────────────────────────────────

print("\n[4] Connecting via Socket.IO to watch indicators:data ...")
print("    (Ctrl+C to stop)\n")

try:
    import socketio as sio_client
except ImportError:
    print("    python-socketio not installed. Run:")
    print("    pip install 'python-socketio[client]'")
    print("\n    Skipping Socket.IO watch. Check /ticker/ticks endpoint manually.")
    sys.exit(0)

sio = sio_client.Client()
prev_close  = None
tick_source_counts = {"TICK": 0, "CANDLE": 0}
lock = threading.Lock()

@sio.on("indicators:data")
def on_indicators(data):
    global prev_close
    close = data.get("close")
    ts    = data.get("timestamp", "?")

    # Detect source: if close keeps changing intra-candle → TICK
    # If it only changes on new_candle → CANDLE fallback
    new_candle = data.get("new_candle", False)
    changed    = (prev_close is not None and close != prev_close)

    if changed and not new_candle:
        source = "TICK  OK"   # price moved between candles -> WebSocket tick
        with lock:
            tick_source_counts["TICK"] += 1
    else:
        source = "CANDLE"
        with lock:
            tick_source_counts["CANDLE"] += 1

    print(f"  [{ts}]  close={close}  source={source}  new_candle={new_candle}")
    prev_close = close

@sio.on("connect")
def on_connect():
    print("    Socket.IO connected — sending indicators:subscribe\n")
    sio.emit("indicators:subscribe", {"token": TOKEN, "interval": INTERVAL})

@sio.on("disconnect")
def on_disconnect():
    print("\n    Socket.IO disconnected")

try:
    sio.connect(SERVER)
    sio.wait()
except KeyboardInterrupt:
    pass
finally:
    sio.disconnect()
    print(f"\n── Summary ──────────────────────────────────────────")
    print(f"  TICK updates   (live price changed intra-candle): {tick_source_counts['TICK']}")
    print(f"  CANDLE updates (price only on new candle close) : {tick_source_counts['CANDLE']}")
    if tick_source_counts["TICK"] > 0:
        print("  RESULT: Live price from KiteTicker is working [OK]")
    else:
        print("  RESULT: No intra-candle price movement detected.")
        print("          Either market is closed OR ticks are not arriving.")
