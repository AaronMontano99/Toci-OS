"""Planned vs completed: what Toci told the user to do, against what they logged.

The training simulator shows the engine reacting sensibly to a modeled lifter. This
is the same question asked of real training: a real lifter's logged sets are the
judge. Three things come out of it:

- adherence: did planned training days get trained, rest days rested, and was the
  session done as prescribed (sets, reps, weight)?
- engine calibration: when the plan said "increase", did the lifter actually hit
  every rep at the new weight? Too few successes means the engine pushes too hard;
  nearly all means it's too timid. No verdict below MIN_CALIBRATION samples.
- strength trend: estimated 1RM per exercise across the window.

The plan for a day is the frozen models.PlannedSession. Days nobody opened the app
on have no plan; those fall back to the weekly schedule, are labeled as such, and are
kept out of adherence, because "skipped a workout you were never shown" isn't the
same as ignoring advice.
"""

import datetime as dt
from collections import defaultdict

from sqlalchemy.orm import Session

from . import models

MIN_CALIBRATION = 20
TRAINING = ("lift", "run")


def _load_ok(actual: float, prescribed: float) -> bool:
    """Close enough to count as the prescribed weight: within one small plate or 2.5%."""
    return abs((actual or 0) - (prescribed or 0)) <= max(1.0, 0.025 * (prescribed or 0)) + 1e-9


def _e1rm(load: float, reps: int) -> float:
    return load * (1 + reps / 30)  # Epley, the same estimate exercise_memory uses


def _logged(db: Session, user_id: int, start: dt.date, end: dt.date):
    sets = (
        db.query(models.WorkoutSet, models.WorkoutSession.date)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(models.WorkoutSession.user_id == user_id, models.WorkoutSession.date >= start,
                models.WorkoutSession.date <= end, models.WorkoutSet.actual_reps.isnot(None))
        .all()
    )
    by_day = defaultdict(lambda: defaultdict(list))
    for s, date in sets:
        by_day[date][s.exercise_id].append(s)
    runs = {r.date for r in db.query(models.CardioSession).filter(
        models.CardioSession.user_id == user_id, models.CardioSession.date >= start, models.CardioSession.date <= end)}
    return by_day, runs


def _scheduled(db: Session, user_id: int) -> dict:
    program = db.query(models.Program).filter_by(user_id=user_id, status="active").first()
    if not program:
        return {}
    meso = db.query(models.Mesocycle).filter_by(program_id=program.id).order_by(models.Mesocycle.index.desc()).first()
    return {d.weekday: d.day_type for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id)} if meso else {}


def _exercise_result(item: dict, logged: list) -> dict:
    planned_sets, reps, load = item.get("sets", 0), item.get("reps", 0), item.get("load_kg", 0)
    on_load = [s for s in logged if _load_ok(s.actual_load_kg, load)]
    hit = bool(on_load) and len(on_load) >= planned_sets and all((s.actual_reps or 0) >= reps for s in on_load[:planned_sets])
    heaviest = max((s.actual_load_kg or 0 for s in logged), default=0)
    return {
        "exercise_id": item["exercise_id"],
        "name": item.get("name"),
        "recommended_type": item.get("recommended_type"),
        "planned": {"sets": planned_sets, "reps": reps, "load_kg": load},
        "done": {"sets": len(logged), "max_load_kg": heaviest, "reps": [s.actual_reps for s in logged]},
        "status": ("skipped" if not logged else
                   "as prescribed" if hit else
                   "heavier" if heaviest > load and not _load_ok(heaviest, load) else
                   "lighter" if heaviest < load and not _load_ok(heaviest, load) else
                   "short"),  # right weight, but fewer sets or missed reps
        # the calibration question: given the prescribed weight was used, were all reps hit?
        "on_prescribed_load": bool(on_load),
        "all_reps_hit": hit,
    }


def day(db: Session, user_id: int, date: dt.date, logged=None, runs=None, schedule=None) -> dict:
    if logged is None:
        by_day, runs = _logged(db, user_id, date, date)
        logged = by_day.get(date, {})
    schedule = _scheduled(db, user_id) if schedule is None else schedule
    plan = db.query(models.PlannedSession).filter_by(user_id=user_id, date=date).first()
    if plan is not None and not plan.after_training:
        planned, source = plan.session_type, "app"
    else:
        planned, source = schedule.get(date.weekday(), "rest"), "schedule"
    lifted, ran = bool(logged), date in (runs or set())

    exercises = []
    if planned == "lift" and source == "app":
        items = plan.prescription.get("exercises", [])
        exercises = [_exercise_result(it, logged.get(it["exercise_id"], [])) for it in items]
        planned_ids = {it["exercise_id"] for it in items}
        extra = [eid for eid in logged if eid not in planned_ids]
    else:
        extra = list(logged) if planned != "lift" else []

    if planned in TRAINING:
        did = lifted if planned == "lift" else ran
        if did and planned == "lift" and exercises:
            status = "as planned" if all(e["status"] == "as prescribed" for e in exercises) and not extra else "modified"
        elif did:
            status = "done"
        elif lifted or ran:
            status = "swapped"
        else:
            status = "skipped"
    else:
        status = "extra session" if (lifted or ran) else "rested"
    return {"date": date.isoformat(), "planned": planned, "plan_source": source, "status": status,
            "band": plan.band if plan is not None else None, "exercises": exercises, "unplanned_exercise_ids": extra}


def report(db: Session, user_id: int, end: dt.date, days: int = 28) -> dict:
    """Plan vs done for the `days` days ending at `end` (today counts only once something is logged)."""
    start = end - dt.timedelta(days=days - 1)
    by_day, runs = _logged(db, user_id, start, end)
    schedule = _scheduled(db, user_id)
    out = []
    for i in range(days):
        d = start + dt.timedelta(days=i)
        if d == end and d not in by_day and d not in runs:
            continue  # today isn't over yet
        out.append(day(db, user_id, d, by_day.get(d, {}), runs, schedule))

    did = ("as planned", "modified", "done", "swapped")
    # Adherence is to advice actually given: days the app showed a plan. Days nobody opened
    # it are counted on their own, against the weekly schedule, not mixed in.
    training = [d for d in out if d["planned"] in TRAINING and d["plan_source"] == "app"]
    trained = [d for d in training if d["status"] in did]
    unseen = [d for d in out if d["planned"] in TRAINING and d["plan_source"] == "schedule"]
    lift_days = [d for d in training if d["planned"] == "lift" and d["status"] in ("as planned", "modified")]

    calibration = {}
    for d in out:
        for e in d["exercises"]:
            if e["recommended_type"] and e["on_prescribed_load"]:
                c = calibration.setdefault(e["recommended_type"], {"n": 0, "hit": 0})
                c["n"] += 1
                c["hit"] += e["all_reps_hit"]
    for c in calibration.values():
        c["rate"] = c["hit"] / c["n"]
        c["verdict"] = "collecting" if c["n"] < MIN_CALIBRATION else (
            "pushing too hard" if c["rate"] < 0.6 else "too cautious" if c["rate"] > 0.95 else "well calibrated")

    tops = defaultdict(list)  # exercise -> [(date, best e1RM that day)]
    for d, exs in sorted(by_day.items()):
        for eid, sets in exs.items():
            loaded = [s for s in sets if (s.actual_load_kg or 0) > 0 and s.actual_reps]
            if loaded:
                tops[eid].append((d, max(_e1rm(s.actual_load_kg, s.actual_reps) for s in loaded)))
    names = {e.id: e.name for e in db.query(models.Exercise).filter(models.Exercise.id.in_(list(tops)))} if tops else {}
    strength = sorted(
        ({"exercise_id": eid, "name": names.get(eid), "sessions": len(v), "first_e1rm_kg": round(v[0][1], 1),
          "last_e1rm_kg": round(v[-1][1], 1), "change_pct": round(v[-1][1] / v[0][1] - 1, 4)}
         for eid, v in tops.items() if len(v) >= 2),
        key=lambda x: -x["sessions"],
    )

    return {
        "start": start.isoformat(), "end": end.isoformat(), "days": out,
        "summary": {
            "planned_training_days": len(training),
            "trained": len(trained),
            "adherence": round(len(trained) / len(training), 3) if training else None,
            "as_prescribed": round(sum(d["status"] == "as planned" for d in lift_days) / len(lift_days), 3) if lift_days else None,
            "extra_sessions": sum(d["status"] == "extra session" for d in out),
            "days_without_a_plan": sum(d["plan_source"] == "schedule" for d in out),
            "scheduled_without_a_plan": len(unseen),
            "trained_without_a_plan": sum(d["status"] in did for d in unseen),
        },
        "calibration": calibration,
        "strength": strength,
    }
