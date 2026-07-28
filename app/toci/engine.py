"""
The recommendation engine, matching docs/architecture.md §07:
readiness scoring -> progressive overload -> band-based autoregulation ->
injury-aware substitution -> a saved Recommendation with its reasoning.

Simplified from the full production design for a local demo:
- no ACWR / training-load tracking yet (readiness + progression only)
- exercise substitution is a small hardcoded map, not the full
  exercise_substitutions table
"""

import datetime as dt
import statistics

from sqlalchemy.orm import Session

from . import models

TARGET_SLEEP_MIN = 8 * 60
BASELINE_WINDOW_DAYS = 28
SMALLEST_INCREMENT_KG = 2.5

# exercise name -> {injured body_region: substitute exercise name}
SUBSTITUTIONS = {
    "Barbell Bench Press": {
        "left_shoulder": "Neutral-Grip Dumbbell Press",
        "right_shoulder": "Neutral-Grip Dumbbell Press",
    },
    "Overhead Press": {
        "left_shoulder": "Landmine Press",
        "right_shoulder": "Landmine Press",
    },
}


def rolling_baseline(db: Session, user_id: int, date: dt.date, field: str, days: int = BASELINE_WINDOW_DAYS):
    start = date - dt.timedelta(days=days)
    rows = (
        db.query(models.DailyRecoveryMetric)
        .filter(
            models.DailyRecoveryMetric.user_id == user_id,
            models.DailyRecoveryMetric.date >= start,
            models.DailyRecoveryMetric.date < date,
        )
        .all()
    )
    values = [getattr(r, field) for r in rows if getattr(r, field) is not None]
    if len(values) < 3:
        return None, None
    return statistics.mean(values), (statistics.pstdev(values) or 1.0)


def _zscore(value, mean, std, clip=3.0):
    if value is None or mean is None or not std:
        return 0.0
    z = (value - mean) / std
    return max(-clip, min(clip, z))


def compute_readiness(db: Session, user_id: int, date: dt.date) -> models.ReadinessScore:
    recovery = db.query(models.DailyRecoveryMetric).filter_by(user_id=user_id, date=date).first()
    checkin = db.query(models.DailyCheckin).filter_by(user_id=user_id, date=date).first()

    # HRV (40%) -- higher vs. baseline is better
    hrv_mean, hrv_std = rolling_baseline(db, user_id, date, "hrv_ms")
    hrv_z = _zscore(recovery.hrv_ms if recovery else None, hrv_mean, hrv_std)
    hrv_component = 50 + (hrv_z / 3.0) * 50

    # Resting HR (15%) -- lower vs. baseline is better -> invert
    rhr_mean, rhr_std = rolling_baseline(db, user_id, date, "resting_hr_bpm")
    rhr_z = _zscore(recovery.resting_hr_bpm if recovery else None, rhr_mean, rhr_std)
    rhr_component = 50 - (rhr_z / 3.0) * 50

    # Sleep (25%) -- duration vs. personal target
    sleep_min = recovery.sleep_duration_min if recovery and recovery.sleep_duration_min else TARGET_SLEEP_MIN
    sleep_component = max(0.0, min(100.0, sleep_min / TARGET_SLEEP_MIN * 100))

    # Subjective check-in (20%) -- soreness + mood, 1-5 each
    if checkin and checkin.soreness_1_5 and checkin.stress_mood_1_5:
        soreness_score = (6 - checkin.soreness_1_5) / 5 * 100
        mood_score = checkin.stress_mood_1_5 / 5 * 100
        subjective_component = (soreness_score + mood_score) / 2
    else:
        subjective_component = 70.0  # neutral default before the day's check-in

    score = (
        0.40 * hrv_component
        + 0.25 * sleep_component
        + 0.15 * rhr_component
        + 0.20 * subjective_component
    )
    score = round(max(0.0, min(100.0, score)), 1)
    band = "green" if score >= 70 else "amber" if score >= 40 else "red"

    row = db.query(models.ReadinessScore).filter_by(user_id=user_id, date=date).first()
    if row is None:
        row = models.ReadinessScore(user_id=user_id, date=date)
        db.add(row)
    row.score = score
    row.band = band
    row.hrv_component = round(hrv_component, 1)
    row.sleep_component = round(sleep_component, 1)
    row.rhr_component = round(rhr_component, 1)
    row.subjective_component = round(subjective_component, 1)
    db.commit()
    db.refresh(row)
    return row


def _last_top_set(db: Session, user_id: int, exercise_id: int):
    return (
        db.query(models.WorkoutSet)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(
            models.WorkoutSession.user_id == user_id,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.actual_load_kg.isnot(None),
        )
        .order_by(models.WorkoutSession.date.desc(), models.WorkoutSet.actual_load_kg.desc())
        .first()
    )


def exercise_memory(db: Session, user_id: int, exercise_id: int, today: dt.date) -> dict:
    """Everything the coach should already remember about this exercise before
    the user lifts a single rep today: last time, best ever, how long it's
    been. Powers a conversational logging intro instead of a blank form --
    the same underlying WorkoutSet history progression_options() reads, just
    shaped for "what happened last time" rather than "what to do next"."""
    rows = (
        db.query(models.WorkoutSet, models.WorkoutSession.date)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(
            models.WorkoutSession.user_id == user_id,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.actual_load_kg.isnot(None),
            models.WorkoutSet.actual_reps.isnot(None),
        )
        .order_by(models.WorkoutSession.date.desc())
        .all()
    )
    if not rows:
        return {
            "has_history": False,
            "last_session": None,
            "best_session": None,
            "sessions_logged": 0,
            "days_since_last": None,
        }

    sessions_by_date: dict = {}
    order = []
    for s, date in rows:
        if date not in sessions_by_date:
            sessions_by_date[date] = []
            order.append(date)
        sessions_by_date[date].append(s)
    order.sort(reverse=True)

    last_date = order[0]
    last_sets = sessions_by_date[last_date]
    last_top = max(last_sets, key=lambda r: (r.actual_load_kg or 0))
    last_session = {
        "date": last_date.isoformat(),
        "weight_kg": last_top.actual_load_kg,
        "reps": last_top.actual_reps,
        "sets": len(last_sets),
        "feel": last_top.feel,
        "rir": last_top.rir,
    }

    best_set, best_date, best_est = None, None, -1.0
    for s, date in rows:
        est = s.actual_load_kg * (1 + s.actual_reps / 30)
        if est > best_est:
            best_set, best_date, best_est = s, date, est
    best_session = (
        {"date": best_date.isoformat(), "weight_kg": best_set.actual_load_kg, "reps": best_set.actual_reps}
        if best_set
        else None
    )

    return {
        "has_history": True,
        "last_session": last_session,
        "best_session": best_session,
        "sessions_logged": len(order),
        "days_since_last": (today - last_date).days,
    }


# feel ratings that mean "don't add load yet, even if reps were technically hit"
FEEL_BLOCKS_INCREASE = {"sloppy", "partial", "assisted", "pain"}


def progression_options(db: Session, user_id: int, exercise_id: int, target_rir: float, target_reps, starting_load_kg: float):
    """Returns {options: [...], recommended_type, why} -- a few reasonable next-session
    choices instead of one auto-picked number, in the spirit of a coach offering options
    rather than issuing an order. Each option: {type, load_kg, reps, label, detail}."""
    last = _last_top_set(db, user_id, exercise_id)
    if not last:
        load = round(starting_load_kg, 1)
        return {
            "options": [{
                "type": "repeat", "load_kg": load, "reps": target_reps,
                "label": f"{load:g}kg", "detail": "No prior data -- starting weight",
            }],
            "recommended_type": "repeat",
            "why": "No prior data — starting weight",
        }

    hit_reps = (last.actual_reps or 0) >= (last.prescribed_reps or 0)
    # RIR is optional -- the logging UI doesn't always capture it. When present, use it as
    # an extra gate; when absent, reps-hit alone decides.
    rir_ok = last.rir is None or last.rir >= target_rir
    feel_ok = last.feel not in FEEL_BLOCKS_INCREASE
    load = last.actual_load_kg
    increased_load = round(load + SMALLEST_INCREMENT_KG, 1)

    options = [{
        "type": "repeat", "load_kg": round(load, 1), "reps": target_reps,
        "label": f"Repeat {load:g}kg", "detail": "Same weight -- aim for cleaner or more total reps",
    }]
    can_increase = hit_reps and rir_ok and feel_ok
    if can_increase:
        options.append({
            "type": "increase", "load_kg": increased_load, "reps": target_reps,
            "label": f"Increase to {increased_load:g}kg", "detail": f"+{SMALLEST_INCREMENT_KG:g}kg from last session",
        })
    options.append({
        "type": "technique_focus", "load_kg": round(load, 1), "reps": target_reps,
        "label": f"Technique focus at {load:g}kg", "detail": "Same weight, controlled tempo and full range of motion",
    })

    if not hit_reps or not rir_ok:
        recommended_type, why = "repeat", "Last session missed target — holding load"
    elif not feel_ok:
        recommended_type = "repeat"
        why = f"Reps were hit, but the final set felt {last.feel} — repeating to lock in quality before adding load"
    elif last.confidence_next == "no":
        recommended_type = "repeat"
        why = "Reps were hit, but you weren't confident going heavier — repeating to build that confidence"
    elif last.confidence_next == "maybe":
        recommended_type = "technique_focus"
        why = "Reps were hit and you were on the fence about going heavier — a clean, controlled repeat is a solid middle ground"
    else:
        recommended_type = "increase"
        detail = f"RIR {last.rir:g} at target, reps hit" if last.rir is not None else "reps hit"
        why = f"Last session: {detail} — progressing +{SMALLEST_INCREMENT_KG:g}kg"

    return {"options": options, "recommended_type": recommended_type, "why": why}


def _active_injury_regions(db: Session, user_id: int):
    rows = db.query(models.Injury).filter_by(user_id=user_id, active=True).all()
    return {r.body_region for r in rows}


def build_lift_day_prescription(db: Session, user_id: int, day: models.ProgramDay, readiness: models.ReadinessScore) -> dict:
    """Build a {label, exercises} lift prescription for an arbitrary ProgramDay,
    honoring today's readiness and injuries the same way generate_recommendation's
    lift branch does. Powers the Log tab's "Choose Saved Workout" flow so it reuses
    the same progression engine instead of replaying a stale, unadjusted template."""
    injury_regions = _active_injury_regions(db, user_id)
    set_multiplier = 0.8 if readiness.band == "amber" else 1.0

    exercises_out = []
    for item in day.template.get("exercises", []):
        ex = db.query(models.Exercise).get(item["exercise_id"])
        name = ex.name
        for region in injury_regions:
            sub = SUBSTITUTIONS.get(ex.name, {}).get(region)
            if sub:
                name = sub
                break

        progression = progression_options(
            db, user_id, item["exercise_id"], item["target_rir"], item["reps"], item["starting_load_kg"]
        )
        recommended = next(o for o in progression["options"] if o["type"] == progression["recommended_type"])
        sets = max(1, round(item["sets"] * set_multiplier))
        exercises_out.append({
            "exercise_id": item["exercise_id"],
            "name": name,
            "sets": sets,
            "reps": item["reps"],
            "load_kg": recommended["load_kg"],
            "target_rir": item["target_rir"],
        })

    return {"label": day.label, "exercises": exercises_out}


def _save_recommendation(db, user_id, date, session_type, prescription, reasoning, readiness):
    row = db.query(models.Recommendation).filter_by(user_id=user_id, date=date).first()
    if row is None:
        row = models.Recommendation(user_id=user_id, date=date)
        db.add(row)
    row.session_type = session_type
    row.prescription = prescription
    row.reasoning = reasoning
    row.readiness_score = readiness.score
    row.band = readiness.band
    db.commit()
    db.refresh(row)
    return row


def generate_recommendation(db: Session, user_id: int, date: dt.date, readiness: models.ReadinessScore) -> models.Recommendation:
    program = db.query(models.Program).filter_by(user_id=user_id, status="active").first()
    meso = (
        db.query(models.Mesocycle)
        .filter_by(program_id=program.id)
        .order_by(models.Mesocycle.index.desc())
        .first()
    )
    day = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id, weekday=date.weekday()).first()

    reasoning = [f"Readiness {readiness.score:g} ({readiness.band})"]
    injury_regions = _active_injury_regions(db, user_id)

    if day is None or day.day_type == "rest":
        return _save_recommendation(db, user_id, date, "rest", {"note": "Scheduled rest day"}, reasoning, readiness)

    if day.day_type == "recover":
        return _save_recommendation(
            db, user_id, date, "recover",
            {"note": "Active recovery: 20 min easy walk + mobility"}, reasoning, readiness,
        )

    if day.day_type == "lift":
        if readiness.band == "red":
            reasoning.append("Readiness low — swapping to active recovery instead of lifting")
            return _save_recommendation(
                db, user_id, date, "recover",
                {"note": "Active recovery: 20 min easy walk + mobility"}, reasoning, readiness,
            )

        set_multiplier = 1.0
        if readiness.band == "amber":
            set_multiplier = 0.8
            reasoning.append("Readiness moderate — volume trimmed ~20%")

        exercises_out = []
        for item in day.template.get("exercises", []):
            ex = db.query(models.Exercise).get(item["exercise_id"])
            name = ex.name
            for region in injury_regions:
                sub = SUBSTITUTIONS.get(ex.name, {}).get(region)
                if sub:
                    name = sub
                    reasoning.append(f"Substituted {ex.name} for {sub} — active {region.replace('_', ' ')} injury")
                    break

            progression = progression_options(
                db, user_id, item["exercise_id"], item["target_rir"], item["reps"], item["starting_load_kg"]
            )
            recommended = next(o for o in progression["options"] if o["type"] == progression["recommended_type"])
            sets = max(1, round(item["sets"] * set_multiplier))
            exercises_out.append(
                {
                    "exercise_id": item["exercise_id"],
                    "name": name,
                    "sets": sets,
                    "reps": item["reps"],
                    "load_kg": recommended["load_kg"],
                    "target_rir": item["target_rir"],
                    "progression_options": progression["options"],
                    "recommended_type": progression["recommended_type"],
                    "why": progression["why"],
                }
            )
            if len(reasoning) < 3:
                reasoning.append(progression["why"])

        return _save_recommendation(
            db, user_id, date, "lift",
            {"label": day.label, "exercises": exercises_out}, reasoning, readiness,
        )

    if day.day_type == "run":
        planned = day.template
        if readiness.band == "red":
            prescription = {"run_type": "recovery_jog", "duration_min": 20, "zone": 1}
            reasoning.append("Readiness low — capped to an easy zone 1 jog")
        elif readiness.band == "amber":
            prescription = {"run_type": "easy", "duration_min": planned.get("duration_min", 30), "zone": 2}
            reasoning.append("Readiness moderate — downgraded to an easy pace")
        else:
            prescription = planned
            reasoning.append("Readiness high — full session cleared")
        return _save_recommendation(db, user_id, date, "run", prescription, reasoning, readiness)

    return _save_recommendation(db, user_id, date, day.day_type, day.template, reasoning, readiness)
