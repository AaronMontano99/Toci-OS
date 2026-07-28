"""Coverage for the persisted exercise-substitution preference: setting,
clearing, and its effect on future prescriptions (build_lift_day_prescription),
including precedence against the existing injury-based substitution."""
from toci import models
from toci.main import DEMO_USER_ID


def _add_exercise(db_session, id, name, muscle_group="chest"):
    ex = models.Exercise(id=id, name=name, movement_pattern="push", primary_muscle_group=muscle_group)
    db_session.add(ex)
    db_session.commit()
    return ex


def test_get_substitution_when_none_set(client, seeded):
    resp = client.get(f"/api/exercises/{seeded['exercise_id']}/substitution")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"substituted": False, "substitute": None}


def test_set_and_get_substitution(client, db_session, seeded):
    substitute = _add_exercise(db_session, 2, "Front Squat", "legs")

    resp = client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": substitute.id})
    assert resp.status_code == 200
    assert resp.json()["substituted"] is True

    body = client.get(f"/api/exercises/{seeded['exercise_id']}/substitution").json()
    assert body == {"substituted": True, "substitute": {"id": substitute.id, "name": "Front Squat"}}


def test_setting_a_substitution_twice_replaces_it_rather_than_duplicating(client, db_session, seeded):
    first = _add_exercise(db_session, 2, "Front Squat", "legs")
    second = _add_exercise(db_session, 3, "Goblet Squat", "legs")

    client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": first.id})
    client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": second.id})

    body = client.get(f"/api/exercises/{seeded['exercise_id']}/substitution").json()
    assert body["substitute"]["id"] == second.id
    assert db_session.query(models.ExerciseSubstitution).filter_by(original_exercise_id=seeded["exercise_id"]).count() == 1


def test_cannot_substitute_an_exercise_for_itself(client, seeded):
    resp = client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": seeded["exercise_id"]})
    assert resp.status_code == 400


def test_substitute_exercise_must_exist(client, seeded):
    resp = client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": 9999})
    assert resp.status_code == 404


def test_clearing_a_substitution_reverts_it(client, db_session, seeded):
    substitute = _add_exercise(db_session, 2, "Front Squat", "legs")
    client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": substitute.id})

    resp = client.delete(f"/api/exercises/{seeded['exercise_id']}/substitution")
    assert resp.status_code == 200
    assert resp.json() == {"substituted": False}

    body = client.get(f"/api/exercises/{seeded['exercise_id']}/substitution").json()
    assert body == {"substituted": False, "substitute": None}


def test_persisted_substitution_applies_to_future_prescriptions(client, db_session, seeded):
    substitute = _add_exercise(db_session, 2, "Front Squat", "legs")
    client.put(f"/api/exercises/{seeded['exercise_id']}/substitution", json={"substitute_exercise_id": substitute.id})

    weekday = seeded["today"].weekday()
    body = client.get(f"/api/log/lift-days/{weekday}/prescription").json()
    exercise = body["exercises"][0]
    # Both the id and the name change -- unlike the injury substitution, this
    # is a real Exercise row, so future sets should log against it.
    assert exercise["exercise_id"] == substitute.id
    assert exercise["name"] == "Front Squat"


def test_injury_substitution_takes_precedence_over_a_persisted_preference(client, db_session, seeded):
    # Re-seed the lift day's one exercise as "Barbell Bench Press" so the
    # hardcoded injury substitution map applies to it.
    bench = _add_exercise(db_session, 10, "Barbell Bench Press", "chest")
    day = db_session.query(models.ProgramDay).filter_by(mesocycle_id=seeded["meso"].id, weekday=seeded["today"].weekday()).first()
    day.template = {"exercises": [{"exercise_id": bench.id, "sets": 3, "reps": 5, "target_rir": 2, "starting_load_kg": 60}]}
    db_session.add(models.Injury(user_id=DEMO_USER_ID, body_region="left_shoulder", description="test", active=True))
    db_session.commit()

    preferred = _add_exercise(db_session, 11, "Cable Fly", "chest")
    client.put(f"/api/exercises/{bench.id}/substitution", json={"substitute_exercise_id": preferred.id})

    weekday = seeded["today"].weekday()
    body = client.get(f"/api/log/lift-days/{weekday}/prescription").json()
    exercise = body["exercises"][0]
    # Injury substitution wins: same exercise_id (name-only swap), not the
    # user's persisted preference.
    assert exercise["exercise_id"] == bench.id
    assert exercise["name"] == "Neutral-Grip Dumbbell Press"
