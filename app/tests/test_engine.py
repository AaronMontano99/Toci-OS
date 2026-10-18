"""Coverage for toci/engine.py's readiness scoring and the day-plan it drives
-- the core "adaptive" promise of the app, and (before this file) the one
part of the codebase with no direct test coverage at all; the Braintrust
eval only exercises coach_chat.py's chat surface, not this engine directly.

Focus here is the readiness_trend escalation added alongside Ask Toci's new
feedback-aware context: a single rough day and a real multi-day slump should
not be handled the same way."""
import datetime as dt

from toci import engine, models
from toci.main import DEMO_USER_ID


def _set_readiness(db_session, date, score, band):
    row = models.ReadinessScore(user_id=DEMO_USER_ID, date=date, score=score, band=band)
    db_session.add(row)
    db_session.commit()
    return row


def test_compute_readiness_defaults_to_neutral_without_history_or_checkin(db_session, seeded):
    today = seeded["today"]
    row = engine.compute_readiness(db_session, DEMO_USER_ID, today)
    # No recovery reading, no checkin, no baseline history yet -- every
    # component should fall back to its documented neutral default rather
    # than crash or silently zero out. No reading means no sign of strain (75):
    # at 50, every user without a wearable scored amber every single day.
    assert row.hrv_component == 75.0
    assert row.rhr_component == 75.0
    assert row.subjective_component == 70.0
    assert row.band in ("green", "amber", "red")


def test_readiness_trend_counts_consecutive_low_days_ending_today(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today - dt.timedelta(days=4), 80, "green")
    _set_readiness(db_session, today - dt.timedelta(days=3), 55, "amber")
    _set_readiness(db_session, today - dt.timedelta(days=2), 50, "amber")
    _set_readiness(db_session, today - dt.timedelta(days=1), 35, "red")
    _set_readiness(db_session, today, 45, "amber")

    trend = engine.readiness_trend(db_session, DEMO_USER_ID, today)
    # today, today-1, today-2, today-3 are all amber/red -- 4 days -- before
    # hitting the green day 4 days back, which stops the streak.
    assert trend["consecutive_low_days"] == 4
    assert trend["direction"] == "declining"


def test_readiness_trend_resets_on_a_green_day(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today - dt.timedelta(days=1), 30, "red")
    _set_readiness(db_session, today, 85, "green")

    trend = engine.readiness_trend(db_session, DEMO_USER_ID, today)
    assert trend["consecutive_low_days"] == 0


def test_readiness_trend_stops_at_a_gap_with_no_reading(db_session, seeded):
    today = seeded["today"]
    # Two days ago has no saved reading at all -- a gap, not a bad day --
    # so it shouldn't extend the streak past yesterday/today.
    _set_readiness(db_session, today - dt.timedelta(days=1), 50, "amber")
    _set_readiness(db_session, today, 48, "amber")

    trend = engine.readiness_trend(db_session, DEMO_USER_ID, today)
    assert trend["consecutive_low_days"] == 2


def test_single_amber_day_trims_volume_but_does_not_cancel_the_lift(db_session, seeded):
    today = seeded["today"]
    readiness = _set_readiness(db_session, today, 55, "amber")

    reco = engine.generate_recommendation(db_session, DEMO_USER_ID, today, readiness)
    assert reco.session_type == "lift"
    assert reco.prescription["exercises"][0]["sets"] < 3  # seeded template's set count, trimmed ~20%
    assert any("trimmed" in line for line in reco.reasoning)


def test_single_red_day_swaps_the_lift_for_recovery(db_session, seeded):
    today = seeded["today"]
    readiness = _set_readiness(db_session, today, 25, "red")

    reco = engine.generate_recommendation(db_session, DEMO_USER_ID, today, readiness)
    assert reco.session_type == "recover"
    assert any("swapping to active recovery" in line for line in reco.reasoning)


def test_three_consecutive_amber_days_escalates_lift_to_recovery(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today - dt.timedelta(days=2), 55, "amber")
    _set_readiness(db_session, today - dt.timedelta(days=1), 52, "amber")
    readiness = _set_readiness(db_session, today, 50, "amber")

    reco = engine.generate_recommendation(db_session, DEMO_USER_ID, today, readiness)
    assert reco.session_type == "recover"
    assert any("3 days of low readiness in a row" in line for line in reco.reasoning)


def test_two_consecutive_amber_days_does_not_yet_escalate(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today - dt.timedelta(days=1), 52, "amber")
    readiness = _set_readiness(db_session, today, 50, "amber")

    reco = engine.generate_recommendation(db_session, DEMO_USER_ID, today, readiness)
    assert reco.session_type == "lift"  # below the 3-day slump threshold -- ordinary amber trim only


def test_run_day_escalates_to_recovery_jog_during_a_slump(db_session, seeded):
    run_day_date = seeded["today"] + dt.timedelta(days=1)  # seeded's run day is the day after today
    _set_readiness(db_session, run_day_date - dt.timedelta(days=2), 55, "amber")
    _set_readiness(db_session, run_day_date - dt.timedelta(days=1), 52, "amber")
    readiness = _set_readiness(db_session, run_day_date, 50, "amber")

    reco = engine.generate_recommendation(db_session, DEMO_USER_ID, run_day_date, readiness)
    assert reco.session_type == "run"
    assert reco.prescription["run_type"] == "recovery_jog"
    assert any("3 days of low readiness in a row" in line for line in reco.reasoning)


def test_build_lift_day_prescription_cuts_harder_during_a_slump(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today - dt.timedelta(days=2), 55, "amber")
    _set_readiness(db_session, today - dt.timedelta(days=1), 52, "amber")
    readiness = _set_readiness(db_session, today, 50, "amber")

    program = db_session.query(models.Program).filter_by(user_id=DEMO_USER_ID).first()
    meso = db_session.query(models.Mesocycle).filter_by(program_id=program.id).first()
    lift_day = db_session.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, day_type="lift").first()

    prescription = engine.build_lift_day_prescription(db_session, DEMO_USER_ID, lift_day, readiness)
    original_sets = lift_day.template["exercises"][0]["sets"]
    assert prescription["exercises"][0]["sets"] == max(1, round(original_sets * 0.6))
