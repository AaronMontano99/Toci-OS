import datetime as dt

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    age = Column(Integer)
    height_cm = Column(Float)  # canonical storage is metric; imperial is a display/input conversion
    goal = Column(String, nullable=False, default="hypertrophy")
    experience_level = Column(String, nullable=False, default="intermediate")
    equipment = Column(String, nullable=False, default="full_gym")
    units = Column(String, nullable=False, default="imperial")  # "imperial" (lb/in) | "metric" (kg/cm)
    password_hash = Column(String)  # salt$hash -- see engine.hash_password. Nothing currently checks this;
    # there's no login screen in this demo, so it's a real persisted setting with nothing to gate yet.
    notif_daily_recommendation = Column(Boolean, nullable=False, default=True)
    notif_readiness_alerts = Column(Boolean, nullable=False, default=True)

    # Spotify: real OAuth (Authorization Code + PKCE), no client secret needed.
    # User supplies their own client_id from developer.spotify.com/dashboard.
    spotify_client_id = Column(String)
    spotify_access_token = Column(String)
    spotify_refresh_token = Column(String)
    spotify_token_expires_at = Column(DateTime)

    # Whoop: real OAuth (Authorization Code, confidential client -- Whoop requires
    # a client secret, unlike Spotify's PKCE-only flow). User supplies their own
    # client_id/secret from developer.whoop.com.
    whoop_client_id = Column(String)
    whoop_client_secret = Column(String)
    whoop_access_token = Column(String)
    whoop_refresh_token = Column(String)
    whoop_token_expires_at = Column(DateTime)
    wearable_display_stats = Column(JSON)  # up to 3 keys from whoop.STAT_CATALOG, e.g. ["recovery_score","hrv_rmssd_milli","strain"]

    # Onboarding: goal_pace_key / activity_level are plain unvalidated strings,
    # same convention as goal/experience_level/equipment above -- the option
    # catalogs (label + description) live in the frontend, not here.
    goal_weight_kg = Column(Float)
    goal_pace_key = Column(String)  # e.g. "lose_1", "maintain", "gain_0_5"
    activity_level = Column(String)  # "sedentary" | "lightly_active" | "active" | "very_active"
    onboarding_completed = Column(Boolean, nullable=False, default=False)
    sex = Column(String)  # "male" | "female" -- used only for the Mifflin-St Jeor BMR formula
    daily_calorie_goal_kcal = Column(Float)  # computed once at onboarding; editable after, not auto-recomputed
    is_premium = Column(Boolean, nullable=False, default=False)  # demo stub -- no real payment processor exists

    dietary_preferences = Column(JSON, nullable=False, default=list)  # e.g. ["high_protein", "mediterranean"]
    food_restrictions = Column(JSON, nullable=False, default=list)  # e.g. ["shellfish", "peanuts"] -- excluded ingredient tags

    household_size = Column(Integer, nullable=False, default=1)  # scales Smart Cart quantities/cost -- no multi-user profiles in this app
    shopping_weekly_budget = Column(Float)  # drives the Smart Cart budget bar

    coach_name = Column(String, nullable=False, default="Toci")  # display name for the AI coach in the Coach tab


class Injury(Base):
    __tablename__ = "injuries"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body_region = Column(String, nullable=False)
    description = Column(String)
    active = Column(Boolean, default=True)


class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    movement_pattern = Column(String, nullable=False)
    primary_muscle_group = Column(String, nullable=False)
    unilateral = Column(Boolean, default=False)


class ExerciseSubstitution(Base):
    """A user's standing "swap this movement for that one" preference --
    e.g. from tapping Swap Movement mid-workout -- so it carries into future
    prescriptions of the same planned exercise instead of resetting every
    session. At most one active substitute per (user, original exercise)."""
    __tablename__ = "exercise_substitutions"
    __table_args__ = (UniqueConstraint("user_id", "original_exercise_id", name="uq_exercise_substitution_user_original"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    substitute_exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)


class Program(Base):
    __tablename__ = "programs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="active")
    started_at = Column(Date, default=dt.date.today)


class Mesocycle(Base):
    __tablename__ = "mesocycles"
    id = Column(Integer, primary_key=True)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    index = Column(Integer, nullable=False)
    focus = Column(String, nullable=False)
    weeks = Column(Integer, nullable=False)
    deload_week_index = Column(Integer)


class ProgramDay(Base):
    __tablename__ = "program_days"
    id = Column(Integer, primary_key=True)
    mesocycle_id = Column(Integer, ForeignKey("mesocycles.id"), nullable=False)
    weekday = Column(Integer, nullable=False)  # 0=Mon .. 6=Sun
    day_type = Column(String, nullable=False)  # lift | run | rest | recover
    label = Column(String, nullable=False)
    # lift: {"exercises": [{"exercise_id", "sets", "reps", "target_rir", "starting_load_kg"}, ...]}
    # run:  {"run_type", "duration_min", "zone"}
    template = Column(JSON, nullable=False, default=dict)


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    label = Column(String)
    started_at = Column(DateTime, default=dt.datetime.utcnow)
    ended_at = Column(DateTime)


class WorkoutSet(Base):
    __tablename__ = "workout_sets"
    id = Column(Integer, primary_key=True)
    workout_session_id = Column(Integer, ForeignKey("workout_sessions.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    set_index = Column(Integer, nullable=False)
    prescribed_reps = Column(Integer)
    prescribed_load_kg = Column(Float)
    actual_reps = Column(Integer)
    actual_load_kg = Column(Float)
    rir = Column(Float)
    rest_seconds = Column(Integer)  # rest taken before this set (no cap -- log as many sets as you did)
    feel = Column(String)  # "clean" | "difficult" | "sloppy" | "partial" | "assisted" | "pain" | "unsure"
    confidence_next = Column(String)  # "yes" | "maybe" | "no" -- feeling about increasing load next time


class CardioSession(Base):
    __tablename__ = "cardio_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    activity_type = Column(String, default="run")
    duration_seconds = Column(Integer, nullable=False)
    distance_meters = Column(Float)
    avg_hr = Column(Integer)
    perceived_effort = Column(Float)
    run_type = Column(String)  # "outdoor" | "treadmill" -- null for pre-existing/legacy runs
    incline_percent = Column(Float)  # treadmill only
    treadmill_speed_kmh = Column(Float)  # treadmill only -- the set/target speed, not a derived average
    route = Column(JSON)  # outdoor only -- [{"lat": float, "lng": float, "t": "<ISO8601>"}, ...]


class DailyRecoveryMetric(Base):
    __tablename__ = "daily_recovery_metrics"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    hrv_ms = Column(Float)
    resting_hr_bpm = Column(Integer)
    sleep_duration_min = Column(Integer)
    source = Column(String, default="simulated")
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_recovery_user_date"),)


class DailyCheckin(Base):
    __tablename__ = "daily_checkins"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    soreness_1_5 = Column(Integer)
    stress_mood_1_5 = Column(Integer)
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_checkin_user_date"),)


class ReadinessScore(Base):
    __tablename__ = "readiness_scores"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    score = Column(Float, nullable=False)
    band = Column(String, nullable=False)
    hrv_component = Column(Float)
    sleep_component = Column(Float)
    rhr_component = Column(Float)
    subjective_component = Column(Float)
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_readiness_user_date"),)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    session_type = Column(String, nullable=False)  # lift | run | recover | rest
    prescription = Column(JSON, nullable=False)
    reasoning = Column(JSON, nullable=False)
    readiness_score = Column(Float)
    band = Column(String)
    status = Column(String, default="pending")
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_reco_user_date"),)


class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    kind = Column(String, nullable=False, default="custom")  # "strength" | "endurance" | "consistency" | "custom"
    unit = Column(String, nullable=False, default="")  # e.g. "kg", "reps", "mi" -- "" for unit-less (e.g. consistency %)
    start_value = Column(Float)
    current_value = Column(Float)
    target_value = Column(Float)
    is_secondary = Column(Boolean, nullable=False, default=False)  # False = primary goal
    status = Column(String, default="stable")  # "improving" | "stable" | "declining", recomputed on read
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    target_date = Column(Date)


class BodyMetric(Base):
    __tablename__ = "body_metrics"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    weight_kg = Column(Float)
    body_fat_pct = Column(Float)  # optional, user-entered -- never estimated from photos


class WaterLogEntry(Base):
    __tablename__ = "water_log_entries"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    ounces = Column(Float, nullable=False)
    logged_at = Column(DateTime, default=dt.datetime.utcnow)


class ProgramChatMessage(Base):
    __tablename__ = "program_chat_messages"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant" | "system_notice"
    content = Column(String, nullable=False)
    proposal_json = Column(JSON)  # a proposed program structure attached to an assistant message, or null
    proposal_status = Column(String)  # "pending" | "applied" | "discarded" -- null when proposal_json is null
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class ProgressPhoto(Base):
    __tablename__ = "progress_photos"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    filename = Column(String, nullable=False)  # UUID-based; see uploads/ dir, never user-supplied
    note = Column(String)  # user's own caption, optional
    ai_impression = Column(String)  # local vision-model's qualitative note; null if unavailable/timed out
    ai_impression_generated_at = Column(DateTime)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class FoodItem(Base):
    __tablename__ = "food_items"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    barcode = Column(String, index=True)  # set when sourced from a barcode lookup; null for custom foods
    name = Column(String, nullable=False)
    brand = Column(String)
    serving_qty = Column(Float, nullable=False, default=1.0)
    serving_unit = Column(String, nullable=False, default="serving")
    calories = Column(Float, nullable=False, default=0.0)
    protein_g = Column(Float, nullable=False, default=0.0)
    carbs_g = Column(Float, nullable=False, default=0.0)
    fat_g = Column(Float, nullable=False, default=0.0)
    fiber_g = Column(Float, nullable=False, default=0.0)
    sugar_g = Column(Float, nullable=False, default=0.0)
    sodium_mg = Column(Float, nullable=False, default=0.0)
    source = Column(String, nullable=False, default="custom")  # "custom" | "barcode" | "quick_add" | "restaurant" | "recipe"
    restaurant = Column(String)  # set for source="restaurant" items
    is_favorite = Column(Boolean, nullable=False, default=False)
    use_count = Column(Integer, nullable=False, default=0)  # incremented on each log; powers "frequently logged"
    last_used_at = Column(DateTime)  # powers "recent foods"


class FoodLogEntry(Base):
    __tablename__ = "food_log_entries"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id"), nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    servings = Column(Float, nullable=False, default=1.0)  # multiplier on the food item's serving
    meal_slot = Column(String, nullable=False, default="snack")  # "breakfast" | "lunch" | "dinner" | "snack"
    notes = Column(String)
    logged_at = Column(DateTime, default=dt.datetime.utcnow)


class SavedMeal(Base):
    __tablename__ = "saved_meals"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class SavedMealItem(Base):
    __tablename__ = "saved_meal_items"
    id = Column(Integer, primary_key=True)
    saved_meal_id = Column(Integer, ForeignKey("saved_meals.id"), nullable=False)
    food_item_id = Column(Integer, ForeignKey("food_items.id"), nullable=False)
    servings = Column(Float, nullable=False, default=1.0)


class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    diet_tags = Column(JSON, nullable=False, default=list)  # e.g. ["high_protein", "dinner", "muscle_gain"]
    calories = Column(Float, nullable=False, default=0.0)
    protein_g = Column(Float, nullable=False, default=0.0)
    carbs_g = Column(Float, nullable=False, default=0.0)
    fat_g = Column(Float, nullable=False, default=0.0)
    fiber_g = Column(Float, nullable=False, default=0.0)
    prep_minutes = Column(Integer, nullable=False, default=10)
    cook_minutes = Column(Integer, nullable=False, default=0)
    difficulty = Column(String, nullable=False, default="easy")  # "easy" | "medium" | "hard"
    servings = Column(Integer, nullable=False, default=1)
    icon_emoji = Column(String, nullable=False, default="\U0001f37d️")
    gradient_key = Column(String, nullable=False, default="1")  # keys into a small fixed CSS gradient palette
    instructions = Column(JSON, nullable=False, default=list)  # ["Step 1...", "Step 2...", ...]


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String, nullable=False, default="serving")
    calories = Column(Float, nullable=False, default=0.0)
    protein_g = Column(Float, nullable=False, default=0.0)
    carbs_g = Column(Float, nullable=False, default=0.0)
    fat_g = Column(Float, nullable=False, default=0.0)
    restriction_tags = Column(JSON, nullable=False, default=list)  # e.g. ["shellfish"] -- excludes the parent recipe for matching users
    is_primary_protein = Column(Boolean, nullable=False, default=False)  # scaled by "Fit My Macros"
    substitutions = Column(JSON, nullable=False, default=list)  # [{"name","calories","protein_g","carbs_g","fat_g","restriction_tags":[...]}]


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, default="pantry")  # protein|produce|fruit|carbs|fats|dairy|frozen|pantry|snacks|drinks
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String, nullable=False, default="unit")
    estimated_price = Column(Float, nullable=False, default=0.0)
    purpose = Column(String)  # e.g. "Used for Grilled Chicken Rice Bowl"
    is_checked = Column(Boolean, nullable=False, default=False)
    source = Column(String, nullable=False, default="manual")  # "manual" | "recipe"
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class PantryItem(Base):
    __tablename__ = "pantry_items"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class WearableDayStats(Base):
    __tablename__ = "wearable_day_stats"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    provider = Column(String, nullable=False, default="whoop")
    stats = Column(JSON, nullable=False)  # {"recovery_score": 82, "hrv_rmssd_milli": 61.2, ...}
    fetched_at = Column(DateTime, default=dt.datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "date", "provider", name="uq_wearable_day"),)
