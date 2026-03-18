"""
api/routes_trades.py — REST endpoints for trade history.

GET /api/trades   — fetch recent completed trades from DB
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.trade import get_trade_history

router = APIRouter(prefix="/api", tags=["trades"])


@router.get("/trades")
async def list_trades(
    limit: int = Query(100, le=500, description="Max number of trades to return"),
):
    """Return the most recent completed trades, newest first."""
    trades = await get_trade_history(limit)
    return trades
