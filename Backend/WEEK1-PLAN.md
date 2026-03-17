# SWTS — Week 1 Build Plan (4 Days)
**Super Trend Trading System — Equity Segment**

**Team:** Person A (Backend) + Person B (Infra/Frontend)
**Already Done:** `zeroda.py`, `main.py`, `templates/`, `test_auth.py`, `requirements.txt`
**Goal:** Fully working equity trading system — Keycloak auth, React dashboard, strategy running on NSE stocks in forward test mode.

---

## Current Status

```
DONE ✓
  zeroda.py        ← Zerodha auth, session, WebSocket ticker
  main.py          ← FastAPI server, OAuth routes, ticker API
  templates/       ← Login page UI
  test_auth.py     ← Auth flow tester
  requirements.txt ← All dependencies
  .env             ← API key/secret (needs USER_ID, PASSWORD, TOTP_KEY added)
```

---

## Final Folder Structure (target)

```
Backend/
  broker/
    __init__.py
    base.py               ← BrokerABC interface
    zerodha.py            ← ZerodhaBroker class
    forward_test.py       ← ForwardTestBroker (simulated)
  strategy/
    __init__.py
    indicators.py         ← Supertrend + ATR calculation
    signals.py            ← confluence logic
    exit_manager.py       ← 5 exit conditions
  engine/
    __init__.py
    trading_engine.py     ← state machine + main loop
    position.py           ← position book + P&L
  config/
    __init__.py
    settings.py           ← Pydantic settings
  models/
    __init__.py
    database.py           ← SQLAlchemy engine + session
    trade.py              ← Trade DB model
    position.py           ← Position DB model
  api/
    __init__.py
    auth.py               ← Keycloak JWT middleware
    routes_engine.py      ← engine control routes
    routes_market.py      ← instruments, ticks
  frontend/               ← React + Vite + TypeScript
  templates/              ← existing login HTML
  main.py                 ← FastAPI entry point
  zeroda.py               ← existing (refactored Day 2)
  test_auth.py            ← existing
  docker-compose.yml      ← built Day 1
  nginx.conf              ← built Day 1
  .env
  requirements.txt
  WEEK1-PLAN.md
```

---

---

# DAY 1 — Architecture + Docker + Keycloak + Database

**Goal:** Everything that every other module depends on is running before writing a single line of trading logic.

---

## Morning — Both Together (2 Hours)

### TASK 1.1 — Git Branch Strategy
**Who:** Both together
**Purpose:** Two people working on the same files without a branching strategy will overwrite each other's work. This takes 10 minutes and saves hours of merge conflicts over 4 days.

```
main          ← production-ready only
dev           ← all work merges here
feature/xxx   ← each person works on their own branch
```

**Rule:** Nobody pushes directly to `main`. Pull requests only into `dev`.

---

### TASK 1.2 — Create Full Folder Structure
**Who:** Both together (Person A types, Person B reviews)
**Purpose:** Without structure, as the codebase grows beyond 5 files everything becomes impossible to find and circular imports appear. This folder layout matches the plan exactly — each folder = one responsibility. Python needs `__init__.py` in every folder to treat it as a module.

```bash
# Create all folders
mkdir -p broker strategy engine config models api frontend

# Create empty __init__.py in each
touch broker/__init__.py strategy/__init__.py engine/__init__.py
touch config/__init__.py models/__init__.py api/__init__.py
```

**How to verify:** `python -c "import broker; import strategy; import engine"` — no errors.

---

### TASK 1.3 — `docker-compose.yml` — Local Dev Stack
**Who:** Person B writes, Person A reviews
**Purpose:** Without Docker, each team member needs to manually install PostgreSQL and Keycloak — 2 hours of setup that breaks differently on every machine. Docker makes `docker compose up` work identically for everyone. `depends_on` ensures services start in the right order. `volumes: - .:/app` mounts code inside the container so `--reload` picks up file changes instantly.

```yaml
version: "3.9"

services:

  postgres:
    image: postgres:16-alpine
    container_name: swts_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB:       swts
      POSTGRES_USER:     swts_user
      POSTGRES_PASSWORD: swts_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: swts_keycloak
    restart: unless-stopped
    command: start-dev
    environment:
      KEYCLOAK_ADMIN:          admin
      KEYCLOAK_ADMIN_PASSWORD: admin123
      KC_DB:                   postgres
      KC_DB_URL:               jdbc:postgresql://postgres:5432/swts
      KC_DB_USERNAME:          swts_user
      KC_DB_PASSWORD:          swts_pass
      KC_HTTP_PORT:            8080
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  backend:
    build: .
    container_name: swts_backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - .:/app
    depends_on:
      - postgres
      - keycloak
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  nginx:
    image: nginx:alpine
    container_name: swts_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
      - keycloak

volumes:
  postgres_data:
```

**Test:** `docker compose up -d` → all 4 containers show `Up` in `docker compose ps`.

---

### TASK 1.4 — `nginx.conf` — Local Reverse Proxy
**Who:** Person B
**Purpose:** React (port 3000), FastAPI (port 8000), and Keycloak (port 8080) are three separate servers. Without Nginx, the browser blocks cross-origin requests (CORS errors). Nginx makes everything appear as one server on port 80. This is exactly what production uses too — no surprises when you deploy.

```nginx
server {
    listen 80;

    # React frontend
    location / {
        proxy_pass http://host.docker.internal:3000;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # FastAPI backend
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Keycloak auth
    location /auth/ {
        proxy_pass http://keycloak:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
    }

    # WebSocket for live ticks
    location /ws/ {
        proxy_pass http://backend:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Test:** `http://localhost` → Nginx responds. `http://localhost/auth/` → Keycloak login page.

---

## Afternoon — Split Work

---

## Person A — Config + Database (3 Hours)

### TASK 1.5 — Complete `.env` File
**Who:** Person A
**Purpose:** `test_auth.py` references `zeroda.USER_ID`, `zeroda.PASSWORD`, `zeroda.TOTP_KEY` — these are missing from `.env`. Right now `test_auth.py` crashes immediately. Fill this now so auto-login works on Day 2.

```env
# Zerodha
KITE_API_KEY=asbnxkmgnkx3ed6r
KITE_API_SECRET=lqzt9jn85dbeqv1i8t4g1lvvknepq8gf
KITE_USER_ID=your_client_id
KITE_PASSWORD=your_password
KITE_TOTP_KEY=your_base32_totp_secret

# Database
DATABASE_URL=postgresql://swts_user:swts_pass@localhost:5432/swts

# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=swts
KEYCLOAK_CLIENT_ID=swts-backend
KEYCLOAK_CLIENT_SECRET=paste_from_keycloak_after_task_1.11
```

**Test:** `python test_auth.py` — all 6 steps pass.

---

### TASK 1.6 — `config/settings.py` — Pydantic Settings
**Who:** Person A
**Purpose:** Right now `zeroda.py` has `os.environ["KITE_API_KEY"]` scattered inline. As more modules are added, every file reads env vars differently with different defaults and no validation. If a required key is missing you get a crash deep inside trading logic. Pydantic Settings reads `.env` once, validates every value at startup with clear error messages, and gives a single `settings` object any module can import.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Zerodha credentials
    kite_api_key:    str
    kite_api_secret: str
    kite_user_id:    str
    kite_password:   str
    kite_totp_key:   str

    # Database
    database_url: str = "postgresql://swts_user:swts_pass@localhost:5432/swts"

    # Keycloak
    keycloak_url:           str = "http://localhost:8080"
    keycloak_realm:         str = "swts"
    keycloak_client_id:     str = "swts-backend"
    keycloak_client_secret: str = ""

    # Trading mode
    broker_mode: str = "forward_test"   # "forward_test" or "live"
    segment:     str = "equity"
    timeframe:   str = "5minute"

    # Indicator toggles
    use_supertrend: bool = True
    use_atr:        bool = True

    # Supertrend params
    st_length:     int   = 10
    st_multiplier: float = 3.0

    # ATR params
    atr_period:    int   = 14
    atr_threshold: float = 1.0

    # Risk / exits
    max_open_positions: int   = 3
    session_end_time:   str   = "15:15"
    target_type:        str   = "points"
    target_value:       float = 20.0
    sl_type:            str   = "points"
    sl_value:           float = 10.0
    trailing_sl:        bool  = True
    trail_value:        float = 5.0
    exit_on_st_red:     bool  = True

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
```

**Test:** `python -c "from config.settings import settings; print(settings.broker_mode)"` → prints `forward_test`.

---

### TASK 1.7 — `models/database.py` — Database Connection
**Who:** Person A
**Purpose:** The database stores every trade, position, and P&L snapshot. This file creates the one connection that every part of the app uses. `get_db()` is a FastAPI dependency — routes use it to get a session per request and close it automatically when done.

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config.settings import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### TASK 1.8 — `models/trade.py` + `models/position.py` — DB Models
**Who:** Person A
**Purpose:** Every signal, entry, and exit must be recorded. Without this you cannot review what the strategy did, debug wrong exits, or analyse performance. The `exit_reason` column tells you exactly why each trade closed. The `mode` column separates forward test trades from live trades in the same table.

**Trade columns:**
```
id, symbol, instrument_token, entry_time, exit_time,
entry_price, exit_price, quantity, side (BUY),
exit_reason (TARGET / FIXED_SL / TRAILING_SL / SESSION_END / ST_RED),
pnl, brokerage, net_pnl, broker_order_id,
mode (forward_test / live), created_at
```

**Position columns:**
```
id, symbol, instrument_token, entry_time, entry_price,
quantity, current_price, unrealized_pnl, sl_price,
trail_sl_price, target_price, status (OPEN / CLOSED),
mode, created_at
```

**Test:** Call `Base.metadata.create_all(engine)` → verify tables exist in PostgreSQL.

---

## Person B — Keycloak Setup (3 Hours)

### TASK 1.9 — Access Keycloak Admin Console
**Who:** Person B
**Purpose:** Keycloak needs one-time manual configuration — realm, clients, roles, users. After this is exported to JSON and committed to Git, any team member can restore it in seconds.

```
URL:      http://localhost:8080
Username: admin
Password: admin123
```

---

### TASK 1.10 — Create Realm: `swts`
**Who:** Person B
**Purpose:** A realm is an isolated universe in Keycloak — its own users, roles, and clients. Using the default `master` realm for your app is bad practice (it's Keycloak's admin realm). The `swts` realm is completely separate.

```
Keycloak Admin → Create Realm → Name: swts → Create
```

---

### TASK 1.11 — Create Keycloak Clients
**Who:** Person B
**Purpose:** `swts-backend` is what FastAPI uses to verify tokens — confidential because the server can keep a secret. `swts-frontend` is what React uses to redirect users to login — public because JavaScript code is visible to anyone. Two separate clients = two separate permission sets.

**Client 1 — `swts-backend`:**
```
Client ID:          swts-backend
Client Protocol:    openid-connect
Access Type:        confidential
Service Accounts:   enabled
Valid Redirect URIs: http://localhost:8000/*
Web Origins:        http://localhost
```
→ Credentials tab → copy Secret → add to `.env` as `KEYCLOAK_CLIENT_SECRET`

**Client 2 — `swts-frontend`:**
```
Client ID:           swts-frontend
Client Protocol:     openid-connect
Access Type:         public
Valid Redirect URIs: http://localhost:3000/*
Web Origins:         http://localhost:3000
```

---

### TASK 1.12 — Create Roles + Test Users
**Who:** Person B
**Purpose:** Role-based access ensures the trader cannot access admin routes. Without roles, everyone who logs in has equal power to change configuration, wipe trades, or switch to live mode.

**Roles** (Realm Roles → Create):
```
trader  ← can start/stop engine, view dashboard
admin   ← everything trader can + manage config, view all users
```

**Test Users** (Users → Add User):
```
Username: trader1  | Email: trader1@swts.local | Role: trader | Temp password: OFF
Username: admin1   | Email: admin1@swts.local  | Role: admin  | Temp password: OFF
```

---

### TASK 1.13 — Export Keycloak Realm Config
**Who:** Person B
**Purpose:** Keycloak stores config in PostgreSQL. If the database is wiped, all setup is lost. Exporting the JSON means any team member can import it fresh — infrastructure as code for Keycloak.

```
Keycloak Admin → Realm Settings → Export → Include clients: YES
Save as: keycloak-realm-swts.json
Commit to Git
```

---

## Day 1 End — Verify Everything

```bash
docker compose up -d
docker compose ps               # all 4 containers: Up

# URLs to check:
# http://localhost               → Nginx responds
# http://localhost:8080          → Keycloak login page
# http://localhost:8000          → FastAPI running
# http://localhost:8000/status   → {"logged_in": false}

python test_auth.py             # all 6 steps PASS
```

---

---

# DAY 2 — Broker Layer + Keycloak JWT in FastAPI + React Setup

**Goal:** ZerodhaBroker class refactored, ForwardTestBroker built, FastAPI routes protected by Keycloak JWT, React project created with Keycloak SSO working.

---

## Person A — Broker Layer (Full Day)

### TASK 2.1 — `broker/base.py` — BrokerABC Interface
**Who:** Person A
**Purpose:** The strategy engine never imports `ZerodhaBroker` or `ForwardTestBroker` directly — it only talks to `BrokerABC`. This means the engine switches between real and simulated broker by changing one config line — zero code changes elsewhere. Without this interface, switching modes requires changing code in 10 places. Most important architectural decision of the whole project.

```python
from abc import ABC, abstractmethod
import pandas as pd

class BrokerABC(ABC):

    @abstractmethod
    def place_order(self, symbol: str, token: int, qty: int,
                    transaction_type: str, product: str,
                    order_type: str, price: float = 0) -> str: ...

    @abstractmethod
    def cancel_order(self, order_id: str) -> None: ...

    @abstractmethod
    def get_positions(self) -> list[dict]: ...

    @abstractmethod
    def get_order_status(self, order_id: str) -> dict: ...

    @abstractmethod
    def get_ltp(self, tokens: list[int]) -> dict: ...

    @abstractmethod
    def get_candles(self, token: int, interval: str,
                    from_date, to_date) -> pd.DataFrame: ...

    @abstractmethod
    def get_instruments(self, exchange: str) -> list[dict]: ...

    @abstractmethod
    def subscribe_ticks(self, tokens: list[int]) -> None: ...

    @abstractmethod
    def get_latest_ticks(self) -> dict: ...
```

---

### TASK 2.2 — `broker/zerodha.py` — ZerodhaBroker Class
**Who:** Person A
**Purpose:** `zeroda.py` currently uses global variables and module-level code — impossible to test, impossible to mock, impossible to have two instances. Converting to a class fixes all of this. All logic is the same, just reorganised. The existing `zeroda.py` stays untouched until Day 4 when `main.py` is updated.

```python
class ZerodhaBroker(BrokerABC):

    def __init__(self, settings):
        self.api_key  = settings.kite_api_key
        self.api_secret = settings.kite_api_secret
        self.user_id  = settings.kite_user_id
        self.password = settings.kite_password
        self.totp_key = settings.kite_totp_key
        self.kite     = KiteConnect(api_key=self.api_key)
        self._ticker  = None
        self._ticks   = {}
        self._subscribed_tokens = []
        self._ticker_connected  = False

    # Auth methods (move from zeroda.py)
    def auto_login(self): ...
    def exchange_token(self, request_token): ...
    def verify_session(self): ...
    def save_session(self): ...
    def load_session(self): ...
    def load_and_verify_session(self): ...

    # BrokerABC implementation
    def place_order(self, symbol, token, qty, transaction_type,
                    product, order_type, price=0):
        return self.kite.place_order(
            tradingsymbol=symbol,
            exchange=self.kite.EXCHANGE_NSE,
            transaction_type=transaction_type,
            quantity=qty,
            product=product,
            order_type=order_type,
            price=price,
            variety=self.kite.VARIETY_REGULAR,
        )

    def get_ltp(self, tokens):
        return self.kite.ltp(tokens)

    def get_positions(self):
        return self.kite.positions()["net"]

    def get_latest_ticks(self):
        return dict(self._ticks)
```

---

### TASK 2.3 — `broker/zerodha.py` — Instrument Fetcher + Cache
**Who:** Person A
**Purpose:** The strategy engine needs instrument tokens (numbers Zerodha uses to identify stocks) before it can subscribe to ticks or place orders. Kite's instrument list has 10,000+ entries — fetching fresh on every restart takes 2-3 seconds and wastes API quota. Caching daily means only the first startup of the day is slow.

```python
INSTRUMENT_CACHE_FILE = Path("instruments_cache.json")

def get_instruments(self, exchange="NSE") -> list:
    if INSTRUMENT_CACHE_FILE.exists():
        cached = json.loads(INSTRUMENT_CACHE_FILE.read_text())
        if cached.get("date") == date.today().isoformat():
            return cached["instruments"]

    instruments = self.kite.instruments(exchange)
    INSTRUMENT_CACHE_FILE.write_text(json.dumps({
        "date":        date.today().isoformat(),
        "instruments": instruments
    }))
    return instruments

def find_instrument(self, symbol, exchange="NSE") -> dict:
    for inst in self.get_instruments(exchange):
        if inst["tradingsymbol"] == symbol:
            return inst
    raise ValueError(f"{symbol} not found in {exchange}")
```

**Test:** `broker.find_instrument("RELIANCE")` → `{instrument_token: 738561, ...}`

---

### TASK 2.4 — `broker/zerodha.py` — Historical Data Fetcher
**Who:** Person A
**Purpose:** The indicator engine needs historical candle data to warm up — you cannot calculate a 10-period Supertrend with fewer than 10 candles. Fetch the last 100 candles on engine start. After that, each new tick updates the last candle live.

```python
def get_candles(self, instrument_token, interval, from_date, to_date) -> pd.DataFrame:
    data = self.kite.historical_data(
        instrument_token=instrument_token,
        from_date=from_date,
        to_date=to_date,
        interval=interval,       # "5minute", "15minute", "day" etc.
        continuous=False,
        oi=False
    )
    df = pd.DataFrame(data)
    df.columns = ["timestamp", "open", "high", "low", "close", "volume"]
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)
    return df
```

**Test:** Fetch 100 candles of RELIANCE on `5minute` → print DataFrame shape `(100, 5)`.

---

### TASK 2.5 — `broker/forward_test.py` — ForwardTestBroker
**Who:** Person A
**Purpose:** You never test trading logic with real money. ForwardTestBroker receives real live prices from Kite (so signals are genuine) but executes orders only in memory — no actual orders go to Zerodha. When you're ready for live, change `BROKER_MODE=live` in `.env`. The engine code changes nothing. This is the single most important safety mechanism of the system.

```python
class ForwardTestBroker(BrokerABC):

    def __init__(self, real_broker: ZerodhaBroker):
        self._real              = real_broker
        self._virtual_positions = {}
        self._trade_log         = []
        self._order_counter     = 1

    def place_order(self, symbol, token, qty, transaction_type, *args, **kwargs):
        ltp      = self._real.get_ltp([token])[str(token)]["last_price"]
        order_id = f"FT{self._order_counter:05d}"
        self._order_counter += 1

        if transaction_type == "BUY":
            self._virtual_positions[symbol] = {
                "symbol":        symbol,
                "token":         token,
                "qty":           qty,
                "entry_price":   ltp,
                "current_price": ltp,
                "unrealized_pnl": 0.0,
                "order_id":      order_id,
            }

        elif transaction_type == "SELL":
            pos = self._virtual_positions.pop(symbol, None)
            if pos:
                pnl = (ltp - pos["entry_price"]) * qty
                self._trade_log.append({**pos, "exit_price": ltp, "pnl": pnl})

        return order_id

    def get_positions(self):
        return list(self._virtual_positions.values())

    def update_prices(self, ticks: dict):
        for symbol, pos in self._virtual_positions.items():
            ltp = ticks.get(pos["token"], {}).get("last_price")
            if ltp:
                pos["current_price"]   = ltp
                pos["unrealized_pnl"]  = (ltp - pos["entry_price"]) * pos["qty"]

    # Delegate market data to real broker
    def get_candles(self, *a, **kw):      return self._real.get_candles(*a, **kw)
    def get_instruments(self, *a, **kw):  return self._real.get_instruments(*a, **kw)
    def get_ltp(self, *a, **kw):          return self._real.get_ltp(*a, **kw)
    def subscribe_ticks(self, tokens):    return self._real.subscribe_ticks(tokens)
    def get_latest_ticks(self):           return self._real.get_latest_ticks()
    def cancel_order(self, *a, **kw):     pass
    def get_order_status(self, *a, **kw): return {}
```

**Test:** `broker.place_order("RELIANCE", token, 10, "BUY", ...)` → `broker.get_positions()` shows 1 open position.

---

## Person B — Keycloak JWT in FastAPI + React Setup (Full Day)

### TASK 2.6 — `api/auth.py` — FastAPI JWT Middleware
**Who:** Person B
**Purpose:** Without this, anyone who knows your API URL can start the engine and place orders. This middleware runs before every protected route. It decodes the JWT Keycloak issued, verifies the signature using Keycloak's public key (fetched from the JWKS endpoint automatically), and checks the user's role. The key is fetched from Keycloak — not hardcoded — so it rotates automatically.

```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from jose import jwt, JWTError
from config.settings import settings

bearer_scheme = HTTPBearer()

async def _get_jwks() -> dict:
    url = (f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
           f"/protocol/openid-connect/certs")
    async with httpx.AsyncClient() as client:
        return (await client.get(url)).json()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)
) -> dict:
    token = credentials.credentials
    try:
        jwks    = await _get_jwks()
        payload = jwt.decode(token, jwks, algorithms=["RS256"],
                             audience=settings.keycloak_client_id)
        return {
            "user_id":  payload["sub"],
            "username": payload.get("preferred_username"),
            "roles":    payload.get("realm_access", {}).get("roles", []),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(role: str):
    def checker(user: dict = Depends(get_current_user)):
        if role not in user["roles"]:
            raise HTTPException(status_code=403, detail=f"Role '{role}' required")
        return user
    return checker
```

**Test:** `GET /api/protected` with no token → `401`. With `trader1` token → `200`.

---

### TASK 2.7 — React Project Setup
**Who:** Person B
**Purpose:** React + Vite + TypeScript gives fast hot-reload, type safety (catch bugs before runtime), and the component model needed for the trading dashboard. Vite is faster than Create React App. TypeScript prevents `undefined` crashes common in dashboards where data arrives asynchronously.

```bash
cd Backend/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install keycloak-js @react-keycloak/web
npm install axios react-router-dom recharts
npm install @types/node --save-dev
```

---

### TASK 2.8 — Keycloak SSO Integration in React
**Who:** Person B
**Purpose:** `onLoad: "login-required"` means if the user is not logged into Keycloak, they are automatically redirected to Keycloak login before seeing anything. After login, Keycloak redirects back with a JWT token. Every API call includes this token automatically. The user never handles tokens manually.

```ts
// frontend/src/keycloak.ts
import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
    url:      "http://localhost/auth",
    realm:    "swts",
    clientId: "swts-frontend",
});

export default keycloak;
```

```tsx
// frontend/src/main.tsx
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./keycloak";

root.render(
    <ReactKeycloakProvider
        authClient={keycloak}
        initOptions={{ onLoad: "login-required" }}
    >
        <App />
    </ReactKeycloakProvider>
);
```

**Test:** Open `http://localhost:3000` → redirected to Keycloak → log in as `trader1` → redirected back to React → "Hello trader1" visible.

---

## Day 2 End — Verify

```
Person A:
  python -c "from broker.zerodha import ZerodhaBroker; print('OK')"
  ForwardTestBroker place_order → get_positions shows 1 position

Person B:
  http://localhost:3000 → redirects to Keycloak login → login works
  POST /api/protected with no token → 401
  POST /api/protected with trader1 token → 200
```

---

---

# DAY 3 — Strategy Engine + React Dashboard UI

**Goal:** Full strategy engine working end-to-end in Python. React dashboard has all screens built.

---

## Person A — Strategy Engine (Full Day)

### TASK 3.1 — `strategy/indicators.py` — Supertrend + ATR Calculator
**Who:** Person A
**Purpose:** Raw OHLCV candle data means nothing on its own. `st_direction` changing from `-1` to `1` is the BUY signal. `st_direction` changing from `1` to `-1` is the EXIT signal. ATR tells you how much the stock is moving — low ATR = stock is flat = Supertrend flip is likely a fake signal. `pandas-ta` does all the math so you don't implement formulas from scratch.

```python
import pandas as pd
import pandas_ta as ta

def calculate_indicators(df: pd.DataFrame, settings) -> pd.DataFrame:
    df = df.copy()

    if settings.use_supertrend:
        st = df.ta.supertrend(
            length=settings.st_length,
            multiplier=settings.st_multiplier,
            append=False
        )
        col_val = f"SUPERT_{settings.st_length}_{settings.st_multiplier}"
        col_dir = f"SUPERTd_{settings.st_length}_{settings.st_multiplier}"
        df["st_value"]     = st[col_val]
        df["st_direction"] = st[col_dir]
        # direction: 1 = green (bullish), -1 = red (bearish)

    if settings.use_atr:
        df["atr"] = df.ta.atr(length=settings.atr_period, append=False)

    return df
```

**Test:** Feed 100 RELIANCE candles → print last 5 rows — `st_direction` and `atr` columns visible.

---

### TASK 3.2 — `strategy/signals.py` — Entry + Exit Signal Generator
**Who:** Person A
**Purpose:** The indicator engine produces numbers. The signal engine turns those numbers into decisions. Separating them means you can change strategy logic (signals.py) without touching indicator math (indicators.py). The `st_just_flipped_green` check (comparing current vs previous candle) is crucial — without it the system fires a BUY signal every candle while Supertrend is green, opening dozens of positions.

```python
def check_entry(df: pd.DataFrame, settings) -> bool:
    if len(df) < 2 or not settings.use_supertrend:
        return False

    prev = df.iloc[-2]
    curr = df.iloc[-1]

    # Supertrend must have JUST flipped green this candle
    st_just_flipped_green = (prev["st_direction"] == -1
                             and curr["st_direction"] == 1)
    if not st_just_flipped_green:
        return False

    # ATR gate — only when ATR is enabled
    if settings.use_atr:
        if pd.isna(curr.get("atr")) or curr["atr"] < settings.atr_threshold:
            return False    # not enough volatility

    return True


def check_exit_signal(df: pd.DataFrame, settings) -> bool:
    if not settings.use_supertrend or not settings.exit_on_st_red:
        return False
    if len(df) < 2:
        return False
    prev = df.iloc[-2]
    curr = df.iloc[-1]
    return prev["st_direction"] == 1 and curr["st_direction"] == -1
```

**Test:** Create fake DataFrame with Supertrend flip at index 5 → `check_entry()` returns `True` only at index 5.

---

### TASK 3.3 — `strategy/exit_manager.py` — 5 Exit Conditions
**Who:** Person A
**Purpose:** Without an exit manager, positions stay open forever. Priority order matters — if time is 3:15 PM you square off regardless of anything else (broker MIS rule). Fixed SL protects capital. Trailing SL locks in profit (only moves UP, never down). Target takes money when available. Supertrend red is the strategy's own exit signal.

```python
from datetime import datetime

class ExitManager:

    def check(self, position: dict, current_price: float,
               current_time: datetime, st_turned_red: bool,
               settings) -> str | None:

        # PRIORITY 1: End of session — always wins
        if current_time.strftime("%H:%M") >= settings.session_end_time:
            return "SESSION_END"

        # PRIORITY 2: Fixed Stop Loss
        sl_price = position.get("sl_price")
        if sl_price and current_price <= sl_price:
            return "FIXED_SL"

        # PRIORITY 3: Trailing Stop Loss
        if settings.trailing_sl:
            self._update_trail(position, current_price, settings)
            trail_sl = position.get("trail_sl_price")
            if trail_sl and current_price <= trail_sl:
                return "TRAILING_SL"

        # PRIORITY 4: Target
        target = position.get("target_price")
        if target and current_price >= target:
            return "TARGET"

        # PRIORITY 5: Supertrend turned red
        if st_turned_red and settings.exit_on_st_red:
            return "ST_RED"

        return None     # no exit

    def _update_trail(self, position: dict, current_price: float, settings):
        # Trailing SL ratchets UP only — never decreases
        new_trail = current_price - settings.trail_value
        if new_trail > position.get("trail_sl_price", 0):
            position["trail_sl_price"] = new_trail
```

**Test:** Position entry=100. Test each condition individually → correct `exit_reason` string returns.

---

### TASK 3.4 — `engine/position.py` — Position Book + P&L Tracker
**Who:** Person A
**Purpose:** `max_open_positions = 3` means never more than 3 simultaneous positions. `can_open_new()` enforces this. Every position update flows through `update_tick()` which also checks exits — runs on every live tick. When a position closes, it writes to the database immediately so even if the app crashes the trade is recorded.

```python
class PositionBook:

    def __init__(self, db_session, exit_manager: ExitManager, settings):
        self._open     = {}
        self._db       = db_session
        self._em       = exit_manager
        self._settings = settings

    def open_position(self, symbol, token, qty, entry_price, order_id):
        sl     = entry_price - self._settings.sl_value
        target = entry_price + self._settings.target_value
        self._open[symbol] = {
            "symbol":         symbol,
            "token":          token,
            "qty":            qty,
            "entry_price":    entry_price,
            "sl_price":       sl,
            "target_price":   target,
            "trail_sl_price": sl,
            "current_price":  entry_price,
            "unrealized_pnl": 0.0,
            "order_id":       order_id,
            "entry_time":     datetime.now(IST),
        }

    def update_tick(self, symbol, current_price, current_time, st_red) -> str | None:
        pos = self._open.get(symbol)
        if not pos:
            return None
        pos["current_price"]  = current_price
        pos["unrealized_pnl"] = (current_price - pos["entry_price"]) * pos["qty"]
        return self._em.check(pos, current_price, current_time, st_red, self._settings)

    def close_position(self, symbol, exit_price, exit_reason) -> float:
        pos = self._open.pop(symbol)
        pnl = (exit_price - pos["entry_price"]) * pos["qty"]
        # Write to DB
        trade = Trade(symbol=symbol, entry_price=pos["entry_price"],
                      exit_price=exit_price, quantity=pos["qty"],
                      pnl=pnl, exit_reason=exit_reason,
                      mode=self._settings.broker_mode)
        self._db.add(trade)
        self._db.commit()
        return pnl

    def can_open_new(self) -> bool:
        return len(self._open) < self._settings.max_open_positions

    def get_all_open(self) -> list:
        return list(self._open.values())
```

---

### TASK 3.5 — `engine/trading_engine.py` — State Machine + Main Loop
**Who:** Person A
**Purpose:** The state machine ensures the engine only transitions in valid ways — you cannot `resume()` from `STOPPED`. The loop runs as an `asyncio` background task so FastAPI stays responsive while trading runs. Exits are always checked before entries — protect capital first, deploy capital second.

```python
from enum import Enum
import asyncio

class EngineState(Enum):
    IDLE    = "IDLE"
    RUNNING = "RUNNING"
    PAUSED  = "PAUSED"
    STOPPED = "STOPPED"
    ERROR   = "ERROR"

class TradingEngine:

    def __init__(self, broker: BrokerABC, settings, db_session):
        self.state         = EngineState.IDLE
        self.broker        = broker
        self.settings      = settings
        self.pos_book      = PositionBook(db_session, ExitManager(), settings)
        self._candle_store = {}
        self._task         = None

    async def start(self):
        if self.state not in (EngineState.IDLE, EngineState.STOPPED):
            raise ValueError(f"Cannot start from {self.state}")
        self.state = EngineState.RUNNING
        self._task = asyncio.create_task(self._loop())

    async def pause(self):
        self.state = EngineState.PAUSED

    async def resume(self):
        if self.state == EngineState.PAUSED:
            self.state = EngineState.RUNNING

    async def stop(self):
        self.state = EngineState.STOPPED
        if self._task:
            self._task.cancel()

    async def _loop(self):
        # Warm up: load history + subscribe ticks for each symbol
        for symbol in self.settings.equity_symbols:
            inst    = self.broker.find_instrument(symbol)
            candles = self.broker.get_candles(inst["instrument_token"],
                                              self.settings.timeframe, ...)
            self._candle_store[symbol] = calculate_indicators(candles, self.settings)
            self.broker.subscribe_ticks([inst["instrument_token"]])

        while self.state == EngineState.RUNNING:
            ticks = self.broker.get_latest_ticks()

            for symbol in self.settings.equity_symbols:
                tick = ticks.get(symbol)
                if not tick:
                    continue

                ltp  = tick["last_price"]
                now  = datetime.now(IST)
                df   = self._candle_store[symbol]

                # Update last candle close with latest price
                df.iloc[-1, df.columns.get_loc("close")] = ltp
                df = calculate_indicators(df, self.settings)
                self._candle_store[symbol] = df

                st_red = check_exit_signal(df, self.settings)

                # CHECK EXITS FIRST
                exit_reason = self.pos_book.update_tick(symbol, ltp, now, st_red)
                if exit_reason:
                    self.broker.place_order(symbol, ..., "SELL", ...)
                    pnl = self.pos_book.close_position(symbol, ltp, exit_reason)
                    log.info("EXIT %s @ %.2f | reason=%s | pnl=%.2f",
                             symbol, ltp, exit_reason, pnl)

                # CHECK ENTRIES
                elif (self.pos_book.can_open_new()
                      and symbol not in [p["symbol"] for p in self.pos_book.get_all_open()]
                      and check_entry(df, self.settings)):
                    order_id = self.broker.place_order(symbol, ..., "BUY", ...)
                    self.pos_book.open_position(symbol, ..., ltp, order_id)
                    log.info("ENTRY %s @ %.2f | order=%s", symbol, ltp, order_id)

            await asyncio.sleep(1)
```

---

## Person B — React Dashboard UI (Full Day)

### TASK 3.6 — Dashboard Layout + React Router
**Who:** Person B
**Purpose:** A trading dashboard shows multiple things simultaneously — engine status, live positions, P&L, settings — without page reloads. React Router lets you move between sections instantly. The sidebar stays visible at all times.

```
Routes:
  /            → Dashboard  (engine status, live P&L chart)
  /strategy    → Strategy panel (indicator toggles, parameters)
  /positions   → Open positions table
  /trades      → Trade history table
```

---

### TASK 3.7 — Engine Control Panel
**Who:** Person B
**Purpose:** Trader controls the engine from the UI without SSH-ing into the server. Each button calls a protected API route (requires trader role JWT). State badge shows live engine state with color coding.

```tsx
const startEngine  = () => axios.post("/api/engine/start",  {}, authHeaders);
const stopEngine   = () => axios.post("/api/engine/stop",   {}, authHeaders);
const pauseEngine  = () => axios.post("/api/engine/pause",  {}, authHeaders);
const resumeEngine = () => axios.post("/api/engine/resume", {}, authHeaders);

// State badge colors:
// IDLE    → grey
// RUNNING → green (pulsing dot)
// PAUSED  → orange
// STOPPED → red
// ERROR   → red (flashing)
```

---

### TASK 3.8 — Strategy Settings Panel
**Who:** Person B
**Purpose:** The plan says all indicators must be individually toggleable. When ATR is disabled, entry logic changes. The UI reflects this and sends updated config to the engine without restarting it.

```tsx
// Indicator toggles
<Toggle label="Supertrend" onToggle={setUseSupertend} />
<Toggle label="ATR"        onToggle={setUseATR} />

// Supertrend params
<NumberInput label="ST Length"     min={5}   max={50}  step={1}   />
<NumberInput label="ST Multiplier" min={1.0} max={6.0} step={0.5} />

// ATR params
<NumberInput label="ATR Period"    min={5}   max={50}  step={1}   />
<NumberInput label="ATR Threshold" min={0.5} max={5.0} step={0.1} />

// Exit params
<NumberInput label="Target Points"  />
<NumberInput label="SL Points"      />
<NumberInput label="Trail Points"   />
<Toggle      label="Trailing SL"    />

// Timeframe select
<Select options={["minute","3minute","5minute","10minute",
                  "15minute","30minute","60minute","day"]} />

// Instrument search
<InstrumentSearch onSelect={setSymbol} />   // calls /api/instruments?q=xxx
```

---

### TASK 3.9 — WebSocket Hook for Live Data
**Who:** Person B
**Purpose:** HTTP polling (hitting `/api/status` every second) sends 60 requests per minute for data that may not have changed. WebSocket is a single persistent connection — the server pushes updates only when something changes. This is how real trading dashboards work.

```tsx
function useEngineSocket() {
    const [positions,    setPositions]    = useState([]);
    const [engineState,  setEngineState]  = useState("IDLE");
    const [cumulativePnl, setCumulativePnl] = useState(0);

    useEffect(() => {
        const { token } = useKeycloak();
        const ws = new WebSocket(`ws://localhost/ws/engine?token=${token}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setPositions(data.positions ?? []);
            setEngineState(data.state ?? "IDLE");
            setCumulativePnl(data.cumulative_pnl ?? 0);
        };

        ws.onclose = () => {
            // Reconnect after 3 seconds
            setTimeout(() => { /* re-init */ }, 3000);
        };

        return () => ws.close();
    }, []);

    return { positions, engineState, cumulativePnl };
}
```

---

### TASK 3.10 — P&L Chart + Positions Table + Trade Log
**Who:** Person B
**Purpose:** Trader must see in real time: open positions, unrealized P&L, SL and target levels. Trade history shows strategy performance — if exits are dominated by SL hits, the strategy is entering too early. If targets are being hit consistently, the strategy is working.

**Live P&L Chart** (Recharts LineChart):
- X-axis = time, Y-axis = cumulative P&L
- Green line above zero, red below
- Updates on every WebSocket message

**Open Positions Table:**
```
Symbol | Entry Price | Current Price | Qty | Unrealized P&L | SL | Target
```

**Trade History Table:**
```
Symbol | Entry Price | Exit Price | Qty | P&L | Exit Reason | Time
Filter by: date range / symbol / exit reason
```

---

## Day 3 End — Verify

```
Person A:
  python -c "from engine.trading_engine import TradingEngine; print('OK')"
  Run engine in forward_test mode → entry/exit signals appear in logs

Person B:
  http://localhost:3000 → all pages render without crash
  Start/Stop buttons → state badge changes color
  WebSocket shows "connected" in browser console
```

---

---

# DAY 4 — Wire Everything + Auto-Login + End-to-End Forward Test

**Goal:** All parts connected. Engine controllable from UI. Auto-login working. Full forward test cycle observed end-to-end.

---

## Morning — Both Together (3 Hours)

### TASK 4.1 — `api/routes_engine.py` — Engine Control Routes
**Who:** Both together
**Purpose:** These routes are the bridge between React UI buttons and the Python engine. Each route is protected — unauthenticated → `401`, wrong role → `403`. Logging `started_by` gives an audit trail.

```python
router = APIRouter(prefix="/engine", tags=["engine"])

@router.post("/start")
async def start(user = Depends(require_role("trader"))):
    await engine.start()
    return {"state": engine.state.value, "started_by": user["username"]}

@router.post("/stop")
async def stop(user = Depends(require_role("trader"))):
    await engine.stop()
    return {"state": engine.state.value}

@router.post("/pause")
async def pause(user = Depends(require_role("trader"))):
    await engine.pause()
    return {"state": engine.state.value}

@router.post("/resume")
async def resume(user = Depends(require_role("trader"))):
    await engine.resume()
    return {"state": engine.state.value}

@router.get("/status")
async def status(user = Depends(get_current_user)):
    return {
        "state":           engine.state.value,
        "open_positions":  engine.pos_book.get_all_open(),
        "cumulative_pnl":  engine.pos_book.cumulative_pnl(),
        "ticker_connected": engine.broker._real._ticker_connected,
    }
```

---

### TASK 4.2 — `api/routes_market.py` — Instrument Search Route
**Who:** Both together
**Purpose:** Powers the React instrument search dropdown. Limiting to 50 results prevents the browser from rendering 10,000 items at once.

```python
@router.get("/instruments")
async def search_instruments(q: str = "", exchange: str = "NSE",
                              user = Depends(get_current_user)):
    all_instruments = broker.get_instruments(exchange)
    if q:
        all_instruments = [i for i in all_instruments
                           if q.upper() in i["tradingsymbol"].upper()]
    return all_instruments[:50]
```

---

### TASK 4.3 — WebSocket Route for Live Data Push
**Who:** Both together
**Purpose:** React's `useEngineSocket()` hook connects here. Every second the server pushes fresh position data. Trader sees P&L updating live without clicking refresh.

```python
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/engine")
async def ws_engine(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({
                "type":           "update",
                "state":          engine.state.value,
                "positions":      engine.pos_book.get_all_open(),
                "cumulative_pnl": engine.pos_book.cumulative_pnl(),
                "timestamp":      datetime.now(IST).isoformat(),
            })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
```

---

### TASK 4.4 — Auto-Login Scheduler
**Who:** Person A
**Purpose:** Zerodha access tokens expire at midnight every day. Without auto-login, the engine stops working every morning and someone has to manually log in. The TOTP key in `.env` generates the 6-digit OTP programmatically — no human intervention needed. Starts at 8:30 AM IST (45 minutes before market opens at 9:15 AM) so the token is fresh when trading begins.

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

IST       = pytz.timezone("Asia/Kolkata")
scheduler = AsyncIOScheduler(timezone=IST)

async def scheduled_login():
    log.info("Scheduled auto-login starting at 8:30 AM IST...")
    try:
        broker._real.auto_login()    # TOTP flow → saves session.json
        log.info("Auto-login successful — Kite session ready")
    except Exception as e:
        log.error("Auto-login FAILED: %s", e)
        # TODO: send SMS/email alert

scheduler.add_job(
    scheduled_login,
    CronTrigger(hour=8, minute=30, timezone=IST),
    id="daily_login"
)

# In lifespan startup:
# scheduler.start()
```

---

## Afternoon — Split Work (3 Hours)

### TASK 4.5 — Update `main.py` — Wire All Modules Together
**Who:** Person A
**Purpose:** `app.state` is FastAPI's built-in way to share objects across routes — no global variables. The lifespan function is the single place where all modules are assembled. `BROKER_MODE=live` in `.env` switches to real trading — the engine code changes nothing.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Broker
    real_broker = ZerodhaBroker(settings)
    real_broker.load_and_verify_session()

    if settings.broker_mode == "forward_test":
        app.state.broker = ForwardTestBroker(real_broker)
    else:
        app.state.broker = real_broker

    # 2. DB session
    db = SessionLocal()

    # 3. Engine
    app.state.engine = TradingEngine(app.state.broker, settings, db)

    # 4. Scheduler
    scheduler.start()

    log.info("SWTS started — mode: %s", settings.broker_mode)
    yield

    # Shutdown
    await app.state.engine.stop()
    scheduler.shutdown()
    db.close()
```

---

### TASK 4.6 — React Instrument Search Dropdown
**Who:** Person B
**Purpose:** Implements the plan's requirement: "users select instruments via a searchable dropdown — no hardcoded symbols."

```tsx
function InstrumentSearch({ onSelect }: { onSelect: (inst: Instrument) => void }) {
    const [query,   setQuery]   = useState("");
    const [results, setResults] = useState<Instrument[]>([]);
    const { token } = useKeycloak();

    const search = async (q: string) => {
        if (q.length < 2) return;
        const resp = await axios.get(`/api/instruments?q=${q}&exchange=NSE`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setResults(resp.data);
    };

    return (
        <div className="instrument-search">
            <input
                placeholder="Search symbol... (e.g. RELIANCE)"
                onChange={e => { setQuery(e.target.value); search(e.target.value); }}
            />
            {results.map(inst => (
                <div key={inst.instrument_token}
                     onClick={() => { onSelect(inst); setResults([]); }}>
                    <strong>{inst.tradingsymbol}</strong> — {inst.name}
                </div>
            ))}
        </div>
    );
}
```

---

### TASK 4.7 — End-to-End Forward Test Run
**Who:** Both together
**Purpose:** Validates the entire system end-to-end — Keycloak login → instrument search → engine start → signal → forward test order → exit → database record → visible in dashboard. Any step that breaks here is caught before live trading, not during it.

```
Step 1:  docker compose up -d
Step 2:  Open http://localhost → React dashboard
Step 3:  Log in as trader1 (Keycloak login page)
Step 4:  Search "NIFTYBEES" or any liquid NSE stock → select
Step 5:  Set timeframe = 5minute, ST + ATR enabled
Step 6:  Click START → state badge turns green
Step 7:  Watch logs:
           "Fetching historical candles for NIFTYBEES..."
           "Subscribed to instrument token 12345"
           "Supertrend direction: -1 (bearish)"
           ... (wait for flip)
           "ENTRY SIGNAL — NIFTYBEES @ 245.50"
           "ForwardTestBroker: BUY 10 NIFTYBEES @ 245.50 [order: FT00001]"
           "Position opened. SL=235.50 Target=265.50"
           "P&L update: +15.20"
           "EXIT: TARGET hit @ 265.60"
           "Trade logged: PNL=+200"
Step 8:  Dashboard shows: position open → P&L rising → trade in history
Step 9:  Click STOP → state badge turns red
```

---

### TASK 4.8 — Bug Fixes from Forward Test
**Who:** Both together
**Purpose:** The gap between "each module works in isolation" and "everything works together" is where real bugs live. Day 4 afternoon is reserved for this.

Common things to fix:
- Indicator doesn't have enough history on startup → fetch more candles (200 instead of 100)
- ATR threshold too high → never enters → tune to `0.5`
- WebSocket disconnects → add reconnect logic in React hook
- Session token expired mid-session → test `load_and_verify_session()` handles it
- Database constraint error → check column types in Trade model

---

## Day 4 End — Full Checklist

```
Infrastructure:
  ✓ docker compose up works on both machines
  ✓ PostgreSQL tables exist and accepting writes
  ✓ Keycloak realm JSON exported and committed
  ✓ Nginx routing all endpoints correctly

Auth:
  ✓ trader1 login → can start/stop engine
  ✓ Unauthenticated call → 401
  ✓ Wrong role → 403
  ✓ Token auto-refresh works (Keycloak handles it)

Broker:
  ✓ ForwardTestBroker place_order → position appears in get_positions()
  ✓ Instrument search returns results for any symbol
  ✓ Historical candles fetch successfully (100 candles)
  ✓ KiteTicker WebSocket connected and receiving ticks

Strategy:
  ✓ Supertrend calculated correctly on 5-min candles
  ✓ ATR gate blocks entry when volatility is low
  ✓ All 5 exit conditions trigger in isolation tests
  ✓ max_open_positions = 3 respected (4th signal ignored)

Dashboard:
  ✓ Engine state badge updates in real time
  ✓ Open positions table updates every second via WebSocket
  ✓ Trade log populated after first trade closes
  ✓ P&L chart draws and updates correctly
  ✓ Instrument search dropdown works

End-to-End:
  ✓ Full cycle: signal → forward order → exit → DB → dashboard
  ✓ Auto-login scheduler tested manually (fires correctly)
  ✓ App restart restores Kite session without re-login
  ✓ BROKER_MODE=live in .env would be the only change needed for real trading
```

---

---

## Week 1 Milestone

```
User visits http://localhost
        ↓
Keycloak SSO login (trader1)
        ↓
React dashboard loads — engine state: IDLE
        ↓
Search "RELIANCE" → select instrument
        ↓
Click START → engine state: RUNNING
        ↓
Supertrend flips green + ATR passes gate
        ↓
ForwardTestBroker: BUY 10 RELIANCE @ market price
        ↓
Position appears in dashboard with live P&L updating
        ↓
Target hit OR Supertrend turns red
        ↓
ForwardTestBroker: SELL 10 RELIANCE
        ↓
Trade saved to PostgreSQL
        ↓
Trade log shows: P&L = +₹200
        ↓
Click STOP → engine state: STOPPED
```

**100% simulated. 0 real money at risk.**
**To go live: change one line in `.env`:**
```
BROKER_MODE=live
```

---

## Week 2 Preview

| Task | Description |
|------|-------------|
| F&O Handler | `FnOSegment` class — futures and options |
| Instrument Resolution | NIFTY/BANKNIFTY FUT token lookup (current + next month) |
| Lot-Based Sizing | quantity = lots × lot_size from instrument master |
| Strike Calculation | ATM ± N strikes from underlying LTP |
| Expiry Management | Weekly vs monthly, auto-rollover 2 days before expiry |
| Greeks Display | Delta/theta from option chain in dashboard |
| Nginx SSL | Let's Encrypt cert, HTTPS, production nginx.conf |
| Docker Prod | `docker-compose.prod.yml` — all services hardened |
| Cloud Deploy | AWS EC2 or DigitalOcean VPS |
| Monitoring | Logs, alerts, go-live checklist |
