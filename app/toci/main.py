import datetime as dt
import random
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import engine as reco_engine
from . import models, schemas
from . import nutrition as nutrition_client
from . import recipes as recipes_client
from . import shopping as shopping_client
from . import spotify as spotify_client
from . import whoop as whoop_client
from .database import Base
from .database import engine as db_engine
from .database import get_db
from .security import hash_password

Base.metadata.create_all(bind=db_engine)

DEMO_USER_ID = 1
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / "web"
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


@app.get("/api/body-weight/history")
def body_weight_history(days: int = 30, db: Session = Depends(get_db)):
    start = dt.date.today() - dt.timedelta(days=days)
    rows = (
        db.query(models.BodyMetric)
        .filter(models.BodyMetric.user_id == DEMO_USER_ID, models.BodyMetric.date >= start)
        .order_by(models.BodyMetric.date)
        .all()
    )
    return {"points": [{"date": r.date.isoformat(), "weight_kg": r.weight_kg} for r in rows if r.weight_kg is not None]}


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
    days_logged = len({e.date for e, f in food_rows})
    avg_daily_calories = round(calories_this_week / days_logged) if days_logged else 0

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
        "days_logged": days_logged,
        "weight_delta_kg": weight_delta_kg,
        "consistency": {
            "score": score,
            "band": band,
            "workout_adherence": round(workout_adherence, 2),
            "nutrition_adherence": round(nutrition_adherence, 2),
            "checkin_adherence": round(checkin_adherence, 2),
        },
    }


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
def nutrition_today(db: Session = Depends(get_db)):
    user = db.query(models.User).get(DEMO_USER_ID)
    summary = nutrition_client.today_summary(db, DEMO_USER_ID, dt.date.today())
    summary["coaching"] = nutrition_client.generate_coaching_messages(summary["totals"], user.daily_calorie_goal_kcal)
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
        date=dt.date.today(),
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
        user_id=DEMO_USER_ID, food_item_id=food.id, date=dt.date.today(),
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

    query = db.query(models.FoodLogEntry).filter_by(user_id=DEMO_USER_ID, date=source_date)
    if payload.meal_slot:
        query = query.filter_by(meal_slot=payload.meal_slot)
    source_entries = query.all()
    if not source_entries:
        return {"copied": 0}

    today = dt.date.today()
    for entry in source_entries:
        db.add(models.FoodLogEntry(
            user_id=DEMO_USER_ID, food_item_id=entry.food_item_id, date=today,
            servings=entry.servings, meal_slot=entry.meal_slot,
        ))
    db.commit()
    return {"copied": len(source_entries)}


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
    created = nutrition_client.log_saved_meal(db, DEMO_USER_ID, meal, payload.multiplier, dt.date.today())
    return {"created": len(created)}


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
        user_id=DEMO_USER_ID, food_item_id=food.id, date=dt.date.today(),
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


# Mount the static frontend last so it doesn't shadow the /api/* routes above.
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
