"""
Zerodha Kite Connect — Auth Helpers + TOTP Auto Login + Ticker
"""

import os
import re
import json
import logging
import requests
import pyotp
from pathlib import Path
from datetime import datetime

from kiteconnect import KiteConnect, KiteTicker
from kiteconnect.exceptions import TokenException
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

API_KEY    = os.environ["KITE_API_KEY"]
API_SECRET = os.environ["KITE_API_SECRET"]
USER_ID    = os.environ.get("KITE_USER_ID", "")
PASSWORD   = os.environ.get("KITE_PASSWORD", "")
TOTP_KEY   = os.environ.get("KITE_TOTP_KEY", "")

SESSION_FILE = Path(__file__).parent / "session.json"

# Shared KiteConnect instance
kite = KiteConnect(api_key=API_KEY)

# ── Ticker state ──────────────────────────────────────────────────────────────
_ticker: KiteTicker | None = None
_ticker_connected: bool    = False
_subscribed_tokens: list   = []
_latest_ticks: dict        = {}


# ── Session persistence ───────────────────────────────────────────────────────

def save_session(access_token: str) -> None:
    data = {
        "access_token": access_token,
        "login_time":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    SESSION_FILE.write_text(json.dumps(data, indent=2))
    log.info("Session saved to session.json")


def load_session() -> dict | None:
    if not SESSION_FILE.exists():
        return None
    try:
        return json.loads(SESSION_FILE.read_text())
    except Exception as exc:
        log.warning("Could not read session.json: %s", exc)
        return None


def clear_session() -> None:
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()
    log.info("Session cleared")


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_login_url() -> str:
    return kite.login_url()


def auto_login() -> str:
    """
    Fully automated TOTP login — no browser needed.
    Returns access_token and saves session to session.json.
    """
    session = requests.Session()

    # Step 1: Get sess_id from Kite login page
    resp = session.get(f"https://kite.zerodha.com/connect/login?v=3&api_key={API_KEY}")
    if "sess_id=" not in resp.url:
        raise ValueError(f"Could not get sess_id. URL: {resp.url}")
    session_id = resp.url.split("sess_id=")[1].split("&")[0]
    log.info("Step 1: Got sess_id")

    # Step 2: Submit user ID + password
    r = session.post("https://kite.zerodha.com/api/login", data={
        "user_id": USER_ID,
        "password": PASSWORD,
        "type": "user_id",
    })
    data = r.json()
    if data.get("status") != "success":
        raise ValueError(f"Login failed: {data.get('message')}")
    request_id = data["data"]["request_id"]
    log.info("Step 2: Password accepted")

    # Step 3: Submit TOTP
    totp_value = pyotp.TOTP(TOTP_KEY).now()
    r2 = session.post("https://kite.zerodha.com/api/twofa", data={
        "user_id":      USER_ID,
        "request_id":   request_id,
        "twofa_value":  totp_value,
        "twofa_type":   "totp",
        "skip_session": "true",
    }, allow_redirects=True)
    if r2.json().get("status") != "success":
        raise ValueError(f"2FA failed: {r2.json().get('message')}")
    log.info("Step 3: TOTP accepted")

    # Step 4: Get request_token
    request_token = _get_request_token(session, session_id)
    log.info("Step 4: Got request_token")

    # Step 5: Exchange request_token for access_token
    access_token = exchange_token(request_token)
    log.info("Auto login successful — user: %s", kite.profile().get("user_name"))
    return access_token


def _get_request_token(session: requests.Session, session_id: str) -> str:
    """Extract request_token from Kite redirect after successful login."""
    finish_url = f"https://kite.zerodha.com/connect/finish?sess_id={session_id}&api_key={API_KEY}"

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
            data={"api_key": API_KEY, "sess_id": session_id, "authorize": "1"},
            allow_redirects=True,
        )
        if "request_token=" in r.url:
            return r.url.split("request_token=")[1].split("&")[0]
    except requests.exceptions.ConnectionError as e:
        match = re.search(r"request_token=([a-zA-Z0-9]+)", str(e))
        if match:
            return match.group(1)

    raise ValueError("Could not get request_token. Authorize the Kite app once manually in the browser.")


def exchange_token(request_token: str) -> str:
    """Exchange request_token -> access_token, save to session.json."""
    session = kite.generate_session(request_token, api_secret=API_SECRET)
    access_token = session["access_token"]
    kite.set_access_token(access_token)
    save_session(access_token)
    return access_token


def verify_and_restore() -> tuple[bool, str | None]:
    """
    Load token from session.json, apply it to kite, then verify by calling
    kite.profile().

    Returns:
        (True,  profile_dict)  — token is valid
        (False, reason_string) — token missing or rejected by Zerodha
    """
    session = load_session()
    if not session or not session.get("access_token"):
        return False, "No saved session — please login"

    token = session["access_token"]
    kite.set_access_token(token)

    try:
        profile = kite.profile()
        log.info("Token valid — user: %s", profile.get("user_name"))
        return True, profile
    except TokenException:
        log.warning("Token rejected by Zerodha — clearing session")
        clear_session()
        return False, "Access token expired or invalid — please re-login"
    except Exception as exc:
        log.error("Could not verify token: %s", exc)
        return False, f"Could not verify token: {exc}"


# ── Ticker ────────────────────────────────────────────────────────────────────

def init_ticker(access_token: str) -> None:
    """Connect KiteTicker WebSocket in a background thread."""
    global _ticker, _ticker_connected

    if _ticker is not None:
        try:
            _ticker.close()
        except Exception:
            pass

    _ticker = KiteTicker(API_KEY, access_token)

    def on_connect(ws, response):
        global _ticker_connected
        _ticker_connected = True
        log.info("KiteTicker connected")
        if _subscribed_tokens:
            ws.subscribe(_subscribed_tokens)
            ws.set_mode(ws.MODE_FULL, _subscribed_tokens)

    def on_ticks(ws, ticks):
        for tick in ticks:
            _latest_ticks[tick["instrument_token"]] = tick

    def on_close(ws, code, reason):
        global _ticker_connected
        _ticker_connected = False
        log.warning("KiteTicker closed: %s %s", code, reason)

    def on_error(ws, code, reason):
        log.error("KiteTicker error: %s %s", code, reason)

    def on_reconnect(ws, attempts_count):
        log.info("KiteTicker reconnecting (attempt %d)...", attempts_count)

    _ticker.on_connect   = on_connect
    _ticker.on_ticks     = on_ticks
    _ticker.on_close     = on_close
    _ticker.on_error     = on_error
    _ticker.on_reconnect = on_reconnect

    _ticker.connect(threaded=True)
    log.info("KiteTicker connecting in background...")


def subscribe(tokens: list[int]) -> None:
    global _subscribed_tokens
    new_tokens = [t for t in tokens if t not in _subscribed_tokens]
    if not new_tokens:
        return
    _subscribed_tokens.extend(new_tokens)
    if _ticker and _ticker_connected:
        _ticker.subscribe(new_tokens)
        _ticker.set_mode(_ticker.MODE_FULL, new_tokens)


def unsubscribe(tokens: list[int]) -> None:
    global _subscribed_tokens
    _subscribed_tokens = [t for t in _subscribed_tokens if t not in tokens]
    if _ticker and _ticker_connected:
        _ticker.unsubscribe(tokens)


def get_ticks() -> dict:
    return dict(_latest_ticks)


def ticker_status() -> dict:
    return {
        "connected":         _ticker_connected,
        "subscribed_tokens": _subscribed_tokens,
        "tick_count":        len(_latest_ticks),
    }
