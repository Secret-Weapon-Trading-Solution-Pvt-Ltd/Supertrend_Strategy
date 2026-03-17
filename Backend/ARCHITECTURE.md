# SWTS — Folder & File Architecture Guide
**Super Trend Trading System — Purpose of Every File and Folder**

---

## Folder Structure Overview

```
Backend/
├── broker/
│   ├── __init__.py
│   ├── base.py
│   ├── zerodha.py
│   └── forward_test.py
│
├── strategy/
│   ├── __init__.py
│   ├── indicators.py
│   ├── signals.py
│   └── exit_manager.py
│
├── engine/
│   ├── __init__.py
│   ├── trading_engine.py
│   └── position.py
│
├── segments/
│   ├── __init__.py
│   ├── equity.py
│   └── fno.py
│
├── config/
│   ├── __init__.py
│   └── settings.py
│
├── models/
│   ├── __init__.py
│   ├── database.py
│   ├── trade.py
│   └── position.py
│
├── api/
│   ├── __init__.py
│   ├── auth.py
│   ├── routes_engine.py
│   ├── routes_market.py
│   └── routes_trades.py
│
├── scheduler/
│   ├── __init__.py
│   └── jobs.py
│
├── tests/
│   ├── __init__.py
│   ├── test_indicators.py
│   ├── test_engine.py
│   └── test_broker.py
│
├── templates/
│   └── index.html
│
├── logs/
│
├── main.py
├── zeroda.py
├── .env
├── docker-compose.yml
├── nginx.conf
├── Dockerfile
└── requirements.txt
```

---

## broker/ — The Phone Room (Talks to Zerodha)

> Think of this as the receptionist whose ONLY job is communicating with Zerodha.
> No strategy logic lives here. No database calls. Just broker communication.

### `base.py`
- **What it is:** A contract / job description
- **What it does:** Defines rules that every broker must follow — place_order, cancel_order, get_ltp, get_instruments, get_historical_data
- **Real life:** Like a job description that says "whoever sits at this desk must know how to do these 6 tasks"
- **Why it exists:** So the rest of the system never cares whether it's talking to Zerodha or a simulator — both speak the same language

### `zerodha.py`
- **What it is:** The real Zerodha broker implementation
- **What it does:** Actually calls Kite Connect API — login, place live orders, fetch candles, stream live ticks via WebSocket
- **Real life:** The actual receptionist who picks up the phone and calls Zerodha
- **Used when:** `broker_mode = "live"` in settings

### `forward_test.py`
- **What it is:** A simulated broker (paper trading)
- **What it does:** Pretends to place orders using live market prices — no real money moves, maintains a virtual order book
- **Real life:** A trainee receptionist who practices calls without actually dialing
- **Used when:** `broker_mode = "forward_test"` in settings

---

## strategy/ — The Analyst's Desk (Brain of the System)

> The analyst reads charts and gives signals. He never places orders himself.
> Pure calculation only — no database, no API calls, no broker communication.

### `indicators.py`
- **What it is:** Math engine
- **What it does:** Takes OHLCV candle data as input → calculates Supertrend values and ATR values → returns results
- **Real life:** Analyst drawing Supertrend lines on a chart
- **Inputs:** List of candles (open, high, low, close, volume)
- **Outputs:** Supertrend direction (green/red), ATR value per candle

### `signals.py`
- **What it is:** Confluence decision maker
- **What it does:** Combines indicator results based on which are enabled → decides if entry condition is met
- **Real life:** Analyst saying "Both ST is green AND ATR is above threshold → confirmed BUY signal"
- **Confluence rules:**
  - ST only → enter when ST flips green
  - ST + ATR → enter when ST flips green AND ATR > threshold
  - ATR only → no signal (ATR cannot generate entry alone)

### `exit_manager.py`
- **What it is:** The exit watchdog
- **What it does:** Checks every tick against all 5 exit conditions in priority order → returns exit reason if triggered
- **Real life:** Analyst watching the open trade and shouting "EXIT!" when any condition hits
- **Exit priority order:**
  1. End of Session (3:15 PM square-off)
  2. Fixed Stop Loss
  3. Trailing Stop Loss
  4. Target (Take Profit)
  5. Supertrend turns Red

---

## engine/ — The Trading Floor Manager

> The person who runs the whole show. Coordinates analyst + broker every candle.
> Controls the state: IDLE → RUNNING ↔ PAUSED → STOPPED

### `trading_engine.py`
- **What it is:** The central coordinator and state machine
- **What it does:** On every new candle — calls indicators → calls signals → if signal: calls broker to place order → calls exit_manager to check exits → updates positions
- **Real life:** Floor manager who tells analyst to check charts, then calls broker desk if signal appears
- **States:**
  - `IDLE` — Logged in, not watching anything. No orders possible.
  - `RUNNING` — Actively scanning every candle for signals and managing open positions
  - `PAUSED` — No new entries allowed, but existing open positions are still monitored and exits still work
  - `STOPPED` — All positions square-off, WebSocket disconnected, done for the day

### `position.py` (engine)
- **What it is:** The live position register (in-memory, real-time)
- **What it does:** Tracks every currently open trade — entry price, current price, unrealized P&L, current SL price, current trailing SL price, target price
- **Real life:** Whiteboard on the trading floor showing all open positions right now
- **Note:** This is the LIVE in-memory tracker. Permanent records go to `models/position.py` (database).

---

## segments/ — Product Desks

> Two different products have different rules. Each has its own desk.

### `equity.py`
- **What it is:** NSE equity handler (Week 1)
- **What it does:** Handles equity-specific rules — MIS product type, validates instrument is NSE listed, handles intraday square-off, no lot sizing needed
- **Real life:** Equity desk that only trades shares

### `fno.py`
- **What it is:** Futures & Options handler (Week 2)
- **What it does:** Handles F&O-specific rules — lot sizing, strike selection (ATM ± offset), expiry management, rollover logic, premium filter for options
- **Real life:** Derivatives desk that handles futures and options contracts
- **F&O specific:** Auto-rollover 2 days before expiry, weekly vs monthly expiry selection

---

## config/ — The Settings Room

> One place for all configuration. Everyone reads from here. No one reads .env directly.

### `settings.py`
- **What it is:** Single source of truth for all configuration
- **What it does:** Reads `.env` file at startup → validates every value using Pydantic → exposes a `settings` object that any module can import
- **Real life:** The master register with all knobs and switches — one book, everyone refers to it
- **Why it exists:** Instead of every file doing `os.environ["KITE_API_KEY"]` with no validation, one place reads and validates everything. If a required key is missing, you get a clear error at startup — not a crash deep inside trading logic.
- **Contains:** Zerodha credentials, DB URL, Keycloak config, trading mode, indicator parameters, risk settings

---

## models/ — The Record Room (Database)

> Permanent storage. Everything that happened is written here forever.

### `database.py`
- **What it is:** The database connection manager
- **What it does:** Creates the PostgreSQL connection, session factory, and SQLAlchemy Base class
- **Real life:** The master key to the filing cabinet room — one key, shared by all
- **Provides:** `get_db()` — a FastAPI dependency that gives each request a fresh DB session and closes it automatically when done

### `trade.py`
- **What it is:** The trade record format (database table definition)
- **What it does:** Defines every column of the `trades` table — symbol, entry time, exit time, entry price, exit price, P&L, exit reason, mode (forward_test/live)
- **Real life:** The printed trade ticket format that gets filed after every trade closes

### `position.py` (models)
- **What it is:** The position record format (database table definition)
- **What it does:** Defines every column of the `positions` table — current price, unrealized P&L, SL price, trailing SL price, status (OPEN/CLOSED)
- **Real life:** The position slip that is updated every few seconds and filed when position closes
- **Note:** This is the DATABASE version. The live in-memory tracker is `engine/position.py`.

---

## api/ — The Reception Window (What the Dashboard Talks To)

> React dashboard sends requests here. This folder is the only thing the outside world touches.

### `auth.py`
- **What it is:** Security guard / JWT middleware
- **What it does:** Intercepts every API request → validates Keycloak JWT token → rejects unauthorized calls → injects user identity into request
- **Real life:** Security guard at the office entrance who checks ID badges before letting anyone in

### `routes_engine.py`
- **What it is:** Engine control panel endpoints
- **What it does:** Exposes `/engine/start`, `/engine/stop`, `/engine/pause`, `/engine/status` — these buttons on the dashboard call these routes
- **Real life:** The control panel buttons that the trader clicks on the React dashboard

### `routes_market.py`
- **What it is:** Market data endpoints
- **What it does:** Instrument search (from Zerodha symbol master), live tick streaming via WebSocket, candle data fetch
- **Real life:** The market data screen — searchable dropdown for instruments, live price feed

### `routes_trades.py`
- **What it is:** Trade history endpoints
- **What it does:** Fetch past trades, P&L reports, position history, forward test results
- **Real life:** The trade log screen — shows what happened today and historically

---

## scheduler/ — The Alarm Clock

> Runs tasks automatically at specific times. No human needs to press anything.

### `jobs.py`
- **What it is:** Scheduled task definitions
- **What it does:**
  - **8:30 AM IST** — Auto-login to Zerodha (TOTP-based, no manual intervention)
  - **9:15 AM IST** — Market open — initialize WebSocket, load instruments
  - **3:15 PM IST** — Auto square-off all open positions (session end)
  - **Daily** — Refresh Zerodha instrument master (new listings, lot size changes)
- **Real life:** The office alarm clock that triggers specific tasks at specific times

---

## tests/ — Quality Check Room

> Before anything goes live or is merged, it must pass these tests.

### `test_indicators.py`
- Tests Supertrend and ATR math with known candle data — verifies the numbers are correct

### `test_engine.py`
- Tests state machine transitions — IDLE → RUNNING → PAUSED → STOPPED work correctly
- Tests that PAUSED still monitors exits but blocks new entries

### `test_broker.py`
- Tests ForwardTestBroker order simulation logic
- Tests ZerodhaBroker auth flow (with mock API)

---

## Root-Level Files

### `main.py`
- **What it is:** The front door of the entire application
- **What it does:** Creates the FastAPI app, registers all routers from `api/`, starts the scheduler, initializes the database on startup
- **Real life:** The building entrance — everything starts here

### `zeroda.py`
- **What it is:** Existing file (already written)
- **What it does:** Current Zerodha auth + WebSocket implementation
- **Plan:** Contents will be refactored into `broker/zerodha.py` on Day 2

### `.env`
- **What it is:** Secret credentials file
- **What it does:** Stores API keys, passwords, database URL, Keycloak secrets
- **CRITICAL:** Never commit to Git. Already in `.gitignore`.

### `docker-compose.yml`
- **What it is:** Local development stack definition
- **What it does:** One command (`docker compose up`) starts 4 services: PostgreSQL + Keycloak + Backend + Nginx
- **Real life:** The blueprint that sets up the entire office with one instruction

### `nginx.conf`
- **What it is:** Traffic routing rules
- **What it does:** Routes all traffic through one port (80) — `/` goes to React, `/api/` goes to FastAPI, `/auth/` goes to Keycloak, `/ws/` goes to WebSocket
- **Why needed:** Without this, the browser blocks cross-origin requests (CORS errors)

### `Dockerfile`
- **What it is:** Recipe to package the backend
- **What it does:** Defines how to build a Docker container image for the FastAPI backend

### `requirements.txt`
- **What it is:** Python dependency list
- **What it does:** `pip install -r requirements.txt` installs everything the project needs

### `logs/`
- **What it is:** Log file storage folder
- **What it does:** Stores application logs — what happened, when, and any errors

### `templates/`
- **What it is:** Existing login HTML page
- **What it does:** Served by FastAPI for the initial Zerodha OAuth login flow

---

---

## Final Connection — How All Files Talk to Each Other

```
                         ┌─────────────┐
                         │  .env file  │
                         └──────┬──────┘
                                │ read once at startup
                         ┌──────▼──────┐
                         │  config/    │
                         │ settings.py │  ◄── every module imports from here
                         └──────┬──────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
   ┌──────▼──────┐      ┌───────▼──────┐      ┌───────▼──────┐
   │  scheduler/ │      │   models/    │      │    broker/   │
   │   jobs.py   │      │  database.py │      │   base.py    │
   │             │      │  trade.py    │      │  zerodha.py  │
   │ 8:30AM login│      │ position.py  │      │ forward_test │
   └──────┬──────┘      └───────┬──────┘      └───────┬──────┘
          │                     │ save records         │ place/cancel orders
          │              ┌──────▼──────┐               │ get prices
          │              │ PostgreSQL  │               │ get candles
          │              │  Database   │               │
          │              └─────────────┘      ┌────────▼────────┐
          │                                   │    segments/    │
          │                                   │   equity.py     │
          │                                   │    fno.py       │
          │                                   └────────┬────────┘
          │                                            │ segment-specific rules
          │                                   ┌────────▼────────┐
          │                                   │   strategy/     │
          │                                   │ indicators.py   │ ◄── reads candles
          │                                   │   signals.py    │ ◄── confluence logic
          │                                   │ exit_manager.py │ ◄── checks exits
          │                                   └────────┬────────┘
          │                                            │ signals + exit triggers
          └───────────────────────────────────►┌───────▼────────┐
                                               │    engine/     │
                                               │trading_engine  │ ◄── the coordinator
                                               │  position.py   │ ◄── live P&L tracker
                                               └───────┬────────┘
                                                       │ exposes state + data
                                               ┌───────▼────────┐
                                               │     api/       │
                                               │   auth.py      │ ◄── JWT guard
                                               │routes_engine   │ ◄── start/stop/pause
                                               │routes_market   │ ◄── instruments/ticks
                                               │routes_trades   │ ◄── history/P&L
                                               └───────┬────────┘
                                                       │ HTTP + WebSocket
                                               ┌───────▼────────┐
                                               │    main.py     │ ◄── FastAPI app entry
                                               └───────┬────────┘
                                                       │
                                               ┌───────▼────────┐
                                               │   nginx.conf   │ ◄── reverse proxy
                                               └───────┬────────┘
                                                       │ port 80
                                               ┌───────▼────────┐
                                               │React Dashboard │
                                               │   frontend/    │
                                               └────────────────┘
```

---

## Data Flow in One Line per Step

```
1. STARTUP      scheduler/jobs.py        → 8:30 AM auto-login via broker/zerodha.py
2. CONFIG       config/settings.py       → all modules read settings from here
3. MARKET OPEN  engine/trading_engine.py → state: IDLE → RUNNING
4. CANDLE DATA  broker/zerodha.py        → fetch OHLCV candles from Kite Historical API
5. CALCULATE    strategy/indicators.py   → compute Supertrend + ATR values
6. SIGNAL CHECK strategy/signals.py      → confluence logic → BUY signal confirmed?
7. SEGMENT RULE segments/equity.py       → is it NSE? MIS? within position limit?
8. PLACE ORDER  broker/zerodha.py        → live | broker/forward_test.py → paper
9. TRACK        engine/position.py       → update live P&L every tick
10. EXIT CHECK  strategy/exit_manager.py → SL hit? Target? ST red? Session end?
11. SAVE RECORD models/trade.py          → write closed trade to PostgreSQL
12. DASHBOARD   api/routes_trades.py     → React fetches updated P&L and trade log
```

---

## Module Dependency Rules (What Can Import What)

```
config/      ← imported by EVERYONE (no imports itself except pydantic)
models/      ← imported by: engine, api, scheduler
broker/      ← imported by: engine only
strategy/    ← imported by: engine only
segments/    ← imported by: engine only
engine/      ← imported by: api only
api/         ← imported by: main.py only
scheduler/   ← imported by: main.py only
```

> **Rule:** Lower layers never import from upper layers.
> strategy never imports from engine. broker never imports from strategy.
> This prevents circular imports as the codebase grows.
