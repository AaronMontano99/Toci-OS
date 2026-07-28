import datetime as dt
import random
import uuid
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import coach
from . import coach_chat as coach_chat_client
from . import engine as reco_engine
from . import models, schemas
from . import nutrition as nutrition_client
from . import recipes as recipes_client
from . import shopping as shopping_client
from . import spotify as spotify_client
from . import vision as vision_client
from . import whoop as whoop_client
from .database import Base
from .database import engine as db_engine
from .database import get_db
from .security import hash_password

Base.metadata.create_all(bind=db_engine)

DEMO_USER_ID = 1
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / "web"
# Progress photos are personal -- stored on disk (not committed, see .gitignore),
# filenames are always server-generated UUIDs, never derived from user input.
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "progress_photos"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
# Must match exactly what's registered in the Spotify app's dashboard settings.
# Use 127.0.0.1, not localhost, to open the app -- Spotify's own recommendation
# for loopback redirect URIs, and it's what this string is fixed to.
SPOTIFY_REDIRECT_URI = "http://127.0.0.1:8000/spotify/callback"
# Whoop's docs only document https:// or custom-scheme redirect URIs for their
# dashboard -- this loopback URI matches the app's existing convention, but
# testing against a real Whoop account will likely need an HTTPS tunnel (e.g.
# ngrok) pointed at this server rather than using this URI verbatim.
WHOOP_REDIRECT_URI = "http://127.0.0.1:8000/whoop/callback"

app = FastAPI(title="Toci OS API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _ensure_recovery_reading(db: Session, date: dt.date) -> models.DailyRecoveryMetric:
    """No wearable is connected on a laptop -- simulate a plausible reading
    around the rolling baseline the first time a given date is touched. The
    user can override it for real via POST /api/checkin."""
    row = db.query(models.DailyRecoveryMetric).filter_by(user_id=DEMO_USER_ID, date=date).first()
    if row:
        return row
    hrv_mean, _ = reco_engine.rolling_baseline(db, DEMO_USER_ID, date, "hrv_ms")
    rhr_mean, _ = reco_engine.rolling_baseline(db, DEMO_USER_ID, date, "resting_hr_bpm")
    row = models.DailyRecoveryMetric(
        user_id=DEMO_USER_ID,
        date=date,
        hrv_ms=round((hrv_mean or 60) + random.uniform(-4, 4), 1),
        resting_hr_bpm=round((rhr_mean or 54) + random.uniform(-3, 3)),
        sleep_duration_min=round(7.5 * 60 + random.uniform(-40, 20)),
        source="simulated",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _parse_date(date_str: str | None) -> dt.date:
    """Shared date-param parsing for every nutrition endpoint that accepts an
    optional selected date -- keeps "today" the single default everywhere."""
    if not date_str:
        return dt.date.today()
    try:
        return dt.date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(400, "date must be an ISO date, e.g. 2026-07-27")


def _active_mesocycle(db: Session):
    program = db.query(models.Program).filter_by(user_id=DEMO_USER_ID, status="active").first()
    if not program:
        raise HTTPException(500, "No active program -- run `python -m toci.seed` first")
    meso = (
        db.query(models.Mesocycle)
        .filter_by(program_id=program.id)
        .order_by(models.Mesocycle.index.desc())
        .first()
    )
    return program, meso


def _week_strip(db: Session, today: dt.date):
    monday = today - dt.timedelta(days=today.weekday())
    _, meso = _active_mesocycle(db)
    days = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()
    by_weekday = {d.weekday: d for d in days}
    out = []
    for i in range(7):
        d = monday + dt.timedelta(days=i)
        pd = by_weekday.get(i)
        is_completed = False
        if pd and pd.day_type in ("lift", "run") and d <= today:
            model = models.WorkoutSession if pd.day_type == "lift" else models.CardioSession
            is_completed = db.query(model).filter_by(user_id=DEMO_USER_ID, date=d).first() is not None
        out.append({
            "date": d.isoformat(),
            "weekday": i,
            "day_type": pd.day_type if pd else "rest",
            "label": pd.label if pd else "Rest",
            "is_today": d == today,
            "is_completed": is_completed,
        })
    return out


def _get_or_generate_recommendation(db: Session, date: dt.date):
    _ensure_recovery_reading(db, date)
    readiness = db.query(models.ReadinessScore).filter_by(user_id=DEMO_USER_ID, date=date).first()
    if not readiness:
        readiness = reco_engine.compute_readiness(db, DEMO_USER_ID, date)
    reco = db.query(models.Recommendation).filter_by(user_id=DEMO_USER_ID, date=date).first()
    if not reco:
        reco = reco_engine.generate_recommendation(db, DEMO_USER_ID, date, readiness)
    return reco, readiness


# ---------------------------------------------------------------- today ----

def _today_workout_status(db: Session, reco, today: dt.date) -> dict:
    """Real, derived state for the Today workout card -- never a client-side guess.
    "active" vs "completed" comes straight from WorkoutSession.ended_at; a lift
    session already in progress is reused (never duplicated) by the frontend."""
    status = {
        "state": "none", "session_id": None,
        "completed_exercise_count": None, "total_exercise_count": None, "elapsed_min": None,
    }
    if reco.session_type == "lift":
        status["total_exercise_count"] = len(reco.prescription.get("exercises", []))

    # Checked unconditionally (not gated on reco.session_type == "lift") -- the Log
    # tab's "Start Empty Session" lets a freeform lift session begin on any day,
    # including a scheduled run or rest day, and it must still be detected as
    # active so Resume Session shows up and a duplicate never gets created.
    session = (
        db.query(models.WorkoutSession)
        .filter_by(user_id=DEMO_USER_ID, date=today)
        .order_by(models.WorkoutSession.id.desc())
        .first()
    )
    if session:
        completed_exercise_count = (
            db.query(models.WorkoutSet.exercise_id)
            .filter_by(workout_session_id=session.id)
            .distinct()
            .count()
        )
        elapsed_min = None
        if session.started_at:
            end = session.ended_at or dt.datetime.utcnow()
            elapsed_min = max(0, round((end - session.started_at).total_seconds() / 60))
        status.update({
            "state": "completed" if session.ended_at else "active",
            "session_id": session.id,
            "completed_exercise_count": completed_exercise_count,
            "elapsed_min": elapsed_min,
        })
    elif reco.session_type == "run":
        session = (
            db.query(models.CardioSession)
            .filter_by(user_id=DEMO_USER_ID, date=today, activity_type="run")
            .order_by(models.CardioSession.id.desc())
            .first()
        )
        if session:
            status.update({
                "state": "completed", "session_id": session.id,
                "elapsed_min": round(session.duration_seconds / 60),
            })
    return status


@app.get("/api/today")
def get_today(db: Session = Depends(get_db)):
    today = dt.date.today()
    reco, readiness = _get_or_generate_recommendation(db, today)

    recovery = db.query(models.DailyRecoveryMetric).filter_by(user_id=DEMO_USER_ID, date=today).first()
    checkin = db.query(models.DailyCheckin).filter_by(user_id=DEMO_USER_ID, date=today).first()
    _, meso = _active_mesocycle(db)
    by_weekday = {d.weekday: d for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()}
    today_pd = by_weekday.get(today.weekday())

    return {
        "date": today.isoformat(),
        "readiness": {"score": readiness.score, "band": readiness.band},
        "recovery": {
            "hrv_ms": recovery.hrv_ms,
            "resting_hr_bpm": recovery.resting_hr_bpm,
            "sleep_duration_min": recovery.sleep_duration_min,
        },
        "checked_in": checkin is not None,
        "recommendation": {
            "session_type": reco.session_type,
            "prescription": reco.prescription,
            "reasoning": reco.reasoning,
        },
        "workout_status": _today_workout_status(db, reco, today),
        "mobility_items": today_pd.template.get("mobility_items", []) if today_pd else [],
        "conditioning_items": today_pd.template.get("conditioning", {}).get("items", []) if today_pd else [],
        "week": _week_strip(db, today),
        "streak": _compute_streak(db, by_weekday, today),
    }


@app.post("/api/checkin")
def submit_checkin(payload: schemas.CheckinIn, db: Session = Depends(get_db)):
    today = dt.date.today()

    recovery = db.query(models.DailyRecoveryMetric).filter_by(user_id=DEMO_USER_ID, date=today).first()
    if not recovery:
        recovery = models.DailyRecoveryMetric(user_id=DEMO_USER_ID, date=today)
        db.add(recovery)
    recovery.hrv_ms = payload.hrv_ms
    recovery.resting_hr_bpm = payload.resting_hr_bpm
    recovery.sleep_duration_min = round(payload.sleep_hours * 60)
    recovery.source = "manual"

    checkin = db.query(models.DailyCheckin).filter_by(user_id=DEMO_USER_ID, date=today).first()
    if not checkin:
        checkin = models.DailyCheckin(user_id=DEMO_USER_ID, date=today)
        db.add(checkin)
    checkin.soreness_1_5 = payload.soreness_1_5
    checkin.stress_mood_1_5 = payload.stress_mood_1_5
    db.commit()

    readiness = reco_engine.compute_readiness(db, DEMO_USER_ID, today)
    reco = reco_engine.generate_recommendation(db, DEMO_USER_ID, today, readiness)
    return {
        "readiness": {"score": readiness.score, "band": readiness.band},
        "recommendation": {
            "session_type": reco.session_type,
            "prescription": reco.prescription,
            "reasoning": reco.reasoning,
        },
    }


# -------------------------------------------------------------- logging ----

@app.get("/api/exercises")
def list_exercises(db: Session = Depends(get_db)):
    rows = db.query(models.Exercise).order_by(models.Exercise.name).all()
    return [{"id": e.id, "name": e.name, "primary_muscle_group": e.primary_muscle_group} for e in rows]


@app.post("/api/exercises")
def add_exercise(payload: schemas.ExerciseIn, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Exercise name is required")
    # case-insensitive upsert-by-name so retyping an existing exercise
    # (different casing included) doesn't create a duplicate
    existing = db.query(models.Exercise).filter(func.lower(models.Exercise.name) == name.lower()).first()
    if existing:
        return {"id": existing.id, "name": existing.name}
    row = models.Exercise(
        name=name,
        movement_pattern=payload.movement_pattern or "custom",
        primary_muscle_group=payload.primary_muscle_group or "custom",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name}


@app.post("/api/workouts")
def start_workout(payload: schemas.WorkoutStartIn, db: Session = Depends(get_db)):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=dt.date.today(), label=payload.label)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id}


@app.delete("/api/workouts/{session_id}")
def delete_workout_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a whole logged workout (e.g. logged against the wrong day, or a
    test/accidental entry) -- not just individual sets within it."""
    db.query(models.WorkoutSet).filter_by(workout_session_id=session_id).delete()
    db.query(models.WorkoutSession).filter_by(id=session_id, user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"ok": True}


@app.get("/api/workouts/{session_id}")
def get_workout_session(session_id: int, db: Session = Depends(get_db)):
    """Used to resume an in-progress session (Today's "Resume Workout") without
    creating a duplicate WorkoutSession row for the same day."""
    session = db.query(models.WorkoutSession).get(session_id)
    if not session:
        raise HTTPException(404, "Workout session not found")
    rows = (
        db.query(models.WorkoutSet, models.Exercise.name)
        .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
        .filter(models.WorkoutSet.workout_session_id == session_id)
        .order_by(models.WorkoutSet.id)
        .all()
    )
    by_exercise: dict[int, dict] = {}
    for s, name in rows:
        entry = by_exercise.setdefault(s.exercise_id, {"exercise_id": s.exercise_id, "name": name, "logged_sets": []})
        entry["logged_sets"].append({
            "id": s.id, "set_number": s.set_index,
            "weight_kg": s.actual_load_kg, "reps": s.actual_reps, "rest_seconds": s.rest_seconds, "feel": s.feel,
        })
    exercise_count, volume_kg = _lift_session_volume_kg(db, session_id)
    return {
        "id": session.id, "label": session.label, "date": session.date.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "duration_min": _lift_session_duration_min(db, session) if session.ended_at else None,
        "exercise_count": exercise_count, "volume_kg": volume_kg,
        "exercises_with_sets": list(by_exercise.values()),
    }


@app.post("/api/workouts/{session_id}/sets")
def log_set(session_id: int, payload: schemas.SetIn, db: Session = Depends(get_db)):
    session = db.query(models.WorkoutSession).get(session_id)
    if not session:
        raise HTTPException(404, "Workout session not found")
    row = models.WorkoutSet(workout_session_id=session_id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@app.patch("/api/sets/{set_id}")
def update_set(set_id: int, payload: schemas.SetUpdateIn, db: Session = Depends(get_db)):
    """Fix a mis-logged set (typo'd weight, wrong reps, forgot to note how it
    felt) after the fact -- without this, the only recourse was delete and
    re-log, losing the set's position/timing."""
    row = db.query(models.WorkoutSet).get(set_id)
    if not row:
        raise HTTPException(404, "Set not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@app.delete("/api/sets/{set_id}")
def delete_set(set_id: int, db: Session = Depends(get_db)):
    row = db.query(models.WorkoutSet).get(set_id)
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


@app.post("/api/workouts/{session_id}/complete")
def complete_workout(session_id: int, db: Session = Depends(get_db)):
    session = db.query(models.WorkoutSession).get(session_id)
    if not session:
        raise HTTPException(404, "Workout session not found")
    session.ended_at = dt.datetime.utcnow()
    db.commit()
    return {"ok": True}


@app.post("/api/runs")
def log_run(payload: schemas.RunIn, db: Session = Depends(get_db)):
    row = models.CardioSession(user_id=DEMO_USER_ID, date=dt.date.today(), activity_type="run", **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@app.get("/api/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    """Read-only detail for a single completed run -- powers the Log tab's
    completed-session detail view."""
    row = db.query(models.CardioSession).filter_by(id=run_id, user_id=DEMO_USER_ID).first()
    if not row:
        raise HTTPException(404, "Run not found")
    return {
        "id": row.id, "date": row.date.isoformat(), "activity_type": row.activity_type,
        "duration_min": round(row.duration_seconds / 60),
        "distance_km": round((row.distance_meters or 0) / 1000, 2) if row.distance_meters else None,
        "pace_per_km": _run_pace_per_km(row),
        "avg_hr": row.avg_hr, "perceived_effort": row.perceived_effort,
    }


@app.patch("/api/runs/{run_id}")
def update_run(run_id: int, payload: schemas.RunUpdateIn, db: Session = Depends(get_db)):
    row = db.query(models.CardioSession).filter_by(id=run_id, user_id=DEMO_USER_ID).first()
    if not row:
        raise HTTPException(404, "Run not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    return {"ok": True}


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db)):
    db.query(models.CardioSession).filter_by(id=run_id, user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------- log ----

def _lift_session_duration_min(db: Session, session: "models.WorkoutSession") -> int:
    if session.started_at and session.ended_at:
        return max(1, round((session.ended_at - session.started_at).total_seconds() / 60))
    set_count = db.query(models.WorkoutSet).filter_by(workout_session_id=session.id).count()
    return max(15, round((set_count * 2.5) / 5) * 5)  # same rough estimate used elsewhere when no timestamps exist


def _lift_session_volume_kg(db: Session, session_id: int) -> tuple[int, float]:
    sets = db.query(models.WorkoutSet).filter_by(workout_session_id=session_id).all()
    exercise_count = len({s.exercise_id for s in sets})
    volume_kg = sum((s.actual_load_kg or 0) * (s.actual_reps or 0) for s in sets)
    return exercise_count, round(volume_kg, 1)


def _run_pace_per_km(session: "models.CardioSession"):
    if not session.distance_meters or not session.duration_seconds:
        return None
    pace_sec = session.duration_seconds / (session.distance_meters / 1000)
    return f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}"


@app.get("/api/log/lift-days")
def log_lift_days(db: Session = Depends(get_db)):
    """This week's lift-type Program days, for the Log tab's "Choose Saved Workout"
    picker -- real workout-template state, not a second program system."""
    today = dt.date.today()
    monday = today - dt.timedelta(days=today.weekday())
    _, meso = _active_mesocycle(db)
    by_weekday = {d.weekday: d for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()}
    out = []
    for i in range(7):
        d = by_weekday.get(i)
        if d and d.day_type == "lift":
            out.append({
                "weekday": i,
                "date": (monday + dt.timedelta(days=i)).isoformat(),
                "label": d.label,
                "exercise_count": len(d.template.get("exercises", [])),
                "is_today": i == today.weekday(),
            })
    return out


@app.get("/api/log/lift-days/{weekday}/prescription")
def log_lift_day_prescription(weekday: int, db: Session = Depends(get_db)):
    """Builds a live prescription (current progression + readiness applied) for
    a specific weekday's saved lift day, so starting it from the Log tab behaves
    the same as starting it on its actual scheduled day."""
    _, meso = _active_mesocycle(db)
    day = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, weekday=weekday).first()
    if not day or day.day_type != "lift":
        raise HTTPException(404, "No lift day scheduled for that weekday")
    _, readiness = _get_or_generate_recommendation(db, dt.date.today())
    return reco_engine.build_lift_day_prescription(db, DEMO_USER_ID, day, readiness)


def _recent_sessions(db: Session, fetch_cap: int):
    """Shared lift+run session list, newest first, deduplicated logic used by
    both the landing summary (small N) and the paginated history endpoint
    (larger N) -- one place computes session dicts, nothing recalculates them."""
    lifts = db.query(models.WorkoutSession).filter_by(user_id=DEMO_USER_ID).order_by(models.WorkoutSession.date.desc()).limit(fetch_cap).all()
    runs = db.query(models.CardioSession).filter_by(user_id=DEMO_USER_ID).order_by(models.CardioSession.date.desc()).limit(fetch_cap).all()

    recent = []
    for s in lifts:
        exercise_count, volume_kg = _lift_session_volume_kg(db, s.id)
        recent.append({
            "id": s.id, "type": "lift", "title": s.label or "Lift Session", "date": s.date.isoformat(),
            "duration_min": _lift_session_duration_min(db, s),
            "exercise_count": exercise_count, "volume_kg": volume_kg,
            "sort_key": (s.date.isoformat(), s.id),
        })
    for s in runs:
        recent.append({
            "id": s.id, "type": "run", "title": "Run", "date": s.date.isoformat(),
            "duration_min": round(s.duration_seconds / 60),
            "distance_km": round((s.distance_meters or 0) / 1000, 2) if s.distance_meters else None,
            "pace_per_km": _run_pace_per_km(s),
            "sort_key": (s.date.isoformat(), s.id),
        })
    recent.sort(key=lambda r: r["sort_key"], reverse=True)
    for r in recent:
        del r["sort_key"]
    return recent


@app.get("/api/log/history")
def log_history(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    """Paginated activity history -- deliberately separate from /log/summary so
    paging through history never re-triggers that endpoint's weekly-totals math."""
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    all_recent = _recent_sessions(db, fetch_cap=offset + limit + 1)
    page = all_recent[offset:offset + limit]
    return {"sessions": page, "has_more": len(all_recent) > offset + limit}


@app.get("/api/log/summary")
def log_summary(recent_limit: int = 5, period: str = "this_week", db: Session = Depends(get_db)):
    today = dt.date.today()
    this_monday = today - dt.timedelta(days=today.weekday())
    if period == "last_week":
        period_start, period_end, period_weeks = this_monday - dt.timedelta(days=7), this_monday - dt.timedelta(days=1), 1
    elif period == "last_4_weeks":
        period_start, period_end, period_weeks = today - dt.timedelta(days=27), today, 4
    else:
        period, period_start, period_end, period_weeks = "this_week", this_monday, today, 1

    recent = _recent_sessions(db, fetch_cap=max(10, recent_limit))[:recent_limit]

    # period range is a full week for this_week/last_week and trailing 28 days for
    # last_4_weeks -- all queried directly by date rather than reusing `recent` above,
    # since that "most recent N" list is capped independent of the selected period.
    period_lifts = db.query(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == DEMO_USER_ID,
        models.WorkoutSession.date >= period_start, models.WorkoutSession.date <= period_end,
    ).all()
    period_runs = db.query(models.CardioSession).filter(
        models.CardioSession.user_id == DEMO_USER_ID,
        models.CardioSession.date >= period_start, models.CardioSession.date <= period_end,
    ).all()
    period_lift_min = sum(_lift_session_duration_min(db, s) for s in period_lifts)
    period_run_min = sum(round(s.duration_seconds / 60) for s in period_runs)
    # No calorie sensor data exists for lift/cardio sessions -- this is a rough
    # MET-style estimate (same "estimate, not measurement" spirit as the
    # duration fallback above), just enough to give the snapshot a number.
    est_calories = round(period_lift_min * 6 + period_run_min * 10)

    program, meso = _active_mesocycle(db)
    by_weekday = {d.weekday: d for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()}
    lift_goal = sum(1 for d in by_weekday.values() if d.day_type == "lift") * period_weeks
    run_goal = sum(1 for d in by_weekday.values() if d.day_type == "run") * period_weeks
    time_goal_min = (lift_goal * 45) + (run_goal * 30)
    calorie_goal = (lift_goal * 6 * 45) + (run_goal * 10 * 30)

    total_planned = lift_goal + run_goal
    total_done = len(period_lifts) + len(period_runs)
    lift_remaining = max(0, lift_goal - len(period_lifts))
    run_remaining = max(0, run_goal - len(period_runs))

    days_elapsed = (today - program.started_at).days
    current_week = max(1, min(meso.weeks, days_elapsed // 7 + 1))
    is_deload_week = period == "this_week" and meso.deload_week_index is not None and current_week == meso.deload_week_index

    if is_deload_week:
        encouragement = "Recovery week in progress — lighter volume is expected."
    elif not total_planned:
        encouragement = "No sessions scheduled this period — log anything you complete."
    elif total_done >= total_planned:
        encouragement = "You're on track! Keep the momentum going."
    elif run_goal and run_remaining == 0 and lift_remaining:
        encouragement = f"Your running goal is complete. {lift_remaining} lift session{'s' if lift_remaining != 1 else ''} left to hit your plan."
    elif lift_goal and lift_remaining == 0 and run_remaining:
        encouragement = f"Your lifting goal is complete. {run_remaining} run{'s' if run_remaining != 1 else ''} left to hit your plan."
    elif total_done >= total_planned * 0.5:
        encouragement = "Good progress this period — a couple more sessions to hit your plan."
    else:
        encouragement = "Early in the period — let's get a session in."

    return {
        "period": period,
        "recent_sessions": recent,
        "week": {
            "lift_sessions": len(period_lifts), "lift_goal": lift_goal,
            "runs": len(period_runs), "run_goal": run_goal,
            "total_time_min": period_lift_min + period_run_min, "time_goal_min": time_goal_min,
            "est_calories": est_calories, "calorie_goal": calorie_goal,
        },
        "encouragement": encouragement,
    }


# -------------------------------------------------------------- progress ----

@app.get("/api/progress/strength/{exercise_id}")
def progress_strength(exercise_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.WorkoutSet, models.WorkoutSession.date)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(
            models.WorkoutSession.user_id == DEMO_USER_ID,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.actual_load_kg.isnot(None),
        )
        .order_by(models.WorkoutSession.date)
        .all()
    )
    points = []
    for s, session_date in rows:
        if s.actual_reps and s.actual_load_kg:
            est_1rm = round(s.actual_load_kg * (1 + s.actual_reps / 30), 1)
            # one point per day -- keep the day's heaviest estimated 1RM if multiple sets were logged
            if points and points[-1]["date"] == session_date.isoformat():
                points[-1]["est_1rm_kg"] = max(points[-1]["est_1rm_kg"], est_1rm)
            else:
                points.append({"date": session_date.isoformat(), "est_1rm_kg": est_1rm})

    best_lift_kg = max((p["est_1rm_kg"] for p in points), default=None)
    pct_change = None
    trend = "flat"
    if len(points) >= 2:
        current = points[-1]["est_1rm_kg"]
        cutoff = (dt.date.fromisoformat(points[-1]["date"]) - dt.timedelta(days=28)).isoformat()
        prior_candidates = [p for p in points if p["date"] <= cutoff]
        baseline = prior_candidates[-1]["est_1rm_kg"] if prior_candidates else points[0]["est_1rm_kg"]
        if baseline:
            pct_change = round(100 * (current - baseline) / baseline, 1)
            trend = "up" if pct_change > 1 else "down" if pct_change < -1 else "flat"

    # "Consistency" here means adherence to the program's planned lift/run days,
    # the same weekly_adherence_pct used on the Program tab -- reused so this
    # number means the same thing everywhere it appears in the app.
    today = dt.date.today()
    program, meso = _active_mesocycle(db)
    by_weekday = {d.weekday: d for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()}
    consistency_pct = _program_progress(db, program, meso, by_weekday, today)["weekly_adherence_pct"]

    return {
        "exercise_id": exercise_id, "points": points,
        "best_lift_kg": best_lift_kg, "pct_change_28d": pct_change, "trend": trend,
        "consistency_pct": consistency_pct,
    }


@app.get("/api/prs")
def get_prs(limit: int = 10, db: Session = Depends(get_db)):
    rows = (
        db.query(models.WorkoutSet, models.WorkoutSession.date, models.Exercise.name)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
        .filter(models.WorkoutSession.user_id == DEMO_USER_ID, models.WorkoutSet.actual_load_kg.isnot(None))
        .order_by(models.WorkoutSession.date)
        .all()
    )
    best = {}  # ex_name -> (best_est, date, delta_kg vs the previous best when this PR happened)
    for s, session_date, ex_name in rows:
        if not (s.actual_reps and s.actual_load_kg):
            continue
        est = s.actual_load_kg * (1 + s.actual_reps / 30)
        prev = best.get(ex_name)
        if prev is None:
            best[ex_name] = (est, session_date, None)
        elif est > prev[0]:
            best[ex_name] = (est, session_date, est - prev[0])

    runs = (
        db.query(models.CardioSession)
        .filter_by(user_id=DEMO_USER_ID, activity_type="run")
        .order_by(models.CardioSession.date)
        .all()
    )
    best_pace = None
    for r in runs:
        if r.distance_meters and r.duration_seconds:
            pace = r.duration_seconds / (r.distance_meters / 1000)
            if best_pace is None or pace < best_pace[0]:
                best_pace = (pace, r.date)

    prs = [{"exercise": name, "date": date.isoformat(), "est_1rm_kg": round(est, 1), "delta_kg": round(delta, 1) if delta else None} for name, (est, date, delta) in best.items()]
    if best_pace:
        pace_sec, date = best_pace
        prs.append({"exercise": "Best pace", "date": date.isoformat(), "pace_per_km": f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}", "delta_kg": None})
    prs.sort(key=lambda p: p["date"], reverse=True)
    return {"prs": prs[:limit]}


@app.get("/api/body-weight/history")
def body_weight_history(days: int = 30, db: Session = Depends(get_db)):
    start = dt.date.today() - dt.timedelta(days=days)
    rows = (
        db.query(models.BodyMetric)
        .filter(models.BodyMetric.user_id == DEMO_USER_ID, models.BodyMetric.date >= start)
        .order_by(models.BodyMetric.date)
        .all()
    )
    return {"points": [{"id": r.id, "date": r.date.isoformat(), "weight_kg": r.weight_kg} for r in rows if r.weight_kg is not None]}


@app.get("/api/progress/weekly-summary")
def progress_weekly_summary(db: Session = Depends(get_db)):
    today = dt.date.today()
    week_start = today - dt.timedelta(days=6)

    food_rows = (
        db.query(models.FoodLogEntry, models.FoodItem)
        .join(models.FoodItem, models.FoodLogEntry.food_item_id == models.FoodItem.id)
        .filter(models.FoodLogEntry.user_id == DEMO_USER_ID, models.FoodLogEntry.date >= week_start)
        .all()
    )
    calories_this_week = sum(f.calories * e.servings for e, f in food_rows)
    protein_this_week = sum(f.protein_g * e.servings for e, f in food_rows)
    days_logged = len({e.date for e, f in food_rows})
    avg_daily_calories = round(calories_this_week / days_logged) if days_logged else 0
    avg_daily_protein_g = round(protein_this_week / days_logged) if days_logged else 0

    weight_rows = (
        db.query(models.BodyMetric)
        .filter(models.BodyMetric.user_id == DEMO_USER_ID, models.BodyMetric.date >= week_start)
        .order_by(models.BodyMetric.date)
        .all()
    )
    weight_delta_kg = round(weight_rows[-1].weight_kg - weight_rows[0].weight_kg, 1) if len(weight_rows) >= 2 else None

    _, meso = _active_mesocycle(db)
    program_days = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()
    by_weekday = {d.weekday: d for d in program_days}
    planned_days = 0
    matched_days = 0
    checkin_days = 0
    for i in range(7):
        d = week_start + dt.timedelta(days=i)
        pd = by_weekday.get(d.weekday())
        if pd and pd.day_type in ("lift", "run"):
            planned_days += 1
            model = models.WorkoutSession if pd.day_type == "lift" else models.CardioSession
            if db.query(model).filter_by(user_id=DEMO_USER_ID, date=d).first():
                matched_days += 1
        if db.query(models.DailyCheckin).filter_by(user_id=DEMO_USER_ID, date=d).first():
            checkin_days += 1

    workout_adherence = (matched_days / planned_days) if planned_days else 1.0
    nutrition_adherence = days_logged / 7
    checkin_adherence = checkin_days / 7
    score = round(100 * (0.5 * workout_adherence + 0.3 * nutrition_adherence + 0.2 * checkin_adherence))
    band = "Excellent" if score >= 80 else "Good" if score >= 50 else "Needs Work"

    return {
        "calories_this_week": round(calories_this_week),
        "avg_daily_calories": avg_daily_calories,
        "avg_daily_protein_g": avg_daily_protein_g,
        "days_logged": days_logged,
        "matched_days": matched_days,
        "planned_days": planned_days,
        "weight_delta_kg": weight_delta_kg,
        "consistency": {
            "score": score,
            "band": band,
            "workout_adherence": round(workout_adherence, 2),
            "nutrition_adherence": round(nutrition_adherence, 2),
            "checkin_adherence": round(checkin_adherence, 2),
        },
    }


def _photo_out(p: models.ProgressPhoto):
    return {
        "id": p.id,
        "date": p.date.isoformat(),
        "url": f"/uploads/progress_photos/{p.filename}",
        "note": p.note,
        "ai_impression": p.ai_impression,
    }


@app.get("/api/progress/photos")
def list_progress_photos(db: Session = Depends(get_db)):
    photos = (
        db.query(models.ProgressPhoto)
        .filter_by(user_id=DEMO_USER_ID)
        .order_by(models.ProgressPhoto.date.desc(), models.ProgressPhoto.id.desc())
        .all()
    )
    return [_photo_out(p) for p in photos]


@app.post("/api/progress/photos")
async def upload_progress_photo(
    file: UploadFile = File(...),
    date: str | None = Form(None),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise HTTPException(400, "Unsupported image type")
    body = await file.read()
    if len(body) > MAX_PHOTO_BYTES:
        raise HTTPException(400, "Image too large (max 10MB)")

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    (UPLOADS_DIR / filename).write_bytes(body)

    photo_date = dt.date.fromisoformat(date) if date else dt.date.today()
    photo = models.ProgressPhoto(
        user_id=DEMO_USER_ID, date=photo_date, filename=filename, note=note,
        # Best-effort: if Ollama/the vision model isn't available or the call
        # times out, ai_impression just stays null -- the photo still saves.
        ai_impression=vision_client.generate_impression(body),
        ai_impression_generated_at=dt.datetime.utcnow(),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


@app.delete("/api/progress/photos/{photo_id}")
def delete_progress_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.ProgressPhoto).filter_by(id=photo_id, user_id=DEMO_USER_ID).first()
    if not photo:
        raise HTTPException(404, "Photo not found")
    (UPLOADS_DIR / photo.filename).unlink(missing_ok=True)
    db.delete(photo)
    db.commit()
    return {"deleted": True}


@app.get("/api/coach/chat")
def get_chat_history(db: Session = Depends(get_db)):
    rows = (
        db.query(models.ProgramChatMessage)
        .filter_by(user_id=DEMO_USER_ID)
        .filter(models.ProgramChatMessage.role.in_(["user", "assistant"]))
        .order_by(models.ProgramChatMessage.id)
        .all()
    )
    return [
        {
            "id": m.id, "role": m.role, "content": m.content,
            "proposal": m.proposal_json, "proposal_status": m.proposal_status,
        }
        for m in rows
    ]


@app.post("/api/coach/chat")
def post_chat_message(payload: dict, db: Session = Depends(get_db)):
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(400, "Message can't be empty")
    if len(message) > 1000:
        raise HTTPException(400, "Message too long")
    return coach_chat_client.chat(db, DEMO_USER_ID, message)


@app.post("/api/coach/chat/{message_id}/apply")
def apply_chat_proposal(message_id: int, db: Session = Depends(get_db)):
    try:
        return coach_chat_client.apply_proposal(db, DEMO_USER_ID, message_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/coach/chat/{message_id}/discard")
def discard_chat_proposal(message_id: int, db: Session = Depends(get_db)):
    try:
        return coach_chat_client.discard_proposal(db, DEMO_USER_ID, message_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/coach/chat")
def clear_chat_history(db: Session = Depends(get_db)):
    db.query(models.ProgramChatMessage).filter_by(user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"cleared": True}


@app.get("/api/workouts/last-session")
def last_session_for_split(label: str, day_type: str, db: Session = Depends(get_db)):
    """Powers 'what did I do last time I trained this split' when tapping a
    day in This Week's Training -- looks up the most recent session matching
    this label (lift) or the most recent run (cardio has no per-split label)."""
    if day_type == "lift":
        session = (
            db.query(models.WorkoutSession)
            .filter(models.WorkoutSession.user_id == DEMO_USER_ID, models.WorkoutSession.label == label, models.WorkoutSession.date < dt.date.today())
            .order_by(models.WorkoutSession.date.desc())
            .first()
        )
        if not session:
            return {"found": False}
        rows = (
            db.query(models.WorkoutSet, models.Exercise.name)
            .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
            .filter(models.WorkoutSet.workout_session_id == session.id)
            .order_by(models.WorkoutSet.id)
            .all()
        )
        grouped, order = {}, []
        for s, name in rows:
            if name not in grouped:
                grouped[name] = []
                order.append(name)
            grouped[name].append(s)
        exercises = []
        for name in order:
            sets = grouped[name]
            top = max(sets, key=lambda r: (r.actual_load_kg or 0))
            exercises.append({"name": name, "sets": len(sets), "top_load_kg": top.actual_load_kg, "top_reps": top.actual_reps})
        return {"found": True, "type": "lift", "date": session.date.isoformat(), "exercises": exercises}

    if day_type == "run":
        session = (
            db.query(models.CardioSession)
            .filter(models.CardioSession.user_id == DEMO_USER_ID, models.CardioSession.date < dt.date.today())
            .order_by(models.CardioSession.date.desc())
            .first()
        )
        if not session:
            return {"found": False}
        return {
            "found": True, "type": "run", "date": session.date.isoformat(),
            "duration_min": round(session.duration_seconds / 60),
            "distance_km": round((session.distance_meters or 0) / 1000, 2),
            "avg_hr": session.avg_hr,
        }

    return {"found": False}


# --------------------------------------------------------------- program ----

def _goal_out(g: models.Goal):
    pct = None
    if g.start_value is not None and g.target_value is not None and g.current_value is not None and g.target_value != g.start_value:
        pct = round(100 * max(0.0, min(1.0, (g.current_value - g.start_value) / (g.target_value - g.start_value))))
    return {
        "id": g.id, "title": g.title, "kind": g.kind, "unit": g.unit,
        "start_value": g.start_value, "current_value": g.current_value, "target_value": g.target_value,
        "is_secondary": g.is_secondary, "status": g.status, "progress_pct": pct,
        "target_date": g.target_date.isoformat() if g.target_date else None,
    }


def _week_detail(db: Session, meso, today: dt.date):
    monday = today - dt.timedelta(days=today.weekday())
    days = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()
    by_weekday = {d.weekday: d for d in days}
    exercise_ids = {
        item["exercise_id"]
        for d in days if d.day_type == "lift"
        for item in d.template.get("exercises", [])
    }
    exercises_by_id = {e.id: e for e in db.query(models.Exercise).filter(models.Exercise.id.in_(exercise_ids)).all()} if exercise_ids else {}

    out = []
    for i in range(7):
        d = monday + dt.timedelta(days=i)
        pd = by_weekday.get(i)
        is_completed = False
        if pd and pd.day_type in ("lift", "run") and d <= today:
            model = models.WorkoutSession if pd.day_type == "lift" else models.CardioSession
            is_completed = db.query(model).filter_by(user_id=DEMO_USER_ID, date=d).first() is not None
        entry = {
            "date": d.isoformat(), "weekday": i,
            "day_type": pd.day_type if pd else "rest",
            "label": pd.label if pd else "Rest",
            "is_today": d == today,
            "is_completed": is_completed,
            "exercises": [],
            "run": None,
            # Optional, free-form day content beyond formal sets/reps -- a cardio
            # finisher tacked onto a lift day, or the mobility checklist on a
            # recover/rest day. Kept as short strings rather than a rigid
            # sub-schema since these days don't need to be "logged" the way
            # prescribed sets do.
            "conditioning_items": pd.template.get("conditioning", {}).get("items", []) if pd else [],
            "mobility_items": pd.template.get("mobility_items", []) if pd else [],
            "note": pd.template.get("note") if pd else None,
        }
        if pd and pd.day_type == "lift":
            entry["exercises"] = [
                {
                    "exercise_id": item["exercise_id"],
                    "name": exercises_by_id[item["exercise_id"]].name if item["exercise_id"] in exercises_by_id else "Unknown exercise",
                    "sets": item["sets"], "reps": item["reps"], "target_rir": item["target_rir"],
                }
                for item in pd.template.get("exercises", [])
            ]
        elif pd and pd.day_type == "run":
            entry["run"] = {
                "run_type": pd.template.get("run_type"),
                "duration_min": pd.template.get("duration_min"),
                "zone": pd.template.get("zone"),
            }
        out.append(entry)
    return out


def _compute_streak(db: Session, by_weekday, today: dt.date) -> int:
    streak = 0
    d = today - dt.timedelta(days=1)  # today may not be logged yet -- don't penalize the streak for that
    for _ in range(30):
        pd = by_weekday.get(d.weekday())
        if pd and pd.day_type in ("lift", "run"):
            model = models.WorkoutSession if pd.day_type == "lift" else models.CardioSession
            if db.query(model).filter_by(user_id=DEMO_USER_ID, date=d).first():
                streak += 1
            else:
                break
        d -= dt.timedelta(days=1)
    return streak


def _program_progress(db: Session, program, meso, by_weekday, today: dt.date):
    days_elapsed = (today - program.started_at).days
    planned_per_week = sum(1 for d in by_weekday.values() if d.day_type in ("lift", "run"))

    workouts_completed = (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.user_id == DEMO_USER_ID, models.WorkoutSession.date >= program.started_at, models.WorkoutSession.date <= today)
        .count()
        + db.query(models.CardioSession)
        .filter(models.CardioSession.user_id == DEMO_USER_ID, models.CardioSession.date >= program.started_at, models.CardioSession.date <= today)
        .count()
    )
    workouts_planned_to_date = max(1, round(planned_per_week * (days_elapsed + 1) / 7)) if planned_per_week else 0
    completion_pct = round(100 * min(1.0, workouts_completed / workouts_planned_to_date)) if workouts_planned_to_date else 100

    week_start = today - dt.timedelta(days=6)
    week_planned = week_matched = 0
    for i in range(7):
        d = week_start + dt.timedelta(days=i)
        if d > today:
            break
        pd = by_weekday.get(d.weekday())
        if pd and pd.day_type in ("lift", "run"):
            week_planned += 1
            model = models.WorkoutSession if pd.day_type == "lift" else models.CardioSession
            if db.query(model).filter_by(user_id=DEMO_USER_ID, date=d).first():
                week_matched += 1
    weekly_adherence_pct = round(100 * week_matched / week_planned) if week_planned else 100

    streak = _compute_streak(db, by_weekday, today)

    if workouts_planned_to_date and workouts_completed >= workouts_planned_to_date:
        status = "ahead" if workouts_completed > workouts_planned_to_date else "on_track"
    elif workouts_planned_to_date and workouts_completed < workouts_planned_to_date * 0.7:
        status = "behind"
    else:
        status = "on_track"

    return {
        "completion_pct": completion_pct,
        "workouts_completed": workouts_completed,
        "workouts_planned_to_date": workouts_planned_to_date,
        "weekly_adherence_pct": weekly_adherence_pct,
        "streak": streak,
        "status": status,
    }


@app.get("/api/program")
def get_program(db: Session = Depends(get_db)):
    today = dt.date.today()
    program, meso = _active_mesocycle(db)
    days_elapsed = (today - program.started_at).days
    current_week = max(1, min(meso.weeks, days_elapsed // 7 + 1))
    by_weekday = {d.weekday: d for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()}

    user = db.query(models.User).get(DEMO_USER_ID)
    goals = db.query(models.Goal).filter_by(user_id=DEMO_USER_ID).order_by(models.Goal.is_secondary, models.Goal.id).all()
    reassessment_date = program.started_at + dt.timedelta(weeks=meso.weeks)

    reco, _ = _get_or_generate_recommendation(db, today)

    facts = coach.compute_observations(db, DEMO_USER_ID)

    return {
        "identity": {
            "program_name": program.name,
            "focus": meso.focus,
            "current_week": current_week,
            "total_weeks": meso.weeks,
            "deload_week": meso.deload_week_index,
            "primary_goal": user.goal,
            "secondary_goals": [g.title for g in goals if g.is_secondary],
            "started_at": program.started_at.isoformat(),
            "next_reassessment_date": reassessment_date.isoformat(),
            "days_to_reassessment": (reassessment_date - today).days,
        },
        "progress": _program_progress(db, program, meso, by_weekday, today),
        "today": {
            "session_type": reco.session_type,
            "prescription": reco.prescription,
            "reasoning": reco.reasoning,
        },
        "week": _week_detail(db, meso, today),
        "goals": [_goal_out(g) for g in goals],
        "coach_observations": coach.narrate(facts),
    }


@app.post("/api/program/schedule/swap")
def swap_schedule_days(payload: schemas.ScheduleSwapIn, db: Session = Depends(get_db)):
    """Move a workout to a different day of the week by swapping what's
    programmed on two weekdays -- the lighter-weight alternative to full
    drag-and-drop reordering. This changes the standing weekly template
    (like every other program edit), not just the current week."""
    if payload.weekday_a == payload.weekday_b:
        raise HTTPException(400, "Pick two different days to swap")
    _, meso = _active_mesocycle(db)
    day_a = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, weekday=payload.weekday_a).first()
    day_b = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, weekday=payload.weekday_b).first()
    if not day_a or not day_b:
        raise HTTPException(404, "One of those days isn't part of the current program")

    day_a.day_type, day_b.day_type = day_b.day_type, day_a.day_type
    day_a.label, day_b.label = day_b.label, day_a.label
    day_a.template, day_b.template = day_b.template, day_a.template
    db.commit()
    return {"ok": True}


@app.get("/api/exercises/{exercise_id}/decision")
def exercise_decision(exercise_id: int, db: Session = Depends(get_db)):
    """The Progression Decision Card: a few reasonable next-session options for
    this exercise, sourced from the same logic that drives the daily recommendation."""
    today = dt.date.today()
    _, meso = _active_mesocycle(db)
    day = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, weekday=today.weekday()).first()

    target_rir, target_reps, starting_load_kg = 2.0, 8, 20.0
    if day and day.day_type == "lift":
        for item in day.template.get("exercises", []):
            if item["exercise_id"] == exercise_id:
                target_rir, target_reps, starting_load_kg = item["target_rir"], item["reps"], item["starting_load_kg"]
                break

    return reco_engine.progression_options(db, DEMO_USER_ID, exercise_id, target_rir, target_reps, starting_load_kg)


@app.get("/api/exercises/{exercise_id}/memory")
def exercise_memory(exercise_id: int, exclude_session_id: int | None = None, db: Session = Depends(get_db)):
    """What the coach already remembers about this exercise -- last session,
    best ever, how long it's been -- so the logging screen can open with
    context instead of a blank form. Post-workout screens pass
    exclude_session_id (the session just finished) so "last/best" still means
    history before this workout, not a comparison against itself."""
    return reco_engine.exercise_memory(db, DEMO_USER_ID, exercise_id, dt.date.today(), exclude_session_id)


@app.get("/api/exercises/{exercise_id}/substitution")
def get_exercise_substitution(exercise_id: int, db: Session = Depends(get_db)):
    """The user's standing swap for this exercise, if any -- so the logging
    screen can show "You've been doing X instead of this" and offer to revert."""
    row = (
        db.query(models.ExerciseSubstitution, models.Exercise)
        .join(models.Exercise, models.ExerciseSubstitution.substitute_exercise_id == models.Exercise.id)
        .filter(models.ExerciseSubstitution.user_id == DEMO_USER_ID, models.ExerciseSubstitution.original_exercise_id == exercise_id)
        .first()
    )
    if not row:
        return {"substituted": False, "substitute": None}
    _, substitute = row
    return {"substituted": True, "substitute": {"id": substitute.id, "name": substitute.name}}


@app.put("/api/exercises/{exercise_id}/substitution")
def set_exercise_substitution(exercise_id: int, payload: schemas.ExerciseSubstitutionIn, db: Session = Depends(get_db)):
    """Persist a swap so it carries into future prescriptions of this exercise,
    not just the workout it was made in -- the substitution half of "the app
    should remember" (see build_lift_day_prescription / generate_recommendation,
    which both apply this through _resolve_exercise)."""
    if payload.substitute_exercise_id == exercise_id:
        raise HTTPException(400, "An exercise can't be substituted for itself")
    if not db.query(models.Exercise).get(payload.substitute_exercise_id):
        raise HTTPException(404, "Substitute exercise not found")

    row = (
        db.query(models.ExerciseSubstitution)
        .filter_by(user_id=DEMO_USER_ID, original_exercise_id=exercise_id)
        .first()
    )
    if row:
        row.substitute_exercise_id = payload.substitute_exercise_id
    else:
        row = models.ExerciseSubstitution(
            user_id=DEMO_USER_ID, original_exercise_id=exercise_id, substitute_exercise_id=payload.substitute_exercise_id,
        )
        db.add(row)
    db.commit()
    return {"substituted": True}


@app.delete("/api/exercises/{exercise_id}/substitution")
def clear_exercise_substitution(exercise_id: int, db: Session = Depends(get_db)):
    """Revert to the original exercise for future prescriptions."""
    db.query(models.ExerciseSubstitution).filter_by(user_id=DEMO_USER_ID, original_exercise_id=exercise_id).delete()
    db.commit()
    return {"substituted": False}


@app.get("/api/goals")
def list_goals(db: Session = Depends(get_db)):
    goals = db.query(models.Goal).filter_by(user_id=DEMO_USER_ID).order_by(models.Goal.is_secondary, models.Goal.id).all()
    return [_goal_out(g) for g in goals]


@app.post("/api/goals")
def create_goal(payload: schemas.GoalIn, db: Session = Depends(get_db)):
    goal = models.Goal(user_id=DEMO_USER_ID, **payload.model_dump(exclude={"target_date"}))
    if payload.target_date:
        goal.target_date = dt.date.fromisoformat(payload.target_date)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _goal_out(goal)


@app.patch("/api/goals/{goal_id}")
def update_goal(goal_id: int, payload: schemas.GoalUpdateIn, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter_by(id=goal_id, user_id=DEMO_USER_ID).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    updates = payload.model_dump(exclude_unset=True, exclude={"target_date"})
    for field, value in updates.items():
        setattr(goal, field, value)
    if "target_date" in payload.model_fields_set:
        goal.target_date = dt.date.fromisoformat(payload.target_date) if payload.target_date else None
    db.commit()
    db.refresh(goal)
    return _goal_out(goal)


@app.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    db.query(models.Goal).filter_by(id=goal_id, user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"ok": True}


# -------------------------------------------------------------- settings ----

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    injuries = db.query(models.Injury).filter_by(user_id=DEMO_USER_ID, active=True).all()
    latest_weight = (
        db.query(models.BodyMetric)
        .filter_by(user_id=DEMO_USER_ID)
        .order_by(models.BodyMetric.date.desc())
        .first()
    )
    return {
        "name": user.name,
        "age": user.age,
        "height_cm": user.height_cm,  # canonical storage; convert client-side per `units`
        "goal": user.goal,
        "experience_level": user.experience_level,
        "equipment": user.equipment,
        "units": user.units,
        "has_password": bool(user.password_hash),
        "notif_daily_recommendation": user.notif_daily_recommendation,
        "notif_readiness_alerts": user.notif_readiness_alerts,
        "injuries": [{"id": i.id, "body_region": i.body_region, "description": i.description} for i in injuries],
        "current_weight_kg": latest_weight.weight_kg if latest_weight else None,
        "goal_weight_kg": user.goal_weight_kg,
        "goal_pace_key": user.goal_pace_key,
        "activity_level": user.activity_level,
        "onboarding_completed": user.onboarding_completed,
        "sex": user.sex,
        "daily_calorie_goal_kcal": user.daily_calorie_goal_kcal,
        "is_premium": user.is_premium,
        "dietary_preferences": user.dietary_preferences or [],
        "food_restrictions": user.food_restrictions or [],
        "household_size": user.household_size,
        "shopping_weekly_budget": user.shopping_weekly_budget,
    }


@app.patch("/api/settings")
def update_settings(payload: schemas.SettingsUpdateIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)
    db.commit()
    return {"ok": True}


def _log_body_weight(db: Session, weight_kg: float, date: dt.date):
    row = db.query(models.BodyMetric).filter_by(user_id=DEMO_USER_ID, date=date).first()
    if row is None:
        row = models.BodyMetric(user_id=DEMO_USER_ID, date=date)
        db.add(row)
    row.weight_kg = weight_kg
    db.commit()
    return row


@app.post("/api/body-weight")
def log_body_weight(payload: schemas.BodyWeightIn, db: Session = Depends(get_db)):
    _log_body_weight(db, payload.weight_kg, dt.date.today())
    return {"ok": True}


@app.patch("/api/body-weight/{entry_id}")
def update_body_weight(entry_id: int, payload: schemas.BodyWeightUpdateIn, db: Session = Depends(get_db)):
    """Fix a past weigh-in -- a fat-fingered entry shouldn't have to sit in
    the trend forever, and shouldn't require deleting and re-logging (which
    for a past date isn't even possible, since logging only ever targets
    today)."""
    row = db.query(models.BodyMetric).filter_by(id=entry_id, user_id=DEMO_USER_ID).first()
    if not row:
        raise HTTPException(404, "Entry not found")
    row.weight_kg = payload.weight_kg
    db.commit()
    return {"ok": True}


@app.delete("/api/body-weight/{entry_id}")
def delete_body_weight(entry_id: int, db: Session = Depends(get_db)):
    db.query(models.BodyMetric).filter_by(id=entry_id, user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"ok": True}


@app.get("/api/body-fat")
def get_body_fat(db: Session = Depends(get_db)):
    row = (
        db.query(models.BodyMetric)
        .filter(models.BodyMetric.user_id == DEMO_USER_ID, models.BodyMetric.body_fat_pct.isnot(None))
        .order_by(models.BodyMetric.date.desc())
        .first()
    )
    return {"body_fat_pct": row.body_fat_pct if row else None, "date": row.date.isoformat() if row else None}


@app.post("/api/body-fat")
def log_body_fat(payload: schemas.BodyFatIn, db: Session = Depends(get_db)):
    today = dt.date.today()
    row = db.query(models.BodyMetric).filter_by(user_id=DEMO_USER_ID, date=today).first()
    if row is None:
        row = models.BodyMetric(user_id=DEMO_USER_ID, date=today)
        db.add(row)
    row.body_fat_pct = payload.body_fat_pct
    db.commit()
    return {"body_fat_pct": row.body_fat_pct, "date": today.isoformat()}


# Water: no stored per-user goal field exists (same convention as the calorie
# goal's macro split) -- default hydration target is derived from bodyweight
# using the common "half your bodyweight in lb, in oz" rule of thumb.
def _hydration_goal_oz(db: Session) -> float:
    latest_weight = (
        db.query(models.BodyMetric)
        .filter(models.BodyMetric.user_id == DEMO_USER_ID, models.BodyMetric.weight_kg.isnot(None))
        .order_by(models.BodyMetric.date.desc())
        .first()
    )
    if not latest_weight:
        return 100.0  # generic default when no bodyweight is on file yet
    weight_lb = latest_weight.weight_kg / 0.45359237
    return round(weight_lb * 0.5)


@app.get("/api/hydration/today")
def get_hydration_today(date: str | None = None, db: Session = Depends(get_db)):
    target_date = _parse_date(date)
    total = (
        db.query(func.sum(models.WaterLogEntry.ounces))
        .filter(models.WaterLogEntry.user_id == DEMO_USER_ID, models.WaterLogEntry.date == target_date)
        .scalar()
        or 0.0
    )
    return {"date": target_date.isoformat(), "ounces": round(total, 1), "goal_oz": _hydration_goal_oz(db)}


@app.post("/api/hydration/today")
def log_hydration(payload: schemas.WaterLogIn, db: Session = Depends(get_db)):
    target_date = _parse_date(payload.date)
    row = models.WaterLogEntry(user_id=DEMO_USER_ID, date=target_date, ounces=payload.ounces)
    db.add(row)
    db.commit()
    return get_hydration_today(target_date.isoformat(), db)


@app.post("/api/settings/recalculate-calories")
def recalculate_calorie_goal(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    if not user.sex or not user.activity_level or not user.goal_pace_key:
        raise HTTPException(400, "Complete onboarding first")
    latest_weight = (
        db.query(models.BodyMetric)
        .filter_by(user_id=DEMO_USER_ID)
        .order_by(models.BodyMetric.date.desc())
        .first()
    )
    user.daily_calorie_goal_kcal = nutrition_client.compute_calorie_goal(
        sex=user.sex,
        weight_kg=latest_weight.weight_kg if latest_weight else 70.0,
        height_cm=user.height_cm or 175.0,
        age=user.age or 30,
        activity_level=user.activity_level,
        goal_pace_key=user.goal_pace_key,
    )
    db.commit()
    return {"daily_calorie_goal_kcal": user.daily_calorie_goal_kcal}


@app.post("/api/onboarding/complete")
def complete_onboarding(payload: schemas.OnboardingCompleteIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    _log_body_weight(db, payload.current_weight_kg, dt.date.today())
    user.goal_weight_kg = payload.goal_weight_kg
    user.goal_pace_key = payload.goal_pace_key
    user.activity_level = payload.activity_level
    user.sex = payload.sex
    user.daily_calorie_goal_kcal = nutrition_client.compute_calorie_goal(
        sex=payload.sex,
        weight_kg=payload.current_weight_kg,
        height_cm=user.height_cm or 175.0,  # falls back if the profile's height was never set
        age=user.age or 30,
        activity_level=payload.activity_level,
        goal_pace_key=payload.goal_pace_key,
    )
    user.onboarding_completed = True
    db.commit()
    return {"ok": True}


@app.post("/api/settings/password")
def update_password(payload: schemas.PasswordUpdateIn, db: Session = Depends(get_db)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, "Passwords don't match")
    if len(payload.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    user = db.query(models.User).get(DEMO_USER_ID)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@app.post("/api/injuries")
def add_injury(payload: schemas.InjuryIn, db: Session = Depends(get_db)):
    row = models.Injury(user_id=DEMO_USER_ID, body_region=payload.body_region, description=payload.description, active=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@app.delete("/api/injuries/{injury_id}")
def remove_injury(injury_id: int, db: Session = Depends(get_db)):
    row = db.query(models.Injury).get(injury_id)
    if row:
        row.active = False
        db.commit()
    return {"ok": True}


# --------------------------------------------------------------- nutrition ----
# See toci/nutrition.py for the Open Food Facts lookup + shaping logic.

@app.get("/api/nutrition/today")
def nutrition_today(date: str | None = None, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    today = dt.date.today()
    target_date = _parse_date(date)
    summary = nutrition_client.today_summary(db, DEMO_USER_ID, target_date)
    summary["is_today"] = target_date == today
    summary["coaching"] = nutrition_client.generate_coaching_messages(summary["totals"], user.daily_calorie_goal_kcal, summary["is_today"])
    # Streak is a standing habit metric, not scoped to whichever date is being
    # browsed -- always counts back from the real today regardless of `date`.
    summary["logging_streak"] = nutrition_client.compute_logging_streak(db, DEMO_USER_ID, today)
    summary["longest_streak"] = nutrition_client.longest_logging_streak(db, DEMO_USER_ID, today)
    return summary


@app.get("/api/nutrition/foods")
def nutrition_search_foods(q: str = "", restaurant: str = "", db: Session = Depends(get_db)):
    query = db.query(models.FoodItem).filter(models.FoodItem.user_id == DEMO_USER_ID)
    if q:
        query = query.filter(models.FoodItem.name.ilike(f"%{q}%"))
    if restaurant:
        query = query.filter(models.FoodItem.restaurant == restaurant)
    # Favorites first, then most-frequently-logged, then most-recently-used --
    # only falls back to name order once all three are tied (e.g. never logged).
    rows = (
        query.order_by(
            models.FoodItem.is_favorite.desc(),
            models.FoodItem.use_count.desc(),
            models.FoodItem.last_used_at.desc().nullslast(),
            models.FoodItem.name,
        )
        .limit(25)
        .all()
    )
    return {"foods": [nutrition_client.food_dict(f) for f in rows]}


@app.post("/api/nutrition/foods")
def nutrition_create_food(payload: schemas.FoodItemIn, db: Session = Depends(get_db)):
    row = models.FoodItem(user_id=DEMO_USER_ID, source="custom", **payload.dict())
    db.add(row)
    db.commit()
    db.refresh(row)
    return nutrition_client.food_dict(row)


@app.get("/api/nutrition/restaurants")
def nutrition_list_restaurants(db: Session = Depends(get_db)):
    rows = (
        db.query(models.FoodItem.restaurant)
        .filter(models.FoodItem.user_id == DEMO_USER_ID, models.FoodItem.restaurant.isnot(None))
        .distinct()
        .order_by(models.FoodItem.restaurant)
        .all()
    )
    return {"restaurants": [r[0] for r in rows]}


@app.post("/api/nutrition/foods/{food_id}/favorite")
def nutrition_toggle_favorite(food_id: int, db: Session = Depends(get_db)):
    food = db.query(models.FoodItem).get(food_id)
    if not food:
        raise HTTPException(404, "Food not found")
    food.is_favorite = not food.is_favorite
    db.commit()
    return {"is_favorite": food.is_favorite}


@app.get("/api/nutrition/lookup/{barcode}")
def nutrition_lookup_barcode(barcode: str, db: Session = Depends(get_db)):
    food = nutrition_client.lookup_barcode(db, DEMO_USER_ID, barcode)
    if not food:
        raise HTTPException(404, "No product found for that barcode — try Custom Food instead")
    return nutrition_client.food_dict(food)


@app.post("/api/nutrition/log")
def nutrition_log_food(payload: schemas.FoodLogIn, db: Session = Depends(get_db)):
    food = db.query(models.FoodItem).get(payload.food_item_id)
    if not food:
        raise HTTPException(404, "Food not found")
    row = models.FoodLogEntry(
        user_id=DEMO_USER_ID,
        food_item_id=payload.food_item_id,
        date=_parse_date(payload.date),
        servings=payload.servings,
        meal_slot=payload.meal_slot,
    )
    db.add(row)
    food.use_count += 1
    food.last_used_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@app.post("/api/nutrition/quick-add")
def nutrition_quick_add(payload: schemas.QuickAddIn, db: Session = Depends(get_db)):
    food = models.FoodItem(
        user_id=DEMO_USER_ID, source="quick_add", name=payload.label,
        serving_qty=1.0, serving_unit="serving",
        calories=payload.calories, protein_g=payload.protein_g, carbs_g=payload.carbs_g, fat_g=payload.fat_g,
        use_count=1, last_used_at=dt.datetime.utcnow(),
    )
    db.add(food)
    db.flush()
    entry = models.FoodLogEntry(
        user_id=DEMO_USER_ID, food_item_id=food.id, date=_parse_date(payload.date),
        servings=1.0, meal_slot=payload.meal_slot,
    )
    db.add(entry)
    db.commit()
    return {"food_item_id": food.id, "log_entry_id": entry.id}


@app.post("/api/nutrition/copy")
def nutrition_copy_day(payload: schemas.CopyDayIn, db: Session = Depends(get_db)):
    if payload.from_date == "yesterday":
        source_date = dt.date.today() - dt.timedelta(days=1)
    else:
        source_date = dt.date.fromisoformat(payload.from_date)
    target_date = _parse_date(payload.to_date)

    query = db.query(models.FoodLogEntry).filter_by(user_id=DEMO_USER_ID, date=source_date)
    if payload.meal_slot:
        query = query.filter_by(meal_slot=payload.meal_slot)
    source_entries = query.all()
    if not source_entries:
        return {"copied": 0}

    for entry in source_entries:
        db.add(models.FoodLogEntry(
            user_id=DEMO_USER_ID, food_item_id=entry.food_item_id, date=target_date,
            servings=entry.servings, meal_slot=entry.meal_slot,
        ))
    db.commit()
    return {"copied": len(source_entries)}


@app.delete("/api/nutrition/log")
def nutrition_clear_day(date: str, db: Session = Depends(get_db)):
    """Clears only this date's food log entries -- saved meals, recipes, and
    targets are untouched. `date` is required so an accidental bare call can't
    wipe the wrong day."""
    target_date = _parse_date(date)
    count = db.query(models.FoodLogEntry).filter_by(user_id=DEMO_USER_ID, date=target_date).delete()
    db.commit()
    return {"cleared": count}


@app.patch("/api/nutrition/log/{entry_id}")
def nutrition_update_log_entry(entry_id: int, payload: schemas.FoodLogUpdateIn, db: Session = Depends(get_db)):
    row = db.query(models.FoodLogEntry).get(entry_id)
    if not row:
        raise HTTPException(404, "Log entry not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    return {"ok": True}


@app.delete("/api/nutrition/log/{entry_id}")
def nutrition_delete_log_entry(entry_id: int, db: Session = Depends(get_db)):
    row = db.query(models.FoodLogEntry).get(entry_id)
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


@app.get("/api/nutrition/meals")
def nutrition_list_meals(db: Session = Depends(get_db)):
    return {"meals": nutrition_client.list_saved_meals(db, DEMO_USER_ID)}


@app.post("/api/nutrition/meals")
def nutrition_create_meal(payload: schemas.SavedMealIn, db: Session = Depends(get_db)):
    meal = models.SavedMeal(user_id=DEMO_USER_ID, name=payload.name)
    db.add(meal)
    db.flush()
    for item in payload.items:
        db.add(models.SavedMealItem(saved_meal_id=meal.id, food_item_id=item.food_item_id, servings=item.servings))
    db.commit()
    return {"id": meal.id}


@app.delete("/api/nutrition/meals/{meal_id}")
def nutrition_delete_meal(meal_id: int, db: Session = Depends(get_db)):
    db.query(models.SavedMealItem).filter_by(saved_meal_id=meal_id).delete()
    db.query(models.SavedMeal).filter_by(id=meal_id).delete()
    db.commit()
    return {"ok": True}


@app.post("/api/nutrition/meals/{meal_id}/log")
def nutrition_log_meal(meal_id: int, payload: schemas.LogSavedMealIn, db: Session = Depends(get_db)):
    meal = db.query(models.SavedMeal).get(meal_id)
    if not meal:
        raise HTTPException(404, "Saved meal not found")
    created = nutrition_client.log_saved_meal(db, DEMO_USER_ID, meal, payload.multiplier, _parse_date(payload.date))
    return {"created": len(created)}


@app.get("/api/nutrition/recent-meals")
def nutrition_recent_meals(limit: int = 3, db: Session = Depends(get_db)):
    return {"meals": nutrition_client.recent_logged_meals(db, DEMO_USER_ID, limit)}


def _smart_nutrition_plan(db: Session, user: "models.User", target_date: dt.date, is_forward_looking: bool) -> dict:
    """Composes nutrition.py's daily totals/targets with recipes.py's existing
    restriction-aware recommendation ranking -- one coherent pick, not a second
    conflicting engine. Past dates get a retrospective read only: recommending
    what to eat next doesn't make sense for a day that's already over."""
    summary = nutrition_client.today_summary(db, DEMO_USER_ID, target_date)
    targets = nutrition_client.macro_targets(user.daily_calorie_goal_kcal)
    if not targets:
        return {"configured": False, "headline": "Set up your nutrition targets", "detail": "Unlock personalized recommendations by setting a daily calorie goal.", "recommendation": None}

    totals = summary["totals"]
    remaining_kcal = targets["calories"] - totals["calories"]
    remaining_protein = targets["protein_g"] - totals["protein_g"]

    if not is_forward_looking:
        if remaining_kcal < -50:
            headline = f"You finished {abs(round(remaining_kcal))} kcal over target."
        elif remaining_kcal > 50:
            headline = f"You finished {round(remaining_kcal)} kcal under target."
        else:
            headline = "You finished right on target."
        return {"configured": True, "headline": headline, "detail": None, "recommendation": None}

    if remaining_kcal <= 100:
        headline = (
            f"You've gone {abs(round(remaining_kcal))} kcal over today's target."
            if remaining_kcal < -50 else "You're on track. No recommendation needed right now."
        )
        return {"configured": True, "headline": headline, "detail": None, "recommendation": None}

    if remaining_protein > 15:
        headline = f"You're {round(remaining_protein)}g short on protein today."
        detail = "Add a protein-rich option to stay on track."
    else:
        headline = f"{round(remaining_kcal)} kcal remaining today."
        detail = "Here's one option that fits your remaining macros."

    candidates = recipes_client.get_recommended(db, DEMO_USER_ID)
    fitting = [r for r in candidates if r["calories"] <= remaining_kcal * 1.25]
    pick = (fitting or candidates or [None])[0]
    recommendation = None
    if pick:
        recommendation = {
            "type": "recipe", "id": pick["id"], "name": pick["name"],
            "calories": pick["calories"], "protein_g": pick["protein_g"],
            "carbs_g": pick["carbs_g"], "fat_g": pick["fat_g"],
            "icon_emoji": pick["icon_emoji"], "gradient_key": pick["gradient_key"],
        }
    return {"configured": True, "headline": headline, "detail": detail, "recommendation": recommendation}


@app.get("/api/nutrition/recommendation")
def nutrition_recommendation(date: str | None = None, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    target_date = _parse_date(date)
    is_forward_looking = target_date >= dt.date.today()  # "what to eat next" only makes sense for today/future
    return _smart_nutrition_plan(db, user, target_date, is_forward_looking)


# ----------------------------------------------------------------- recipes ----

@app.get("/api/recipes")
def recipe_list(category: str = "", db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    recipes = recipes_client.list_recipes(db, user, category=category or None)
    return {"recipes": [recipes_client.recipe_summary_dict(r) for r in recipes]}


@app.get("/api/recipes/categories")
def recipe_list_categories(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    return {"categories": recipes_client.list_categories(db, user)}


@app.get("/api/recipes/recommended")
def recipe_list_recommended(db: Session = Depends(get_db)):
    return {"recipes": recipes_client.get_recommended(db, DEMO_USER_ID)}


@app.get("/api/recipes/{recipe_id}")
def recipe_get(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    return recipes_client.recipe_detail_dict(db, recipe)


@app.post("/api/recipes/{recipe_id}/fit-macros")
def recipe_fit_macros(recipe_id: int, payload: schemas.RecipeFitMacrosIn, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    result = recipes_client.fit_macros(db, recipe, payload.target_protein_g)
    if not result:
        raise HTTPException(400, "This recipe has no primary protein ingredient to scale")
    return result


@app.post("/api/recipes/{recipe_id}/log")
def recipe_log(recipe_id: int, payload: schemas.RecipeLogIn, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    overrides = [o.dict() for o in payload.overrides]
    per_serving = recipes_client.compute_logged_macros(db, recipe, overrides)
    food = models.FoodItem(
        user_id=DEMO_USER_ID, source="recipe", name=recipe.name,
        serving_qty=1, serving_unit="serving",
        calories=per_serving["calories"], protein_g=per_serving["protein_g"],
        carbs_g=per_serving["carbs_g"], fat_g=per_serving["fat_g"],
        use_count=1, last_used_at=dt.datetime.utcnow(),
    )
    db.add(food)
    db.flush()
    entry = models.FoodLogEntry(
        user_id=DEMO_USER_ID, food_item_id=food.id, date=_parse_date(payload.date),
        servings=payload.servings, meal_slot=payload.meal_slot,
    )
    db.add(entry)
    db.commit()
    return {"food_item_id": food.id, "log_entry_id": entry.id}


# ------------------------------------------------------------ smart cart ----

@app.get("/api/shopping")
def shopping_list(db: Session = Depends(get_db)):
    return shopping_client.list_shopping(db, DEMO_USER_ID)


@app.post("/api/shopping/items")
def shopping_add_item(payload: schemas.ShoppingItemIn, db: Session = Depends(get_db)):
    item = shopping_client.add_manual_item(db, DEMO_USER_ID, payload.name, payload.quantity, payload.unit, payload.category)
    return {"id": item.id}


@app.patch("/api/shopping/items/{item_id}")
def shopping_update_item(item_id: int, payload: schemas.ShoppingItemUpdateIn, db: Session = Depends(get_db)):
    item = db.query(models.ShoppingListItem).filter_by(id=item_id, user_id=DEMO_USER_ID).first()
    if not item:
        raise HTTPException(404, "Item not found")
    if payload.quantity is not None:
        item.quantity = payload.quantity
        item.estimated_price = shopping_client.price_for(item.name, item.quantity, item.unit)
    if payload.is_checked is not None:
        item.is_checked = payload.is_checked
    db.commit()
    return {"ok": True}


@app.delete("/api/shopping/items/{item_id}")
def shopping_delete_item(item_id: int, db: Session = Depends(get_db)):
    db.query(models.ShoppingListItem).filter_by(id=item_id, user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"ok": True}


@app.post("/api/shopping/from-recipe/{recipe_id}")
def shopping_add_from_recipe(recipe_id: int, payload: schemas.ShoppingFromRecipeIn, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    count = shopping_client.add_from_recipe(db, DEMO_USER_ID, recipe, payload.multiplier)
    return {"ingredients_added": count}


@app.post("/api/shopping/quick-action")
def shopping_quick_action(payload: schemas.ShoppingQuickActionIn, db: Session = Depends(get_db)):
    valid_actions = {"remove_seafood", "reduce_cost", "increase_protein", "clear_checked"}
    if payload.action not in valid_actions:
        raise HTTPException(400, "Unknown action")
    affected = shopping_client.quick_action(db, DEMO_USER_ID, payload.action)
    return {"affected": affected}


@app.get("/api/pantry")
def pantry_list(db: Session = Depends(get_db)):
    rows = db.query(models.PantryItem).filter_by(user_id=DEMO_USER_ID).order_by(models.PantryItem.name).all()
    return {"items": [{"id": p.id, "name": p.name} for p in rows]}


@app.post("/api/pantry")
def pantry_add(payload: schemas.PantryItemIn, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    existing = db.query(models.PantryItem).filter_by(user_id=DEMO_USER_ID, name=name).first()
    if existing:
        return {"id": existing.id}
    item = models.PantryItem(user_id=DEMO_USER_ID, name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id}


@app.delete("/api/pantry/{item_id}")
def pantry_delete(item_id: int, db: Session = Depends(get_db)):
    db.query(models.PantryItem).filter_by(id=item_id, user_id=DEMO_USER_ID).delete()
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- spotify ----
# Real Authorization Code + PKCE flow -- see toci/spotify.py for the "why".

@app.get("/api/spotify/status")
def spotify_status(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    return {
        "client_id_configured": bool(user.spotify_client_id),
        "client_id": user.spotify_client_id or "",
        "connected": bool(user.spotify_access_token),
        "redirect_uri": SPOTIFY_REDIRECT_URI,
    }


@app.post("/api/spotify/client-id")
def spotify_set_client_id(payload: schemas.SpotifyClientIdIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    user.spotify_client_id = payload.client_id.strip()
    db.commit()
    return {"ok": True}


@app.post("/api/spotify/callback")
def spotify_callback(payload: schemas.SpotifyCallbackIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    if not user.spotify_client_id:
        raise HTTPException(400, "No Spotify Client ID configured yet — add one in Settings first")
    try:
        spotify_client.exchange_code(db, user, payload.code, payload.code_verifier, payload.redirect_uri)
    except httpx.HTTPStatusError as e:
        raise HTTPException(400, "Spotify token exchange failed: " + e.response.text)
    return {"ok": True}


@app.post("/api/spotify/disconnect")
def spotify_disconnect(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    user.spotify_access_token = None
    user.spotify_refresh_token = None
    user.spotify_token_expires_at = None
    db.commit()
    return {"ok": True}


@app.get("/api/spotify/now-playing")
def spotify_now_playing(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    if not user.spotify_access_token:
        return {"connected": False}
    result = spotify_client.get_now_playing(db, user)
    if result is None:
        return {"connected": False}
    result["connected"] = True
    return result


@app.post("/api/spotify/playback")
def spotify_playback(payload: schemas.SpotifyPlaybackIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    ok, error = spotify_client.set_playback(db, user, payload.action)
    if not ok:
        raise HTTPException(400, error or "Playback control failed")
    return {"ok": True}


@app.get("/spotify/callback")
def spotify_callback_page():
    # Spotify redirects the browser here (not an /api/ path) after the user
    # approves. This isn't a real page -- it just serves the SPA shell so the
    # frontend's own JS can read `?code=` from the URL and complete the
    # exchange. Without this route, StaticFiles would 404 on this exact path.
    return FileResponse(str(WEB_DIR / "index.html"))


# ---------------------------------------------------------------- wearable ----
# Real OAuth against Whoop -- see toci/whoop.py for the "why" and the field
# names verified against Whoop's actual API docs. Other providers (Oura,
# Garmin, Fitbit) are frontend-only stubs for now; Apple Watch/HealthKit has
# no web-reachable API at all, so it isn't represented here.

@app.get("/api/wearable/status")
def wearable_status(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    return {
        "connected": bool(user.whoop_access_token),
        "client_id_configured": bool(user.whoop_client_id),
        "client_id": user.whoop_client_id or "",
        "redirect_uri": WHOOP_REDIRECT_URI,
        "auth_url": whoop_client.AUTH_URL,
        "scopes": whoop_client.SCOPES,
        "catalog": whoop_client.STAT_CATALOG,
        "display_stats": user.wearable_display_stats or whoop_client.DEFAULT_DISPLAY_STATS,
    }


@app.post("/api/wearable/whoop/credentials")
def wearable_whoop_credentials(payload: schemas.WhoopCredentialsIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    user.whoop_client_id = payload.client_id.strip()
    user.whoop_client_secret = payload.client_secret.strip()
    db.commit()
    return {"ok": True}


@app.post("/api/wearable/whoop/callback")
def wearable_whoop_callback(payload: schemas.WhoopCallbackIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    if not user.whoop_client_id or not user.whoop_client_secret:
        raise HTTPException(400, "No Whoop Client ID/Secret configured yet — add them in Settings first")
    try:
        whoop_client.exchange_code(db, user, payload.code, payload.redirect_uri)
    except httpx.HTTPStatusError as e:
        raise HTTPException(400, "Whoop token exchange failed: " + e.response.text)
    return {"ok": True}


@app.post("/api/wearable/whoop/disconnect")
def wearable_whoop_disconnect(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    user.whoop_access_token = None
    user.whoop_refresh_token = None
    user.whoop_token_expires_at = None
    db.commit()
    return {"ok": True}


@app.get("/api/wearable/today")
def wearable_today(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    if not user.whoop_access_token:
        return {"connected": False, "exercise_calories_burned": None}
    raw_stats = whoop_client.fetch_today_stats(db, user, dt.date.today())
    display_keys = user.wearable_display_stats or whoop_client.DEFAULT_DISPLAY_STATS
    stats = []
    for key in display_keys:
        meta = whoop_client.STAT_CATALOG.get(key)
        if not meta or key not in raw_stats:
            continue
        stats.append({"key": key, "label": meta["label"], "unit": meta["unit"], "value": raw_stats[key]})
    return {
        "connected": True,
        "stats": stats,
        # independent of the 3 chosen display stats, so the calorie budget card
        # always has exercise calories when available, regardless of what's pinned
        "exercise_calories_burned": raw_stats.get("calories_burned"),
    }


@app.post("/api/wearable/display-stats")
def wearable_set_display_stats(payload: schemas.WearableDisplayStatsIn, db: Session = Depends(get_db)):
    if len(payload.stats) > 3:
        raise HTTPException(400, "Choose at most 3 stats")
    unknown = [k for k in payload.stats if k not in whoop_client.STAT_CATALOG]
    if unknown:
        raise HTTPException(400, "Unknown stat key(s): " + ", ".join(unknown))
    user = db.query(models.User).get(DEMO_USER_ID)
    user.wearable_display_stats = payload.stats
    db.commit()
    return {"ok": True}


@app.get("/whoop/callback")
def whoop_callback_page():
    # Same reasoning as spotify_callback_page() -- serves the SPA shell so the
    # frontend can read `?code=&state=` and complete the exchange itself.
    return FileResponse(str(WEB_DIR / "index.html"))


app.mount("/uploads/progress_photos", StaticFiles(directory=str(UPLOADS_DIR)), name="progress_photos")

# Mount the static frontend last so it doesn't shadow the /api/* routes above.
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
