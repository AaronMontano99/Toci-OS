import datetime as dt
import random
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import engine as reco_engine
from . import models, schemas
from .database import Base
from .database import engine as db_engine
from .database import get_db
from .security import hash_password

Base.metadata.create_all(bind=db_engine)

DEMO_USER_ID = 1
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / "web"

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
        out.append({
            "date": d.isoformat(),
            "weekday": i,
            "day_type": pd.day_type if pd else "rest",
            "label": pd.label if pd else "Rest",
            "is_today": d == today,
        })
    return out


# ---------------------------------------------------------------- today ----

@app.get("/api/today")
def get_today(db: Session = Depends(get_db)):
    today = dt.date.today()
    _ensure_recovery_reading(db, today)

    readiness = db.query(models.ReadinessScore).filter_by(user_id=DEMO_USER_ID, date=today).first()
    if not readiness:
        readiness = reco_engine.compute_readiness(db, DEMO_USER_ID, today)

    reco = db.query(models.Recommendation).filter_by(user_id=DEMO_USER_ID, date=today).first()
    if not reco:
        reco = reco_engine.generate_recommendation(db, DEMO_USER_ID, today, readiness)

    recovery = db.query(models.DailyRecoveryMetric).filter_by(user_id=DEMO_USER_ID, date=today).first()
    checkin = db.query(models.DailyCheckin).filter_by(user_id=DEMO_USER_ID, date=today).first()

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
        "week": _week_strip(db, today),
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
            points.append({"date": session_date.isoformat(), "est_1rm_kg": est_1rm})
    return {"exercise_id": exercise_id, "points": points}


@app.get("/api/prs")
def get_prs(db: Session = Depends(get_db)):
    rows = (
        db.query(models.WorkoutSet, models.WorkoutSession.date, models.Exercise.name)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
        .filter(models.WorkoutSession.user_id == DEMO_USER_ID, models.WorkoutSet.actual_load_kg.isnot(None))
        .order_by(models.WorkoutSession.date)
        .all()
    )
    best = {}
    for s, session_date, ex_name in rows:
        if not (s.actual_reps and s.actual_load_kg):
            continue
        est = s.actual_load_kg * (1 + s.actual_reps / 30)
        prev = best.get(ex_name)
        if prev is None or est > prev[0]:
            best[ex_name] = (est, session_date)

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

    prs = [{"exercise": name, "date": date.isoformat(), "est_1rm_kg": round(est, 1)} for name, (est, date) in best.items()]
    if best_pace:
        pace_sec, date = best_pace
        prs.append({"exercise": "Best pace", "date": date.isoformat(), "pace_per_km": f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}"})
    prs.sort(key=lambda p: p["date"], reverse=True)
    return {"prs": prs[:10]}


# --------------------------------------------------------------- program ----

@app.get("/api/program")
def get_program(db: Session = Depends(get_db)):
    program, meso = _active_mesocycle(db)
    days_elapsed = (dt.date.today() - program.started_at).days
    current_week = max(1, min(meso.weeks, days_elapsed // 7 + 1))
    return {
        "program_name": program.name,
        "focus": meso.focus,
        "current_week": current_week,
        "total_weeks": meso.weeks,
        "deload_week": meso.deload_week_index,
        "week": _week_strip(db, dt.date.today()),
    }


# -------------------------------------------------------------- settings ----

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    injuries = db.query(models.Injury).filter_by(user_id=DEMO_USER_ID, active=True).all()
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
    }


@app.patch("/api/settings")
def update_settings(payload: schemas.SettingsUpdateIn, db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)
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


# Mount the static frontend last so it doesn't shadow the /api/* routes above.
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
