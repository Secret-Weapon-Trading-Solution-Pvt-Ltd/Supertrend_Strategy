"""
SWTS -- Auth Flow Test
Run: python test_auth.py
"""

import sys
import time
import pyotp
import requests
from urllib.parse import urlparse, parse_qs

import zeroda

SEP = "-" * 60


def header(title):
    print(f"\n[{title}]")


def ok(msg):
    print(f"  PASS  {msg}")


def fail(msg, detail=""):
    print(f"  FAIL  {msg}")
    if detail:
        print(f"        {detail}")


def info(msg):
    print(f"        >> {msg}")


# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SWTS Auth Flow Test ===")

# 1. Env vars
header("1  Environment variables")
for name, val in [
    ("KITE_API_KEY",    zeroda.API_KEY),
    ("KITE_API_SECRET", zeroda.API_SECRET),
    ("KITE_USER_ID",    zeroda.USER_ID),
    ("KITE_PASSWORD",   zeroda.PASSWORD),
    ("KITE_TOTP_KEY",   zeroda.TOTP_KEY),
]:
    if val:
        ok(f"{name} loaded")
    else:
        fail(f"{name} is EMPTY")

# 2. Login URL
header("2  Login URL")
url = zeroda.get_login_url()
ok(f"get_login_url()")
info(url)

# 3. Step-by-step auto_login with full debug
header("3  Auto-login — Step-by-step debug")

http = requests.Session()

# Step 3a: Password login
info("Step 1: POST /api/login")
resp1 = http.post(
    "https://kite.zerodha.com/api/login",
    data={"user_id": zeroda.USER_ID, "password": zeroda.PASSWORD},
)
info(f"Status: {resp1.status_code}")
data1 = resp1.json()
info(f"Response: {data1}")

if data1.get("status") != "success":
    fail("Password login failed")
    sys.exit(1)

ok("Password login OK")
request_id = data1["data"]["request_id"]
info(f"request_id: {request_id}")

# Step 3b: TOTP
info("Step 2: POST /api/twofa")
totp_val = pyotp.TOTP(zeroda.TOTP_KEY).now()
info(f"TOTP generated: {totp_val}")

resp2 = http.post(
    "https://kite.zerodha.com/api/twofa",
    data={
        "user_id":     zeroda.USER_ID,
        "request_id":  request_id,
        "twofa_value": totp_val,
        "twofa_type":  "totp",
    },
)
info(f"Status: {resp2.status_code}")
data2 = resp2.json()
info(f"Response: {data2}")

if resp2.status_code != 200 or data2.get("status") != "success":
    fail("2FA failed", str(data2))
    print("""
  HINT: Common causes:
    - TOTP key is the raw base32 secret from Zerodha (NOT the 6-digit OTP)
    - Clock skew > 30s on this machine
    - twofa_type should match what Zerodha expects (totp / app_pin)
""")
    sys.exit(1)

ok("2FA OK")

# Step 3c: OAuth redirect
info("Step 3: GET login_url -> follow redirect -> capture request_token")
resp3 = http.get(zeroda.kite.login_url(), allow_redirects=True)
info(f"Final URL: {resp3.url}")

if "request_token" not in resp3.url:
    fail("request_token not in redirect URL", resp3.url)
    sys.exit(1)

request_token = parse_qs(urlparse(resp3.url).query)["request_token"][0]
ok(f"request_token captured: {request_token[:12]}...")

# Step 3d: Exchange for access_token
info("Step 4: generate_session -> access_token")
try:
    access_token = zeroda.exchange_token(request_token)
    ok(f"access_token: {access_token[:16]}{'*' * 20}")
except Exception as exc:
    fail("exchange_token failed", str(exc))
    sys.exit(1)

# 4. Profile
header("4  Kite profile (validates access_token)")
try:
    profile = zeroda.kite.profile()
    ok("kite.profile()")
    info(f"user_name : {profile.get('user_name')}")
    info(f"user_id   : {profile.get('user_id')}")
    info(f"email     : {profile.get('email')}")
    info(f"broker    : {profile.get('broker')}")
except Exception as exc:
    fail("kite.profile() failed", str(exc))
    sys.exit(1)

# 5. Ticker
header("5  KiteTicker WebSocket")
try:
    zeroda.init_ticker(access_token)
    ok("init_ticker() called")
except Exception as exc:
    fail("init_ticker() failed", str(exc))
    sys.exit(1)

info("Waiting 4 s for WebSocket handshake...")
time.sleep(4)

status = zeroda.ticker_status()
if status["connected"]:
    ok("Ticker CONNECTED")
else:
    fail("Ticker not connected after 4 s")

# 6. Subscribe NIFTY 50 (256265)
header("6  Subscribe NIFTY 50 (instrument token 256265)")
zeroda.subscribe([256265])
ok("subscribe([256265]) called")

info("Waiting 5 s for ticks (only stream during 09:15-15:30 IST)...")
time.sleep(5)

ticks = zeroda.get_ticks()
if ticks:
    ok(f"Received ticks for {len(ticks)} instrument(s)")
    for token, tick in ticks.items():
        info(f"token={token}  LTP={tick.get('last_price', 'n/a')}  volume={tick.get('volume_traded', 'n/a')}")
else:
    info("No ticks received -- market may be closed (expected outside 09:15-15:30 IST)")

print(f"\n=== Done ===\n")
