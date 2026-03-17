"""
config/crypto.py — Fernet encryption/decryption for sensitive credentials.
Used to encrypt api_secret, password, totp_key before storing in DB.
"""

from cryptography.fernet import Fernet
from config.settings import settings


def _fernet() -> Fernet:
    if not settings.fernet_key:
        raise ValueError("FERNET_KEY not set in .env")
    return Fernet(settings.fernet_key.encode())


def encrypt(text: str) -> str:
    """Encrypt a plain text string. Returns encrypted string."""
    return _fernet().encrypt(text.encode()).decode()


def decrypt(text: str) -> str:
    """Decrypt an encrypted string. Returns plain text."""
    return _fernet().decrypt(text.encode()).decode()
