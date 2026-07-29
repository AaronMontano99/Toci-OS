# Toci OS

An adaptive AI fitness coach — not a workout tracker. It remembers your workouts, recovery, nutrition, cardio, and wearable data, and tells you exactly what to do each day: workout selection, weights, progression, or recovery.

**Lift. Run. Recover. Progress. Repeat.**

## What this is

Toci OS is a fully functional single-user prototype of an adaptive fitness
coaching product: a **FastAPI + SQLite backend** running a real,
deterministic coaching engine, driven by a **complete Expo/React Native
mobile app**. It's built to demonstrate the product concept end to end —
every screen is real, every piece of data comes from the backend, and
every everyday action (log a set, log food, track weight, set a goal, plan
your week) can be created, edited, and deleted, not just added once and
left alone. It's used for trying out the coaching UX and the recommendation
engine's logic firsthand, not as a production consumer app — see
[Known gaps](#known-gaps) for exactly where that line is.

## Status at a glance

| Layer | State |
|---|---|
| Mobile app (Expo / React Native / Expo Router) | **Working, feature-complete** — all 6 tabs, real CRUD throughout, runs in Expo Go or Expo web against the same FastAPI backend; see [`mobile/README.md`](mobile/README.md) |
| Backend (FastAPI + SQLite) | **Working** — the recommendation engine, all data endpoints, and the local demo web frontend; see [`app/README.md`](app/README.md) |
| Design system | **Toci Pastel Apricot**, dark-first, 8 fully switchable accent themes (Apricot, Mint, Blush, Butter, Sky, Coral, Cocoa, Graphite) applied consistently across every tab from one shared theme context |
| Data | Seeded with a **real training profile** (not placeholder demo data) — see below |
| Local AI features (Coach narration, Ask Toci, photo impressions) | Code complete with tested fallback paths; live model output not yet verified on this hardware — see [Known gaps](#known-gaps) |
| Tests / CI | 88 backend tests (pytest), 73 mobile tests (Jest + React Native Testing Library), `tsc`/`eslint` clean, GitHub Actions CI on every push/PR |

**Run the mobile app** (primary way to use this): see [`mobile/README.md`](mobile/README.md) — start the backend, then `cd mobile && npm install && npm run start`, and open in Expo Go or a browser (Expo web).
**Run the backend alone**, with its bundled vanilla-JS demo frontend: see [`app/README.md`](app/README.md) — `cd app && ... && uvicorn toci.main:app --reload`, then open `http://localhost:8000`.

Not production-ready — no auth, no real wearable data, no Postgres, no deployment. See [Known gaps](#known-gaps) before mistaking this for more than it is.

Full spec: **[docs/architecture.md](docs/architecture.md)** · Rendered: **[Toci OS — Architecture Draft v0.1](https://claude.ai/code/artifact/b02ac323-a8e3-43eb-a19f-4dae3b9fb897)**

## What actually works right now

Everything below is live in the mobile app (or the backend it talks to) — not a mockup, not mock data.

**The recommendation engine (`toci/engine.py`)**
- Readiness scoring — HRV/RHR z-scores against a rolling baseline, sleep vs. target, and a subjective check-in, weighted and banded exactly as documented in the architecture spec.
- Progressive overload — logging a set today changes what's prescribed next session, based on the actual RIR/reps-hit rule, not a fixed schedule.
- Autoregulation — an amber/red readiness band measurably trims volume, downgrades run intensity, or swaps to recovery.
- Injury-aware substitution — an active injury swaps out the affected lift on the next session that includes it.
- **Collaborative progression** — instead of silently picking a weight, the engine offers a few reasoned next-session options (repeat / increase / technique-focus), and logging feeds back `feel` (clean/difficult/sloppy/partial/assisted/pain) and `confidence_next` per set so the coaching stays grounded in how training actually felt, not just numbers hit.

**Everything you log can be fixed, not just added**
This was the last major pass on the app: for every "create" action, there's
now a matching edit and delete, wherever that makes sense.
- Logged lift sets can be edited or deleted in place, live, mid-workout.
- Past workout sessions and runs have a real detail/edit view (tap a
  Recent Session card) — fix a set, correct a run's distance/duration, or
  delete the whole session.
- Logged food entries can have their serving size corrected without
  delete-and-relog.
- Saved meals can be created from the mobile app (built from whatever's
  already logged that day), not just logged and deleted.
- Smart Cart items can be added and removed manually, not just
  auto-populated from recipes.
- The Nutrition tab has real date navigation (browse any day, not just
  today), a "copy previous day" / "clear this day" menu, and a Custom Food
  screen for foods that aren't in the catalog.
- Body-weight history entries can be edited or deleted, not just
  upserted for today.
- Goals can be renamed and deleted after creation.
- Scheduled days can be swapped (tap one day, tap another) to
  permanently rearrange the week's split.

**Real training data**
- Seeded with an actual profile (26M, 5'9", 201.3 lb, advanced/very-active) and a real 7-day split — Sunday Lower Body through Saturday Rest, including cardio finishers embedded in lift days and a full mobility checklist on the recovery day (`toci/seed.py`).
- Recent logged history matches stated real bests (squat 205×4×5, bench 185×5 with the real "fell off fast, backed off to 155" story, pull-ups 3×3+1×2) with `feel`/`confidence_next` populated, so the progression engine has real signal from day one instead of blank data.
- Goals tracked: bench back to 305 lb, run 3 miles continuously, 10 strict pull-ups.

**Program tab**
- Segmented Overview / Schedule / Goals / Coach tabs: a hero progress card, Today's Workout, a THIS WEEK day strip, goal-progress cards, a tap-to-expand weekly schedule with day-swapping, and deterministic Coach Observations (plateau/progression/adherence-trend detection), optionally rephrased in a warmer voice by a local LLM.
- **Progress photo timeline** — two explicit, permission-respecting actions: "Take Photo" and "Choose from Library." Each photo can get a short qualitative AI posture/build impression from a local vision model, with an honest fallback message when that's unavailable. No photos are ever pre-seeded — every timeline starts empty.
- **Ask Toci** — a conversational program-builder, restricted strictly to this user's own program/goals/training history. Off-topic requests are declined before the message ever reaches the model. Program-change requests get a structured JSON proposal — validated against the app's real exercise catalog — that must be explicitly **Applied** or **Discarded**; nothing changes automatically.

**Log tab**
- Lift and run logging with lb/kg unit switching, a rest timer, an exercise picker with on-the-fly substitution, and workout-split pictograms.
- Set logging captures weight/sets/reps plus the qualitative `feel` and `confidence_next` fields the collaborative progression engine reads.
- Recent Session cards open a real detail/edit view instead of being decorative.

**Today tab**
- Real Whoop/Spotify OAuth (native Authorization Code + PKCE flow), nutrition summary, and the daily recovery check-in.

**Nutrition tab**
- Food logging (barcode scan via Open Food Facts, custom foods, saved meals, quick add), smart search/favorites, an AI-personalized Recipe Hub (diet styles, restrictions, ingredient substitutions), and a Smart Cart shopping list that can be built from recipes or edited by hand.

**Profile tab**
- Overview / Goals / Prefs / Devices / Account segments, live preference toggles (injuries, goals, experience, equipment, units, diet, restrictions, household size, budget), account editing, and the accent-theme picker described below.

**Theming**
- One shared theme context drives every screen — no per-screen color logic. Switching accent (Profile → Appearance) or appearance mode (System/Light/Dark) changes the whole app instantly and persists across restarts (`AsyncStorage`). All 8 accents ship fully built, not just the default Apricot.

## Known gaps

- **Live local-AI output not verified**: Coach narration, Ask Toci, and photo AI impressions are fully coded with tested graceful-fallback paths (the app never hangs or breaks without them), but this machine has no pre-built Ollama package — `brew install ollama` compiles it and its `llama.cpp` dependency from source, which is slow on older/modest hardware. Vision models in particular are heavy; realistic expectations are set in `app/README.md`.
- **Ask Toci's scope guardrail** is a strong deterrent (pre-filter + system prompt), not a mathematically airtight guarantee against a determined adversarial prompt on a local open-weight model.
- **No auth** — single hardcoded demo user; the architecture doc's Sign in with Apple/Google plan isn't wired up, and the Profile → Account "Sign Out" control is explicitly a no-op that says so on screen.
- **No real wearable data** — HRV/RHR/sleep are simulated around a seeded baseline until manually overridden on the Recovery Check-in screen. Whoop/Spotify OAuth is real end to end, but this repo has never been linked to a real Whoop/Spotify developer app.
- **SQLite, not Postgres** — a one-line change in `toci/database.py` when that matters.
- **No training-load/ACWR tracking, no deload auto-trigger, no program version history** — this implements the readiness + progression core loop, not every table in the full architecture spec.
- **No migrations tooling, no deployment config.**
- **Qualitative goals aren't numerically tracked** — "improve posture," "look more athletic" etc. don't fit the Goal model's start→target progress bar, so they're intentionally not forced into it (addressed instead via the primary program focus and the recovery day's mobility work) rather than inventing a fake metric.
- **Native apps not started** — this is entirely the Expo/React Native mobile app plus the FastAPI backend; the original Kotlin Multiplatform/SwiftUI/Jetpack Compose plan (below) was superseded, not built.
- **Schedule rearranging is swap-only, not drag-and-drop** — a deliberate lighter-weight alternative that covers the same real need (permanently rearranging which day does what) without the added complexity; full drag-and-drop reordering was floated in the design doc but never built.

## Design

The app is built on the **[Toci Pastel Apricot Design System](docs/design-system.md)** (v1.1) — Apricot accent by default (7 more accents fully built and switchable), warm-ivory/near-black surfaces, Inter/Manrope type. All 6 tabs (Today, Log, Nutrition, Progress, Program, Profile) share hero cards, segmented sub-tabs, and sparkline/donut stat cards as the common visual language.

`docs/ui-concept.md` is the earlier "Subtle Gradient" concept pass, superseded by the above — kept for history, not current.

## Decisions locked

| Decision | Choice |
|---|---|
| Codebase strategy | **Expo / React Native (TypeScript, Expo Router)**, one codebase for iOS + Android — supersedes the original Kotlin Multiplatform + native SwiftUI/Compose plan below, to ship a real Expo Go app quickly against the existing FastAPI backend without a rewrite |
| Recommendation engine location | Server-side (unchanged — the mobile app is a pure client of it) |
| Recommendation engine approach | Deterministic rules engine, ML-ready |
| MVP data sources | Apple HealthKit + Google Health Connect (not yet wired into the Expo app — see `mobile/README.md`) |

## Stack

Expo · React Native · TypeScript · Expo Router · TanStack Query · Python + FastAPI · SQLite (Postgres-ready)

The original architecture draft (`docs/architecture.md`) specifies Kotlin
Multiplatform + native SwiftUI/Jetpack Compose UI; the mobile app actually
built is Expo/React Native instead, chosen to reuse the existing FastAPI
backend as-is and run in Expo Go without native toolchains. The backend,
data model, and recommendation engine described in that doc are otherwise
still accurate.

See [docs/architecture.md](docs/architecture.md) for the full breakdown: system architecture, tech stack rationale, database schema, and the recommendation engine's readiness scoring, training-load tracking, and progression rules.
