"""Whoop API v2 -- real OAuth (Authorization Code, confidential client --
Whoop requires a client secret, unlike Spotify's PKCE-only flow) plus a
short-TTL cache for the day's recovery/cycle/sleep stats. Mirrors spotify.py's
pattern of isolating third-party API logic out of main.py.

Setup the user has to do once: create an app at developer.whoop.com, add this
server's redirect URI (see main.WHOOP_REDIRECT_URI) to it, then paste the
app's Client ID and Client Secret into Settings -> Connected Wearables.
Whoop's docs only document https:// or custom-scheme redirect URIs -- testing
with a real account will likely need an HTTPS tunnel (e.g. ngrok) pointing at
this server rather than the bare http://127.0.0.1 URI the Spotify integration
gets away with.
"""

import datetime as dt

import httpx
from sqlalchemy.orm import Session

from . import models

AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
API_BASE = "https://api.prod.whoop.com/developer/v2"
SCOPES = "read:recovery read:cycles read:sleep offline"
CACHE_TTL_MINUTES = 15

# key -> display metadata. Also doubles as the server-side allowlist for the
# "pick up to 3" stat customizer.
STAT_CATALOG = {
    "recovery_score": {"label": "Recovery", "unit": "%", "source": "recovery"},
    "hrv_rmssd_milli": {"label": "HRV", "unit": "ms", "source": "recovery"},
    "resting_heart_rate": {"label": "Resting HR", "unit": "bpm", "source": "recovery"},
    "spo2_percentage": {"label": "Blood Oxygen", "unit": "%", "source": "recovery"},
    "skin_temp_celsius": {"label": "Skin Temp", "unit": "°C", "source": "recovery"},
    "strain": {"label": "Day Strain", "unit": "", "source": "cycle"},
    "calories_burned": {"label": "Calories Burned", "unit": "kcal", "source": "cycle"},
    "average_heart_rate": {"label": "Avg Heart Rate", "unit": "bpm", "source": "cycle"},
    "max_heart_rate": {"label": "Max Heart Rate", "unit": "bpm", "source": "cycle"},
    "sleep_performance_percentage": {"label": "Sleep Performance", "unit": "%", "source": "sleep"},
    "sleep_efficiency_percentage": {"label": "Sleep Efficiency", "unit": "%", "source": "sleep"},
}

DEFAULT_DISPLAY_STATS = ["recovery_score", "hrv_rmssd_milli", "strain"]


def _store_tokens(db, user: models.User, data: dict):
    user.whoop_access_token = data["access_token"]
    if "refresh_token" in data:
        user.whoop_refresh_token = data["refresh_token"]
    user.whoop_token_expires_at = dt.datetime.utcnow() + dt.timedelta(seconds=data["expires_in"])
    db.commit()


def exchange_code(db, user: models.User, code: str, redirect_uri: str):
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": user.whoop_client_id,
            "client_secret": user.whoop_client_secret,
        },
        timeout=10,
    )
    resp.raise_for_status()
    _store_tokens(db, user, resp.json())


def _ensure_fresh_token(db, user: models.User) -> bool:
    if not user.whoop_access_token:
        return False
    if user.whoop_token_expires_at and user.whoop_token_expires_at > dt.datetime.utcnow() + dt.timedelta(seconds=30):
        return True
    if not user.whoop_refresh_token:
        return False
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": user.whoop_refresh_token,
            "client_id": user.whoop_client_id,
            "client_secret": user.whoop_client_secret,
        },
        timeout=10,
    )
    if resp.status_code != 200:
        return False
    _store_tokens(db, user, resp.json())
    return True


def _day_bounds(date: dt.date):
    start = dt.datetime.combine(date, dt.time.min)
    end = start + dt.timedelta(days=1)
    fmt = "%Y-%m-%dT%H:%M:%S.000Z"
    return start.strftime(fmt), end.strftime(fmt)


def _get_first_record(user: models.User, path: str, date: dt.date):
    start, end = _day_bounds(date)
    resp = httpx.get(
        API_BASE + path,
        headers={"Authorization": "Bearer " + user.whoop_access_token},
        params={"start": start, "end": end, "limit": 1},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    records = resp.json().get("records") or []
    return records[0] if records else None


def _fetch_recovery(user: models.User, date: dt.date):
    record = _get_first_record(user, "/recovery", date)
    if not record:
        return {}
    score = record.get("score") or {}
    return {
        "recovery_score": score.get("recovery_score"),
        "hrv_rmssd_milli": score.get("hrv_rmssd_milli"),
        "resting_heart_rate": score.get("resting_heart_rate"),
        "spo2_percentage": score.get("spo2_percentage"),
        "skin_temp_celsius": score.get("skin_temp_celsius"),
    }


def _fetch_cycle(user: models.User, date: dt.date):
    record = _get_first_record(user, "/cycle", date)
    if not record:
        return {}
    score = record.get("score") or {}
    kilojoule = score.get("kilojoule")
    return {
        "strain": score.get("strain"),
        "calories_burned": round(kilojoule / 4.184, 1) if kilojoule is not None else None,
        "average_heart_rate": score.get("average_heart_rate"),
        "max_heart_rate": score.get("max_heart_rate"),
    }


def _fetch_sleep(user: models.User, date: dt.date):
    record = _get_first_record(user, "/activity/sleep", date)
    if not record:
        return {}
    score = record.get("score") or {}
    return {
        "sleep_performance_percentage": score.get("sleep_performance_percentage"),
        "sleep_efficiency_percentage": score.get("sleep_efficiency_percentage"),
    }


def fetch_today_stats(db: Session, user: models.User, date: dt.date) -> dict:
    """Cached (short TTL -- Whoop's recovery/strain data changes through the
    day, unlike the nutrition barcode cache which is permanent) key->value
    dict of whatever stats are available. Partial-failure tolerant."""
    cached = db.query(models.WearableDayStats).filter_by(user_id=user.id, date=date, provider="whoop").first()
    if cached and cached.fetched_at > dt.datetime.utcnow() - dt.timedelta(minutes=CACHE_TTL_MINUTES):
        return cached.stats

    if not _ensure_fresh_token(db, user):
        return cached.stats if cached else {}

    stats = {}
    for fetcher in (_fetch_recovery, _fetch_cycle, _fetch_sleep):
        try:
            stats.update({k: v for k, v in fetcher(user, date).items() if v is not None})
        except httpx.HTTPError:
            continue  # one endpoint failing shouldn't blank out the others

    if cached:
        cached.stats = stats
        cached.fetched_at = dt.datetime.utcnow()
    else:
        db.add(models.WearableDayStats(user_id=user.id, date=date, provider="whoop", stats=stats))
    db.commit()
    return stats
