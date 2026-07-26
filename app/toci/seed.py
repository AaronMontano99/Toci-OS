"""Seed demo data: one user, an exercise library, an active hypertrophy
program, two weeks of simulated recovery history, and a few past bench/squat
sessions so progression and the progress chart have real history to work from.
Safe to re-run — it's a no-op once a user already exists (use --reset to wipe)."""

import argparse
import datetime as dt
import random

from .database import Base, SessionLocal, engine
from . import models, nutrition


def seed_recipes(db):
    """Insert the curated recipe library if it isn't already present. Safe to call standalone
    against an already-seeded DB (unlike seed(), which early-returns once a user exists)."""
    if db.query(models.Recipe).first():
        return
    # a curated recipe library spanning the diet styles/goals/meal-timing
    # categories the Recipe Hub browses by -- real, simple, home-cookable
    # meals with realistic macros, not a generated/AI recipe database.
    # Ingredient restriction_tags use the same vocabulary as the Settings
    # food-restriction chips: shellfish, peanuts, dairy, gluten, eggs, pork, beef.
    def ing(name, qty, unit, cal, p, c, f, restrict=None, primary=False, subs=None):
        return {
            "name": name, "quantity": qty, "unit": unit,
            "calories": cal, "protein_g": p, "carbs_g": c, "fat_g": f,
            "restriction_tags": restrict or [], "is_primary_protein": primary,
            "substitutions": subs or [],
        }

    recipe_defs = [
        dict(
            name="Grilled Chicken Rice Bowl", tags=["high_protein", "muscle_gain", "dinner", "gluten_free"],
            icon="🍗", gradient="1", difficulty="easy", prep=10, cook=15, servings=1,
            instructions=[
                "Season chicken breast with salt, pepper, and a pinch of garlic powder.",
                "Grill or pan-sear over medium-high heat, about 6 minutes per side, until 165°F internal.",
                "Steam the broccoli for 4-5 minutes until bright green and tender-crisp.",
                "Slice the chicken and serve over rice with broccoli on the side.",
            ],
            ingredients=[
                ing("Chicken Breast", 6, "oz", 280, 53.0, 0.0, 6.0, primary=True, subs=[
                    {"name": "Turkey Breast", "calories": 270, "protein_g": 50.0, "carbs_g": 0.0, "fat_g": 5.0, "restriction_tags": []},
                    {"name": "Tofu", "calories": 180, "protein_g": 20.0, "carbs_g": 4.0, "fat_g": 10.0, "restriction_tags": []},
                    {"name": "Shrimp", "calories": 180, "protein_g": 34.0, "carbs_g": 2.0, "fat_g": 2.0, "restriction_tags": ["shellfish"]},
                ]),
                ing("White Rice, Cooked", 1, "cup", 205, 4.3, 44.5, 0.4),
                ing("Broccoli", 1, "cup", 55, 3.7, 11.0, 0.6),
            ],
        ),
        dict(
            name="Salmon Sweet Potato Bowl", tags=["pescatarian", "post_workout", "dinner", "gluten_free"],
            icon="🐟", gradient="2", difficulty="easy", prep=10, cook=20, servings=1,
            instructions=[
                "Roast sweet potato cubes at 425°F for 20 minutes, tossed in olive oil.",
                "Season salmon with salt, pepper, and lemon; bake or air-fry at 400°F for 12-14 minutes.",
                "Plate the salmon over sweet potato with a handful of spinach.",
            ],
            ingredients=[
                ing("Salmon Fillet", 6, "oz", 350, 34.0, 0.0, 22.0, primary=True, subs=[
                    {"name": "Chicken Breast", "calories": 280, "protein_g": 53.0, "carbs_g": 0.0, "fat_g": 6.0, "restriction_tags": []},
                    {"name": "Tofu", "calories": 180, "protein_g": 20.0, "carbs_g": 4.0, "fat_g": 10.0, "restriction_tags": []},
                    {"name": "Shrimp", "calories": 180, "protein_g": 34.0, "carbs_g": 2.0, "fat_g": 2.0, "restriction_tags": ["shellfish"]},
                    {"name": "Steak", "calories": 340, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 18.0, "restriction_tags": ["beef"]},
                ]),
                ing("Sweet Potato, Baked", 200, "g", 180, 4.0, 41.0, 0.3),
                ing("Spinach", 1, "cup", 7, 0.9, 1.1, 0.1),
            ],
        ),
        dict(
            name="Anti-Inflammatory Salmon Bowl", tags=["pescatarian", "recovery", "dinner", "gluten_free"],
            icon="🐟", gradient="2", difficulty="easy", prep=10, cook=15, servings=1,
            instructions=[
                "Bake salmon at 400°F for 12-14 minutes with turmeric, black pepper, and olive oil.",
                "Massage kale with olive oil and lemon juice until slightly wilted.",
                "Combine with avocado and a scoop of quinoa; top with the salmon.",
            ],
            ingredients=[
                ing("Salmon Fillet", 5, "oz", 290, 28.0, 0.0, 18.0, primary=True),
                ing("Kale", 1, "cup", 33, 2.2, 6.0, 0.5),
                ing("Avocado", 0.5, "each", 120, 1.5, 6.0, 11.0),
                ing("Quinoa, Cooked", 0.5, "cup", 111, 4.0, 20.0, 1.8),
            ],
        ),
        dict(
            name="Mediterranean Chickpea Salad", tags=["mediterranean", "vegan", "vegetarian", "lunch", "gluten_free", "dairy_free"],
            icon="🥗", gradient="3", difficulty="easy", prep=15, cook=0, servings=2,
            instructions=[
                "Drain and rinse chickpeas; combine with diced cucumber, tomato, and red onion.",
                "Whisk olive oil, lemon juice, oregano, salt, and pepper for the dressing.",
                "Toss everything together and chill 10 minutes before serving.",
            ],
            ingredients=[
                ing("Chickpeas, Canned", 1, "cup", 210, 11.0, 35.0, 3.5, primary=True),
                ing("Cucumber", 1, "cup", 16, 0.7, 3.8, 0.1),
                ing("Tomato", 1, "cup", 32, 1.6, 7.0, 0.4),
                ing("Olive Oil", 1, "tbsp", 119, 0.0, 0.0, 13.5),
            ],
        ),
        dict(
            name="Mediterranean Grilled Salmon", tags=["mediterranean", "pescatarian", "dinner", "gluten_free", "dairy_free"],
            icon="🐟", gradient="2", difficulty="medium", prep=10, cook=15, servings=1,
            instructions=[
                "Marinate salmon in olive oil, lemon, garlic, and oregano for 10 minutes.",
                "Grill 4-5 minutes per side.",
                "Serve with a side of roasted zucchini and cherry tomatoes.",
            ],
            ingredients=[
                ing("Salmon Fillet", 6, "oz", 350, 34.0, 0.0, 22.0, primary=True),
                ing("Zucchini", 1, "cup", 20, 1.5, 4.0, 0.2),
                ing("Cherry Tomatoes", 0.5, "cup", 15, 0.7, 3.3, 0.2),
                ing("Olive Oil", 1, "tbsp", 119, 0.0, 0.0, 13.5),
            ],
        ),
        dict(
            name="Caprese Chicken", tags=["mediterranean", "high_protein", "dinner", "gluten_free"],
            icon="🍅", gradient="3", difficulty="easy", prep=10, cook=18, servings=1,
            instructions=[
                "Season chicken breast and bake at 375°F for 20 minutes.",
                "Top with fresh mozzarella and sliced tomato for the last 5 minutes.",
                "Finish with fresh basil and a balsamic drizzle.",
            ],
            ingredients=[
                ing("Chicken Breast", 6, "oz", 280, 53.0, 0.0, 6.0, primary=True),
                ing("Fresh Mozzarella", 1, "oz", 85, 6.3, 0.6, 6.3, restrict=["dairy"]),
                ing("Tomato", 0.5, "cup", 16, 0.8, 3.5, 0.2),
            ],
        ),
        dict(
            name="Turkey Chili", tags=["high_protein", "fat_loss", "dinner", "gluten_free", "dairy_free", "meal_prep"],
            icon="🌶️", gradient="4", difficulty="easy", prep=10, cook=30, servings=4,
            instructions=[
                "Brown ground turkey in a large pot over medium-high heat.",
                "Add diced tomatoes, kidney beans, onion, and chili spices.",
                "Simmer uncovered for 25-30 minutes, stirring occasionally.",
            ],
            ingredients=[
                ing("Ground Turkey, 93% Lean", 1, "lb", 640, 92.0, 0.0, 28.0, primary=True),
                ing("Kidney Beans, Canned", 2, "cup", 450, 30.0, 82.0, 1.6),
                ing("Diced Tomatoes, Canned", 2, "cup", 100, 4.0, 22.0, 0.6),
                ing("Onion", 1, "cup", 64, 1.8, 15.0, 0.2),
            ],
        ),
        dict(
            name="Meal Prep Ground Turkey Bowls", tags=["meal_prep", "high_protein", "fat_loss", "gluten_free", "dairy_free"],
            icon="🍱", gradient="4", difficulty="easy", prep=15, cook=20, servings=4,
            instructions=[
                "Brown ground turkey with taco seasoning.",
                "Cook rice according to package directions.",
                "Roast bell peppers and onions at 425°F for 15 minutes.",
                "Divide turkey, rice, and peppers evenly across 4 containers.",
            ],
            ingredients=[
                ing("Ground Turkey, 93% Lean", 1, "lb", 640, 92.0, 0.0, 28.0, primary=True),
                ing("White Rice, Cooked", 2, "cup", 410, 8.6, 89.0, 0.8),
                ing("Bell Pepper", 2, "cup", 60, 2.0, 14.0, 0.6),
            ],
        ),
        dict(
            name="Keto Salmon & Asparagus", tags=["keto", "pescatarian", "dinner", "low_carb", "gluten_free"],
            icon="🐟", gradient="2", difficulty="easy", prep=5, cook=15, servings=1,
            instructions=[
                "Season salmon with salt, pepper, and butter.",
                "Roast salmon and asparagus together at 400°F for 12-14 minutes.",
            ],
            ingredients=[
                ing("Salmon Fillet", 6, "oz", 350, 34.0, 0.0, 22.0, primary=True),
                ing("Asparagus", 1, "cup", 27, 3.0, 5.2, 0.2),
                ing("Butter", 1, "tbsp", 102, 0.1, 0.0, 11.5, restrict=["dairy"]),
            ],
        ),
        dict(
            name="Keto Beef & Broccoli Stir Fry", tags=["keto", "low_carb", "dinner", "gluten_free", "dairy_free"],
            icon="🥩", gradient="5", difficulty="medium", prep=10, cook=15, servings=1,
            instructions=[
                "Slice steak thin against the grain.",
                "Sear steak in a hot pan for 2-3 minutes.",
                "Add broccoli and a splash of coconut aminos; stir-fry 4-5 minutes.",
            ],
            ingredients=[
                ing("Steak", 6, "oz", 340, 42.0, 0.0, 18.0, primary=True, restrict=["beef"]),
                ing("Broccoli", 1.5, "cup", 82, 5.6, 16.5, 0.9),
                ing("Sesame Oil", 1, "tbsp", 120, 0.0, 0.0, 13.6),
            ],
        ),
        dict(
            name="Paleo Steak & Veggies", tags=["paleo", "keto", "dinner", "gluten_free", "dairy_free", "low_carb"],
            icon="🥩", gradient="5", difficulty="easy", prep=10, cook=15, servings=1,
            instructions=[
                "Season steak with salt and pepper; sear 3-4 minutes per side.",
                "Roast Brussels sprouts at 425°F for 20 minutes.",
                "Rest the steak 5 minutes before slicing.",
            ],
            ingredients=[
                ing("Steak", 6, "oz", 340, 42.0, 0.0, 18.0, primary=True, restrict=["beef"]),
                ing("Brussels Sprouts", 1.5, "cup", 84, 6.0, 16.5, 0.5),
                ing("Olive Oil", 1, "tbsp", 119, 0.0, 0.0, 13.5),
            ],
        ),
        dict(
            name="Vegan Buddha Bowl", tags=["vegan", "vegetarian", "lunch", "gluten_free", "dairy_free"],
            icon="🥑", gradient="6", difficulty="easy", prep=15, cook=20, servings=1,
            instructions=[
                "Roast chickpeas tossed in olive oil and cumin at 400°F for 20 minutes.",
                "Cook quinoa according to package directions.",
                "Assemble quinoa, roasted chickpeas, avocado, and shredded carrot.",
            ],
            ingredients=[
                ing("Chickpeas, Canned", 1, "cup", 210, 11.0, 35.0, 3.5, primary=True),
                ing("Quinoa, Cooked", 1, "cup", 222, 8.1, 39.4, 3.6),
                ing("Avocado", 0.5, "each", 120, 1.5, 6.0, 11.0),
                ing("Carrot", 0.5, "cup", 26, 0.6, 6.0, 0.1),
            ],
        ),
        dict(
            name="Tofu Veggie Stir Fry", tags=["vegan", "vegetarian", "dinner", "low_carb", "dairy_free"],
            icon="🌱", gradient="6", difficulty="easy", prep=10, cook=12, servings=1,
            instructions=[
                "Press and cube tofu; pan-sear until golden on most sides.",
                "Add mixed vegetables and stir-fry 5-6 minutes.",
                "Finish with soy sauce and sesame oil.",
            ],
            ingredients=[
                ing("Tofu", 8, "oz", 180, 20.0, 4.0, 10.0, primary=True),
                ing("Mixed Vegetables", 2, "cup", 100, 4.0, 20.0, 0.6),
                ing("Sesame Oil", 1, "tbsp", 120, 0.0, 0.0, 13.6),
            ],
        ),
        dict(
            name="Lentil Soup", tags=["vegan", "vegetarian", "fat_loss", "lunch", "gluten_free", "dairy_free"],
            icon="🥣", gradient="4", difficulty="easy", prep=10, cook=30, servings=4,
            instructions=[
                "Sauté onion, carrot, and celery until soft.",
                "Add lentils, diced tomato, vegetable broth, and cumin.",
                "Simmer 25-30 minutes until lentils are tender.",
            ],
            ingredients=[
                ing("Lentils, Dry", 1.5, "cup", 675, 51.0, 117.0, 2.3, primary=True),
                ing("Carrot", 1, "cup", 52, 1.2, 12.0, 0.3),
                ing("Diced Tomatoes, Canned", 1, "cup", 50, 2.0, 11.0, 0.3),
            ],
        ),
        dict(
            name="Greek Yogurt Berry Parfait", tags=["mediterranean", "breakfast", "high_protein", "vegetarian", "gluten_free", "quick_15min"],
            icon="🍓", gradient="3", difficulty="easy", prep=5, cook=0, servings=1,
            instructions=[
                "Layer Greek yogurt, mixed berries, and granola in a bowl or jar.",
                "Drizzle with honey if desired.",
            ],
            ingredients=[
                ing("Greek Yogurt, Plain Nonfat", 1, "cup", 130, 23.0, 9.0, 0.5, primary=True, restrict=["dairy"]),
                ing("Mixed Berries", 1, "cup", 65, 1.0, 15.0, 0.5),
                ing("Granola", 0.25, "cup", 120, 3.0, 20.0, 4.0, restrict=["gluten"]),
            ],
        ),
        dict(
            name="Vegan Protein Overnight Oats", tags=["vegan", "breakfast", "high_protein", "quick_15min", "dairy_free"],
            icon="🥣", gradient="6", difficulty="easy", prep=5, cook=0, servings=1,
            instructions=[
                "Combine oats, plant protein powder, chia seeds, and almond milk in a jar.",
                "Refrigerate overnight; stir and top with banana before eating.",
            ],
            ingredients=[
                ing("Rolled Oats, Dry", 60, "g", 225, 7.5, 40.5, 3.8),
                ing("Plant Protein Powder", 30, "g", 120, 22.0, 3.0, 2.0, primary=True),
                ing("Almond Milk, Unsweetened", 1, "cup", 30, 1.0, 1.0, 2.5),
            ],
        ),
        dict(
            name="Overnight Chia Pudding", tags=["vegan", "breakfast", "quick_15min", "gluten_free", "dairy_free"],
            icon="🍇", gradient="6", difficulty="easy", prep=5, cook=0, servings=1,
            instructions=[
                "Whisk chia seeds into almond milk with a touch of maple syrup.",
                "Refrigerate at least 4 hours or overnight until gel-like.",
                "Top with fresh fruit before serving.",
            ],
            ingredients=[
                ing("Chia Seeds", 3, "tbsp", 138, 4.7, 12.0, 8.7, primary=True),
                ing("Almond Milk, Unsweetened", 1, "cup", 30, 1.0, 1.0, 2.5),
                ing("Mixed Berries", 0.5, "cup", 33, 0.5, 7.5, 0.3),
            ],
        ),
        dict(
            name="Protein Pancakes", tags=["breakfast", "high_protein", "muscle_gain", "vegetarian"],
            icon="🥞", gradient="1", difficulty="easy", prep=5, cook=10, servings=1,
            instructions=[
                "Blend oats, eggs, banana, and protein powder until smooth.",
                "Cook small pancakes on a nonstick skillet over medium heat, 2 minutes per side.",
            ],
            ingredients=[
                ing("Whey Protein Powder", 31, "g", 120, 24.0, 3.0, 1.5, primary=True, restrict=["dairy"]),
                ing("Egg, Large", 2, "each", 144, 12.6, 0.8, 9.6, restrict=["eggs"]),
                ing("Banana", 1, "each", 105, 1.3, 27.0, 0.4),
                ing("Rolled Oats, Dry", 40, "g", 150, 5.0, 27.0, 2.5),
            ],
        ),
        dict(
            name="Egg White Veggie Omelet", tags=["breakfast", "high_protein", "fat_loss", "low_carb", "vegetarian", "gluten_free", "quick_15min"],
            icon="🍳", gradient="1", difficulty="easy", prep=5, cook=8, servings=1,
            instructions=[
                "Sauté bell pepper, spinach, and onion until soft.",
                "Pour in egg whites and cook over medium-low heat, folding once set.",
            ],
            ingredients=[
                ing("Egg White", 1, "cup", 126, 26.0, 1.8, 0.4, primary=True, restrict=["eggs"]),
                ing("Bell Pepper", 0.5, "cup", 15, 0.5, 3.5, 0.2),
                ing("Spinach", 1, "cup", 7, 0.9, 1.1, 0.1),
            ],
        ),
        dict(
            name="Pre-Workout Banana Toast", tags=["pre_workout", "breakfast", "quick_15min", "vegetarian"],
            icon="🍌", gradient="7", difficulty="easy", prep=5, cook=2, servings=1,
            instructions=[
                "Toast whole-grain bread.",
                "Top with peanut butter and sliced banana.",
            ],
            ingredients=[
                ing("Whole-Grain Bread", 2, "slice", 160, 8.0, 28.0, 2.0, restrict=["gluten"]),
                ing("Peanut Butter", 1, "tbsp", 94, 3.6, 3.0, 8.0, restrict=["peanuts"]),
                ing("Banana", 1, "each", 105, 1.3, 27.0, 0.4),
            ],
        ),
        dict(
            name="Pre-Workout Rice Cakes & Honey", tags=["pre_workout", "quick_15min", "vegan", "gluten_free", "dairy_free"],
            icon="🍚", gradient="7", difficulty="easy", prep=3, cook=0, servings=1,
            instructions=[
                "Spread honey over rice cakes.",
                "Eat 30-45 minutes before training for fast-digesting carbs.",
            ],
            ingredients=[
                ing("Rice Cakes", 3, "each", 105, 2.1, 21.0, 0.6),
                ing("Honey", 2, "tbsp", 128, 0.2, 34.0, 0.0),
            ],
        ),
        dict(
            name="Post-Workout Chocolate Protein Shake", tags=["post_workout", "high_protein", "quick_15min", "vegetarian", "gluten_free"],
            icon="🥤", gradient="8", difficulty="easy", prep=3, cook=0, servings=1,
            instructions=[
                "Blend protein powder, banana, milk, and ice until smooth.",
            ],
            ingredients=[
                ing("Whey Protein Powder", 31, "g", 120, 24.0, 3.0, 1.5, primary=True, restrict=["dairy"]),
                ing("Banana", 1, "each", 105, 1.3, 27.0, 0.4),
                ing("Milk, 2%", 1, "cup", 122, 8.0, 12.0, 4.8, restrict=["dairy"]),
            ],
        ),
        dict(
            name="Post-Workout Chicken & Sweet Potato", tags=["post_workout", "high_protein", "muscle_gain", "gluten_free", "dairy_free"],
            icon="🍗", gradient="1", difficulty="easy", prep=10, cook=20, servings=1,
            instructions=[
                "Bake sweet potato cubes at 425°F for 20 minutes.",
                "Grill or pan-sear chicken breast until 165°F internal.",
                "Combine and season with salt and pepper.",
            ],
            ingredients=[
                ing("Chicken Breast", 6, "oz", 280, 53.0, 0.0, 6.0, primary=True),
                ing("Sweet Potato, Baked", 200, "g", 180, 4.0, 41.0, 0.3),
            ],
        ),
        dict(
            name="15-Minute Shrimp Tacos", tags=["quick_15min", "pescatarian", "dinner", "gluten_free"],
            icon="🌮", gradient="8", difficulty="easy", prep=5, cook=8, servings=1,
            instructions=[
                "Season shrimp with chili powder, cumin, and lime; sauté 3-4 minutes until pink.",
                "Warm corn tortillas and fill with shrimp, cabbage slaw, and salsa.",
            ],
            ingredients=[
                ing("Shrimp", 6, "oz", 180, 34.0, 2.0, 2.0, primary=True, restrict=["shellfish"]),
                ing("Corn Tortillas", 3, "each", 210, 5.4, 45.0, 2.4),
                ing("Cabbage Slaw Mix", 1, "cup", 22, 1.0, 5.0, 0.1),
            ],
        ),
        dict(
            name="15-Minute Turkey Lettuce Wraps", tags=["quick_15min", "low_carb", "fat_loss", "dinner", "gluten_free", "dairy_free"],
            icon="🥬", gradient="8", difficulty="easy", prep=5, cook=10, servings=1,
            instructions=[
                "Brown ground turkey with garlic and ginger.",
                "Stir in soy sauce and shredded carrot; cook 2 more minutes.",
                "Spoon into butter lettuce leaves to serve.",
            ],
            ingredients=[
                ing("Ground Turkey, 93% Lean", 6, "oz", 240, 34.5, 0.0, 10.5, primary=True),
                ing("Butter Lettuce", 6, "leaf", 8, 0.5, 1.5, 0.1),
                ing("Carrot", 0.5, "cup", 26, 0.6, 6.0, 0.1),
            ],
        ),
        dict(
            name="Beginner Friendly Baked Chicken & Rice", tags=["beginner_friendly", "high_protein", "dinner", "gluten_free", "dairy_free"],
            icon="🍗", gradient="1", difficulty="easy", prep=5, cook=25, servings=1,
            instructions=[
                "Season chicken breast with salt, pepper, and paprika.",
                "Bake at 400°F for 22-25 minutes until 165°F internal.",
                "Serve over rice with steamed green beans.",
            ],
            ingredients=[
                ing("Chicken Breast", 6, "oz", 280, 53.0, 0.0, 6.0, primary=True),
                ing("White Rice, Cooked", 1, "cup", 205, 4.3, 44.5, 0.4),
                ing("Green Beans", 1, "cup", 31, 1.8, 7.0, 0.1),
            ],
        ),
    ]

    for r in recipe_defs:
        # RecipeIngredient rows hold whole-batch (as-cooked) quantities/macros,
        # but Recipe.calories/protein_g/etc. are stored per-serving -- that's
        # the number a user actually compares against their remaining daily
        # target, not the total macros of a 4-serving batch of chili.
        totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
        for i in r["ingredients"]:
            for key in totals:
                totals[key] += i[key]
        per_serving = {key: round(value / r["servings"], 1) for key, value in totals.items()}
        recipe = models.Recipe(
            name=r["name"], diet_tags=r["tags"], icon_emoji=r["icon"], gradient_key=r["gradient"],
            difficulty=r["difficulty"], prep_minutes=r["prep"], cook_minutes=r["cook"], servings=r["servings"],
            instructions=r["instructions"], fiber_g=0.0, **per_serving,
        )
        db.add(recipe)
        db.flush()
        for i in r["ingredients"]:
            db.add(models.RecipeIngredient(recipe_id=recipe.id, **i))
    db.commit()



def seed(reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(models.User).first():
            print("Already seeded — pass --reset to wipe and reseed.")
            return

        calorie_goal = nutrition.compute_calorie_goal(
            sex="male", weight_kg=79.8, height_cm=177.8, age=27,
            activity_level="active", goal_pace_key="gain_0_5",
        )
        db.add(models.User(
            id=1, name="Aaron", age=27, height_cm=177.8,  # 5'10"
            goal="hypertrophy", experience_level="intermediate", equipment="full_gym", units="imperial",
            goal_weight_kg=83.9,  # 185 lb, matches the seeded hypertrophy goal
            goal_pace_key="gain_0_5", activity_level="active",  # matches the seeded 6-day program
            onboarding_completed=True, sex="male", daily_calorie_goal_kcal=calorie_goal,
        ))
        db.commit()

        # a slight upward trend over the past month, consistent with the seeded
        # lean-gain goal, so the weight sparkline has something real to show
        today = dt.date.today()
        for days_ago, weight_lb in [(21, 173.0), (14, 174.5), (7, 175.2), (0, 176.0)]:
            db.add(models.BodyMetric(user_id=1, date=today - dt.timedelta(days=days_ago), weight_kg=round(weight_lb * 0.45359237, 1)))
        db.commit()

        exercise_defs = [
            ("Barbell Bench Press", "horizontal_push", "chest"),
            ("Neutral-Grip Dumbbell Press", "horizontal_push", "chest"),
            ("Incline Dumbbell Press", "horizontal_push", "chest"),
            ("Overhead Press", "vertical_push", "shoulders"),
            ("Landmine Press", "vertical_push", "shoulders"),
            ("Barbell Back Squat", "squat", "quads"),
            ("Romanian Deadlift", "hinge", "hamstrings"),
            ("Barbell Row", "horizontal_pull", "back"),
            ("Pull-Up", "vertical_pull", "back"),
            ("Walking Lunge", "squat", "quads"),
            ("Bicep Curl", "isolation", "arms"),
            ("Triceps Pushdown", "isolation", "arms"),
            ("Plank", "core", "core"),
        ]
        ex_id = {}
        for name, pattern, muscle in exercise_defs:
            e = models.Exercise(name=name, movement_pattern=pattern, primary_muscle_group=muscle)
            db.add(e)
            db.flush()
            ex_id[name] = e.id
        db.commit()

        program = models.Program(user_id=1, name="Hypertrophy Block", started_at=dt.date.today() - dt.timedelta(days=14))
        db.add(program)
        db.commit()

        meso = models.Mesocycle(program_id=program.id, index=1, focus="hypertrophy", weeks=6, deload_week_index=6)
        db.add(meso)
        db.commit()

        def lift_day(weekday, label, items):
            return models.ProgramDay(mesocycle_id=meso.id, weekday=weekday, day_type="lift", label=label, template={"exercises": items})

        days = [
            lift_day(0, "Upper Push", [
                {"exercise_id": ex_id["Barbell Bench Press"], "sets": 4, "reps": 6, "target_rir": 2, "starting_load_kg": 80},
                {"exercise_id": ex_id["Overhead Press"], "sets": 3, "reps": 8, "target_rir": 2, "starting_load_kg": 40},
                {"exercise_id": ex_id["Triceps Pushdown"], "sets": 3, "reps": 12, "target_rir": 1, "starting_load_kg": 25},
            ]),
            models.ProgramDay(mesocycle_id=meso.id, weekday=1, day_type="rest", label="Rest", template={}),
            lift_day(2, "Lower Body", [
                {"exercise_id": ex_id["Barbell Back Squat"], "sets": 4, "reps": 6, "target_rir": 2, "starting_load_kg": 100},
                {"exercise_id": ex_id["Romanian Deadlift"], "sets": 3, "reps": 8, "target_rir": 2, "starting_load_kg": 80},
                {"exercise_id": ex_id["Walking Lunge"], "sets": 3, "reps": 10, "target_rir": 1, "starting_load_kg": 20},
            ]),
            lift_day(3, "Upper Pull", [
                {"exercise_id": ex_id["Barbell Row"], "sets": 4, "reps": 8, "target_rir": 2, "starting_load_kg": 70},
                {"exercise_id": ex_id["Pull-Up"], "sets": 3, "reps": 8, "target_rir": 2, "starting_load_kg": 0},
                {"exercise_id": ex_id["Bicep Curl"], "sets": 3, "reps": 12, "target_rir": 1, "starting_load_kg": 14},
            ]),
            models.ProgramDay(mesocycle_id=meso.id, weekday=4, day_type="run", label="Easy Run", template={"run_type": "easy", "duration_min": 30, "zone": 2}),
            lift_day(5, "Full Body", [
                {"exercise_id": ex_id["Barbell Bench Press"], "sets": 3, "reps": 8, "target_rir": 2, "starting_load_kg": 77.5},
                {"exercise_id": ex_id["Barbell Back Squat"], "sets": 3, "reps": 8, "target_rir": 2, "starting_load_kg": 95},
                {"exercise_id": ex_id["Plank"], "sets": 3, "reps": 45, "target_rir": 0, "starting_load_kg": 0},
            ]),
            models.ProgramDay(mesocycle_id=meso.id, weekday=6, day_type="recover", label="Active Recovery", template={}),
        ]
        db.add_all(days)
        db.commit()

        # two weeks of simulated recovery history, so rolling baselines have real data
        random.seed(7)
        today = dt.date.today()
        for i in range(14, 0, -1):
            d = today - dt.timedelta(days=i)
            db.add(models.DailyRecoveryMetric(
                user_id=1, date=d,
                hrv_ms=round(60 + random.uniform(-6, 6), 1),
                resting_hr_bpm=round(54 + random.uniform(-3, 3)),
                sleep_duration_min=round(7.3 * 60 + random.uniform(-45, 35)),
                source="simulated",
            ))
        db.commit()

        # a progressing bench press history + one squat session, so the
        # progress chart and progression rule both have real data to read
        bench_id, squat_id = ex_id["Barbell Bench Press"], ex_id["Barbell Back Squat"]
        for days_ago, load in [(12, 77.5), (9, 80), (5, 80), (2, 82.5), (1, 85)]:
            d = today - dt.timedelta(days=days_ago)
            session = models.WorkoutSession(user_id=1, date=d, label="Upper Push", started_at=dt.datetime.combine(d, dt.time(9, 0)))
            db.add(session)
            db.flush()
            for i in range(4):
                db.add(models.WorkoutSet(
                    workout_session_id=session.id, exercise_id=bench_id, set_index=i + 1,
                    prescribed_reps=6, prescribed_load_kg=load, actual_reps=6, actual_load_kg=load, rir=2.0,
                ))
        d = today - dt.timedelta(days=9)
        session = models.WorkoutSession(user_id=1, date=d, label="Lower Body", started_at=dt.datetime.combine(d, dt.time(9, 0)))
        db.add(session)
        db.flush()
        for i in range(4):
            db.add(models.WorkoutSet(
                workout_session_id=session.id, exercise_id=squat_id, set_index=i + 1,
                prescribed_reps=6, prescribed_load_kg=100, actual_reps=6, actual_load_kg=100, rir=2.0,
            ))
        db.commit()

        # one active injury, to demo the substitution rule out of the box
        db.add(models.Injury(user_id=1, body_region="left_shoulder", description="Mild strain — avoid heavy overhead pressing", active=True))
        db.commit()

        # goals for the Program dashboard -- primary tracks the seeded bench history above,
        # secondary is a manually-tracked target (no exercise log backs pull-up reps yet)
        db.add(models.Goal(
            user_id=1, title="Bench Press 100kg for 6", kind="strength", unit="kg",
            start_value=77.5, current_value=82.5, target_value=100, is_secondary=False, status="improving",
        ))
        db.add(models.Goal(
            user_id=1, title="10 Strict Pull-Ups", kind="strength", unit="reps",
            start_value=3, current_value=6, target_value=10, is_secondary=True, status="improving",
        ))
        db.commit()

        # a small starter food library so Search and the saved-meal builder
        # aren't empty on first run -- name, brand, serving_qty, serving_unit,
        # calories, protein_g, carbs_g, fat_g
        food_defs = [
            ("Chicken Breast, Grilled", None, 170, "g", 280, 53.0, 0.0, 6.0),
            ("White Rice, Cooked", None, 158, "g", 205, 4.3, 44.5, 0.4),
            ("Egg, Large", None, 50, "g", 72, 6.3, 0.4, 4.8),
            ("Banana", None, 118, "g", 105, 1.3, 27.0, 0.4),
            ("Whey Protein Powder", None, 31, "g", 120, 24.0, 3.0, 1.5),
            ("Rolled Oats, Dry", None, 40, "g", 150, 5.0, 27.0, 2.5),
            ("Olive Oil", None, 14, "g", 119, 0.0, 0.0, 13.5),
            ("Greek Yogurt, Plain Nonfat", None, 170, "g", 100, 17.0, 6.0, 0.0),
            ("Almonds", None, 28, "g", 164, 6.0, 6.0, 14.0),
            ("Sweet Potato, Baked", None, 200, "g", 180, 4.0, 41.0, 0.3),
        ]
        for name, brand, serving_qty, serving_unit, calories, protein, carbs, fat in food_defs:
            db.add(models.FoodItem(
                user_id=1, source="custom", name=name, brand=brand,
                serving_qty=serving_qty, serving_unit=serving_unit,
                calories=calories, protein_g=protein, carbs_g=carbs, fat_g=fat,
            ))
        db.commit()

        # a small curated restaurant library (real published nutrition figures,
        # not a comprehensive database) so the restaurant browser isn't empty --
        # name, restaurant, calories, protein_g, carbs_g, fat_g
        restaurant_defs = [
            ("Chicken (4oz)", "Chipotle", 180, 32.0, 0.0, 4.5),
            ("White Rice", "Chipotle", 210, 4.0, 40.0, 4.0),
            ("Black Beans", "Chipotle", 130, 8.0, 22.0, 1.5),
            ("Guacamole", "Chipotle", 230, 2.0, 8.0, 22.0),
            ("Big Mac", "McDonald's", 550, 25.0, 45.0, 30.0),
            ("McChicken", "McDonald's", 400, 14.0, 40.0, 21.0),
            ("Medium Fries", "McDonald's", 340, 4.0, 44.0, 16.0),
            ("10pc Chicken McNuggets", "McDonald's", 420, 23.0, 26.0, 25.0),
            ("Grande Caffe Latte (2% milk)", "Starbucks", 190, 13.0, 19.0, 7.0),
            ("Venti Cold Brew, Black", "Starbucks", 5, 0.0, 0.0, 0.0),
            ("Bacon, Gouda & Egg Sandwich", "Starbucks", 370, 18.0, 33.0, 18.0),
            ("Blueberry Muffin", "Starbucks", 350, 5.0, 51.0, 14.0),
            ("6\" Turkey Breast on Wheat", "Subway", 280, 18.0, 46.0, 3.5),
            ("6\" Italian B.M.T.", "Subway", 410, 19.0, 41.0, 18.0),
            ("6\" Veggie Delite", "Subway", 230, 9.0, 45.0, 3.0),
            ("Chocolate Chip Cookie", "Subway", 220, 2.0, 30.0, 10.0),
        ]
        for name, restaurant, calories, protein, carbs, fat in restaurant_defs:
            db.add(models.FoodItem(
                user_id=1, source="restaurant", name=name, restaurant=restaurant,
                serving_qty=1, serving_unit="serving",
                calories=calories, protein_g=protein, carbs_g=carbs, fat_g=fat,
            ))
        db.commit()

        seed_recipes(db)

        print("Seeded demo data for user 'Aaron'.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop all tables and reseed from scratch")
    args = parser.parse_args()
    seed(reset=args.reset)
