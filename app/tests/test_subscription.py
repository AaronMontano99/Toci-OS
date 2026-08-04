"""Coverage for the real Toci Premium subscription flow: purchase
verification, restore, the App Store Server Notifications webhook, and the
security fix that closed the old "just PATCH is_premium" demo bypass.

None of this touches Apple's real servers -- apple_iap's verification
functions are monkeypatched to return payloads we construct ourselves, the
same real attrs classes app-store-server-library uses. What's under test is
Toci's own logic (state transitions, who gets updated, what happens on
failure), not Apple's cryptography, which is correctly delegated to their
own library rather than reimplemented here."""
import datetime as dt

import pytest
from appstoreserverlibrary.models.Data import Data
from appstoreserverlibrary.models.JWSTransactionDecodedPayload import JWSTransactionDecodedPayload
from appstoreserverlibrary.models.ResponseBodyV2DecodedPayload import ResponseBodyV2DecodedPayload

from toci import apple_iap, models
from toci.main import DEMO_USER_ID


def _future_ms(days=30):
    return int((dt.datetime.utcnow() + dt.timedelta(days=days)).timestamp() * 1000)


def _past_ms(days=1):
    return int((dt.datetime.utcnow() - dt.timedelta(days=days)).timestamp() * 1000)


def _active_transaction(**overrides):
    fields = dict(
        originalTransactionId="1000000123",
        transactionId="1000000123",
        productId=apple_iap.PRODUCT_ID_MONTHLY,
        expiresDate=_future_ms(),
        revocationReason=None,
    )
    fields.update(overrides)
    return JWSTransactionDecodedPayload(**fields)


# ------------------------------------------------------------ verify-purchase ----

def test_verify_purchase_activates_premium(client, db_session, seeded, monkeypatch):
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: _active_transaction())

    resp = client.post("/api/subscription/verify-purchase", json={"signed_transaction": "fake-jws"})
    assert resp.status_code == 200
    assert resp.json()["is_premium"] is True

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.is_premium is True
    assert user.subscription_status == "active"
    assert user.apple_original_transaction_id == "1000000123"
    assert user.subscription_product_id == apple_iap.PRODUCT_ID_MONTHLY


def test_verify_purchase_with_expired_transaction_does_not_activate(client, db_session, seeded, monkeypatch):
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: _active_transaction(expiresDate=_past_ms()))

    resp = client.post("/api/subscription/verify-purchase", json={"signed_transaction": "fake-jws"})
    assert resp.status_code == 200
    assert resp.json()["is_premium"] is False

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.subscription_status == "expired"


def test_verify_purchase_with_revoked_transaction_stays_locked(client, db_session, seeded, monkeypatch):
    # revocationReason is one of appstoreserverlibrary's "raw value aware"
    # fields -- construct it via the raw int, same as decoding a real JWS would.
    monkeypatch.setattr(
        apple_iap, "verify_signed_transaction", lambda jws: _active_transaction(rawRevocationReason=1)
    )

    resp = client.post("/api/subscription/verify-purchase", json={"signed_transaction": "fake-jws"})
    assert resp.json()["is_premium"] is False
    assert db_session.query(models.User).get(DEMO_USER_ID).subscription_status == "revoked"


def test_verify_purchase_rejects_when_apple_verification_fails(client, seeded, monkeypatch):
    def _raise(jws):
        raise ValueError("bad signature")

    monkeypatch.setattr(apple_iap, "verify_signed_transaction", _raise)
    resp = client.post("/api/subscription/verify-purchase", json={"signed_transaction": "garbage"})
    assert resp.status_code == 400


def test_verify_purchase_503s_when_apple_not_configured(client, seeded, monkeypatch):
    def _raise(jws):
        raise apple_iap.AppleNotConfiguredError("no creds")

    monkeypatch.setattr(apple_iap, "verify_signed_transaction", _raise)
    resp = client.post("/api/subscription/verify-purchase", json={"signed_transaction": "x"})
    assert resp.status_code == 503


# ------------------------------------------------------------------- restore ----

def test_restore_purchase_reactivates_premium(client, db_session, seeded, monkeypatch):
    monkeypatch.setattr(apple_iap, "fetch_transaction_info", lambda tx_id: _active_transaction())

    resp = client.post("/api/subscription/restore", json={"original_transaction_id": "1000000123"})
    assert resp.status_code == 200
    assert resp.json()["is_premium"] is True
    assert db_session.query(models.User).get(DEMO_USER_ID).apple_original_transaction_id == "1000000123"


# ---------------------------------------------------------------------- status ----

def test_subscription_status_reflects_current_state(client, db_session, seeded, monkeypatch):
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: _active_transaction())
    client.post("/api/subscription/verify-purchase", json={"signed_transaction": "fake-jws"})

    resp = client.get("/api/subscription/status")
    body = resp.json()
    assert body["is_premium"] is True
    assert body["status"] == "active"
    assert body["product_id"] == apple_iap.PRODUCT_ID_MONTHLY
    assert body["expires_at"] is not None


# -------------------------------------------------------------------- webhook ----

def test_notification_webhook_updates_the_matching_user(client, db_session, seeded, monkeypatch):
    # First establish the user's original_transaction_id via a real purchase.
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: _active_transaction())
    client.post("/api/subscription/verify-purchase", json={"signed_transaction": "fake-jws"})

    # Now simulate Apple notifying about a renewal that pushes the expiry further out.
    renewed = _active_transaction(expiresDate=_future_ms(days=60))
    monkeypatch.setattr(apple_iap, "verify_notification", lambda payload: ResponseBodyV2DecodedPayload(data=Data(signedTransactionInfo="renewal-jws")))
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: renewed)

    resp = client.post("/api/subscription/app-store-notifications", json={"signedPayload": "outer-jws"})
    assert resp.status_code == 200

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.is_premium is True
    assert user.subscription_expires_at > dt.datetime.utcnow() + dt.timedelta(days=59)


def test_notification_webhook_expiring_locks_the_user_out(client, db_session, seeded, monkeypatch):
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: _active_transaction())
    client.post("/api/subscription/verify-purchase", json={"signed_transaction": "fake-jws"})

    expired = _active_transaction(expiresDate=_past_ms())
    monkeypatch.setattr(apple_iap, "verify_notification", lambda payload: ResponseBodyV2DecodedPayload(data=Data(signedTransactionInfo="expiry-jws")))
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: expired)

    client.post("/api/subscription/app-store-notifications", json={"signedPayload": "outer-jws"})

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.is_premium is False
    assert user.subscription_status == "expired"


def test_notification_webhook_ignores_unknown_user(client, db_session, seeded, monkeypatch):
    """A notification for a transaction this server never saw (e.g. a
    different Apple ID's test purchase) should be a no-op, not a crash."""
    unknown = _active_transaction(originalTransactionId="999999999")
    monkeypatch.setattr(apple_iap, "verify_notification", lambda payload: ResponseBodyV2DecodedPayload(data=Data(signedTransactionInfo="jws")))
    monkeypatch.setattr(apple_iap, "verify_signed_transaction", lambda jws: unknown)

    resp = client.post("/api/subscription/app-store-notifications", json={"signedPayload": "outer-jws"})
    assert resp.status_code == 200

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.is_premium is False  # untouched


# --------------------------------------------------------- the closed bypass ----

def test_is_premium_cannot_be_set_via_generic_settings_patch(client, db_session, seeded):
    """This is the security fix: is_premium used to be a free-form settings
    field anyone could PATCH to true. Now it's derived only from a verified
    Apple transaction (see the tests above) -- this just proves the old
    bypass is gone."""
    resp = client.patch("/api/settings", json={"is_premium": True, "name": "Still Works"})
    assert resp.status_code == 200  # unknown fields are silently ignored by Pydantic, not an error

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.is_premium is False
    assert user.name == "Still Works"  # the real field in the same request did apply
