"""Backend coverage for the Log-tab landing-screen phase: lift-day options and
their live prescriptions, the completed-session detail endpoints (lift + run),
paginated activity history, and the weekly-summary math (including the period
selector and the encouragement/coach message states).

Frontend-only behavior (dark-mode token parity, accent theming, which card a
tap navigates to, duplicate-session prevention in the click handler) isn't
covered here -- it has no backend surface to unit test and was verified
manually/with Playwright instead; see the phase's final report.
"""
import datetime as dt

from toci import models
from toci.main import DEMO_USER_ID


def _lift_session(db_session, date, label="Lower Body Strength", started_at=None, ended_at=None):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=date, label=label, started_at=started_at or dt.datetime.utcnow(), ended_at=ended_at)
    db_session.add(session)
    db_session.commit()
    return session


def _run_session(db_session, date, duration_seconds=1800, distance_meters=5000, avg_hr=150, perceived_effort=6):
    session = models.CardioSession(
        user_id=DEMO_USER_ID, date=date, activity_type="run",
        duration_seconds=duration_seconds, distance_meters=distance_meters, avg_hr=avg_hr, perceived_effort=perceived_effort,
    )
    db_session.add(session)
    db_session.commit()
    return session


# ------------------------------------------------------------------- lift days ----

def test_lift_days_lists_this_weeks_lift_type_days(client, seeded):
    resp = client.get("/api/log/lift-days")
    assert resp.status_code == 200
    days = resp.json()
    lift_weekdays = {d["weekday"] for d in days}
    assert seeded["today"].weekday() in lift_weekdays  # seeded fixture puts today's ProgramDay as a lift day
    for d in days:
        assert d["exercise_count"] >= 1


def test_lift_day_prescription_reuses_progression_engine(client, seeded):
    resp = client.get(f"/api/log/lift-days/{seeded['today'].weekday()}/prescription")
    assert resp.status_code == 200
    body = resp.json()
    assert body["label"]
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["exercise_id"] == seeded["exercise_id"]
    assert body["exercises"][0]["load_kg"] > 0  # progression engine picked a real starting load, not a placeholder


def test_lift_day_prescription_404_for_non_lift_weekday(client, seeded):
    # the run day in the seeded fixture is (today + 1) % 7
    run_weekday = (seeded["today"].weekday() + 1) % 7
    resp = client.get(f"/api/log/lift-days/{run_weekday}/prescription")
    assert resp.status_code == 404


# -------------------------------------------------------------- session detail ----

def test_workout_detail_includes_duration_and_volume_when_completed(client, db_session, seeded):
    session = _lift_session(
        db_session, seeded["today"],
        started_at=dt.datetime.utcnow() - dt.timedelta(minutes=42),
        ended_at=dt.datetime.utcnow(),
    )
    db_session.add(models.WorkoutSet(workout_session_id=session.id, exercise_id=seeded["exercise_id"], set_index=1, actual_reps=5, actual_load_kg=100))
    db_session.add(models.WorkoutSet(workout_session_id=session.id, exercise_id=seeded["exercise_id"], set_index=2, actual_reps=5, actual_load_kg=100))
    db_session.commit()

    resp = client.get(f"/api/workouts/{session.id}")
    body = resp.json()
    assert body["duration_min"] >= 41
    assert body["exercise_count"] == 1
    assert body["volume_kg"] == 1000.0  # 2 sets x 5 reps x 100kg
    assert len(body["exercises_with_sets"][0]["logged_sets"]) == 2


def test_workout_detail_duration_none_while_still_in_progress(client, db_session, seeded):
    session = _lift_session(db_session, seeded["today"])  # no ended_at
    resp = client.get(f"/api/workouts/{session.id}")
    assert resp.json()["duration_min"] is None


def test_run_detail_endpoint(client, db_session, seeded):
    session = _run_session(db_session, seeded["today"], duration_seconds=1800, distance_meters=5000)
    resp = client.get(f"/api/runs/{session.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["duration_min"] == 30
    assert body["distance_km"] == 5.0
    assert body["pace_per_km"] == "6:00"
    assert body["avg_hr"] == 150


def test_run_detail_404_for_unknown_id(client, seeded):
    resp = client.get("/api/runs/999999")
    assert resp.status_code == 404


def test_run_detail_scoped_to_demo_user(client, db_session, seeded):
    other_user_run = models.CardioSession(user_id=999, date=seeded["today"], activity_type="run", duration_seconds=600, distance_meters=1000)
    db_session.add(other_user_run)
    db_session.commit()
    resp = client.get(f"/api/runs/{other_user_run.id}")
    assert resp.status_code == 404


# -------------------------------------------------------------------- history ----

def test_history_empty_state(client, seeded):
    resp = client.get("/api/log/history")
    body = resp.json()
    assert body["sessions"] == []
    assert body["has_more"] is False


def test_history_pagination_has_no_overlap_and_reports_has_more(client, db_session, seeded):
    for i in range(5):
        _lift_session(db_session, seeded["today"] - dt.timedelta(days=i), label=f"Session {i}")

    page1 = client.get("/api/log/history?limit=2&offset=0").json()
    assert len(page1["sessions"]) == 2
    assert page1["has_more"] is True

    page2 = client.get("/api/log/history?limit=2&offset=2").json()
    assert len(page2["sessions"]) == 2
    assert page2["has_more"] is True

    page1_ids = {s["id"] for s in page1["sessions"]}
    page2_ids = {s["id"] for s in page2["sessions"]}
    assert page1_ids.isdisjoint(page2_ids)  # no duplicate sessions across pages

    page3 = client.get("/api/log/history?limit=2&offset=4").json()
    assert len(page3["sessions"]) == 1
    assert page3["has_more"] is False


def test_history_interleaves_lift_and_run_by_date(client, db_session, seeded):
    today = seeded["today"]
    _lift_session(db_session, today - dt.timedelta(days=2))
    _run_session(db_session, today - dt.timedelta(days=1))
    _lift_session(db_session, today)

    sessions = client.get("/api/log/history?limit=10").json()["sessions"]
    dates = [s["date"] for s in sessions]
    assert dates == sorted(dates, reverse=True)  # newest first regardless of type


# --------------------------------------------------------------- weekly summary ----

def test_summary_recent_sessions_include_id_for_detail_navigation(client, db_session, seeded):
    session = _lift_session(db_session, seeded["today"])
    resp = client.get("/api/log/summary?recent_limit=5").json()
    assert resp["recent_sessions"][0]["id"] == session.id


def test_summary_week_math_this_week(client, db_session, seeded):
    today = seeded["today"]
    _lift_session(db_session, today, started_at=dt.datetime.utcnow() - dt.timedelta(minutes=45), ended_at=dt.datetime.utcnow())
    _run_session(db_session, today, duration_seconds=1800)

    week = client.get("/api/log/summary").json()["week"]
    assert week["lift_sessions"] == 1
    assert week["runs"] == 1
    assert week["total_time_min"] == 75  # 45 + 30
    assert week["lift_goal"] == 1  # the seeded fixture schedules exactly one lift day and one run day per week
    assert week["run_goal"] == 1


def test_summary_period_scales_goals(client, seeded):
    this_week = client.get("/api/log/summary?period=this_week").json()
    last_4 = client.get("/api/log/summary?period=last_4_weeks").json()
    assert last_4["week"]["lift_goal"] == this_week["week"]["lift_goal"] * 4
    assert last_4["week"]["run_goal"] == this_week["week"]["run_goal"] * 4
    assert last_4["period"] == "last_4_weeks"


def test_summary_last_week_excludes_sessions_from_this_week(client, db_session, seeded):
    _lift_session(db_session, seeded["today"])  # logged today, i.e. this week
    last_week = client.get("/api/log/summary?period=last_week").json()["week"]
    assert last_week["lift_sessions"] == 0


def test_encouragement_on_track_when_plan_fully_met(client, db_session, seeded):
    today = seeded["today"]
    by_weekday_lift_goal = client.get("/api/log/summary").json()["week"]["lift_goal"]
    for i in range(by_weekday_lift_goal):
        _lift_session(db_session, today - dt.timedelta(days=i))
    run_goal = client.get("/api/log/summary").json()["week"]["run_goal"]
    for i in range(run_goal):
        _run_session(db_session, today)

    body = client.get("/api/log/summary").json()
    assert "on track" in body["encouragement"].lower()


def test_encouragement_early_in_period_when_nothing_logged(client, seeded):
    body = client.get("/api/log/summary").json()
    assert "early" in body["encouragement"].lower()


# ------------------------------------------------------------- unplanned workout ----

def test_start_freeform_workout_with_no_prescription(client, seeded):
    resp = client.post("/api/workouts", json={"label": "Freeform"})
    assert resp.status_code == 200
    session_id = resp.json()["id"]

    detail = client.get(f"/api/workouts/{session_id}").json()
    assert detail["label"] == "Freeform"
    assert detail["exercises_with_sets"] == []


# ------------------------------------------------------- volume updates on set delete ----

def test_deleting_a_set_reduces_weekly_volume_and_session_detail(client, db_session, seeded):
    session = _lift_session(db_session, seeded["today"])
    set1 = models.WorkoutSet(workout_session_id=session.id, exercise_id=seeded["exercise_id"], set_index=1, actual_reps=5, actual_load_kg=100)
    set2 = models.WorkoutSet(workout_session_id=session.id, exercise_id=seeded["exercise_id"], set_index=2, actual_reps=5, actual_load_kg=100)
    db_session.add_all([set1, set2])
    db_session.commit()

    before = client.get(f"/api/workouts/{session.id}").json()
    assert before["volume_kg"] == 1000.0

    resp = client.delete(f"/api/sets/{set1.id}")
    assert resp.status_code == 200

    after = client.get(f"/api/workouts/{session.id}").json()
    assert after["volume_kg"] == 500.0
