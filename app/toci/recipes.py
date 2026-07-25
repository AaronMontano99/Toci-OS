"""Recipe Hub domain logic: diet/restriction filtering, rule-based "recommended
for you" signals, ingredient substitution, macro-fitting, and one-tap logging.
Mirrors nutrition.py's pattern of isolating domain logic out of main.py.
"""

import datetime as dt

from sqlalchemy.orm import Session

from . import engine as reco_engine
from . import models, nutrition

CATEGORY_LABELS = {
    "high_protein": "High Protein",
    "mediterranean": "Mediterranean",
    "pescatarian": "Pescatarian",
    "keto": "Keto",
    "vegan": "Vegan",
    "fat_loss": "Fat Loss",
    "muscle_gain": "Muscle Gain",
    "pre_workout": "Pre-Workout",
    "post_workout": "Post-Workout",
    "breakfast": "Breakfast",
    "lunch": "Lunch",
    "dinner": "Dinner",
    "meal_prep": "Meal Prep",
    "quick_15min": "15-Minute Meals",
    "beginner_friendly": "Beginner Friendly",
}

FIT_MACROS_MIN_FACTOR = 0.25
FIT_MACROS_MAX_FACTOR = 3.0


def recipe_summary_dict(recipe: models.Recipe):
    return {
        "id": recipe.id,
        "name": recipe.name,
        "diet_tags": recipe.diet_tags,
        "calories": recipe.calories,
        "protein_g": recipe.protein_g,
        "carbs_g": recipe.carbs_g,
        "fat_g": recipe.fat_g,
        "fiber_g": recipe.fiber_g,
        "prep_minutes": recipe.prep_minutes,
        "cook_minutes": recipe.cook_minutes,
        "difficulty": recipe.difficulty,
        "servings": recipe.servings,
        "icon_emoji": recipe.icon_emoji,
        "gradient_key": recipe.gradient_key,
    }


def ingredient_dict(ing: models.RecipeIngredient):
    return {
        "id": ing.id,
        "name": ing.name,
        "quantity": ing.quantity,
        "unit": ing.unit,
        "calories": ing.calories,
        "protein_g": ing.protein_g,
        "carbs_g": ing.carbs_g,
        "fat_g": ing.fat_g,
        "is_primary_protein": ing.is_primary_protein,
        "substitutions": ing.substitutions,
    }


def recipe_detail_dict(db: Session, recipe: models.Recipe):
    ingredients = db.query(models.RecipeIngredient).filter_by(recipe_id=recipe.id).all()
    out = recipe_summary_dict(recipe)
    out["instructions"] = recipe.instructions
    out["ingredients"] = [ingredient_dict(i) for i in ingredients]
    return out


def _is_excluded(db: Session, recipe: models.Recipe, food_restrictions: list):
    if not food_restrictions:
        return False
    restrict_set = set(food_restrictions)
    ingredients = db.query(models.RecipeIngredient).filter_by(recipe_id=recipe.id).all()
    return any(restrict_set.intersection(i.restriction_tags or []) for i in ingredients)


def list_recipes(db: Session, user: models.User, category: str = None):
    # The recipe library is small (dozens of rows), so filtering/ranking on
    # diet_tags happens in Python rather than a JSON-containment DB query.
    all_recipes = db.query(models.Recipe).all()
    if category:
        all_recipes = [r for r in all_recipes if category in (r.diet_tags or [])]
    recipes = [r for r in all_recipes if not _is_excluded(db, r, user.food_restrictions or [])]
    preferences = set(user.dietary_preferences or [])
    recipes.sort(key=lambda r: (0 if preferences.intersection(r.diet_tags or []) else 1, r.name))
    return recipes


def list_categories(db: Session, user: models.User):
    available = []
    for key, label in CATEGORY_LABELS.items():
        if list_recipes(db, user, category=key):
            available.append({"key": key, "label": label})
    return available


def _protein_target_g(goal_kcal):
    if not goal_kcal:
        return None
    return (goal_kcal * nutrition.MACRO_SPLIT["protein"]) / nutrition.PROTEIN_KCAL_PER_G


def get_recommended(db: Session, user_id: int):
    user = db.query(models.User).get(user_id)
    today = dt.date.today()
    restrictions = user.food_restrictions or []
    all_recipes = [r for r in db.query(models.Recipe).all() if not _is_excluded(db, r, restrictions)]
    by_tag = {}
    for r in all_recipes:
        for tag in r.diet_tags or []:
            by_tag.setdefault(tag, []).append(r)

    picks = []  # list of (recipe, why)
    picked_ids = set()

    def add(candidates, why):
        for r in sorted(candidates, key=lambda x: -x.protein_g):
            if r.id not in picked_ids:
                picks.append((r, why))
                picked_ids.add(r.id)
                return

    # signal 1: today's protein gap
    summary = nutrition.today_summary(db, user_id, today)
    target = _protein_target_g(user.daily_calorie_goal_kcal)
    if target:
        gap = target - summary["totals"]["protein_g"]
        if gap > 15 and by_tag.get("high_protein"):
            add(by_tag["high_protein"], f"You're {round(gap)}g short on protein today.")

    # signal 2: tomorrow's scheduled training day
    program = db.query(models.Program).filter_by(user_id=user_id, status="active").first()
    if program:
        meso = (
            db.query(models.Mesocycle)
            .filter_by(program_id=program.id)
            .order_by(models.Mesocycle.index.desc())
            .first()
        )
        if meso:
            tomorrow_weekday = (today.weekday() + 1) % 7
            tomorrow_day = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, weekday=tomorrow_weekday).first()
            if tomorrow_day and tomorrow_day.day_type == "lift" and by_tag.get("muscle_gain"):
                add(by_tag["muscle_gain"], f"Tomorrow is {tomorrow_day.label} — extra carbohydrate to fuel training.")

    # signal 3: low readiness today
    readiness = db.query(models.ReadinessScore).filter_by(user_id=user_id, date=today).first()
    if not readiness:
        readiness = reco_engine.compute_readiness(db, user_id, today)
    if readiness and readiness.band == "red" and by_tag.get("recovery"):
        add(by_tag["recovery"], "Recovery is lower than usual today — this meal emphasizes anti-inflammatory, nutrient-dense foods.")

    # fallback: user's top dietary preference
    for pref in user.dietary_preferences or []:
        if len(picks) >= 3:
            break
        if by_tag.get(pref):
            add(by_tag[pref], f"Matches your {CATEGORY_LABELS.get(pref, pref.replace('_', ' ').title())} preference.")

    # backfill with top overall recipes so there's always something to show
    for r in all_recipes:
        if len(picks) >= 5:
            break
        if r.id not in picked_ids:
            picks.append((r, "A well-rounded pick for your goals."))
            picked_ids.add(r.id)

    return [{**recipe_summary_dict(r), "why": why} for r, why in picks[:5]]


def fit_macros(db: Session, recipe: models.Recipe, target_protein_g: float):
    ingredients = db.query(models.RecipeIngredient).filter_by(recipe_id=recipe.id).all()
    primary = next((i for i in ingredients if i.is_primary_protein), None)
    if not primary:
        return None

    # Whole-batch totals from the ingredient rows (not Recipe.protein_g, which
    # is stored per-serving for display -- see seed.py).
    batch_totals = {key: sum(getattr(i, key) for i in ingredients) for key in ("calories", "protein_g", "carbs_g", "fat_g")}

    other_protein_per_serving = (batch_totals["protein_g"] - primary.protein_g) / recipe.servings
    primary_protein_per_serving = primary.protein_g / recipe.servings
    if primary_protein_per_serving <= 0:
        return None

    factor = (target_protein_g - other_protein_per_serving) / primary_protein_per_serving
    factor = max(FIT_MACROS_MIN_FACTOR, min(FIT_MACROS_MAX_FACTOR, factor))

    new_quantity = round(primary.quantity * factor, 2)
    new_totals = {}
    for key in ("calories", "protein_g", "carbs_g", "fat_g"):
        primary_val = getattr(primary, key)
        other_val = batch_totals[key] - primary_val
        new_totals[key] = round((other_val + primary_val * factor) / recipe.servings, 1)

    return {
        "ingredient_id": primary.id,
        "ingredient_name": primary.name,
        "old_quantity": primary.quantity,
        "new_quantity": new_quantity,
        "unit": primary.unit,
        "per_serving_totals": new_totals,
    }


def compute_logged_macros(db: Session, recipe: models.Recipe, overrides: list):
    """overrides: [{"ingredient_id", "alt_name": optional, "quantity": optional}].
    Returns per-serving macros (recipe totals / recipe.servings) with any
    substitutions/quantity scaling applied."""
    ingredients = db.query(models.RecipeIngredient).filter_by(recipe_id=recipe.id).all()
    override_by_id = {o["ingredient_id"]: o for o in overrides}

    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    for ing in ingredients:
        override = override_by_id.get(ing.id)
        macro_source = {"calories": ing.calories, "protein_g": ing.protein_g, "carbs_g": ing.carbs_g, "fat_g": ing.fat_g}
        if override and override.get("alt_name"):
            match = next((s for s in ing.substitutions if s["name"] == override["alt_name"]), None)
            if match:
                macro_source = match
        base_qty = ing.quantity or 1.0
        effective_qty = override["quantity"] if override and override.get("quantity") else base_qty
        scale = effective_qty / base_qty
        for key in totals:
            totals[key] += macro_source[key] * scale

    return {key: round(value / recipe.servings, 1) for key, value in totals.items()}
