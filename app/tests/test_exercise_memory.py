"""Coverage for GET /api/exercises/{id}/memory -- the "what does the coach
already remember about this exercise" endpoint that powers the conversational
logging intro (last session, best ever, days since, session count).
"""
import datetime as dt

from toci import models
from toci.main import DEMO_USER_ID


def _lift_session(db_session, date):
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=date, label="Lower Body Strength")
    db_session.add(session)
    db_session.commit()
    return session


def _set(db_session, session_id, exercise_id, set_index, reps, load_kg, **kwargs):
    row = models.WorkoutSet(
        workout_session_id=session_id, exercise_id=exercise_id, set_index=set_index,
        actual_reps=reps, actual_load_kg=load_kg, **kwargs,
    )
    db_session.add(row)
    db_session.commit()
    return row


def test_memory_with_no_history(client, seeded):
    resp = client.get(f"/api/exercises/{seeded['exercise_id']}/memory")
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_history"] is False
    assert body["last_session"] is None
    assert body["best_session"] is None
    assert body["sessions_logged"] == 0
    assert body["days_since_last"] is None


def test_memory_reports_last_sessions_top_set(client, db_session, seeded):
    today = seeded["today"]
    old_session = _lift_session(db_session, today - dt.timedelta(days=14))
    _set(db_session, old_session.id, seeded["exercise_id"], 1, reps=5, load_kg=90)

    recent_session = _lift_session(db_session, today - dt.timedelta(days=3))
    _set(db_session, recent_session.id, seeded["exercise_id"], 1, reps=5, load_kg=100, feel="clean", rir=2)
    _set(db_session, recent_session.id, seeded["exercise_id"], 2, reps=4, load_kg=100)

    body = client.get(f"/api/exercises/{seeded['exercise_id']}/memory").json()
    assert body["has_history"] is True
    assert body["last_session"]["date"] == (today - dt.timedelta(days=3)).isoformat()
    assert body["last_session"]["weight_kg"] == 100
    assert body["last_session"]["reps"] == 5  # top set = heaviest, not just the first logged
    assert body["last_session"]["sets"] == 2
    assert body["last_session"]["feel"] == "clean"
    assert body["days_since_last"] == 3
    assert body["sessions_logged"] == 2


def test_memory_best_session_is_highest_estimated_1rm_not_just_heaviest(client, db_session, seeded):
    today = seeded["today"]
    # 100kg x 3 reps (~110 est 1RM) happened long ago and is heavier in absolute
    # terms, but 90kg x 10 reps (~120 est 1RM) is the real best by 1RM estimate.
    heavy_session = _lift_session(db_session, today - dt.timedelta(days=30))
    _set(db_session, heavy_session.id, seeded["exercise_id"], 1, reps=3, load_kg=100)

    high_rep_session = _lift_session(db_session, today - dt.timedelta(days=10))
    _set(db_session, high_rep_session.id, seeded["exercise_id"], 1, reps=10, load_kg=90)

    body = client.get(f"/api/exercises/{seeded['exercise_id']}/memory").json()
    assert body["best_session"]["weight_kg"] == 90
    assert body["best_session"]["reps"] == 10


def test_memory_scoped_to_this_exercise(client, db_session, seeded):
    today = seeded["today"]
    other_exercise = models.Exercise(name="Bench Press", movement_pattern="push", primary_muscle_group="chest")
    db_session.add(other_exercise)
    db_session.commit()

    session = _lift_session(db_session, today)
    _set(db_session, session.id, other_exercise.id, 1, reps=5, load_kg=60)

    body = client.get(f"/api/exercises/{seeded['exercise_id']}/memory").json()
    assert body["has_history"] is False


def test_exclude_session_id_omits_that_sessions_own_sets(client, db_session, seeded):
    """Post-workout screens call this right after a session's sets are already
    committed. Without exclude_session_id, that session would show up as its
    own "last/best" -- a session compared against itself instead of history."""
    today = seeded["today"]
    old_session = _lift_session(db_session, today - dt.timedelta(days=7))
    _set(db_session, old_session.id, seeded["exercise_id"], 1, reps=5, load_kg=90)

    just_finished = _lift_session(db_session, today)
    _set(db_session, just_finished.id, seeded["exercise_id"], 1, reps=5, load_kg=100)

    # Without excluding: today's just-logged session is the "last/best".
    body = client.get(f"/api/exercises/{seeded['exercise_id']}/memory").json()
    assert body["last_session"]["weight_kg"] == 100
    assert body["days_since_last"] == 0

    # Excluding it: "last/best" falls back to real prior history.
    body = client.get(f"/api/exercises/{seeded['exercise_id']}/memory?exclude_session_id={just_finished.id}").json()
    assert body["last_session"]["weight_kg"] == 90
    assert body["days_since_last"] == 7
    assert body["sessions_logged"] == 1
