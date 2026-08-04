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

## What's real here

- **Readiness scoring** — HRV/RHR z-scores against a rolling baseline, sleep vs.
  target, and a subjective check-in, weighted and banded exactly as documented.
- **Progressive overload** — logging a set today changes what's prescribed next
  session, based on the actual RIR/reps-hit rule.
- **Autoregulation** — an amber or red readiness band measurably changes the
  day's prescription (reduced volume, downgraded run intensity, or a swap to
  recovery) — try it: submit a poor Recovery Check-in and watch Today update.
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
