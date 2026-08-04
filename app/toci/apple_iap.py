"""Apple App Store Server API integration -- verifies real StoreKit 2
purchases and App Store Server Notifications V2 using Apple's own official
`app-store-server-library`, so the actual cryptographic trust chain
(certificate verification, JWS signature checking) is Apple's, not a
hand-rolled implementation of it.

Requires Apple credentials from App Store Connect (Users and Access ->
Integrations -> App Store Connect API), supplied via env vars -- see
docs/app-store-setup.md for exactly how to obtain each one:

    APPLE_ISSUER_ID          -- from the API Keys page
    APPLE_KEY_ID              -- the .p8 key's Key ID
    APPLE_PRIVATE_KEY_PATH    -- path to the downloaded .p8 private key file
    APPLE_BUNDLE_ID           -- must match app.json's ios.bundleIdentifier
    APPLE_ROOT_CA_PATH        -- Apple's public root CA cert ("Apple Root CA
                                 - G3"), downloaded from
                                 https://www.apple.com/certificateauthority/
    APPLE_ENVIRONMENT         -- "Sandbox" while testing, "Production" once live

None of these are auto-generated (unlike toci/crypto.py's encryption key) --
they come from Apple, tied to a real Developer Program membership, and this
module can't function without them. Until they're set, every function here
raises AppleNotConfiguredError; callers turn that into a 503, not a crash."""

import os
from pathlib import Path

from appstoreserverlibrary.api_client import AppStoreServerAPIClient
from appstoreserverlibrary.models.Environment import Environment
from appstoreserverlibrary.models.JWSTransactionDecodedPayload import JWSTransactionDecodedPayload
from appstoreserverlibrary.models.ResponseBodyV2DecodedPayload import ResponseBodyV2DecodedPayload
from appstoreserverlibrary.signed_data_verifier import SignedDataVerifier

# Must match the auto-renewable subscription product created in App Store
# Connect exactly -- see docs/app-store-setup.md.
PRODUCT_ID_MONTHLY = "com.toci.app.premium_monthly"


class AppleNotConfiguredError(Exception):
    """Apple credentials aren't set -- see this module's docstring."""


def _environment() -> Environment:
    return Environment.PRODUCTION if os.environ.get("APPLE_ENVIRONMENT") == "Production" else Environment.SANDBOX


def _required_config() -> dict:
    cfg = {
        "issuer_id": os.environ.get("APPLE_ISSUER_ID"),
        "key_id": os.environ.get("APPLE_KEY_ID"),
        "private_key_path": os.environ.get("APPLE_PRIVATE_KEY_PATH"),
        "bundle_id": os.environ.get("APPLE_BUNDLE_ID"),
        "root_ca_path": os.environ.get("APPLE_ROOT_CA_PATH"),
    }
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        raise AppleNotConfiguredError(
            f"Apple App Store credentials not configured (missing: {', '.join(missing)}). "
            "See docs/app-store-setup.md."
        )
    for path_key in ("private_key_path", "root_ca_path"):
        if not Path(cfg[path_key]).exists():
            raise AppleNotConfiguredError(f"{path_key} points at a file that doesn't exist: {cfg[path_key]}")
    return cfg


def _api_client() -> AppStoreServerAPIClient:
    cfg = _required_config()
    signing_key = Path(cfg["private_key_path"]).read_bytes()
    return AppStoreServerAPIClient(signing_key, cfg["key_id"], cfg["issuer_id"], cfg["bundle_id"], _environment())


def _verifier() -> SignedDataVerifier:
    cfg = _required_config()
    root_cert = Path(cfg["root_ca_path"]).read_bytes()
    return SignedDataVerifier([root_cert], enable_online_checks=True, environment=_environment(), bundle_id=cfg["bundle_id"])


def verify_signed_transaction(signed_transaction: str) -> JWSTransactionDecodedPayload:
    """Verifies a StoreKit 2 `Transaction.jwsRepresentation` string sent by
    the client right after a purchase completes. Raises
    appstoreserverlibrary's VerificationException if the signature, cert
    chain, or bundle ID don't check out -- treat that as "reject the
    purchase," not "retry."."""
    return _verifier().verify_and_decode_signed_transaction(signed_transaction)


def fetch_transaction_info(transaction_id: str) -> JWSTransactionDecodedPayload:
    """Server-initiated lookup, safe to call any time -- asks Apple directly
    for a transaction's current state rather than trusting whatever the
    client last reported. Used by /api/subscription/restore."""
    response = _api_client().get_transaction_info(transaction_id)
    return _verifier().verify_and_decode_signed_transaction(response.signedTransactionInfo)


def verify_notification(signed_payload: str) -> ResponseBodyV2DecodedPayload:
    """Verifies an incoming App Store Server Notification V2 webhook body's
    top-level signature. The transaction info nested inside is itself a
    separate signed JWS (decodedPayload.data.signedTransactionInfo) --
    verify that too via verify_signed_transaction before trusting it."""
    return _verifier().verify_and_decode_notification(signed_payload)
