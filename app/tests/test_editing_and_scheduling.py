"""Coverage for the "let people fix things" pass: editing a logged set,
deleting a goal, editing/deleting a past body-weight entry, and swapping two
scheduled days. All were previously add-only or view-only."""
import datetime as dt

from toci import models
from toci.main import DEMO_USER_ID


def _lift_session(db_session, date):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=date, label="Lower Body Strength")
    db_session.add(session)
    db_session.commit()
    return session


# ------------------------------------------------------------------- sets ----

def test_update_set_changes_actual_values(client, db_session, seeded):
    session = _lift_session(db_session, seeded["today"])
    row = models.WorkoutSet(workout_session_id=session.id, exercise_id=seeded["exercise_id"], set_index=1, actual_reps=5, actual_load_kg=100)
    db_session.add(row)
    db_session.commit()

    resp = client.patch(f"/api/sets/{row.id}", json={"actual_reps": 6, "actual_load_kg": 102.5, "feel": "clean"})
    assert resp.status_code == 200

    detail = client.get(f"/api/workouts/{session.id}").json()
    logged = detail["exercises_with_sets"][0]["logged_sets"][0]
    assert logged["reps"] == 6
    assert logged["weight_kg"] == 102.5


def test_update_set_only_touches_provided_fields(client, db_session, seeded):
    session = _lift_session(db_session, seeded["today"])
    row = models.WorkoutSet(workout_session_id=session.id, exercise_id=seeded["exercise_id"], set_index=1, actual_reps=5, actual_load_kg=100, rir=2)
    db_session.add(row)
    db_session.commit()

    client.patch(f"/api/sets/{row.id}", json={"actual_reps": 8})

    db_session.refresh(row)
    assert row.actual_reps == 8
    assert row.actual_load_kg == 100  # untouched
    assert row.rir == 2  # untouched


def test_update_set_404_for_unknown_set(client, seeded):
    resp = client.patch("/api/sets/999999", json={"actual_reps": 5})
    assert resp.status_code == 404


# ------------------------------------------------------------------ goals ----

def test_delete_goal(client, seeded):
    created = client.post("/api/goals", json={"title": "Run 5k", "kind": "endurance"}).json()

    resp = client.delete(f"/api/goals/{created['id']}")
    assert resp.status_code == 200

    remaining = client.get("/api/goals").json()
    assert all(g["id"] != created["id"] for g in remaining)


def test_delete_goal_is_scoped_to_the_demo_user(client, db_session, seeded):
    other_user = models.User(id=999, name="Someone Else", units="imperial")
    db_session.add(other_user)
    db_session.commit()
    other_goal = models.Goal(user_id=other_user.id, title="Not yours", kind="custom")
    db_session.add(other_goal)
    db_session.commit()

    client.delete(f"/api/goals/{other_goal.id}")

    assert db_session.query(models.Goal).filter_by(id=other_goal.id).first() is not None


# ------------------------------------------------------------ body weight ----

def test_update_body_weight_entry(client, db_session, seeded):
    entry = models.BodyMetric(user_id=DEMO_USER_ID, date=seeded["today"] - dt.timedelta(days=3), weight_kg=90.0)
    db_session.add(entry)
    db_session.commit()

    resp = client.patch(f"/api/body-weight/{entry.id}", json={"weight_kg": 88.5})
    assert resp.status_code == 200

    db_session.refresh(entry)
    assert entry.weight_kg == 88.5


def test_delete_body_weight_entry(client, db_session, seeded):
    entry = models.BodyMetric(user_id=DEMO_USER_ID, date=seeded["today"] - dt.timedelta(days=3), weight_kg=90.0)
    db_session.add(entry)
    db_session.commit()

    resp = client.delete(f"/api/body-weight/{entry.id}")
    assert resp.status_code == 200

    history = client.get("/api/body-weight/history?days=30").json()
    assert all(p["weight_kg"] != 90.0 for p in history["points"])


def test_body_weight_history_includes_id_for_targeting(client, db_session, seeded):
    entry = models.BodyMetric(user_id=DEMO_USER_ID, date=seeded["today"], weight_kg=90.0)
    db_session.add(entry)
    db_session.commit()

    history = client.get("/api/body-weight/history?days=30").json()
    assert history["points"][0]["id"] == entry.id


# --------------------------------------------------------------- schedule ----

def test_swap_schedule_days_exchanges_their_plans(client, seeded, db_session):
    today_weekday = seeded["today"].weekday()
    other_weekday = (today_weekday + 1) % 7

    before_today = client.get("/api/program").json()["week"]
    lift_day_before = next(d for d in before_today if d["weekday"] == today_weekday)
    run_day_before = next(d for d in before_today if d["weekday"] == other_weekday)
    assert lift_day_before["day_type"] == "lift"
    assert run_day_before["day_type"] == "run"

    resp = client.post("/api/program/schedule/swap", json={"weekday_a": today_weekday, "weekday_b": other_weekday})
    assert resp.status_code == 200

    after = client.get("/api/program").json()["week"]
    lift_day_after = next(d for d in after if d["weekday"] == today_weekday)
    run_day_after = next(d for d in after if d["weekday"] == other_weekday)
    assert lift_day_after["day_type"] == "run"
    assert run_day_after["day_type"] == "lift"


def test_swap_schedule_days_rejects_same_day(client, seeded):
    weekday = seeded["today"].weekday()
    resp = client.post("/api/program/schedule/swap", json={"weekday_a": weekday, "weekday_b": weekday})
    assert resp.status_code == 400
