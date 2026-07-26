# Toci OS — Local Demo

A real, running full-stack slice of Toci OS: FastAPI + SQLite backend implementing
the actual readiness-scoring and progressive-overload rules from
[`docs/architecture.md`](../docs/architecture.md), served alongside a vanilla
JS/HTML frontend built on the [Subtle Gradient Design System](../docs/design-system.md).

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
  Apple/Google plan isn't wired up.
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
    seed.py       demo user, exercise library, program, seed history
    main.py       FastAPI routes + serves web/ as static files
web/
  index.html, styles.css, app.js   vanilla JS SPA, no build step
  fonts/                            Manrope + Inter, self-hosted
```
