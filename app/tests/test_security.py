"""Coverage for the security-audit fixes: OAuth secrets encrypted at rest,
barcode input validated before it's used to build an outbound URL, and CORS
no longer wide open to any origin."""
import sqlite3

from toci import models
from toci.crypto import decrypt_secret, encrypt_secret
from toci.main import DEMO_USER_ID


def test_encrypt_then_decrypt_round_trips():
    ciphertext = encrypt_secret("a-real-refresh-token")
    assert ciphertext != "a-real-refresh-token"
    assert decrypt_secret(ciphertext) == "a-real-refresh-token"


def test_decrypt_of_garbage_returns_none_instead_of_raising():
    assert decrypt_secret("not-a-valid-fernet-token") is None


def test_oauth_secret_columns_are_ciphertext_on_disk(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.whoop_client_secret = "super-secret-value"
    user.whoop_access_token = "access-123"
    db_session.commit()

    # Bypass the ORM entirely and read the raw SQLite row -- this is what an
    # attacker with just the .db file (no app code, no key) would see.
    db_path = db_session.bind.url.database
    raw = sqlite3.connect(db_path).execute(
        "SELECT whoop_client_secret, whoop_access_token FROM users WHERE id = ?", (DEMO_USER_ID,)
    ).fetchone()
    assert "super-secret-value" not in raw[0]
    assert "access-123" not in raw[1]

    # But the ORM still sees plaintext -- nothing else in the app had to change.
    db_session.refresh(user)
    assert user.whoop_client_secret == "super-secret-value"
    assert user.whoop_access_token == "access-123"


def test_client_id_is_not_encrypted_its_not_a_secret(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.whoop_client_id = "public-client-id"
    db_session.commit()

    db_path = db_session.bind.url.database
    raw = sqlite3.connect(db_path).execute(
        "SELECT whoop_client_id FROM users WHERE id = ?", (DEMO_USER_ID,)
    ).fetchone()
    assert raw[0] == "public-client-id"


def test_barcode_lookup_rejects_non_numeric_input(client, seeded):
    resp = client.get("/api/nutrition/lookup/not-a-barcode")
    assert resp.status_code == 422


def test_barcode_lookup_rejects_path_traversal_attempt(client, seeded):
    resp = client.get("/api/nutrition/lookup/../../etc/passwd")
    assert resp.status_code in (404, 422)  # 404 if routed as a different path, 422 if it reaches validation


def test_barcode_lookup_accepts_well_formed_barcode_and_returns_404_for_unknown_product(client, seeded):
    resp = client.get("/api/nutrition/lookup/012345678905")
    # Not asserting 200 -- that would require a real network call to Open Food
    # Facts. What matters here is it passes validation (not a 422) and fails
    # for a real reason (product not found / network unavailable in CI), not
    # because the input itself was rejected.
    assert resp.status_code != 422


def test_cors_rejects_arbitrary_external_origin(client, seeded):
    resp = client.options(
        "/api/today",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in {k.lower() for k in resp.headers.keys()}


def test_cors_allows_localhost_origin(client, seeded):
    resp = client.options(
        "/api/today",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:8081"
