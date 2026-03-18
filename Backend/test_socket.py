"""
test_socket.py — Test Socket.IO connection + engine tick with MCX GOLD.

Run from Backend/:
    python test_socket.py
"""

import time
import socketio

SERVER = "http://localhost:8000"

# MCX GOLD April Futures
SYMBOL = "GOLD26APRFUT"
TOKEN  = 116433415
QTY    = 1
INTERVAL = "minute"

sio = socketio.SimpleClient()

print("\n" + "=" * 60)
print("  SWTS — Socket.IO Connection Test  |  MCX GOLD FUT")
print("=" * 60)

# ── Connect ───────────────────────────────────────────────────
print("\n[1] Connecting to", SERVER, "...")
sio.connect(SERVER)
print("  [PASS] Connected  |  sid:", sio.sid)

# ── Start engine ──────────────────────────────────────────────
print(f"\n[2] Sending engine:start  ({SYMBOL}  token={TOKEN}  interval={INTERVAL})...")
sio.emit("engine:start", {
    "symbol":   SYMBOL,
    "token":    TOKEN,
    "qty":      QTY,
    "interval": INTERVAL,
})

# ── Listen for events ─────────────────────────────────────────
print("\n[3] Listening for events (15 seconds)...\n")

deadline = time.time() + 15
events_seen = []

while time.time() < deadline:
    try:
        event = sio.receive(timeout=2)   # blocks up to 2s per call
        name, data = event[0], event[1] if len(event) > 1 else {}
        events_seen.append(name)

        if name == "engine:state":
            print(f"  [ENGINE STATE]  state={data.get('state')}  symbol={data.get('symbol')}  interval={data.get('interval')}")

        elif name == "tick":
            print(f"  [TICK]  time={data.get('timestamp')}  close={data.get('close')}  "
                  f"ST={data.get('supertrend')}  dir={data.get('direction')}  ATR={data.get('atr')}")

        elif name == "signal:buy":
            print(f"  [BUY SIGNAL]  symbol={data.get('symbol')}  price={data.get('price')}  time={data.get('time')}")

        elif name == "order:placed":
            print(f"  [ORDER]  {data.get('type')}  {data.get('symbol')}  qty={data.get('qty')}  price={data.get('price')}")

        elif name == "exit:triggered":
            print(f"  [EXIT]  reason={data.get('reason')}  pnl={data.get('pnl_points')}  result={data.get('result')}")

        elif name == "error":
            print(f"  [ERROR]  {data.get('message')}")

        else:
            print(f"  [{name.upper()}]  {data}")

    except Exception:
        pass   # timeout — keep looping

# ── Stop engine ───────────────────────────────────────────────
print(f"\n[4] Sending engine:stop...")
sio.emit("engine:stop", {})
time.sleep(1)

# ── Summary ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  Events received: {events_seen}")
print("  [PASS] Socket.IO connection working" if events_seen else "  [FAIL] No events received")
print("=" * 60 + "\n")

sio.disconnect()
