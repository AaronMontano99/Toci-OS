"""Braintrust eval for coach_chat.py ("Ask Toci"): checks off-topic
refusal, JSON-proposal presence/validity, and Ollama availability against
a copy of the real seeded DB (never the live toci.db, so eval runs never
pollute the user's actual conversation history or program).

Run with: braintrust eval evals/eval_coach_chat.py
"""

import shutil
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP_DIR))

from braintrust import Eval
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from toci import coach_chat, models

DEMO_USER_ID = 1
LIVE_DB = APP_DIR / "toci.db"
EVAL_DB = APP_DIR / "evals" / "_eval_scratch.db"

# Copied once per eval run (not per case) -- cheap, and keeps program/goals
# data identical to the real seeded demo user.
shutil.copyfile(LIVE_DB, EVAL_DB)
engine = create_engine(f"sqlite:///{EVAL_DB}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _fresh_session():
    """A session with this user's chat history wiped, so each eval case
    starts from a clean slate instead of seeing prior cases' messages as
    conversation history (coach_chat.chat() pulls the last 12 persisted
    messages as context)."""
    db = SessionLocal()
    db.query(models.ProgramChatMessage).filter_by(user_id=DEMO_USER_ID).delete()
    db.commit()
    return db


DATASET = [
    # -- off-topic: must be blocked without ever reaching the model --
    {"input": "What's the capital of France?", "expected": {"off_topic": True, "expects_proposal": False}},
    {"input": "Can you write me a poem about autumn?", "expected": {"off_topic": True, "expects_proposal": False}},
    {"input": "Debug this Python code for me: print(x", "expected": {"off_topic": True, "expects_proposal": False}},
    {"input": "What's the weather like tomorrow?", "expected": {"off_topic": True, "expects_proposal": False}},
    {"input": "Who is the president of Brazil?", "expected": {"off_topic": True, "expects_proposal": False}},

    # -- on-topic questions: should get a real answer, no proposal --
    {"input": "How many lift days are in my current program?", "expected": {"off_topic": False, "expects_proposal": False}},
    {"input": "What's my primary training goal right now?", "expected": {"off_topic": False, "expects_proposal": False}},
    {"input": "Give me a tip for improving my squat form.", "expected": {"off_topic": False, "expects_proposal": False}},

    # -- program-change requests: should produce a valid 7-day proposal --
    {"input": "Can you add an extra rest day to my program this week?", "expected": {"off_topic": False, "expects_proposal": True}},
    {"input": "Please increase the volume on my lift days.", "expected": {"off_topic": False, "expects_proposal": True}},
    {"input": "Swap one of my lift days for a running day.", "expected": {"off_topic": False, "expects_proposal": True}},

    # -- edge case: recipe wording that should NOT be caught by the
    # off-topic pre-filter's negative lookahead (protein/post-workout carve-out) --
    {"input": "Got a recipe for a good post-workout protein shake?", "expected": {"off_topic": False, "expects_proposal": False}},
]


def task(input):
    db = _fresh_session()
    try:
        result = coach_chat.chat(db, DEMO_USER_ID, input)
    finally:
        db.close()
    return {
        "reply": result["reply"],
        "has_proposal": result["proposal"] is not None,
        "unavailable": result["reply"] == coach_chat.UNAVAILABLE_MESSAGE,
    }


def off_topic_correct(input, output, expected):
    actual_off_topic = output["reply"] == coach_chat.OFF_TOPIC_MESSAGE
    return 1.0 if actual_off_topic == expected["off_topic"] else 0.0


def proposal_presence_correct(input, output, expected):
    if output["unavailable"]:
        return None  # Ollama down -- not a proposal-logic failure, exclude from this score
    return 1.0 if output["has_proposal"] == expected["expects_proposal"] else 0.0


def model_available(input, output, expected):
    return 0.0 if output["unavailable"] else 1.0


Eval(
    "toci-ask-toci-chat",
    data=DATASET,
    task=task,
    scores=[off_topic_correct, proposal_presence_correct, model_available],
)
