"""The engine fixes the eight-week training simulator found, plus the simulator itself.

Each engine test pins one finding from docs/training-sim-report.md: an ordinary
day scoring amber, progression judged on a single set, coming back heavier after
weeks off, no reset after repeated misses, and planning a future day with
today's readiness trend."""
import datetime as dt

from toci import engine, models, simulator
from toci.main import DEMO_USER_ID


def _session(db, date, load, reps_done, prescribed=5, feel="clean"):
    s = models.WorkoutSession(user_id=DEMO_USER_ID, date=date, label="test")
    db.add(s)
    db.flush()
    for i, r in enumerate(reps_done):
        db.add(models.WorkoutSet(workout_session_id=s.id, exercise_id=1, set_index=i, prescribed_reps=prescribed,
                                 prescribed_load_kg=load, actual_reps=r, actual_load_kg=load, rir=2.0, feel=feel,
                                 confidence_next="yes"))
    db.commit()


def _options(db, today):
    return engine.progression_options(db, DEMO_USER_ID, 1, 2, 5, 100, today=today)


def test_an_ordinary_day_at_your_own_baseline_is_green(db_session, seeded):
    today = seeded["today"]
    for d in range(1, 15):
        db_session.add(models.DailyRecoveryMetric(user_id=DEMO_USER_ID, date=today - dt.timedelta(days=d),
                                                  hrv_ms=60 + (d % 3), resting_hr_bpm=55, sleep_duration_min=470))
    db_session.add(models.DailyRecoveryMetric(user_id=DEMO_USER_ID, date=today, hrv_ms=61, resting_hr_bpm=55, sleep_duration_min=470))
    db_session.add(models.DailyCheckin(user_id=DEMO_USER_ID, date=today, soreness_1_5=2, stress_mood_1_5=4))
    db_session.commit()
    assert engine.compute_readiness(db_session, DEMO_USER_ID, today).band == "green"


def test_no_wearable_and_a_normal_checkin_is_green(db_session, seeded):
    today = seeded["today"]
    db_session.add(models.DailyCheckin(user_id=DEMO_USER_ID, date=today, soreness_1_5=2, stress_mood_1_5=4))
    db_session.commit()
    assert engine.compute_readiness(db_session, DEMO_USER_ID, today).band == "green"


def test_hrv_well_below_baseline_still_lands_amber_or_red(db_session, seeded):
    today = seeded["today"]
    for d in range(1, 15):
        db_session.add(models.DailyRecoveryMetric(user_id=DEMO_USER_ID, date=today - dt.timedelta(days=d),
                                                  hrv_ms=60 + (d % 3), resting_hr_bpm=55, sleep_duration_min=470))
    db_session.add(models.DailyRecoveryMetric(user_id=DEMO_USER_ID, date=today, hrv_ms=50, resting_hr_bpm=60, sleep_duration_min=360))
    db_session.commit()
    assert engine.compute_readiness(db_session, DEMO_USER_ID, today).band in ("amber", "red")


def test_a_missed_final_set_blocks_the_increase_even_when_the_first_set_was_clean(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=3), 100, [5, 5, 3])
    out = _options(db_session, today)
    assert out["recommended_type"] == "repeat"
    assert all(o["type"] != "increase" for o in out["options"])


def test_every_set_hit_still_progresses(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=3), 100, [5, 5, 5])
    assert _options(db_session, today)["recommended_type"] == "increase"


def test_coming_back_after_three_weeks_off_starts_a_little_lighter(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=25), 100, [5, 5, 5])
    out = _options(db_session, today)
    assert out["recommended_type"] == "repeat"
    assert out["options"][0]["load_kg"] == 95.0
    assert "25 days" in out["why"] and "95%" in out["why"]


def test_a_month_or_more_off_starts_lighter_still(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=30), 100, [5, 5, 5])
    assert _options(db_session, today)["options"][0]["load_kg"] == 90.0


def test_three_weeks_is_where_easing_back_starts(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=20), 100, [5, 5, 5])
    assert _options(db_session, today)["recommended_type"] == "increase"


def test_two_missed_sessions_in_a_row_reset_about_ten_percent(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=6), 100, [5, 4, 3])
    _session(db_session, today - dt.timedelta(days=3), 100, [5, 4, 4])
    out = _options(db_session, today)
    assert out["recommended_type"] == "deload"
    assert out["options"][0]["load_kg"] == 90.0


def test_one_missed_session_only_holds(db_session, seeded):
    today = seeded["today"]
    _session(db_session, today - dt.timedelta(days=6), 97.5, [5, 5, 5])
    _session(db_session, today - dt.timedelta(days=3), 100, [5, 4, 3])
    assert _options(db_session, today)["recommended_type"] == "repeat"


def test_a_saved_workout_for_another_day_reads_that_days_trend(db_session, seeded):
    today = seeded["today"]
    later = today + dt.timedelta(days=10)
    for d in range(3):
        db_session.add(models.ReadinessScore(user_id=DEMO_USER_ID, date=later - dt.timedelta(days=d), score=50, band="amber"))
    db_session.commit()
    day = db_session.query(models.ProgramDay).filter_by(day_type="lift").first()
    readiness = db_session.query(models.ReadinessScore).filter_by(date=later).first()
    plan = engine.build_lift_day_prescription(db_session, DEMO_USER_ID, day, readiness, date=later)
    assert plan["exercises"][0]["sets"] == 2  # 3 sets x 0.6: the slump on that day, not today's empty history


# ---------------------------------------------------------------- the simulator


def _scenario(name):
    return next(s for s in simulator.SCENARIOS if s.name == name)


def test_the_simulated_engine_stays_inside_the_safety_rules():
    r = simulator.run(simulator.EnginePolicy, _scenario("consistent"), seed=1)
    assert r.violations == []
    assert r.sessions == 32


def test_the_safety_rules_catch_a_program_that_breaks_them():
    r = simulator.run(simulator.FixedPolicy, _scenario("consistent"), seed=1)
    assert any("went up after a failed" in v for v in r.violations)
    assert r.failed_sets > 50


def test_the_athlete_detrains_after_a_long_break():
    athlete = simulator.Athlete(simulator.random.Random(0), _scenario("consistent"))
    before = athlete.rested_1rm("Barbell Back Squat")
    for _ in range(35):
        athlete.end_day(0.0)
    assert athlete.rested_1rm("Barbell Back Squat") < before * 0.97


def test_the_verdict_needs_every_rule():
    eng = [simulator.Result("e", "x", 0, gain_pct=0.02, failed_sets=1)]
    fixed = [simulator.Result("f", "x", 0, gain_pct=0.02, failed_sets=10)]
    assert simulator.verdict(eng, fixed)["pass"]
    eng[0].impossible = 3
    assert not simulator.verdict(eng, fixed)["pass"]


def test_progress_is_judged_within_half_a_point_of_the_fixed_program():
    fixed = [simulator.Result("f", "x", 0, gain_pct=-0.009, failed_sets=40)]
    close = [simulator.Result("e", "x", 0, gain_pct=-0.012, failed_sets=8)]
    far = [simulator.Result("e", "x", 0, gain_pct=-0.016, failed_sets=8)]
    assert simulator.verdict(close, fixed)["rules"]["keeps the progress"]
    assert not simulator.verdict(far, fixed)["rules"]["keeps the progress"]
