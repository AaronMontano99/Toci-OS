# Toci OS

An adaptive AI fitness coach — not a workout tracker. It remembers your workouts, recovery, nutrition, cardio, and wearable data, and tells you exactly what to do each day: workout selection, weights, progression, or recovery.

**Lift. Run. Recover. Progress. Repeat.**

## Status at a glance

| Layer | State |
|---|---|
| Local demo (FastAPI + SQLite + vanilla JS) | **Working** — real UI, real database, log in and use it today |
| UI | All 6 tabs structurally rebuilt on the **Toci Pastel Apricot** design system (dark by default) — hero cards, segmented sub-tabs, sparkline/donut stat cards; pixel-exact pass against the reference mockups still pending |
| Native apps (Kotlin Multiplatform / SwiftUI / Jetpack Compose) | Not started — this is the local demo the real apps will be built from |
| Data | Seeded with a **real training profile** (not placeholder demo data) — see below |
| Local AI features (Coach narration, Ask Toci, photo impressions) | Code complete with tested fallback paths; live model output not yet verified on this hardware — see [Known gaps](#known-gaps) |

**Run it:** see [`app/README.md`](app/README.md) — `cd app && ... && uvicorn toci.main:app --reload`, then open `http://localhost:8000`.

Not production-ready — no auth, no real wearable data, no Postgres, no deployment. See [Known gaps](#known-gaps) and the app README's "what's deliberately not production-ready" section before mistaking this for more than it is.

Full spec: **[docs/architecture.md](docs/architecture.md)** · Rendered: **[Toci OS — Architecture Draft v0.1](https://claude.ai/code/artifact/b02ac323-a8e3-43eb-a19f-4dae3b9fb897)**

## What actually works right now

Everything below is live in the running local demo — not a mockup. Run it yourself per [`app/README.md`](app/README.md).

**The recommendation engine (`toci/engine.py`)**
- Readiness scoring — HRV/RHR z-scores against a rolling baseline, sleep vs. target, and a subjective check-in, weighted and banded exactly as documented in the architecture spec.
- Progressive overload — logging a set today changes what's prescribed next session, based on the actual RIR/reps-hit rule, not a fixed schedule.
- Autoregulation — an amber/red readiness band measurably trims volume, downgrades run intensity, or swaps to recovery.
- Injury-aware substitution — an active injury swaps out the affected lift on the next session that includes it.
- **Collaborative progression** — instead of silently picking a weight, the engine offers a few reasoned next-session options (repeat / increase / technique-focus), and logging feeds back `feel` (clean/difficult/sloppy/partial/assisted/pain) and `confidence_next` per set so the coaching stays grounded in how training actually felt, not just numbers hit.

**Real training data**
- Seeded with an actual profile (26M, 5'9", 201.3 lb, advanced/very-active) and a real 7-day split — Sunday Lower Body through Saturday Rest, including cardio finishers embedded in lift days and a full mobility checklist on the recovery day (`toci/seed.py`).
- Recent logged history matches stated real bests (squat 205×4×5, bench 185×5 with the real "fell off fast, backed off to 155" story, pull-ups 3×3+1×2) with `feel`/`confidence_next` populated, so the progression engine has real signal from day one instead of blank data.
- Goals tracked: bench back to 305 lb, run 3 miles continuously, 10 strict pull-ups.

**Program dashboard**
- Segmented Overview / Schedule / Goals / Coach tabs: a hero progress card, Today's Workout, a THIS WEEK day strip, goal-progress sparkline cards, a tap-to-expand weekly structure, and deterministic Coach Observations (plateau/progression/adherence-trend detection), optionally rephrased in a warmer voice by a local LLM.
- **Progress photo timeline** — two explicit, permission-respecting actions: "Take Photo" (real `getUserMedia()` camera request — the browser's own permission prompt appears, with clear denied/no-camera messaging) and "Choose from Library" (native OS photo picker, which handles its own access permission). Each photo can get a short qualitative AI posture/build impression from a local vision model, with an honest fallback message when that's unavailable. No photos are ever pre-seeded — every timeline starts empty.
- **Ask Toci** — a conversational program-builder, restricted strictly to this user's own program/goals/training history. Off-topic requests (general trivia, coding, anything unrelated to this app) are declined before the message ever reaches the model. Program-change requests get a structured JSON proposal — validated against the app's real exercise catalog — that must be explicitly **Applied** or **Discarded**; nothing changes automatically, matching the same propose-then-approve pattern already used for set-by-set progression.

**Logging**
- Lift and run logging with lb/kg unit switching, a rest timer, an exercise picker, and workout-split pictograms.
- Set logging captures weight/sets/reps plus the qualitative `feel` and `confidence_next` fields the collaborative progression engine reads.

**Today tab**
- Onboarding flow, real Spotify OAuth (Authorization Code + PKCE, no client secret needed), a wearable-connect stub, nutrition summary, and the daily recovery check-in.

**Nutrition**
- Food logging (barcode scan via Open Food Facts, custom foods, saved meals), smart search/favorites/restaurant browsing, an AI-personalized Recipe Hub (diet styles, restrictions, ingredient substitutions), and a Smart Cart shopping list generated from planned meals.

## Known gaps

- **Live local-AI output not verified**: Coach narration, Ask Toci, and photo AI impressions are fully coded with tested graceful-fallback paths (the app never hangs or breaks without them), but this machine has no pre-built Ollama package — `brew install ollama` compiles it and its `llama.cpp` dependency from source, which is slow on older/modest hardware. Vision models in particular are heavy; realistic expectations are set in `app/README.md`.
- **Ask Toci's scope guardrail** is a strong deterrent (pre-filter + system prompt), not a mathematically airtight guarantee against a determined adversarial prompt on a local open-weight model.
- **No auth** — single hardcoded demo user; the architecture doc's Sign in with Apple/Google plan isn't wired up.
- **No real wearable data** — HRV/RHR/sleep are simulated around a seeded baseline until manually overridden on the Recovery Check-in screen.
- **SQLite, not Postgres** — a one-line change in `toci/database.py` when that matters.
- **No training-load/ACWR tracking, no deload auto-trigger, no program version history** — this implements the readiness + progression core loop, not every table in the full architecture spec.
- **No tests, no migrations tooling, no deployment config.**
- **Qualitative goals aren't numerically tracked** — "improve posture," "look more athletic" etc. don't fit the Goal model's start→target progress bar, so they're intentionally not forced into it (addressed instead via the primary program focus and the recovery day's mobility work) rather than inventing a fake metric.
- **Native apps not started** — this is entirely the local FastAPI/vanilla-JS demo; Kotlin Multiplatform/SwiftUI/Jetpack Compose are still just the planned target stack.
- **UI not yet pixel-exact** — every tab's layout was structurally rebuilt to match the reference mockups (hero cards, segmented sub-tabs, day strips, sparkline/donut stat cards, real data throughout), but a follow-up pass to match the reference screenshots exactly (spacing, icon choices, background treatment) hasn't been done yet.

## Design

The running app is built on the **[Toci Pastel Apricot Design System](docs/design-system.md)** (v1.1, dark by default) — Apricot accent, warm-ivory/near-black surfaces, Inter/Manrope type. All 6 tabs (Today, Log, Nutrition, Progress, Program, Profile) have been restructured to match a set of reference mockups (hero cards, segmented sub-tabs, sparkline/donut stat cards), not just recolored.

`docs/ui-concept.md` is the earlier "Subtle Gradient" concept pass, superseded by the above — kept for history, not current.

## Decisions locked

| Decision | Choice |
|---|---|
| Codebase strategy | Kotlin Multiplatform (KMM) core, native SwiftUI / Jetpack Compose UI |
| Recommendation engine location | Server-side |
| Recommendation engine approach | Deterministic rules engine, ML-ready |
| MVP data sources | Apple HealthKit + Google Health Connect |

## Stack (planned)

Kotlin Multiplatform · SwiftUI · Jetpack Compose · Python + FastAPI · PostgreSQL · Redis

See [docs/architecture.md](docs/architecture.md) for the full breakdown: system architecture, tech stack rationale, database schema, and the recommendation engine's readiness scoring, training-load tracking, and progression rules.
