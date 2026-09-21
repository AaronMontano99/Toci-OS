"""Coverage for the guided first-run onboarding interview's backend surface:
the new training-preference Settings fields, and POST /api/onboarding/complete
(weight logging + calorie calc + the onboarding_completed flip that gates the
mobile app's Today tab -- see mobile/src/app/(tabs)/index.tsx)."""
from toci import models
from toci.main import DEMO_USER_ID


def test_settings_exposes_new_training_onboarding_fields(client, seeded):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    body = resp.json()
    for field in [
        "training_days_per_week",
        "session_length_min",
        "training_split_preference",
        "training_notes",
        "recovery_check_in_method",
        "onboarding_completed",
    ]:
        assert field in body
    # A freshly seeded user hasn't onboarded yet.
    assert body["onboarding_completed"] is False


def test_patch_settings_persists_training_onboarding_answers(client, db_session, seeded):
    resp = client.patch(
        "/api/settings",
        json={
            "goal": "hypertrophy",
            "experience_level": "intermediate",
            "equipment": "home_gym",
            "training_days_per_week": 4,
            "session_length_min": 60,
            "training_split_preference": "upper_lower",
            "training_notes": "No burpees please",
            "recovery_check_in_method": "manual",
        },
    )
    assert resp.status_code == 200

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.goal == "hypertrophy"
    assert user.experience_level == "intermediate"
    assert user.equipment == "home_gym"
    assert user.training_days_per_week == 4
    assert user.session_length_min == 60
    assert user.training_split_preference == "upper_lower"
    assert user.training_notes == "No burpees please"
    assert user.recovery_check_in_method == "manual"


def test_complete_onboarding_logs_weight_computes_calories_and_flips_flag(client, db_session, seeded):
    db_session.query(models.User).get(DEMO_USER_ID).height_cm = 178
    db_session.commit()

    resp = client.post(
        "/api/onboarding/complete",
        json={
            "current_weight_kg": 80,
            "goal_weight_kg": 75,
            "goal_pace_key": "lose_1",
            "activity_level": "active",
            "sex": "male",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.onboarding_completed is True
    assert user.goal_weight_kg == 75
    assert user.goal_pace_key == "lose_1"
    assert user.activity_level == "active"
    assert user.sex == "male"
    assert user.daily_calorie_goal_kcal is not None and user.daily_calorie_goal_kcal > 0

    weight_entry = db_session.query(models.BodyMetric).filter_by(user_id=DEMO_USER_ID).first()
    assert weight_entry is not None
    assert weight_entry.weight_kg == 80


def test_complete_onboarding_falls_back_to_default_height_when_unset(client, db_session, seeded):
    # Body-profile onboarding always collects height, but the endpoint itself
    # shouldn't blow up if it's somehow still null (matches the existing
    # fallback in main.py's /api/settings/recalculate-calories).
    resp = client.post(
        "/api/onboarding/complete",
        json={
            "current_weight_kg": 65,
            "goal_weight_kg": 65,
            "goal_pace_key": "maintain",
            "activity_level": "sedentary",
            "sex": "female",
        },
    )
    assert resp.status_code == 200
    user = db_session.query(models.User).get(DEMO_USER_ID)
    assert user.daily_calorie_goal_kcal is not None and user.daily_calorie_goal_kcal > 0
