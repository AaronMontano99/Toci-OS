"""Coverage for coach_chat.py's new feedback-aware context (the readiness
trend / adherence / stalled-lift signal folded into the system prompt) --
deterministic, LLM-independent logic that's cheap to test directly here
rather than only indirectly through the Braintrust eval, which can only
grade the final free-text reply and needs Ollama running to do it at all."""
import datetime as dt

from toci import coach_chat, engine, models
from toci.main import DEMO_USER_ID


def _set_readiness(db_session, date, score, band):
    db_session.add(models.ReadinessScore(user_id=DEMO_USER_ID, date=date, score=score, band=band))
    db_session.commit()


def test_feedback_summary_reports_no_reading_before_checkin(db_session, seeded):
    summary = coach_chat._recent_feedback_summary(db_session, DEMO_USER_ID, seeded["today"])
    assert "No readiness reading yet today." in summary


def test_feedback_summary_reports_todays_band_with_no_trend_note_when_stable(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today, 75, "green")

    summary = coach_chat._recent_feedback_summary(db_session, DEMO_USER_ID, today)
    assert "Today's readiness: 75 (green)." in summary


def test_feedback_summary_flags_a_real_slump_the_same_way_the_engine_does(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today - dt.timedelta(days=2), 55, "amber")
    _set_readiness(db_session, today - dt.timedelta(days=1), 52, "amber")
    _set_readiness(db_session, today, 50, "amber")

    summary = coach_chat._recent_feedback_summary(db_session, DEMO_USER_ID, today)
    trend = engine.readiness_trend(db_session, DEMO_USER_ID, today)
    assert f"{trend['consecutive_low_days']} low-readiness days in a row" in summary


def test_feedback_summary_reports_adherence_against_the_scheduled_week(db_session, seeded):
    today = seeded["today"]
    # seeded gives one lift day (today) + one run day (tomorrow) -- 2 scheduled/week.
    db_session.add(models.WorkoutSession(user_id=DEMO_USER_ID, date=today))
    db_session.commit()

    summary = coach_chat._recent_feedback_summary(db_session, DEMO_USER_ID, today)
    assert "Training adherence (last 7 days): 1 of 2 scheduled sessions completed." in summary


def test_feedback_summary_flags_a_lift_that_missed_its_target_last_session(db_session, seeded):
    today = seeded["today"]
    session = models.WorkoutSession(user_id=DEMO_USER_ID, date=today - dt.timedelta(days=2))
    db_session.add(session)
    db_session.flush()
    # Missed the prescribed 5 reps at 100kg -- progression_options should
    # recommend "repeat" with a "missed target" reason, and the feedback
    # summary should surface that exercise by name.
    db_session.add(models.WorkoutSet(
        workout_session_id=session.id, exercise_id=seeded["exercise_id"],
        prescribed_reps=5, actual_reps=3, actual_load_kg=100.0, set_index=1,
    ))
    db_session.commit()

    summary = coach_chat._recent_feedback_summary(db_session, DEMO_USER_ID, today)
    assert "Missed target reps/RIR last session on: Barbell Back Squat." in summary


def test_system_prompt_embeds_the_feedback_signal(db_session, seeded):
    today = seeded["today"]
    _set_readiness(db_session, today, 30, "red")

    prompt = coach_chat._system_prompt(db_session, DEMO_USER_ID)
    assert "Recent feedback signal" in prompt
    assert "Today's readiness: 30 (red)." in prompt
