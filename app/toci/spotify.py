"""Spotify Web API -- real Authorization Code + PKCE flow, no client secret
needed (PKCE is specifically designed for public clients like this one).

Setup the user has to do once: create a free app at
https://developer.spotify.com/dashboard, add the exact redirect URI this
server uses (see main.SPOTIFY_REDIRECT_URI) to that app's settings, then
paste the app's Client ID into Settings -> Connected Music.
"""

import datetime as dt

import httpx

from . import models

TOKEN_URL = "https://accounts.spotify.com/api/token"
API_BASE = "https://api.spotify.com/v1"


def _store_tokens(db, user: models.User, data: dict):
    user.spotify_access_token = data["access_token"]
    if "refresh_token" in data:
        user.spotify_refresh_token = data["refresh_token"]
    user.spotify_token_expires_at = dt.datetime.utcnow() + dt.timedelta(seconds=data["expires_in"])
    db.commit()


def exchange_code(db, user: models.User, code: str, code_verifier: str, redirect_uri: str):
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": user.spotify_client_id,
            "code_verifier": code_verifier,
        },
        timeout=10,
    )
    resp.raise_for_status()
    _store_tokens(db, user, resp.json())


def _ensure_fresh_token(db, user: models.User) -> bool:
    if not user.spotify_access_token:
        return False
    if user.spotify_token_expires_at and user.spotify_token_expires_at > dt.datetime.utcnow() + dt.timedelta(seconds=30):
        return True
    if not user.spotify_refresh_token:
        return False
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": user.spotify_refresh_token,
            "client_id": user.spotify_client_id,
        },
        timeout=10,
    )
    if resp.status_code != 200:
        return False
    _store_tokens(db, user, resp.json())
    return True


def get_now_playing(db, user: models.User):
    if not _ensure_fresh_token(db, user):
        return None
    resp = httpx.get(
        API_BASE + "/me/player/currently-playing",
        headers={"Authorization": "Bearer " + user.spotify_access_token},
        timeout=10,
    )
    if resp.status_code in (204, 404):
        return {"playing": False, "track": None}
    if resp.status_code != 200:
        return None
    data = resp.json()
    item = data.get("item") or {}
    images = (item.get("album") or {}).get("images") or []
    return {
        "playing": data.get("is_playing", False),
        "track": item.get("name"),
        "artist": ", ".join(a["name"] for a in item.get("artists", [])),
        "album_art": images[0]["url"] if images else None,
    }


def set_playback(db, user: models.User, action: str):
    if not _ensure_fresh_token(db, user):
        return False, "Not connected"
    endpoint = "/me/player/play" if action == "play" else "/me/player/pause"
    resp = httpx.put(API_BASE + endpoint, headers={"Authorization": "Bearer " + user.spotify_access_token}, timeout=10)
    if resp.status_code == 204:
        return True, None
    if resp.status_code == 404:
        return False, "No active Spotify device — open Spotify somewhere first"
    if resp.status_code == 403:
        return False, "Playback control needs Spotify Premium"
    return False, "Spotify error (" + str(resp.status_code) + ")"
