"""The engine prescribing for the equipment a user actually has (Profile/onboarding: full gym,
home gym, bodyweight). Found by the training simulator: the setting was collected but never read,
so a home-gym user kept getting barbell squats and benches."""
import datetime as dt

from toci import engine, equipment, models
from toci.main import DEMO_USER_ID


def _plan(db, seeded, gear, band="green"):
    user = db.query(models.User).get(DEMO_USER_ID)
    user.equipment = gear
    db.commit()
    readiness = db.query(models.ReadinessScore).filter_by(user_id=DEMO_USER_ID, date=seeded["today"]).first()
    if readiness is None:
        readiness = models.ReadinessScore(user_id=DEMO_USER_ID, date=seeded["today"], score=80, band=band)
        db.add(readiness)
        db.commit()
    return engine.generate_recommendation(db, DEMO_USER_ID, seeded["today"], readiness)


def test_every_catalog_swap_lands_on_something_that_setting_can_do():
    for name, by_setting in equipment.SWAPS.items():
        for gear, (sub, factor, *_) in by_setting.items():
            assert equipment.fits(sub, gear), (name, gear, sub)
            assert 0 <= factor < 1


def test_unknown_exercises_are_trusted_to_fit():
    assert equipment.fits("My Garage Sled Push", "bodyweight")
    assert equipment.swap_for("My Garage Sled Push", "bodyweight") is None


def test_full_gym_is_unchanged(db_session, seeded):
    rec = _plan(db_session, seeded, "full_gym")
    ex = rec.prescription["exercises"][0]
    assert (ex["name"], ex["load_kg"]) == ("Barbell Back Squat", 100)


def test_home_gym_gets_a_goblet_squat_at_a_dumbbell_weight(db_session, seeded):
    rec = _plan(db_session, seeded, "home_gym")
    ex = rec.prescription["exercises"][0]
    assert ex["name"] == "Goblet Squat"
    assert ex["load_kg"] == 30.0  # 100 kg barbell plan x 0.3, in 1 kg dumbbell steps
    assert any("swapped for what a home gym has" in r for r in rec.reasoning)
    # the swap is a real exercise, so sets log against it and it builds its own history
    assert db_session.query(models.Exercise).get(ex["exercise_id"]).name == "Goblet Squat"


def test_bodyweight_gets_no_load_and_progresses_by_reps(db_session, seeded):
    rec = _plan(db_session, seeded, "bodyweight")
    ex = rec.prescription["exercises"][0]
    assert (ex["name"], ex["load_kg"], ex["reps"]) == ("Tempo Bodyweight Squat", 0.0, 5)

    s = models.WorkoutSession(user_id=DEMO_USER_ID, date=seeded["today"] - dt.timedelta(days=2), label="t")
    db_session.add(s)
    db_session.flush()
    for i in range(3):
        db_session.add(models.WorkoutSet(workout_session_id=s.id, exercise_id=ex["exercise_id"], set_index=i,
                                         prescribed_reps=5, actual_reps=5, actual_load_kg=0.0, rir=3.0,
                                         feel="clean", confidence_next="yes"))
    db_session.commit()
    again = _plan(db_session, seeded, "bodyweight").prescription["exercises"][0]
    assert (again["load_kg"], again["reps"]) == (0.0, 6)


def test_home_gym_progresses_in_one_kilo_steps(db_session, seeded):
    first = _plan(db_session, seeded, "home_gym").prescription["exercises"][0]
    s = models.WorkoutSession(user_id=DEMO_USER_ID, date=seeded["today"] - dt.timedelta(days=2), label="t")
    db_session.add(s)
    db_session.flush()
    for i in range(3):
        db_session.add(models.WorkoutSet(workout_session_id=s.id, exercise_id=first["exercise_id"], set_index=i,
                                         prescribed_reps=5, actual_reps=5, actual_load_kg=30.0, rir=3.0,
                                         feel="clean", confidence_next="yes"))
    db_session.commit()
    assert _plan(db_session, seeded, "home_gym").prescription["exercises"][0]["load_kg"] == 31.0


def test_a_saved_swap_the_user_cant_do_at_home_gives_way_to_the_equipment_swap(db_session, seeded):
    leg_press = models.Exercise(name="Leg Press", movement_pattern="squat", primary_muscle_group="quads")
    db_session.add(leg_press)
    db_session.flush()
    equipment.NEEDS["Leg Press"] = "full_gym"
    try:
        db_session.add(models.ExerciseSubstitution(user_id=DEMO_USER_ID, original_exercise_id=1, substitute_exercise_id=leg_press.id))
        db_session.commit()
        assert _plan(db_session, seeded, "full_gym").prescription["exercises"][0]["name"] == "Leg Press"
        assert _plan(db_session, seeded, "home_gym").prescription["exercises"][0]["name"] == "Goblet Squat"
    finally:
        del equipment.NEEDS["Leg Press"]


def test_the_week_view_shows_the_swapped_names(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.equipment = "home_gym"
    db_session.commit()
    from toci.main import _week_detail
    week = _week_detail(db_session, seeded["meso"], seeded["today"])
    names = [e["name"] for d in week for e in d["exercises"]]
    assert names == ["Goblet Squat"]
