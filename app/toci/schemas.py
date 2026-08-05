from typing import List, Optional

from pydantic import BaseModel, Field


class CheckinIn(BaseModel):
    hrv_ms: float
    resting_hr_bpm: int
    sleep_hours: float
    soreness_1_5: int
    stress_mood_1_5: int


class WorkoutStartIn(BaseModel):
    label: Optional[str] = None


class SetIn(BaseModel):
    exercise_id: int
    set_index: int
    prescribed_reps: Optional[int] = None
    prescribed_load_kg: Optional[float] = None
    actual_reps: int
    actual_load_kg: float
    rir: Optional[float] = None
    rest_seconds: Optional[int] = None
    feel: Optional[str] = None  # "clean" | "difficult" | "sloppy" | "partial" | "assisted" | "pain" | "unsure"
    confidence_next: Optional[str] = None  # "yes" | "maybe" | "no"


class SetUpdateIn(BaseModel):
    actual_reps: Optional[int] = None
    actual_load_kg: Optional[float] = Field(None, ge=0)
    rir: Optional[float] = None
    feel: Optional[str] = None
    confidence_next: Optional[str] = None


class GoalIn(BaseModel):
    title: str
    kind: str = "custom"  # "strength" | "endurance" | "consistency" | "custom"
    unit: str = ""
    start_value: Optional[float] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    is_secondary: bool = False
    target_date: Optional[str] = None  # ISO date "YYYY-MM-DD"


class ScheduleSwapIn(BaseModel):
    weekday_a: int = Field(ge=0, le=6)
    weekday_b: int = Field(ge=0, le=6)


class GoalUpdateIn(BaseModel):
    title: Optional[str] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    is_secondary: Optional[bool] = None
    target_date: Optional[str] = None  # ISO date "YYYY-MM-DD"


class RunRoutePoint(BaseModel):
    lat: float
    lng: float
    t: str  # ISO8601 timestamp


class RunIn(BaseModel):
    duration_seconds: int
    distance_meters: float
    avg_hr: Optional[int] = None
    perceived_effort: Optional[float] = None
    run_type: Optional[str] = None  # "outdoor" | "treadmill"
    incline_percent: Optional[float] = None
    treadmill_speed_kmh: Optional[float] = None
    route: Optional[List[RunRoutePoint]] = None


class RunUpdateIn(BaseModel):
    duration_seconds: Optional[int] = Field(None, gt=0)
    distance_meters: Optional[float] = Field(None, ge=0)
    avg_hr: Optional[int] = None
    perceived_effort: Optional[float] = None
    run_type: Optional[str] = None
    incline_percent: Optional[float] = None
    treadmill_speed_kmh: Optional[float] = None
    route: Optional[List[RunRoutePoint]] = None


class InjuryIn(BaseModel):
    body_region: str
    description: Optional[str] = None


class ExerciseIn(BaseModel):
    name: str
    movement_pattern: Optional[str] = "custom"
    primary_muscle_group: Optional[str] = "custom"


class ExerciseSubstitutionIn(BaseModel):
    substitute_exercise_id: int


class CustomScheduleDayIn(BaseModel):
    weekday: int = Field(..., ge=0, le=6)  # 0=Monday .. 6=Sunday, matching ProgramDay/WeekDetailDay elsewhere
    split: str = ""
    movements: str = ""
    notes: str = ""


class CustomScheduleUpdateIn(BaseModel):
    days: List[CustomScheduleDayIn]


class SettingsUpdateIn(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[float] = None
    goal: Optional[str] = None
    experience_level: Optional[str] = None
    equipment: Optional[str] = None
    units: Optional[str] = None  # "imperial" | "metric"
    notif_daily_recommendation: Optional[bool] = None
    notif_readiness_alerts: Optional[bool] = None
    goal_weight_kg: Optional[float] = None
    goal_pace_key: Optional[str] = None
    activity_level: Optional[str] = None
    onboarding_completed: Optional[bool] = None  # lets Settings offer a "redo onboarding" reset
    sex: Optional[str] = None
    daily_calorie_goal_kcal: Optional[float] = None
    # is_premium is intentionally NOT here -- it's derived from a verified
    # Apple subscription (see models.User's comment and toci/apple_iap.py),
    # never client-settable. Setting it via this endpoint would make the
    # paywall meaningless.
    dietary_preferences: Optional[List[str]] = None
    food_restrictions: Optional[List[str]] = None
    household_size: Optional[int] = None
    shopping_weekly_budget: Optional[float] = None
    coach_name: Optional[str] = None


class PurchaseVerifyIn(BaseModel):
    signed_transaction: str  # StoreKit 2's Transaction.jwsRepresentation, sent right after a purchase completes


class RestorePurchaseIn(BaseModel):
    original_transaction_id: str  # from StoreKit's Transaction.currentEntitlements on the client


class AppStoreNotificationIn(BaseModel):
    signedPayload: str  # Apple's exact field name for App Store Server Notifications V2 -- not renamed to snake_case


class PasswordUpdateIn(BaseModel):
    new_password: str
    confirm_password: str


class SpotifyClientIdIn(BaseModel):
    client_id: str


class SpotifyCallbackIn(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str


class SpotifyPlaybackIn(BaseModel):
    action: str  # "play" | "pause"


class FoodItemIn(BaseModel):
    name: str
    brand: Optional[str] = None
    serving_qty: float = Field(1.0, gt=0)
    serving_unit: str = "serving"
    calories: float = Field(ge=0)
    protein_g: float = Field(0.0, ge=0)
    carbs_g: float = Field(0.0, ge=0)
    fat_g: float = Field(0.0, ge=0)
    fiber_g: float = Field(0.0, ge=0)
    sugar_g: float = Field(0.0, ge=0)
    sodium_mg: float = Field(0.0, ge=0)


class FoodLogIn(BaseModel):
    food_item_id: int
    servings: float = Field(1.0, gt=0)
    meal_slot: str = "snack"
    date: Optional[str] = None  # ISO date "YYYY-MM-DD" -- defaults to today when omitted


class FoodLogUpdateIn(BaseModel):
    servings: Optional[float] = Field(None, gt=0)
    meal_slot: Optional[str] = None
    notes: Optional[str] = None


class QuickAddIn(BaseModel):
    label: str = "Quick Add"
    calories: float = Field(ge=0)
    protein_g: float = Field(0.0, ge=0)
    carbs_g: float = Field(0.0, ge=0)
    fat_g: float = Field(0.0, ge=0)
    meal_slot: str = "snack"
    date: Optional[str] = None


class CopyDayIn(BaseModel):
    from_date: str  # "yesterday" or an ISO date "YYYY-MM-DD"
    meal_slot: Optional[str] = None  # copy only this meal slot, or the whole day if omitted
    to_date: Optional[str] = None  # ISO date "YYYY-MM-DD" -- defaults to today when omitted


class SavedMealItemIn(BaseModel):
    food_item_id: int
    servings: float = Field(1.0, gt=0)


class SavedMealIn(BaseModel):
    name: str
    items: List[SavedMealItemIn]


class LogSavedMealIn(BaseModel):
    multiplier: float = Field(1.0, gt=0)
    date: Optional[str] = None


class WhoopCredentialsIn(BaseModel):
    client_id: str
    client_secret: str


class WhoopCallbackIn(BaseModel):
    code: str
    redirect_uri: str
    state: str


class WearableDisplayStatsIn(BaseModel):
    stats: List[str]


class BodyWeightIn(BaseModel):
    weight_kg: float


class BodyWeightUpdateIn(BaseModel):
    weight_kg: float = Field(gt=0)


class BodyFatIn(BaseModel):
    body_fat_pct: float


class WaterLogIn(BaseModel):
    ounces: float = Field(gt=0)
    date: Optional[str] = None


class RecipeFitMacrosIn(BaseModel):
    target_protein_g: float = Field(gt=0)


class RecipeIngredientOverrideIn(BaseModel):
    ingredient_id: int
    alt_name: Optional[str] = None  # swap to this substitution's name
    quantity: Optional[float] = None  # e.g. the scaled quantity returned by Fit My Macros


class RecipeLogIn(BaseModel):
    servings: float = Field(1.0, gt=0)
    meal_slot: str = "dinner"
    overrides: List[RecipeIngredientOverrideIn] = []
    date: Optional[str] = None


class ShoppingItemIn(BaseModel):
    name: str
    quantity: float = Field(1.0, gt=0)
    unit: str = "unit"
    category: Optional[str] = None


class ShoppingItemUpdateIn(BaseModel):
    quantity: Optional[float] = Field(None, gt=0)
    is_checked: Optional[bool] = None


class ShoppingFromRecipeIn(BaseModel):
    multiplier: float = 1.0


class ShoppingQuickActionIn(BaseModel):
    action: str  # "remove_seafood" | "reduce_cost" | "increase_protein" | "clear_checked"


class PantryItemIn(BaseModel):
    name: str


class OnboardingCompleteIn(BaseModel):
    current_weight_kg: float
    goal_weight_kg: float
    goal_pace_key: str
    activity_level: str
    sex: str
