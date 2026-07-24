# UI Concept

High-fidelity concept for all 8 core Toci OS screens, built on the [Subtle Gradient Design System](design-system.md).

**Live, interactive version: [Toci OS — UI Concept](https://claude.ai/code/artifact/d30e1511-5324-47f5-b913-b0a14a455339)**

Platform-agnostic on purpose — this is the shared visual language, not literal iOS or Android chrome. Native gestures and chrome (navigation patterns, system controls) adapt per Apple HIG / Material once built in SwiftUI and Jetpack Compose.

## Screens

| # | Screen | What it shows |
|---|---|---|
| 01 | **Onboarding** | One representative step (goal selection) from the six-step flow: goal, experience level, equipment access, injury history, baseline lifts, connect HealthKit/Health Connect. |
| 02 | **Today (Home)** | The screen the whole product hinges on — readiness ring, the primary recommended session with its reasoning, and the week at a glance. |
| 03 | **Log a Lift Session** | Active set logging: prescribed weight/reps pre-filled from the recommendation engine, RIR capture, rest timer, running set log for the exercise. |
| 04 | **Log a Run** | Live pace, distance, and HR zone against today's prescribed target. |
| 05 | **Recovery Check-in** | HRV, resting HR, and sleep pulled in automatically; soreness and mood are the only two taps — this feeds the readiness score. |
| 06 | **Progress** | Single-series trend chart per category (strength / volume / body / runs), hover for exact values, recent PR list. |
| 07 | **Program** | The active mesocycle's current week, with the scheduled deload flagged in advance. |
| 08 | **Settings** | Profile, equipment, injuries, connected data sources, notifications — grouped the way they're actually edited. |

## Notes on the design system

Two things extend beyond what [`design-system.md`](design-system.md) specifies:

- **Dark mode.** The source doc is light/white-only. A dark theme was derived from the same brand violet and success green — token math is in the CSS comments of the artifact so it's clear what's sourced vs. extended.
- **Warning and critical status colors.** The doc defines success (green) and neutral badges only. Amber (warning — e.g. an active injury tag) and red (critical — e.g. a low readiness band) were added using the same formula as the existing green badge: ~15% opacity background, a darker saturated text color.
