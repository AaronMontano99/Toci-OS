"""Smart Cart domain logic: a curated ingredient price/category catalog (no
live grocery-pricing API exists, free or paid, so these are hand-authored
U.S.-average estimates -- same approach as the restaurant/recipe seed data),
plus quick-action transforms. Mirrors nutrition.py/recipes.py's pattern of
isolating domain data+logic out of main.py.
"""

from sqlalchemy.orm import Session

from . import models

# {name: {"category", "unit" (the canonical pricing unit), "price_per_unit"}}
# Covers every distinct ingredient name used across the seeded recipe library
# (including substitution-only names like "Turkey Breast"), priced per the
# same unit already used on the matching RecipeIngredient rows so recipe
# quantities convert directly -- the one exception (Ground Turkey appears in
# both "lb" and "oz" across recipes) is handled by the weight conversion in
# price_for() below, not by adding more catalog entries.
INGREDIENT_CATALOG = {
    "Almond Milk, Unsweetened": {"category": "dairy", "unit": "cup", "price_per_unit": 0.35},
    "Asparagus": {"category": "produce", "unit": "cup", "price_per_unit": 2.00},
    "Avocado": {"category": "produce", "unit": "each", "price_per_unit": 1.25},
    "Banana": {"category": "fruit", "unit": "each", "price_per_unit": 0.25},
    "Bell Pepper": {"category": "produce", "unit": "cup", "price_per_unit": 0.90},
    "Broccoli": {"category": "produce", "unit": "cup", "price_per_unit": 0.75},
    "Brussels Sprouts": {"category": "produce", "unit": "cup", "price_per_unit": 1.10},
    "Butter": {"category": "dairy", "unit": "tbsp", "price_per_unit": 0.15},
    "Butter Lettuce": {"category": "produce", "unit": "leaf", "price_per_unit": 0.10},
    "Cabbage Slaw Mix": {"category": "produce", "unit": "cup", "price_per_unit": 0.60},
    "Carrot": {"category": "produce", "unit": "cup", "price_per_unit": 0.30},
    "Cherry Tomatoes": {"category": "produce", "unit": "cup", "price_per_unit": 1.50},
    "Chia Seeds": {"category": "pantry", "unit": "tbsp", "price_per_unit": 0.20},
    "Chicken Breast": {"category": "protein", "unit": "oz", "price_per_unit": 0.55},
    "Chickpeas, Canned": {"category": "pantry", "unit": "cup", "price_per_unit": 0.60},
    "Corn Tortillas": {"category": "carbs", "unit": "each", "price_per_unit": 0.20},
    "Cucumber": {"category": "produce", "unit": "cup", "price_per_unit": 0.45},
    "Diced Tomatoes, Canned": {"category": "pantry", "unit": "cup", "price_per_unit": 0.50},
    "Egg White": {"category": "protein", "unit": "cup", "price_per_unit": 1.20},
    "Egg, Large": {"category": "protein", "unit": "each", "price_per_unit": 0.30},
    "Fresh Mozzarella": {"category": "dairy", "unit": "oz", "price_per_unit": 0.90},
    "Granola": {"category": "snacks", "unit": "cup", "price_per_unit": 1.80},
    "Greek Yogurt, Plain Nonfat": {"category": "dairy", "unit": "cup", "price_per_unit": 1.40},
    "Green Beans": {"category": "produce", "unit": "cup", "price_per_unit": 0.70},
    "Ground Turkey, 93% Lean": {"category": "protein", "unit": "oz", "price_per_unit": 0.45},
    "Honey": {"category": "pantry", "unit": "tbsp", "price_per_unit": 0.30},
    "Kale": {"category": "produce", "unit": "cup", "price_per_unit": 0.85},
    "Kidney Beans, Canned": {"category": "pantry", "unit": "cup", "price_per_unit": 0.55},
    "Lentils, Dry": {"category": "pantry", "unit": "cup", "price_per_unit": 0.90},
    "Milk, 2%": {"category": "dairy", "unit": "cup", "price_per_unit": 0.45},
    "Mixed Berries": {"category": "fruit", "unit": "cup", "price_per_unit": 2.50},
    "Frozen Mixed Berries": {"category": "frozen", "unit": "cup", "price_per_unit": 1.20},
    "Mixed Vegetables": {"category": "frozen", "unit": "cup", "price_per_unit": 0.80},
    "Olive Oil": {"category": "fats", "unit": "tbsp", "price_per_unit": 0.25},
    "Onion": {"category": "produce", "unit": "cup", "price_per_unit": 0.35},
    "Peanut Butter": {"category": "pantry", "unit": "tbsp", "price_per_unit": 0.18},
    "Plant Protein Powder": {"category": "protein", "unit": "g", "price_per_unit": 0.09},
    "Quinoa, Cooked": {"category": "carbs", "unit": "cup", "price_per_unit": 0.90},
    "Rice Cakes": {"category": "snacks", "unit": "each", "price_per_unit": 0.20},
    "Rolled Oats, Dry": {"category": "carbs", "unit": "g", "price_per_unit": 0.01},
    "Salmon Fillet": {"category": "protein", "unit": "oz", "price_per_unit": 1.60},
    "Sesame Oil": {"category": "fats", "unit": "tbsp", "price_per_unit": 0.35},
    "Shrimp": {"category": "protein", "unit": "oz", "price_per_unit": 1.10},
    "Spinach": {"category": "produce", "unit": "cup", "price_per_unit": 0.55},
    "Steak": {"category": "protein", "unit": "oz", "price_per_unit": 1.30},
    "Sweet Potato, Baked": {"category": "carbs", "unit": "g", "price_per_unit": 0.006},
    "Tofu": {"category": "protein", "unit": "oz", "price_per_unit": 0.25},
    "Tomato": {"category": "produce", "unit": "cup", "price_per_unit": 0.70},
    "Turkey Breast": {"category": "protein", "unit": "oz", "price_per_unit": 0.60},
    "Whey Protein Powder": {"category": "protein", "unit": "g", "price_per_unit": 0.09},
    "White Rice, Cooked": {"category": "carbs", "unit": "cup", "price_per_unit": 0.35},
    "Whole-Grain Bread": {"category": "carbs", "unit": "slice", "price_per_unit": 0.30},
    "Zucchini": {"category": "produce", "unit": "cup", "price_per_unit": 0.55},
}

# a small hand-picked set of swaps that preserve nutrition while lowering
# cost, reusing catalog items that are already cheap -- powers "Reduce Cost"
COST_SWAPS = {
    "Salmon Fillet": "Tofu",
    "Steak": "Ground Turkey, 93% Lean",
    "Shrimp": "Chicken Breast",
    "Mixed Berries": "Frozen Mixed Berries",
}

SEAFOOD_NAMES = {"Salmon Fillet", "Shrimp"}

# only the weight-unit family needs conversion -- Ground Turkey is the one
# ingredient that appears in both "lb" and "oz" across the seeded recipes.
WEIGHT_UNITS_TO_OZ = {"oz": 1.0, "lb": 16.0, "g": 0.035274}


def categorize(name: str) -> str:
    entry = INGREDIENT_CATALOG.get(name)
    return entry["category"] if entry else "pantry"


def price_for(name: str, quantity: float, unit: str) -> float:
    entry = INGREDIENT_CATALOG.get(name)
    if not entry:
        return 0.0
    if unit == entry["unit"]:
        qty_in_catalog_units = quantity
    elif unit in WEIGHT_UNITS_TO_OZ and entry["unit"] in WEIGHT_UNITS_TO_OZ:
        qty_in_catalog_units = quantity * WEIGHT_UNITS_TO_OZ[unit] / WEIGHT_UNITS_TO_OZ[entry["unit"]]
    else:
        qty_in_catalog_units = quantity  # unrecognized unit pairing -- best effort, don't block on it
    return round(qty_in_catalog_units * entry["price_per_unit"], 2)


def item_dict(item: models.ShoppingListItem, pantry_names: set):
    return {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        "quantity": item.quantity,
        "unit": item.unit,
        "estimated_price": item.estimated_price,
        "purpose": item.purpose,
        "is_checked": item.is_checked,
        "source": item.source,
        "in_pantry": item.name in pantry_names,
    }


def list_shopping(db: Session, user_id: int):
    user = db.query(models.User).get(user_id)
    items = (
        db.query(models.ShoppingListItem)
        .filter_by(user_id=user_id)
        .order_by(models.ShoppingListItem.category, models.ShoppingListItem.name)
        .all()
    )
    pantry_names = {p.name for p in db.query(models.PantryItem).filter_by(user_id=user_id).all()}
    estimated_cost = round(sum(i.estimated_price for i in items), 2)
    return {
        "items": [item_dict(i, pantry_names) for i in items],
        "estimated_cost": estimated_cost,
        "budget": user.shopping_weekly_budget,
        "item_count": len(items),
        "household_size": user.household_size,
    }


def _merge_or_create(db: Session, user_id: int, name: str, unit: str, quantity: float, purpose: str, source: str, recipe_id):
    existing = (
        db.query(models.ShoppingListItem)
        .filter_by(user_id=user_id, name=name, unit=unit)
        .first()
    )
    if existing:
        existing.quantity = round(existing.quantity + quantity, 2)
        existing.estimated_price = price_for(name, existing.quantity, unit)
        if purpose and purpose not in (existing.purpose or ""):
            existing.purpose = (existing.purpose + "; " + purpose) if existing.purpose else purpose
        return existing
    item = models.ShoppingListItem(
        user_id=user_id, name=name, category=categorize(name), quantity=round(quantity, 2), unit=unit,
        estimated_price=price_for(name, quantity, unit), purpose=purpose, source=source, recipe_id=recipe_id,
    )
    db.add(item)
    return item


def add_manual_item(db: Session, user_id: int, name: str, quantity: float, unit: str, category: str = None):
    item = _merge_or_create(db, user_id, name, unit, quantity, purpose=None, source="manual", recipe_id=None)
    if category:
        item.category = category
    db.commit()
    db.refresh(item)
    return item


def add_from_recipe(db: Session, user_id: int, recipe: models.Recipe, multiplier: float):
    user = db.query(models.User).get(user_id)
    scale = multiplier * (user.household_size or 1)
    ingredients = db.query(models.RecipeIngredient).filter_by(recipe_id=recipe.id).all()
    for ing in ingredients:
        _merge_or_create(
            db, user_id, ing.name, ing.unit, ing.quantity * scale,
            purpose=f"Used for {recipe.name}", source="recipe", recipe_id=recipe.id,
        )
    db.commit()
    return len(ingredients)


def quick_action(db: Session, user_id: int, action: str):
    items = db.query(models.ShoppingListItem).filter_by(user_id=user_id).all()
    affected = 0

    if action == "clear_checked":
        for item in items:
            if item.is_checked:
                db.delete(item)
                affected += 1

    elif action == "remove_seafood":
        for item in items:
            if item.name in SEAFOOD_NAMES:
                db.delete(item)
                affected += 1

    elif action == "increase_protein":
        for item in items:
            if item.category == "protein":
                item.quantity = round(item.quantity * 1.25, 2)
                item.estimated_price = price_for(item.name, item.quantity, item.unit)
                affected += 1

    elif action == "reduce_cost":
        for item in items:
            swap_name = COST_SWAPS.get(item.name)
            if not swap_name:
                continue
            db.delete(item)
            _merge_or_create(
                db, user_id, swap_name, item.unit, item.quantity,
                purpose=item.purpose, source=item.source, recipe_id=item.recipe_id,
            )
            affected += 1

    db.commit()
    return affected
