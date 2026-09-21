# Toci OS — Local Demo

A real, running full-stack slice of Toci OS: FastAPI + SQLite backend implementing
the actual readiness-scoring and progressive-overload rules from
[`docs/architecture.md`](../docs/architecture.md), served alongside a vanilla
JS/HTML frontend built on the [Toci Pastel Apricot Design System](../docs/design-system.md)
(dark by default).

### UI status

Every tab (Today, Log, Nutrition, Progress, Program, Profile) has been
structurally rebuilt — not just recolored — to match the reference mockups in
`docs/`: hero cards, segmented sub-tabs (e.g. Program's Overview/Schedule/Goals/Coach,
Profile's Overview/Goals/Preferences/Devices/Account), day strips, sparkline stat
cards, and macro donut rings. All of it renders real data from the existing
endpoints — untracked metrics (steps, water, sleep) are labeled honestly rather
than invented, and Profile now has a working Light/Dark/System appearance
picker. A full pixel-exact pass against the original reference screenshots is
still pending (structural layout matches; some spacing/icon/background details
don't yet).

## Run it

```
cd app
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m toci.seed              # one-time: creates the demo user + program
uvicorn toci.main:app --reload
```

Open **http://localhost:8000** — that's the whole app, frontend and API on one port.

To start over with fresh seed data: `python -m toci.seed --reset`.

### Optional: real coach narration via a local LLM

The Program tab's "Coach Observations" are computed deterministically (same
"explainable, no hallucination" philosophy as the readiness/progression engine —
see `toci/coach.py`), then optionally rephrased in a warmer voice by a **local**
Ollama model — free, no API key, no cloud calls:

```
brew install ollama
ollama pull llama3.2
ollama serve                     # leave running in a separate terminal
```

If Ollama isn't installed or running, `coach.narrate()` automatically falls back
to plain deterministic template sentences — the dashboard works either way.

### Optional: Ask Toci (program-builder chat) and progress-photo AI impressions

Two more features use local Ollama models, same resilience rule as above —
each fails into a clear, honest message rather than a hang or a fabricated
answer if the model isn't available:

- **Ask Toci** (`toci/coach_chat.py`) — a chat in the Program tab, scoped
  strictly to this user's own program/goals/history. It refuses anything
  outside that scope (a pre-filter blocks obvious off-topic requests before
  the model is ever called; the system prompt handles subtler cases) — this
  is a strong deterrent on a local open-weight model, not an airtight
  guarantee. Program-change requests get a structured proposal you must
  explicitly **Apply** or **Discard** — nothing is changed automatically.
  Uses the same `llama3.2` text model as Coach Observations above.
- **Progress photos** — "Take Photo" requests real camera access
  (`getUserMedia()`, so the browser's own permission prompt appears);
  "Choose from Library" uses the native file/photo picker, which handles
  photo-library access itself. Each photo optionally gets a short qualitative
  AI impression from a vision-capable local model:
  ```
  ollama pull llava
  ```
  **Heads up:** vision models are considerably heavier than `llama3.2`. On
  modest hardware (no GPU, <16GB RAM) this may be impractically slow — the
  call times out gracefully either way, and the photo still saves with no
  AI note. No photos are ever pre-seeded; every user's timeline starts empty.

Neither of these requires Homebrew to have a pre-built bottle for your
machine — if not, `brew install ollama` will compile it (and its
`llama.cpp` dependency) from source, which can take a long time on older
hardware.

### Evaluating Ask Toci with Braintrust

`evals/eval_coach_chat.py` is a [Braintrust](https://braintrust.dev) eval for
`coach_chat.py` — it runs a fixed set of off-topic, on-topic, and
program-change-request messages through the real `chat()` function against a
scratch copy of the seeded DB (never the live `toci.db`, so eval runs never
pollute real conversation history), then scores:

- **`off_topic_correct`** — does the off-topic pre-filter block what it
  should and let through what it shouldn't
- **`proposal_presence_correct`** — does a program-change request produce a
  validated JSON proposal, and does everything else *not* produce one
- **`model_available`** — did Ollama actually respond, vs. falling back to
  the "unavailable" message

Run it:

```
pip install braintrust autoevals   # one-time, into this venv
echo "BRAINTRUST_API_KEY=bt_..." > .env.braintrust   # from braintrust.dev → Settings → API Keys; gitignored
set -a; source .env.braintrust; set +a
ollama serve &                     # if not already running
braintrust eval evals/eval_coach_chat.py
```

**Use `--num-workers 1`.** This machine's Ollama runs a single inference
slot — Braintrust's default worker count (one per CPU core) fires multiple
test cases at Ollama concurrently, which just queues behind that one slot.
Since the client-side timeout counts from when a request is *sent*, not when
Ollama starts on it, queued requests can spuriously time out with zero
relation to actual generation speed. Confirmed by comparison: concurrent runs
put `model_available` anywhere from 75-92% (queueing noise); serialized with
`--num-workers 1` it settled at a consistent 91.7%. The remaining ~8% is a
real hardware limit, not a bug — CPU-only generation here runs ~3 tok/s, and
the slowest path (a structured JSON proposal, sometimes two Ollama round
trips) can occasionally still clear the 240s timeout on its own, serialized
or not.

So far this eval has driven three real changes, all landed in `coach_chat.py`:
1. The off-topic pre-filter's regexes required matched words to sit
   immediately adjacent, missing natural phrasing like "weather **like**
   tomorrow" or "debug this **Python** code" — fixed by allowing a small gap
   between them. Took `off_topic_correct` to 100%.
2. Ollama calls had no seed/temperature pinned, making the JSON-proposal path
   non-deterministic. Pinning `{"seed": 42, "temperature": 0}` improved
   `proposal_presence_correct` to 90.9% (measured serialized).
3. Ask Toci's system prompt only carried static profile/program shape — it
   had no way to know if readiness had been trending down, whether the last
   week's sessions were actually getting logged, or whether a lift had
   stalled, even though that data already existed elsewhere in the app.
   `_recent_feedback_summary()` now folds all three into every prompt (same
   `engine.readiness_trend()` the day-plan escalation below reads, so the
   chat and the actual recommendation never disagree). Confirmed serialized:
   `model_available` 100%, `off_topic_correct` 100%, `proposal_presence_correct`
   92.31% (13 cases) — no regression from the longer prompt, at the cost of
   a real, expected latency increase on this CPU-only hardware from more
   context to process per call.

## What's real here

- **Readiness scoring** — HRV/RHR z-scores against a rolling baseline, sleep vs.
  target, and a subjective check-in, weighted and banded exactly as documented.
- **Progressive overload** — logging a set today changes what's prescribed next
  session, based on the actual RIR/reps-hit rule.
- **Autoregulation** — an amber or red readiness band measurably changes the
  day's prescription (reduced volume, downgraded run intensity, or a swap to
  recovery) — try it: submit a poor Recovery Check-in and watch Today update.
  A single rough day and a real slump aren't treated the same way either:
  `engine.readiness_trend()` counts consecutive amber/red days, and 3+ in a
  row escalates an amber day to the same handling red gets on its own
  (full recovery swap, or a capped zone 1 jog) rather than just trimming
  volume again.
- **Injury-aware substitution** — add a shoulder injury in Settings and Bench
  Press gets swapped on the next lift day that includes it.
- **Persistence** — everything is a real SQLite row. Refresh the page, restart
  the server — your logged sets, runs, and check-ins are still there.

## What's deliberately not production-ready

This is a local demo, not a deployable build:

- **No auth.** Single hardcoded demo user — the architecture doc's Sign in with
  Apple/Google plan isn't wired up. (Whoop/Spotify OAuth client secrets and
  access/refresh tokens *are* encrypted at rest in SQLite — see
  `toci/crypto.py` — via a key auto-generated into a gitignored
  `app/.encryption_key` on first run, or set `TOCI_ENCRYPTION_KEY` yourself.
  That's independent of the "no auth" gap above: it protects the stored
  provider credentials, not who can call this API.)
- **No real wearable data.** There's no HealthKit/Health Connect on a laptop, so
  HRV/RHR/sleep are simulated around a seeded baseline until you override them
  on the Recovery Check-in screen.
- **SQLite, not Postgres.** Swapping is a one-line change in `toci/database.py`
  (`DATABASE_URL`) — SQLite just needs zero setup for a local run.
- **No training-load/ACWR tracking, no deload auto-trigger, no compaction of the
  full production schema** — this implements the readiness + progression core
  loop from §07, not every table in §06.
- **No tests, no migrations tooling, no deployment config.**

## Structure

```
app/
  requirements.txt
  toci/
    database.py   SQLAlchemy engine/session (SQLite)
    models.py     ORM models (subset of docs/architecture.md §06)
    schemas.py    Pydantic request/response shapes
    engine.py     the recommendation engine (docs/architecture.md §07, as code)
    coach.py      Program-tab coach observations: deterministic facts + optional local-LLM narration
    coach_chat.py Ask Toci: scoped program-builder chat + structured proposal validation/apply
    vision.py     progress-photo AI impressions via a local vision model, with graceful fallback
    seed.py       demo user, exercise library, program, seed history
    main.py       FastAPI routes + serves web/ as static files
  uploads/progress_photos/   user-uploaded photos (gitignored -- never committed)
web/
  index.html, styles.css, app.js   vanilla JS SPA, no build step
  fonts/                            Manrope + Inter, self-hosted
```
