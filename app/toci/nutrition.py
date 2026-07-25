"""Barcode nutrition lookups against Open Food Facts (free, no API key) plus
saved-meal expansion and daily-totals shaping. Mirrors spotify.py's pattern of
isolating third-party API logic out of main.py and returning JSON-ready dicts.
"""

import datetime as dt
import re

import httpx
from sqlalchemy.orm import Session

from . import models

OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"


def _serving_grams(serving_size: str):
    """Returns (quantity, unit) parsed from a string like "30 g" or "330ml", or (None, None)."""
    if not serving_size:
        return None, None
    match = re.search(r"([\d.]+)\s*(g|ml)\b", serving_size, re.IGNORECASE)
    if not match:
        return None, None
    return float(match.group(1)), match.group(2).lower()


def _nutrient(nutriments: dict, key: str, serving_grams):
    per_serving = nutriments.get(key + "_serving")
    if per_serving is not None:
        return float(per_serving)
    per_100g = nutriments.get(key + "_100g")
    if per_100g is not None and serving_grams:
        return float(per_100g) * serving_grams / 100.0
    return 0.0


def fetch_off_product(barcode: str):
    """Parsed product fields from Open Food Facts, or None if not found / unusable."""
    try:
        resp = httpx.get(OFF_PRODUCT_URL.format(barcode=barcode), timeout=10)
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    data = resp.json()
    if data.get("status") != 1:
        return None
    product = data.get("product") or {}
    name = product.get("product_name") or product.get("generic_name")
    if not name:
        return None

    serving_size = product.get("serving_size") or ""
    serving_grams, serving_unit = _serving_grams(serving_size)
    # Most OFF products only carry per-100g data, not a declared serving size --
    # fall back to reporting per 100g as "the serving" rather than failing.
    effective_grams = serving_grams or 100.0
    nutriments = product.get("nutriments") or {}
    calories = _nutrient(nutriments, "energy-kcal", effective_grams)
    if not calories:
        return None  # no usable energy data at all -- not worth caching

    # OFF reports sodium in grams (sodium_100g/sodium_serving), not mg -- convert.
    sodium_g = _nutrient(nutriments, "sodium", effective_grams)

    return {
        "name": name,
        "brand": (product.get("brands") or "").split(",")[0].strip() or None,
        "serving_qty": serving_grams or 100.0,
        "serving_unit": serving_unit or "g",
        "calories": round(calories, 1),
        "protein_g": round(_nutrient(nutriments, "proteins", effective_grams), 1),
        "carbs_g": round(_nutrient(nutriments, "carbohydrates", effective_grams), 1),
        "fat_g": round(_nutrient(nutriments, "fat", effective_grams), 1),
        "fiber_g": round(_nutrient(nutriments, "fiber", effective_grams), 1),
        "sugar_g": round(_nutrient(nutriments, "sugars", effective_grams), 1),
        "sodium_mg": round(sodium_g * 1000, 1),
    }


def lookup_barcode(db: Session, user_id: int, barcode: str):
    cached = db.query(models.FoodItem).filter_by(user_id=user_id, barcode=barcode).first()
    if cached:
        return cached

    parsed = fetch_off_product(barcode)
    if not parsed:
        return None

    item = models.FoodItem(user_id=user_id, barcode=barcode, source="barcode", **parsed)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def food_dict(food: models.FoodItem):
    return {
        "id": food.id,
        "name": food.name,
        "brand": food.brand,
        "serving_qty": food.serving_qty,
        "serving_unit": food.serving_unit,
        "calories": food.calories,
        "protein_g": food.protein_g,
        "carbs_g": food.carbs_g,
        "fat_g": food.fat_g,
        "fiber_g": food.fiber_g,
        "sugar_g": food.sugar_g,
        "sodium_mg": food.sodium_mg,
        "source": food.source,
        "barcode": food.barcode,
        "restaurant": food.restaurant,
        "is_favorite": food.is_favorite,
    }


def today_summary(db: Session, user_id: int, date: dt.date):
    rows = (
        db.query(models.FoodLogEntry, models.FoodItem)
        .join(models.FoodItem, models.FoodLogEntry.food_item_id == models.FoodItem.id)
        .filter(models.FoodLogEntry.user_id == user_id, models.FoodLogEntry.date == date)
        .order_by(models.FoodLogEntry.logged_at)
        .all()
    )
    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fiber_g": 0.0, "sugar_g": 0.0, "sodium_mg": 0.0}
    entries = []
    for entry, food in rows:
        scale = entry.servings
        row = {
            "calories": round(food.calories * scale, 1),
            "protein_g": round(food.protein_g * scale, 1),
            "carbs_g": round(food.carbs_g * scale, 1),
            "fat_g": round(food.fat_g * scale, 1),
            "fiber_g": round(food.fiber_g * scale, 1),
            "sugar_g": round(food.sugar_g * scale, 1),
            "sodium_mg": round(food.sodium_mg * scale, 1),
        }
        for key, value in row.items():
            totals[key] += value
        entries.append({
            "id": entry.id,
            "food_item_id": food.id,
            "name": food.name,
            "brand": food.brand,
            "servings": entry.servings,
            "serving_qty": food.serving_qty,
            "serving_unit": food.serving_unit,
            "meal_slot": entry.meal_slot,
            "notes": entry.notes,
            **row,
        })
    return {
        "date": date.isoformat(),
        "entries": entries,
        "totals": {k: round(v, 1) for k, v in totals.items()},
    }


# Rule-based coaching, matching engine.py's deterministic, transparent style --
# not an LLM call. A macro split (protein/carbs/fat as a % of the calorie goal)
# derived from the goal itself, since this app has no separate macro-target field.
MACRO_SPLIT = {"protein": 0.30, "carbs": 0.40, "fat": 0.30}
PROTEIN_KCAL_PER_G = 4
CARBS_KCAL_PER_G = 4
FAT_KCAL_PER_G = 9
FIBER_TARGET_G = 30


def generate_coaching_messages(totals: dict, goal_kcal: float | None):
    if not goal_kcal:
        return []

    messages = []
    remaining = goal_kcal - totals["calories"]
    if remaining < -50:
        messages.append(f"You've exceeded your calorie goal by {abs(round(remaining))} calories today.")
    elif remaining < 100:
        messages.append(f"Only {max(0, round(remaining))} calories remaining today — plan your next meal accordingly.")
    else:
        messages.append(f"{round(remaining)} calories remaining today.")

    protein_target_g = (goal_kcal * MACRO_SPLIT["protein"]) / PROTEIN_KCAL_PER_G
    protein_gap = protein_target_g - totals["protein_g"]
    if protein_gap > 15:
        messages.append(f"You're {round(protein_gap)}g short on protein — prioritize a lean protein source.")

    if totals["fiber_g"] < FIBER_TARGET_G * 0.5 and totals["calories"] > 300:
        messages.append("Fiber is low today — consider fruit or vegetables with your next meal.")

    return messages


def list_saved_meals(db: Session, user_id: int):
    meals = (
        db.query(models.SavedMeal)
        .filter_by(user_id=user_id)
        .order_by(models.SavedMeal.created_at.desc())
        .all()
    )
    result = []
    for meal in meals:
        items = (
            db.query(models.SavedMealItem, models.FoodItem)
            .join(models.FoodItem, models.SavedMealItem.food_item_id == models.FoodItem.id)
            .filter(models.SavedMealItem.saved_meal_id == meal.id)
            .all()
        )
        total_calories = round(sum(food.calories * item.servings for item, food in items), 1)
        result.append({
            "id": meal.id,
            "name": meal.name,
            "total_calories": total_calories,
            "items": [
                {"food_item_id": food.id, "name": food.name, "servings": item.servings}
                for item, food in items
            ],
        })
    return result


def log_saved_meal(db: Session, user_id: int, meal: models.SavedMeal, multiplier: float, date: dt.date):
    items = db.query(models.SavedMealItem).filter_by(saved_meal_id=meal.id).all()
    created = []
    for item in items:
        entry = models.FoodLogEntry(
            user_id=user_id,
            food_item_id=item.food_item_id,
            date=date,
            servings=item.servings * multiplier,
        )
        db.add(entry)
        created.append(entry)
        food = db.query(models.FoodItem).get(item.food_item_id)
        if food:
            food.use_count += 1
            food.last_used_at = dt.datetime.utcnow()
    db.commit()
    for entry in created:
        db.refresh(entry)
    return created


# Standard Mifflin-St Jeor BMR -> TDEE -> goal-pace-adjusted daily calorie target.
# Deliberately simple and transparent (no ML), matching engine.py's rule-based style.

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "lightly_active": 1.375,
    "active": 1.55,
    "very_active": 1.725,
}

# kcal/day adjustment, derived from ~3500 kcal per lb spread over 7 days
GOAL_PACE_KCAL_ADJUSTMENT = {
    "lose_2": -1000,
    "lose_1_5": -750,
    "lose_1": -500,
    "lose_0_5": -250,
    "maintain": 0,
    "gain_0_5": 250,
    "gain_1": 500,
}


def compute_calorie_goal(sex: str, weight_kg: float, height_cm: float, age: int, activity_level: str, goal_pace_key: str) -> float:
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age
    bmr += 5 if sex == "male" else -161
    tdee = bmr * ACTIVITY_MULTIPLIERS.get(activity_level, 1.2)
    adjustment = GOAL_PACE_KCAL_ADJUSTMENT.get(goal_pace_key, 0)
    return round(tdee + adjustment)
