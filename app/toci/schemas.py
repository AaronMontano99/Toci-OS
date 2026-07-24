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
