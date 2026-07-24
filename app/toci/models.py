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


class BodyMetric(Base):
    __tablename__ = "body_metrics"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    weight_kg = Column(Float)
