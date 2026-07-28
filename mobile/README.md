# Toci — Expo mobile app

The mobile-first migration of Toci OS: TypeScript, React Native, Expo Router,
built to run in **Expo Go** on iOS and Android. It talks to the same
FastAPI backend in [`../app`](../app) — no backend logic was rewritten,
only consumed. See [`../docs/design-system.md`](../docs/design-system.md)
(the Toci Pastel Apricot design system) for the visual language this app
implements, and [`../docs/architecture.md`](../docs/architecture.md) for the
product's broader shape.

## Run it

1. Start the backend first (see [`../app/README.md`](../app/README.md)):

   ```
   cd ../app
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python -m toci.seed
   uvicorn toci.main:app --host 0.0.0.0 --port 8000
   ```

2. Point the app at it and start Expo:

   ```
   cd mobile
   npm install
   npm run start
   ```

   Open in **Expo Go** by scanning the QR code, or press `i`/`a` for a
   simulator/emulator.

### Connecting to the backend

The backend isn't bundled into the app — it's a separate process the app
calls over HTTP, same as the existing `web/` frontend does. The API base
URL is read from `EXPO_PUBLIC_API_URL`:

- **iOS Simulator / Android Emulator**: no setup needed — the app infers
  the right loopback host automatically (`localhost` on iOS, `10.0.2.2` on
  Android) from the Metro dev server's own address.
- **Physical device in Expo Go**: your phone can't reach your computer's
  `localhost`. Create `mobile/.env.local`:

  ```
  EXPO_PUBLIC_API_URL=http://<your-machine's-LAN-IP>:8000
  ```

  and make sure the backend was started with `--host 0.0.0.0` (as above)
  so it accepts connections from other devices on the network.

## What's implemented

Every screen calls the real backend — there is no mock data layer.

- **Today** — readiness card, hero workout card (Start/Resume/View
  Summary depending on real session state), nutrition snapshot, one coach
  observation, week strip. `docs/design-system.md` §10.
- **The core loop, end to end**: Today → Start Workout → Active Workout
  (one exercise at a time, prefilled weight/reps from the same
  progression engine, rest timer, optional feel/RIR feedback) → Log Sets
  → Finish Workout → Completion → Coach Review (per-exercise next-session
  recommendations from `engine.progression_options`, plus deterministic
  observations from `coach.py`) → back to an updated Today/Program. §12–14.
- **Program** — Overview / Schedule / Goals / Coach segments, including a
  working **Ask Toci** chat wired to the existing scoped program-builder
  endpoint (propose → Apply/Discard, never automatic). §11.
- **Progress** — Strength (per-exercise est. 1RM trend), Running (pace
  trend from logged runs), Body (weight trend + logging), Habits
  (workout/nutrition/check-in consistency), and recent PRs. §15.
- **Nutrition** — Today (macros vs. targets, AI suggestion, log), Food
  (search, quick add, barcode scan via the device camera against Open
  Food Facts), Recipes, Smart Cart. §16.
- **Profile** — Overview, Goals, Body Stats (+ injuries), Training
  Preferences, Nutrition Preferences, Devices (connection status),
  **Appearance** (all 8 accent themes + light/dark/system, live preview,
  persisted locally), Account. §17, §4.
- **Daily Recovery Check-in** — a focused modal for HRV/RHR/sleep/soreness/mood.

## What's a deliberate mobile-scope decision

- **No in-app OAuth for Spotify/Whoop.** Both providers' PKCE/OAuth flows
  are wired to a specific loopback redirect URI on the FastAPI server
  (`app/toci/spotify.py`, `app/toci/whoop.py`), designed for the browser
  frontend. Wiring a native deep-link redirect for Expo Go is real work
  with its own testing surface; the Devices screen reads and displays the
  real connection status from the existing endpoints instead of
  reimplementing the flow, so nothing is faked.
- **No progress-photo capture/AI-impression UI yet.** The backend
  endpoints exist and are unchanged; only the mobile capture screen
  wasn't built in this pass.
- **Freeform/empty-session workout logging** falls back to whatever's
  already logged in the session (no fixed prescription), rather than a
  full ad-hoc exercise picker — the golden path (today's prescribed
  session, or any saved day from the Workout tab) always has a real
  prescription.

## Architecture

```
mobile/
  src/
    app/                 Expo Router file-based routes
      (tabs)/             Today, Program, Workout, Nutrition, Progress
      workout/             active session, completion, coach review, log-run
      profile/             Overview, Goals, Body Stats, Preferences, Devices, Appearance, Account
      checkin.tsx           daily recovery check-in modal
      nutrition/scan.tsx    barcode scanner (expo-camera)
    api/                  client.ts (fetch wrapper), types.ts (mirrors toci/schemas.py),
                           hooks.ts (React Query hooks, one per endpoint)
    theme/                 tokens.ts (Toci Pastel Apricot design tokens) + ThemeContext
                           (appearance + accent theme, persisted via AsyncStorage)
    components/ui/         shared primitives: Button, Card, Chip, SegmentedControl,
                           Stepper, Sparkline (react-native-svg), Skeleton, etc.
    features/               screen-specific composition (today/, workout/, program/,
                           progress/, nutrition/)
    context/WorkoutContext.tsx   app-wide rest timer
    lib/                    units.ts (lb/kg conversion), format.ts
```

Data fetching is **TanStack Query** throughout — no separate global store;
server state lives in the query cache, refetched/invalidated on mutation.
There's no offline queue or local-first write path yet (unlike the KMM
core described in `docs/architecture.md` §08) — set logging is a direct
API call, same as the existing web frontend.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean (see `eslint.config.js`; uses `eslint-config-expo`).
- `npx expo export --platform ios` — bundles cleanly (1600+ modules, no errors).
- `npx expo-doctor` — 18/20 checks pass; the other 2 (config-schema and
  React Native Directory validation) require outbound network access to
  Expo's servers that this development sandbox's proxy blocks. Re-run in
  an unrestricted environment to confirm those two.
- The full golden path (Today → Start Workout → log every set → Finish
  Workout → Completion → Coach Review → back to an updated Today) was
  driven end-to-end against the real local backend via a headless
  browser (Expo web target) with zero console errors, on a fresh seed.
  Expo Go on a physical device/simulator should be exercised too before
  shipping — this sandbox has no iOS/Android runtime available.
