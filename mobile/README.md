# Toci — Expo mobile app

The mobile-first migration of Toci OS: TypeScript, React Native, Expo Router,
built to run in **Expo Go** on iOS and Android. It talks to the same
FastAPI backend in [`../app`](../app) — no backend logic was rewritten,
only consumed. See [`../docs/design-system.md`](../docs/design-system.md)
for the base Toci Pastel Apricot design system this app extends, and
[`../docs/architecture.md`](../docs/architecture.md) for the product's
broader shape.

**Visual language:** the app ships dark-first (near-black surfaces, warm
orange accent), per approved reference mockups reviewed and signed off
directly against this codebase — a deliberate, documented deviation from
`design-system.md`'s "light is primary" default. All 8 accent themes from
that doc (Apricot, Mint, Blush, Butter, Sky, Coral, Cocoa, Graphite) and
the System/Light/Dark appearance modes remain fully switchable from
Profile → Appearance; dark + Apricot is just the default first impression
now instead of light + Apricot.

## Run it

Quickest path: `../start-toci.sh` from the repo root — starts the backend
(seeding on first run), writes your LAN IP into `.env.local`, and launches
Expo pointed at iOS Simulator. Manual steps below for anything it doesn't
cover.

**Node version**: this Expo SDK (57) / RN 0.86 toolchain requires Node
`^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0` (see `engines` in
`package.json`). An out-of-range Node won't always fail loudly at
`npm install` (you may just get `EBADENGINE` warnings) — but `expo start`
itself can hard-crash with an unrelated-looking error
(`TypeError: (0, _nodeUtil.parseEnv) is not a function`) on Node versions
that predate `util.parseEnv`. If you hit that, it's this, not a real bug —
upgrade Node.

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
   simulator/emulator. (`npm run ios` / `npx expo start --ios` will also
   auto-install Expo Go into a booted iOS Simulator and open the project
   directly, if a QR scan isn't convenient.)

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
  so it accepts connections from other devices on the network, and that
  your phone and computer are on the same network. A remote/cloud dev
  sandbox with no inbound network access (no LAN, no tunneling) can't
  serve Expo Go on a physical device at all — it needs a real local or
  tunnel-capable environment.

  **If the phone and computer are genuinely on the same Wi-Fi and it still
  times out**: many routers (especially ISP-provided ones) enable
  "AP isolation" / "client isolation" by default, which blocks devices on
  the same network from reaching each other directly even though both get
  a normal LAN IP. Symptoms: the phone shows up in `arp -a` on the
  computer (so it's on the same subnet), but a packet capture shows zero
  connection attempts ever arriving — the request just times out. Fix is
  a router admin setting, not anything in this app; a Personal Hotspot
  from the phone (computer joins the phone's own network) sidesteps it
  entirely, or use `npx expo start --tunnel` (needs a free ngrok account)
  to route around the LAN altogether.

## Navigation

Six bottom tabs, matching the approved reference screens exactly:
**Today · Log · Nutrition · Progress · Program · Profile.** Profile is a
full tab (not a header-avatar flyout) and is itself a single screen with
its own segmented sections — see below.

## What's implemented

Every screen calls the real backend — there is no mock data layer.

- **Today** — wordmark header, greeting + streak pill, ring-gauge readiness
  card, photo-style gradient hero workout card (Start/Resume/View Summary
  depending on real session state), 4-column macro row, weight-trend +
  this-week two-up, water/body-fat/resting-HR stat row.
- **The core loop, end to end**: Today → Start Workout → Active Workout
  (one exercise at a time, prefilled weight/reps from the same
  progression engine, rest timer, optional feel/RIR feedback) → Log Sets
  → Finish Workout → Completion → Coach Review (per-exercise next-session
  recommendations from `engine.progression_options`, plus deterministic
  observations from `coach.py`) → back to an updated Today/Program.
  Logged sets can be edited or deleted in place while a workout is active.
- **Log** (the workout-entry tab) — "What are you doing today?" with
  Log Lift Session / Log a Run action cards, recent sessions, a weekly
  snapshot (lift/run/time/calories vs. goals), and this week's saved
  workout days. Recent Session cards open a real detail/edit view (past
  lift sessions and runs) — fix a set or a run's duration/distance, or
  delete the whole session, instead of it being a dead-end summary.
- **Program** — photo-style gradient program-header card, Overview /
  Schedule / Goals / Coach segments, goal-progress mini cards, a real
  progress-photo capture card (library picker → `/api/progress/photos`
  upload), and a Coach Notes card that opens straight into **Ask Toci**
  (the scoped program-builder chat; propose → Apply/Discard, never
  automatic). Goals can be renamed or deleted after creation; Schedule
  days can be swapped (tap one day, tap another) to permanently rearrange
  the week.
- **Progress** — exercise dropdown + timeframe dropdown driving a 1RM
  trend chart with a real % change badge, Strength / Running / Body /
  Habits categories, consistency/best-lift/trend stat pills, and a
  styled Recent PRs list. Body's weight history is a real list, not just
  a sparkline — past entries can be edited or deleted, not just
  upserted for today.
- **Nutrition** — Food / Saved Meals / Recipes / Smart Cart segments. Food
  is the daily dashboard: per-macro cards, a Log Food card with live
  carb/protein/fat ring donuts that opens a dedicated Add Food screen
  (search, quick add, barcode scan via the device camera against Open
  Food Facts, or a Custom Food form for anything not in the catalog),
  recent meals, an AI Smart Nutrition Plan card, daily calorie/hydration
  rings (tap hydration to log +8oz), and a streak banner. Logged entries'
  serving sizes can be edited in place. Real date navigation (prev/next
  day chevrons, tap the date to jump back to today) drives the whole Food
  segment; a "..." menu can copy the previous day's log forward or clear
  the day being viewed. Saved Meals can be created from mobile (built
  from whatever's already logged that day) as well as logged/deleted.
  Smart Cart items can be added or removed by hand, not just
  auto-populated from recipes.
- **Profile** — a single tab with its own **Overview / Goals / Prefs /
  Devices / Account** segments (not eight separate pushed screens): a
  profile header card (avatar, name, body stats), current-stats and
  daily-target cards, activity level (real week-strip data), connected
  devices preview, and an inline **Appearance** card (accent dots +
  expandable full picker — no separate screen). Prefs consolidates body
  stats/injuries, training preferences, and nutrition preferences into
  one scrollable segment.
- **Daily Recovery Check-in** — a focused modal for HRV/RHR/sleep/soreness/mood.

## What's a deliberate mobile-scope decision

- **In-app OAuth for Spotify/Whoop is wired, with one real caveat.**
  Profile → Devices → Whoop/Spotify now opens a native Authorization Code
  (+ PKCE for Spotify) flow via `expo-web-browser` and `Linking.createURL`,
  hitting the exact same backend endpoints and scopes the web frontend
  uses (`app/toci/spotify.py`, `app/toci/whoop.py`) — same
  credential-entry step, same token exchange, nothing reimplemented or
  faked. What's untested: this repo has never been linked to a real
  Whoop/Spotify developer app, and `Linking.createURL`'s value changes
  every Expo Go dev session, so the redirect URI can't be pre-registered
  there — only a standalone/dev-client build gets a stable `toci://`
  redirect worth registering. Verified so far: the sheet renders for both
  providers, saving credentials round-trips against the real backend and
  updates connection status live; the external authorize/token-exchange
  round-trip itself needs a real account and a non-Expo-Go build to
  exercise end to end.
- **Progress-photo AI impressions aren't surfaced yet.** Capture and
  upload are real (`/api/progress/photos`); the vision-model impression
  text the backend can attach isn't displayed in this pass.
- **Freeform/empty-session workout logging** falls back to whatever's
  already logged in the session (no fixed prescription), rather than a
  full ad-hoc exercise picker — the golden path (today's prescribed
  session, or any saved day from the Log tab) always has a real
  prescription.
- **No "steps" stat anywhere.** The backend has no step-count data source
  at all (no HealthKit/Health Connect wiring yet), so rather than invent
  one, every stat row in this app shows only real, backend-sourced
  numbers — water, body fat, resting HR, calories, protein, etc.

## Architecture

```
mobile/
  src/
    app/                 Expo Router file-based routes
      (tabs)/             Today, Log, Nutrition, Progress, Program, Profile
      workout/             active session, completion, coach review, log-run
      nutrition/            add-food, barcode scan
      checkin.tsx           daily recovery check-in modal
    api/                  client.ts (fetch wrapper), types.ts (mirrors toci/schemas.py),
                           hooks.ts (React Query hooks, one per endpoint)
    theme/                 tokens.ts (design tokens: dark-first surfaces + 8 accent
                           themes) + ThemeContext (appearance + accent, persisted
                           via AsyncStorage)
    components/ui/         shared primitives: Button, Card, Chip, SegmentedControl,
                           Stepper, Dropdown, RingGauge, GradientHeroCard,
                           MacroStatRow, StatPill, Sparkline (react-native-svg),
                           Avatar, ScreenHeader, Skeleton, etc.
    features/               screen-specific composition: today/, workout/, program/,
                           progress/, nutrition/, profile/
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
- `npx eslint .` — clean (see `eslint.config.js`; uses `eslint-config-expo`,
  including the React Compiler's stricter hook-purity rules).
- `npx expo export --platform ios` — bundles cleanly (1600+ modules, no errors).
- `npx expo-doctor` — 18/20 checks pass; the other 2 (config-schema and
  React Native Directory validation) require outbound network access to
  Expo's servers that this development sandbox's proxy blocks. Re-run in
  an unrestricted environment to confirm those two.
- The full golden path (Today → Start Workout → log every set → Finish
  Workout → Completion → Coach Review → back to an updated Today) was
  driven end-to-end against the real local backend via a headless
  browser (Expo web target) with zero console errors, on a fresh seed —
  re-verified after the dark redesign, across every tab, and again after
  switching accent themes.
- Fixed a real text-contrast bug found during that pass: several cards
  used a solid pastel `accentWash` fill with the theme's default (light,
  in dark mode) text color on top, making the text unreadable. Every such
  spot now explicitly uses `accentInk`, the token designed for text on a
  wash surface.
- **Verified in an actual iOS Simulator run** (Xcode 15.2, iOS 17.2,
  Expo Go SDK 57) against the real local backend: app boots, real seeded
  data renders (readiness score, streak, today's workout), dark theme
  correct, no red-screen errors. This caught one real bug the
  tsc/eslint/jest/bundle-compile checks above all missed —
  `@react-native-async-storage/async-storage` was pinned to `3.1.1`,
  newer than the `2.2.0` native module this Expo Go build actually
  bundles, which threw `Native module is null` at startup. Fixed via
  `npx expo install --fix` (now pinned to the SDK-matching versions).
  Lesson: passing typecheck/lint/tests/bundle-compile is not proof an
  Expo Go app actually runs — those checks never execute against Expo
  Go's fixed native module set, so a version-pin mismatch like this one
  only surfaces on a real run.
- Physical-device testing over Expo Go is still not verified end-to-end —
  blocked in the environment this was built in by router client
  isolation (see above), not by anything in the app itself.
- `npm test` — a Jest + React Native Testing Library suite covers the
  deterministic coaching logic (`lib/coachVoice.ts`), the small formatting
  helpers, and a couple of key components (`Stepper`, `ActiveExerciseCard`).

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull
request: the backend job installs `app/requirements.txt` and runs
`pytest`; the mobile job runs `tsc --noEmit`, `eslint`, and `jest`. Nothing
here needs secrets or network access beyond the package registries.

## Building for real devices (EAS)

`mobile/eas.json` defines `development` / `preview` / `production` build
profiles, and `app.json` has placeholder bundle identifiers
(`com.toci.app`) for iOS/Android. This repo has never been linked to an
Expo account, so before running a real build:

```
npx eas login             # one-time, your Expo account
npx eas init               # creates the project on expo.dev, writes projectId into app.json
npx eas build --platform ios --profile preview      # or android
```

Swap `com.toci.app` for your own bundle identifier/package name first if
you plan to submit to the App Store / Play Store under your own account.
