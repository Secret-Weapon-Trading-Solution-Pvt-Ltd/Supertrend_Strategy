"""
api/routes_market.py — REST endpoints for market reference data.

GET /api/timeframes          — list all active timeframes from DB
GET /api/instruments         — search instruments by symbol/name
GET /api/instruments/{token} — get single instrument by token
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.timeframe import Timeframe
from models.instrument import Instrument

router = APIRouter(prefix="/api", tags=["market"])


@router.get("/timeframes")
async def get_timeframes(db: AsyncSession = Depends(get_db)):
    """Return all active timeframes ordered by duration."""
    result = await db.execute(
        select(Timeframe)
        .where(Timeframe.is_active == True)
        .order_by(Timeframe.minutes)
    )
    timeframes = result.scalars().all()
    return [
        {"interval": tf.interval, "label": tf.label, "minutes": tf.minutes}
        for tf in timeframes
    ]


@router.get("/instruments")
async def search_instruments(
    query:    str            = Query(..., min_length=2, description="Symbol or name to search"),
    exchange: str | None     = Query(None, description="NSE | NFO | BSE | MCX"),
    segment:  str | None     = Query(None, description="NSE_EQ | NFO-FUT | NFO-OPT"),
    type:     str | None     = Query(None, description="EQ | FUT | CE | PE"),
    limit:    int            = Query(20, le=100),
    db:       AsyncSession   = Depends(get_db),
):
    """Search instruments by trading symbol or company name."""
    q = query.strip()
    sym_pattern  = f"{q}%"   # starts-with for symbol — NIFTY matches NIFTY* not BANKNIFTY
    name_pattern = f"{q}%"   # starts-with for name   — NIFTY matches name=NIFTY not name=BANKNIFTY

    stmt = select(Instrument).where(
        or_(
            Instrument.tradingsymbol.ilike(sym_pattern),
            Instrument.name.ilike(name_pattern),
        )
    )

    if exchange:
        stmt = stmt.where(Instrument.exchange == exchange.upper())
    if segment:
        stmt = stmt.where(Instrument.segment == segment)
    if type:
        stmt = stmt.where(Instrument.instrument_type == type.upper())

    stmt = stmt.order_by(Instrument.tradingsymbol).limit(limit)
    result = await db.execute(stmt)
    instruments = result.scalars().all()

    return [
        {
            "token":    inst.instrument_token,
            "symbol":   inst.tradingsymbol,
            "name":     inst.name,
            "exchange": inst.exchange,
            "segment":  inst.segment,
            "type":     inst.instrument_type,
            "lot_size": inst.lot_size,
            "expiry":   str(inst.expiry) if inst.expiry else None,
        }
        for inst in instruments
    ]


@router.get("/instruments/{token}")
async def get_instrument_by_token(
    token: int,
    db:    AsyncSession = Depends(get_db),
):
    """Get a single instrument by its instrument token."""
    result = await db.execute(
        select(Instrument).where(Instrument.instrument_token == token)
    )
    inst = result.scalar_one_or_none()
    if not inst:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Instrument token {token} not found")

    return {
        "token":     inst.instrument_token,
        "symbol":    inst.tradingsymbol,
        "name":      inst.name,
        "exchange":  inst.exchange,
        "segment":   inst.segment,
        "type":      inst.instrument_type,
        "lot_size":  inst.lot_size,
        "tick_size": inst.tick_size,
        "expiry":    str(inst.expiry) if inst.expiry else None,
    }
