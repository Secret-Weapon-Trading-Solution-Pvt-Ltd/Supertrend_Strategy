"""
broker/instruments.py — Fetch instruments from Zerodha and store in DB.
Refreshed daily at market open. Provides search for UI dropdown.

Usage:
    await refresh_instruments(kite, db)          # fetch from Zerodha → save to DB
    await search_instruments(db, "INFY", "NSE")  # search by name/symbol
    await get_instrument(db, "INFY", "NSE")      # get single instrument token
"""

from datetime import date
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from kiteconnect import KiteConnect

from models.instrument import Instrument


EXCHANGES = ["NSE", "NFO", "BSE", "MCX"]


async def refresh_instruments(kite: KiteConnect, db: AsyncSession) -> int:
    """
    Fetch all instruments from Zerodha for NSE, NFO, BSE.
    Clears old records and inserts fresh ones.
    Returns total count saved.
    """
    total = 0

    for exchange in EXCHANGES:
        # Fetch from Zerodha API
        raw = kite.instruments(exchange=exchange)

        # Delete existing records for this exchange
        await db.execute(delete(Instrument).where(Instrument.exchange == exchange))

        # Insert fresh records
        for i in raw:
            # Parse expiry — kiteconnect returns date object or empty string
            expiry = i.get("expiry")
            if not isinstance(expiry, date):
                expiry = None

            db.add(Instrument(
                instrument_token = i["instrument_token"],
                exchange_token   = str(i.get("exchange_token", "")),
                tradingsymbol    = i["tradingsymbol"],
                name             = i.get("name", ""),
                exchange         = i["exchange"],
                segment          = i.get("segment", ""),
                instrument_type  = i.get("instrument_type", ""),
                last_price       = float(i.get("last_price") or 0.0),
                strike           = float(i.get("strike") or 0.0),
                tick_size        = float(i.get("tick_size") or 0.0),
                lot_size         = int(i.get("lot_size") or 1),
                expiry           = expiry,
            ))
            total += 1

        await db.commit()
        print(f"{exchange}: {len(raw)} instruments saved.")

    return total


async def search_instruments(
    db: AsyncSession,
    query: str,
    exchange: str = "NSE",
    segment: str = None,
    limit: int = 20,
) -> list:
    """
    Search instruments by tradingsymbol or name.
    Used for the searchable dropdown in the React dashboard.
    """
    stmt = select(Instrument).where(
        Instrument.exchange == exchange,
        Instrument.tradingsymbol.ilike(f"%{query}%"),
    )

    if segment:
        stmt = stmt.where(Instrument.segment == segment)

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "instrument_token": r.instrument_token,
            "tradingsymbol":    r.tradingsymbol,
            "name":             r.name,
            "exchange":         r.exchange,
            "segment":          r.segment,
            "instrument_type":  r.instrument_type,
            "lot_size":         r.lot_size,
            "expiry":           str(r.expiry) if r.expiry else None,
        }
        for r in rows
    ]


async def get_instrument(
    db: AsyncSession,
    tradingsymbol: str,
    exchange: str = "NSE",
) -> dict | None:
    """
    Get a single instrument by tradingsymbol and exchange.
    Returns None if not found.
    """
    result = await db.execute(
        select(Instrument).where(
            Instrument.tradingsymbol == tradingsymbol.upper(),
            Instrument.exchange == exchange,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None

    return {
        "instrument_token": row.instrument_token,
        "tradingsymbol":    row.tradingsymbol,
        "name":             row.name,
        "exchange":         row.exchange,
        "segment":          row.segment,
        "instrument_type":  row.instrument_type,
        "lot_size":         row.lot_size,
        "tick_size":        row.tick_size,
        "expiry":           str(row.expiry) if row.expiry else None,
    }
