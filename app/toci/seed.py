"""Seed demo data: one user, an exercise library, an active hypertrophy
program, two weeks of simulated recovery history, and a few past bench/squat
sessions so progression and the progress chart have real history to work from.
Safe to re-run — it's a no-op once a user already exists (use --reset to wipe)."""

import argparse
import datetime as dt
import random

from .database import Base, SessionLocal, engine
from . import models, nutrition


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
        for days_ago, load in [(12, 77.5), (9, 80), (5, 80), (2, 82.5)]:
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

        print("Seeded demo data for user 'Aaron'.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop all tables and reseed from scratch")
    args = parser.parse_args()
    seed(reset=args.reset)
