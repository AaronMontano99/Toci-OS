from typing import Optional

from pydantic import BaseModel


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


class RunIn(BaseModel):
    duration_seconds: int
    distance_meters: float
    avg_hr: Optional[int] = None
    perceived_effort: Optional[float] = None


class InjuryIn(BaseModel):
    body_region: str
    description: Optional[str] = None


class ExerciseIn(BaseModel):
    name: str
    movement_pattern: Optional[str] = "custom"
    primary_muscle_group: Optional[str] = "custom"


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


class PasswordUpdateIn(BaseModel):
    new_password: str
    confirm_password: str
