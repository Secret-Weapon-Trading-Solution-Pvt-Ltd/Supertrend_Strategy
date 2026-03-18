"""
test_autologin.py — Manual test for the TOTP auto-login flow.

Run from Backend/:
    python test_autologin.py

Stages:
  1. DB init + seed account (from .env credentials)
  2. TOTP auto-login → get access_token
  3. Verify token with Zerodha → get profile
  4. Check account row in DB (connected + has token)
"""

import asyncio
import sys
import traceback
from sqlalchemy import select

from models.database import async_session, init_db
from models.account import Account
from broker.account_manager import add_account, login_account
from config.settings import settings
from zeroda import verify_token


PASS = "  [PASS]"
FAIL = "  [FAIL]"
SKIP = "  [SKIP]"


async def main():
    print("\n" + "=" * 55)
    print("  SWTS — Auto-Login Flow Test")
    print("=" * 55)

    # ── Stage 1: Init DB ──────────────────────────────────────
    print("\n[Stage 1] DB init...")
    try:
        await init_db()
        print(PASS, "DB tables created / verified")
    except Exception as e:
        print(FAIL, f"DB init failed: {e}")
        traceback.print_exc()
        sys.exit(1)

    # ── Stage 2: Seed account if not already in DB ────────────
    print("\n[Stage 2] Seeding account from .env...")
    account_id = None
    async with async_session() as db:
        try:
            result = await db.execute(
                select(Account).where(Account.user_id == settings.kite_user_id)
            )
            existing = result.scalars().first()

            if existing:
                account_id = existing.id
                # If account exists but missing encrypted creds (e.g. seeded via OAuth), patch them in
                if not existing.api_secret_encrypted or not existing.password_encrypted or not existing.totp_key_encrypted:
                    from config.crypto import encrypt
                    existing.api_secret_encrypted = encrypt(settings.kite_api_secret)
                    existing.password_encrypted   = encrypt(settings.kite_password)
                    existing.totp_key_encrypted   = encrypt(settings.kite_totp_key)
                    existing.auth_method          = "totp"
                    await db.commit()
                    print(PASS, f"Account patched with encrypted creds: {existing.label} ({existing.user_id})")
                else:
                    print(SKIP, f"Account already in DB with creds: {existing.label} ({existing.user_id})")
            else:
                account = await add_account(
                    db=db,
                    label=f"Zerodha-{settings.kite_user_id}",
                    user_id=settings.kite_user_id,
                    api_key=settings.kite_api_key,
                    api_secret=settings.kite_api_secret,
                    password=settings.kite_password,
                    totp_key=settings.kite_totp_key,
                )
                account_id = account.id
                print(PASS, f"Account saved to DB: {account.label} ({account.user_id})")
        except Exception as e:
            print(FAIL, f"Seed failed: {e}")
            traceback.print_exc()
            sys.exit(1)

    # ── Stage 3: TOTP auto-login ──────────────────────────────
    print("\n[Stage 3] Running TOTP auto-login...")
    access_token = None
    async with async_session() as db:
        try:
            access_token = await login_account(db, account_id)
            print(PASS, f"Login successful — token: {access_token[:12]}...{access_token[-6:]}")
        except Exception as e:
            print(FAIL, f"TOTP login failed: {e}")
            traceback.print_exc()
            sys.exit(1)

    # ── Stage 4: Verify token with Zerodha ───────────────────
    print("\n[Stage 4] Verifying token with Zerodha...")
    try:
        valid, result = verify_token(access_token)
        if valid:
            print(PASS, f"Token valid — user: {result['user_name']} ({result['user_id']})")
            print(f"         email : {result.get('email', 'N/A')}")
            print(f"         broker: {result.get('broker', 'N/A')}")
        else:
            print(FAIL, f"Token rejected: {result}")
            sys.exit(1)
    except Exception as e:
        print(FAIL, f"Token verification error: {e}")
        traceback.print_exc()
        sys.exit(1)

    # ── Stage 5: Check DB row ─────────────────────────────────
    print("\n[Stage 5] Checking DB account row...")
    async with async_session() as db:
        try:
            result = await db.execute(select(Account).where(Account.id == account_id))
            account = result.scalars().first()
            assert account is not None, "Account row missing"
            assert account.is_connected,          "is_connected is False"
            assert account.access_token is not None, "access_token is NULL"
            assert account.last_login_at is not None, "last_login_at is NULL"
            print(PASS, f"is_connected=True  has_token=True  last_login_at={account.last_login_at}")
        except AssertionError as e:
            print(FAIL, str(e))
            sys.exit(1)
        except Exception as e:
            print(FAIL, f"DB check error: {e}")
            traceback.print_exc()
            sys.exit(1)

    print("\n" + "=" * 55)
    print("  ALL STAGES PASSED — Auto-login flow is working.")
    print("=" * 55 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
