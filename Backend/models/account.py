"""
models/account.py — Account table.
Stores Zerodha credentials (encrypted) and daily access_token.
One row per Zerodha account.
"""

import uuid
from sqlalchemy import Column, String, Boolean, DateTime, func
from models.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id                   = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    label                = Column(String, nullable=False)               # e.g. "Main Account"
    user_id              = Column(String, nullable=False)               # Zerodha client ID e.g. BG9107
    api_key              = Column(String, nullable=False)               # plain — not secret
    api_secret_encrypted = Column(String, nullable=True)               # Fernet encrypted
    password_encrypted   = Column(String, nullable=True)               # Fernet encrypted
    totp_key_encrypted   = Column(String, nullable=True)               # Fernet encrypted
    auth_method          = Column(String, default="totp")              # "totp" | "oauth"
    access_token         = Column(String, nullable=True)               # plain — refreshed daily
    is_active            = Column(Boolean, default=True)
    is_connected         = Column(Boolean, default=False)
    last_login_at        = Column(DateTime, nullable=True)
    created_at           = Column(DateTime, server_default=func.now())
