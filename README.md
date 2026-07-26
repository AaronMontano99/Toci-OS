# Toci OS

An adaptive AI fitness coach — not a workout tracker. It remembers your workouts, recovery, nutrition, cardio, and wearable data, and tells you exactly what to do each day: workout selection, weights, progression, or recovery.

**Lift. Run. Recover. Progress. Repeat.**

## Status

A working local demo exists: real readiness scoring, progressive overload, and autoregulation, running against a real (SQLite) database with a real UI you can log into and use. The Program tab is now a full coaching dashboard — program identity, progress, a tap-to-expand weekly structure, goal tracking, and deterministic Coach Observations (optionally narrated by a local, free LLM) — built around **collaborative progression**: instead of silently auto-picking a weight, it offers a few reasonable next-session options (repeat / increase / technique-focus) with reasoning, informed by how the last set actually felt.

**Run it:** see [`app/README.md`](app/README.md) — `cd app && ... && uvicorn toci.main:app --reload`, then open `http://localhost:8000`.

Not production-ready — no auth, no real wearable data, no Postgres, no deployment. See the "what's deliberately not production-ready" section in the app README for the full list before mistaking this for more than it is.

Full spec: **[docs/architecture.md](docs/architecture.md)**
Rendered version: **[Toci OS — Architecture Draft v0.1](https://claude.ai/code/artifact/b02ac323-a8e3-43eb-a19f-4dae3b9fb897)**

### Progress

Built so far, roughly in order:

- Core loop — readiness scoring, progressive overload, autoregulation, injury-aware substitution (FastAPI + SQLite backend, vanilla JS frontend)
- Lift/run logging — units (lb/kg), rest timer, exercise picker, workout-split pictograms
- Today tab — onboarding flow, real Spotify OAuth, wearable-connect stub, nutrition + check-in
- Nutrition — food logging (barcode scan, custom foods, saved meals), smart search/favorites/restaurants, AI-personalized Recipe Hub, Smart Cart shopping list
- **Program tab → coaching dashboard** (current) — collaborative Progression Decision Cards, goal tracking, weekly structure drill-down, deterministic Coach Observations with optional local-LLM narration

Still ahead for Program: an ongoing coach conversation ("Ask Toci"), physique photo progress tracking, adherence/consistency detail, recent-changes history, and page personalization — deferred from the current pass to keep each build reviewable.

## Design

UI concept for all 8 core screens (Onboarding, Today, Log a Lift, Log a Run, Recovery, Progress, Program, Settings), built on the [Subtle Gradient Design System](docs/design-system.md):

Full breakdown: **[docs/ui-concept.md](docs/ui-concept.md)**
Live, interactive version: **[Toci OS — UI Concept](https://claude.ai/code/artifact/d30e1511-5324-47f5-b913-b0a14a455339)**

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
