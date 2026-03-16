"""
SWTS — Super Trend Trading System
FastAPI entry point — manual Zerodha OAuth login, session.json, KiteTicker.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

import zeroda

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
log = logging.getLogger(__name__)


# ── Startup: verify saved token, connect WebSocket ───────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    valid, result = zeroda.verify_and_restore()
    if valid:
        log.info("Session valid — connecting KiteTicker...")
        try:
            session = zeroda.load_session()
            zeroda.init_ticker(session["access_token"])
        except Exception as exc:
            log.error("Ticker init failed on startup: %s", exc)
    else:
        log.warning("Startup: %s", result)
    yield


app = FastAPI(title="SWTS", lifespan=lifespan)
templates = Jinja2Templates(directory="templates")


# ── OAuth login routes ────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, request_token: str | None = None, status: str | None = None):
    """
    - No params                          → check session, show login or dashboard
    - ?request_token=xxx&status=success  → exchange token, save, connect ticker
    """

    # Zerodha OAuth redirect — exchange request_token for access_token
    if request_token and status == "success":
        try:
            access_token = zeroda.exchange_token(request_token)
            zeroda.init_ticker(access_token)
            profile = zeroda.kite.profile()
            return templates.TemplateResponse("index.html", {
                "request":      request,
                "logged_in":    True,
                "user_name":    profile["user_name"],
                "user_id":      profile["user_id"],
                "access_token": access_token,
            })
        except Exception as exc:
            return templates.TemplateResponse("index.html", {
                "request":   request,
                "logged_in": False,
                "error":     str(exc),
                "login_url": zeroda.get_login_url(),
            })

    # Check existing session by verifying with Zerodha
    valid, result = zeroda.verify_and_restore()
    if valid:
        profile = result  # verify_and_restore returns profile dict on success
        session = zeroda.load_session()
        return templates.TemplateResponse("index.html", {
            "request":      request,
            "logged_in":    True,
            "user_name":    profile["user_name"],
            "user_id":      profile["user_id"],
            "access_token": session["access_token"],
        })

    # Not logged in — show login page with reason if token was rejected
    context = {
        "request":   request,
        "logged_in": False,
        "login_url": zeroda.get_login_url(),
    }
    if isinstance(result, str) and "expired" in result.lower():
        context["error"] = result   # show "token expired — please re-login"
    return templates.TemplateResponse("index.html", context)


@app.get("/logout")
async def logout():
    try:
        zeroda.kite.invalidate_access_token()
    except Exception:
        pass
    zeroda.clear_session()
    return RedirectResponse(url="/")


# ── Status & Ticker API ───────────────────────────────────────────────────────

@app.get("/status")
async def api_status():
    valid, result = zeroda.verify_and_restore()
    if valid:
        profile = result
        return {
            "logged_in": True,
            "user":      profile["user_name"],
            "user_id":   profile["user_id"],
            "ticker":    zeroda.ticker_status(),
        }
    return {"logged_in": False, "reason": result, "ticker": zeroda.ticker_status()}


@app.get("/ticker/status")
async def ticker_status():
    return zeroda.ticker_status()


@app.post("/ticker/subscribe")
async def ticker_subscribe(request: Request):
    body = await request.json()
    tokens: list[int] = body.get("tokens", [])
    if not tokens:
        return JSONResponse({"error": "No tokens provided"}, status_code=400)
    zeroda.subscribe(tokens)
    return {"subscribed": tokens, "ticker": zeroda.ticker_status()}


@app.post("/ticker/unsubscribe")
async def ticker_unsubscribe(request: Request):
    body = await request.json()
    tokens: list[int] = body.get("tokens", [])
    zeroda.unsubscribe(tokens)
    return {"unsubscribed": tokens, "ticker": zeroda.ticker_status()}


@app.get("/ticker/ticks")
async def ticker_ticks():
    return zeroda.get_ticks()
