"""Planned vs completed (toci/adherence.py): the frozen plan, day and exercise
statuses, the engine-calibration counts, and a check against the simulator,
where how often the athlete really trained is known."""
import datetime as dt

from toci import adherence, engine, models, simulator
from toci.main import DEMO_USER_ID


def _readiness(db, date, band="green", score=80):
    row = db.query(models.ReadinessScore).filter_by(user_id=DEMO_USER_ID, date=date).first()
    if row is None:
        row = models.ReadinessScore(user_id=DEMO_USER_ID, date=date, score=score, band=band)
        db.add(row)
        db.commit()
    return row


def _plan(db, date, band="green"):
    return engine.generate_recommendation(db, DEMO_USER_ID, date, _readiness(db, date, band, 80 if band == "green" else 30))


def _log(db, date, load, reps, exercise_id=1):
    s = models.WorkoutSession(user_id=DEMO_USER_ID, date=date, label="t")
    db.add(s)
    db.flush()
    for i, r in enumerate(reps):
        db.add(models.WorkoutSet(workout_session_id=s.id, exercise_id=exercise_id, set_index=i, prescribed_reps=5,
                                 prescribed_load_kg=load, actual_reps=r, actual_load_kg=load, rir=2.0,
                                 feel="clean", confidence_next="yes"))
    db.commit()


def test_the_plan_is_frozen_once_training_starts(db_session, seeded):
    today = seeded["today"]
    morning = _plan(db_session, today)
    assert morning.prescription["exercises"][0]["load_kg"] == 100
    _log(db_session, today, 100, [5, 5, 5])
    # a check-in after training regenerates the recommendation, which now sees today's sets
    later = _plan(db_session, today)
    assert later.prescription["exercises"][0]["load_kg"] == 102.5
    frozen = db_session.query(models.PlannedSession).filter_by(date=today).one()
    assert frozen.locked and frozen.prescription["exercises"][0]["load_kg"] == 100
    assert adherence.day(db_session, DEMO_USER_ID, today)["status"] == "as planned"


def test_a_plan_first_made_after_training_isnt_treated_as_a_plan(db_session, seeded):
    today = seeded["today"]
    _log(db_session, today, 100, [5, 5, 5])
    _plan(db_session, today)
    assert db_session.query(models.PlannedSession).filter_by(date=today).one().after_training
    assert adherence.day(db_session, DEMO_USER_ID, today)["plan_source"] == "schedule"


def test_exercise_statuses(db_session, seeded):
    today = seeded["today"]
    _plan(db_session, today)
    _log(db_session, today, 90, [5, 5, 5])
    d = adherence.day(db_session, DEMO_USER_ID, today)
    assert d["status"] == "modified" and d["exercises"][0]["status"] == "lighter"


def test_missed_reps_at_the_right_weight_are_short_not_lighter(db_session, seeded):
    today = seeded["today"]
    _plan(db_session, today)
    _log(db_session, today, 100, [5, 5, 3])
    e = adherence.day(db_session, DEMO_USER_ID, today)["exercises"][0]
    assert (e["status"], e["on_prescribed_load"], e["all_reps_hit"]) == ("short", True, False)


def test_following_a_recovery_swap_is_not_a_missed_workout(db_session, seeded):
    today = seeded["today"]
    assert _plan(db_session, today, band="red").session_type == "recover"
    d = adherence.day(db_session, DEMO_USER_ID, today)
    assert (d["planned"], d["status"]) == ("recover", "rested")


def test_skipped_swapped_and_extra_days(db_session, seeded):
    today = seeded["today"]
    lift_day = today - dt.timedelta(days=7)          # same weekday as today: a lift day
    run_day = today - dt.timedelta(days=6)           # the seeded run day
    rest_day = today - dt.timedelta(days=5)          # nothing scheduled
    _plan(db_session, lift_day)
    _plan(db_session, run_day)
    _log(db_session, run_day, 100, [5, 5, 5])        # lifted instead of running
    _log(db_session, rest_day, 100, [5, 5, 5])
    statuses = {d["date"]: d["status"] for d in adherence.report(db_session, DEMO_USER_ID, today, days=8)["days"]}
    assert statuses[lift_day.isoformat()] == "skipped"
    assert statuses[run_day.isoformat()] == "swapped"
    assert statuses[rest_day.isoformat()] == "extra session"


def test_calibration_counts_increases_done_at_the_new_weight(db_session, seeded):
    today = seeded["today"]
    first = today - dt.timedelta(days=14)
    _plan(db_session, first)
    _log(db_session, first, 100, [5, 5, 5])
    second = today - dt.timedelta(days=7)
    assert _plan(db_session, second).prescription["exercises"][0]["recommended_type"] == "increase"
    _log(db_session, second, 102.5, [5, 5, 4])
    cal = adherence.report(db_session, DEMO_USER_ID, today, days=21)["calibration"]
    assert cal["increase"] == {"n": 1, "hit": 0, "rate": 0.0, "verdict": "collecting"}


def test_strength_trend_uses_estimated_1rm(db_session, seeded):
    today = seeded["today"]
    _log(db_session, today - dt.timedelta(days=7), 100, [5])
    _log(db_session, today - dt.timedelta(days=1), 105, [5])
    s = adherence.report(db_session, DEMO_USER_ID, today, days=14)["strength"][0]
    assert s["sessions"] == 2 and s["change_pct"] == 0.05


def test_today_only_counts_once_something_is_logged(db_session, seeded):
    today = seeded["today"]
    _plan(db_session, today)
    assert all(d["date"] != today.isoformat() for d in adherence.report(db_session, DEMO_USER_ID, today)["days"])


def test_it_agrees_with_the_simulator_on_how_often_the_athlete_trained():
    for name in ("consistent", "availability"):
        scenario = next(s for s in simulator.SCENARIOS if s.name == name)
        kept = []
        result = simulator.run(simulator.EnginePolicy, scenario, seed=3, keep=kept)
        end = simulator.START + dt.timedelta(days=simulator.DAYS - 1)
        days = adherence.report(kept[0].db, 1, end, days=simulator.DAYS)["days"]
        lifted = sum(d["planned"] == "lift" and d["status"] in ("as planned", "modified") for d in days)
        assert lifted == result.sessions, name


def test_days_nobody_opened_the_app_stay_out_of_adherence(db_session, seeded):
    today = seeded["today"]
    _plan(db_session, today - dt.timedelta(days=7))          # opened, then skipped
    _log(db_session, today - dt.timedelta(days=14), 100, [5, 5, 5])  # never opened, trained anyway
    s = adherence.report(db_session, DEMO_USER_ID, today, days=21)["summary"]
    assert (s["planned_training_days"], s["trained"], s["adherence"]) == (1, 0, 0.0)
    assert s["trained_without_a_plan"] == 1 and s["scheduled_without_a_plan"] >= 1
