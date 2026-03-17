"""
models/instrument.py — Instruments table.
Stores Zerodha symbol master — refreshed daily at market open.
Used for instrument search dropdown in the React dashboard.
"""

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, func
from models.database import Base


class Instrument(Base):
    __tablename__ = "instruments"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    instrument_token = Column(Integer, nullable=False, index=True)   # used for WebSocket + historical data
    exchange_token   = Column(String, nullable=True)
    tradingsymbol    = Column(String, nullable=False, index=True)     # e.g. INFY, NIFTY24DECFUT
    name             = Column(String, nullable=True)                  # company name
    exchange         = Column(String, nullable=False, index=True)     # NSE | NFO | BSE
    segment          = Column(String, nullable=True, index=True)      # NSE_EQ | NFO-FUT | NFO-OPT
    instrument_type  = Column(String, nullable=True)                  # EQ | FUT | CE | PE
    last_price       = Column(Float, default=0.0)
    strike           = Column(Float, default=0.0)                     # options strike price
    tick_size        = Column(Float, default=0.0)                     # minimum price movement
    lot_size         = Column(Integer, default=1)                     # F&O lot size
    expiry           = Column(Date, nullable=True)                    # F&O expiry date
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())
