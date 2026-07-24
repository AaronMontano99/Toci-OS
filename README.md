# Toci OS

An adaptive AI fitness coach — not a workout tracker. It remembers your workouts, recovery, nutrition, cardio, and wearable data, and tells you exactly what to do each day: workout selection, weights, progression, or recovery.

**Lift. Run. Recover. Progress. Repeat.**

## Status

A working local demo exists: real readiness scoring, progressive overload, and autoregulation, running against a real (SQLite) database with a real UI you can log into and use.

**Run it:** see [`app/README.md`](app/README.md) — `cd app && ... && uvicorn toci.main:app --reload`, then open `http://localhost:8000`.

Not production-ready — no auth, no real wearable data, no Postgres, no deployment. See the "what's deliberately not production-ready" section in the app README for the full list before mistaking this for more than it is.

Full spec: **[docs/architecture.md](docs/architecture.md)**
Rendered version: **[Toci OS — Architecture Draft v0.1](https://claude.ai/code/artifact/b02ac323-a8e3-43eb-a19f-4dae3b9fb897)**

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
