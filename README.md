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
| Mobile app (Expo / React Native / Expo Router) | **Working, feature-complete** — all 6 tabs, real CRUD throughout, a guided first-run onboarding interview ahead of them, runs in Expo Go or Expo web against the same FastAPI backend; verified end-to-end in iOS Simulator (real backend data, no errors) — see [`mobile/README.md`](mobile/README.md) |
| Backend (FastAPI + SQLite) | **Working** — the recommendation engine (now trend-aware, not just single-day), all data endpoints, and the local demo web frontend; see [`app/README.md`](app/README.md) |
| Design system | **Toci Pastel Apricot**, dark-first, 8 fully switchable accent themes (Apricot, Mint, Blush, Butter, Sky, Coral, Cocoa, Graphite) applied consistently across every tab (and the onboarding flow) from one shared theme context |
| Data | Seeded with a **real training profile** (not placeholder demo data) — see below |
| Local AI features (Coach narration, Ask Toci, photo impressions) | Ask Toci verified end-to-end against a real local Ollama (`llama3.2`) with a [Braintrust eval harness](app/README.md#evaluating-ask-toci-with-braintrust) driving fixes — now including a feedback-aware system prompt (readiness trend, adherence, stalled lifts), confirmed serialized: 100% off-topic accuracy, 92.31% proposal-presence accuracy, 100% model availability; Coach narration uses the same model/path but hasn't been separately eval'd; photo impressions (`llava`) still unverified — see [Known gaps](#known-gaps) |
| Tests / CI | 150 backend tests (pytest), 76 mobile tests (Jest + React Native Testing Library), `tsc`/`eslint` clean, GitHub Actions CI on every push/PR |

**Run the mobile app** (primary way to use this): `./start-toci.sh` from the repo root starts the backend and Expo (pointed at iOS Simulator) in one shot. See [`mobile/README.md`](mobile/README.md) for the manual steps, Node version requirements, and physical-device setup notes.
**Run the backend alone**, with its bundled vanilla-JS demo frontend: see [`app/README.md`](app/README.md) — `cd app && ... && uvicorn toci.main:app --reload`, then open `http://localhost:8000`.

Not production-ready — no auth, no real wearable data, no Postgres, no deployment. See [Known gaps](#known-gaps) before mistaking this for more than it is.

Full spec: **[docs/architecture.md](docs/architecture.md)** · Rendered: **[Toci OS — Architecture Draft v0.1](https://claude.ai/code/artifact/b02ac323-a8e3-43eb-a19f-4dae3b9fb897)**

## Updates

Dated log of each round of work landed on this repo, newest first.

**Update 4 — Training through a rough stretch instead of stopping (2026-10-18)**

*Why:* the last life-stress problem from Update 2. When readiness was
low three days running, the engine swapped every lift day for a recovery
day. Over a two-week stress slump that meant almost no training, so the
week back at normal volume landed as a workload spike (9 per simulated
athlete) and cost progress.

- **A slump now means a short session, not a cancelled one:** about 60%
  of the planned sets while readiness stays amber. A red day is still
  full recovery, and a single amber day still trims ~20%. That's closer
  to the architecture spec's own amber rule ("proceed, volume reduced"),
  and it's what the engine already did when you picked a saved workout
  during a slump.
- **Simulator, two weeks of life stress:** workload spikes **9 → 0**,
  strength **+1.8% → +2.3%** (fixed program +2.0%), 34 failed sets vs
  163. It now passes. Every other scenario is unchanged. **5 of 7 pass.**
- **Tried and removed:** the spec's ACWR volume cap (trim sets when the
  last week runs over 1.5× your usual). On its own it cut the spikes to
  2, but combined with the change above it prevented no spikes anywhere
  and cost progress (inconsistent availability +1.0% → +0.7%), so it's
  out and ACWR stays on the roadmap. Worth knowing: the simulator's spike
  check also uses ACWR, so that result is weaker evidence than the
  strength and failed-set numbers.
- 150 backend tests; the slump test now pins the new behavior, plus one
  that a red day during a slump is still recovery.

**Update 3 — Prescribing for the equipment you actually have (2026-10-18)**

*Why:* Update 2's simulator caught it: onboarding asks whether you train
in a full gym, a home gym or with bodyweight only, and then the engine
never read the answer. A home lifter was told to barbell squat and bench
every session, so the "adaptive" plan was one they couldn't follow.

- **The engine now plans with your equipment** (`app/toci/equipment.py`).
  Each setting means exactly what onboarding tells you it means: *Home gym*
  is dumbbells, bands and a bench (no barbell, rack, cables or pull-up
  bar); *Bodyweight* is nothing at all. Every catalog exercise has the
  lowest setting it works with, and a same-movement swap below that:
  Back Squat → Goblet Squat → Tempo Bodyweight Squat, Bench → Dumbbell
  Bench → Push-Up, Pull-Up → Band Lat Pulldown → Doorframe Row, and so on.
- **Swaps are real exercises** with their own history, so progression
  tracks your goblet squat, not your old barbell number. Starting weights
  are scaled to the new implement (e.g. a dumbbell press starts around 40%
  of the barbell, per hand).
- **Progression fits the gear:** home dumbbells step 1 kg, not 2.5 kg (on
  a 30 kg dumbbell a 2.5 kg jump is an 8% leap; in the simulator 1 kg steps
  cut failed sets from 70 to 37). Bodyweight and band work progresses by
  adding a rep, since there's no weight to add.
- **Order of priority:** an injury swap first (safety), then your own
  saved swap if your equipment can do it, then the equipment swap.
  Exercises you add yourself are trusted to fit.
- The Program tab's week view shows the same swapped names as the day
  plan, and a 0 kg load now reads **Bodyweight** instead of "0 lb".
- **Simulator, home gym (no barbell):** before, 32 prescriptions a home
  lifter couldn't do; now 0, all 32 sessions trained, +2.5% strength and
  37 failed sets vs +1.9% and 166 for a printed home program. **4 of 7
  scenarios now pass.** One change to the comparison, said out loud: the
  baseline used to be the printed *barbell* plan, which a home lifter can't
  do at all (0 sessions, 0 failed sets), so "fewer failed sets than it"
  could never pass. The baseline is now that plan done with the same
  dumbbells. The pass rules themselves didn't change.
- 149 backend tests (8 new), 76 mobile tests.

**Update 2 — The engine has to prove itself: an 8-week training simulator (2026-10-18)**

*Why:* I want to stop building features and start building outcomes. Toci
already had six tabs and a recommendation engine, but nothing showed the
engine actually makes better decisions than a printed program, and the
only judge of its coaching was me reading its output. So this update asks
the harder question: *put the engine in charge of eight weeks of someone's
training, including the weeks that go wrong, and measure what happens.*

- **Added a training simulator** (`app/toci/simulator.py`, `python -m
  toci.simulator`, report in [`docs/training-sim-report.md`](docs/training-sim-report.md)).
  The real engine plans every day for a virtual athlete. The athlete is
  modeled separately from the engine (hard-set adaptation, fatigue that
  fades over a week, detraining after three weeks off, a strength ceiling),
  produces its own HRV/sleep/check-in, and actually performs the sets, so
  the engine never grades itself. 7 scenarios (consistent, no wearable,
  missed workouts plus a three-week break, stalled near a ceiling, two weeks
  of life stress, inconsistent availability, no squat rack) × 20 athletes,
  against a fixed +2.5 kg-per-session program, with pass rules written
  down before the first run and safety rules checked every day.
- **Before the fixes the engine failed all 7 scenarios and broke a safety
  rule 259 times.** What the simulator found:
  1. **An ordinary day scored amber.** HRV and resting HR at your own
     baseline scored 50/100, so a perfectly normal day came out ~66 (green
     is 70+). With no wearable, which is every user today, it was amber
     most days, and three ambers in a row swap lift days for recovery: a
     stress-free lifter trained 25 of 32 planned sessions. Fixed: your
     baseline (or no reading) now scores 75, falling steeply below it.
     The documented 70/40 bands are unchanged.
  2. **Progression judged one set.** With straight sets "the top set" was
     really set 1, the freshest, so a missed final set still earned more
     weight. Now every set has to hit its reps.
  3. **Came back heavier after weeks off.** After 21+ days away it now
     restarts at ~90%.
  4. **No reset after repeated misses.** It repeated a failing weight
     forever (91 failed sets for a stalled lifter). Two missed sessions in
     a row now reset ~10%.
  5. **A date bug:** `build_lift_day_prescription` read *today's*
     readiness trend even when planning another day.
- **After: 0 safety violations, and 3 of 7 scenarios pass.** A consistent
  lifter now trains all 32 sessions and gains +2.5% vs +2.0% on the fixed
  program, with 35 failed sets instead of 164.
- **Still failing, on purpose, because they're real:**
  - *No squat rack:* the engine never reads `user.equipment`, so it keeps
    prescribing squats and benches. Fixing it needs equipment data per
    exercise and a decision on substitutes.
  - *Life stress:* skipping the bad weeks and then returning to full
    volume causes workload spikes. I tried a one-day ramp back; it didn't
    help, so I took it out.
  - *Missed workouts / inconsistent availability:* easing back in after a
    break and resetting after misses costs a little progress vs the fixed
    program (−1.3% vs −0.9%, +0.9% vs +1.1%), in exchange for 6 vs 46 and
    19 vs 77 failed sets. That's a trade I'd make, but the rule I set
    says fail, so it says fail.
- The athlete is a model, not a person. This shows the engine reacts
  sensibly to hard situations; real proof needs planned-vs-completed
  tracking with real users.
- 141 backend tests (13 new). Built on `claude/training-simulator` and
  merged into `main` along with every September update, so `main` is
  the current app again.

**Update 1 — Onboarding, adaptive feedback, and a pre-launch QA pass (2026-09-21)**
- Added the guided 13-screen first-run onboarding interview (see below).
- Made the readiness engine trend-aware: 3+ consecutive amber/red days now
  escalates to a full recovery swap instead of another volume trim, and
  Ask Toci's system prompt was given the same real readiness/adherence/
  stalled-lift signal so its answers are grounded in current data, not
  just static profile shape.
- **Pre-launch QA pass** (a full test run, a manual security review, and a
  live walkthrough in iOS Simulator — not just reading the diff) caught
  three real bugs none of the automated suites had surfaced:
  1. An Ask Toci reply quoted the system prompt's own internal instruction
     text back to the user verbatim, on a real live query — the
     Braintrust eval scored 100%/100%/92% both before and after, since its
     scorers check off-topic/proposal/availability, not reply quality.
     Fixed the prompt structure; re-ran the same live query to confirm.
  2. The Today and Program tabs could disagree about what to do on a given
     day — Today correctly swapped to Active Recovery during a readiness
     slump, Program still showed the original scheduled lift with a
     "Start Workout" button. Root cause: the Program tab read the raw
     schedule instead of the readiness-adjusted recommendation. Fixed,
     along with a matching bug in the Readiness card's copy.
  3. Several free-text fields in the web frontend (`web/app.js`) reached
     `innerHTML` without the `escapeHtml()` helper the same file already
     uses in ~27 other places — a stored-XSS gap, low risk today
     (single local user) but real the moment this backend is ever
     deployed for more than one person. Fixed all found call sites.
- Backend and CORS/auth/crypto/IAP-verification posture reviewed and found
  solid otherwise — see [Known gaps](#known-gaps) for what's genuinely
  still open (mainly: no auth yet, which is the root cause of most of
  what's left).

## What actually works right now

Everything below is live in the mobile app (or the backend it talks to) — not a mockup, not mock data.

**Guided first-run onboarding**
Instead of dropping a new user into a settings form, a 13-screen interview
(welcome → primary/secondary goal → experience → training days → session
length → equipment → split preference → body profile → recovery
preference → confirmation → an animated "building your plan" moment →
a personalized reveal card) collects everything the engine below needs,
one question at a time — segmented progress bar, tap-to-commit selectable
cards, and a coach that reacts to prior answers (e.g. picking 4 days
gets *"Four days gives us enough room to train everything twice without
living in the gym"* on the next screen) before you've done a single
workout. Every answer routes through the same `/api/settings` /
`/api/onboarding/complete` / `/api/goals` endpoints the rest of the app
already used — nothing onboarding-specific was invented server-side.
Re-triggerable anytime from Profile → Account → "Restart onboarding."

**The recommendation engine (`toci/engine.py`)**
- Readiness scoring — HRV/RHR z-scores against a rolling baseline, sleep vs. target, and a subjective check-in, weighted and banded exactly as documented in the architecture spec.
- Progressive overload — logging a set today changes what's prescribed next session, based on the actual RIR/reps-hit rule, not a fixed schedule.
- Autoregulation — an amber/red readiness band measurably trims volume, downgrades run intensity, or swaps to recovery. It's trend-aware, not just single-day: `readiness_trend()` counts consecutive low-readiness days, and 3+ in a row drops an amber day to a short session at ~60% of the sets (a red day is still full recovery), so a rough stretch doesn't turn into weeks off and a spike on the way back (see Update 4).
- Injury-aware substitution — an active injury swaps out the affected lift on the next session that includes it.
- Equipment-aware planning — a home-gym or bodyweight setting swaps each lift for a same-movement version you can actually do, with weights and progression scaled to that equipment (see Update 3).
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
- **Ask Toci** — a conversational program-builder, restricted strictly to this user's own program/goals/training history. Off-topic requests are declined before the message ever reaches the model. Program-change requests get a structured JSON proposal — validated against the app's real exercise catalog — that must be explicitly **Applied** or **Discarded**; nothing changes automatically. It's also feedback-aware: every prompt carries today's readiness + trend, the last 7 days' adherence against the scheduled week, and any lift that missed its target reps/RIR last session, using the exact same trend logic the day-plan escalation above reads — so asking "how's my training been going" gets an answer grounded in what's actually happening, not generic advice.

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

**Toci Premium ($6.99/mo)** — a real Apple StoreKit 2 subscription (not a demo toggle) gating Ask Toci, adaptive next-session coaching, and progress photos. Purchases go through `expo-iap`, and the backend verifies every transaction against Apple's real App Store Server API using Apple's own official library (`app/toci/apple_iap.py`) — the client's claim of being premium is never trusted on its own. See [`docs/app-store-setup.md`](docs/app-store-setup.md) for what's still needed to actually ship it: an Apple Developer Program membership, App Store Connect product setup, and a signed build — none of which can happen inside this repo, since they require your own Apple account.

## Next steps to actually ship

Everything code-side that can be done without external accounts is done —
what's left is genuinely gated on setup only you can do. In order:

1. **Create an Expo account** (free, expo.dev) — unblocks `eas login` /
   `eas build`, the cloud build service needed for a real native build
   (subscriptions and the outdoor-run map are native modules; Expo Go can't
   run them). Building locally isn't an option on this dev Mac — its
   hardware caps out at macOS 13.7.8, and this Expo SDK needs Xcode 16.1+,
   which needs macOS 14.5+. EAS Build sidesteps this by compiling on Expo's
   own Mac servers instead of this one; kicking it off just needs Node.js,
   so it works from any machine, Mac or not.
2. **Log into Fly.io** (`flyctl` is already installed at
   `~/.fly/bin/flyctl`) — run `flyctl auth login`, then the backend can
   actually be deployed somewhere public. Right now it only runs on
   `localhost`/this Mac's LAN IP, which a real App Store build can't reach.
3. **Apple Developer Program** ($99/yr, developer.apple.com) — in progress
   as of 2026-08-04. Nothing in `docs/app-store-setup.md` steps 2 onward
   (App Store Connect app registration, the subscription product, the API
   key, the notifications webhook) can start without it.
4. Once 1-3 are done: `eas build` for a real testable build, Sandbox-test
   the subscription on a physical device, fill in App Store Connect's
   listing metadata (screenshots, description, privacy policy, support
   URL), submit for review.

See [`docs/app-store-setup.md`](docs/app-store-setup.md) for the full
step-by-step, including exactly what broke trying to build natively on this
Mac and why (kept there in case a capable Mac becomes available later).

## Known gaps

- **Ask Toci verified, photo AI impressions not**: Ollama + `llama3.2` are running on this machine and Ask Toci is now covered by a [Braintrust eval](app/README.md#evaluating-ask-toci-with-braintrust) (100% off-topic accuracy, 92.31% proposal-presence accuracy, 100% model availability, all measured serialized, 13 cases). Coach narration shares that same model/path but hasn't been separately eval'd. The `llava` vision model for photo impressions has never been pulled on this machine — that path is still only verified via its tested fallback (photo saves fine, no AI note), not live output. CPU-only generation here is also slow (~3 tok/s) — long JSON-proposal replies can take several minutes and occasionally still hit the 240s timeout; the feedback-aware system prompt (see above) adds real context length to every call, which measurably increases per-call latency on this hardware in exchange for grounded answers.
- **Ask Toci's scope guardrail** is a strong deterrent (pre-filter + system prompt), not a mathematically airtight guarantee against a determined adversarial prompt on a local open-weight model.
- **No auth** — single hardcoded demo user; the architecture doc's Sign in with Apple/Google plan isn't wired up, and the Profile → Account "Sign Out" control is explicitly a no-op that says so on screen. This also means Toci Premium currently applies to that one demo user, not per-real-person — a real multi-user launch needs auth before the paywall means anything.
- **Toci Premium is iOS/App Store only** — no Android/Play Billing integration yet (the backend's `subscription_platform` field is ready for it, the verification code isn't written).
- **No real wearable data** — HRV/RHR/sleep are simulated around a seeded baseline until manually overridden on the Recovery Check-in screen. Whoop/Spotify OAuth is real end to end, but this repo has never been linked to a real Whoop/Spotify developer app.
- **SQLite, not Postgres** — a one-line change in `toci/database.py` when that matters.
- **No training-load/ACWR tracking in the engine, no program version history** (a deload after two missed sessions now exists; ACWR is measured only in the simulator) — this implements the readiness + progression core loop, not every table in the full architecture spec. There is a coarse multi-day readiness-slump rule (`engine.readiness_trend()` — 3+ consecutive amber/red days cut a session to ~60% of its sets), but that's a simple streak counter, not real ACWR (acute:chronic workload ratio) or an automatic deload week. An ACWR volume cap was tried in Update 4 and removed because it didn't help in the simulator.
- **No migrations tooling, no deployment config.**
- **Qualitative goals aren't numerically tracked** — "improve posture," "look more athletic" etc. don't fit the Goal model's start→target progress bar, so they're intentionally not forced into it (addressed instead via the primary program focus and the recovery day's mobility work) rather than inventing a fake metric.
- **Equipment swaps cover the built-in catalog only** — exercises you add yourself are assumed to fit any setting, since the app doesn't know what they need.
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
