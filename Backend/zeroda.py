"""
Zerodha Kite Connect — Auth Helpers
"""

import os
import pyotp
import requests
from urllib.parse import urlparse, parse_qs
from kiteconnect import KiteConnect
from dotenv import load_dotenv

load_dotenv()

API_KEY    = os.environ["KITE_API_KEY"]
API_SECRET = os.environ["KITE_API_SECRET"]
USER_ID    = os.environ["KITE_USER_ID"]
PASSWORD   = os.environ["KITE_PASSWORD"]
TOTP_KEY   = os.environ["KITE_TOTP_KEY"]

# Shared KiteConnect instance
kite = KiteConnect(api_key=API_KEY)


def get_login_url() -> str:
    """Return the Kite Connect OAuth login URL to redirect the user to."""
    return kite.login_url()


def exchange_token(request_token: str) -> str:
    """
    Exchange a request_token (from OAuth redirect) for an access_token.
    Stores the access_token on the shared kite instance.
    """
    session = kite.generate_session(request_token, api_secret=API_SECRET)
    access_token = session["access_token"]
    kite.set_access_token(access_token)
    return access_token


def auto_login() -> str:
    """
    Fully automated login using stored credentials + TOTP.
    Used for scheduled daily login at 8:30 AM IST (no browser needed).
    Returns access_token.
    """
    http = requests.Session()

    # Step 1: Password login
    resp = http.post(
        "https://kite.zerodha.com/api/login",
        data={"user_id": USER_ID, "password": PASSWORD},
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise RuntimeError(f"Login failed: {data}")
    request_id = data["data"]["request_id"]

    # Step 2: TOTP 2FA
    resp = http.post(
        "https://kite.zerodha.com/api/twofa",
        data={
            "user_id":     USER_ID,
            "request_id":  request_id,
            "twofa_value": pyotp.TOTP(TOTP_KEY).now(),
            "twofa_type":  "totp",
        },
    )
    resp.raise_for_status()
    if resp.json().get("status") != "success":
        raise RuntimeError(f"2FA failed: {resp.json()}")

    # Step 3: Follow OAuth redirect to capture request_token
    resp = http.get(kite.login_url(), allow_redirects=True)
    if "request_token" not in resp.url:
        raise RuntimeError(f"request_token not found in redirect: {resp.url}")
    request_token = parse_qs(urlparse(resp.url).query)["request_token"][0]

    # Step 4: Exchange for access_token
    return exchange_token(request_token)
