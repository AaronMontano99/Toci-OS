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
import math
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


def _strain_component(z: float) -> float:
    """z is signed so that positive = better recovered than usual. Sitting at your
    own baseline (or having no reading at all) is "no sign of strain" = 75, not 50:
    with 50, an ordinary day landed in amber (~66) and three ordinary days in a row
    tripped the slump escalation. Worse than usual falls off steeply (0 at -3 SD);
    better than usual only has room to reach 100."""
    return 75 + (z / 3.0) * (25 if z > 0 else 75)


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
    hrv_component = _strain_component(hrv_z)

    # Resting HR (15%) -- lower vs. baseline is better -> invert
    rhr_mean, rhr_std = rolling_baseline(db, user_id, date, "resting_hr_bpm")
    rhr_z = _zscore(recovery.resting_hr_bpm if recovery else None, rhr_mean, rhr_std)
    rhr_component = _strain_component(-rhr_z)

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


def readiness_trend(db: Session, user_id: int, date: dt.date, days: int = 7) -> dict:
    """A single day's band can't tell a one-off rough night from a real
    slump -- this looks at the last `days` saved ReadinessScore rows
    (today's included, once compute_readiness has saved it) to answer that.
    Powers both generate_recommendation's escalation below and Ask Toci's
    context (coach_chat.py), so the day-plan and the chat coach reason
    about the exact same numbers.

    consecutive_low_days: amber/red days in a row ending at `date`, walking
    backward and stopping at the first green day or the first day with no
    saved reading at all (an actual gap, not a bad reading, shouldn't count
    as "still struggling").
    direction: "improving"/"declining"/"stable", comparing the mean of the
    earlier half of the window to the later half -- a coarse trend, not a
    regression fit, which is all a handful of noisy daily scores supports.
    """
    start = date - dt.timedelta(days=days - 1)
    rows = (
        db.query(models.ReadinessScore)
        .filter(
            models.ReadinessScore.user_id == user_id,
            models.ReadinessScore.date >= start,
            models.ReadinessScore.date <= date,
        )
        .order_by(models.ReadinessScore.date.asc())
        .all()
    )
    by_date = {r.date: r for r in rows}

    consecutive_low_days = 0
    cursor = date
    while cursor in by_date and by_date[cursor].band in ("amber", "red"):
        consecutive_low_days += 1
        cursor -= dt.timedelta(days=1)

    direction = "stable"
    scores = [r.score for r in rows]
    if len(scores) >= 4:
        midpoint = len(scores) // 2
        earlier_avg = statistics.mean(scores[:midpoint])
        later_avg = statistics.mean(scores[midpoint:])
        if later_avg - earlier_avg >= 5:
            direction = "improving"
        elif earlier_avg - later_avg >= 5:
            direction = "declining"

    return {"consecutive_low_days": consecutive_low_days, "direction": direction, "days_considered": len(rows)}


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


def exercise_memory(db: Session, user_id: int, exercise_id: int, today: dt.date, exclude_session_id: int | None = None) -> dict:
    """Everything the coach should already remember about this exercise before
    the user lifts a single rep today: last time, best ever, how long it's
    been. Powers a conversational logging intro instead of a blank form --
    the same underlying WorkoutSet history progression_options() reads, just
    shaped for "what happened last time" rather than "what to do next".

    exclude_session_id excludes one session's own sets from the history it
    reports -- needed by the post-workout screens, which call this endpoint
    after that session's sets are already committed. Without it, "last/best"
    would compare a session against itself instead of against real history."""
    query = (
        db.query(models.WorkoutSet, models.WorkoutSession.date)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(
            models.WorkoutSession.user_id == user_id,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.actual_load_kg.isnot(None),
            models.WorkoutSet.actual_reps.isnot(None),
        )
    )
    if exclude_session_id is not None:
        query = query.filter(models.WorkoutSession.id != exclude_session_id)
    rows = (
        query
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


def _last_session_sets(db: Session, user_id: int, exercise_id: int, date: dt.date):
    """Every logged set of this exercise from its most recent session date."""
    return (
        db.query(models.WorkoutSet)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(
            models.WorkoutSession.user_id == user_id,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.actual_load_kg.isnot(None),
            models.WorkoutSession.date == date,
        )
        .all()
    )


def _last_session_date(db: Session, user_id: int, exercise_id: int):
    row = (
        db.query(models.WorkoutSession.date)
        .join(models.WorkoutSet, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(models.WorkoutSession.user_id == user_id, models.WorkoutSet.exercise_id == exercise_id,
                models.WorkoutSet.actual_load_kg.isnot(None))
        .order_by(models.WorkoutSession.date.desc())
        .first()
    )
    return row[0] if row else None


def _last_session_date_before(db: Session, user_id: int, exercise_id: int, date: dt.date):
    row = (
        db.query(models.WorkoutSession.date)
        .join(models.WorkoutSet, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(models.WorkoutSession.user_id == user_id, models.WorkoutSet.exercise_id == exercise_id,
                models.WorkoutSet.actual_load_kg.isnot(None), models.WorkoutSession.date < date)
        .order_by(models.WorkoutSession.date.desc())
        .first()
    )
    return row[0] if row else None


DELOAD_FACTOR = 0.9

# Strength mostly holds for about three weeks off; past that, coming back at the
# old weight (let alone heavier) is how people get hurt. Come back lighter instead.
LAYOFF_DAYS = 21
LAYOFF_LOAD_FACTOR = 0.9

# feel ratings that mean "don't add load yet, even if reps were technically hit"
FEEL_BLOCKS_INCREASE = {"sloppy", "partial", "assisted", "pain"}


def progression_options(db: Session, user_id: int, exercise_id: int, target_rir: float, target_reps, starting_load_kg: float,
                        today: dt.date | None = None):
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

    last_date = _last_session_date(db, user_id, exercise_id)
    days_off = (today - last_date).days if today and last_date else 0
    if days_off >= LAYOFF_DAYS:
        back = round(math.floor(last.actual_load_kg * LAYOFF_LOAD_FACTOR / SMALLEST_INCREMENT_KG) * SMALLEST_INCREMENT_KG, 1)
        why = f"{days_off} days since you last did this — coming back at {back:g}kg (about 90%) to rebuild before adding load"
        return {
            "options": [{"type": "repeat", "load_kg": back, "reps": target_reps, "label": f"Ease back in at {back:g}kg", "detail": why}],
            "recommended_type": "repeat",
            "why": why,
        }

    # Judge the whole last session, not just its heaviest set: with straight sets
    # every set shares a load, so "the top set" was really just set 1 -- the
    # freshest one -- and a missed final set still earned an increase.
    session = _last_session_sets(db, user_id, exercise_id, last_date) if last_date else [last]
    hit_reps = all((s.actual_reps or 0) >= (s.prescribed_reps or 0) for s in session)

    # Two sessions in a row missing reps at the same weight: repeating it a third
    # time rarely works. Reset about 10% and build back up.
    if not hit_reps and last_date:
        before = _last_session_date_before(db, user_id, exercise_id, last_date)
        earlier = _last_session_sets(db, user_id, exercise_id, before) if before else []
        if earlier and not all((s.actual_reps or 0) >= (s.prescribed_reps or 0) for s in earlier) \
                and max(s.actual_load_kg for s in earlier) >= last.actual_load_kg:
            reset = round(math.floor(last.actual_load_kg * DELOAD_FACTOR / SMALLEST_INCREMENT_KG) * SMALLEST_INCREMENT_KG, 1)
            why = f"Missed reps two sessions running at {last.actual_load_kg:g}kg — resetting to {reset:g}kg to build back up"
            return {
                "options": [{"type": "deload", "load_kg": reset, "reps": target_reps, "label": f"Reset to {reset:g}kg", "detail": why},
                            {"type": "repeat", "load_kg": round(last.actual_load_kg, 1), "reps": target_reps,
                             "label": f"Repeat {last.actual_load_kg:g}kg", "detail": "Same weight, third attempt"}],
                "recommended_type": "deload",
                "why": why,
            }
    # RIR is optional -- the logging UI doesn't always capture it. When present, use it as
    # an extra gate; when absent, reps-hit alone decides.
    rir_ok = last.rir is None or last.rir >= target_rir
    blocking = next((s.feel for s in session if s.feel in FEEL_BLOCKS_INCREASE), None)
    feel_ok = blocking is None
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
        why = f"Reps were hit, but a set felt {blocking} — repeating to lock in quality before adding load"
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


def _user_exercise_substitutions(db: Session, user_id: int) -> dict:
    """The user's standing "swap this for that" preferences (from Swap Movement),
    keyed by the original exercise_id, valued by the real substitute Exercise row --
    so, unlike the hardcoded injury map, this can change both the exercise_id and
    the name a prescription reports, and future sets log against the substitute."""
    rows = (
        db.query(models.ExerciseSubstitution, models.Exercise)
        .join(models.Exercise, models.ExerciseSubstitution.substitute_exercise_id == models.Exercise.id)
        .filter(models.ExerciseSubstitution.user_id == user_id)
        .all()
    )
    return {sub.original_exercise_id: exercise for sub, exercise in rows}


def _resolve_exercise(ex: models.Exercise, injury_regions: set, user_subs: dict):
    """Injury-driven substitution (safety) takes precedence over a user's
    standing preference. Returns (exercise_id, name, injury_reason_or_None)."""
    for region in injury_regions:
        sub_name = SUBSTITUTIONS.get(ex.name, {}).get(region)
        if sub_name:
            return ex.id, sub_name, f"Substituted {ex.name} for {sub_name} — active {region.replace('_', ' ')} injury"

    preferred = user_subs.get(ex.id)
    if preferred:
        return preferred.id, preferred.name, None

    return ex.id, ex.name, None


def build_lift_day_prescription(db: Session, user_id: int, day: models.ProgramDay, readiness: models.ReadinessScore,
                                date: dt.date | None = None) -> dict:
    """Build a {label, exercises} lift prescription for an arbitrary ProgramDay,
    honoring today's readiness and injuries the same way generate_recommendation's
    lift branch does. Powers the Log tab's "Choose Saved Workout" flow so it reuses
    the same progression engine instead of replaying a stale, unadjusted template."""
    injury_regions = _active_injury_regions(db, user_id)
    user_subs = _user_exercise_substitutions(db, user_id)
    # This path is reached when the user explicitly picks a saved workout
    # despite today's readiness (generate_recommendation would otherwise have
    # swapped a scheduled lift day to recovery) -- respect that choice rather
    # than block it, but still trim harder than a plain amber day when it's
    # part of a real slump (see readiness_trend), not just today's reading.
    date = date or readiness.date or dt.date.today()
    trend = readiness_trend(db, user_id, date)
    slumping = trend["consecutive_low_days"] >= 3 and readiness.band != "green"
    if slumping:
        set_multiplier = 0.6
    elif readiness.band == "amber":
        set_multiplier = 0.8
    else:
        set_multiplier = 1.0

    exercises_out = []
    for item in day.template.get("exercises", []):
        ex = db.query(models.Exercise).get(item["exercise_id"])
        exercise_id, name, _ = _resolve_exercise(ex, injury_regions, user_subs)

        # Progression reads the resolved exercise's own history -- if it's a
        # persisted substitution, that's a different real exercise_id, and
        # future sets log against it, so the coach should reason about its
        # own history, not the original movement's.
        progression = progression_options(
            db, user_id, exercise_id, item["target_rir"], item["reps"], item["starting_load_kg"], today=date
        )
        recommended = next(o for o in progression["options"] if o["type"] == progression["recommended_type"])
        sets = max(1, round(item["sets"] * set_multiplier))
        exercises_out.append({
            "exercise_id": exercise_id,
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
    trend = readiness_trend(db, user_id, date)
    # 3+ amber/red days running is a real slump, not a rough night -- worth
    # reacting to more than one more day's single reading would justify on
    # its own. Escalates amber to the same handling as red; red itself was
    # already the most conservative branch, so it's unaffected.
    slumping = trend["consecutive_low_days"] >= 3 and readiness.band != "green"

    if day is None or day.day_type == "rest":
        return _save_recommendation(db, user_id, date, "rest", {"note": "Scheduled rest day"}, reasoning, readiness)

    if day.day_type == "recover":
        return _save_recommendation(
            db, user_id, date, "recover",
            {"note": "Active recovery: 20 min easy walk + mobility"}, reasoning, readiness,
        )

    if day.day_type == "lift":
        if readiness.band == "red" or slumping:
            if slumping and readiness.band != "red":
                reasoning.append(
                    f"{trend['consecutive_low_days']} days of low readiness in a row — taking a full "
                    "recovery day instead of trimming volume, rather than let it compound"
                )
            else:
                reasoning.append("Readiness low — swapping to active recovery instead of lifting")
            return _save_recommendation(
                db, user_id, date, "recover",
                {"note": "Active recovery: 20 min easy walk + mobility"}, reasoning, readiness,
            )

        set_multiplier = 1.0
        if readiness.band == "amber":
            set_multiplier = 0.8
            reasoning.append("Readiness moderate — volume trimmed ~20%")

        user_subs = _user_exercise_substitutions(db, user_id)
        exercises_out = []
        for item in day.template.get("exercises", []):
            ex = db.query(models.Exercise).get(item["exercise_id"])
            exercise_id, name, injury_reason = _resolve_exercise(ex, injury_regions, user_subs)
            if injury_reason:
                reasoning.append(injury_reason)

            progression = progression_options(
                db, user_id, exercise_id, item["target_rir"], item["reps"], item["starting_load_kg"], today=date
            )
            recommended = next(o for o in progression["options"] if o["type"] == progression["recommended_type"])
            sets = max(1, round(item["sets"] * set_multiplier))
            exercises_out.append(
                {
                    "exercise_id": exercise_id,
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
        if readiness.band == "red" or slumping:
            prescription = {"run_type": "recovery_jog", "duration_min": 20, "zone": 1}
            if slumping and readiness.band != "red":
                reasoning.append(
                    f"{trend['consecutive_low_days']} days of low readiness in a row — capping to an easy "
                    "zone 1 jog rather than let it compound"
                )
            else:
                reasoning.append("Readiness low — capped to an easy zone 1 jog")
        elif readiness.band == "amber":
            prescription = {"run_type": "easy", "duration_min": planned.get("duration_min", 30), "zone": 2}
            reasoning.append("Readiness moderate — downgraded to an easy pace")
        else:
            prescription = planned
            reasoning.append("Readiness high — full session cleared")
        return _save_recommendation(db, user_id, date, "run", prescription, reasoning, readiness)

    return _save_recommendation(db, user_id, date, day.day_type, day.template, reasoning, readiness)
