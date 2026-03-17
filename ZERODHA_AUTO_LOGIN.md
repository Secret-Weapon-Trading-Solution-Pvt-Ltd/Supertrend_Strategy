# Zerodha Auto Login (TOTP Method)

## Required Credentials

| Credential | What it is | Where to get |
|---|---|---|
| `api_key` | Your Kite Connect app key | [kite.trade/apps](https://kite.trade/apps) → Your App → API Key |
| `api_secret` | Your Kite Connect app secret | Same page → API Secret |
| `user_id` | Zerodha client ID (e.g. `ZZ1234`) | Zerodha login / Console |
| `password` | Zerodha login password | Your Zerodha account |
| `totp_key` | Base32 secret from TOTP setup | See step below |

---

## How to Get `totp_key` (One-time setup)

1. Go to [myaccount.zerodha.com](https://myaccount.zerodha.com) → **Profile** → **Security**
2. Click **Enable TOTP**
3. Instead of scanning the QR code with an app, click **"Can't scan? Enter key manually"**
4. Copy the **base32 secret key** shown (looks like `JBSWY3DPEHPK3PXP`)
5. **Save it** — this is your `totp_key`
6. Complete TOTP setup by entering a generated OTP to confirm

> **Note:** `totp_key` is the permanent base32 secret, NOT a live 6-digit OTP code.

---

## Kite Connect App Setup

1. Go to [kite.trade/apps](https://kite.trade/apps) → **Create new app**
2. App type: **Connect**
3. Set **Redirect URL** to anything (e.g. `http://127.0.0.1` — just needs to be set)
4. Copy `api_key` and `api_secret`

> **Cost:** Kite Connect is ₹2000/month per app.

---

## Install Dependencies

```bash
pip install kiteconnect pyotp requests
```

---

## Auto Login Code

```python
# zerodha_auth.py
import re
import requests
import pyotp
from kiteconnect import KiteConnect, KiteTicker


class ZerodhaAuth:
    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret
        self.kite = KiteConnect(api_key=api_key)

    def login(self, user_id: str, password: str, totp_key: str):
        """Auto login using TOTP. Returns (access_token, kite, kws)."""
        session = requests.Session()

        # Step 1: Get sess_id
        resp = session.get(f"https://kite.zerodha.com/connect/login?v=3&api_key={self.api_key}")
        if "sess_id=" not in resp.url:
            raise ValueError(f"Failed to get sess_id. URL: {resp.url}")
        session_id = resp.url.split("sess_id=")[1].split("&")[0]

        # Step 2: Submit credentials
        r = session.post("https://kite.zerodha.com/api/login", data={
            "user_id": user_id, "password": password, "type": "user_id"
        })
        data = r.json()
        if data.get("status") != "success":
            raise ValueError(f"Login failed: {data.get('message')}")
        request_id = data["data"]["request_id"]

        # Step 3: Submit TOTP
        r2 = session.post("https://kite.zerodha.com/api/twofa", data={
            "user_id": user_id,
            "request_id": request_id,
            "twofa_value": pyotp.TOTP(totp_key).now(),
            "twofa_type": "totp",
            "skip_session": "true",
        }, allow_redirects=True)
        if r2.json().get("status") != "success":
            raise ValueError(f"2FA failed: {r2.json().get('message')}")

        # Step 4: Get request_token
        request_token = self._get_request_token(session, session_id)

        # Step 5: Generate session
        sess = self.kite.generate_session(request_token, api_secret=self.api_secret)
        access_token = sess["access_token"]
        self.kite.set_access_token(access_token)
        kws = KiteTicker(self.api_key, access_token)

        print(f"Logged in: {self.kite.profile()['user_name']}")
        return access_token, self.kite, kws

    def _get_request_token(self, session, session_id):
        finish_url = f"https://kite.zerodha.com/connect/finish?sess_id={session_id}&api_key={self.api_key}"
        try:
            r = session.get(finish_url, allow_redirects=False)
            if r.status_code == 302 and "request_token=" in r.headers.get("Location", ""):
                return r.headers["Location"].split("request_token=")[1].split("&")[0]
            r = session.get(finish_url, allow_redirects=True)
            if "request_token=" in r.url:
                return r.url.split("request_token=")[1].split("&")[0]
        except requests.exceptions.ConnectionError as e:
            match = re.search(r"request_token=([a-zA-Z0-9]+)", str(e))
            if match:
                return match.group(1)

        # Auto-authorize app (first time only)
        try:
            r = session.post(
                "https://kite.zerodha.com/connect/finish",
                data={"api_key": self.api_key, "sess_id": session_id, "authorize": "1"},
                allow_redirects=True,
            )
            if "request_token=" in r.url:
                return r.url.split("request_token=")[1].split("&")[0]
        except requests.exceptions.ConnectionError as e:
            match = re.search(r"request_token=([a-zA-Z0-9]+)", str(e))
            if match:
                return match.group(1)

        raise ValueError("Could not get request_token. Authorize app once manually in browser.")
```

---

## Usage

```python
auth = ZerodhaAuth(
    api_key="your_api_key",
    api_secret="your_api_secret"
)

access_token, kite, kws = auth.login(
    user_id="ZZ1234",
    password="your_password",
    totp_key="JBSWY3DPEHPK3PXP"   # base32 secret from TOTP setup
)

# Now use kite object
print(kite.profile())
print(kite.orders())
print(kite.holdings())
```

---

## `.env` File

```env
ZERODHA_API_KEY=your_api_key
ZERODHA_API_SECRET=your_api_secret
ZERODHA_USER_ID=ZZ1234
ZERODHA_PASSWORD=your_password
ZERODHA_TOTP_KEY=JBSWY3DPEHPK3PXP
```

```python
# Load from .env
from dotenv import load_dotenv
import os
load_dotenv()

auth = ZerodhaAuth(os.getenv("ZERODHA_API_KEY"), os.getenv("ZERODHA_API_SECRET"))
access_token, kite, kws = auth.login(
    os.getenv("ZERODHA_USER_ID"),
    os.getenv("ZERODHA_PASSWORD"),
    os.getenv("ZERODHA_TOTP_KEY")
)
```

---

## Notes

- `access_token` expires **every day at 6 AM IST** — re-login daily
- Store `access_token` in DB/file to reuse within the same day
- First login may require manual browser authorization of your Kite app (one-time only)
- `totp_key` never changes — store it securely (encrypted or in `.env`)
