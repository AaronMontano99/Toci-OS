# Toci Pastel Apricot Design System

**Version 1.1 — Apricot Default + User-Selectable Accent Themes**

## 1. Visual Theme & Atmosphere

The Toci interface is a warm, premium fitness-coaching environment built around soft ivory surfaces, charcoal typography, restrained pastel support colors, and a user-selectable accent system. Toci Apricot remains the default and defining brand theme. The design philosophy is **"coach-first clarity"** — the interface should quietly organize the user’s training day, make the next action obvious, and then get out of the way.

Toci is not a spreadsheet, analytics dashboard, or generic workout tracker. It is an adaptive AI coach. The UI should feel like a calm, highly organized coach presenting exactly what matters right now: today’s workout, the current set, the user’s feedback, and the next intelligent recommendation.

The visual system favors warm light mode as the primary experience. It uses soft cream backgrounds (`#FBF8F3`, `#F6F0E8`), white cards, muted charcoal text, and Toci Apricot (`#F58A4B` to `#FFB178`) as the default accent. Users may optionally select one of seven additional curated pastel themes without changing the core layout, typography, hierarchy, semantic states, or coaching behavior. Supporting semantic colors continue to communicate meaning independently of the chosen accent: sage for positive progress, dusty blue for recovery and information, warm amber for caution, and muted terracotta for pain or errors.

The interface should feel athletic without becoming aggressive, elegant without becoming delicate, and intelligent without becoming clinical. It should look expensive, but remain easy to understand within seconds.

**Key Characteristics:**
- Warm ivory and soft sand backgrounds — calm, premium, and easy on the eyes
- Toci Apricot as the default brand accent, with seven curated user-selectable alternatives
- Clean charcoal typography with strong numerical hierarchy
- Large rounded cards and touch-friendly controls
- One clear primary action per screen
- Soft shadows and subtle borders instead of heavy outlines
- Pastel semantic colors used only when meaningfully communicating state
- Minimal scrolling through segmentation, progressive disclosure, and drill-down screens
- AI coaching language integrated directly into the interface
- Program and workout logging receive the highest visual and interaction priority

---

## 2. Product Design Philosophy

### Core Promise
When the user opens Toci, they should feel:

> “I know exactly what I’m doing today.”

When the user finishes a workout, they should feel:

> “Toci understood what happened and already knows what I should consider next.”

### KISS Principle
Toci follows **KISS: Keep It Simple, Stupid.**

Simple does not mean fewer capabilities. Simple means fewer decisions for the user.

The app should:
- automate obvious decisions
- prefill known information
- surface one clear next action
- hide secondary detail until requested
- avoid making users remember previous numbers
- avoid asking the same question twice
- avoid exposing settings when intelligent defaults can solve the problem

### One Screen, One Job
- **Today:** What should I do today?
- **Program:** What am I training and why?
- **Workout:** What do I do next right now?
- **Set Logging:** What happened in this set?
- **Coach Review:** What did the workout mean?
- **Progress:** Am I improving?
- **Nutrition:** What should I eat or log?
- **Profile:** What personal context does Toci use?

A screen fails when it tries to answer several of these questions at once.

### Coach-First, Not Dashboard-First
The product should never feel like a wall of statistics. Metrics must support a coaching decision.

Good:
- “Your squat effort is dropping at the same weight.”
- “You skipped core three weeks in a row. Move it earlier?”
- “Your dog walk covered today’s low-intensity cardio.”

Bad:
- eight tiny charts on one screen
- decorative statistics with no action
- multiple equal-priority cards
- long, form-like workout pages

---

## 3. Color Palette & Roles

Toci Apricot is the default theme for every new and existing user unless they intentionally choose another accent in Profile → Appearance. The neutral surfaces, typography, spacing, semantic states, and component geometry remain stable across every theme.

### Primary Brand Accent — Default
- **Toci Apricot** (`#F58A4B`): Primary CTAs, active tabs, selected controls, progress highlights
- **Soft Peach** (`#FFB178`): Controlled gradient endpoint, subtle emphasis
- **Apricot Wash** (`#FFF0E5`): Selected surfaces, soft highlights, empty-state accents

### Warm Light Surfaces
- **Warm Ivory** (`#FBF8F3`): Main application background
- **Soft Sand** (`#F6F0E8`): Secondary background and grouped sections
- **Pure White** (`#FFFFFF`): Primary cards and elevated surfaces
- **Warm Mist** (`#FDFBF8`): Alternate surface for sheets and panels

### Text
- **Charcoal** (`#202124`): Primary text
- **Graphite** (`#5F6268`): Secondary text
- **Muted Taupe** (`#8C857D`): Tertiary labels and metadata
- **Quiet Beige** (`#B7AEA4`): Disabled text and inactive navigation

### Borders & Dividers
- **Linen Border** (`#EAE2D8`): Default border
- **Soft Divider** (`#EFE8DF`): Section separators
- **Active Apricot Border** (`#F58A4B`): Selected or active surfaces

### Semantic Colors
- **Progress Sage** (`#8DAA91`): Positive progress, completed states, success
- **Recovery Blue** (`#A9C5D8`): Recovery, readiness, informational states
- **Warm Amber** (`#DDB36C`): Caution, fatigue, needs attention
- **Muted Terracotta** (`#C97B63`): Pain, error, failed validation, risk
- **Plum Gray** (`#8E8496`): Neutral analysis, body composition, secondary trends

### Controlled Gradients
Gradients are allowed only for:
- the Today workout hero card
- primary completion moments
- selected brand moments
- subtle data visualizations

Primary gradient:
- `linear-gradient(135deg, #F58A4B 0%, #FFB178 100%)`

Soft gradient:
- `linear-gradient(135deg, #FFF4EB 0%, #FFE5D2 100%)`

Do not use gradients on every button, card, or header.

### Dark Mode
Dark mode is secondary, not the primary design target.

- **Dark Background** (`#111214`)
- **Dark Surface** (`#191A1D`)
- **Dark Elevated Card** (`#212226`)
- **Dark Border** (`#303238`)
- **Primary Text Dark** (`#F7F5F1`)
- **Secondary Text Dark** (`#B8B5B0`)
- **Accent Dark** (`#F49A62`)

Dark mode should preserve the same hierarchy, spacing, and simplicity. It should not become neon, gamer-like, or overly contrast-heavy.

---

## 4. User-Selectable Accent Themes

### Purpose

Users may personalize Toci with a curated accent theme while preserving the app’s premium, elegant, coach-first identity.

This is **accent personalization**, not a complete reskin.

Changing the theme may update:
- primary buttons
- active navigation states
- selected chips and segmented controls
- focus rings
- primary progress lines
- hero-card accents
- links and small interactive highlights
- subtle branded illustrations

Changing the theme must **not** update:
- the Warm Ivory or dark-mode base surfaces
- primary and secondary text colors
- success, recovery, warning, pain, or error meanings
- workout difficulty colors
- readiness status meaning
- spacing, typography, radius, or layout
- the coaching tone
- the information hierarchy

The interface should always remain recognizably Toci.

### Default Theme

**Toci Apricot is the default.**

New accounts, existing accounts without a stored preference, signed-out previews, screenshots, marketing renders, and fallback states must use Toci Apricot.

Do not ask users to choose a theme during required onboarding. The app should make the decision for them and let them personalize later.

### Theme Options

The following colors are derived directly from the approved theme swatches.

| Theme | Source Accent | Theme Role | Accent Wash | Accent Ink | On-Accent Text | Controlled Gradient |
|---|---:|---|---:|---:|---:|---|
| **Toci Apricot — Default** | `#F58A4B` | Warm, energetic, premium | `#FFF0E5` | `#A94F1F` | `#202124` | `#F58A4B` → `#FFB178` |
| **Toci Mint** | `#C8EEC4` | Fresh, restorative, balanced | `#F0FAEF` | `#416E45` | `#202124` | `#B5E7B0` → `#DDF7DA` |
| **Toci Blush** | `#F7B1BB` | Warm, soft, expressive | `#FFF0F3` | `#9B4D5A` | `#202124` | `#F7B1BB` → `#FFD2D9` |
| **Toci Butter** | `#FFFEAE` | Optimistic, light, energetic | `#FFFEEA` | `#746B16` | `#202124` | `#F4ED83` → `#FFFEAE` |
| **Toci Sky** | `#C4E6FF` | Clear, calm, recovery-led | `#EFF8FF` | `#376A8F` | `#202124` | `#A9D8F8` → `#D8EFFF` |
| **Toci Coral** | `#FF6962` | Bold, active, high energy | `#FFF0EF` | `#A53732` | `#202124` | `#FF6962` → `#FF9B95` |
| **Toci Cocoa** | `#836853` | Grounded, strong, understated | `#F4EEE9` | `#5E4634` | `#FFFFFF` | `#836853` → `#B89D87` |
| **Toci Graphite** | `#737373` | Neutral, focused, minimal | `#F1F1F1` | `#505050` | `#FFFFFF` | `#737373` → `#A5A5A5` |

### Exact Approved Source Swatches

Use these exact source values as the visible theme swatches:
- Mint: `#C8EEC4`
- Blush: `#F7B1BB`
- Butter: `#FFFEAE`
- Sky: `#C4E6FF`
- Coral: `#FF6962`
- Cocoa: `#836853`
- Graphite: `#737373`

Do not replace these with a generic framework palette.

### Theme Token Architecture

All accent-sensitive components must use shared semantic tokens instead of hard-coded orange values.

Required light-mode tokens:

```css
:root,
[data-accent-theme="apricot"] {
  --accent: #F58A4B;
  --accent-soft: #FFB178;
  --accent-wash: #FFF0E5;
  --accent-ink: #A94F1F;
  --on-accent: #202124;
  --accent-border: #F3B58E;
  --accent-focus: rgba(245, 138, 75, 0.24);
  --accent-gradient: linear-gradient(135deg, #F58A4B 0%, #FFB178 100%);
}

[data-accent-theme="mint"] {
  --accent: #C8EEC4;
  --accent-soft: #DDF7DA;
  --accent-wash: #F0FAEF;
  --accent-ink: #416E45;
  --on-accent: #202124;
  --accent-border: #A9DDA4;
  --accent-focus: rgba(200, 238, 196, 0.34);
  --accent-gradient: linear-gradient(135deg, #B5E7B0 0%, #DDF7DA 100%);
}

[data-accent-theme="blush"] {
  --accent: #F7B1BB;
  --accent-soft: #FFD2D9;
  --accent-wash: #FFF0F3;
  --accent-ink: #9B4D5A;
  --on-accent: #202124;
  --accent-border: #E99AA8;
  --accent-focus: rgba(247, 177, 187, 0.30);
  --accent-gradient: linear-gradient(135deg, #F7B1BB 0%, #FFD2D9 100%);
}

[data-accent-theme="butter"] {
  --accent: #FFFEAE;
  --accent-soft: #FFF8C7;
  --accent-wash: #FFFEEA;
  --accent-ink: #746B16;
  --on-accent: #202124;
  --accent-border: #E9E27F;
  --accent-focus: rgba(255, 254, 174, 0.38);
  --accent-gradient: linear-gradient(135deg, #F4ED83 0%, #FFFEAE 100%);
}

[data-accent-theme="sky"] {
  --accent: #C4E6FF;
  --accent-soft: #D8EFFF;
  --accent-wash: #EFF8FF;
  --accent-ink: #376A8F;
  --on-accent: #202124;
  --accent-border: #9FD0F4;
  --accent-focus: rgba(196, 230, 255, 0.34);
  --accent-gradient: linear-gradient(135deg, #A9D8F8 0%, #D8EFFF 100%);
}

[data-accent-theme="coral"] {
  --accent: #FF6962;
  --accent-soft: #FF9B95;
  --accent-wash: #FFF0EF;
  --accent-ink: #A53732;
  --on-accent: #202124;
  --accent-border: #EA5550;
  --accent-focus: rgba(255, 105, 98, 0.26);
  --accent-gradient: linear-gradient(135deg, #FF6962 0%, #FF9B95 100%);
}

[data-accent-theme="cocoa"] {
  --accent: #836853;
  --accent-soft: #B89D87;
  --accent-wash: #F4EEE9;
  --accent-ink: #5E4634;
  --on-accent: #FFFFFF;
  --accent-border: #725845;
  --accent-focus: rgba(131, 104, 83, 0.26);
  --accent-gradient: linear-gradient(135deg, #836853 0%, #B89D87 100%);
}

[data-accent-theme="graphite"] {
  --accent: #737373;
  --accent-soft: #A5A5A5;
  --accent-wash: #F1F1F1;
  --accent-ink: #505050;
  --on-accent: #FFFFFF;
  --accent-border: #666666;
  --accent-focus: rgba(115, 115, 115, 0.24);
  --accent-gradient: linear-gradient(135deg, #737373 0%, #A5A5A5 100%);
}
```

Equivalent centralized tokens must be used for SwiftUI, Jetpack Compose, React Native, or any other client framework.

Do not create a separate stylesheet or duplicate component library for each theme.

### Dark-Mode Behavior

Appearance and accent are separate settings.

Appearance choices:
- System
- Light
- Dark

Accent choices:
- Apricot
- Mint
- Blush
- Butter
- Sky
- Coral
- Cocoa
- Graphite

In dark mode:
- preserve the dark surfaces defined in the Dark Mode section
- use the selected accent for active states and highlights
- prefer the lighter `--accent-soft` value where the base accent becomes too dark
- preserve readable `--on-accent` text
- do not tint the entire dark background with the selected color
- do not create eight separate dark-mode designs

### Theme Picker UI

Theme selection lives under:

**Profile → Appearance**

Do not place it in the bottom navigation.

The Appearance screen should contain:

1. **Appearance**
   - System
   - Light
   - Dark

2. **Accent Color**
   - a compact two-column grid or horizontally wrapping swatch list
   - visible color sample
   - human-readable theme name
   - checkmark on the selected theme
   - “Default” label beside Toci Apricot

3. **Preview**
   - one compact example card showing a button, progress line, and selected chip
   - do not create a large decorative phone preview
   - update immediately when a swatch is selected

4. **Reset**
   - tertiary action: “Use Toci Default”
   - resets accent to Apricot without resetting other profile settings

### Theme Picker Interaction Rules

- Apply the selected theme immediately.
- Use a soft selection haptic.
- Do not require a separate Save button.
- Persist the selection locally immediately.
- Sync the preference to the user account when authenticated.
- If syncing fails, retain the local preference and retry quietly.
- Never block workout logging because a theme preference failed to sync.
- Preserve the theme across sessions and devices after successful sync.
- Show a visible checkmark, not color alone, for the selected option.
- Maintain a minimum 44px touch target.
- Theme changes must not cause layout shift or reset the user’s current tab, scroll position, or active workout.

### Theme Application Rules

Use the active theme for:
- the single primary CTA
- selected bottom-navigation icon and label
- active segmented-control label or indicator
- selected chips
- focus states
- primary chart series
- progress indicators tied to neutral completion
- branded hero-card accents
- links and small action labels

Do not use the active theme for:
- error
- pain
- destructive actions
- warning
- readiness risk
- success confirmation when the semantic meaning matters more
- every card background
- every icon
- every chart series
- large blocks of body text

### Semantic Color Protection

Semantic colors must remain stable across all themes.

Examples:
- Pain remains Muted Terracotta.
- Warning remains Warm Amber.
- Recovery information remains Recovery Blue.
- Positive progress remains Progress Sage.
- Errors remain error-colored even when Coral is selected.
- Success must include an icon or label and never rely on green alone.

The accent communicates **brand and selection**.

Semantic colors communicate **meaning and state**.

Do not mix those jobs.

### Charts and Data Visualization

- Apply the active accent to the primary series only.
- Use neutral graphite for historical comparisons.
- Use fixed semantic colors for recovery, warning, or pain-related data.
- Do not recolor every series to variations of the selected theme.
- Preserve readable contrast in both light and dark appearances.
- Tooltips must state the metric explicitly and never rely only on line color.

### Accessibility and Contrast

Pastel colors are intentionally light.

Therefore:
- use `--on-accent: #202124` on Apricot, Mint, Blush, Butter, Sky, and Coral
- use `--on-accent: #FFFFFF` on Cocoa and Graphite
- never assume white text is readable on a pastel fill
- test all theme states against WCAG contrast requirements
- do not use accent-colored body text on Warm Ivory unless the darker `--accent-ink` token is used
- selected states must include shape, border, icon, or weight in addition to color
- theme swatches must include accessible names for screen readers

### Persistence Model

Add a single user preference rather than separate booleans:

```text
accent_theme:
  apricot | mint | blush | butter | sky | coral | cocoa | graphite

appearance:
  system | light | dark
```

Requirements:
- default `accent_theme` to `apricot`
- default `appearance` to `system`
- migrate users without these fields safely
- validate unknown values and fall back to Apricot
- keep the setting independent from workout, program, and nutrition data
- avoid storing visual tokens in the database; store only the enum key

### Theme Acceptance Criteria

Theme customization is complete only when:
- Apricot is the default for all users without a preference
- all eight options appear in Profile → Appearance
- every swatch uses the approved source color
- selecting a theme updates the interface immediately
- the choice persists across reloads and signed-in sessions
- semantic colors remain unchanged
- primary buttons use readable on-accent text
- light and dark appearance both work
- no duplicate theme-specific components exist
- changing the theme does not interrupt an active workout
- visual regression tests cover every theme on core screens
- the product still feels like one coherent Toci interface


---

## 5. Typography Rules

### Font Families
- **Primary UI / Body:** `Inter`, fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **Display / Editorial Accent:** `Manrope`, fallback: `Inter, -apple-system, sans-serif`

Use system fonts when app performance or platform fidelity is more important than strict visual matching.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Use |
|------|------|------|--------|-------------|-----|
| Large Display | Manrope | 32px | 700 | 1.10 | Today title, completion moment |
| Screen Title | Manrope | 26px | 700 | 1.15 | Program, Progress, Nutrition |
| Hero Metric | Manrope | 28px–40px | 700 | 1.00 | Readiness, volume, weight |
| Section Title | Inter | 18px | 700 | 1.25 | Major card/section headings |
| Card Title | Inter | 16px | 700 | 1.30 | Exercise, goal, insight title |
| Body | Inter | 15px–16px | 400 | 1.45 | Coach explanations, descriptions |
| Body Strong | Inter | 15px–16px | 600 | 1.40 | Emphasis within content |
| Button | Inter | 15px | 700 | 1.00 | Primary and secondary actions |
| Caption | Inter | 13px | 500 | 1.35 | Metadata, previous set, timing |
| Micro Label | Inter | 11px | 700 | 1.20 | Category labels, small status |

### Principles
- Important numbers must be immediately scannable.
- Use size and weight before color to create hierarchy.
- Use no more than three font weights on a screen.
- Avoid all-caps except for very small category labels.
- Do not use text smaller than 11px.
- Keep long coach explanations at comfortable body size and line height.
- Prefer sentence case for buttons and labels.

---

## 6. Geometry, Radius & Elevation

### Border Radius Scale
- **Small:** 10px — chips, compact controls
- **Input:** 14px — fields, segmented controls
- **Button:** 16px — primary and secondary actions
- **Card:** 20px — standard cards
- **Hero Card:** 24px — prominent Today and Program cards
- **Sheet / Modal:** 28px top corners
- **Pill:** 9999px — status chips, compact filters
- **Circle:** 50% — icon-only actions and avatars

### Shadows
- **Card:** `0 8px 24px rgba(82, 59, 37, 0.06)`
- **Elevated:** `0 14px 36px rgba(82, 59, 37, 0.10)`
- **Pressed:** `0 4px 12px rgba(82, 59, 37, 0.08)`

Shadows should be warm, soft, and nearly invisible. They should communicate elevation without creating floating plastic panels.

### Borders
- Default: `1px solid #EAE2D8`
- Active: `1.5px solid #F58A4B`
- Error: `1.5px solid #C97B63`

Avoid thick borders and dark outlines.

---

## 7. Spacing System

### Base Scale
Use a 4px base system:
- 4px
- 8px
- 12px
- 16px
- 20px
- 24px
- 32px
- 40px

### Mobile Screen Margins
- Standard horizontal margin: 16px
- Large-screen margin: 20px–24px
- Card padding: 16px–20px
- Hero-card padding: 20px–24px
- Gap between related items: 8px–12px
- Gap between sections: 20px–28px

### Whitespace Philosophy
Whitespace is functional. It shows what belongs together and what deserves attention.

Do not fill empty space simply because the screen appears sparse.

However, avoid excessive whitespace during active workout logging. Workout screens should remain focused and efficient.

---

## 8. Navigation

### Primary Bottom Navigation
Recommended mobile tabs:
1. Today
2. Program
3. Workout
4. Nutrition
5. Progress

Profile is accessed from the avatar in the top-right or through a secondary More area.

This reduces bottom-navigation crowding and keeps the five most important user destinations visible.

### Tab Roles
- **Today:** daily launchpad
- **Program:** long-term structure and coach headquarters
- **Workout:** start, resume, or log training
- **Nutrition:** daily food and meal support
- **Progress:** meaningful trends and history

### Settings
Settings must live inside Profile. Do not create a dedicated bottom tab.

### Navigation Rules
- Keep the bottom nav stable.
- Preserve the user’s scroll/tab position when returning.
- Use back navigation consistently.
- Conversation may deep-link users into the correct tab or screen.
- Never require users to manually navigate through several layers when the AI already knows the target.

---

## 9. Component Stylings

### Primary Button
- Background: active `--accent` or `--accent-gradient`; Toci Apricot is the default
- Text: active `--on-accent`; never assume white is readable on a pastel fill
- Height: 52px–56px
- Radius: 16px
- Font: 15px Inter, 700
- Shadow: subtle warm shadow
- Use: one primary action per screen

Examples:
- Start Workout
- Complete Set
- Finish Workout
- Save Changes
- See Next Workout

### Secondary Button
- Background: active `--accent-wash` or white
- Text: active `--accent-ink` or Charcoal
- Border: `1px solid var(--accent-border)`
- Height: 44px–50px
- Radius: 14px–16px

### Tertiary Action
- Text-only
- Active `--accent-ink` or graphite text
- No filled background
- Use for lower-priority actions such as Skip Exercise, View History, or Edit

### Icon Button
- 44px minimum touch target
- White or soft sand surface
- Thin line icon
- Radius: circle or 14px
- Use sparingly

### Hero Card
- White or active `--accent-gradient` background; Apricot is the default
- 24px radius
- 20px–24px padding
- Strong title and one primary CTA
- Maximum one hero card per screen

### Standard Card
- White background
- 20px radius
- 16px–20px padding
- Linen border or soft shadow
- One clear purpose

### Insight Card
- Light semantic wash background
- Small semantic icon
- Coach statement
- Optional single action

Examples:
- Sage wash for positive progress
- Amber wash for caution
- Blue wash for readiness/recovery information

### Metric Card
- One primary number
- One short label
- Optional trend indicator
- Never include dense explanations

### Segmented Control
- Soft Sand background
- Selected segment: white or active `--accent-wash`
- Radius: 14px
- Text: 13px–14px, 600
- Maximum 4 visible segments on mobile

### Chips
- Height: 34px–38px
- Radius: pill
- Neutral background when unselected
- Active `--accent` fill or `--accent-border` border when selected
- Text labels must remain readable and human

### Inputs
- Background: `#FAF7F2`
- Border: `1px solid #EAE2D8`
- Radius: 14px
- Minimum height: 48px
- Focus: active `--accent-border` with `--accent-focus` outer glow

Inputs should not feel like a government form. Use steppers, chips, sliders, and conversational prompts when more natural.

---

## 10. Today Screen

### Purpose
Answer one question:

> “What should I do today?”

### Required Hierarchy
1. Date and greeting
2. Readiness summary
3. Today’s workout hero card
4. One or two supporting cards
5. Compact weekly progress

### Hero Workout Card
Include:
- workout name
- current week and day
- primary focus
- estimated duration
- exercise count
- one primary button: **Start Workout**

The workout card should visually dominate the screen.

### Readiness Card
Show:
- one readiness score
- sleep
- energy
- concise coach interpretation

Avoid displaying many readiness sub-metrics at once.

### Secondary Content
Possible support cards:
- nutrition snapshot
- weekly workout completion
- one coach observation

Do not show every feature on Today.

### Scrolling Goal
Core daily information and Start Workout should fit within the first viewport on a typical phone.

---

## 11. Program Screen

### Purpose
Answer:

> “What program am I on, where am I in it, and why?”

### Primary Structure
Use a sticky top summary and a segmented view.

Recommended segments:
- Overview
- Schedule
- Goals
- Coach

Do not stack all program information into one endless page.

### Program Header
Show:
- program name
- current phase
- week X of Y
- completion bar
- status such as On Track, Modified, or Reassessment Due

### Overview
Show only:
- today’s workout
- current phase focus
- top three goals
- one coach observation
- one upcoming decision

### Schedule
- seven-day horizontal week strip or compact list
- current day highlighted
- each day opens its workout detail
- rest days remain visually quiet
- allow moving or swapping sessions through a simple drill-down

### Goals
Each goal card includes:
- goal name
- starting point
- current status
- target
- one coach interpretation

Examples:
- Run 3 miles continuously
- Improve pull-ups
- Maintain squat strength
- Improve posture consistency

### Coach
Show:
- current observations
- recent program changes
- unanswered follow-up questions
- Ask Toci field

### Scrolling Goal
Each segment should be concise enough to scan without long scrolling. Drill into detail rather than stacking every detail on one screen.

---

## 12. Workout / Log Screen

### Purpose
Answer:

> “What do I do next right now?”

This is the most important interface in Toci.

### Workout Structure
Use three focused layers:
1. compact session header
2. active exercise
3. upcoming workout outline

### Session Header
Show:
- workout name
- exercise progress, e.g. 2 of 6
- elapsed time
- compact End action

Avoid large permanent headers during training.

### Warm-Up
Warm-up should be an optional first step with:
- stretch-room movements
- exercise-specific preparation
- ramp-up sets

Use a short checklist. Do not mix warm-up instructions into every exercise card.

### Active Exercise Card
Display one exercise prominently.

Include:
- exercise name
- purpose
- target sets and reps
- previous session
- recommended load
- current set number
- weight control
- rep control
- rest recommendation
- Complete Set button

### Full Workout Outline
Show remaining exercises as compact collapsed rows beneath or within a bottom sheet.

Completed exercises should collapse and move into a completed state. Upcoming exercises should stay visible but visually secondary.

### Logging Speed
The user should be able to log a normal set in one tap when the planned values are correct.

Prefill:
- recommended weight
- target reps
- previous exercise setup
- equipment level where relevant

### Set Feedback
After logging, show a lightweight feedback sheet only when useful.

First-level question:
- Too Easy
- Right on Target
- Tough
- Too Hard

Optional expanded feedback:
- Clean
- Mostly Clean
- Form Broke Down
- Pain

RIR:
- 0
- 1
- 2
- 3
- 4+
- Unsure

Do not require every answer after every set.

### Rest Timer
- begins automatically after a set when enabled
- remains compact
- can be expanded
- offers +30 sec and Skip
- should not block logging or navigation

### Scrolling Goal
The user should not scroll through six full exercise forms. Only the active exercise is expanded.

---

## 13. Exercise Detail / Set Logging Screen

### Purpose
Capture the set without breaking workout focus.

### Layout
1. compact exercise header
2. set number
3. weight stepper
4. reps stepper
5. quick RIR selector
6. quick feel selector
7. optional note
8. Complete Set

### Weight Control
- large central value
- minus and plus controls
- unit clearly visible
- quick recent values below

### Reps Control
- large value
- minus and plus controls
- preserve planned reps by default

### Human Labels
Prefer:
- Too Easy
- Just Right
- Tough
- Too Hard

Avoid:
- Performance Class A
- Optimal Stimulus
- Failure Threshold

### Technique
Prefer:
- Clean
- Mostly Clean
- Needs Work

### Notes
Optional, collapsed by default.

---

## 14. Workout Completion & Coach Review

### Completion Screen
The first screen after finishing should be celebratory but restrained.

Show:
- “Great work, Aaron.”
- total time
- exercises completed
- one or two meaningful metrics
- primary button: **View Coach Review**

Avoid confetti overload, loud animations, or excessive gamification.

### Coach Review Screen
Answer:

> “What did this workout mean?”

Structure:
1. overall summary
2. three to five important observations
3. unanswered questions
4. next-workout recommendations
5. primary button: **See Next Workout**

### Observation Card Examples
- Squat stayed consistent
- Split squat improved
- Leg curl was calibrated
- Core was skipped
- Dog walk replaced incline walking

Each observation should include:
- what happened
- what it means
- what Toci recommends or asks next

### Recommendation Presentation
Show one preferred recommendation and up to two alternatives.

Example:
- Recommended: Repeat 40 lb and make all sets clean
- Alternative: Add one rep
- Alternative: Increase weight if balance felt stable

The user can accept, choose another option, or defer.

---

## 15. Progress Screen

### Purpose
Answer:

> “Am I improving?”

### Layout
1. selected category or exercise
2. one primary chart
3. one coach interpretation
4. recent PRs or notable sessions
5. category switcher

### Categories
- Strength
- Running
- Body Composition
- Consistency

### Chart Rules
- one chart at a time
- minimal axes
- minimal gridlines
- readable touch tooltip
- active theme accent line for primary progress
- semantic secondary lines only when comparison adds value

### Progress Interpretation
Charts should be paired with a coach statement.

Example:
> “Your squat weight stayed at 205 lb, but average reported effort dropped from 9/10 to 7.5/10.”

Avoid chart walls and tiny dashboards.

---

## 16. Nutrition Screen

### Purpose
Answer:

> “What should I eat or log?”

### Top-Level Navigation
Use internal segments:
- Today
- Food
- Recipes
- Smart Cart

### Today
Show:
- calories
- protein
- carbs
- fat
- meals logged
- one AI suggestion

### Food
- search
- recent foods
- favorites
- common foods
- scan action

### Recipes
- personalized recipe cards
- macro summary
- diet tags
- save and add-to-plan actions

### Smart Cart
- grouped grocery list
- budget awareness
- pantry-aware suggestions
- recipe links

### Scrolling Goal
Use tabs and category sections instead of placing every nutrition feature on one page.

---

## 17. Profile & Settings

### Purpose
Provide personal context without a giant settings wall.

### Profile Home
Show:
- avatar
- name
- short goal summary
- high-level stats
- section links

### Required Sections
- Overview
- Goals
- Body Stats
- Training Preferences
- Nutrition Preferences
- Devices
- Appearance
- Account

Each section opens its own focused screen or bottom sheet.

### Overview
- age
- height
- current weight
- experience
- activity level

### Goals
- primary goal
- secondary goals
- desired training frequency
- performance targets

### Body Stats
- weight
- optional measurements
- progress photo access

### Training Preferences
- available days
- equipment
- preferred split
- disliked exercises
- session duration

### Devices
- Apple Health
- Apple Watch
- Whoop
- Oura

### Appearance
- appearance mode: System, Light, or Dark
- accent color: Apricot, Mint, Blush, Butter, Sky, Coral, Cocoa, or Graphite
- Toci Apricot visibly labeled as Default
- immediate live preview using shared theme tokens
- tertiary action to restore the Toci default
- no separate Save button

### Account
- email
- password
- notifications
- privacy
- sign out

### Scrolling Goal
No profile screen should require the user to zoom out or scroll through all settings at once. Use dedicated section screens.

---

## 18. AI Conversation Design

### Tone
Toci should sound:
- calm
- direct
- observant
- supportive
- honest
- collaborative

Toci should not sound:
- robotic
- overly motivational
- clinical
- condescending
- hype-driven

### Good Examples
- “Your squat stayed consistent today.”
- “The 40 lb split squats were productive, but your effort description and estimated reps in reserve do not fully match.”
- “You skipped core again. Was that time, fatigue, or preference?”
- “Your dog walk may have covered the intended low-intensity cardio. How long was it?”

### Bad Examples
- “You crushed it, beast!”
- “Optimal hypertrophic stimulus achieved.”
- “Your performance matrix indicates suboptimal output.”

### Conversation as Navigation
Users should be able to ask:
- Pull up my workout numbers
- I’m on Sunday
- What are my warm-up movements?
- What did I use last time?
- Can I replace this exercise?
- Am I progressing?

Toci should deep-link or surface the correct screen automatically.

---

## 19. Motion & Haptics

### Motion Principles
Motion communicates state. It does not decorate.

Use:
- 150–250ms transitions
- ease-out for entering content
- subtle scale-down on button press
- smooth card expansion
- progress-bar animation on completion
- exercise collapse after completion

Avoid:
- bouncing cards
- spinning logos
- excessive confetti
- long cinematic transitions

### Haptics
Use soft haptic feedback for:
- logging a set
- completing an exercise
- accepting a recommendation
- completing a workout

Use stronger haptic feedback only for:
- PR achieved
- timer finished
- pain alert confirmation

---

## 20. Loading, Empty & Error States

### Loading
Use skeleton loaders that match the final layout.
Avoid blocking spinners whenever possible.

### Empty States
Every empty state should teach the user what happens next.

Bad:
- “No data.”

Good:
- “Complete your first workout to unlock exercise trends.”
- “Add a progress photo to begin visual comparisons.”
- “Log a meal to start today’s nutrition coaching.”

### Errors
Errors should:
- explain what happened simply
- preserve entered data
- show one clear recovery action

Example:
> “Your set was saved locally. We’ll sync it when your connection returns.”

---

## 21. Accessibility

- Minimum touch target: 44px × 44px
- Support dynamic type where possible
- Do not rely on color alone
- Maintain readable contrast
- Provide clear selected states for chips and tabs
- Support VoiceOver labels
- Keep chart insights available in text
- Avoid tiny text and dense input grids
- Use plain language for feedback controls

Accessibility is part of premium design, not an optional enhancement.

---

## 22. Responsive Behavior

### Breakpoints
| Name | Width | Behavior |
|------|-------|----------|
| Mobile Small | <375px | Compact spacing, stacked controls |
| Mobile | 375–576px | Primary design target |
| Tablet | 576–900px | Wider cards, optional two-column support content |
| Desktop | >900px | Centered app shell, side navigation optional |

### Collapsing Strategy
- Keep active workout focused on one exercise at all sizes
- Convert bottom navigation to side navigation only on wide layouts
- Preserve card hierarchy
- Do not stretch cards excessively on desktop
- Use a centered max-width content column for conversational and settings screens
- Allow two-column layouts only where it reduces scrolling without reducing clarity

---

## 23. Do’s and Don’ts

### Do
- Use warm ivory backgrounds and white cards
- Use the active accent theme for primary actions and active states; Apricot is the default
- Keep one clear primary action per screen
- Use segmented views to reduce long scrolling
- Show one exercise at a time during workouts
- Prefill known workout values
- Pair progress metrics with coaching interpretation
- Use pastel semantic colors only for meaning
- Let cards breathe
- Keep logging fast
- Make Program and Workout the best parts of the app

### Don’t
- Don’t create giant vertical profile or program pages
- Don’t show all workout exercises as full forms at once
- Don’t use the selected accent on every surface
- Don’t add decorative charts
- Don’t use multiple competing CTA buttons
- Don’t use tiny labels or compressed forms
- Don’t add settings when AI can make a safe default decision
- Don’t use gamified language that conflicts with the premium coach tone
- Don’t duplicate components or design patterns
- Don’t preserve clutter just because it already exists

---

## 24. Code & Implementation Rules

### KISS Engineering
- Prefer the simplest maintainable implementation
- Extend existing components before creating parallel systems
- Reuse design tokens
- Centralize shared interaction patterns
- Remove dead code and duplicate styles
- Avoid unnecessary dependencies
- Keep components focused on one responsibility
- Keep state close to where it is used unless multiple screens genuinely share it

### Permission for Routine Work
Within an approved implementation phase, the coding agent may proceed without requesting confirmation for:
- routine file edits
- component refactors
- renaming or moving files
- deleting dead code
- consolidating duplicate styles
- running tests and linters
- fixing local type errors
- updating internal documentation

The agent must still stop before:
- force-pushing
- deleting remote branches
- changing production infrastructure
- exposing or rotating secrets
- adding paid services
- performing irreversible data deletion

### Quality Rule
Every implementation should leave the repository cleaner than it was found.

---

## 25. Agent Prompt Guide

### Quick Color Reference
- Background: Warm Ivory (`#FBF8F3`)
- Secondary background: Soft Sand (`#F6F0E8`)
- Card: White (`#FFFFFF`)
- Primary text: Charcoal (`#202124`)
- Secondary text: Graphite (`#5F6268`)
- Default accent: Toci Apricot (`#F58A4B`)
- Available accents: Mint (`#C8EEC4`), Blush (`#F7B1BB`), Butter (`#FFFEAE`), Sky (`#C4E6FF`), Coral (`#FF6962`), Cocoa (`#836853`), Graphite (`#737373`)
- Default accent gradient: `#F58A4B` to `#FFB178`
- Accent tokens: `--accent`, `--accent-soft`, `--accent-wash`, `--accent-ink`, `--on-accent`, `--accent-border`, `--accent-focus`, `--accent-gradient`
- Success: Progress Sage (`#8DAA91`)
- Recovery: Recovery Blue (`#A9C5D8`)
- Warning: Warm Amber (`#DDB36C`)
- Error: Muted Terracotta (`#C97B63`)
- Border: Linen Border (`#EAE2D8`)

### Example Component Prompts
- “Create a standard Toci card using a white background, 20px radius, 18px padding, a 1px #EAE2D8 border, and a subtle warm shadow. Use a 16px Inter 700 title and 13px graphite metadata.”
- “Create a primary Toci button using `var(--accent-gradient)`, `var(--on-accent)` 15px Inter 700 text, 54px height, 16px radius, and a subtle pressed scale state. Apricot must render by default.”
- “Create a segmented control using #F6F0E8 as the track, a white selected segment, 14px radius, and 13px Inter 600 labels. Use the active `--accent-ink` token for the selected label.”
- “Create an active exercise card that shows the exercise name, target, previous set, recommended weight, current set number, large weight and rep controls, and one Complete Set button. Keep optional feedback collapsed.”
- “Create a coach observation card with a pastel semantic wash, small line icon, concise observation, short interpretation, and no more than one secondary action.”

### Screen Render Rules
When producing UI mockups or coded screens:
- render one screen at a time
- do not create collages
- use a mobile 9:16 or iPhone-native viewport
- keep the entire visible screen internally consistent
- use realistic Toci data
- maintain the same typography, spacing, components, and palette
- show the primary action without requiring scrolling

### Iteration Guide
1. Establish the Warm Ivory background and white-card hierarchy
2. Use the active accent only for the main action, active state, and key progress; default to Apricot
3. Confirm the screen answers one question
4. Remove any card that does not support that question
5. Reduce scrolling through tabs, segmented controls, sheets, or drill-down screens
6. Verify the user knows what to tap next within three seconds
7. Confirm the screen feels like coaching, not data entry
8. Remove duplicate code and styling before finishing

---

## 26. Exact Claude Design / Claude Code Prompt

Read this entire `design.md` before making any UI changes. Treat it as the single source of truth for Toci’s visual language, interaction system, information hierarchy, and product design principles.

Toci is an adaptive AI fitness coach. It is not a generic workout tracker, spreadsheet, or analytics dashboard.

Your implementation must feel:
- premium
- elegant
- athletic
- calm
- personal
- simple
- coach-led

Follow KISS: Keep It Simple, Stupid.

Simple means fewer decisions for the user, not fewer capabilities.

### Theme Customization Requirement

Implement the accent-theme system defined in Section 4.

Required options:
- Apricot — default
- Mint
- Blush
- Butter
- Sky
- Coral
- Cocoa
- Graphite

Add Profile → Appearance with separate controls for appearance mode and accent color. Apply changes immediately, persist the enum preference, preserve semantic colors, and use shared tokens rather than theme-specific component copies.

### Primary Objectives
1. Redesign the interface around Toci’s warm pastel system, using Toci Apricot as the default and supporting the approved selectable accent themes.
2. Make Program and Workout / Logging the strongest experiences in the application.
3. Reduce excessive vertical scrolling, especially in Profile, Settings, Program, and workout logging.
4. Replace giant stacked pages with focused sections, segmented controls, drill-down screens, bottom sheets, and progressive disclosure.
5. Ensure every screen has one clear purpose and one obvious primary action.
6. Reuse and improve existing code rather than creating duplicate design systems or parallel components.

### Required Screens
Implement or redesign:
1. Today
2. Program Overview
3. Program Schedule
4. Program Goals
5. Program Coach
6. Workout Start / Preparation
7. Active Workout
8. Exercise Set Logging
9. Workout Completion
10. Coach Review
11. Progress
12. Nutrition
13. Profile Overview
14. Profile section screens

### Screen Questions
- Today: “What should I do today?”
- Program: “What am I training and why?”
- Workout: “What do I do next right now?”
- Set Logging: “What happened in this set?”
- Coach Review: “What did the workout mean?”
- Progress: “Am I improving?”
- Nutrition: “What should I eat or log?”
- Profile: “What personal context does Toci use?”

### Workout Logging Requirements
The active workout experience must not display every exercise as a full form.

Show one active exercise prominently. Keep completed and upcoming exercises compact.

Prefill:
- recommended weight
- target reps
- previous performance
- current set number

Allow one-tap set completion when values are correct.

Use lightweight optional feedback:
- Too Easy
- Right on Target
- Tough
- Too Hard

Technique:
- Clean
- Mostly Clean
- Needs Work

RIR:
- 0
- 1
- 2
- 3
- 4+
- Unsure

Do not force every feedback question after every set.

### Program Requirements
Use segmented sections:
- Overview
- Schedule
- Goals
- Coach

Do not show all program content in one giant vertical page.

### Profile Requirements
Replace the current giant settings scroll with dedicated sections:
- Overview
- Goals
- Body Stats
- Training Preferences
- Nutrition Preferences
- Devices
- Appearance
- Account

### UI Rules
- Warm Ivory app background
- White cards
- Active user-selected accent with Toci Apricot as the default
- Shared theme tokens; no hard-coded orange inside reusable components
- Pastel semantic support colors that do not change with the accent theme
- Large rounded cards
- Soft warm shadows
- Readable charcoal typography
- One primary CTA per screen
- Minimum 44px touch targets
- No decorative charts
- No visual noise
- No generic dashboard layouts

### Engineering Permission
Within this implementation scope, proceed without asking for approval for routine edits, refactors, file moves, component consolidation, dead-code removal, test execution, lint fixes, and internal documentation updates.

Do not perform destructive external operations, force pushes, secret changes, paid-service additions, or production infrastructure changes without explicit approval.

### Required Workflow
1. Audit the current UI against this document.
2. Identify reusable components and duplicated systems.
3. Define the smallest clean component architecture needed.
4. Implement the redesigned screens in priority order:
   - Program
   - Workout / Logging
   - Today
   - Coach Review
   - Progress
   - Nutrition
   - Profile
5. Run the application and inspect every changed screen.
6. Test mobile responsiveness, touch targets, empty states, loading states, errors, and every approved accent theme in light and dark appearance.
7. Remove dead and duplicate code.
8. Provide a concise implementation summary.

### Completion Standard
The redesign is complete only when:
- the next action is obvious within three seconds
- Program and Profile no longer rely on giant pages
- workout logging focuses on one exercise at a time
- normal sets can be logged in one tap
- optional feedback remains easy but unobtrusive
- all screens visibly belong to one premium product across every approved accent theme
- Apricot remains the default and theme selection persists
- the app feels like a coach rather than a database
- the repository is cleaner than before the work began

