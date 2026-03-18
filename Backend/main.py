"""
SWTS — Super Trend Trading System
FastAPI entry point — Zerodha OAuth login, DB-backed session, KiteTicker.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select

import zeroda
from models.database import async_session, init_db
from models.account import Account
from broker.account_manager import load_and_autologin_all, disconnect_account
from broker.instruments import refresh_instruments

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
log = logging.getLogger(__name__)


# ── Startup: DB init → verify/auto-login → refresh instruments → ticker ──────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        async with async_session() as db:
            # Step 1: Check for an existing valid token in DB
            result = await db.execute(
                select(Account).where(
                    Account.is_active    == True,
                    Account.is_connected == True,
                    Account.access_token != None,
                )
            )
            account = result.scalars().first()

            if account:
                valid, info = zeroda.verify_token(account.access_token)
                if valid:
                    log.info("Startup: Token valid for %s", account.user_id)
                    access_token = account.access_token
                else:
                    # Step 2: Token expired — run TOTP auto-login for all accounts
                    log.warning("Startup: Token invalid (%s) — running auto-login...", info)
                    sessions = await load_and_autologin_all(db)
                    access_token = next(iter(sessions.values()), None) if sessions else None
            else:
                # Step 2: No account connected — run TOTP auto-login
                log.warning("Startup: No connected account — running auto-login...")
                sessions = await load_and_autologin_all(db)
                access_token = next(iter(sessions.values()), None) if sessions else None

            if not access_token:
                log.warning("Startup: No access token available — manual login required")
            else:
                # Step 3: Refresh instruments from Zerodha
                log.info("Startup: Refreshing instruments...")
                try:
                    total = await refresh_instruments(zeroda.kite, db)
                    log.info("Startup: %d instruments loaded", total)
                except Exception as exc:
                    log.error("Startup: Instrument refresh failed: %s", exc)

                # Step 4: Connect KiteTicker
                try:
                    zeroda.init_ticker(access_token)
                    log.info("Startup: KiteTicker connecting...")
                except Exception as exc:
                    log.error("Startup: Ticker init failed: %s", exc)

    except Exception as exc:
        log.error("Startup error: %s", exc)
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
            profile = zeroda.kite.profile()

            # Save access_token to DB accounts table
            async with async_session() as db:
                result = await db.execute(
                    select(Account).where(Account.user_id == profile["user_id"])
                )
                account = result.scalars().first()
                if account:
                    account.access_token  = access_token
                    account.is_connected  = True
                else:
                    db.add(Account(
                        label        = profile.get("user_name", profile["user_id"]),
                        user_id      = profile["user_id"],
                        api_key      = zeroda.API_KEY,
                        auth_method  = "oauth",
                        access_token = access_token,
                        is_active    = True,
                        is_connected = True,
                    ))
                await db.commit()

            zeroda.init_ticker(access_token)
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

    # Check existing session from DB
    async with async_session() as db:
        result = await db.execute(
            select(Account).where(
                Account.is_active    == True,
                Account.is_connected == True,
                Account.access_token != None,
            )
        )
        account = result.scalars().first()

    if account:
        valid, result = zeroda.verify_token(account.access_token)
        if valid:
            profile = result
            return templates.TemplateResponse("index.html", {
                "request":      request,
                "logged_in":    True,
                "user_name":    profile["user_name"],
                "user_id":      profile["user_id"],
                "access_token": account.access_token,
            })

    # Not logged in — show login page
    return templates.TemplateResponse("index.html", {
        "request":   request,
        "logged_in": False,
        "login_url": zeroda.get_login_url(),
    })


@app.get("/logout")
async def logout():
    try:
        zeroda.kite.invalidate_access_token()
    except Exception:
        pass
    # Clear access_token + is_connected from DB for all accounts
    async with async_session() as db:
        result = await db.execute(select(Account).where(Account.is_connected == True))
        accounts = result.scalars().all()
        for acc in accounts:
            await disconnect_account(db, acc.id)
    return RedirectResponse(url="/")


# ── Status & Ticker API ───────────────────────────────────────────────────────

@app.get("/status")
async def api_status():
    async with async_session() as db:
        result = await db.execute(
            select(Account).where(
                Account.is_active    == True,
                Account.is_connected == True,
                Account.access_token != None,
            )
        )
        account = result.scalars().first()

    if account:
        valid, result = zeroda.verify_token(account.access_token)
        if valid:
            profile = result
            return {
                "logged_in": True,
                "user":      profile["user_name"],
                "user_id":   profile["user_id"],
                "ticker":    zeroda.ticker_status(),
            }
        return {"logged_in": False, "reason": result, "ticker": zeroda.ticker_status()}
    return {"logged_in": False, "reason": "No connected account in DB", "ticker": zeroda.ticker_status()}


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
