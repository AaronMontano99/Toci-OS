"""Encryption at rest for OAuth client secrets and access/refresh tokens
(Whoop, Spotify) -- these are real, valid provider credentials once a user
connects a device, so they shouldn't sit in the SQLite file in plain text.

Key comes from TOCI_ENCRYPTION_KEY if set (a urlsafe-base64 Fernet key --
generate one with `Fernet.generate_key()`). If unset, a key is generated
once and persisted to a gitignored local file so the demo keeps working with
no required setup. Losing that key/file makes any already-stored secrets
permanently undecryptable -- reconnecting the device is the recovery path,
not a crash (see decrypt_secret)."""

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

_KEY_FILE = Path(__file__).resolve().parent.parent / ".encryption_key"


def _load_or_create_key() -> bytes:
    env_key = os.environ.get("TOCI_ENCRYPTION_KEY")
    if env_key:
        return env_key.encode("utf-8")
    if _KEY_FILE.exists():
        return _KEY_FILE.read_bytes().strip()
    key = Fernet.generate_key()
    _KEY_FILE.write_bytes(key)
    return key


_fernet = Fernet(_load_or_create_key())


def encrypt_secret(plain: str) -> str:
    return _fernet.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str | None:
    """None on failure (wrong/rotated key, or pre-encryption legacy plaintext)
    rather than raising -- callers already treat a missing token as
    "not connected", so this degrades to "reconnect the device" instead of
    a 500."""
    try:
        return _fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
