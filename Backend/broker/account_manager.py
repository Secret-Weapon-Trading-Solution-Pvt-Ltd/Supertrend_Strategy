"""
broker/account_manager.py — Save Zerodha accounts and manage TOTP auto-login.

Flow:
  add_account()             → encrypt credentials → save to DB
  login_account()           → decrypt → TOTP login → save access_token to DB
  load_and_autologin_all()  → on server start, auto-login all active TOTP accounts
  disconnect_account()      → clear access_token from DB on logout
"""

from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.account import Account
from config.crypto import encrypt, decrypt
from zeroda import auto_login as totp_auto_login, kite


async def add_account(
    db: AsyncSession,
    label: str,
    user_id: str,
    api_key: str,
    api_secret: str,
    password: str,
    totp_key: str,
) -> Account:
    """Encrypt credentials and save a new account to DB."""
    account = Account(
        label=label,
        user_id=user_id,
        api_key=api_key,
        api_secret_encrypted=encrypt(api_secret),
        password_encrypted=encrypt(password),
        totp_key_encrypted=encrypt(totp_key),
        auth_method="totp",
    )
    db.add(account)
    await db.commit()
    print(f"Account '{label}' saved to DB.")
    return account


async def login_account(db: AsyncSession, account_id: str) -> str:
    """
    Fetch account from DB → decrypt credentials → TOTP login → save access_token.
    Returns access_token.
    """
    result = await db.execute(select(Account).where(Account.id == account_id))
    row = result.scalar_one_or_none()
    if not row:
        raise ValueError(f"Account {account_id} not found in DB")

    # Decrypt stored credentials and patch env so auto_login() picks them up
    import os
    os.environ["KITE_API_KEY"]    = row.api_key
    os.environ["KITE_API_SECRET"] = decrypt(row.api_secret_encrypted)
    os.environ["KITE_USER_ID"]    = row.user_id
    os.environ["KITE_PASSWORD"]   = decrypt(row.password_encrypted)
    os.environ["KITE_TOTP_KEY"]   = decrypt(row.totp_key_encrypted)

    # Reload zeroda module globals with fresh credentials
    import zeroda
    zeroda.API_KEY    = row.api_key
    zeroda.API_SECRET = decrypt(row.api_secret_encrypted)
    zeroda.USER_ID    = row.user_id
    zeroda.PASSWORD   = decrypt(row.password_encrypted)
    zeroda.TOTP_KEY   = decrypt(row.totp_key_encrypted)

    # Run TOTP login — sets kite access token + returns access_token
    access_token = totp_auto_login()

    # Persist access_token to DB
    await db.execute(
        update(Account)
        .where(Account.id == row.id)
        .values(
            access_token=access_token,
            is_connected=True,
            last_login_at=datetime.utcnow(),
        )
    )
    await db.commit()
    print(f"[{row.label}] Logged in. Token saved to DB.")
    return access_token


async def load_and_autologin_all(db: AsyncSession) -> dict:
    """
    On server start — auto-login every active TOTP account.
    Returns dict: account_id → access_token
    """
    result = await db.execute(
        select(Account).where(
            Account.is_active == True,
            Account.auth_method == "totp",
            Account.totp_key_encrypted != None,
            Account.password_encrypted != None,
        )
    )
    rows = result.scalars().all()

    sessions = {}
    for row in rows:
        try:
            access_token = await login_account(db, row.id)
            sessions[row.id] = access_token
        except Exception as e:
            print(f"[{row.label}] Auto-login failed: {e}")

    return sessions


async def disconnect_account(db: AsyncSession, account_id: str) -> None:
    """Clear access_token from DB on logout."""
    await db.execute(
        update(Account)
        .where(Account.id == account_id)
        .values(access_token=None, is_connected=False)
    )
    await db.commit()
