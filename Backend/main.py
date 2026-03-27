"""
SWTS — Super Trend Trading System
FastAPI + Socket.IO entry point.

HTTP:      Zerodha OAuth login, DB-backed session, instrument search
Socket.IO: Real-time engine control + event streaming to frontend

Socket events (client → server):
  engine:start       {symbol, token, qty, interval?}
  engine:stop        {}
  engine:pause       {}
  engine:resume      {}
  position:exit      {}   — manually exit open position, engine stays RUNNING
  indicator:toggle   {name: "supertrend"|"atr", enabled: bool}
  indicator:settings {name: "supertrend", length: int, multiplier: float}
                     {name: "atr", period: int, threshold: float}
  exit:settings      {target_type?, target_value?, sl_type?, sl_value?,
                      trailing_sl?, trail_value?, exit_on_st_red?, session_end_time?}
  exit:settings:get  {}                        → returns exit:settings:applied
  mode:switch        {mode: "forward_test"|"live"}
  instruments:search {query, exchange?}   → returns instruments:results
  trades:history     {limit?}             → returns trades:history

Socket events (server → client):
  tick               {close, supertrend, atr, direction, timestamp}
  signal:buy         {symbol, price, time}
  order:placed       {type, symbol, qty, price, order_id}
  exit:triggered     {reason, entry, exit, pnl_points, result}
  position:update    {entry_price, current_price, peak_price, unrealized_pnl}
  engine:state       {state, symbol, interval}
  timeframes         [{interval, label, minutes}]
  instruments:results [{symbol, token, name, exchange, segment}]
  indicator:state             {name, enabled}
  indicator:settings:applied  {name, ...params}
  exit:settings:applied       {target_type, target_value, sl_type, sl_value,
                               trailing_sl, trail_value, exit_on_st_red, session_end_time}
  mode:state                  {mode}
  log                         {level, logger, message, timestamp}
"""

import asyncio
import logging

import pytz
import socketio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select

import zeroda
from broker.factory import create_broker
from config.settings import settings
from engine.trading_engine import TradingEngine
from events.event_bus import emit, set_loop, sio
from events.log_handler import install as install_log_handler
from models.trade import set_loop as set_trade_loop
from models.trade_log import set_loop as set_trade_log_loop, get_trade_logs
from models.account import Account
from models.timeframe import Timeframe
from models.database import async_session, init_db
from broker.account_manager import load_and_autologin_all, disconnect_account
from broker.instruments import refresh_instruments
from api.routes_market import router as market_router
from api.routes_trades import router as trades_router
from api.routes_portfolio import router as portfolio_router
from api.routes_admin import router as admin_router

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")

# ── Global engine instance ────────────────────────────────────────────────────
# Created when frontend sends engine:start, destroyed on engine:stop.

_engine: TradingEngine | None = None
_access_token: str | None     = None   # cached from startup / login


# ── Daily 8:30 AM IST job ─────────────────────────────────────────────────────

async def daily_autologin():
    """
    Runs every day at 8:30 AM IST (45 min before market opens at 9:15 AM).
    1. TOTP auto-login for all active accounts → fresh access_token saved to DB.
    2. Refresh instruments from Zerodha → update instruments table.
    3. Reconnect KiteTicker with new access_token.
    """
    global _access_token
    log.info("Scheduler: Daily auto-login starting (8:30 AM IST)...")
    try:
        async with async_session() as db:
            sessions = await load_and_autologin_all(db)
            if not sessions:
                log.error("Scheduler: Auto-login failed — no accounts logged in")
                return
            _access_token = next(iter(sessions.values()))
            log.info("Scheduler: Auto-login successful — %d account(s)", len(sessions))

            try:
                total = await refresh_instruments(zeroda.kite, db)
                log.info("Scheduler: %d instruments refreshed", total)
            except Exception as exc:
                log.error("Scheduler: Instrument refresh failed: %s", exc)

        try:
            zeroda.init_ticker(_access_token)
            log.info("Scheduler: KiteTicker reconnected with fresh token")
        except Exception as exc:
            log.error("Scheduler: Ticker reconnect failed: %s", exc)

    except Exception as exc:
        log.error("Scheduler: daily_autologin error: %s", exc)


# ── Startup / shutdown ────────────────────────────────────────────────────────

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _access_token

    await init_db()

    # Store running event loop — needed for thread-safe Socket.IO emits + DB writes
    loop = asyncio.get_event_loop()
    set_loop(loop)
    set_trade_loop(loop)
    set_trade_log_loop(loop)

    # Install Socket.IO log handler — all logs stream to frontend from now
    install_log_handler()

    # Scheduler — daily auto-login at 8:30 AM IST
    scheduler = AsyncIOScheduler(timezone=IST)
    scheduler.add_job(
        daily_autologin,
        trigger      = CronTrigger(hour=8, minute=30, timezone=IST),
        id           = "daily_autologin",
        name         = "Daily Zerodha auto-login at 8:30 AM IST",
        replace_existing = True,
    )
    scheduler.start()
    log.info("Scheduler: Daily auto-login scheduled at 08:30 AM IST")

    # Seed / refresh TOTP account from .env credentials.
    # Creates the account if it doesn't exist; updates credentials if it does.
    try:
        from config.crypto import encrypt as _encrypt
        async with async_session() as db:
            result = await db.execute(
                select(Account).where(
                    Account.user_id     == zeroda.USER_ID,
                    Account.auth_method == "totp",
                )
            )
            primary = result.scalars().first()
            if primary:
                primary.api_key              = zeroda.API_KEY
                primary.api_secret_encrypted = _encrypt(zeroda.API_SECRET)
                primary.password_encrypted   = _encrypt(zeroda.PASSWORD)
                primary.totp_key_encrypted   = _encrypt(zeroda.TOTP_KEY)
                await db.commit()
                log.info("Startup: Refreshed credentials for account '%s' from .env", primary.label)
            elif zeroda.USER_ID and zeroda.API_KEY:
                new_account = Account(
                    label                = "Primary",
                    user_id              = zeroda.USER_ID,
                    api_key              = zeroda.API_KEY,
                    api_secret_encrypted = _encrypt(zeroda.API_SECRET),
                    password_encrypted   = _encrypt(zeroda.PASSWORD),
                    totp_key_encrypted   = _encrypt(zeroda.TOTP_KEY),
                    auth_method          = "totp",
                    is_active            = True,
                    is_connected         = False,
                )
                db.add(new_account)
                await db.commit()
                log.info("Startup: Created account for user '%s' from .env", zeroda.USER_ID)
    except Exception as exc:
        log.warning("Startup: Could not seed account credentials: %s", exc)

    try:
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
                valid, info = zeroda.verify_token(account.access_token)
                if valid:
                    log.info("Startup: Token valid for %s", account.user_id)
                    _access_token = account.access_token
                else:
                    log.warning("Startup: Token invalid (%s) — running auto-login...", info)
                    sessions = await load_and_autologin_all(db)
                    _access_token = next(iter(sessions.values()), None) if sessions else None
            else:
                log.warning("Startup: No connected account — running auto-login...")
                sessions = await load_and_autologin_all(db)
                _access_token = next(iter(sessions.values()), None) if sessions else None

            if not _access_token:
                log.warning("Startup: No access token available — manual login required")
            else:
                log.info("Startup: Refreshing instruments...")
                try:
                    total = await refresh_instruments(zeroda.kite, db)
                    log.info("Startup: %d instruments loaded", total)
                except Exception as exc:
                    log.error("Startup: Instrument refresh failed: %s", exc)

                try:
                    zeroda.init_ticker(_access_token)
                    log.info("Startup: KiteTicker connecting...")
                except Exception as exc:
                    log.error("Startup: Ticker init failed: %s", exc)

    except Exception as exc:
        log.error("Startup error: %s", exc)

    yield

    # Shutdown — run in thread, shutdown() calls place_order (blocking HTTP)
    if _engine:
        await asyncio.to_thread(_engine.shutdown)
    scheduler.shutdown()
    log.info("Scheduler: stopped")


# ── FastAPI app ───────────────────────────────────────────────────────────────

fastapi_app = FastAPI(title="SWTS", lifespan=lifespan)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates   = Jinja2Templates(directory="templates")

fastapi_app.include_router(market_router)
fastapi_app.include_router(trades_router)
fastapi_app.include_router(portfolio_router)
fastapi_app.include_router(admin_router)


# ── OAuth login routes ────────────────────────────────────────────────────────

@fastapi_app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html")


@fastapi_app.get("/", response_class=HTMLResponse)
async def index(request: Request, request_token: str | None = None, status: str | None = None):
    global _access_token

    if request_token and status == "success":
        try:
            _access_token = zeroda.exchange_token(request_token)
            profile = zeroda.kite.profile()

            async with async_session() as db:
                result = await db.execute(
                    select(Account).where(Account.user_id == profile["user_id"])
                )
                account = result.scalars().first()
                if account:
                    account.access_token = _access_token
                    account.is_connected = True
                else:
                    db.add(Account(
                        label        = profile.get("user_name", profile["user_id"]),
                        user_id      = profile["user_id"],
                        api_key      = zeroda.API_KEY,
                        auth_method  = "oauth",
                        access_token = _access_token,
                        is_active    = True,
                        is_connected = True,
                    ))
                await db.commit()

            zeroda.init_ticker(_access_token)

            try:
                async with async_session() as db:
                    total = await refresh_instruments(zeroda.kite, db)
                    log.info("OAuth login: %d instruments refreshed", total)
            except Exception as exc:
                log.error("OAuth login: instrument refresh failed: %s", exc)

            return templates.TemplateResponse(request, "index.html", {
                "logged_in":    True,
                "user_name":    profile["user_name"],
                "user_id":      profile["user_id"],
                "access_token": _access_token,
            })
        except Exception as exc:
            log.error("OAuth token exchange failed: %s", exc)
            return templates.TemplateResponse(request, "index.html", {
                "logged_in": False,
                "error":     str(exc),
                "login_url": zeroda.get_login_url(),
            })

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
            return RedirectResponse(url="/dashboard")

    return templates.TemplateResponse(request, "index.html", {
        "logged_in": False,
        "login_url": zeroda.get_login_url(),
    })


@fastapi_app.get("/logout")
async def logout():
    try:
        zeroda.kite.invalidate_access_token()
    except Exception:
        pass
    async with async_session() as db:
        result = await db.execute(select(Account).where(Account.is_connected == True))
        accounts = result.scalars().all()
        for acc in accounts:
            await disconnect_account(db, acc.id)
    return {"logged_out": True}


# ── Keycloak code exchange (used by /admin page) ─────────────────────────────

@fastapi_app.post("/api/auth/exchange")
async def auth_exchange(request: Request):
    """Exchange a Keycloak authorization code for an access token (no Zerodha)."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    code         = body.get("code")
    redirect_uri = body.get("redirect_uri")
    if not code or not redirect_uri:
        return JSONResponse({"error": "code and redirect_uri required"}, status_code=400)
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient() as hc:
            r = await hc.post(
                f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
                "/protocol/openid-connect/token",
                data={
                    "grant_type":   "authorization_code",
                    "client_id":    "swts-frontend",
                    "code":         code,
                    "redirect_uri": redirect_uri,
                },
            )
            if not r.is_success:
                return JSONResponse({"error": "code exchange failed"}, status_code=400)
            return {"access_token": r.json().get("access_token")}
    except Exception as exc:
        log.error("auth/exchange error: %s", exc)
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── Auth login (triggered after Keycloak redirect) ────────────────────────────

@fastapi_app.post("/api/auth/login")
async def auth_login(request: Request):
    """
    Called by the frontend after Keycloak redirects back with ?code=.
    Optionally exchanges the Keycloak code for an access token, then
    runs TOTP auto-login to get a fresh Zerodha access token.
    """
    global _access_token

    # ── Exchange Keycloak code if provided ─────────────────────────────────
    keycloak_token: str | None = None
    try:
        body = await request.json()
    except Exception:
        body = {}

    code         = body.get("code")
    redirect_uri = body.get("redirect_uri")

    if code and redirect_uri:
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient() as hc:
                r = await hc.post(
                    f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
                    "/protocol/openid-connect/token",
                    data={
                        "grant_type":   "authorization_code",
                        "client_id":    "swts-frontend",
                        "code":         code,
                        "redirect_uri": redirect_uri,
                    },
                )
                if r.is_success:
                    keycloak_token = r.json().get("access_token")
                else:
                    log.warning("auth/login: Keycloak code exchange failed: %s", r.text)
        except Exception as exc:
            log.warning("auth/login: Keycloak code exchange error: %s", exc)

    # ── Check Keycloak role before allowing dashboard access ───────────────
    kc_roles: list[str] = []
    if keycloak_token:
        try:
            import base64 as _b64, json as _json
            p = keycloak_token.split(".")[1]
            p += "=" * (-len(p) % 4)
            kc_roles = _json.loads(_b64.urlsafe_b64decode(p)).get("realm_access", {}).get("roles", [])
            if "revoke" in kc_roles:
                return JSONResponse(
                    {"logged_in": False, "reason": "revoked", "keycloak_token": keycloak_token},
                    status_code=403,
                )
            if "admin" not in kc_roles and "approve" not in kc_roles:
                return JSONResponse(
                    {"logged_in": False, "reason": "pending", "keycloak_token": keycloak_token},
                    status_code=403,
                )
        except Exception as exc:
            log.warning("auth/login: role check error: %s", exc)

    # ── Keycloak auth passed — return dashboard access with Zerodha status ──
    # Zerodha connection is handled separately (8:30 scheduler or manual OAuth).
    # Do NOT block dashboard access based on Zerodha status here.
    return {
        "logged_in":      True,
        "keycloak_token": keycloak_token,
        "ticker":         zeroda.ticker_status(),
    }


# ── Status & Ticker REST ──────────────────────────────────────────────────────

@fastapi_app.get("/status")
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
            return {
                "logged_in": True,
                "user":      result["user_name"],
                "user_id":   result["user_id"],
                "ticker":    zeroda.ticker_status(),
            }
        return {"logged_in": False, "reason": result, "ticker": zeroda.ticker_status()}
    return {"logged_in": False, "reason": "No connected account in DB", "ticker": zeroda.ticker_status()}


@fastapi_app.get("/ticker/status")
async def ticker_status():
    return zeroda.ticker_status()


@fastapi_app.post("/ticker/subscribe")
async def ticker_subscribe(request: Request):
    body = await request.json()
    tokens: list[int] = body.get("tokens", [])
    if not tokens:
        return JSONResponse({"error": "No tokens provided"}, status_code=400)
    zeroda.subscribe(tokens)
    return {"subscribed": tokens, "ticker": zeroda.ticker_status()}


@fastapi_app.post("/ticker/unsubscribe")
async def ticker_unsubscribe(request: Request):
    body = await request.json()
    tokens: list[int] = body.get("tokens", [])
    zeroda.unsubscribe(tokens)
    return {"unsubscribed": tokens, "ticker": zeroda.ticker_status()}


@fastapi_app.get("/ticker/ticks")
async def ticker_ticks():
    return zeroda.get_ticks()


@fastapi_app.get("/api/forward/summary")
async def forward_summary():
    """Return ForwardTestBroker P&L summary when engine is in forward_test mode."""
    from broker.forward_test import ForwardTestBroker
    if _engine and isinstance(_engine.broker, ForwardTestBroker):
        return _engine.broker.summary()
    return {"total_trades": 0, "total_pnl": 0.0, "wins": 0, "losses": 0, "trades": []}


# ── Socket.IO event handlers (client → server) ────────────────────────────────

@sio.event
async def connect(sid, environ):
    log.info("Socket.IO client connected: %s", sid)
    # Send current engine state if engine is already running
    if _engine:
        await sio.emit("engine:state", _engine.status(), to=sid)


@sio.on("engine:start")
async def on_engine_start(sid, data: dict):
    """
    Start the trading engine.
    data: {symbol, token, qty, interval?}
    """
    global _engine

    if not _access_token:
        await sio.emit("error", {"message": "Not logged in — no access token"}, to=sid)
        return

    symbol   = data.get("symbol")
    token    = data.get("token")
    qty      = data.get("qty", 1)
    interval = data.get("interval", settings.timeframe)
    exchange = data.get("exchange", "NSE")

    if not symbol or not token:
        await sio.emit("error", {"message": "symbol and token are required"}, to=sid)
        return

    try:
        # If same symbol is already running/paused/stopped → resume or restart in-place (no new thread)
        if _engine and _engine.instrument_token == int(token) and _engine._thread and _engine._thread.is_alive():
            _engine.qty = int(qty)
            if _engine.state.value == "STOPPED":
                from engine.trading_engine import EngineState
                _engine.state = EngineState.RUNNING
                log.info("Engine restarted from STOPPED: %s qty=%d", symbol, qty)
            else:
                _engine.resume()
                log.info("Engine resumed: %s qty=%d", symbol, qty)
            await emit("engine:state", _engine.status())
            return

        # Kill old thread if it exists (different symbol or dead thread)
        if _engine:
            _engine.shutdown()

        broker  = create_broker(_access_token)
        _engine = TradingEngine(
            broker           = broker,
            instrument_token = int(token),
            symbol           = symbol,
            qty              = int(qty),
            interval         = interval,
            exchange         = exchange,
        )
        _engine.start()
        await emit("engine:state", _engine.status())
        log.info("Engine started: %s %s qty=%d", symbol, interval, qty)
    except Exception as exc:
        log.error("engine:start failed: %s", exc)
        await sio.emit("error", {"message": str(exc)}, to=sid)


@sio.on("engine:stop")
async def on_engine_stop(sid, data: dict):
    if not _engine:
        return
    # Run in thread — stop() calls place_order (blocking HTTP), must not block event loop
    await asyncio.to_thread(_engine.stop)
    await emit("engine:state", _engine.status())


@sio.on("position:exit")
async def on_position_exit(sid, data: dict):
    """Manually exit the open position. Engine stays RUNNING — will take new entries."""
    if not _engine:
        return
    await asyncio.to_thread(_engine.exit_position)
    await emit("engine:state", _engine.status())


@sio.on("engine:pause")
async def on_engine_pause(sid, data: dict):
    if _engine:
        _engine.pause()
        await emit("engine:state", _engine.status())


@sio.on("engine:resume")
async def on_engine_resume(sid, data: dict):
    if _engine:
        _engine.resume()
        await emit("engine:state", _engine.status())


@sio.on("indicator:toggle")
async def on_indicator_toggle(sid, data: dict):
    """
    Enable or disable an indicator at runtime.
    data: {name: "supertrend" | "atr", enabled: bool}
    """
    name    = data.get("name")
    enabled = bool(data.get("enabled", True))

    if name == "supertrend":
        settings.use_supertrend = enabled
        log.info("Supertrend indicator %s", "ENABLED" if enabled else "DISABLED")
    elif name == "atr":
        settings.use_atr = enabled
        log.info("ATR indicator %s", "ENABLED" if enabled else "DISABLED")
    else:
        await sio.emit("error", {"message": f"Unknown indicator: {name}"}, to=sid)
        return

    await emit("indicator:state", {"name": name, "enabled": enabled})


@sio.on("indicator:settings")
async def on_indicator_settings(sid, data: dict):
    """
    Update indicator parameters at runtime (no engine restart needed).
    data for supertrend: {name: "supertrend", length: int, multiplier: float}
    data for atr:        {name: "atr", period: int, threshold: float}
    """
    name = data.get("name")

    if name == "supertrend":
        length     = int(data.get("length", settings.st_length))
        multiplier = float(data.get("multiplier", settings.st_multiplier))
        settings.st_length     = length
        settings.st_multiplier = multiplier
        log.info("Supertrend settings updated — length=%d multiplier=%.1f", length, multiplier)
        await emit("indicator:settings:applied", {"name": "supertrend", "length": length, "multiplier": multiplier})

    elif name == "atr":
        period    = int(data.get("period", settings.atr_period))
        threshold = float(data.get("threshold", settings.atr_threshold))
        settings.atr_period    = period
        settings.atr_threshold = threshold
        log.info("ATR settings updated — period=%d threshold=%.2f", period, threshold)
        await emit("indicator:settings:applied", {"name": "atr", "period": period, "threshold": threshold})

    else:
        await sio.emit("error", {"message": f"Unknown indicator: {name}"}, to=sid)


@sio.on("exit:settings")
async def on_exit_settings(sid, data: dict):
    """
    Update exit condition parameters at runtime — no engine restart needed.
    exit_manager.check() reads settings live on every tick so changes take
    effect immediately on the next tick.

    Any subset of fields can be sent — only provided keys are updated.
    data: {
        target_type?:      "points" | "percentage" | "atr_multiple"
        target_value?:     float
        sl_type?:          "points" | "percentage"
        sl_value?:         float
        trailing_sl?:      bool
        trail_value?:      float
        exit_on_st_red?:   bool
        session_end_time?: "HH:MM"
    }
    """
    if "target_type" in data:
        val = data["target_type"]
        if val not in ("points", "percentage", "atr_multiple"):
            await sio.emit("error", {"message": f"Invalid target_type: {val}"}, to=sid)
            return
        settings.target_type = val

    if "target_value" in data:
        settings.target_value = float(data["target_value"])

    if "sl_type" in data:
        val = data["sl_type"]
        if val not in ("points", "percentage"):
            await sio.emit("error", {"message": f"Invalid sl_type: {val}"}, to=sid)
            return
        settings.sl_type = val

    if "sl_value" in data:
        settings.sl_value = float(data["sl_value"])

    if "trailing_sl" in data:
        settings.trailing_sl = bool(data["trailing_sl"])

    if "trail_value" in data:
        settings.trail_value = float(data["trail_value"])

    if "exit_on_st_red" in data:
        settings.exit_on_st_red = bool(data["exit_on_st_red"])

    if "session_end_time" in data:
        settings.session_end_time = str(data["session_end_time"])

    log.info(
        "Exit settings updated — target=%s/%.2f | sl=%s/%.2f | trail=%s/%.2f | st_red=%s | session_end=%s",
        settings.target_type, settings.target_value,
        settings.sl_type, settings.sl_value,
        settings.trailing_sl, settings.trail_value,
        settings.exit_on_st_red, settings.session_end_time,
    )
    await emit("exit:settings:applied", _current_exit_settings())


@sio.on("exit:settings:get")
async def on_exit_settings_get(sid, data: dict):
    """Return current exit settings to the requesting client only (for settings page load)."""
    await sio.emit("exit:settings:applied", _current_exit_settings(), to=sid)


def _current_exit_settings() -> dict:
    return {
        "target_type":      settings.target_type,
        "target_value":     settings.target_value,
        "sl_type":          settings.sl_type,
        "sl_value":         settings.sl_value,
        "trailing_sl":      settings.trailing_sl,
        "trail_value":      settings.trail_value,
        "exit_on_st_red":   settings.exit_on_st_red,
        "session_end_time": settings.session_end_time,
    }


@sio.on("mode:switch")
async def on_mode_switch(sid, data: dict):
    """
    Switch between forward_test and live mode.
    data: {mode: "forward_test" | "live"}
    Restarts the engine with the new broker if engine is running.
    """
    global _engine

    mode = data.get("mode")
    if mode not in ("forward_test", "live"):
        await sio.emit("error", {"message": "mode must be 'forward_test' or 'live'"}, to=sid)
        return

    settings.broker_mode = mode
    log.info("Broker mode switched to: %s", mode.upper())

    # If engine is running — restart with new broker
    if _engine and _engine.state.value == "RUNNING":
        symbol   = _engine.symbol
        token    = _engine.instrument_token
        qty      = _engine.qty
        interval = _engine.interval
        exchange = _engine.exchange

        await asyncio.to_thread(_engine.stop)
        broker  = create_broker(_access_token)
        _engine = TradingEngine(
            broker           = broker,
            instrument_token = token,
            symbol           = symbol,
            qty              = qty,
            interval         = interval,
            exchange         = exchange,
        )
        _engine.start()
        log.info("Engine restarted in %s mode", mode.upper())

    await emit("mode:state", {"mode": mode})


# ── Indicators subscription (lightweight — no engine, no orders) ──────────────
# Each connected client can subscribe to live indicator updates for any symbol.
# Backend fetches candles + calculates ST/ATR every 1s and emits indicators:data.

_ind_tasks: dict[str, asyncio.Task] = {}   # sid → asyncio.Task


async def _indicators_loop(sid: str, token: int, interval: str) -> None:
    """
    Warmup: fetch 100 candles once → calculate ST/ATR → cache state.
    Poll:   every 1s fetch 3 latest candles → compare timestamp →
            if new candle → recalculate ST/ATR → emit.
            Always emit current close from the latest tick.
    """
    from broker.zerodha import ZerodhaBroker
    from strategy.indicators import calculate_supertrend, calculate_atr

    broker = ZerodhaBroker()
    if _access_token:
        broker.set_access_token(_access_token)

    # Subscribe token to global KiteTicker so live ticks flow in
    zeroda.subscribe([token])
    log.info("indicators:loop START — sid=%s token=%d interval=%s", sid, token, interval)

    # Cached indicator state — only recalculated on new candle close
    st_val    = None
    atr_val   = None
    direction = "?"
    last_candle_ts = None
    base_df   = None   # initialized here so poll loop can safely check `base_df is not None`

    # ── WARMUP — fetch 100 candles once ──────────────────────────────────────
    try:
        df = await asyncio.to_thread(
            broker.get_candles,
            instrument_token=token,
            interval=interval,
            candle_count=100,
        )
        if not df.empty:
            base_df = df   # store raw candles as base for forming-candle updates
            if settings.use_supertrend:
                df = calculate_supertrend(df)
            if settings.use_atr:
                df = calculate_atr(df)

            last           = df.iloc[-1]
            last_candle_ts = df.index[-1]
            st_val    = round(float(last.get("supertrend", float("nan"))), 2) if "supertrend" in df.columns else None
            atr_val   = round(float(last.get("atr", 0.0)), 2)                if "atr"        in df.columns else None
            st_dir    = int(last.get("st_direction", 0))                      if "st_direction" in df.columns else 0
            direction = "GREEN" if st_dir == 1 else "RED" if st_dir == -1 else "?"
            log.info(
                "indicators:warmup done — close=%.2f ST=%s ATR=%s dir=%s ts=%s",
                float(last["close"]), st_val, atr_val, direction,
                last_candle_ts.strftime("%Y-%m-%d %H:%M:%S"),
            )
    except asyncio.CancelledError:
        return
    except Exception as exc:
        log.error("indicators:warmup error: %s", exc)

    # ── POLL — fetch 3 candles every 1s ──────────────────────────────────────
    while True:
        try:
            recent = await asyncio.to_thread(
                broker.get_candles,
                instrument_token=token,
                interval=interval,
                candle_count=3,
            )

            if not recent.empty and base_df is not None:
                current_ts = recent.index[-1]
                latest_row = recent.iloc[-1]
                new_candle = (last_candle_ts is not None and current_ts != last_candle_ts)

                # Live price: WebSocket last_price (real-time) else candle close (fallback)
                _tick      = zeroda.get_ticks().get(token)
                live_price = round(float(_tick["last_price"]), 2) if _tick and _tick.get("last_price") else round(float(latest_row["close"]), 2)

                if new_candle:
                    # New candle closed — fetch fresh 100 candles as new base
                    log.info("indicators:new candle — %s", current_ts.strftime("%H:%M:%S"))
                    fresh = await asyncio.to_thread(
                        broker.get_candles,
                        instrument_token=token,
                        interval=interval,
                        candle_count=100,
                    )
                    if not fresh.empty:
                        base_df = fresh
                    last_candle_ts = current_ts

                # Always update last row of base_df with forming candle values
                # so ST/ATR reflect the live forming candle every second
                live_df = base_df.copy()
                live_df.loc[current_ts, "open"]   = float(latest_row["open"])
                live_df.loc[current_ts, "high"]   = float(latest_row["high"])
                live_df.loc[current_ts, "low"]    = float(latest_row["low"])
                live_df.loc[current_ts, "close"]  = live_price
                live_df.loc[current_ts, "volume"] = float(latest_row["volume"])

                if settings.use_supertrend:
                    live_df = calculate_supertrend(live_df)
                if settings.use_atr:
                    live_df = calculate_atr(live_df)

                last      = live_df.iloc[-1]
                st_val    = round(float(last.get("supertrend", float("nan"))), 2) if "supertrend" in live_df.columns else None
                atr_val   = round(float(last.get("atr", 0.0)), 2)                if "atr"        in live_df.columns else None
                st_dir    = int(last.get("st_direction", 0))                      if "st_direction" in live_df.columns else 0
                direction = "GREEN" if st_dir == 1 else "RED" if st_dir == -1 else "?"
                ts        = current_ts.strftime("%H:%M:%S")

                log.info(
                    "indicators:emit — sid=%s close=%.2f ST=%s ATR=%s dir=%s%s",
                    sid, live_price, st_val, atr_val, direction,
                    " [NEW CANDLE]" if new_candle else "",
                )

                await sio.emit("indicators:data", {
                    "timestamp":  ts,
                    "close":      live_price,
                    "supertrend": st_val,
                    "atr":        atr_val,
                    "direction":  direction,
                    "new_candle": new_candle,
                }, to=sid)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            log.error("indicators:loop error: %s", exc)

        await asyncio.sleep(1)

    # Unsubscribe token from global KiteTicker on loop exit
    zeroda.unsubscribe([token])
    log.info("indicators:loop STOP — sid=%s", sid)


@sio.on("indicators:subscribe")
async def on_indicators_subscribe(sid: str, data: dict) -> None:
    """
    Client sends {token, interval} → start live indicator stream for that sid.
    """
    token    = int(data.get("token", 0))
    interval = data.get("interval", settings.timeframe)

    if not token:
        await sio.emit("error", {"message": "indicators:subscribe — token required"}, to=sid)
        return

    # Cancel existing task for this sid if any
    if sid in _ind_tasks:
        _ind_tasks[sid].cancel()

    loop = asyncio.get_event_loop()
    task = loop.create_task(_indicators_loop(sid, token, interval))
    _ind_tasks[sid] = task
    log.info("indicators:subscribe — sid=%s token=%d interval=%s", sid, token, interval)


@sio.on("indicators:unsubscribe")
async def on_indicators_unsubscribe(sid: str, data: dict) -> None:
    """Cancel the indicator stream for this client."""
    if sid in _ind_tasks:
        _ind_tasks[sid].cancel()
        del _ind_tasks[sid]
    log.info("indicators:unsubscribe — sid=%s", sid)


@sio.on("tradelog:fetch")
async def on_tradelog_fetch(sid: str, data: dict) -> None:
    """
    Client sends {limit?} → server returns last N trade log entries.
    Emits "tradelog:history" back to that client only.
    """
    limit = int(data.get("limit", 100)) if data else 100
    logs  = await get_trade_logs(limit)
    await sio.emit("tradelog:history", logs, to=sid)


@sio.event
async def disconnect(sid):  # noqa: F811 — override the one above
    log.info("Socket.IO client disconnected: %s", sid)
    # Clean up indicator task if client disconnects
    if sid in _ind_tasks:
        _ind_tasks[sid].cancel()
        del _ind_tasks[sid]


# ── ASGI app — wraps FastAPI with Socket.IO ───────────────────────────────────
# This is what uvicorn serves.

app = socketio.ASGIApp(sio, fastapi_app)
