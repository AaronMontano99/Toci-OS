"""Focused tests for the Today-tab backend logic added in this phase:
workout_status derivation, session resume, hydration, and body-fat tracking.

Full /api/today integration coverage (readiness scoring + the recommendation
engine) isn't included here -- that pre-existing engine has no test harness
of its own, and building one is out of scope for this Today-tab pass.
"""
import datetime as dt
from types import SimpleNamespace

from toci import models
from toci.main import DEMO_USER_ID, _compute_streak, _hydration_goal_oz, _today_workout_status


def _lift_reco(n_exercises=1):
    return SimpleNamespace(
        session_type="lift",
        prescription={"exercises": [{"exercise_id": 1, "name": "Squat", "sets": 3, "reps": 5, "load_kg": 100} for _ in range(n_exercises)]},
    )


def _run_reco():
    return SimpleNamespace(session_type="run", prescription={"run_type": "easy", "duration_min": 30, "zone": 2})


# --------------------------------------------------------------- workout_status ----

def test_workout_status_none_when_nothing_logged(db_session, seeded):
    status = _today_workout_status(db_session, _lift_reco(), seeded["today"])
    assert status["state"] == "none"
    assert status["session_id"] is None
    assert status["total_exercise_count"] == 1


def test_workout_status_active_while_session_open(db_session, seeded):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=seeded["today"], label="Lower Body", started_at=dt.datetime.utcnow())
    db_session.add(session)
    db_session.commit()

    status = _today_workout_status(db_session, _lift_reco(), seeded["today"])
    assert status["state"] == "active"
    assert status["session_id"] == session.id
    assert status["completed_exercise_count"] == 0


def test_workout_status_completed_after_ended_at_set(db_session, seeded):
    session = models.WorkoutSession(
        user_id=DEMO_USER_ID, date=seeded["today"], label="Lower Body",
        started_at=dt.datetime.utcnow() - dt.timedelta(minutes=40), ended_at=dt.datetime.utcnow(),
    )
    db_session.add(session)
    db_session.commit()

    status = _today_workout_status(db_session, _lift_reco(), seeded["today"])
    assert status["state"] == "completed"
    assert status["elapsed_min"] is not None and status["elapsed_min"] >= 39


def test_workout_status_counts_distinct_completed_exercises(db_session, seeded):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=seeded["today"], label="Lower Body", started_at=dt.datetime.utcnow())
    db_session.add(session)
    db_session.flush()
    # two sets on the same exercise should count as one completed exercise, not two
    db_session.add(models.WorkoutSet(workout_session_id=session.id, exercise_id=1, set_index=1, actual_reps=5, actual_load_kg=100))
    db_session.add(models.WorkoutSet(workout_session_id=session.id, exercise_id=1, set_index=2, actual_reps=5, actual_load_kg=100))
    db_session.commit()

    status = _today_workout_status(db_session, _lift_reco(n_exercises=2), seeded["today"])
    assert status["completed_exercise_count"] == 1
    assert status["total_exercise_count"] == 2


def test_workout_status_run_none_then_completed(db_session, seeded):
    status = _today_workout_status(db_session, _run_reco(), seeded["today"])
    assert status["state"] == "none"

    run = models.CardioSession(user_id=DEMO_USER_ID, date=seeded["today"], activity_type="run", duration_seconds=1800)
    db_session.add(run)
    db_session.commit()

    status = _today_workout_status(db_session, _run_reco(), seeded["today"])
    assert status["state"] == "completed"
    assert status["elapsed_min"] == 30


def test_workout_status_detects_freeform_lift_session_on_a_run_day(db_session, seeded):
    """Log tab regression: 'Start Empty Session' lets a lift session begin on any
    day, including one where today's recommendation is a run -- it must still be
    reported as active so Resume Session appears and a duplicate can't be created."""
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=seeded["today"], label="Freeform", started_at=dt.datetime.utcnow())
    db_session.add(session)
    db_session.commit()

    status = _today_workout_status(db_session, _run_reco(), seeded["today"])
    assert status["state"] == "active"
    assert status["session_id"] == session.id
    assert status["total_exercise_count"] is None  # no lift was prescribed today, so there's no target to show


# --------------------------------------------------------------- resume session ----

def test_resume_session_endpoint_returns_logged_sets(client, db_session, seeded):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=seeded["today"], label="Lower Body", started_at=dt.datetime.utcnow())
    db_session.add(session)
    db_session.flush()
    db_session.add(models.WorkoutSet(workout_session_id=session.id, exercise_id=1, set_index=1, actual_reps=5, actual_load_kg=100, rest_seconds=90))
    db_session.commit()

    resp = client.get(f"/api/workouts/{session.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ended_at"] is None
    assert len(body["exercises_with_sets"]) == 1
    assert body["exercises_with_sets"][0]["logged_sets"][0]["weight_kg"] == 100


def test_resume_session_404_for_unknown_id(client, seeded):
    resp = client.get("/api/workouts/999999")
    assert resp.status_code == 404


# --------------------------------------------------------------------- streak ----

def test_streak_counts_consecutive_completed_planned_days(db_session, seeded):
    today = seeded["today"]
    by_weekday = {d.weekday: d for d in db_session.query(models.ProgramDay).filter_by(mesocycle_id=seeded["meso"].id).all()}

    # yesterday was a run day (if planned) -- log it and confirm the streak reaches at least 0
    streak_before = _compute_streak(db_session, by_weekday, today)
    assert streak_before == 0  # nothing logged yet for any prior day

    yesterday = today - dt.timedelta(days=1)
    pd_yesterday = by_weekday.get(yesterday.weekday())
    if pd_yesterday and pd_yesterday.day_type in ("lift", "run"):
        model = models.WorkoutSession if pd_yesterday.day_type == "lift" else models.CardioSession
        extra = {"label": "x"} if model is models.WorkoutSession else {"activity_type": "run", "duration_seconds": 1200}
        db_session.add(model(user_id=DEMO_USER_ID, date=yesterday, **extra))
        db_session.commit()
        streak_after = _compute_streak(db_session, by_weekday, today)
        assert streak_after == 1


# ------------------------------------------------------------------- hydration ----

def test_hydration_default_goal_when_no_bodyweight_on_file(db_session, seeded):
    assert _hydration_goal_oz(db_session) == 100.0


def test_hydration_goal_derived_from_bodyweight(db_session, seeded):
    db_session.add(models.BodyMetric(user_id=DEMO_USER_ID, date=seeded["today"], weight_kg=90.0))
    db_session.commit()
    # 90kg -> ~198.4 lb -> half of that, rounded
    assert _hydration_goal_oz(db_session) == round((90.0 / 0.45359237) * 0.5)


def test_hydration_log_and_read_today(client, seeded):
    resp = client.get("/api/hydration/today")
    assert resp.json() == {"date": seeded["today"].isoformat(), "ounces": 0.0, "goal_oz": 100.0}

    resp = client.post("/api/hydration/today", json={"ounces": 8})
    assert resp.json()["ounces"] == 8.0

    resp = client.post("/api/hydration/today", json={"ounces": 16})
    assert resp.json()["ounces"] == 24.0

    resp = client.get("/api/hydration/today")
    assert resp.json()["ounces"] == 24.0


# ------------------------------------------------------------------- body fat ----

def test_body_fat_null_until_logged(client, seeded):
    resp = client.get("/api/body-fat")
    assert resp.json() == {"body_fat_pct": None, "date": None}

    resp = client.post("/api/body-fat", json={"body_fat_pct": 18.6})
    assert resp.status_code == 200
    assert resp.json()["body_fat_pct"] == 18.6

    resp = client.get("/api/body-fat")
    body = resp.json()
    assert body["body_fat_pct"] == 18.6
    assert body["date"] == seeded["today"].isoformat()


def test_body_fat_does_not_overwrite_same_day_weight(client, db_session, seeded):
    db_session.add(models.BodyMetric(user_id=DEMO_USER_ID, date=seeded["today"], weight_kg=91.0))
    db_session.commit()

    client.post("/api/body-fat", json={"body_fat_pct": 20.0})

    row = db_session.query(models.BodyMetric).filter_by(user_id=DEMO_USER_ID, date=seeded["today"]).first()
    assert row.weight_kg == 91.0
    assert row.body_fat_pct == 20.0
