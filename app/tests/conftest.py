"""Isolated-DB test fixtures.

The app has one hardcoded demo user (DEMO_USER_ID = 1) and no migrations
tooling -- these tests never touch toci.db. Each test gets its own throwaway
SQLite file so runs are independent and the real seeded profile is never at risk.
"""
import datetime as dt
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from toci import models
from toci.database import Base, get_db
from toci.main import DEMO_USER_ID, app


@pytest.fixture()
def db_session():
    tmp_path = Path(tempfile.mkstemp(suffix=".db")[1])
    engine = create_engine(f"sqlite:///{tmp_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.clear()
        engine.dispose()
        tmp_path.unlink(missing_ok=True)


@pytest.fixture()
def client(db_session):
    return TestClient(app)


@pytest.fixture()
def seeded(db_session):
    """Minimal user + one-week program with TODAY set as a lift day, so
    workout_status logic can be exercised without faking the system clock."""
    today = dt.date.today()

    user = models.User(id=DEMO_USER_ID, name="Test User", units="imperial")
    db_session.add(user)

    exercise = models.Exercise(id=1, name="Barbell Back Squat", movement_pattern="squat", primary_muscle_group="legs")
    db_session.add(exercise)

    program = models.Program(user_id=DEMO_USER_ID, name="Test Program", status="active", started_at=today - dt.timedelta(days=7))
    db_session.add(program)
    db_session.flush()

    meso = models.Mesocycle(program_id=program.id, index=1, focus="strength", weeks=8)
    db_session.add(meso)
    db_session.flush()

    lift_day = models.ProgramDay(
        mesocycle_id=meso.id, weekday=today.weekday(), day_type="lift", label="Lower Body Strength",
        template={"exercises": [{"exercise_id": 1, "sets": 3, "reps": 5, "target_rir": 2, "starting_load_kg": 100}]},
    )
    db_session.add(lift_day)

    run_day = models.ProgramDay(
        mesocycle_id=meso.id, weekday=(today.weekday() + 1) % 7, day_type="run", label="Easy Run",
        template={"run_type": "easy", "duration_min": 30, "zone": 2},
    )
    db_session.add(run_day)
    db_session.commit()

    return {"today": today, "exercise_id": exercise.id, "program": program, "meso": meso}
