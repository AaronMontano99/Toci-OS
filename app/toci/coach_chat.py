"""Ask Toci: a conversational program-builder, scoped strictly to this app's
own domain (this user's training program, goals, and logged history) --
never a general-purpose assistant. Two layers enforce that, honestly
understood as a strong deterrent on a local open-weight model, not a
mathematically airtight guarantee:

  1. A pre-filter that recognizes obviously unrelated requests (trivia,
     coding, general Q&A) and declines them WITHOUT ever calling the model.
  2. A system prompt instructing the model to decline anything outside
     fitness/program/nutrition scope for this app, checked again after
     generation as a light second pass.

When the user asks for a program change, the model is asked to emit a
structured JSON proposal (day-by-day, exercises drawn only from this app's
own exercise catalog) alongside its conversational reply. That proposal is
strictly validated before it's ever shown, and it is only ever *applied* to
the real program on an explicit user action (see main.py's
POST /api/coach/chat/{id}/apply) -- same "propose options, user decides"
pattern used for set-by-set progression, never applied automatically.

Same resilience philosophy as coach.py/vision.py: if Ollama isn't running,
the model isn't pulled, or the call times out, the user gets a clear,
honest message -- never a hang, never a fabricated answer.
"""

import datetime as dt
import json
import re

import httpx
from sqlalchemy.orm import Session

from . import models

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "llama3.2"
OLLAMA_CHAT_TIMEOUT_S = 240.0  # a 7-day JSON proposal is a few hundred tokens; measured ~2 tok/s on
# CPU-only local hardware makes this a multi-minute wait in the worst case -- a ceiling, not a target.
# Faster hardware (or a smaller/quantized model) finishes well before it; this just keeps a legitimately
# slow-but-working response from being cut off.
HISTORY_MESSAGES_FOR_CONTEXT = 12
VALID_DAY_TYPES = {"lift", "run", "rest", "recover"}

UNAVAILABLE_MESSAGE = (
    "Ask Toci needs a local Ollama model to run (see app/README.md) — it isn't reachable right "
    "now, so I can't respond. Nothing was changed."
)
OFF_TOPIC_MESSAGE = (
    "I'm Toci, your training coach here — I can only help with your workout program, exercises, "
    "goals, and training history. Ask me about your program and I'll help."
)

# Deliberately conservative: patterns that are near-certainly NOT about this
# user's training program. This is the layer that runs before the model is
# even called -- a clean, guaranteed refusal for the obvious cases, not an
# attempt to catch every possible off-topic phrasing (the system prompt is
# the second layer for anything subtler).
_OFF_TOPIC_PATTERNS = [
    r"\bcapital of\b", r"\bpresident of\b", r"\bprime minister\b",
    r"\bwhat (year|century)\b", r"\bwho (is|was) the\b",
    r"\bweather (in|today|tomorrow)\b", r"\bstock price\b", r"\bexchange rate\b",
    r"\btranslate\b", r"\bwrite (a |me a )?(poem|song|essay|story)\b",
    r"\bwrite (some |a )?(code|python|javascript|sql)\b", r"\bdebug (this|my) code\b",
    r"\bmath (problem|homework)\b", r"\bsolve for x\b",
    r"\brecipe for\b(?!.*\b(protein|muscle|post-workout|pre-workout)\b)",
    r"\bmovie\b", r"\btv show\b", r"\bcelebrity\b", r"\bnews today\b",
]
_OFF_TOPIC_RE = re.compile("|".join(_OFF_TOPIC_PATTERNS), re.IGNORECASE)


def is_probably_off_topic(message: str) -> bool:
    return bool(_OFF_TOPIC_RE.search(message))


def _user_context_summary(db: Session, user_id: int) -> str:
    user = db.query(models.User).get(user_id)
    goals = db.query(models.Goal).filter_by(user_id=user_id).all()
    program = db.query(models.Program).filter_by(user_id=user_id, status="active").first()
    meso = None
    days = []
    if program:
        meso = (
            db.query(models.Mesocycle).filter_by(program_id=program.id)
            .order_by(models.Mesocycle.index.desc()).first()
        )
        if meso:
            days = db.query(models.ProgramDay).filter_by(mesocycle_id=meso.id).order_by(models.ProgramDay.weekday).all()

    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_lines = []
    for d in days:
        if d.day_type == "lift":
            ex_names = [e.get("exercise_id") for e in d.template.get("exercises", [])]
            day_lines.append(f"{weekday_names[d.weekday]}: {d.label} (lift) — {len(ex_names)} exercises")
        else:
            day_lines.append(f"{weekday_names[d.weekday]}: {d.label} ({d.day_type})")

    goal_lines = [f"- {g.title} ({g.kind})" for g in goals]

    return (
        f"User: {user.name}, age {user.age}, experience: {user.experience_level}, "
        f"equipment: {user.equipment}, primary focus: {user.goal}.\n"
        f"Current goals:\n" + ("\n".join(goal_lines) or "none set") + "\n"
        f"Current program ({meso.focus if meso else 'none'} phase):\n" + ("\n".join(day_lines) or "no active program")
    )


def _exercise_catalog(db: Session) -> list[str]:
    return [e.name for e in db.query(models.Exercise).order_by(models.Exercise.name).all()]


def _system_prompt(db: Session, user_id: int) -> str:
    catalog = _exercise_catalog(db)
    context = _user_context_summary(db, user_id)
    return (
        "You are Toci, an experienced strength & conditioning coach built into the Toci OS app. "
        "You ONLY discuss this user's training program, exercises, workout logging, recovery, and "
        "fitness goals within this app. You must politely decline ANY question outside that scope "
        "(general knowledge, trivia, current events, coding, math homework, other topics) with one "
        "short sentence redirecting back to their training, and nothing else -- do not answer the "
        "off-topic question even partially.\n\n"
        f"{context}\n\n"
        "Exercises you may use when proposing a program (use these exact names only -- never invent "
        "a new exercise name):\n" + ", ".join(catalog) + "\n\n"
        "When the user asks you to build, change, or redesign their program, respond conversationally "
        "AND include a machine-readable proposal in a fenced code block starting with ```json and "
        "ending with ```, matching exactly this shape (7 entries, one per weekday 0=Monday..6=Sunday):\n"
        '```json\n{"days": [{"weekday": 0, "day_type": "lift", "label": "...", '
        '"exercises": [{"exercise_name": "...", "sets": 3, "reps": 8}], '
        '"mobility_items": [], "note": null}, ... 7 entries ...]}\n```\n'
        "day_type must be one of lift/run/rest/recover. Only lift days use \"exercises\"; run days use "
        '"run_type", "duration_min", "zone" instead of "exercises"; rest/recover days may use '
        '"mobility_items" (a list of short strings) instead. Omit the JSON block entirely if the user '
        "isn't asking for a program change (e.g. just asking a question)."
    )


def _extract_proposal(text: str) -> dict | None:
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except (ValueError, TypeError):
        return None


def _strip_proposal_block(text: str) -> str:
    return re.sub(r"```json\s*\{.*?\}\s*```", "", text, flags=re.DOTALL).strip()


def validate_proposal(proposal: dict, exercise_names: set[str]) -> tuple[dict | None, str | None]:
    """Returns (normalized_proposal, None) if valid, or (None, error_message)."""
    days = proposal.get("days")
    if not isinstance(days, list) or len(days) != 7:
        return None, "The proposed program didn't include exactly 7 days — try asking again."

    seen_weekdays = set()
    normalized = []
    for day in days:
        weekday = day.get("weekday")
        day_type = day.get("day_type")
        label = day.get("label")
        if not isinstance(weekday, int) or not (0 <= weekday <= 6):
            return None, f"Invalid weekday in proposal: {weekday!r}"
        if weekday in seen_weekdays:
            return None, f"Weekday {weekday} appeared more than once in the proposal."
        seen_weekdays.add(weekday)
        if day_type not in VALID_DAY_TYPES:
            return None, f"Invalid day type in proposal: {day_type!r}"
        if not label or not isinstance(label, str):
            return None, "Every day in the proposal needs a label."

        entry = {"weekday": weekday, "day_type": day_type, "label": label}
        if day_type == "lift":
            exercises = day.get("exercises")
            if not isinstance(exercises, list) or not exercises:
                return None, f"{label} needs at least one exercise."
            normalized_exercises = []
            for ex in exercises:
                name = ex.get("exercise_name")
                if name not in exercise_names:
                    return None, f'"{name}" isn\'t in this app\'s exercise catalog — try rephrasing so Toci sticks to known exercises.'
                sets, reps = ex.get("sets"), ex.get("reps")
                if not isinstance(sets, int) or not (1 <= sets <= 10):
                    return None, f"Invalid set count for {name}."
                if not isinstance(reps, int) or not (1 <= reps <= 60):
                    return None, f"Invalid rep count for {name}."
                normalized_exercises.append({"exercise_name": name, "sets": sets, "reps": reps})
            entry["exercises"] = normalized_exercises
        elif day_type == "run":
            duration = day.get("duration_min", 20)
            zone = day.get("zone", 2)
            entry["duration_min"] = duration if isinstance(duration, int) and duration > 0 else 20
            entry["zone"] = zone if isinstance(zone, int) and 1 <= zone <= 5 else 2
        else:
            mobility = day.get("mobility_items", [])
            entry["mobility_items"] = [m for m in mobility if isinstance(m, str)] if isinstance(mobility, list) else []

        note = day.get("note")
        entry["note"] = note if isinstance(note, str) else None
        normalized.append(entry)

    if seen_weekdays != set(range(7)):
        return None, "The proposal didn't cover all 7 days of the week."

    return {"days": normalized}, None


_CHANGE_REQUEST_RE = re.compile(
    r"\b(add|remove|swap|replace|change|increase|decrease|reduce|more|less|update|build|redesign|"
    r"adjust|modify|rework)\b.*\b(program|day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"exercise|set|rep|volume|split|routine|workout)\b",
    re.IGNORECASE,
)


def _looks_like_change_request(message: str) -> bool:
    return bool(_CHANGE_REQUEST_RE.search(message))


def _request_structured_proposal(db: Session, user_id: int, message: str) -> dict | None:
    """A dedicated follow-up call using Ollama's JSON-constrained decoding
    (format="json") when the conversational reply didn't include a valid
    proposal block but the request clearly asked for a program change.
    Free-form prompting alone was unreliable at getting a small local model
    to emit well-formed structured output for a 7-day schema -- constrained
    decoding is meaningfully more reliable, at the cost of a second, equally
    slow round-trip on this hardware.
    """
    catalog = _exercise_catalog(db)
    context = _user_context_summary(db, user_id)
    prompt = (
        f"{context}\n\nExercises you may use (exact names only): {', '.join(catalog)}\n\n"
        f'The user asked: "{message}"\n\n'
        'Respond with ONLY a JSON object (no other text) of the shape: '
        '{"days": [{"weekday": 0, "day_type": "lift", "label": "...", '
        '"exercises": [{"exercise_name": "...", "sets": 3, "reps": 8}], '
        '"mobility_items": [], "note": null}, ... exactly 7 entries, weekday 0=Monday..6=Sunday ...]}. '
        "Keep all days from the current program the same except what the user asked to change. "
        'day_type must be lift/run/rest/recover; only lift days use "exercises"; run days use '
        '"run_type"/"duration_min"/"zone" instead; rest/recover days may use "mobility_items".'
    )
    try:
        resp = httpx.post(
            OLLAMA_CHAT_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "format": "json",
                "stream": False,
            },
            timeout=OLLAMA_CHAT_TIMEOUT_S,
        )
        resp.raise_for_status()
        raw = resp.json().get("message", {}).get("content", "").strip()
        return json.loads(raw)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


def chat(db: Session, user_id: int, message: str) -> dict:
    """Returns {reply, proposal, blocked}. Always persists the exchange."""
    db.add(models.ProgramChatMessage(user_id=user_id, role="user", content=message))
    db.commit()

    if is_probably_off_topic(message):
        db.add(models.ProgramChatMessage(user_id=user_id, role="assistant", content=OFF_TOPIC_MESSAGE))
        db.commit()
        return {"reply": OFF_TOPIC_MESSAGE, "proposal": None, "message_id": None}

    history = (
        db.query(models.ProgramChatMessage)
        .filter_by(user_id=user_id)
        .filter(models.ProgramChatMessage.role.in_(["user", "assistant"]))
        .order_by(models.ProgramChatMessage.id.desc())
        .limit(HISTORY_MESSAGES_FOR_CONTEXT)
        .all()
    )
    history.reverse()
    messages = [{"role": "system", "content": _system_prompt(db, user_id)}]
    messages += [{"role": m.role, "content": m.content} for m in history]

    try:
        resp = httpx.post(
            OLLAMA_CHAT_URL,
            json={"model": OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=OLLAMA_CHAT_TIMEOUT_S,
        )
        resp.raise_for_status()
        raw = resp.json().get("message", {}).get("content", "").strip()
    except (httpx.HTTPError, ValueError, KeyError):
        db.add(models.ProgramChatMessage(user_id=user_id, role="assistant", content=UNAVAILABLE_MESSAGE))
        db.commit()
        return {"reply": UNAVAILABLE_MESSAGE, "proposal": None, "message_id": None}

    proposal_raw = _extract_proposal(raw)
    reply_text = _strip_proposal_block(raw) or raw
    proposal, error = (None, None)
    exercise_names = set(_exercise_catalog(db))
    if proposal_raw is not None:
        proposal, error = validate_proposal(proposal_raw, exercise_names)
        if error:
            reply_text += f"\n\n(I tried to draft a program update but it didn't come out right: {error} Feel free to ask again.)"

    # The conversational reply sometimes describes a change without emitting
    # the requested JSON block -- free-form prompting alone isn't reliable
    # for structured output on a small local model. If this clearly was a
    # change request, make one dedicated follow-up call with constrained
    # JSON decoding before giving up on a proposal.
    if proposal is None and _looks_like_change_request(message):
        proposal_raw = _request_structured_proposal(db, user_id, message)
        if proposal_raw is not None:
            proposal, error = validate_proposal(proposal_raw, exercise_names)
            if error and "didn't come out right" not in reply_text:
                reply_text += f"\n\n(I tried to draft a program update but it didn't come out right: {error} Feel free to ask again.)"

    # Light second-pass safety net: if the message clearly matched an
    # off-topic pattern that somehow reached this point (it shouldn't, given
    # the pre-filter above runs first), don't show whatever the model said.
    if is_probably_off_topic(message):
        reply_text = OFF_TOPIC_MESSAGE
        proposal = None

    assistant_msg = models.ProgramChatMessage(
        user_id=user_id, role="assistant", content=reply_text,
        proposal_json=proposal, proposal_status="pending" if proposal else None,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return {
        "reply": reply_text,
        "proposal": proposal,
        "message_id": assistant_msg.id,
    }


def apply_proposal(db: Session, user_id: int, message_id: int) -> dict:
    msg = db.query(models.ProgramChatMessage).filter_by(id=message_id, user_id=user_id).first()
    if not msg or not msg.proposal_json:
        raise ValueError("No pending proposal on that message.")
    if msg.proposal_status != "pending":
        raise ValueError(f"This proposal was already {msg.proposal_status}.")

    exercises_by_name = {e.name: e.id for e in db.query(models.Exercise).all()}
    program = db.query(models.Program).filter_by(user_id=user_id, status="active").first()
    if not program:
        raise ValueError("No active program to update.")
    current_meso = (
        db.query(models.Mesocycle).filter_by(program_id=program.id)
        .order_by(models.Mesocycle.index.desc()).first()
    )
    new_index = (current_meso.index + 1) if current_meso else 1
    new_meso = models.Mesocycle(
        program_id=program.id, index=new_index,
        focus=current_meso.focus if current_meso else "general",
        weeks=current_meso.weeks if current_meso else 8,
        deload_week_index=current_meso.deload_week_index if current_meso else None,
    )
    db.add(new_meso)
    db.flush()

    for day in msg.proposal_json["days"]:
        template = {}
        if day["day_type"] == "lift":
            template["exercises"] = [
                {
                    "exercise_id": exercises_by_name[ex["exercise_name"]],
                    "sets": ex["sets"], "reps": ex["reps"],
                    "target_rir": 2, "starting_load_kg": 20.0,
                }
                for ex in day["exercises"]
            ]
        elif day["day_type"] == "run":
            template["run_type"] = "steady"
            template["duration_min"] = day["duration_min"]
            template["zone"] = day["zone"]
        else:
            template["mobility_items"] = day.get("mobility_items", [])
        if day.get("note"):
            template["note"] = day["note"]

        db.add(models.ProgramDay(
            mesocycle_id=new_meso.id, weekday=day["weekday"],
            day_type=day["day_type"], label=day["label"], template=template,
        ))

    msg.proposal_status = "applied"
    db.commit()
    return {"applied": True, "new_mesocycle_index": new_index}


def discard_proposal(db: Session, user_id: int, message_id: int) -> dict:
    msg = db.query(models.ProgramChatMessage).filter_by(id=message_id, user_id=user_id).first()
    if not msg or not msg.proposal_json:
        raise ValueError("No pending proposal on that message.")
    msg.proposal_status = "discarded"
    db.commit()
    return {"discarded": True}
