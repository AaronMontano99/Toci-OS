"""Minimal password hashing -- stdlib only, no new dependency.

Note: nothing in this demo actually checks a password against this hash.
There's no login screen (single hardcoded demo user, see main.DEMO_USER_ID),
so "change password" is a real, persisted setting with nothing to gate yet."""

import hashlib
import hmac
import os

_ITERATIONS = 260_000


def hash_password(plain: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt, _ITERATIONS)
    return salt.hex() + "$" + digest.hex()


def verify_password(plain: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt, _ITERATIONS)
    return hmac.compare_digest(digest.hex(), digest_hex)
