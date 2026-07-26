"""Coach Observations: a small number of meaningful, data-grounded insights on
the Program dashboard.

Fact detection (`compute_observations`) is fully deterministic -- it only reports
patterns that are actually present in the user's own history, matching the rest
of this app's "explainable, no hallucination" design (see engine.py, nutrition.py).

`narrate` optionally rephrases those facts in a warmer coach voice via a local
Ollama model (free, no API key, runs on-device -- see app/README.md for setup).
If Ollama isn't installed/running, it falls back to a deterministic template
sentence per fact so the dashboard never breaks without it, and never invents
data the facts didn't contain.
"""

import datetime as dt

import httpx
from sqlalchemy.orm import Session

from . import models

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"
OLLAMA_TIMEOUT_S = 3.0
MAX_OBSERVATIONS = 5


def _top_sets_by_session(db: Session, user_id: int, exercise_id: int, limit: int = 6):
    """Most recent sessions' top set for one exercise, newest first."""
    rows = (
        db.query(models.WorkoutSet, models.WorkoutSession.date)
        .join(models.WorkoutSession, models.WorkoutSet.workout_session_id == models.WorkoutSession.id)
        .filter(
            models.WorkoutSession.user_id == user_id,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.actual_load_kg.isnot(None),
        )
        .order_by(models.WorkoutSession.date.desc(), models.WorkoutSet.actual_load_kg.desc())
        .all()
    )
    by_session = {}
    order = []
    for s, date in rows:
        if date not in by_session:
            by_session[date] = []
            order.append(date)
        by_session[date].append(s)
    top_sets = []
    for date in order[:limit]:
        sets = by_session[date]
        top = max(sets, key=lambda r: (r.actual_load_kg or 0))
        total_reps = sum(r.actual_reps or 0 for r in sets)
        top_sets.append({"date": date, "load_kg": top.actual_load_kg, "total_reps": total_reps})
    return top_sets  # newest first


def _progression_and_plateau_facts(db: Session, user_id: int):
    facts = []
    exercises = db.query(models.Exercise).join(
        models.WorkoutSet, models.WorkoutSet.exercise_id == models.Exercise.id
    ).distinct().all()

    for ex in exercises:
        top_sets = _top_sets_by_session(db, user_id, ex.id, limit=6)
        if len(top_sets) < 3:
            continue

        # streak: consecutive sessions (oldest -> newest among the recent window) with strictly increasing load
        chronological = list(reversed(top_sets))
        streak = 1
        for i in range(len(chronological) - 1, 0, -1):
            if chronological[i]["load_kg"] > chronological[i - 1]["load_kg"]:
                streak += 1
            else:
                break
        if streak >= 3:
            facts.append({
                "type": "progression_streak", "exercise_name": ex.name, "sessions": streak,
            })
            continue  # don't also report a plateau for the same exercise

        # plateau: last 3+ sessions at the same top load
        recent_loads = [s["load_kg"] for s in top_sets[:3]]
        if len(set(recent_loads)) == 1:
            reps_trend = top_sets[0]["total_reps"] - top_sets[2]["total_reps"]
            facts.append({
                "type": "plateau", "exercise_name": ex.name, "load_kg": recent_loads[0],
                "sessions": len([s for s in top_sets if s["load_kg"] == recent_loads[0]]),
                "reps_delta": reps_trend, "reps_from": top_sets[2]["total_reps"], "reps_to": top_sets[0]["total_reps"],
            })

    return facts


def _adherence_trend_fact(db: Session, user_id: int):
    program = db.query(models.Program).filter_by(user_id=user_id, status="active").first()
    if not program:
        return None
    meso = (
        db.query(models.Mesocycle)
        .filter_by(program_id=program.id)
        .order_by(models.Mesocycle.index.desc())
        .first()
    )
    by_weekday = {d.weekday: d for d in db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).all()}

    def window_adherence(start: dt.date):
        planned = matched = 0
        for i in range(7):
            d = start + dt.timedelta(days=i)
            if d >= dt.date.today():
                break
            pd = by_weekday.get(d.weekday())
            if pd and pd.day_type in ("lift", "run"):
                planned += 1
                model = models.WorkoutSession if pd.day_type == "lift" else models.CardioSession
                if db.query(model).filter_by(user_id=user_id, date=d).first():
                    matched += 1
        return (matched / planned) if planned else None

    today = dt.date.today()
    this_week = window_adherence(today - dt.timedelta(days=6))
    last_week = window_adherence(today - dt.timedelta(days=13))
    if this_week is None or last_week is None:
        return None
    delta = this_week - last_week
    if abs(delta) < 0.15:
        return None  # not a meaningful swing -- don't manufacture an observation
    return {
        "type": "adherence_trend", "direction": "up" if delta > 0 else "down",
        "this_week_pct": round(this_week * 100), "last_week_pct": round(last_week * 100),
    }


def compute_observations(db: Session, user_id: int) -> list[dict]:
    facts = _progression_and_plateau_facts(db, user_id)
    adherence = _adherence_trend_fact(db, user_id)
    if adherence:
        facts.append(adherence)
    return facts[:MAX_OBSERVATIONS]


def _template_sentence(fact: dict) -> str:
    t = fact["type"]
    if t == "progression_streak":
        return f"Your {fact['exercise_name']} has progressed for {fact['sessions']} consecutive sessions."
    if t == "plateau":
        if fact["reps_delta"] > 0:
            return (
                f"Your top {fact['exercise_name']} set has held at {fact['load_kg']:g}kg for "
                f"{fact['sessions']} sessions, but total reps rose from {fact['reps_from']} to "
                f"{fact['reps_to']} — still progressing even though the top weight hasn't moved."
            )
        return f"You've repeated {fact['load_kg']:g}kg on {fact['exercise_name']} for {fact['sessions']} sessions."
    if t == "adherence_trend":
        word = "up" if fact["direction"] == "up" else "down"
        return f"Weekly training adherence is {word}: {fact['last_week_pct']}% last week to {fact['this_week_pct']}% this week."
    return ""


def _fallback_narration(facts: list[dict]) -> list[str]:
    return [s for f in facts if (s := _template_sentence(f))]


def narrate(facts: list[dict]) -> list[str]:
    if not facts:
        return []

    lines = [f"{i + 1}. {_template_sentence(f)}" for i, f in enumerate(facts)]
    prompt = (
        "You are an experienced, warm strength & conditioning coach. Rephrase each of the "
        "following facts as one concise sentence in your own voice, in the SAME ORDER, one per line, "
        "numbered to match. Do not invent numbers or facts not given below. Do not add extra commentary, "
        "greetings, or lines.\n\n" + "\n".join(lines)
    )

    try:
        resp = httpx.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=OLLAMA_TIMEOUT_S,
        )
        resp.raise_for_status()
        text = resp.json().get("response", "").strip()
        rephrased = [ln.split(".", 1)[-1].strip(" .") for ln in text.splitlines() if ln.strip()]
        rephrased = [s for s in rephrased if s]
        if len(rephrased) == len(facts):
            return rephrased
    except (httpx.HTTPError, ValueError, KeyError):
        pass

    return _fallback_narration(facts)
