"""Backend coverage for the Nutrition-tab phase: date-scoped logging, macro
math (including above-target and no-target states), the Smart Nutrition Plan
recommendation engine (forward-looking vs. retrospective, no-goal, allergy
filtering), recent-meals dedup, streak/longest-streak, copy-day, clear-day,
and the new input-validation rules.
"""
import datetime as dt

from toci import models, nutrition as nutrition_client
from toci.main import DEMO_USER_ID


def _add_food(db_session, name="Chicken Breast", calories=200, protein=30, carbs=0, fat=5):
    food = models.FoodItem(
        user_id=DEMO_USER_ID, source="custom", name=name,
        serving_qty=1, serving_unit="serving",
        calories=calories, protein_g=protein, carbs_g=carbs, fat_g=fat,
    )
    db_session.add(food)
    db_session.commit()  # must be visible to the API request's own DB session, not just flushed
    return food


def _log(db_session, food, date, servings=1.0, meal_slot="snack"):
    entry = models.FoodLogEntry(user_id=DEMO_USER_ID, food_item_id=food.id, date=date, servings=servings, meal_slot=meal_slot)
    db_session.add(entry)
    db_session.commit()
    return entry


# -------------------------------------------------------------- date scoping ----

def test_today_defaults_to_real_today(client, seeded):
    resp = client.get("/api/nutrition/today")
    assert resp.status_code == 200
    body = resp.json()
    assert body["date"] == seeded["today"].isoformat()
    assert body["is_today"] is True
    assert body["entries"] == []
    assert body["totals"]["calories"] == 0.0


def test_today_scoped_to_explicit_past_date(client, db_session, seeded):
    food = _add_food(db_session)
    yesterday = seeded["today"] - dt.timedelta(days=1)
    _log(db_session, food, yesterday, servings=2.0)

    resp_past = client.get(f"/api/nutrition/today?date={yesterday.isoformat()}")
    body = resp_past.json()
    assert body["is_today"] is False
    assert body["totals"]["calories"] == 400.0
    assert len(body["entries"]) == 1

    resp_today = client.get("/api/nutrition/today")
    assert resp_today.json()["totals"]["calories"] == 0.0


def test_invalid_date_param_returns_400(client, seeded):
    resp = client.get("/api/nutrition/today?date=not-a-date")
    assert resp.status_code == 400


# ------------------------------------------------------------------ macros ----

def test_macro_totals_can_exceed_target_without_capping(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.daily_calorie_goal_kcal = 500
    db_session.commit()
    food = _add_food(db_session, calories=900)
    _log(db_session, food, seeded["today"])

    resp = client.get("/api/nutrition/today")
    assert resp.json()["totals"]["calories"] == 900.0  # not clamped to the 500 target


def test_macro_targets_none_without_a_calorie_goal(db_session, seeded):
    assert nutrition_client.macro_targets(None) is None
    assert nutrition_client.macro_targets(0) is None


def test_macro_targets_follow_the_shared_split(db_session, seeded):
    targets = nutrition_client.macro_targets(2000)
    assert targets["calories"] == 2000
    assert targets["protein_g"] == round((2000 * 0.30) / 4, 1)
    assert targets["carbs_g"] == round((2000 * 0.40) / 4, 1)
    assert targets["fat_g"] == round((2000 * 0.30) / 9, 1)


def test_coaching_tense_switches_for_past_vs_today():
    today_msgs = nutrition_client.generate_coaching_messages({"calories": 1000, "protein_g": 0, "fiber_g": 0}, 2000, is_today=True)
    past_msgs = nutrition_client.generate_coaching_messages({"calories": 1000, "protein_g": 0, "fiber_g": 0}, 2000, is_today=False)
    assert "remaining today" in today_msgs[0]
    assert "finished" in past_msgs[0]
    assert "remaining today" not in past_msgs[0]


# -------------------------------------------------------------------- logging ----

def test_log_food_writes_to_the_requested_date(client, db_session, seeded):
    food = _add_food(db_session)
    target_date = seeded["today"] - dt.timedelta(days=3)

    resp = client.post("/api/nutrition/log", json={"food_item_id": food.id, "servings": 1.5, "meal_slot": "lunch", "date": target_date.isoformat()})
    assert resp.status_code == 200

    row = db_session.query(models.FoodLogEntry).filter_by(id=resp.json()["id"]).first()
    assert row.date == target_date
    assert row.servings == 1.5
    assert row.meal_slot == "lunch"


def test_edit_log_entry_servings(client, db_session, seeded):
    food = _add_food(db_session)
    entry = _log(db_session, food, seeded["today"], servings=1.0)

    resp = client.patch(f"/api/nutrition/log/{entry.id}", json={"servings": 3.0})
    assert resp.status_code == 200
    db_session.refresh(entry)
    assert entry.servings == 3.0


def test_delete_log_entry_updates_totals(client, db_session, seeded):
    food = _add_food(db_session, calories=300)
    entry = _log(db_session, food, seeded["today"])
    assert client.get("/api/nutrition/today").json()["totals"]["calories"] == 300.0

    resp = client.delete(f"/api/nutrition/log/{entry.id}")
    assert resp.status_code == 200
    assert client.get("/api/nutrition/today").json()["totals"]["calories"] == 0.0


def test_clear_day_only_removes_that_dates_entries(client, db_session, seeded):
    food = _add_food(db_session)
    today = seeded["today"]
    yesterday = today - dt.timedelta(days=1)
    _log(db_session, food, today)
    _log(db_session, food, yesterday)

    resp = client.delete(f"/api/nutrition/log?date={today.isoformat()}")
    assert resp.status_code == 200
    assert resp.json()["cleared"] == 1

    assert client.get("/api/nutrition/today").json()["entries"] == []
    assert len(client.get(f"/api/nutrition/today?date={yesterday.isoformat()}").json()["entries"]) == 1
    # the food item itself (catalog data) is untouched by clearing a day's log
    assert db_session.query(models.FoodItem).filter_by(id=food.id).first() is not None


def test_copy_day_writes_to_requested_target_date(client, db_session, seeded):
    food = _add_food(db_session)
    source_date = seeded["today"] - dt.timedelta(days=5)
    target_date = seeded["today"] + dt.timedelta(days=1)
    _log(db_session, food, source_date, meal_slot="breakfast")

    resp = client.post("/api/nutrition/copy", json={"from_date": source_date.isoformat(), "to_date": target_date.isoformat()})
    assert resp.status_code == 200
    assert resp.json()["copied"] == 1

    copied = client.get(f"/api/nutrition/today?date={target_date.isoformat()}").json()
    assert len(copied["entries"]) == 1
    assert copied["entries"][0]["meal_slot"] == "breakfast"


def test_copy_day_reports_zero_when_source_is_empty(client, seeded):
    resp = client.post("/api/nutrition/copy", json={"from_date": "2020-01-01"})
    assert resp.json()["copied"] == 0


# -------------------------------------------------------------------- validation ----

def test_negative_servings_rejected(client, db_session, seeded):
    food = _add_food(db_session)
    resp = client.post("/api/nutrition/log", json={"food_item_id": food.id, "servings": -1})
    assert resp.status_code == 422


def test_zero_servings_rejected_on_edit(client, db_session, seeded):
    food = _add_food(db_session)
    entry = _log(db_session, food, seeded["today"])
    resp = client.patch(f"/api/nutrition/log/{entry.id}", json={"servings": 0})
    assert resp.status_code == 422


def test_negative_calories_rejected_on_quick_add(client, seeded):
    resp = client.post("/api/nutrition/quick-add", json={"label": "Bad", "calories": -50})
    assert resp.status_code == 422


def test_zero_ounces_rejected_on_hydration(client, seeded):
    resp = client.post("/api/hydration/today", json={"ounces": 0})
    assert resp.status_code == 422


def test_valid_hydration_amount_accepted(client, seeded):
    resp = client.post("/api/hydration/today", json={"ounces": 12})
    assert resp.status_code == 200
    assert resp.json()["ounces"] == 12.0


# -------------------------------------------------------------- hydration dates ----

def test_hydration_is_date_scoped(client, seeded):
    today = seeded["today"]
    yesterday = (today - dt.timedelta(days=1)).isoformat()
    client.post("/api/hydration/today", json={"ounces": 16, "date": yesterday})

    assert client.get("/api/hydration/today").json()["ounces"] == 0.0
    assert client.get(f"/api/hydration/today?date={yesterday}").json()["ounces"] == 16.0


# ------------------------------------------------------------------ recent meals ----

def test_recent_meals_empty_state(client, seeded):
    assert client.get("/api/nutrition/recent-meals").json()["meals"] == []


def test_recent_meals_dedup_by_food_item_most_recent_wins(client, db_session, seeded):
    food = _add_food(db_session, name="Oatmeal")
    today = seeded["today"]
    _log(db_session, food, today - dt.timedelta(days=2), servings=1.0, meal_slot="breakfast")
    _log(db_session, food, today, servings=2.0, meal_slot="lunch")  # most recent instance of the same food

    meals = client.get("/api/nutrition/recent-meals").json()["meals"]
    assert len(meals) == 1  # deduplicated by food item, not one row per log entry
    assert meals[0]["servings"] == 2.0
    assert meals[0]["meal_slot"] == "lunch"


def test_recent_meals_orders_most_recently_logged_first(client, db_session, seeded):
    older = _add_food(db_session, name="Older Food")
    newer = _add_food(db_session, name="Newer Food")
    today = seeded["today"]
    _log(db_session, older, today - dt.timedelta(days=3))
    _log(db_session, newer, today)

    meals = client.get("/api/nutrition/recent-meals").json()["meals"]
    assert meals[0]["name"] == "Newer Food"


# --------------------------------------------------------------- recommendation ----

def _seed_recipe(db_session, name="Grilled Chicken Bowl", calories=500, protein=45, restriction_tags=None):
    recipe = models.Recipe(name=name, diet_tags=["high_protein"], calories=calories, protein_g=protein, carbs_g=40, fat_g=10, servings=1)
    db_session.add(recipe)
    db_session.flush()
    db_session.add(models.RecipeIngredient(
        recipe_id=recipe.id, name="Chicken Breast", quantity=1, unit="serving",
        calories=calories, protein_g=protein, carbs_g=40, fat_g=10,
        restriction_tags=restriction_tags or [], is_primary_protein=True,
    ))
    db_session.commit()
    return recipe


def test_recommendation_not_configured_without_calorie_goal(client, seeded):
    resp = client.get("/api/nutrition/recommendation")
    body = resp.json()
    assert body["configured"] is False
    assert body["recommendation"] is None
    assert "targets" in body["headline"].lower()


def test_recommendation_suggests_a_recipe_within_remaining_budget(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.daily_calorie_goal_kcal = 2000
    db_session.commit()
    _seed_recipe(db_session, name="Fits Budget", calories=400)
    _seed_recipe(db_session, name="Too Big", calories=1800)

    resp = client.get("/api/nutrition/recommendation")
    body = resp.json()
    assert body["configured"] is True
    assert body["recommendation"] is not None
    assert body["recommendation"]["calories"] <= 2000 * 1.25


def test_recommendation_respects_food_restrictions(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.daily_calorie_goal_kcal = 2000
    user.food_restrictions = ["shellfish"]
    db_session.commit()
    _seed_recipe(db_session, name="Shrimp Bowl", calories=400, restriction_tags=["shellfish"])
    safe = _seed_recipe(db_session, name="Chicken Bowl", calories=420)

    resp = client.get("/api/nutrition/recommendation")
    rec = resp.json()["recommendation"]
    assert rec is not None
    assert rec["id"] == safe.id  # the shellfish recipe must never be recommended to a restricted user


def test_recommendation_no_action_when_on_track(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.daily_calorie_goal_kcal = 500
    db_session.commit()
    food = _add_food(db_session, calories=480)
    _log(db_session, food, seeded["today"])

    resp = client.get("/api/nutrition/recommendation")
    body = resp.json()
    assert body["recommendation"] is None
    assert "track" in body["headline"].lower()


def test_recommendation_is_retrospective_only_for_past_dates(client, db_session, seeded):
    user = db_session.query(models.User).get(DEMO_USER_ID)
    user.daily_calorie_goal_kcal = 2000
    db_session.commit()
    _seed_recipe(db_session, calories=400)
    past_date = seeded["today"] - dt.timedelta(days=2)

    resp = client.get(f"/api/nutrition/recommendation?date={past_date.isoformat()}")
    body = resp.json()
    assert body["recommendation"] is None  # never suggest "what to eat next" for a day that's over
    assert "finished" in body["headline"].lower()


# --------------------------------------------------------------------- streak ----

def test_streak_current_vs_longest(client, db_session, seeded):
    food = _add_food(db_session)
    today = seeded["today"]
    # a 2-day streak ending yesterday (broken), then today logged alone
    _log(db_session, food, today - dt.timedelta(days=5))
    _log(db_session, food, today - dt.timedelta(days=4))
    _log(db_session, food, today)

    body = client.get("/api/nutrition/today").json()
    assert body["logging_streak"] == 1  # only today is consecutive up to "today"
    assert body["longest_streak"] == 2  # the earlier 2-day run is still the longest


def test_streak_is_not_affected_by_browsing_a_different_date(client, db_session, seeded):
    food = _add_food(db_session)
    today = seeded["today"]
    _log(db_session, food, today)

    resp = client.get(f"/api/nutrition/today?date={(today - dt.timedelta(days=10)).isoformat()}")
    # streak always reflects real "today", regardless of which date is being viewed
    assert resp.json()["logging_streak"] == 1
