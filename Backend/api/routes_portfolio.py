"""
api/routes_portfolio.py — Portfolio REST endpoints.

GET /api/funds      — fetch available funds / margin
                      live         → real equity margin from Zerodha (live_balance, collateral, net)
                      forward_test → virtual capital from ForwardTestBroker

GET /api/holdings   — fetch holdings based on current broker mode
                      live         → real DEMAT holdings from Zerodha
                      forward_test → virtual capital summary from ForwardTestBroker

GET /api/positions  — fetch current open positions based on broker mode
                      live         → real net positions from Zerodha
                      forward_test → virtual open position from ForwardTestBroker
"""

import logging
from fastapi import APIRouter, HTTPException

import zeroda
from config.settings import settings
from broker.forward_test import ForwardTestBroker

router = APIRouter(prefix="/api", tags=["portfolio"])
log    = logging.getLogger(__name__)


def _get_engine():
    """Import _engine from main at call time to avoid circular import."""
    from main import _engine
    return _engine


# ── Funds ─────────────────────────────────────────────────────────────────────

@router.get("/funds")
async def get_funds():
    """
    Live mode    → real equity margin from Zerodha (live_balance, collateral, net).
    Forward test → virtual capital from ForwardTestBroker.
    """
    try:
        if settings.broker_mode == "live":
            data  = zeroda.kite.margins(segment="equity")
            avail = data.get("equity", data).get("available", {})
            return {
                "mode":         "live",
                "live_balance": round(avail.get("live_balance", 0.0), 2),
                "collateral":   round(avail.get("collateral", 0.0), 2),
                "net":          round(data.get("equity", data).get("net", 0.0), 2),
            }

        engine = _get_engine()
        if engine and isinstance(engine.broker, ForwardTestBroker):
            funds = engine.broker.get_funds()
            return {"mode": "forward_test", **funds}

        return {"mode": "forward_test", "live_balance": 100_000.0, "collateral": 0.0, "net": 100_000.0}

    except Exception as exc:
        log.error("get_funds error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Holdings ──────────────────────────────────────────────────────────────────

@router.get("/holdings")
async def get_holdings():
    """
    Live mode    → real DEMAT holdings from Zerodha (quantity, avg_price, last_price, pnl).
    Forward test → virtual capital summary (initial_capital, available_capital, total_pnl).
    """
    try:
        if settings.broker_mode == "live":
            holdings = zeroda.kite.holdings()
            return {
                "mode":     "live",
                "holdings": [
                    {
                        "symbol":          h["tradingsymbol"],
                        "exchange":        h["exchange"],
                        "isin":            h.get("isin", ""),
                        "quantity":        h["quantity"],
                        "avg_price":       h["average_price"],
                        "last_price":      h["last_price"],
                        "pnl":             h["pnl"],
                        "day_change_pct":  h.get("day_change_percentage", 0.0),
                        "current_value":   round(h["last_price"] * h["quantity"], 2),
                        "invested_value":  round(h["average_price"] * h["quantity"], 2),
                    }
                    for h in holdings
                ],
            }

        # Forward test — return virtual capital summary
        engine = _get_engine()
        if engine and isinstance(engine.broker, ForwardTestBroker):
            ft_holdings = engine.broker.get_holdings()
            return {"mode": "forward_test", "holdings": ft_holdings}

        # Engine not started yet — return default capital
        return {
            "mode":     "forward_test",
            "holdings": [{
                "mode":              "forward_test",
                "initial_capital":   100_000.0,
                "available_capital": 100_000.0,
                "total_pnl":         0.0,
                "total_trades":      0,
                "wins":              0,
                "losses":            0,
            }],
        }

    except Exception as exc:
        log.error("get_holdings error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Positions ─────────────────────────────────────────────────────────────────

@router.get("/positions")
async def get_positions():
    """
    Live mode    → real net positions from Zerodha with live P&L.
    Forward test → virtual open position from ForwardTestBroker.
    """
    try:
        if settings.broker_mode == "live":
            positions = zeroda.kite.positions()
            net = positions.get("net", [])
            return {
                "mode":      "live",
                "positions": [
                    {
                        "symbol":        p["tradingsymbol"],
                        "exchange":      p["exchange"],
                        "quantity":      p["quantity"],
                        "avg_price":     p["average_price"],
                        "last_price":    p.get("last_price", 0.0),
                        "pnl":           p["pnl"],
                        "m2m":           p.get("m2m", 0.0),
                        "product":       p["product"],
                        "buy_quantity":  p.get("buy_quantity", 0),
                        "sell_quantity": p.get("sell_quantity", 0),
                    }
                    for p in net if p["quantity"] != 0
                ],
            }

        # Forward test — return virtual position
        engine = _get_engine()
        if engine and isinstance(engine.broker, ForwardTestBroker):
            pos_list = engine.broker.get_positions()
            return {"mode": "forward_test", "positions": pos_list}

        return {"mode": "forward_test", "positions": []}

    except Exception as exc:
        log.error("get_positions error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
