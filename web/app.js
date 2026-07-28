const API = "/api";
const state = {
  today: null,
  exercises: [],
  activeWorkoutSessionId: null,
  activeWorkoutExercises: [],
  units: "imperial", // "imperial" (lb/in) | "metric" (kg/cm) -- loaded from /api/settings at boot
  selectedFood: null,
  selectedServings: 1,
  selectedMealSlot: "snack",
  householdSize: 1,
  settings: null,
  onboardingPace: "lose_1",
  onboardingActivity: "active",
  programWeek: [],
  logPeriod: "this_week",
  nutritionDate: null, // set on boot to today's local date; see localDateStr()
  nutritionSegment: "food",
  nutritionEverLoaded: false,
};

const KG_PER_LB = 0.45359237;
const REST_PRESETS_SEC = [30, 60, 90, 120, 180, 300]; // 0:30, 1:00, 1:30, 2:00, 3:00, 5:00
const FEEL_OPTIONS = [
  { val: "clean", label: "Clean" }, { val: "difficult", label: "Difficult but solid" },
  { val: "sloppy", label: "Sloppy" }, { val: "partial", label: "Partial ROM" },
  { val: "assisted", label: "Assisted" }, { val: "pain", label: "Pain" }, { val: "unsure", label: "Unsure" },
];
const CONFIDENCE_OPTIONS = [{ val: "yes", label: "Yes" }, { val: "maybe", label: "Maybe" }, { val: "no", label: "No" }];

function weightUnit() {
  return state.units === "imperial" ? "lb" : "kg";
}
function heightUnit() {
  return state.units === "imperial" ? "in" : "cm";
}
// Canonical storage is always kg / cm. These only convert for display and input.
function kgToDisplay(kg) {
  if (kg == null) return null;
  const v = state.units === "imperial" ? kg / KG_PER_LB : kg;
  return Math.round(v * 10) / 10;
}
function displayToKg(value) {
  const v = parseFloat(value);
  if (Number.isNaN(v)) return null;
  return state.units === "imperial" ? v * KG_PER_LB : v;
}
function cmToDisplay(cm) {
  if (cm == null) return null;
  const v = state.units === "imperial" ? cm / 2.54 : cm;
  return Math.round(v * 10) / 10;
}
function displayToCm(value) {
  const v = parseFloat(value);
  if (Number.isNaN(v)) return null;
  return state.units === "imperial" ? v * 2.54 : v;
}
function fmtWeight(kg) {
  const v = kgToDisplay(kg);
  return v == null ? "—" : v + weightUnit();
}
function fmtRest(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

// Small inline trend line for stat/goal cards -- values are plotted low-to-high
// left-to-right with no axes, just a fading area fill and a highlighted endpoint.
function sparklineSvg(values, opts = {}) {
  const W = opts.width || 100, H = opts.height || 30;
  if (!values || values.length < 2) {
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '"></svg>';
  }
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const pad = (max - min) * 0.2 || 1;
  const yMin = min - pad, yMax = max + pad;
  const n = values.length;
  const xFor = (i) => (i / (n - 1)) * W;
  const yFor = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
  const coords = values.map((v, i) => [xFor(i), yFor(v)]);
  const line = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  const area = line + " L" + W + "," + H + " L0," + H + " Z";
  const gid = "sk" + Math.random().toString(36).slice(2, 9);
  return (
    '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" style="overflow:visible;">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="var(--brand)" stop-opacity="0.25"/>' +
    '<stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#' + gid + ')" stroke="none"/>' +
    '<path d="' + line + '" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + coords[n - 1][0] + '" cy="' + coords[n - 1][1] + '" r="3" fill="var(--brand)"/>' +
    "</svg>"
  );
}

// Shared checkmark glyph used by day-strip "done" dots.
const CHECK_SVG = '<svg viewBox="0 0 20 20" fill="none"><path d="M4.5 10.5L8 14L15.5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------------------------------------------------------------- helpers ----

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(path + " failed: " + res.status);
  return res.json();
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === id));
  document.querySelectorAll(".tab-bar .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === id));
  document.querySelector(".app").scrollTop = 0;
  document.getElementById("btn-fab-add-food").classList.toggle("hidden", id !== "view-today");
}

function titleCase(s) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelShort(t) {
  const map = { lift: "Lift", run: "Run", rest: "Rest", recover: "Rec" };
  return map[t] || t;
}

function labelForRunType(t) {
  const map = { easy: "Easy Run", recovery_jog: "Recovery Jog", tempo: "Tempo Run", interval: "Intervals", long: "Long Run" };
  return map[t] || "Run";
}

function fmtHours(min) {
  if (min == null) return "—";
  if (min === 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + "h" + (m ? " " + m + "m" : "");
}

// ------------------------------------------------------------------- nav ----

document.querySelectorAll(".tab-bar .tab").forEach((t) => {
  t.addEventListener("click", () => {
    const id = t.dataset.tab;
    showView(id);
    if (id === "view-today") { loadTodayMacroStats(); loadWeightProgressCard(); loadWearableCard(); }
    if (id === "view-food") { switchNutritionSegment("food"); loadFoodToday(); }
    if (id === "view-progress") loadProgress();
    if (id === "view-program") loadProgram();
    if (id === "view-settings") { loadSettings().then(() => { loadProfileOverview(); loadProfileGoals(); }); }
    if (id === "view-log") loadLogChooser();
  });
});
document.querySelectorAll("[data-back]").forEach((b) => {
  b.addEventListener("click", () => showView(b.dataset.back));
});

// ----------------------------------------------------------------- today ----

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

async function loadToday() {
  const data = await api("/today");
  state.today = data;

  const d = new Date(data.date + "T00:00:00");
  document.getElementById("today-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const name = state.settings && state.settings.name ? state.settings.name.split(" ")[0] : "";
  document.getElementById("today-greeting").textContent = timeOfDayGreeting() + (name ? ", " + name : "");
  document.getElementById("today-streak-n").textContent = data.streak;
  document.getElementById("today-streak-lbl").textContent = data.streak > 0 ? "Day streak" : "Start your streak";
  document.getElementById("streak-detail-panel").classList.add("hidden"); // collapse any previously open detail on refresh

  const score = data.readiness.score;
  const band = data.readiness.band;
  document.getElementById("readiness-value-num").textContent = Math.round(score);

  const bandTitle = document.getElementById("readiness-band-title");
  const bandWord = band === "green" ? "Good" : band === "amber" ? "Moderate" : "Take It Easy";
  bandTitle.textContent = bandWord;

  const ringFill = document.getElementById("readiness-ring-fill");
  const circumference = 194.8;
  const strokeVar = band === "green" ? "var(--success)" : band === "amber" ? "var(--warn)" : "var(--critical)";
  ringFill.style.stroke = strokeVar;
  ringFill.setAttribute("stroke-dashoffset", String(circumference * (1 - score / 100)));

  renderRecommendation(data);
  renderThisWeekStreak(data.week);
  renderNotifications(data);
  loadWaterCard();
  loadBodyFatCard();
}

function renderThisWeekStreak(week) {
  const body = document.getElementById("this-week-streak-body");
  const planned = week.filter((d) => d.day_type === "lift" || d.day_type === "run");
  const completed = planned.filter((d) => d.is_completed).length;
  const pctDone = planned.length ? completed / planned.length : 0;
  const caption = pctDone >= 0.8 ? "Great consistency" : pctDone >= 0.5 ? "Good pace" : "Let's build momentum";

  const strip = week
    .map((d) => {
      const dname = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1).toUpperCase();
      const isPlanned = d.day_type === "lift" || d.day_type === "run";
      const cls = "mds-item" + (d.is_today ? " today" : "") + (d.is_completed ? " done" : "");
      const dot = d.is_completed
        ? '<div class="mds-dot">' + CHECK_SVG + "</div>"
        : '<div class="mds-dot">' + (isPlanned ? "" : "") + "</div>";
      return '<div class="' + cls + '"><div class="mds-letter">' + dname + "</div>" + dot + "</div>";
    })
    .join("");

  body.innerHTML =
    '<div class="mini-day-strip">' + strip + "</div>" +
    '<div style="font-weight:800;font-family:var(--font-display);font-size:1.1rem;">' + completed + " of " + planned.length + " days</div>" +
    '<div style="font-size:0.78rem;color:var(--neutral-2);margin-top:0.1rem;">' + caption + "</div>";
}

document.getElementById("today-streak-pill").addEventListener("click", async (e) => {
  e.stopPropagation();
  const panel = document.getElementById("streak-detail-panel");
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  panel.innerHTML = '<div class="empty-note">Loading…</div>';
  panel.classList.remove("hidden");
  const weekly = await api("/progress/weekly-summary");
  const c = weekly.consistency;
  panel.innerHTML =
    '<div style="font-weight:700;font-size:0.88rem;margin-bottom:0.5rem;">Adherence this week</div>' +
    '<div class="set-row"><span class="k">Consistency score</span><span class="v tnum" style="font-weight:700;">' + c.score + " · " + c.band + "</span></div>" +
    '<div class="set-row" style="border-bottom:none;"><span class="k">Meals logged</span><span class="v tnum">' + weekly.days_logged + " of 7 days</span></div>";
});

// oz is the canonical hydration storage unit (same "canonical metric, converted
// for display" convention as weight_kg) -- 1 US fl oz = 29.5735 mL.
function ozToDisplay(oz) {
  return state.units === "imperial" ? Math.round(oz) : Math.round(oz * 29.5735);
}
function hydrationUnit() {
  return state.units === "imperial" ? "oz" : "mL";
}

async function loadWaterCard() {
  const data = await api("/hydration/today");
  document.getElementById("water-val").innerHTML = ozToDisplay(data.ounces) + '<span style="font-size:0.7rem;font-weight:600;"> ' + hydrationUnit() + "</span>";
  document.getElementById("water-sub").textContent = "of " + ozToDisplay(data.goal_oz) + " " + hydrationUnit();
  document.getElementById("water-bar").style.width = Math.min(100, Math.round((100 * data.ounces) / data.goal_oz)) + "%";
}

document.getElementById("water-card").addEventListener("click", () => {
  const panel = document.getElementById("water-quickadd-panel");
  const bodyfatPanel = document.getElementById("bodyfat-entry-panel");
  bodyfatPanel.classList.add("hidden");
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  const isMetric = state.units !== "imperial";
  const options = isMetric ? [250, 500, 750] : [8, 16, 24]; // mL or oz quick-add amounts
  panel.innerHTML =
    '<div style="font-size:0.78rem;color:var(--neutral-2);margin-bottom:0.5rem;">Add water (' + hydrationUnit() + ")</div>" +
    '<div class="qty-row">' +
    options.map((v) => '<button type="button" class="btn subtle small" data-oz="' + v + '">+' + v + "</button>").join("") +
    "</div>";
  panel.classList.remove("hidden");
  panel.querySelectorAll("[data-oz]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const displayVal = parseFloat(btn.dataset.oz);
      const ounces = isMetric ? displayVal / 29.5735 : displayVal;
      await api("/hydration/today", { method: "POST", body: JSON.stringify({ ounces: ounces }) });
      panel.classList.add("hidden");
      loadWaterCard();
      toast("Logged " + displayVal + " " + hydrationUnit());
    });
  });
});

async function loadBodyFatCard() {
  const data = await api("/body-fat");
  if (data.body_fat_pct == null) {
    document.getElementById("bodyfat-val").textContent = "—";
    document.getElementById("bodyfat-sub").textContent = "Not recorded";
  } else {
    document.getElementById("bodyfat-val").textContent = Math.round(data.body_fat_pct * 10) / 10 + "%";
    const d = new Date(data.date + "T00:00:00");
    document.getElementById("bodyfat-sub").textContent = "Last updated " + d.toLocaleDateString(undefined, { weekday: "short" });
  }
}

document.getElementById("bodyfat-card").addEventListener("click", () => {
  const panel = document.getElementById("bodyfat-entry-panel");
  document.getElementById("water-quickadd-panel").classList.add("hidden");
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  panel.innerHTML =
    '<div style="font-size:0.78rem;color:var(--neutral-2);margin-bottom:0.5rem;">Log body fat % — never estimated from photos</div>' +
    '<div style="display:flex;gap:0.5rem;align-items:center;">' +
    '<input type="number" step="0.1" min="3" max="60" id="bodyfat-input" placeholder="e.g. 18.6" style="flex:1;">' +
    '<button type="button" class="btn primary small" id="btn-save-bodyfat" style="width:auto;">Save</button></div>';
  panel.classList.remove("hidden");
  document.getElementById("btn-save-bodyfat").addEventListener("click", async () => {
    const val = parseFloat(document.getElementById("bodyfat-input").value);
    if (Number.isNaN(val) || val <= 0) { toast("Enter a valid percentage"); return; }
    await api("/body-fat", { method: "POST", body: JSON.stringify({ body_fat_pct: val }) });
    panel.classList.add("hidden");
    loadBodyFatCard();
    toast("Body fat logged");
  });
});

// Simple pictogram figures (circle head + line limbs), one per workout split --
// same convention as exercise-chart icons: minimal enough to always read cleanly.
const PICTOGRAMS = {
  bench: // Upper Push -- lying on a bench, bar pressed overhead
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 48H40M14 48V54M36 48V54"/>' +
    '<circle cx="10" cy="42" r="5" fill="currentColor" stroke="none"/>' +
    '<path d="M15 42H30"/><path d="M30 42L34 48L30 54"/>' +
    '<path d="M22 42V20"/>' +
    '<path d="M10 20H34" stroke-width="3.8"/>' +
    '<circle cx="10" cy="20" r="4" fill="currentColor" stroke="none"/><circle cx="34" cy="20" r="4" fill="currentColor" stroke="none"/>' +
    "</svg>",
  deadlift: // Upper Pull -- bent-over hinge, bar at the floor
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="20" cy="14" r="5" fill="currentColor" stroke="none"/>' +
    '<path d="M20 19L34 34"/>' +
    '<path d="M34 34L30 54M34 34L38 54"/>' +
    '<path d="M21 20L22 50"/>' +
    '<path d="M12 50H34" stroke-width="3.8"/>' +
    '<circle cx="12" cy="50" r="5" fill="currentColor" stroke="none"/><circle cx="34" cy="50" r="5" fill="currentColor" stroke="none"/>' +
    "</svg>",
  squat: // Lower Body -- bar racked on the shoulders, knees bent
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="32" cy="12" r="5" fill="currentColor" stroke="none"/>' +
    '<path d="M32 19V32"/>' +
    '<path d="M32 32L24 42L22 54M32 32L40 42L42 54"/>' +
    '<path d="M28 19L22 17M36 19L42 17"/>' +
    '<path d="M18 19H46" stroke-width="3.8"/>' +
    '<circle cx="18" cy="19" r="4" fill="currentColor" stroke="none"/><circle cx="46" cy="19" r="4" fill="currentColor" stroke="none"/>' +
    "</svg>",
  fullbody: // Full Body -- standing, a dumbbell in each hand
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="32" cy="12" r="5" fill="currentColor" stroke="none"/>' +
    '<path d="M32 17V36"/>' +
    '<path d="M32 36L26 54M32 36L38 54"/>' +
    '<path d="M32 20L20 32M32 20L44 32"/>' +
    '<circle cx="20" cy="32" r="4" fill="currentColor" stroke="none"/><circle cx="44" cy="32" r="4" fill="currentColor" stroke="none"/>' +
    "</svg>",
  running: // Run day -- mid-stride
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="24" cy="12" r="5" fill="currentColor" stroke="none"/>' +
    '<path d="M24 17L32 32"/>' +
    '<path d="M32 32L40 28L44 38"/>' +
    '<path d="M32 32L22 40L16 48"/>' +
    '<path d="M27 20L18 26M27 20L38 18"/>' +
    "</svg>",
  resting: // Recover / rest -- relaxed, reclined
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="14" cy="38" r="5" fill="currentColor" stroke="none"/>' +
    '<path d="M19 38L34 30"/>' +
    '<path d="M34 30L48 34"/>' +
    '<path d="M22 34L14 30"/>' +
    "</svg>",
};

const LIFT_LABEL_PICTOGRAMS = {
  "Upper Push": "bench",
  "Upper Pull": "deadlift",
  "Lower Body": "squat",
  "Full Body": "fullbody",
};

function pictogramFor(reco) {
  if (reco.session_type === "lift") {
    const key = LIFT_LABEL_PICTOGRAMS[reco.prescription.label] || "fullbody";
    return PICTOGRAMS[key];
  }
  if (reco.session_type === "run") return PICTOGRAMS.running;
  return PICTOGRAMS.resting; // recover | rest
}

const META_CLOCK_SVG = '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" style="vertical-align:-1.5px;margin-right:2px;"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const META_BARS_SVG = '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" style="vertical-align:-1.5px;margin-right:2px;"><path d="M5 14V9M10 14V5M15 14v-3" stroke-width="1.7" stroke-linecap="round"/></svg>';
const META_COUNT_SVG = '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" style="vertical-align:-1.5px;margin-right:2px;"><path d="M2 10H4M16 10H18M4 10H16" stroke-width="1.7" stroke-linecap="round"/><rect x="4.5" y="7" width="2.2" height="6" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.3" y="7" width="2.2" height="6" rx="1.1" fill="currentColor" stroke="none"/></svg>';
const PLAY_TRIANGLE_SVG = '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" style="margin-right:6px;"><path d="M6 4.5v11l9-5.5-9-5.5z"/></svg>';

function metaRow(items) {
  // items: [[icon, text], ...] joined with a middle dot, matching the reference's "45–60 min · Strength · 5 exercises" row
  return '<div class="tnum" style="font-size:0.78rem;opacity:0.8;margin-top:0.6rem;display:flex;align-items:center;flex-wrap:wrap;gap:0 0.4rem;">' +
    items.map(([icon, text]) => '<span>' + icon + text + "</span>").join('<span style="opacity:0.5;">·</span>') +
    "</div>";
}

function renderRecommendation(data) {
  const reco = data.recommendation;
  const status = data.workout_status;
  const kicker = document.getElementById("reco-kicker");
  const body = document.getElementById("reco-body");
  const startBtn = document.getElementById("btn-start-session");
  const captionRow = document.getElementById("workout-caption-row");
  const p = reco.prescription;
  const reasoning = (reco.reasoning || []).join(" ");

  kicker.textContent = "Today's Workout";
  document.getElementById("reco-ico").innerHTML = pictogramFor(reco);
  document.getElementById("warmup-panel").classList.add("hidden");
  document.getElementById("mobility-panel").classList.add("hidden");

  if (reco.session_type === "lift") {
    const estMin = Math.max(15, Math.round((p.exercises.reduce((s, e) => s + e.sets * 2.5, 0)) / 5) * 5);
    const title = p.exercises[0] ? p.exercises[0].name : (p.label || "Lift session");
    body.innerHTML =
      '<div style="font-weight:700;font-size:1.08rem;">' + title + "</div>" +
      '<div style="font-size:0.82rem;opacity:0.75;margin-top:0.1rem;">' + (p.label || "") + "</div>" +
      metaRow([[META_CLOCK_SVG, estMin + " min"], [META_BARS_SVG, "Strength"], [META_COUNT_SVG, p.exercises.length + " exercises"]]) +
      '<div style="font-size:0.78rem;opacity:0.75;font-style:italic;margin-top:0.6rem;">“' + reasoning + "”</div>";
    captionRow.classList.remove("hidden");

    if (status.state === "completed") {
      startBtn.innerHTML = "View Review";
      startBtn.classList.remove("hidden");
      startBtn.onclick = () => { document.querySelector('.tab-bar [data-tab="view-log"]').click(); };
    } else if (status.state === "active") {
      const progress = status.total_exercise_count
        ? '<div class="tnum" style="font-size:0.78rem;opacity:0.8;margin-top:0.5rem;">' +
          status.completed_exercise_count + " of " + status.total_exercise_count + " exercises completed" +
          (status.elapsed_min != null ? " · " + status.elapsed_min + " min elapsed" : "") + "</div>"
        : "";
      body.innerHTML += progress;
      startBtn.innerHTML = PLAY_TRIANGLE_SVG + "Resume Workout";
      startBtn.classList.remove("hidden");
      startBtn.onclick = () => openLiftSession(status.session_id);
    } else {
      startBtn.innerHTML = PLAY_TRIANGLE_SVG + "Start Workout";
      startBtn.classList.remove("hidden");
      startBtn.onclick = () => openLiftSession();
    }
  } else if (reco.session_type === "run") {
    body.innerHTML =
      '<div style="font-weight:700;font-size:1.08rem;">' + labelForRunType(p.run_type) + "</div>" +
      metaRow([[META_CLOCK_SVG, p.duration_min + " min"], [META_BARS_SVG, "Cardio"], [META_COUNT_SVG, "Zone " + p.zone]]) +
      '<div style="font-size:0.78rem;opacity:0.75;font-style:italic;margin-top:0.6rem;">“' + reasoning + "”</div>";
    captionRow.classList.remove("hidden");

    if (status.state === "completed") {
      body.innerHTML += '<div class="tnum" style="font-size:0.78rem;opacity:0.8;margin-top:0.5rem;">Completed today' +
        (status.elapsed_min != null ? " · " + status.elapsed_min + " min" : "") + "</div>";
      startBtn.innerHTML = "View Review";
      startBtn.classList.remove("hidden");
      startBtn.onclick = () => { document.querySelector('.tab-bar [data-tab="view-log"]').click(); };
    } else {
      startBtn.innerHTML = PLAY_TRIANGLE_SVG + "Start Run";
      startBtn.classList.remove("hidden");
      startBtn.onclick = () => {
        document.getElementById("run-kicker").textContent = labelForRunType(p.run_type);
        showView("view-run");
      };
    }
  } else if (reco.session_type === "recover" || reco.session_type === "rest") {
    kicker.textContent = "Today's Workout";
    body.innerHTML =
      '<div style="font-weight:700;font-size:1.08rem;">' + (p.note || (reco.session_type === "recover" ? "Active Recovery" : "Rest Day")) + "</div>" +
      '<div style="font-size:0.78rem;opacity:0.75;font-style:italic;margin-top:0.6rem;">“' + reasoning + "”</div>";
    startBtn.innerHTML = "View Recovery Plan";
    startBtn.classList.remove("hidden");
    startBtn.onclick = () => toggleMobilityPanel(data, true);
    captionRow.classList.add("hidden");
  } else {
    // Defensive fallback -- the backend always resolves a session_type today, but
    // this keeps the card honest instead of blank if that ever stops being true.
    kicker.textContent = "Today's Workout";
    body.innerHTML = '<div style="font-weight:700;font-size:1.08rem;">No workout scheduled</div>';
    startBtn.innerHTML = "Build My Program";
    startBtn.classList.remove("hidden");
    startBtn.onclick = () => { document.querySelector('.tab-bar [data-tab="view-program"]').click(); };
    captionRow.classList.add("hidden");
  }

  wireWarmupMobilityButtons(data);
}

function toggleMobilityPanel(data, forceOpen) {
  const panel = document.getElementById("mobility-panel");
  const items = data.mobility_items || [];
  const isHidden = panel.classList.contains("hidden");
  document.getElementById("warmup-panel").classList.add("hidden");
  if (!forceOpen && !isHidden) { panel.classList.add("hidden"); return; }
  panel.innerHTML = items.length
    ? "Today's mobility work:<br>" + items.map((m) => "• " + escapeHtml(m)).join("<br>")
    : "No mobility work assigned for today — check the Program tab for your full schedule.";
  panel.classList.remove("hidden");
}

function toggleWarmupPanel(data) {
  const panel = document.getElementById("warmup-panel");
  const isHidden = panel.classList.contains("hidden");
  document.getElementById("mobility-panel").classList.add("hidden");
  if (!isHidden) { panel.classList.add("hidden"); return; }
  const p = data.recommendation.prescription;
  const firstExercise = data.recommendation.session_type === "lift" && p.exercises && p.exercises[0] ? p.exercises[0].name : null;
  panel.innerHTML = firstExercise
    ? "5 min light cardio, then 2 easy ramp-up sets of " + escapeHtml(firstExercise) + " before your working weight."
    : "5–10 min light cardio to raise your heart rate before starting.";
  panel.classList.remove("hidden");
}

function wireWarmupMobilityButtons(data) {
  document.getElementById("btn-warmup").onclick = () => toggleWarmupPanel(data);
  document.getElementById("btn-mobility").onclick = () => toggleMobilityPanel(data, false);
}


function renderNotifications(data) {
  const items = [];
  if (!data.checked_in) items.push("You haven't done today's recovery check-in yet.");
  if (data.readiness.band === "red") items.push("Readiness is low today — today's plan was adjusted to recovery.");
  if (data.readiness.band === "amber") items.push("Readiness is moderate today — volume has been trimmed.");

  const bell = document.getElementById("btn-notifications");
  document.getElementById("notif-dot").classList.toggle("hidden", !items.length);
  bell.setAttribute("aria-label", items.length ? items.length + " unread notification" + (items.length === 1 ? "" : "s") : "Notifications");
  const panel = document.getElementById("notif-panel");
  panel.innerHTML = items.length
    ? items.map((t) => '<div class="set-row"><span class="k" style="font-weight:500;font-size:0.82rem;">' + t + "</span></div>").join("")
    : '<div class="empty-note">Nothing new.</div>';
}

document.getElementById("btn-avatar").addEventListener("click", () => {
  document.querySelector('.tab-bar [data-tab="view-settings"]').click();
});
document.getElementById("btn-notifications").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("notif-panel").classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  const panel = document.getElementById("notif-panel");
  if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target.id !== "btn-notifications") {
    panel.classList.add("hidden");
  }
});

document.getElementById("readiness-hero-card").addEventListener("click", () => {
  prefillCheckin();
  showView("view-recovery");
});

// --------------------------------------------------------- recovery check-in ----

function prefillCheckin() {
  if (!state.today) return;
  const r = state.today.recovery;
  if (r.hrv_ms) {
    document.getElementById("input-hrv").value = r.hrv_ms;
    document.getElementById("hrv-readout").textContent = r.hrv_ms;
  }
  if (r.resting_hr_bpm) {
    document.getElementById("input-rhr").value = r.resting_hr_bpm;
    document.getElementById("rhr-readout").textContent = r.resting_hr_bpm;
  }
  if (r.sleep_duration_min) {
    const hrs = (r.sleep_duration_min / 60).toFixed(1);
    document.getElementById("input-sleep").value = hrs;
    document.getElementById("sleep-readout").textContent = hrs;
  }
}

["hrv", "rhr", "sleep"].forEach((k) => {
  const input = document.getElementById("input-" + k);
  const readout = document.getElementById(k + "-readout");
  input.addEventListener("input", () => { readout.textContent = input.value; });
});

function wireChips(containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => {
      container.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    });
  });
}
wireChips("soreness-chips");
wireChips("mood-chips");
wireChips("onb-sex-chips");
wireChips("set-sex-chips");

document.getElementById("btn-submit-checkin").addEventListener("click", async () => {
  const btn = document.getElementById("btn-submit-checkin");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const payload = {
      hrv_ms: parseFloat(document.getElementById("input-hrv").value),
      resting_hr_bpm: parseInt(document.getElementById("input-rhr").value, 10),
      sleep_hours: parseFloat(document.getElementById("input-sleep").value),
      soreness_1_5: parseInt(document.querySelector("#soreness-chips .chip.active").dataset.val, 10),
      stress_mood_1_5: parseInt(document.querySelector("#mood-chips .chip.active").dataset.val, 10),
    };
    await api("/checkin", { method: "POST", body: JSON.stringify(payload) });
    toast("Check-in saved — plan updated");
    await loadToday();
    showView("view-today");
  } catch (e) {
    toast("Something went wrong — try again");
  } finally {
    btn.disabled = false;
    btn.textContent = "See Today's Plan";
  }
});

// -------------------------------------------------------------- log chooser ----

const SPARKLE_SVG = '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 3l1.2 3.8L15 8l-3.8 1.2L10 13l-1.2-3.8L5 8l3.8-1.2z"/></svg>';
const PERIOD_LABELS = { this_week: "This Week", last_week: "Last Week", last_4_weeks: "Last 4 Weeks" };

function loadLogChooser() {
  if (!state.today) return;
  renderResumeSessionCard();
  loadLogSummary(3);
}

function renderResumeSessionCard() {
  const card = document.getElementById("log-resume-session-card");
  const status = state.today.workout_status;
  const reco = state.today.recommendation;
  if (!status || status.state !== "active") {
    card.classList.add("hidden");
    card.innerHTML = "";
    return;
  }
  const title = (reco.session_type === "lift" && reco.prescription.label) || "Workout";
  const progress = status.total_exercise_count
    ? status.completed_exercise_count + " of " + status.total_exercise_count + " exercises completed"
    : "In progress";
  const elapsed = status.elapsed_min != null ? status.elapsed_min + " min elapsed" : null;
  card.innerHTML =
    '<span class="kicker">Workout in Progress</span>' +
    '<div class="rs-title">' + escapeHtml(title) + "</div>" +
    '<div class="rs-meta tnum">' + progress + (elapsed ? " · " + elapsed : "") + "</div>" +
    '<div class="rs-actions">' +
    '<button type="button" class="btn primary" id="btn-resume-session">' + PLAY_TRIANGLE_SVG + "Resume Workout</button>" +
    '<button type="button" class="rs-end-btn" id="btn-end-session">End Session</button>' +
    "</div>";
  card.classList.remove("hidden");
  document.getElementById("btn-resume-session").addEventListener("click", () => openLiftSession(status.session_id));
  document.getElementById("btn-end-session").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
    if (!confirm("End this workout now? Sets you've already logged are saved — you just won't be able to add more to this session.")) return;
    try {
      await api("/workouts/" + status.session_id + "/complete", { method: "POST" });
      toast("Workout ended");
      await loadToday();
      loadLogChooser();
    } catch (err) {
      toast("Couldn't end the workout — try again");
    }
  }));
}

function sessionSkeletons(count) {
  return Array.from({ length: count }, () => '<div class="session-skeleton"></div>').join("");
}

async function loadLogSummary(recentLimit) {
  const row = document.getElementById("log-recent-sessions-row");
  row.innerHTML = sessionSkeletons(3);
  const snapshotCard = document.getElementById("log-weekly-snapshot-card");
  snapshotCard.innerHTML = '<div class="empty-note">Loading…</div>';

  let data;
  try {
    data = await api("/log/summary?recent_limit=" + recentLimit + "&period=" + state.logPeriod);
  } catch (e) {
    // Recent Sessions and Weekly Snapshot share one fetch (so weekly totals are
    // computed exactly once, not recalculated separately per component) -- a
    // failure here needs its own isolated retry state in both places, not just
    // the one whose skeleton happened to be visible.
    row.innerHTML =
      '<div class="empty-note">Couldn\'t load your recent sessions. ' +
      '<button type="button" class="btn subtle small" id="btn-retry-recent-sessions" style="width:auto;margin-top:0.4rem;">Retry</button></div>';
    document.getElementById("btn-retry-recent-sessions").addEventListener("click", () => loadLogSummary(recentLimit));
    snapshotCard.innerHTML =
      '<div class="empty-note">Weekly summary unavailable. <button type="button" class="btn subtle small" id="btn-retry-weekly-snapshot" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-weekly-snapshot").addEventListener("click", () => loadLogSummary(recentLimit));
    return;
  }

  if (!data.recent_sessions.length) {
    row.innerHTML =
      '<div class="empty-note" style="max-width:260px;">No sessions yet. Your completed workouts and runs will appear here.<br>' +
      '<button type="button" class="btn subtle small" id="btn-log-first-session" style="width:auto;margin-top:0.5rem;">Log Your First Session</button></div>';
    document.getElementById("btn-log-first-session").addEventListener("click", () => { document.getElementById("btn-open-lift").click(); });
  } else {
    row.innerHTML = data.recent_sessions
      .map((s) => {
        const icon = s.type === "lift" ? PROGRAM_TODAY_ICONS.lift : PROGRAM_TODAY_ICONS.run;
        const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        let metric = "";
        if (s.type === "lift") {
          metric = s.exercise_count + " exercise" + (s.exercise_count === 1 ? "" : "s") + (s.volume_kg ? " · " + fmtWeight(s.volume_kg) + " vol" : "");
        } else if (s.distance_km) {
          metric = s.distance_km + " km" + (s.pace_per_km ? " · " + s.pace_per_km + "/km" : "");
        } else {
          metric = s.duration_min + " min";
        }
        return (
          '<button type="button" class="log-session-card" data-type="' + s.type + '" data-session-id="' + s.id + '" aria-label="Recent session, ' + escapeHtml(s.title) + ", completed " + dateLabel + '.">' +
          '<div class="icon-circle md">' + icon + "</div>" +
          '<div class="name">' + escapeHtml(s.title) + "</div>" +
          '<span class="date tnum">' + dateLabel + "</span>" +
          '<span class="metric tnum">' + metric + "</span>" +
          '<span class="activity-badge ' + s.type + '">' + s.type.toUpperCase() + "</span>" +
          "</button>"
        );
      })
      .join("");
    row.querySelectorAll(".log-session-card").forEach((el) => {
      el.addEventListener("click", () => openSessionDetail(el.dataset.type, el.dataset.sessionId, "view-log"));
    });
  }

  renderWeeklySnapshot(data);
}

function renderWeeklySnapshot(data) {
  const w = data.week;
  const snapshotStat = (icon, num, lbl, goal, ariaLabel) =>
    '<div class="snapshot-stat" aria-label="' + ariaLabel + '"><div class="icon-circle sm">' + icon + '</div><div class="num tnum">' + num + '</div>' +
    '<div class="lbl">' + lbl + '</div><div class="goal tnum">' + goal + "</div></div>";
  const goalOrContext = (value, goal, unit) => (goal ? "Goal " + (unit ? unit(goal) : goal) : "No target set");
  const statAria = (label, value, goal, unit) =>
    "Weekly Snapshot. " + value + " " + label + (goal ? " out of a goal of " + goal + (unit ? " " + unit : "") + "." : ", no target set for this period.");

  document.getElementById("log-weekly-snapshot-card").innerHTML =
    '<div class="snapshot-head" style="position:relative;">' +
    '<span style="font-weight:700;font-size:0.95rem;">Weekly Snapshot</span>' +
    '<button type="button" class="period-select-btn" id="btn-period-select" aria-haspopup="true" aria-expanded="false" aria-label="Weekly Snapshot period, currently ' + escapeHtml(PERIOD_LABELS[data.period]) + '. Tap to change.">' + escapeHtml(PERIOD_LABELS[data.period]) +
    '<svg viewBox="0 0 20 20" fill="none"><path d="M5.5 8L10 12.5L14.5 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<div class="period-menu hidden" id="period-menu" role="menu" aria-label="Select reporting period">' +
    Object.keys(PERIOD_LABELS)
      .map((k) => {
        const selected = k === data.period;
        return '<button type="button" role="menuitemradio" aria-checked="' + selected + '" class="' + (selected ? "active" : "") + '" data-period="' + k + '">' +
          (selected ? CHECK_SVG.replace("<svg ", '<svg style="width:13px;height:13px;margin-right:0.35rem;flex:none;" ') : "") + PERIOD_LABELS[k] + "</button>";
      })
      .join("") +
    "</div></div>" +
    '<div class="snapshot-row">' +
    snapshotStat(PROGRAM_TODAY_ICONS.lift, w.lift_sessions, "Lift Sessions", goalOrContext(w.lift_sessions, w.lift_goal), statAria("lift sessions", w.lift_sessions, w.lift_goal)) +
    snapshotStat(PROGRAM_TODAY_ICONS.run, w.runs, "Runs", goalOrContext(w.runs, w.run_goal), statAria("runs", w.runs, w.run_goal)) +
    snapshotStat(META_CLOCK_SVG.replace('width="12" height="12"', 'width="16" height="16" style=""'), fmtHours(w.total_time_min), "Total Time", goalOrContext(w.total_time_min, w.time_goal_min, fmtHours), statAria("training time", fmtHours(w.total_time_min), w.time_goal_min ? fmtHours(w.time_goal_min) : null)) +
    snapshotStat(GOAL_KIND_ICONS.consistency, w.est_calories.toLocaleString(), "Est. Calories", goalOrContext(w.est_calories, w.calorie_goal, (n) => n.toLocaleString()), statAria("estimated calories burned", w.est_calories.toLocaleString(), w.calorie_goal ? w.calorie_goal.toLocaleString() : null)) +
    "</div>" +
    '<button type="button" class="snapshot-coach-row" id="btn-snapshot-coach" aria-label="Coach note: ' + escapeHtml(data.encouragement) + '">' +
    '<span class="icon-circle sm">' + SPARKLE_SVG + "</span>" +
    '<span class="msg">' + escapeHtml(data.encouragement) + "</span>" +
    "</button>";

  const menuBtn = document.getElementById("btn-period-select");
  const menu = document.getElementById("period-menu");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const nowHidden = !menu.classList.toggle("hidden");
    menuBtn.setAttribute("aria-expanded", nowHidden ? "true" : "false");
  });
  menu.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      menu.classList.add("hidden");
      menuBtn.setAttribute("aria-expanded", "false");
      if (b.dataset.period === state.logPeriod) return;
      state.logPeriod = b.dataset.period;
      loadLogSummary(3);
    });
  });
  document.getElementById("btn-snapshot-coach").addEventListener("click", () => { document.querySelector('.tab-bar [data-tab="view-program"]').click(); });
}
document.addEventListener("click", (e) => {
  const menu = document.getElementById("period-menu");
  if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target) && e.target.id !== "btn-period-select") menu.classList.add("hidden");
});

const LOG_HISTORY_PAGE_SIZE = 20;

function sessionRowHtml(s) {
  const icon = s.type === "lift" ? PROGRAM_TODAY_ICONS.lift : PROGRAM_TODAY_ICONS.run;
  const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const metric = s.type === "lift"
    ? s.exercise_count + " exercises" + (s.volume_kg ? " · " + fmtWeight(s.volume_kg) + " vol" : "")
    : (s.distance_km ? s.distance_km + " km · " : "") + s.duration_min + " min";
  return (
    '<button type="button" class="session-row" style="width:100%;text-align:left;" data-type="' + s.type + '" data-session-id="' + s.id + '" aria-label="' + (s.type === "lift" ? "Lift" : "Run") + " session, " + escapeHtml(s.title) + ", completed " + dateLabel + '.">' +
    '<div class="icon-circle md">' + icon + "</div>" +
    '<div style="flex:1;min-width:0;"><div class="name">' + escapeHtml(s.title) + "</div>" +
    '<div class="meta tnum">' + dateLabel + " · " + metric + "</div></div>" +
    '<span class="activity-badge ' + s.type + '">' + s.type.toUpperCase() + "</span>" +
    "</button>"
  );
}

function wireSessionRows(container) {
  container.querySelectorAll(".session-row").forEach((el) => {
    el.addEventListener("click", () => openSessionDetail(el.dataset.type, el.dataset.sessionId, "view-log-history"));
  });
}

async function loadLogHistory() {
  const list = document.getElementById("log-history-list");
  list.innerHTML = Array.from({ length: 4 }, () => '<div class="session-skeleton" style="width:100%;height:60px;margin-bottom:0.65rem;"></div>').join("");
  let data;
  try {
    data = await api("/log/history?limit=" + LOG_HISTORY_PAGE_SIZE + "&offset=0");
  } catch (e) {
    list.innerHTML = '<div class="empty-note">Couldn\'t load your history. <button type="button" class="btn subtle small" id="btn-retry-history" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-history").addEventListener("click", loadLogHistory);
    return;
  }
  if (!data.sessions.length) {
    list.innerHTML = '<div class="empty-note">No sessions yet. Your completed workouts and runs will appear here.</div>';
    return;
  }
  list.innerHTML = data.sessions.map(sessionRowHtml).join("") +
    (data.has_more ? '<button type="button" class="btn subtle" id="btn-history-load-more" style="margin-top:0.5rem;">Load More</button>' : "");
  wireSessionRows(list);

  if (data.has_more) {
    document.getElementById("btn-history-load-more").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
      const loadedCount = list.querySelectorAll(".session-row").length;
      const more = await api("/log/history?limit=" + LOG_HISTORY_PAGE_SIZE + "&offset=" + loadedCount);
      const loadMoreBtn = document.getElementById("btn-history-load-more");
      const wrap = document.createElement("div");
      wrap.innerHTML = more.sessions.map(sessionRowHtml).join("");
      wireSessionRows(wrap);
      while (wrap.firstChild) loadMoreBtn.before(wrap.firstChild);
      loadMoreBtn.classList.toggle("hidden", !more.has_more);
    }));
  }
}

document.getElementById("btn-log-view-all").addEventListener("click", () => { showView("view-log-history"); loadLogHistory(); });
document.getElementById("btn-log-history").addEventListener("click", () => { showView("view-log-history"); loadLogHistory(); });

// ------------------------------------------------------- session detail (read-only) ----

let sessionDetailReturnView = "view-log";

async function openSessionDetail(type, id, fromView) {
  sessionDetailReturnView = fromView || "view-log";
  showView("view-session-detail");
  document.getElementById("session-detail-kicker").textContent = type === "lift" ? "Lift Session" : "Run";
  document.getElementById("session-detail-title").textContent = "Loading…";
  document.getElementById("session-detail-date").textContent = "";
  const body = document.getElementById("session-detail-body");
  body.innerHTML = sessionSkeletons(1).replace('class="session-skeleton"', 'class="session-skeleton" style="width:100%;height:180px;"');

  try {
    if (type === "lift") {
      const data = await api("/workouts/" + id);
      document.getElementById("session-detail-title").textContent = data.label || "Lift Session";
      document.getElementById("session-detail-date").textContent =
        new Date(data.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) +
        (data.duration_min ? " · " + data.duration_min + " min" : "") + (data.volume_kg ? " · " + fmtWeight(data.volume_kg) + " volume" : "");
      if (!data.exercises_with_sets.length) {
        body.innerHTML = '<div class="empty-note">No sets were logged in this session.</div>';
      } else {
        body.innerHTML = data.exercises_with_sets
          .map((ex) => (
            '<div class="set-group-label">' + escapeHtml(ex.name) + '</div><div class="card tight">' +
            ex.logged_sets
              .map((s) => (
                '<div class="set-row"><span class="k">Set ' + s.set_number + '</span>' +
                '<span class="v tnum">' + (s.weight_kg != null ? fmtWeight(s.weight_kg) : "—") + " × " + (s.reps != null ? s.reps : "—") + " reps</span></div>"
              ))
              .join("") +
            "</div>"
          ))
          .join("");
      }
    } else {
      const data = await api("/runs/" + id);
      document.getElementById("session-detail-title").textContent = "Run";
      document.getElementById("session-detail-date").textContent =
        new Date(data.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      body.innerHTML =
        '<div class="stat-row">' +
        '<div class="stat-tile"><div class="label">Duration</div><div class="value tnum">' + data.duration_min + " min</div></div>" +
        '<div class="stat-tile"><div class="label">Distance</div><div class="value tnum">' + (data.distance_km != null ? data.distance_km + " km" : "—") + "</div></div>" +
        '<div class="stat-tile"><div class="label">Pace</div><div class="value tnum">' + (data.pace_per_km ? data.pace_per_km + "/km" : "—") + "</div></div>" +
        "</div>" +
        '<div class="stat-row">' +
        '<div class="stat-tile"><div class="label">Avg HR</div><div class="value tnum">' + (data.avg_hr != null ? data.avg_hr + " bpm" : "—") + "</div></div>" +
        '<div class="stat-tile"><div class="label">Effort</div><div class="value tnum">' + (data.perceived_effort != null ? data.perceived_effort + "/10" : "—") + "</div></div>" +
        "</div>";
    }
  } catch (e) {
    document.getElementById("session-detail-title").textContent = "Session unavailable";
    body.innerHTML =
      '<div class="empty-note">Couldn\'t load this session. <button type="button" class="btn subtle small" id="btn-retry-session-detail" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-session-detail").addEventListener("click", () => openSessionDetail(type, id, fromView));
  }
}
document.getElementById("btn-session-detail-back").addEventListener("click", () => showView(sessionDetailReturnView));

document.getElementById("btn-open-lift").addEventListener("click", () => {
  const status = state.today.workout_status;
  if (status && status.state === "active") { openLiftSession(status.session_id); return; }
  showView("view-lift-start");
  loadLiftStartOptions();
});
document.getElementById("btn-open-run").addEventListener("click", () => {
  const status = state.today && state.today.workout_status;
  if (status && status.state === "active") {
    if (!confirm("You have a lift workout in progress. Starting a run leaves it active in the background — you can resume it anytime from the Log tab. Continue?")) return;
  }
  openRunEntry();
});

function openRunEntry() {
  const reco = state.today && state.today.recommendation;
  const kicker = document.getElementById("run-kicker");
  if (reco && reco.session_type === "run") {
    kicker.textContent = "Recommended Today · " + labelForRunType(reco.prescription.run_type) + " · " + reco.prescription.duration_min + " min";
  } else {
    kicker.textContent = "Freeform run";
  }
  showView("view-run");
}

// --------------------------------------------------------- start lift session ----

async function loadLiftStartOptions() {
  const reco = state.today.recommendation;
  const status = state.today.workout_status;
  const recCard = document.getElementById("lift-start-recommended-card");

  if (reco.session_type === "lift" && status.state === "none") {
    const p = reco.prescription;
    recCard.innerHTML =
      '<span class="kicker">Recommended Today</span>' +
      '<div style="font-weight:700;font-size:1rem;font-family:var(--font-display);">' + escapeHtml(p.label || "Lift session") + "</div>" +
      '<div class="tnum" style="font-size:0.78rem;color:var(--neutral-2);margin-top:0.2rem;">' + p.exercises.length + " exercises</div>" +
      '<button type="button" class="btn primary" id="btn-start-planned-lift" style="margin-top:0.8rem;">Start Planned Workout</button>';
    recCard.classList.remove("hidden");
    document.getElementById("btn-start-planned-lift").addEventListener("click", () => openLiftSession());
  } else {
    recCard.classList.add("hidden");
    recCard.innerHTML = "";
  }

  const list = document.getElementById("lift-start-saved-list");
  list.innerHTML = '<div class="empty-note">Loading…</div>';
  try {
    const days = await api("/log/lift-days");
    const otherDays = days.filter((d) => !(reco.session_type === "lift" && d.is_today));
    if (!otherDays.length) {
      list.innerHTML = '<div class="empty-note">No other lift days scheduled this week.</div>';
      return;
    }
    const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    list.innerHTML = otherDays
      .map(
        (d) =>
          '<button type="button" class="saved-workout-row" data-weekday="' + d.weekday + '">' +
          '<div class="icon-circle sm">' + PROGRAM_TODAY_ICONS.lift + "</div>" +
          '<div style="flex:1;min-width:0;"><div class="name">' + escapeHtml(d.label) + "</div>" +
          '<div class="meta">' + WEEKDAY_NAMES[d.weekday] + " · " + d.exercise_count + " exercises</div></div>" +
          '<div class="arrow"><svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
          "</button>"
      )
      .join("");
    list.querySelectorAll(".saved-workout-row").forEach((rowEl) => {
      rowEl.addEventListener("click", async () => {
        rowEl.style.opacity = "0.6";
        try {
          const prescription = await api("/log/lift-days/" + rowEl.dataset.weekday + "/prescription");
          const started = await openLiftSession(undefined, prescription);
          if (!started) rowEl.style.opacity = "1"; // openLiftSession already toasted its own failure
        } catch (e) {
          toast("Couldn't load that workout — try again");
          rowEl.style.opacity = "1";
        }
      });
    });
  } catch (e) {
    list.innerHTML =
      '<div class="empty-note">Couldn\'t load saved workouts. <button type="button" class="btn subtle small" id="btn-retry-saved-workouts" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-saved-workouts").addEventListener("click", loadLiftStartOptions);
  }
}

document.getElementById("btn-lift-start-empty").addEventListener("click", () => {
  openLiftSession(undefined, { label: "Freeform", exercises: [] });
});

// ------------------------------------------------------------ log a lift ----

async function ensureExercisesLoaded() {
  if (!state.exercises.length) state.exercises = await api("/exercises");
  return state.exercises;
}

async function openLiftSession(resumeSessionId, customPrescription) {
  const reco = state.today.recommendation;
  const prescription = customPrescription || (reco.session_type === "lift" ? reco.prescription : { label: "Freeform", exercises: [] });
  const exercises = prescription.exercises || [];
  if (!exercises.length && !resumeSessionId) toast("No exercises prescribed — add exercises below to log freely");

  const baseExercises = exercises.map((e) => Object.assign({}, e, { loggedSets: [] }));
  let sessionId;

  // Every failure path below leaves the caller's current screen in place (never
  // navigates to view-lift) and surfaces a toast -- the user can just tap the
  // same button again rather than getting stranded in a half-built session.
  try {
    if (resumeSessionId) {
      // Reuse the session already in progress instead of creating a duplicate --
      // merge in whatever sets are already logged, and keep any custom exercises
      // the user added beyond the original prescription.
      sessionId = resumeSessionId;
      const sessionData = await api("/workouts/" + resumeSessionId);
      const byExerciseId = {};
      baseExercises.forEach((e) => { byExerciseId[e.exercise_id] = e; });
      sessionData.exercises_with_sets.forEach((se) => {
        const loggedSets = se.logged_sets.map((s) => ({ id: s.id, setNumber: s.set_number, weightKg: s.weight_kg, reps: s.reps, restSeconds: s.rest_seconds }));
        if (byExerciseId[se.exercise_id]) {
          byExerciseId[se.exercise_id].loggedSets = loggedSets;
        } else {
          baseExercises.push({ exercise_id: se.exercise_id, name: se.name, sets: loggedSets.length, reps: null, load_kg: null, loggedSets: loggedSets });
        }
      });
    } else {
      const session = await api("/workouts", { method: "POST", body: JSON.stringify({ label: prescription.label || "Freeform" }) });
      sessionId = session.id;
    }
    await ensureExercisesLoaded();
  } catch (e) {
    toast(resumeSessionId ? "Couldn't resume the workout — try again" : "Couldn't start the workout — try again");
    return false;
  }

  state.activeWorkoutSessionId = sessionId;
  state.activeWorkoutExercises = baseExercises;

  document.getElementById("lift-session-kicker").textContent = state.activeWorkoutExercises.length ? "In progress" : "Freeform";
  document.getElementById("lift-session-title").textContent = prescription.label || "Workout";

  populateAddExerciseSelect();
  resetAddExerciseForm();
  renderLiftExercises();
  showView("view-lift");
  return true;
}

function populateAddExerciseSelect() {
  const select = document.getElementById("add-exercise-select");
  const options = state.exercises
    .map((e) => '<option value="' + e.id + '">' + e.name + "</option>")
    .join("");
  select.innerHTML = '<option value="">Choose an exercise…</option><option value="__custom__">＋ Custom exercise…</option>' + options;
}

function resetAddExerciseForm() {
  document.getElementById("add-exercise-select").value = "";
  document.getElementById("custom-exercise-field").classList.add("hidden");
  document.getElementById("custom-exercise-name").value = "";
}

document.getElementById("add-exercise-select").addEventListener("change", (e) => {
  document.getElementById("custom-exercise-field").classList.toggle("hidden", e.target.value !== "__custom__");
});

document.getElementById("btn-add-exercise").addEventListener("click", async () => {
  const select = document.getElementById("add-exercise-select");
  const btn = document.getElementById("btn-add-exercise");
  const choice = select.value;

  if (!choice) {
    toast("Choose an exercise first");
    return;
  }
  if (!state.activeWorkoutSessionId) {
    toast("Start a workout first");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    let exerciseId, exerciseName;
    if (choice === "__custom__") {
      const name = document.getElementById("custom-exercise-name").value.trim();
      if (!name) {
        toast("Type an exercise name first");
        return;
      }
      const created = await api("/exercises", { method: "POST", body: JSON.stringify({ name: name }) });
      exerciseId = created.id;
      exerciseName = created.name;
      // cache it so it shows up next time without a refetch, and in the Progress picker too
      if (!state.exercises.some((e) => e.id === exerciseId)) {
        state.exercises.push({ id: exerciseId, name: exerciseName, primary_muscle_group: "custom" });
      }
      populateAddExerciseSelect();
    } else {
      exerciseId = parseInt(choice, 10);
      const found = state.exercises.find((e) => e.id === exerciseId);
      exerciseName = found ? found.name : "Exercise";
    }

    // sensible round default per unit, converted to kg for canonical storage
    const defaultLoadKg = state.units === "imperial" ? 45 * KG_PER_LB : 20;
    let loadKg = defaultLoadKg, progressionOptions = null, recommendedType = null, why = null;
    try {
      const decision = await api("/exercises/" + exerciseId + "/decision");
      const recommended = decision.options.find((o) => o.type === decision.recommended_type);
      if (recommended) loadKg = recommended.load_kg;
      progressionOptions = decision.options;
      recommendedType = decision.recommended_type;
      why = decision.why;
    } catch (e) {
      // no prior history for this exercise yet -- fall back to the plain default, no decision card shown
    }
    state.activeWorkoutExercises.push({
      exercise_id: exerciseId,
      name: exerciseName,
      sets: 3,
      reps: 8,
      load_kg: loadKg,
      target_rir: 2,
      progression_options: progressionOptions,
      recommended_type: recommendedType,
      why: why,
      loggedSets: [],
    });

    resetAddExerciseForm();
    renderLiftExercises();
    toast(exerciseName + " added");
  } finally {
    btn.disabled = false;
    btn.textContent = "＋ Add to Workout";
  }
});

function renderLiftExercises() {
  const container = document.getElementById("lift-exercise-list");
  if (!state.activeWorkoutExercises.length) {
    container.innerHTML = '<div class="empty-note">Nothing added yet — pick an exercise below to get started. There\'s no limit on how many exercises or sets you can log.</div>';
    return;
  }
  container.innerHTML = state.activeWorkoutExercises
    .map((ex, i) => {
      const loggedRows = ex.loggedSets
        .map((s) => {
          const rest = s.restSeconds ? " · rested " + fmtRest(s.restSeconds) + " before" : "";
          return (
            '<div class="pr-row"><span class="name" style="font-weight:500;">Set ' + s.setNumber + "</span>" +
            '<span class="v" style="display:flex;align-items:center;gap:0.5rem;">' +
            '<span class="tnum" style="color:var(--neutral);font-size:0.82rem;">' + fmtWeight(s.weightKg) + " × " + s.reps + " reps" + rest + "</span>" +
            '<button class="set-delete-btn" data-exi="' + i + '" data-setid="' + s.id + '" aria-label="Delete set ' + s.setNumber + '">×</button>' +
            "</span></div>"
          );
        })
        .join("");
      const restChips = REST_PRESETS_SEC
        .map((sec, ci) => '<button type="button" class="chip' + (ci === 2 ? " active" : "") + '" data-rest="' + sec + '">' + fmtRest(sec) + "</button>")
        .join("");
      const feelChips = FEEL_OPTIONS
        .map((o) => '<button type="button" class="chip" data-feel="' + o.val + '">' + o.label + "</button>")
        .join("");
      const confidenceChips = CONFIDENCE_OPTIONS
        .map((o) => '<button type="button" class="chip" data-confidence="' + o.val + '">' + o.label + "</button>")
        .join("");

      let decisionHtml = "";
      if (ex.progression_options && ex.progression_options.length > 1) {
        const optionChips = ex.progression_options
          .map((opt) => '<button type="button" class="chip' + (opt.type === ex.recommended_type ? " active" : "") + '" data-load-kg="' + opt.load_kg + '" title="' + opt.detail + '">' + opt.label + "</button>")
          .join("");
        decisionHtml =
          '<div class="field" style="margin-bottom:0.6rem;"><label>Next step for this exercise</label>' +
          '<div class="chip-row" id="ex-' + i + '-decision-chips">' + optionChips + "</div>" +
          (ex.why ? '<div style="font-size:0.74rem;color:var(--neutral-2);font-style:italic;margin-top:0.35rem;">“' + ex.why + '”</div>' : "") +
          "</div>";
      }

      const nextSet = ex.loggedSets.length + 1;
      return (
        '<div class="card"><span class="kicker">' + ex.name + '</span>' +
        '<div class="tnum" style="font-size:0.82rem;color:var(--neutral);margin-bottom:0.6rem;">Target: ' + fmtWeight(ex.load_kg) + " × " + ex.sets + " sets × " + ex.reps + " reps</div>" +
        decisionHtml +
        '<div style="display:flex;gap:0.5rem;margin-bottom:0.7rem;">' +
        '<div class="field" style="margin-bottom:0;flex:1;"><label>Weight (' + weightUnit() + ")</label><input type=\"number\" inputmode=\"decimal\" step=\"0.5\" value=\"" + kgToDisplay(ex.load_kg) + '" id="ex-' + i + '-weight"></div>' +
        '<div class="field" style="margin-bottom:0;flex:1;"><label>Sets</label><input type="number" inputmode="numeric" min="1" value="' + nextSet + '" id="ex-' + i + '-sets"></div>' +
        '<div class="field" style="margin-bottom:0;flex:1;"><label>Reps</label><input type="number" inputmode="numeric" min="1" value="' + ex.reps + '" id="ex-' + i + '-reps"></div>' +
        "</div>" +
        '<div class="field" style="margin-bottom:0.7rem;"><label>Rest before this set (optional)</label>' +
        '<div class="chip-row" id="ex-' + i + '-rest-chips">' + restChips + "</div></div>" +
        '<div class="field" style="margin-bottom:0.7rem;"><label>How did the last set feel? (optional)</label>' +
        '<div class="chip-row" id="ex-' + i + '-feel-chips">' + feelChips + "</div></div>" +
        '<div class="field" style="margin-bottom:0.7rem;"><label>Confident going heavier next time? (optional)</label>' +
        '<div class="chip-row" id="ex-' + i + '-confidence-chips">' + confidenceChips + "</div></div>" +
        '<button class="btn subtle" data-exi="' + i + '" data-action="log-set">Log Set</button>' +
        '<div style="margin-top:0.5rem;">' + loggedRows + "</div></div>"
      );
    })
    .join("");

  container.querySelectorAll('[data-action="log-set"]').forEach((btn) => {
    btn.addEventListener("click", () => logSet(parseInt(btn.dataset.exi, 10)));
  });
  container.querySelectorAll('.set-delete-btn').forEach((btn) => {
    btn.addEventListener("click", () => deleteLoggedSet(parseInt(btn.dataset.exi, 10), parseInt(btn.dataset.setid, 10)));
  });
  container.querySelectorAll('input[type=number]').forEach((input) => {
    // tap the number and start typing immediately, no manual clear first
    input.addEventListener("focus", () => input.select());
  });
  container.querySelectorAll('[id$="-rest-chips"], [id$="-feel-chips"], [id$="-confidence-chips"]').forEach((row) => {
    row.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        row.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      });
    });
  });
  container.querySelectorAll('[id$="-decision-chips"]').forEach((row) => {
    const exi = row.id.match(/^ex-(\d+)-decision-chips$/)[1];
    row.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        row.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        document.getElementById("ex-" + exi + "-weight").value = kgToDisplay(parseFloat(chip.dataset.loadKg));
      });
    });
  });
}

async function logSet(exi) {
  const ex = state.activeWorkoutExercises[exi];
  const weightKg = displayToKg(document.getElementById("ex-" + exi + "-weight").value);
  const setNumber = parseInt(document.getElementById("ex-" + exi + "-sets").value, 10) || ex.loggedSets.length + 1;
  const reps = parseInt(document.getElementById("ex-" + exi + "-reps").value, 10);
  const activeRestChip = document.querySelector('#ex-' + exi + '-rest-chips .chip.active');
  const restSeconds = activeRestChip ? parseInt(activeRestChip.dataset.rest, 10) : null;
  const activeFeelChip = document.querySelector('#ex-' + exi + '-feel-chips .chip.active');
  const feel = activeFeelChip ? activeFeelChip.dataset.feel : null;
  const activeConfidenceChip = document.querySelector('#ex-' + exi + '-confidence-chips .chip.active');
  const confidenceNext = activeConfidenceChip ? activeConfidenceChip.dataset.confidence : null;

  const created = await api("/workouts/" + state.activeWorkoutSessionId + "/sets", {
    method: "POST",
    body: JSON.stringify({
      exercise_id: ex.exercise_id,
      set_index: setNumber,
      prescribed_reps: ex.reps,
      prescribed_load_kg: ex.load_kg,
      actual_reps: reps,
      actual_load_kg: weightKg,
      rest_seconds: restSeconds,
      feel: feel,
      confidence_next: confidenceNext,
    }),
  });
  ex.loggedSets.push({ id: created.id, setNumber: setNumber, weightKg: weightKg, reps: reps, restSeconds: restSeconds });
  renderLiftExercises();
  toast("Set " + setNumber + " logged");
}

async function deleteLoggedSet(exi, setId) {
  await api("/sets/" + setId, { method: "DELETE" });
  const ex = state.activeWorkoutExercises[exi];
  ex.loggedSets = ex.loggedSets.filter((s) => s.id !== setId);
  renderLiftExercises();
  toast("Set removed");
}

document.getElementById("btn-finish-workout").addEventListener("click", async () => {
  if (state.activeWorkoutSessionId) {
    await api("/workouts/" + state.activeWorkoutSessionId + "/complete", { method: "POST" });
  }
  toast("Workout saved");
  state.activeWorkoutSessionId = null;
  showView("view-today");
  loadToday();
});

// ------------------------------------------------------------- log a run ----

document.getElementById("btn-save-run").addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-run");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const minutes = parseFloat(document.getElementById("run-duration").value);
    const km = parseFloat(document.getElementById("run-distance").value);
    await api("/runs", {
      method: "POST",
      body: JSON.stringify({
        duration_seconds: Math.round(minutes * 60),
        distance_meters: Math.round(km * 1000),
        avg_hr: parseInt(document.getElementById("run-hr").value, 10) || null,
        perceived_effort: parseFloat(document.getElementById("run-effort").value) || null,
      }),
    });
    toast("Run saved");
    showView("view-today");
    loadToday();
  } catch (e) {
    toast("Something went wrong — try again");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Run";
  }
});

// ------------------------------------------------------------------ food ----

const inputRowStyle = "width:3.4rem;padding:0.3rem 0.35rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--ink);text-align:center;";

const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_SLOT_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function defaultMealSlot() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

function renderFoodEntryRow(e) {
  return (
    '<div class="pr-row"><div style="min-width:0;flex:1;">' +
    '<div class="name">' + e.name + (e.brand ? " — " + e.brand : "") + "</div>" +
    '<div class="date tnum">' + e.serving_qty + e.serving_unit + " × " + e.servings + " · " + Math.round(e.calories) +
    " kcal · P" + Math.round(e.protein_g) + " C" + Math.round(e.carbs_g) + " F" + Math.round(e.fat_g) + "</div></div>" +
    '<div style="display:flex;align-items:center;gap:0.4rem;flex:none;">' +
    '<input type="number" step="0.25" min="0.25" value="' + e.servings + '" class="food-servings-input tnum" data-entry="' + e.id + '" style="' + inputRowStyle + '">' +
    '<button class="set-delete-btn" data-entry="' + e.id + '" aria-label="Delete entry">×</button></div></div>'
  );
}

function ringSvg(pct, colorVar, size, strokeWidth) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const offset = c * (1 - clamped / 100);
  const cx = size / 2;
  return (
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" style="transform:rotate(-90deg);">' +
    '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="' + strokeWidth + '"/>' +
    '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + colorVar + '" stroke-width="' + strokeWidth +
    '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '"/></svg>'
  );
}

function macroRingItem(letter, pct) {
  return '<div class="macro-ring-item"><div class="letter">' + letter + "</div>" + ringSvg(pct, "var(--brand)", 40, 4) + '<div class="pct tnum">' + Math.round(pct || 0) + "%</div></div>";
}

const MEAL_SLOT_SUN_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"><circle cx="10" cy="10" r="3.5" stroke-width="1.5"/><path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.3 5.3l1 1M13.7 13.7l1 1M14.7 5.3l-1 1M6.3 13.7l-1 1" stroke-width="1.4" stroke-linecap="round"/></svg>';
const MEAL_SLOT_MOON_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"><path d="M15.5 11.5A6 6 0 118.5 4.5a5 5 0 007 7z" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const MEAL_SLOT_ICONS = {
  breakfast: MEAL_SLOT_SUN_ICON,
  lunch: MEAL_SLOT_SUN_ICON,
  dinner: MEAL_SLOT_MOON_ICON,
  snack: MEAL_SLOT_MOON_ICON,
};

// ---------------------------------------------------------- nutrition date ----

function localDateStr(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function nutritionDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (dateStr === localDateStr()) return "Today, " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (dateStr === localDateStr(new Date(Date.now() - 86400000))) return "Yesterday, " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// Shared duplicate-submission guard: disables the button for the duration of
// its own async handler so a fast double-tap can't fire the request twice.
async function withButtonGuard(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await fn();
  } finally {
    btn.disabled = false;
  }
}

// Every nutrition fetch below is tagged with the sequence number active when it
// started. If a newer load (a fast double-tap, a date change while a fetch is
// still in flight, etc.) starts before this one's response lands, its result is
// discarded instead of overwriting the DOM with stale data out of order --
// that's what previously let macro totals and the "Logged Today" list disagree.
let nutritionLoadSeq = 0;

async function loadFoodToday() {
  if (!state.nutritionDate) state.nutritionDate = localDateStr();
  document.getElementById("nutrition-date-input").value = state.nutritionDate;
  document.getElementById("nutrition-date-text").textContent = nutritionDateLabel(state.nutritionDate);

  const macroRow = document.querySelector("#view-food > .stat-row");
  const heroCard = document.getElementById("log-food-card");
  if (!state.nutritionEverLoaded) {
    macroRow.classList.add("nutrition-loading");
    heroCard.classList.add("nutrition-loading");
  }

  const seq = ++nutritionLoadSeq;
  await Promise.all([loadNutritionMacros(seq), loadRecentMeals(seq), loadSmartNutritionPlan(seq), loadNutritionHydrationCard(seq)]);

  macroRow.classList.remove("nutrition-loading");
  heroCard.classList.remove("nutrition-loading");
  state.nutritionEverLoaded = true;
}

async function loadNutritionMacros(seq) {
  seq = seq || ++nutritionLoadSeq;
  const data = await api("/nutrition/today?date=" + state.nutritionDate);
  if (seq !== nutritionLoadSeq) return;
  state.nutritionDayCache = data;

  const totals = data.totals;
  document.getElementById("food-total-calories").textContent = Math.round(totals.calories);
  document.getElementById("food-total-protein").textContent = Math.round(totals.protein_g) + "g";
  document.getElementById("food-total-carbs").textContent = Math.round(totals.carbs_g) + "g";
  document.getElementById("food-total-fat").textContent = Math.round(totals.fat_g) + "g";

  const goal = state.settings && state.settings.daily_calorie_goal_kcal;
  const proteinTarget = goal ? (goal * MACRO_SPLIT.protein) / MACRO_KCAL_PER_G.protein : null;
  const carbsTarget = goal ? (goal * MACRO_SPLIT.carbs) / MACRO_KCAL_PER_G.carbs : null;
  const fatTarget = goal ? (goal * MACRO_SPLIT.fat) / MACRO_KCAL_PER_G.fat : null;
  const setSub = (key, label, target, unit, value) => {
    document.getElementById("food-" + key + "-sub").textContent = target ? "/ " + Math.round(target).toLocaleString() + (unit || "") : "/ —";
    document.getElementById("food-" + key + "-bar").style.width = (target ? Math.min(100, Math.round((100 * value) / target)) : 0) + "%";
    const unitWord = unit === "g" ? "grams" : "kcal";
    const roundedValue = Math.round(value).toLocaleString();
    const card = document.getElementById("macro-card-" + key);
    if (target) {
      const pct = Math.round((100 * value) / target);
      card.setAttribute("aria-label", label + ", " + roundedValue + " " + unitWord + " consumed out of a target of " + Math.round(target).toLocaleString() + " " + unitWord + ", " + pct + " percent complete.");
    } else {
      card.setAttribute("aria-label", label + ", " + roundedValue + " " + unitWord + " consumed. No target set.");
    }
  };
  setSub("calories", "Calories", goal, "", totals.calories);
  setSub("protein", "Protein", proteinTarget, "g", totals.protein_g);
  setSub("carbs", "Carbs", carbsTarget, "g", totals.carbs_g);
  setSub("fat", "Fat", fatTarget, "g", totals.fat_g);

  const proteinKcal = totals.protein_g * MACRO_KCAL_PER_G.protein;
  const carbsKcal = totals.carbs_g * MACRO_KCAL_PER_G.carbs;
  const fatKcal = totals.fat_g * MACRO_KCAL_PER_G.fat;
  const kcalSum = proteinKcal + carbsKcal + fatKcal || 1;
  document.getElementById("log-food-rings").innerHTML =
    macroRingItem("C", (100 * carbsKcal) / kcalSum) + macroRingItem("P", (100 * proteinKcal) / kcalSum) + macroRingItem("F", (100 * fatKcal) / kcalSum);

  // Ring fill never exceeds 100%, but the label always shows the real percentage --
  // going over target isn't visually broken or treated as a failure state.
  const dailyPct = goal ? Math.round((100 * totals.calories) / goal) : 0;
  document.getElementById("daily-progress-ring").innerHTML = ringSvg(Math.max(0, Math.min(100, dailyPct)), "var(--brand)", 56, 6);
  document.getElementById("daily-progress-pct").textContent = goal ? dailyPct + "%" : "—";
  document.getElementById("daily-progress-card").setAttribute(
    "aria-label",
    goal ? "Daily Progress, " + dailyPct + " percent of calorie goal. Opens your logged food for " + nutritionDateLabel(state.nutritionDate) + "." : "Daily Progress, no calorie goal set."
  );

  const streak = data.logging_streak || 0;
  const longestStreak = data.longest_streak || 0;
  document.getElementById("food-streak-title").textContent = streak + " Day Streak";
  document.getElementById("nutrition-streak-card").setAttribute(
    "aria-label",
    streak + " day nutrition streak" + (longestStreak > streak ? ", longest streak " + longestStreak + " days" : "") + ". Opens streak details."
  );
  document.getElementById("food-streak-sub").textContent =
    streak > 0 ? "Keep it going! You're building great habits." : "Log a meal today to start building a streak.";

  document.getElementById("logged-today-label").textContent = data.is_today ? "Logged Today" : "Logged on " + nutritionDateLabel(state.nutritionDate);
  renderDailyLogList(data);
}

function renderDailyLogList(data) {
  const list = document.getElementById("food-log-list");
  if (!data.entries.length) {
    list.innerHTML =
      '<div class="empty-note">Nothing logged yet.<br>' +
      '<button type="button" class="btn subtle small" id="btn-empty-log-add-food" style="width:auto;margin-top:0.5rem;">Add Food</button></div>';
    document.getElementById("btn-empty-log-add-food").addEventListener("click", () => { resetFoodAddView(); showView("view-food-add"); });
    return;
  }
  const groups = {};
  data.entries.forEach((e) => {
    const slot = MEAL_SLOTS.includes(e.meal_slot) ? e.meal_slot : "snack";
    (groups[slot] = groups[slot] || []).push(e);
  });
  list.innerHTML = MEAL_SLOTS.filter((slot) => groups[slot] && groups[slot].length)
    .map((slot) => (
      '<div class="set-group-label">' + MEAL_SLOT_LABELS[slot] + '</div>' +
      '<div class="card tight">' + groups[slot].map(renderFoodEntryRow).join("") + '</div>'
    ))
    .join("");

  // loadNutritionMacros() re-fetches the day and calls renderDailyLogList() itself,
  // so a single call after each edit keeps macro cards, rings, and this list in sync.
  list.querySelectorAll(".food-servings-input").forEach((input) => {
    input.addEventListener("focus", () => input.select());
    input.addEventListener("change", async () => {
      const val = parseFloat(input.value);
      if (Number.isNaN(val) || val <= 0) {
        toast("Enter a valid amount");
        return;
      }
      await api("/nutrition/log/" + input.dataset.entry, { method: "PATCH", body: JSON.stringify({ servings: val }) });
      toast("Updated");
      loadNutritionMacros();
    });
  });
  list.querySelectorAll(".set-delete-btn[data-entry]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/nutrition/log/" + btn.dataset.entry, { method: "DELETE" });
      toast("Removed");
      loadNutritionMacros();
    });
  });
}

// Macro cards and Daily Progress jump straight to the always-visible, always-
// editable "Logged Today" list right below the hero card -- deleting a food
// should take exactly as few taps as adding one did, not a separate drill-down.
function scrollToLoggedToday() {
  document.getElementById("logged-today-label").scrollIntoView({ behavior: "smooth", block: "start" });
}
["calories", "protein", "carbs", "fat"].forEach((key) => {
  document.getElementById("macro-card-" + key).addEventListener("click", scrollToLoggedToday);
});
document.getElementById("daily-progress-card").addEventListener("click", scrollToLoggedToday);

// -------------------------------------------------------------- recent meals ----

async function loadRecentMeals(seq) {
  seq = seq || ++nutritionLoadSeq;
  const row = document.getElementById("recent-meals-row");
  row.innerHTML = sessionSkeletons(3);
  let data;
  try {
    data = await api("/nutrition/recent-meals?limit=3");
  } catch (e) {
    if (seq !== nutritionLoadSeq) return;
    row.innerHTML =
      '<div class="empty-note">Couldn\'t load recent meals. <button type="button" class="btn subtle small" id="btn-retry-recent-meals" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-recent-meals").addEventListener("click", () => loadRecentMeals());
    return;
  }
  if (seq !== nutritionLoadSeq) return;
  state.recentMealsCache = data.meals;
  if (!data.meals.length) {
    row.innerHTML =
      '<div class="empty-note" style="max-width:240px;">Your recent meals will appear here.<br>' +
      '<button type="button" class="btn subtle small" id="btn-browse-foods" style="width:auto;margin-top:0.5rem;">Browse Foods</button></div>';
    document.getElementById("btn-browse-foods").addEventListener("click", () => { resetFoodAddView(); showView("view-food-add"); });
    return;
  }
  row.innerHTML = data.meals
    .map((m, i) => (
      '<button type="button" class="log-session-card" style="width:170px;" data-meal-idx="' + i + '" aria-label="Recent meal, ' + escapeHtml(m.name) + ", " + Math.round(m.calories) + " calories, " + Math.round(m.protein_g) + ' grams protein. Tap to add to selected date.">' +
      '<div style="display:flex;align-items:center;gap:0.35rem;color:var(--brand);font-size:0.7rem;font-weight:700;text-transform:uppercase;">' + MEAL_SLOT_ICONS[m.meal_slot] + MEAL_SLOT_LABELS[m.meal_slot] + "</div>" +
      '<div class="name" style="margin-top:0.4rem;">' + escapeHtml(m.name) + "</div>" +
      '<div class="date tnum">' + Math.round(m.calories) + " kcal · " + Math.round(m.protein_g) + "P " + Math.round(m.carbs_g) + "C " + Math.round(m.fat_g) + "F</div>" +
      "</button>"
    ))
    .join("");
  row.querySelectorAll("[data-meal-idx]").forEach((card) => {
    card.addEventListener("click", () => showRecentMealConfirm(state.recentMealsCache[parseInt(card.dataset.mealIdx, 10)]));
  });
}

function showRecentMealConfirm(meal) {
  const panel = document.getElementById("recent-meal-confirm-panel");
  panel.innerHTML =
    '<div style="font-weight:700;font-size:0.9rem;">' + escapeHtml(meal.name) + "</div>" +
    '<div class="tnum" style="font-size:0.8rem;color:var(--neutral-2);margin-top:0.2rem;">' + Math.round(meal.calories) + " kcal · P" + Math.round(meal.protein_g) + "g C" + Math.round(meal.carbs_g) + "g F" + Math.round(meal.fat_g) + "g</div>" +
    '<button type="button" class="btn primary small" id="btn-recent-meal-add" style="width:auto;margin-top:0.7rem;">Add to Selected Date</button>';
  panel.classList.remove("hidden");
  document.getElementById("btn-recent-meal-add").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
    await api("/nutrition/log", {
      method: "POST",
      body: JSON.stringify({ food_item_id: meal.food_item_id, servings: meal.servings, meal_slot: meal.meal_slot, date: state.nutritionDate }),
    });
    toast(meal.name + " added");
    panel.classList.add("hidden");
    loadFoodToday();
  }));
}

document.getElementById("btn-food-see-all").addEventListener("click", async () => {
  showView("view-nutrition-recent-meals");
  const list = document.getElementById("recent-meals-full-list");
  list.innerHTML = '<div class="empty-note">Loading…</div>';
  const data = await api("/nutrition/recent-meals?limit=30");
  if (!data.meals.length) {
    list.innerHTML = '<div class="empty-note">Your recent meals will appear here.</div>';
    return;
  }
  list.innerHTML = data.meals
    .map((m, i) => {
      const dateLabel = new Date(m.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return (
        '<div class="session-row">' +
        '<div class="icon-circle md">' + MEAL_SLOT_ICONS[m.meal_slot] + "</div>" +
        '<div style="flex:1;min-width:0;"><div class="name">' + escapeHtml(m.name) + "</div>" +
        '<div class="meta tnum">' + dateLabel + " · " + Math.round(m.calories) + " kcal · P" + Math.round(m.protein_g) + " C" + Math.round(m.carbs_g) + " F" + Math.round(m.fat_g) + "</div></div>" +
        '<button type="button" class="btn subtle small" data-fullmeal-idx="' + i + '" style="width:auto;">Add</button>' +
        "</div>"
      );
    })
    .join("");
  list.querySelectorAll("[data-fullmeal-idx]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const meal = data.meals[parseInt(btn.dataset.fullmealIdx, 10)];
      btn.disabled = true;
      try {
        await api("/nutrition/log", {
          method: "POST",
          body: JSON.stringify({ food_item_id: meal.food_item_id, servings: meal.servings, meal_slot: meal.meal_slot, date: state.nutritionDate }),
        });
        toast(meal.name + " added to " + nutritionDateLabel(state.nutritionDate));
      } finally {
        btn.disabled = false;
      }
    });
  });
});

// --------------------------------------------------------- smart nutrition plan ----

async function loadSmartNutritionPlan(seq) {
  seq = seq || ++nutritionLoadSeq;
  const card = document.getElementById("smart-nutrition-plan-card");
  card.innerHTML = '<div class="empty-note">Loading…</div>';
  let data;
  try {
    data = await api("/nutrition/recommendation?date=" + state.nutritionDate);
  } catch (e) {
    if (seq !== nutritionLoadSeq) return;
    card.innerHTML = '<div class="empty-note">Couldn\'t load your Smart Nutrition Plan.</div>';
    return;
  }
  if (seq !== nutritionLoadSeq) return;
  let html =
    '<div class="smart-plan-head"><div class="icon-circle md">' + SPARKLE_SVG.replace('width="16" height="16"', 'width="18" height="18"') + "</div>" +
    '<div class="smart-plan-title-row"><span class="title">Smart Nutrition Plan</span><span class="smart-plan-badge">AI Coach</span></div></div>' +
    '<div class="smart-plan-headline">' + escapeHtml(data.headline) + "</div>" +
    (data.detail ? '<div class="smart-plan-detail">' + escapeHtml(data.detail) + "</div>" : "");
  if (!data.configured) {
    html += '<button type="button" class="btn subtle small" id="btn-smart-plan-set-goal" style="width:auto;margin-top:0.7rem;">Set Up Nutrition</button>';
  }
  if (data.recommendation) {
    const r = data.recommendation;
    html +=
      '<div class="smart-plan-rec" id="smart-plan-rec-card" role="button" tabindex="0" aria-label="Smart Nutrition Plan recommends ' + escapeHtml(r.name) + ", " + Math.round(r.calories) + ' calories. Tap to view the recipe.">' +
      '<div class="rec-icon recipe-gradient-' + r.gradient_key + '">' + r.icon_emoji + "</div>" +
      '<div class="rec-body"><div class="rec-label">Recommended</div>' +
      '<div class="rec-name">' + escapeHtml(r.name) + "</div>" +
      '<div class="rec-macros tnum">' + Math.round(r.calories) + " kcal · " + Math.round(r.protein_g) + "P " + Math.round(r.carbs_g) + "C " + Math.round(r.fat_g) + "F</div></div>" +
      '<button type="button" class="btn primary small" id="btn-smart-plan-add" style="width:auto;">Add to Log</button>' +
      "</div>";
  }
  card.innerHTML = html;

  if (!data.configured) {
    document.getElementById("btn-smart-plan-set-goal").addEventListener("click", () => {
      document.getElementById("edit-targets-calorie-input").value = "";
      const panel = document.getElementById("nutrition-edit-targets-panel");
      panel.classList.remove("hidden");
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  if (data.recommendation) {
    document.getElementById("smart-plan-rec-card").addEventListener("click", (e) => {
      if (e.target.closest("#btn-smart-plan-add")) return;
      openRecipeDetail(data.recommendation.id);
    });
    document.getElementById("smart-plan-rec-card").addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.target.closest("#btn-smart-plan-add")) {
        e.preventDefault();
        openRecipeDetail(data.recommendation.id);
      }
    });
    document.getElementById("btn-smart-plan-add").addEventListener("click", (e) => {
      e.stopPropagation();
      withButtonGuard(e.currentTarget, async () => {
        await api("/recipes/" + data.recommendation.id + "/log", {
          method: "POST",
          body: JSON.stringify({ servings: 1, meal_slot: defaultMealSlot(), date: state.nutritionDate }),
        });
        toast(data.recommendation.name + " added");
        loadFoodToday();
      });
    });
  }
}

// -------------------------------------------------------------------- hydration ----

async function loadNutritionHydrationCard(seq) {
  seq = seq || ++nutritionLoadSeq;
  let data;
  try {
    data = await api("/hydration/today?date=" + state.nutritionDate);
  } catch (e) {
    if (seq !== nutritionLoadSeq) return;
    document.getElementById("hydration-pct").textContent = "—";
    document.getElementById("hydration-sub").textContent = "Hydration unavailable";
    return;
  }
  if (seq !== nutritionLoadSeq) return;
  const pct = data.goal_oz ? Math.round((100 * data.ounces) / data.goal_oz) : 0;
  document.getElementById("hydration-ring").innerHTML = ringSvg(Math.max(0, Math.min(100, pct)), "var(--recovery)", 56, 6);
  document.getElementById("hydration-pct").textContent = ozToDisplay(data.ounces) + hydrationUnit();
  document.getElementById("hydration-sub").textContent = "of " + ozToDisplay(data.goal_oz) + " " + hydrationUnit() + " goal";
  document.getElementById("hydration-card").setAttribute(
    "aria-label",
    "Hydration, " + ozToDisplay(data.ounces) + " " + hydrationUnit() + " of a " + ozToDisplay(data.goal_oz) + " " + hydrationUnit() + " goal, " + pct + " percent. Tap to log water."
  );
}

document.getElementById("hydration-card").addEventListener("click", () => {
  const panel = document.getElementById("nutrition-hydration-quickadd-panel");
  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }
  const isMetric = state.units !== "imperial";
  const options = isMetric ? [250, 500, 750] : [8, 16, 24];
  panel.innerHTML =
    '<div style="font-size:0.78rem;color:var(--neutral-2);margin-bottom:0.5rem;">Add water (' + hydrationUnit() + ")</div>" +
    '<div class="qty-row">' + options.map((v) => '<button type="button" class="btn subtle small" data-oz="' + v + '">+' + v + "</button>").join("") + "</div>";
  panel.classList.remove("hidden");
  panel.querySelectorAll("[data-oz]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const displayVal = parseFloat(btn.dataset.oz);
      const ounces = isMetric ? displayVal / 29.5735 : displayVal;
      await api("/hydration/today", { method: "POST", body: JSON.stringify({ ounces: ounces, date: state.nutritionDate }) });
      panel.classList.add("hidden");
      loadNutritionHydrationCard();
      toast("Logged " + displayVal + " " + hydrationUnit());
    });
  });
});

// ------------------------------------------------------------------- streak ----

document.getElementById("nutrition-streak-card").addEventListener("click", () => {
  const panel = document.getElementById("nutrition-streak-detail-panel");
  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }
  const data = state.nutritionDayCache || {};
  const current = data.logging_streak || 0;
  const longest = data.longest_streak || 0;
  panel.innerHTML =
    '<div class="stat-row" style="margin-bottom:0.6rem;">' +
    '<div class="stat-tile"><div class="label">Current</div><div class="value tnum">' + current + '</div></div>' +
    '<div class="stat-tile"><div class="label">Longest</div><div class="value tnum">' + longest + "</div></div></div>" +
    '<div style="font-size:0.78rem;color:var(--neutral-2);line-height:1.4;">A day counts toward your streak when at least one food entry is logged on it. Missing a day resets the current streak — your longest streak is always kept.</div>';
  panel.classList.remove("hidden");
});

// -------------------------------------------------------------- date + overflow ----

function openNutritionDatePicker() {
  const input = document.getElementById("nutrition-date-input");
  input.value = state.nutritionDate;
  if (input.showPicker) {
    try {
      input.showPicker();
      return;
    } catch (e) {
      // fall through to the plain click below on browsers that reject showPicker()
    }
  }
  input.click();
}
document.getElementById("btn-nutrition-date").addEventListener("click", openNutritionDatePicker);
document.getElementById("nutrition-date-label").addEventListener("click", openNutritionDatePicker);
document.getElementById("nutrition-date-input").addEventListener("change", (e) => {
  if (!e.target.value) return;
  state.nutritionDate = e.target.value;
  loadFoodToday();
});

function exportDailySummary(data) {
  const lines = ["Toci Nutrition Summary — " + nutritionDateLabel(state.nutritionDate), ""];
  const t = data.totals;
  lines.push("Calories: " + Math.round(t.calories) + " kcal");
  lines.push("Protein: " + Math.round(t.protein_g) + " g");
  lines.push("Carbs: " + Math.round(t.carbs_g) + " g");
  lines.push("Fat: " + Math.round(t.fat_g) + " g");
  lines.push("Fiber: " + Math.round(t.fiber_g) + " g · Sugar: " + Math.round(t.sugar_g) + " g · Sodium: " + Math.round(t.sodium_mg) + " mg");
  lines.push("");
  if (data.entries.length) {
    lines.push("Logged items:");
    data.entries.forEach((e) => {
      lines.push("- " + e.name + " (" + MEAL_SLOT_LABELS[e.meal_slot] + "): " + Math.round(e.calories) + " kcal, P" + Math.round(e.protein_g) + " C" + Math.round(e.carbs_g) + " F" + Math.round(e.fat_g));
    });
  } else {
    lines.push("Nothing logged this day.");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "toci-nutrition-" + state.nutritionDate + ".txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Summary exported");
}

document.getElementById("btn-nutrition-overflow").addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = document.getElementById("nutrition-overflow-menu");
  const isHidden = menu.classList.contains("hidden");
  document.getElementById("nutrition-edit-targets-panel").classList.add("hidden");
  document.getElementById("nutrition-copy-day-panel").classList.add("hidden");
  if (!isHidden) {
    menu.classList.add("hidden");
    return;
  }
  menu.innerHTML =
    '<button type="button" class="overflow-menu-item" id="ov-edit-targets">Edit Daily Targets</button>' +
    '<button type="button" class="overflow-menu-item" id="ov-copy-day">Copy Meals From Another Day</button>' +
    '<button type="button" class="overflow-menu-item" id="ov-nutrition-settings">Nutrition Settings</button>' +
    '<button type="button" class="overflow-menu-item" id="ov-export-summary">Export Daily Summary</button>' +
    '<div class="overflow-menu-divider"></div>' +
    '<button type="button" class="overflow-menu-item destructive" id="ov-clear-day">Clear Day\'s Log</button>';
  menu.classList.remove("hidden");

  document.getElementById("ov-edit-targets").addEventListener("click", () => {
    menu.classList.add("hidden");
    document.getElementById("edit-targets-calorie-input").value = (state.settings && state.settings.daily_calorie_goal_kcal) || "";
    const panel = document.getElementById("nutrition-edit-targets-panel");
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("ov-copy-day").addEventListener("click", () => {
    menu.classList.add("hidden");
    document.getElementById("copy-day-from-input").value = localDateStr(new Date(Date.now() - 86400000));
    setActiveChip(document.getElementById("copy-day-meal-chips"), "");
    const panel = document.getElementById("nutrition-copy-day-panel");
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("ov-nutrition-settings").addEventListener("click", () => {
    menu.classList.add("hidden");
    document.querySelector('.tab-bar [data-tab="view-settings"]').click();
    switchProfileSegment("preferences");
  });
  document.getElementById("ov-export-summary").addEventListener("click", async () => {
    menu.classList.add("hidden");
    const data = state.nutritionDayCache && state.nutritionDayCache.date === state.nutritionDate
      ? state.nutritionDayCache
      : await api("/nutrition/today?date=" + state.nutritionDate);
    exportDailySummary(data);
  });
  document.getElementById("ov-clear-day").addEventListener("click", async () => {
    menu.classList.add("hidden");
    if (!confirm("Clear all food logged on " + nutritionDateLabel(state.nutritionDate) + "? Saved meals, recipes, and targets are not affected. This can't be undone.")) return;
    await api("/nutrition/log?date=" + state.nutritionDate, { method: "DELETE" });
    toast("Day's log cleared");
    loadFoodToday();
  });
});
document.addEventListener("click", (e) => {
  const menu = document.getElementById("nutrition-overflow-menu");
  if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target) && e.target.id !== "btn-nutrition-overflow") {
    menu.classList.add("hidden");
  }
});

document.getElementById("btn-save-targets").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
  const val = parseFloat(document.getElementById("edit-targets-calorie-input").value);
  if (Number.isNaN(val) || val <= 0) {
    toast("Enter a valid calorie target");
    return;
  }
  await api("/settings", { method: "PATCH", body: JSON.stringify({ daily_calorie_goal_kcal: val }) });
  state.settings.daily_calorie_goal_kcal = val;
  document.getElementById("nutrition-edit-targets-panel").classList.add("hidden");
  toast("Daily target updated");
  loadFoodToday();
}));

document.getElementById("copy-day-meal-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  setActiveChip(document.getElementById("copy-day-meal-chips"), chip.dataset.val);
});
document.getElementById("btn-do-copy-day").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
  const fromDate = document.getElementById("copy-day-from-input").value;
  if (!fromDate) {
    toast("Choose a date to copy from");
    return;
  }
  const mealChip = document.querySelector("#copy-day-meal-chips .chip.active");
  const result = await api("/nutrition/copy", {
    method: "POST",
    body: JSON.stringify({ from_date: fromDate, meal_slot: mealChip && mealChip.dataset.val ? mealChip.dataset.val : null, to_date: state.nutritionDate }),
  });
  if (!result.copied) {
    toast("Nothing logged on that day to copy");
    return;
  }
  toast("Copied " + result.copied + " item" + (result.copied === 1 ? "" : "s"));
  document.getElementById("nutrition-copy-day-panel").classList.add("hidden");
  loadFoodToday();
}));

// ---------------------------------------------------------------- segments ----

function switchNutritionSegment(segment) {
  state.nutritionSegment = segment;
  document.querySelectorAll("#food-segmented-tabs .seg-btn").forEach((b) => {
    const selected = b.dataset.nutritionSeg === segment;
    b.classList.toggle("active", selected);
    b.setAttribute("aria-selected", selected ? "true" : "false");
  });
  document.querySelectorAll(".nutrition-segment").forEach((el) => el.classList.toggle("hidden", el.dataset.nutritionSeg !== segment));
  if (segment === "savedMeals") {
    document.getElementById("new-meal-builder").classList.add("hidden");
    loadSavedMeals();
  }
  if (segment === "recipes") loadRecipeHub();
  if (segment === "smartCart") loadShoppingCart();
}
document.getElementById("food-segmented-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (btn) switchNutritionSegment(btn.dataset.nutritionSeg);
});

document.getElementById("btn-open-add-food").addEventListener("click", () => {
  resetFoodAddView();
  showView("view-food-add");
});
document.getElementById("btn-open-add-food-icon").addEventListener("click", () => {
  resetFoodAddView();
  showView("view-food-add");
});
document.getElementById("btn-fab-add-food").addEventListener("click", () => {
  resetFoodAddView();
  showView("view-food-add");
});
document.querySelector("#view-food-add [data-back]").addEventListener("click", () => stopBarcodeScan());

function setActiveChip(container, val) {
  container.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.val === val));
}

function resetFoodAddView() {
  stopBarcodeScan();
  state.selectedFood = null;
  state.selectedServings = 1;
  state.selectedMealSlot = defaultMealSlot();
  document.getElementById("food-selected-card").classList.add("hidden");
  document.getElementById("scan-status").textContent = "";
  document.getElementById("manual-barcode-input").value = "";
  document.getElementById("food-search-input").value = "";
  document.getElementById("food-search-results").innerHTML = '<div class="empty-note">Loading…</div>';
  document.getElementById("restaurant-chips").innerHTML = '<div class="empty-note">Loading…</div>';
  document.getElementById("restaurant-results").innerHTML = "";
  document.getElementById("restaurant-results").classList.add("hidden");
  document.getElementById("quickadd-label").value = "";
  ["quickadd-calories", "quickadd-protein", "quickadd-carbs", "quickadd-fat"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  setActiveChip(document.getElementById("quickadd-meal-chips"), state.selectedMealSlot);
  document.getElementById("custom-food-name").value = "";
  document.getElementById("custom-food-brand").value = "";
  document.getElementById("custom-food-serving-qty").value = "1";
  document.getElementById("custom-food-serving-unit").value = "serving";
  ["custom-food-calories", "custom-food-protein", "custom-food-carbs", "custom-food-fat", "custom-food-fiber", "custom-food-sugar", "custom-food-sodium"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.querySelectorAll("#food-add-mode-chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.mode === "scan"));
  ["scan", "search", "restaurants", "quickadd", "custom"].forEach((m) => {
    document.getElementById("food-panel-" + m).classList.toggle("hidden", m !== "scan");
  });
}

document.querySelectorAll("#food-add-mode-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#food-add-mode-chips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const mode = chip.dataset.mode;
    ["scan", "search", "restaurants", "quickadd", "custom"].forEach((m) => {
      document.getElementById("food-panel-" + m).classList.toggle("hidden", m !== mode);
    });
    if (mode !== "scan") stopBarcodeScan();
    if (mode === "search" && !document.getElementById("food-search-input").value.trim()) {
      runFoodSearch("");
    }
    if (mode === "restaurants") loadRestaurantChips();
  });
});

document.getElementById("quickadd-meal-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  setActiveChip(document.getElementById("quickadd-meal-chips"), chip.dataset.val);
});

document.getElementById("btn-quick-add").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
  const calories = parseFloat(document.getElementById("quickadd-calories").value);
  if (Number.isNaN(calories)) {
    toast("Enter calories first");
    return;
  }
  const mealChip = document.querySelector("#quickadd-meal-chips .chip.active");
  await api("/nutrition/quick-add", {
    method: "POST",
    body: JSON.stringify({
      label: document.getElementById("quickadd-label").value.trim() || "Quick Add",
      calories: calories,
      protein_g: parseFloat(document.getElementById("quickadd-protein").value) || 0,
      carbs_g: parseFloat(document.getElementById("quickadd-carbs").value) || 0,
      fat_g: parseFloat(document.getElementById("quickadd-fat").value) || 0,
      meal_slot: mealChip ? mealChip.dataset.val : "snack",
      date: state.nutritionDate,
    }),
  });
  toast("Added — delete it anytime from Logged Today");
  switchNutritionSegment("food");
  showView("view-food");
  loadFoodToday();
}));

// -- restaurants --

let restaurantFoodsCache = [];

async function loadRestaurantChips() {
  const chipWrap = document.getElementById("restaurant-chips");
  const data = await api("/nutrition/restaurants");
  if (!data.restaurants.length) {
    chipWrap.innerHTML = '<div class="empty-note">No restaurants available.</div>';
    return;
  }
  chipWrap.innerHTML = data.restaurants
    .map((r) => '<button class="chip" data-restaurant="' + r + '">' + r + "</button>")
    .join("");
  chipWrap.querySelectorAll("[data-restaurant]").forEach((chip) => {
    chip.addEventListener("click", async () => {
      chipWrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const results = document.getElementById("restaurant-results");
      results.classList.remove("hidden");
      results.innerHTML = '<div class="empty-note">Loading…</div>';
      const data = await api("/nutrition/foods?restaurant=" + encodeURIComponent(chip.dataset.restaurant));
      restaurantFoodsCache = data.foods;
      if (!data.foods.length) {
        results.innerHTML = '<div class="empty-note">No items found.</div>';
        return;
      }
      results.innerHTML = data.foods
        .map((f) => (
          '<div class="food-result-row" data-foodid="' + f.id + '"><div><div class="name">' + f.name +
          '</div><div class="sub">' + f.serving_qty + f.serving_unit + " · " + f.calories + ' kcal</div></div>' +
          '<span style="color:var(--brand);font-weight:700;">+</span></div>'
        ))
        .join("");
      results.querySelectorAll("[data-foodid]").forEach((row) => {
        row.addEventListener("click", () => {
          const food = restaurantFoodsCache.find((f) => f.id === parseInt(row.dataset.foodid, 10));
          selectFoodForLogging(food);
        });
      });
    });
  });
}

// -- search --

let foodSearchDebounce;
let foodSearchCache = [];
document.getElementById("food-search-input").addEventListener("input", (e) => {
  clearTimeout(foodSearchDebounce);
  const q = e.target.value.trim();
  foodSearchDebounce = setTimeout(() => runFoodSearch(q), 300);
});

async function runFoodSearch(q) {
  const results = document.getElementById("food-search-results");
  const label = document.getElementById("food-search-results-label");
  label.textContent = q ? "Results" : "Recent & Frequent";
  const data = await api("/nutrition/foods" + (q ? "?q=" + encodeURIComponent(q) : ""));
  foodSearchCache = data.foods;
  if (!data.foods.length) {
    results.innerHTML = '<div class="empty-note">' + (q ? "No matches — try Custom Food." : "No foods logged yet.") + '</div>';
    return;
  }
  results.innerHTML = data.foods
    .map((f) => (
      '<div class="food-result-row" data-foodid="' + f.id + '"><div><div class="name">' + (f.is_favorite ? "★ " : "") + f.name +
      '</div><div class="sub">' + f.serving_qty + f.serving_unit + " · " + f.calories + ' kcal</div></div>' +
      '<span style="color:var(--brand);font-weight:700;">+</span></div>'
    ))
    .join("");
  results.querySelectorAll("[data-foodid]").forEach((row) => {
    row.addEventListener("click", () => {
      const food = foodSearchCache.find((f) => f.id === parseInt(row.dataset.foodid, 10));
      selectFoodForLogging(food);
    });
  });
}

// -- custom food --

document.getElementById("btn-create-custom-food").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
  const name = document.getElementById("custom-food-name").value.trim();
  if (!name) {
    toast("Enter a food name first");
    return;
  }
  const calories = parseFloat(document.getElementById("custom-food-calories").value);
  if (Number.isNaN(calories)) {
    toast("Enter calories first");
    return;
  }
  const food = await api("/nutrition/foods", {
    method: "POST",
    body: JSON.stringify({
      name: name,
      brand: document.getElementById("custom-food-brand").value.trim() || null,
      serving_qty: parseFloat(document.getElementById("custom-food-serving-qty").value) || 1,
      serving_unit: document.getElementById("custom-food-serving-unit").value.trim() || "serving",
      calories: calories,
      protein_g: parseFloat(document.getElementById("custom-food-protein").value) || 0,
      carbs_g: parseFloat(document.getElementById("custom-food-carbs").value) || 0,
      fat_g: parseFloat(document.getElementById("custom-food-fat").value) || 0,
      fiber_g: parseFloat(document.getElementById("custom-food-fiber").value) || 0,
      sugar_g: parseFloat(document.getElementById("custom-food-sugar").value) || 0,
      sodium_mg: parseFloat(document.getElementById("custom-food-sodium").value) || 0,
    }),
  });
  toast("Food created");
  selectFoodForLogging(food);
}));

// -- selected food -> add to today --

function selectFoodForLogging(food) {
  state.selectedFood = food;
  state.selectedServings = 1;
  if (!state.selectedMealSlot) state.selectedMealSlot = defaultMealSlot();
  setActiveChip(document.getElementById("food-selected-meal-chips"), state.selectedMealSlot);
  renderSelectedFood();
  document.getElementById("food-selected-card").classList.remove("hidden");
}

function renderSelectedFood() {
  const food = state.selectedFood;
  if (!food) return;
  const s = state.selectedServings;
  document.getElementById("food-selected-name").textContent = food.name + (food.brand ? " — " + food.brand : "");
  document.getElementById("food-selected-sub").textContent = food.serving_qty + food.serving_unit + " per serving";
  document.getElementById("food-selected-servings").textContent = s;
  document.getElementById("food-selected-macros").textContent =
    Math.round(food.calories * s) + " kcal · P" + Math.round(food.protein_g * s) + "g C" +
    Math.round(food.carbs_g * s) + "g F" + Math.round(food.fat_g * s) + "g";
  document.getElementById("food-selected-micros").textContent =
    "Fiber " + Math.round((food.fiber_g || 0) * s) + "g · Sugar " + Math.round((food.sugar_g || 0) * s) +
    "g · Sodium " + Math.round((food.sodium_mg || 0) * s) + "mg";
  const star = document.getElementById("btn-toggle-selected-favorite");
  star.textContent = food.is_favorite ? "★" : "☆";
  star.classList.toggle("active", !!food.is_favorite);
}

document.getElementById("btn-servings-minus").addEventListener("click", () => {
  state.selectedServings = Math.max(0.25, Math.round((state.selectedServings - 0.25) * 100) / 100);
  renderSelectedFood();
});
document.getElementById("btn-servings-plus").addEventListener("click", () => {
  state.selectedServings = Math.round((state.selectedServings + 0.25) * 100) / 100;
  renderSelectedFood();
});

document.getElementById("btn-toggle-selected-favorite").addEventListener("click", async () => {
  const food = state.selectedFood;
  if (!food) return;
  const result = await api("/nutrition/foods/" + food.id + "/favorite", { method: "POST" });
  food.is_favorite = result.is_favorite;
  renderSelectedFood();
});

document.getElementById("food-selected-meal-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  state.selectedMealSlot = chip.dataset.val;
  setActiveChip(document.getElementById("food-selected-meal-chips"), state.selectedMealSlot);
});

document.getElementById("btn-add-to-today").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
  if (!state.selectedFood) return;
  await api("/nutrition/log", {
    method: "POST",
    body: JSON.stringify({
      food_item_id: state.selectedFood.id,
      servings: state.selectedServings,
      meal_slot: state.selectedMealSlot || "snack",
      date: state.nutritionDate,
    }),
  });
  toast(state.selectedFood.name + " added — delete it anytime from Logged Today");
  switchNutritionSegment("food");
  showView("view-food");
  loadFoodToday();
}));

// -- barcode scanning: native BarcodeDetector API (Chrome/Edge/Android) over
// the device camera, with manual barcode entry as the fallback everywhere else --

let scanStream = null;
let scanRAF = null;

async function startBarcodeScan() {
  const status = document.getElementById("scan-status");
  if (!("BarcodeDetector" in window)) {
    status.textContent = "Camera scanning isn't supported in this browser — enter the barcode number below instead.";
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (e) {
    status.textContent = "Camera access denied or unavailable — enter the barcode number below instead.";
    return;
  }
  const video = document.getElementById("scan-video");
  video.srcObject = scanStream;
  await video.play();
  document.getElementById("scan-video-wrap").classList.remove("hidden");
  status.textContent = "Point the camera at a barcode…";

  const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  const tick = async () => {
    if (!scanStream) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length) {
        const code = codes[0].rawValue;
        stopBarcodeScan();
        await handleBarcodeDetected(code);
        return;
      }
    } catch (e) {
      // keep polling -- a single failed detect() call isn't fatal
    }
    scanRAF = requestAnimationFrame(tick);
  };
  scanRAF = requestAnimationFrame(tick);
}

function stopBarcodeScan() {
  if (scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = null;
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  const wrap = document.getElementById("scan-video-wrap");
  if (wrap) wrap.classList.add("hidden");
}

async function handleBarcodeDetected(code) {
  const status = document.getElementById("scan-status");
  status.textContent = "Looking up " + code + "…";
  try {
    const food = await api("/nutrition/lookup/" + encodeURIComponent(code));
    selectFoodForLogging(food);
    status.textContent = "";
  } catch (e) {
    status.textContent = "No product found for that barcode — try Custom Food instead.";
  }
}

document.getElementById("btn-start-scan").addEventListener("click", startBarcodeScan);
document.getElementById("btn-lookup-manual-barcode").addEventListener("click", () => {
  const code = document.getElementById("manual-barcode-input").value.trim();
  if (!code) {
    toast("Enter a barcode number first");
    return;
  }
  handleBarcodeDetected(code);
});

// -- saved meals --

async function loadSavedMeals() {
  const list = document.getElementById("saved-meals-list");
  let data;
  try {
    data = await api("/nutrition/meals");
  } catch (e) {
    list.innerHTML =
      '<div class="empty-note">Saved meals unavailable right now. <button type="button" class="btn subtle small" id="btn-retry-saved-meals" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-saved-meals").addEventListener("click", loadSavedMeals);
    return;
  }
  if (!data.meals.length) {
    list.innerHTML = '<div class="empty-note">Create your first saved meal.</div>';
    return;
  }
  list.innerHTML = data.meals
    .map((m) => (
      '<div class="pr-row"><div style="min-width:0;flex:1;"><div class="name">' + m.name + '</div>' +
      '<div class="date tnum">' + m.items.length + " item" + (m.items.length === 1 ? "" : "s") + " · " +
      Math.round(m.total_calories) + " kcal</div></div>" +
      '<div style="display:flex;align-items:center;gap:0.4rem;flex:none;">' +
      '<input type="number" step="0.25" min="0.25" value="1" class="meal-multiplier-input tnum" data-meal="' + m.id + '" style="' + inputRowStyle + '">' +
      '<button class="btn small subtle" data-log-meal="' + m.id + '">Log</button>' +
      '<button class="set-delete-btn" data-del-meal="' + m.id + '" aria-label="Delete meal">×</button></div></div>'
    ))
    .join("");

  list.querySelectorAll("[data-log-meal]").forEach((btn) => {
    btn.addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
      const mealId = btn.dataset.logMeal;
      const multInput = list.querySelector('.meal-multiplier-input[data-meal="' + mealId + '"]');
      const mult = parseFloat(multInput.value) || 1;
      await api("/nutrition/meals/" + mealId + "/log", { method: "POST", body: JSON.stringify({ multiplier: mult, date: state.nutritionDate }) });
      toast("Meal logged to " + nutritionDateLabel(state.nutritionDate));
      loadNutritionMacros();
      loadRecentMeals();
    }));
  });
  list.querySelectorAll("[data-del-meal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/nutrition/meals/" + btn.dataset.delMeal, { method: "DELETE" });
      toast("Meal deleted");
      loadSavedMeals();
    });
  });
}

let newMealItems = [];

document.getElementById("btn-open-new-meal").addEventListener("click", () => {
  newMealItems = [];
  document.getElementById("new-meal-name").value = "";
  document.getElementById("new-meal-search-input").value = "";
  document.getElementById("new-meal-search-results").innerHTML = "";
  document.getElementById("new-meal-search-results").classList.add("hidden");
  renderNewMealItems();
  document.getElementById("new-meal-builder").classList.remove("hidden");
});

let newMealSearchDebounce;
document.getElementById("new-meal-search-input").addEventListener("input", (e) => {
  clearTimeout(newMealSearchDebounce);
  const q = e.target.value.trim();
  newMealSearchDebounce = setTimeout(() => runNewMealSearch(q), 300);
});

async function runNewMealSearch(q) {
  const results = document.getElementById("new-meal-search-results");
  if (!q) {
    results.classList.add("hidden");
    results.innerHTML = "";
    return;
  }
  const data = await api("/nutrition/foods?q=" + encodeURIComponent(q));
  results.classList.remove("hidden");
  if (!data.foods.length) {
    results.innerHTML = '<div class="empty-note">No matches.</div>';
    return;
  }
  results.innerHTML = data.foods
    .map((f) => (
      '<div class="food-result-row" data-foodid="' + f.id + '"><div><div class="name">' + f.name +
      '</div><div class="sub">' + f.serving_qty + f.serving_unit + " · " + f.calories + ' kcal</div></div>' +
      '<span style="color:var(--brand);font-weight:700;">+</span></div>'
    ))
    .join("");
  results.querySelectorAll("[data-foodid]").forEach((row) => {
    row.addEventListener("click", () => {
      const food = data.foods.find((f) => f.id === parseInt(row.dataset.foodid, 10));
      newMealItems.push({ food_item_id: food.id, name: food.name, servings: 1 });
      renderNewMealItems();
      document.getElementById("new-meal-search-input").value = "";
      results.classList.add("hidden");
      results.innerHTML = "";
    });
  });
}

function renderNewMealItems() {
  const container = document.getElementById("new-meal-items");
  if (!newMealItems.length) {
    container.innerHTML = '<div class="empty-note">No items added yet.</div>';
    return;
  }
  container.innerHTML = newMealItems
    .map((item, i) => (
      '<div class="pr-row"><div class="name">' + item.name + '</div>' +
      '<div style="display:flex;align-items:center;gap:0.4rem;">' +
      '<input type="number" step="0.25" min="0.25" value="' + item.servings + '" class="new-meal-servings-input tnum" data-idx="' + i + '" style="' + inputRowStyle + '">' +
      '<button class="set-delete-btn" data-remove-idx="' + i + '" aria-label="Remove item">×</button></div></div>'
    ))
    .join("");
  container.querySelectorAll(".new-meal-servings-input").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.idx, 10);
      const val = parseFloat(input.value);
      newMealItems[idx].servings = Number.isNaN(val) || val <= 0 ? 1 : val;
    });
  });
  container.querySelectorAll("[data-remove-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      newMealItems.splice(parseInt(btn.dataset.removeIdx, 10), 1);
      renderNewMealItems();
    });
  });
}

document.getElementById("btn-save-new-meal").addEventListener("click", async () => {
  const name = document.getElementById("new-meal-name").value.trim();
  if (!name) {
    toast("Name the meal first");
    return;
  }
  if (!newMealItems.length) {
    toast("Add at least one food first");
    return;
  }
  await api("/nutrition/meals", {
    method: "POST",
    body: JSON.stringify({ name: name, items: newMealItems.map((i) => ({ food_item_id: i.food_item_id, servings: i.servings })) }),
  });
  toast("Meal saved");
  document.getElementById("new-meal-builder").classList.add("hidden");
  loadSavedMeals();
});

// -- recipe hub --

function recipeCardHtml(r, showWhy) {
  return (
    '<div class="recipe-card recipe-gradient-' + r.gradient_key + '" data-recipeid="' + r.id + '">' +
    '<div><div class="icon">' + r.icon_emoji + '</div><div class="name">' + r.name + '</div></div>' +
    '<div>' +
    '<div class="macros">' + Math.round(r.calories) + ' kcal · P' + Math.round(r.protein_g) + 'g</div>' +
    (showWhy && r.why ? '<div class="why">' + r.why + '</div>' : '') +
    '</div></div>'
  );
}

function wireRecipeCards(container) {
  container.querySelectorAll("[data-recipeid]").forEach((card) => {
    card.addEventListener("click", () => openRecipeDetail(parseInt(card.dataset.recipeid, 10)));
  });
}

async function loadRecipeHub() {
  const recRow = document.getElementById("recommended-recipes-row");
  const catContainer = document.getElementById("recipe-category-rows");
  recRow.innerHTML = '<div class="empty-note">Loading…</div>';
  catContainer.innerHTML = '<div class="empty-note">Loading…</div>';

  let recommended, categories;
  try {
    [recommended, categories] = await Promise.all([api("/recipes/recommended"), api("/recipes/categories")]);
  } catch (e) {
    const retry = '<button type="button" class="btn subtle small" id="btn-retry-recipes" style="width:auto;">Retry</button>';
    recRow.innerHTML = '<div class="empty-note">Recipes unavailable right now. ' + retry + '</div>';
    catContainer.innerHTML = "";
    document.getElementById("btn-retry-recipes").addEventListener("click", loadRecipeHub);
    return;
  }

  recRow.innerHTML = recommended.recipes.length
    ? recommended.recipes.map((r) => recipeCardHtml(r, true)).join("")
    : '<div class="empty-note">Explore recipes to see personalized picks here.</div>';
  wireRecipeCards(recRow);

  if (!categories.categories.length) {
    catContainer.innerHTML = '<div class="empty-note">Explore recipes as your library grows.</div>';
    return;
  }
  const categoryData = await Promise.all(categories.categories.map((c) => api("/recipes?category=" + encodeURIComponent(c.key))));
  catContainer.innerHTML = categories.categories
    .map((c, i) => (
      '<div class="set-group-label">' + c.label + '</div>' +
      '<div class="recipe-scroll-row" data-category="' + c.key + '">' +
      categoryData[i].recipes.map((r) => recipeCardHtml(r, false)).join("") +
      '</div>'
    ))
    .join("");
  catContainer.querySelectorAll(".recipe-scroll-row").forEach(wireRecipeCards);
}

async function openRecipeDetail(id) {
  const recipe = await api("/recipes/" + id);
  state.selectedRecipe = recipe;
  state.recipeOverrides = {};
  state.recipeSubIndex = {};
  state.recipeLogServings = 1;
  state.recipeLogMealSlot = defaultMealSlot();

  document.getElementById("recipe-detail-hero").className = "recipe-hero recipe-gradient-" + recipe.gradient_key;
  document.getElementById("recipe-detail-icon").textContent = recipe.icon_emoji;
  document.getElementById("recipe-detail-name").textContent = recipe.name;
  document.getElementById("recipe-detail-badges").innerHTML = recipe.diet_tags
    .map((t) => '<span class="chip" style="pointer-events:none;">' + (t.replace(/_/g, " ")) + '</span>')
    .join("");
  document.getElementById("recipe-detail-meta").textContent =
    recipe.prep_minutes + " min prep · " + recipe.cook_minutes + " min cook · " +
    titleCase(recipe.difficulty) + " · " + recipe.servings + " serving" + (recipe.servings === 1 ? "" : "s");

  document.getElementById("recipe-detail-instructions").innerHTML =
    '<ol class="recipe-instructions-list">' + recipe.instructions.map((s) => "<li>" + s + "</li>").join("") + "</ol>";

  document.getElementById("recipe-fit-macros-target").value = "";
  document.getElementById("recipe-fit-macros-result").classList.add("hidden");
  document.getElementById("recipe-log-servings").textContent = "1";
  setActiveChip(document.getElementById("recipe-log-meal-chips"), state.recipeLogMealSlot);

  renderRecipeIngredients();
  recalcRecipeDetailTotals();
  showView("view-recipe-detail");
}

function computeRecipeTotals(recipe, overrides) {
  const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  recipe.ingredients.forEach((ing) => {
    const o = overrides[ing.id];
    let macroSource = ing;
    if (o && o.alt_name) {
      const match = ing.substitutions.find((s) => s.name === o.alt_name);
      if (match) macroSource = match;
    }
    const baseQty = ing.quantity || 1;
    const effQty = o && o.quantity ? o.quantity : baseQty;
    const scale = effQty / baseQty;
    ["calories", "protein_g", "carbs_g", "fat_g"].forEach((k) => { totals[k] += macroSource[k] * scale; });
  });
  return {
    calories: totals.calories / recipe.servings,
    protein_g: totals.protein_g / recipe.servings,
    carbs_g: totals.carbs_g / recipe.servings,
    fat_g: totals.fat_g / recipe.servings,
  };
}

function recalcRecipeDetailTotals() {
  const totals = computeRecipeTotals(state.selectedRecipe, state.recipeOverrides);
  document.getElementById("recipe-detail-calories").textContent = Math.round(totals.calories);
  document.getElementById("recipe-detail-protein").textContent = Math.round(totals.protein_g) + "g";
  document.getElementById("recipe-detail-carbs").textContent = Math.round(totals.carbs_g) + "g";
  document.getElementById("recipe-detail-fat").textContent = Math.round(totals.fat_g) + "g";
}

function renderRecipeIngredients() {
  const recipe = state.selectedRecipe;
  const wrap = document.getElementById("recipe-detail-ingredients");
  wrap.innerHTML = recipe.ingredients
    .map((ing) => {
      const o = state.recipeOverrides[ing.id];
      const currentName = o && o.alt_name ? o.alt_name : ing.name;
      const qty = o && o.quantity ? o.quantity : ing.quantity;
      const swapHint = ing.substitutions.length ? '<div class="swap-hint">Tap to swap' + (o && o.alt_name ? " · using " + currentName : "") + "</div>" : "";
      return (
        '<div class="recipe-ingredient-row"' + (ing.substitutions.length ? ' data-swap-id="' + ing.id + '" style="cursor:pointer;"' : "") + '>' +
        '<div class="top"><span class="name">' + currentName + '</span><span class="qty tnum">' + qty + " " + ing.unit + "</span></div>" +
        swapHint + "</div>"
      );
    })
    .join("");
  wrap.querySelectorAll("[data-swap-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = parseInt(row.dataset.swapId, 10);
      const ing = recipe.ingredients.find((i) => i.id === id);
      const options = [null].concat(ing.substitutions.map((s) => s.name));
      const idx = state.recipeSubIndex[id] || 0;
      const nextIdx = (idx + 1) % options.length;
      state.recipeSubIndex[id] = nextIdx;
      const alt = options[nextIdx];
      const existing = state.recipeOverrides[id] || {};
      if (alt) {
        state.recipeOverrides[id] = { ...existing, alt_name: alt };
      } else {
        delete existing.alt_name;
        if (Object.keys(existing).length) state.recipeOverrides[id] = existing;
        else delete state.recipeOverrides[id];
      }
      renderRecipeIngredients();
      recalcRecipeDetailTotals();
    });
  });
}

document.getElementById("btn-fit-macros").addEventListener("click", async () => {
  const target = parseFloat(document.getElementById("recipe-fit-macros-target").value);
  if (Number.isNaN(target) || target <= 0) {
    toast("Enter a target protein amount first");
    return;
  }
  const result = await api("/recipes/" + state.selectedRecipe.id + "/fit-macros", {
    method: "POST",
    body: JSON.stringify({ target_protein_g: target }),
  });
  const existing = state.recipeOverrides[result.ingredient_id] || {};
  state.recipeOverrides[result.ingredient_id] = { ...existing, quantity: result.new_quantity };
  renderRecipeIngredients();
  recalcRecipeDetailTotals();
  const resultEl = document.getElementById("recipe-fit-macros-result");
  resultEl.classList.remove("hidden");
  resultEl.textContent = result.ingredient_name + " scaled from " + result.old_quantity + " to " + result.new_quantity + " to hit " + target + "g protein.";
});

document.getElementById("btn-recipe-servings-minus").addEventListener("click", () => {
  state.recipeLogServings = Math.max(0.25, Math.round((state.recipeLogServings - 0.25) * 100) / 100);
  document.getElementById("recipe-log-servings").textContent = state.recipeLogServings;
});
document.getElementById("btn-recipe-servings-plus").addEventListener("click", () => {
  state.recipeLogServings = Math.round((state.recipeLogServings + 0.25) * 100) / 100;
  document.getElementById("recipe-log-servings").textContent = state.recipeLogServings;
});
document.getElementById("recipe-log-meal-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  state.recipeLogMealSlot = chip.dataset.val;
  setActiveChip(document.getElementById("recipe-log-meal-chips"), state.recipeLogMealSlot);
});

document.getElementById("btn-log-recipe").addEventListener("click", (e) => withButtonGuard(e.currentTarget, async () => {
  const overrides = Object.entries(state.recipeOverrides).map(([id, o]) => ({ ingredient_id: parseInt(id, 10), ...o }));
  await api("/recipes/" + state.selectedRecipe.id + "/log", {
    method: "POST",
    body: JSON.stringify({
      servings: state.recipeLogServings,
      meal_slot: state.recipeLogMealSlot || "snack",
      overrides: overrides,
      date: state.nutritionDate,
    }),
  });
  toast(state.selectedRecipe.name + " added");
  switchNutritionSegment("food");
  showView("view-food");
  loadFoodToday();
}));

document.getElementById("btn-add-recipe-to-cart").addEventListener("click", async () => {
  const result = await api("/shopping/from-recipe/" + state.selectedRecipe.id, {
    method: "POST",
    body: JSON.stringify({ multiplier: state.recipeLogServings }),
  });
  toast(result.ingredients_added + " ingredient" + (result.ingredients_added === 1 ? "" : "s") + " added to Smart Cart");
});

// -- smart cart --

const CART_CATEGORY_ORDER = ["protein", "produce", "fruit", "carbs", "fats", "dairy", "frozen", "snacks", "drinks", "pantry"];
const CART_CATEGORY_LABELS = {
  protein: "Protein", produce: "Produce", fruit: "Fruit", carbs: "Carbohydrates", fats: "Healthy Fats",
  dairy: "Dairy", frozen: "Frozen", pantry: "Pantry", snacks: "Snacks", drinks: "Drinks",
};

async function loadShoppingCart() {
  let data;
  try {
    data = await api("/shopping");
  } catch (e) {
    document.getElementById("cart-categories").innerHTML =
      '<div class="empty-note">Smart Cart unavailable right now. <button type="button" class="btn subtle small" id="btn-retry-cart" style="width:auto;">Retry</button></div>';
    document.getElementById("btn-retry-cart").addEventListener("click", loadShoppingCart);
    return;
  }
  document.getElementById("cart-cost").textContent = "$" + data.estimated_cost.toFixed(2);
  document.getElementById("cart-budget").textContent = data.budget != null ? "$" + data.budget.toFixed(2) : "—";
  document.getElementById("cart-item-count").textContent = data.item_count;
  document.getElementById("cart-household").textContent = data.household_size;

  const container = document.getElementById("cart-categories");
  if (!data.items.length) {
    container.innerHTML = '<div class="empty-note">Your cart is empty — add ingredients from a recipe, or add an item below.</div>';
  } else {
    const groups = {};
    data.items.forEach((i) => { (groups[i.category] = groups[i.category] || []).push(i); });
    container.innerHTML = CART_CATEGORY_ORDER.filter((c) => groups[c] && groups[c].length)
      .map((c) => (
        '<div class="set-group-label">' + CART_CATEGORY_LABELS[c] + '</div>' +
        '<div class="card tight">' + groups[c].map(renderCartItemRow).join("") + '</div>'
      ))
      .join("");
    wireCartItemRows(container);
  }

  await loadPantry();
}

function renderCartItemRow(item) {
  const priceStr = "$" + item.estimated_price.toFixed(2);
  return (
    '<div class="pr-row"><input type="checkbox" class="cart-item-check" data-itemid="' + item.id + '"' +
    (item.is_checked ? " checked" : "") + ' style="flex:none;margin-right:0.6rem;width:18px;height:18px;">' +
    '<div style="min-width:0;flex:1;' + (item.is_checked ? "opacity:0.5;text-decoration:line-through;" : "") + '">' +
    '<div class="name">' + item.name + (item.in_pantry ? ' <span class="badge neutral">Have it</span>' : "") + '</div>' +
    '<div class="date tnum">' + item.quantity + " " + item.unit + " · " + priceStr + (item.purpose ? " · " + item.purpose : "") + '</div></div>' +
    '<button class="set-delete-btn" data-itemid="' + item.id + '" aria-label="Remove item">×</button></div>'
  );
}

function wireCartItemRows(container) {
  container.querySelectorAll(".cart-item-check").forEach((cb) => {
    cb.addEventListener("change", async () => {
      await api("/shopping/items/" + cb.dataset.itemid, { method: "PATCH", body: JSON.stringify({ is_checked: cb.checked }) });
      loadShoppingCart();
    });
  });
  container.querySelectorAll(".set-delete-btn[data-itemid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/shopping/items/" + btn.dataset.itemid, { method: "DELETE" });
      toast("Removed");
      loadShoppingCart();
    });
  });
}

document.getElementById("cart-quick-actions").addEventListener("click", async (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const result = await api("/shopping/quick-action", { method: "POST", body: JSON.stringify({ action: chip.dataset.action }) });
  toast(result.affected + " item" + (result.affected === 1 ? "" : "s") + " updated");
  loadShoppingCart();
});

document.getElementById("btn-add-cart-item").addEventListener("click", async () => {
  const input = document.getElementById("cart-manual-item-input");
  const name = input.value.trim();
  if (!name) {
    toast("Enter an item name");
    return;
  }
  await api("/shopping/items", { method: "POST", body: JSON.stringify({ name: name, quantity: 1, unit: "unit" }) });
  input.value = "";
  loadShoppingCart();
});

async function loadPantry() {
  const list = document.getElementById("pantry-list");
  let data;
  try {
    data = await api("/pantry");
  } catch (e) {
    list.innerHTML = '<div class="empty-note">Pantry unavailable right now.</div>';
    return;
  }
  if (!data.items.length) {
    list.innerHTML = '<div class="empty-note">Nothing saved.</div>';
    return;
  }
  list.innerHTML = data.items
    .map((p) => (
      '<div class="pr-row"><span class="name">' + p.name + '</span>' +
      '<button class="set-delete-btn" data-pantryid="' + p.id + '" aria-label="Remove">×</button></div>'
    ))
    .join("");
  list.querySelectorAll("[data-pantryid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/pantry/" + btn.dataset.pantryid, { method: "DELETE" });
      loadShoppingCart();
    });
  });
}

document.getElementById("btn-add-pantry-item").addEventListener("click", async () => {
  const input = document.getElementById("pantry-item-input");
  const name = input.value.trim();
  if (!name) {
    toast("Enter an item name");
    return;
  }
  await api("/pantry", { method: "POST", body: JSON.stringify({ name: name }) });
  input.value = "";
  loadShoppingCart();
});

// -------------------------------------------------------------- progress ----

async function loadProgress() {
  if (!state.exercises.length) state.exercises = await api("/exercises");
  const select = document.getElementById("progress-exercise-select");
  if (!select.dataset.wired) {
    select.innerHTML = state.exercises.map((e) => '<option value="' + e.id + '">' + e.name + "</option>").join("");
    const bench = state.exercises.find((e) => e.name.indexOf("Bench") !== -1);
    if (bench) select.value = bench.id;
    select.addEventListener("change", () => renderProgressChart(select.value));
    select.dataset.wired = "1";
  }
  await renderProgressChart(select.value);
  await renderPRs();
}

function renderProgressStatRow(data) {
  const row = document.getElementById("progress-stat-row");
  const trendIcon = data.trend === "up"
    ? '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor"><path d="M3 14L7.5 9L11 12L17 5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 5H17V9.5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : data.trend === "down"
    ? '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor"><path d="M3 6L7.5 11L11 8L17 15" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 15H17V10.5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor"><path d="M3 10H17" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const trendLabel = data.trend === "up" ? "Up" : data.trend === "down" ? "Down" : "Flat";
  const stat = (icon, value, label) =>
    '<div class="stat-tile" style="text-align:center;"><div class="icon-circle sm" style="margin:0 auto 0.4rem;">' + icon + "</div>" +
    '<div class="value tnum" style="font-size:0.95rem;">' + value + "</div><div class=\"label\" style=\"text-transform:none;font-weight:500;\">" + label + "</div></div>";
  row.innerHTML =
    stat(GOAL_KIND_ICONS.consistency, data.consistency_pct + "%", "Consistency") +
    stat(CHECK_SVG.replace('viewBox="0 0 20 20"', 'viewBox="0 0 20 20" width="15" height="15"'), data.best_lift_kg != null ? fmtWeight(data.best_lift_kg) : "—", "Best Lift") +
    stat(trendIcon, trendLabel, "Trend");
}

async function renderProgressChart(exerciseId) {
  document.getElementById("chart-kicker").textContent = "1RM Estimate";
  const data = await api("/progress/strength/" + exerciseId);
  const svg = document.getElementById("prog-chart");
  const emptyNote = document.getElementById("chart-empty");
  svg.innerHTML = "";

  const trendBadge = document.getElementById("chart-trend-badge");
  const heroValue = document.getElementById("chart-hero-value");
  const heroUnit = document.getElementById("chart-hero-unit");

  if (!data.points.length) {
    emptyNote.classList.remove("hidden");
    heroValue.textContent = "—";
    heroUnit.textContent = "";
    trendBadge.classList.add("hidden");
    document.getElementById("progress-stat-row").innerHTML = "";
    return;
  }
  emptyNote.classList.add("hidden");
  data.points.forEach((p) => { p.est_1rm_display = kgToDisplay(p.est_1rm_kg); });

  heroValue.textContent = data.points[data.points.length - 1].est_1rm_display;
  heroUnit.textContent = weightUnit();
  if (data.pct_change_28d != null) {
    trendBadge.classList.remove("hidden");
    trendBadge.className = "badge " + (data.pct_change_28d > 0 ? "success" : data.pct_change_28d < 0 ? "warn" : "neutral");
    trendBadge.textContent = (data.pct_change_28d > 0 ? "▲ " : data.pct_change_28d < 0 ? "▼ " : "") + Math.abs(data.pct_change_28d) + "% vs 4wk ago";
  } else {
    trendBadge.classList.add("hidden");
  }
  renderProgressStatRow(data);

  const W = 280, H = 120;
  const values = data.points.map((p) => p.est_1rm_display);
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const pad = (max - min) * 0.15 || 5;
  const yMin = min - pad, yMax = max + pad;
  const n = data.points.length;
  const xFor = (i) => (n === 1 ? W : (i / (n - 1)) * W);
  const yFor = (v) => H - ((v - yMin) / (yMax - yMin)) * H;

  const coords = data.points.map((p, i) => [xFor(i), yFor(p.est_1rm_display)]);
  const linePath = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  const areaPath = linePath + " L" + W + "," + H + " L0," + H + " Z";

  svg.innerHTML =
    '<line x1="0" y1="20" x2="' + W + '" y2="20" stroke="var(--border)" stroke-width="1"/>' +
    '<line x1="0" y1="60" x2="' + W + '" y2="60" stroke="var(--border)" stroke-width="1"/>' +
    '<line x1="0" y1="100" x2="' + W + '" y2="100" stroke="var(--border)" stroke-width="1"/>' +
    '<defs><linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="var(--brand)" stop-opacity="0.22"/>' +
    '<stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + areaPath + '" fill="url(#areaFade)" stroke="none"/>' +
    '<path d="' + linePath + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + coords[n - 1][0] + '" cy="' + coords[n - 1][1] + '" r="5" fill="var(--brand)" stroke="var(--surface)" stroke-width="2"/>';

  const tip = document.getElementById("chart-tip");
  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0, bestDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c[0] - x);
      if (d < bestDist) { bestDist = d; nearest = i; }
    });
    const px = (coords[nearest][0] / W) * rect.width;
    const py = (coords[nearest][1] / H) * rect.height;
    tip.style.left = px + "px";
    tip.style.top = py + "px";
    tip.textContent = data.points[nearest].date + " · " + data.points[nearest].est_1rm_display + weightUnit();
    tip.style.opacity = "1";
  };
  svg.onmouseleave = () => { tip.style.opacity = "0"; };
}

function pictogramForExerciseName(name) {
  if (/bench|press/i.test(name)) return PICTOGRAMS.bench;
  if (/deadlift|row|pull/i.test(name)) return PICTOGRAMS.deadlift;
  if (/squat|leg/i.test(name)) return PICTOGRAMS.squat;
  if (/pace|run/i.test(name)) return PICTOGRAMS.running;
  return PICTOGRAMS.fullbody;
}

async function renderPRs(limit) {
  const data = await api("/prs?limit=" + (limit || 10));
  const el = document.getElementById("pr-list");
  if (!data.prs.length) {
    el.innerHTML = '<div class="empty-note">Nothing logged yet.</div>';
    return;
  }
  el.innerHTML = data.prs
    .map((p) => {
      const val = p.est_1rm_kg != null ? fmtWeight(p.est_1rm_kg) : p.pace_per_km + " /km";
      const delta = p.delta_kg ? '<div class="date" style="color:var(--success-text);">▲ ' + fmtWeight(Math.abs(p.delta_kg)) + "</div>" : "";
      return (
        '<div class="pr-row"><div style="display:flex;align-items:center;gap:0.65rem;min-width:0;">' +
        '<div class="icon-circle sm" style="flex:none;background:var(--ink);color:var(--brand);">' + pictogramForExerciseName(p.exercise) + "</div>" +
        '<div style="min-width:0;"><div class="name">' + p.exercise + '</div><div class="date">1RM · ' + p.date + "</div></div></div>" +
        '<div style="text-align:right;flex:none;"><div class="val">' + val + "</div>" + delta + "</div></div>"
      );
    })
    .join("");
}

document.getElementById("btn-prs-view-all").addEventListener("click", () => renderPRs(30));

// --------------------------------------------------------------- program ----

const GOAL_LABELS = {
  strength: "Build strength", hypertrophy: "Build a muscular, athletic physique",
  endurance: "Improve endurance", general_fitness: "General fitness", fat_loss: "Lose fat",
};
const GOAL_STATUS_LABELS = { improving: "Improving", stable: "Stable", declining: "Needs attention" };
const PROGRESS_STATUS_LABELS = { ahead: "Ahead of Schedule", on_track: "On Track", behind: "Slightly Behind" };

function fmtGoalValue(v, unit) {
  if (unit === "kg") return fmtWeight(v); // canonical storage is kg; respect the user's display-unit preference
  const n = Number.isInteger(v) ? v : Math.round(v * 10) / 10;
  return n + (unit ? " " + unit : "");
}

const PROGRAM_TODAY_ICONS = {
  lift: '<svg viewBox="0 0 20 20" fill="none"><path d="M2 10H4M16 10H18M4 10H16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="4.5" y="7" width="2.2" height="6" rx="1.1" fill="currentColor"/><rect x="13.3" y="7" width="2.2" height="6" rx="1.1" fill="currentColor"/></svg>',
  run: '<svg viewBox="0 0 20 20" fill="none"><circle cx="13" cy="4.5" r="1.5" fill="currentColor"/><path d="M9 8L12 9.5L11 13L14 15.5M9 8L6.5 10.5L8 12.5M9 8L11 6.5M6.5 10.5L4 11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rest: '<svg viewBox="0 0 20 20" fill="none"><path d="M15.5 11.5A6 6 0 118.5 4.5a5 5 0 007 7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  person: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M4 17C4 13.6863 6.68629 11 10 11C13.3137 11 16 13.6863 16 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

function renderProgramToday(today, progressStatus) {
  const card = document.getElementById("program-today-card");
  const reasoning = (today.reasoning || []).join(" ");
  const p = today.prescription;
  const statusLabel = PROGRESS_STATUS_LABELS[progressStatus] || "On Track";
  const statusCls = progressStatus === "behind" ? "warn" : "success";
  const statusIcon = progressStatus === "behind"
    ? '<svg viewBox="0 0 20 20" width="11" height="11" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M10 6.5V10.5L12.5 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    : CHECK_SVG.replace('viewBox="0 0 20 20"', 'viewBox="0 0 20 20" width="11" height="11"');
  const badge = '<span class="badge ' + statusCls + '">' + statusLabel + " " + statusIcon + "</span>";

  const head = (icon, title, meta) => (
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.6rem;">' +
    '<div style="display:flex;gap:0.75rem;align-items:flex-start;min-width:0;">' +
    '<div class="icon-circle md">' + icon + "</div>" +
    '<div style="min-width:0;">' +
    '<span class="kicker" style="margin-bottom:0.15rem;">Today\'s Workout</span>' +
    '<div style="font-weight:700;font-size:1.02rem;">' + title + "</div>" +
    (meta ? '<div class="tnum" style="font-size:0.78rem;color:var(--neutral-2);margin-top:0.2rem;">' + meta + "</div>" : "") +
    "</div></div>" + badge + "</div>"
  );

  if (today.session_type === "lift") {
    const estMin = Math.max(15, Math.round((p.exercises.reduce((s, e) => s + e.sets * 2.5, 0)) / 5) * 5);
    card.innerHTML =
      head(PROGRAM_TODAY_ICONS.lift, p.label || "Lift", "Est. " + estMin + " min · " + p.exercises.length + " exercise" + (p.exercises.length === 1 ? "" : "s")) +
      '<div class="tnum" style="font-size:0.8rem;color:var(--neutral);margin-top:0.75rem;line-height:1.5;">' + p.exercises.map((e) => e.name).join(" · ") + "</div>" +
      '<div style="font-size:0.76rem;color:var(--neutral-2);font-style:italic;margin-top:0.55rem;">“' + reasoning + "”</div>" +
      '<div class="btn-row" style="margin-top:0.9rem;">' +
      '<button class="btn outline" id="btn-program-view-workout">View Workout</button>' +
      '<button class="btn primary" id="btn-program-start-workout">Start Workout →</button>' +
      "</div>";
  } else if (today.session_type === "run") {
    card.innerHTML =
      head(PROGRAM_TODAY_ICONS.run, labelForRunType(p.run_type), p.duration_min + " min · Zone " + p.zone) +
      '<div style="font-size:0.76rem;color:var(--neutral-2);font-style:italic;margin-top:0.55rem;">“' + reasoning + "”</div>" +
      '<div class="btn-row" style="margin-top:0.9rem;">' +
      '<button class="btn outline" id="btn-program-view-workout">View Workout</button>' +
      '<button class="btn primary" id="btn-program-start-workout">Start Run →</button>' +
      "</div>";
  } else {
    card.innerHTML =
      head(PROGRAM_TODAY_ICONS.rest, p.note || "Rest day", null) +
      '<div style="font-size:0.76rem;color:var(--neutral-2);font-style:italic;margin-top:0.55rem;">“' + reasoning + "”</div>";
  }

  const viewBtn = document.getElementById("btn-program-view-workout");
  const startBtn = document.getElementById("btn-program-start-workout");
  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      switchProgramSegment("schedule");
      const todayRow = document.querySelector('#program-week-list [data-day-idx].expanded, #program-week-list .day-row');
      const idx = state.programWeek ? state.programWeek.findIndex((d) => d.is_today) : -1;
      const detail = idx >= 0 ? document.getElementById("program-day-detail-" + idx) : null;
      if (detail) {
        document.querySelectorAll(".day-detail").forEach((el) => el.classList.add("hidden"));
        document.querySelectorAll(".day-row").forEach((el) => el.classList.remove("expanded"));
        detail.classList.remove("hidden");
        detail.closest(".card").querySelector(".day-row").classList.add("expanded");
      }
    });
  }
  if (startBtn) {
    startBtn.addEventListener("click", () => { showView("view-log"); loadLogChooser(); });
  }
}

function renderProgramWeek(week) {
  const list = document.getElementById("program-week-list");
  list.innerHTML = week
    .map((d, i) => {
      const dayName = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
      const nameColor = d.is_today ? "color:var(--brand-dark);" : "";
      const hasDetail = d.exercises.length > 0 || d.run || d.mobility_items.length > 0 || d.conditioning_items.length > 0 || d.note;
      let detailHtml = "";
      if (d.exercises.length) {
        detailHtml = d.exercises.map((e) => '<div class="exercise-line">' + e.name + " — " + e.sets + " sets × " + e.reps + " reps</div>").join("");
      } else if (d.run) {
        detailHtml = '<div class="exercise-line">' + labelForRunType(d.run.run_type) + " — " + d.run.duration_min + " min · Zone " + d.run.zone + "</div>";
      }
      if (d.mobility_items.length) {
        detailHtml += d.mobility_items.map((m) => '<div class="exercise-line">' + m + "</div>").join("");
      }
      if (d.conditioning_items.length) {
        detailHtml += d.conditioning_items.map((c) => '<div class="exercise-line" style="opacity:0.8;">' + c + "</div>").join("");
      }
      if (d.note) {
        detailHtml += '<div class="exercise-line" style="font-style:italic;opacity:0.75;margin-top:0.3rem;">' + d.note + "</div>";
      }
      return (
        '<div class="card tight">' +
        '<div class="pr-row day-row" style="border-bottom:none;"' + (hasDetail ? ' data-day-idx="' + i + '"' : "") + '>' +
        '<span class="name" style="' + nameColor + '">' + dayName + " — " + d.label + (d.is_today ? " · Today" : "") + "</span>" +
        '<span style="display:flex;align-items:center;gap:0.4rem;">' +
        '<span class="badge neutral" style="font-size:0.62rem;">' + labelShort(d.day_type) + "</span>" +
        (hasDetail ? '<span class="chevron">›</span>' : "") +
        "</span></div>" +
        (hasDetail ? '<div class="day-detail hidden" id="program-day-detail-' + i + '">' + detailHtml + "</div>" : "") +
        "</div>"
      );
    })
    .join("");

  list.querySelectorAll("[data-day-idx]").forEach((row) => {
    const detail = document.getElementById("program-day-detail-" + row.dataset.dayIdx);
    row.addEventListener("click", () => {
      const wasHidden = detail.classList.contains("hidden");
      list.querySelectorAll(".day-detail").forEach((el) => el.classList.add("hidden"));
      list.querySelectorAll(".day-row").forEach((el) => el.classList.remove("expanded"));
      if (wasHidden) {
        detail.classList.remove("hidden");
        row.classList.add("expanded");
      }
    });
  });
}

function renderProgramGoals(goals) {
  const list = document.getElementById("program-goals-list");
  if (!goals.length) {
    list.innerHTML = '<div class="empty-note">No goals set yet.</div>';
    return;
  }
  list.innerHTML = goals
    .map((g) => {
      const pct = g.progress_pct != null ? g.progress_pct : 0;
      const valueLine = g.current_value != null && g.target_value != null
        ? fmtGoalValue(g.current_value, g.unit) + " → " + fmtGoalValue(g.target_value, g.unit) + " · "
        : "";
      return (
        '<div class="card tight" style="margin-bottom:0.6rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
        '<span style="font-size:0.85rem;font-weight:600;">' + g.title + "</span>" +
        '<span class="badge neutral" style="font-size:0.62rem;">' + (GOAL_STATUS_LABELS[g.status] || "Stable") + "</span></div>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;"></div></div>' +
        '<div class="tnum" style="font-size:0.75rem;color:var(--neutral-2);margin-top:0.35rem;">' + valueLine + pct + "% there</div>" +
        "</div>"
      );
    })
    .join("");
}

async function loadProgram() {
  const data = await api("/program");
  const id = data.identity;

  document.getElementById("program-week-title").textContent = "Week " + id.current_week + " of " + id.total_weeks;
  document.getElementById("program-week-title-2").textContent = "Week " + id.current_week + " of " + id.total_weeks;
  document.getElementById("program-name").textContent = id.program_name;
  document.getElementById("program-name-2").textContent = id.program_name;
  document.getElementById("program-phase-line").textContent = titleCase(id.focus) + " Focus";
  document.getElementById("program-phase-line-2").textContent = "Week " + id.current_week + " of " + id.total_weeks + " — " + id.focus + " phase";
  document.getElementById("program-primary-goal").textContent = GOAL_LABELS[id.primary_goal] || id.primary_goal;

  const secWrap = document.getElementById("program-secondary-goals-wrap");
  if (id.secondary_goals.length) {
    secWrap.classList.remove("hidden");
    document.getElementById("program-secondary-goals").textContent = id.secondary_goals.join(" · ");
  } else {
    secWrap.classList.add("hidden");
  }

  const days = id.days_to_reassessment;
  document.getElementById("program-reassessment").textContent =
    "Next reassessment " + (days <= 0 ? "today" : "in " + days + " day" + (days === 1 ? "" : "s"));

  const deloadCard = document.getElementById("deload-card");
  if (id.deload_week) {
    deloadCard.classList.remove("hidden");
    document.getElementById("deload-week-badge").textContent = "Week " + id.deload_week;
  } else {
    deloadCard.classList.add("hidden");
  }

  const p = data.progress;
  document.getElementById("progress-completion-pct").textContent = p.completion_pct + "%";
  document.getElementById("progress-completion-bar").style.width = p.completion_pct + "%";
  document.getElementById("progress-workouts").textContent = p.workouts_completed + " / " + p.workouts_planned_to_date;
  document.getElementById("progress-adherence").textContent = p.weekly_adherence_pct + "%";
  document.getElementById("progress-streak").textContent = p.streak;
  const statusBadge = document.getElementById("progress-status-badge");
  statusBadge.textContent = PROGRESS_STATUS_LABELS[p.status] || "On Track";
  statusBadge.className = "badge " + (p.status === "behind" ? "warn" : "success");

  state.programWeek = data.week;
  renderProgramToday(data.today, p.status);
  renderProgramWeek(data.week);
  renderProgramDayStrip(data.week);
  renderProgramGoals(data.goals);
  renderProgramGoalSummary(data.goals);

  const obsCard = document.getElementById("program-observations-card");
  obsCard.innerHTML = data.coach_observations.length
    ? data.coach_observations.map((o) => '<div class="observation-row"><span class="dot"></span><span>' + o + "</span></div>").join("")
    : '<div class="empty-note">Nothing notable yet — keep logging and patterns will show up here.</div>';

  loadProgressPhotos();
  loadCoachChat();
}

function switchProgramSegment(segment) {
  document.querySelectorAll("#program-segmented-tabs .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.segment === segment));
  document.querySelectorAll(".program-segment").forEach((el) => el.classList.toggle("hidden", el.dataset.segment !== segment));
}
document.getElementById("program-segmented-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (btn) switchProgramSegment(btn.dataset.segment);
});
document.querySelectorAll("[data-goto-segment]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchProgramSegment(btn.dataset.gotoSegment);
    if (btn.dataset.gotoSegment === "coach") document.getElementById("chat-input").focus();
  });
});

function renderProgramDayStrip(week) {
  const el = document.getElementById("program-day-strip");
  el.innerHTML = week
    .map((d) => {
      const dname = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3).toUpperCase();
      const cls = "day-strip-item" + (d.is_today ? " today" : "") + (d.is_completed ? " done" : "");
      const dot = d.is_completed ? '<div class="ddot">' + CHECK_SVG + "</div>" : '<div class="ddot"><span class="pip"></span></div>';
      return '<div class="' + cls + '"><div class="dname">' + dname + '</div><div class="dlabel">' + d.label + "</div>" + dot + "</div>";
    })
    .join("");
}

const GOAL_KIND_ICONS = {
  strength: PROGRAM_TODAY_ICONS.lift,
  endurance: PROGRAM_TODAY_ICONS.run,
  consistency: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 2.5C10 2.5 6.5 6 6.5 10a3.5 3.5 0 007 0c0-1-.4-1.8-1-2.5.3 1.4-.6 2-1.2 1.5.6-2-1-4-1.3-6.5z" fill="currentColor"/></svg>',
  custom: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>',
};

function renderProgramGoalSummary(goals) {
  const row = document.getElementById("program-goal-summary-row");
  if (!goals.length) {
    row.innerHTML = '<div class="empty-note">No goals set yet.</div>';
    return;
  }
  row.innerHTML = goals
    .slice(0, 3)
    .map((g) => {
      const icon = GOAL_KIND_ICONS[g.kind] || GOAL_KIND_ICONS.custom;
      const spark = g.start_value != null && g.current_value != null ? sparklineSvg([g.start_value, g.current_value], { width: 92, height: 26 }) : "";
      const valueLine = g.current_value != null ? fmtGoalValue(g.current_value, g.unit) : "—";
      const targetLine = g.target_value != null ? "Target " + fmtGoalValue(g.target_value, g.unit) : "";
      return (
        '<div class="sparkline-card">' +
        '<div class="sk-head"><span class="icon-circle sm">' + icon + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(g.title) + "</span></div>" +
        '<div class="sk-value tnum">' + valueLine + "</div>" +
        '<div class="sk-target tnum">' + targetLine + "</div>" +
        spark +
        "</div>"
      );
    })
    .join("");
}

// --------------------------------------------------------------- progress photos ----

let progressPhotos = [];

async function loadProgressPhotos() {
  progressPhotos = await api("/progress/photos");
  renderProgressPhotos();
}

function renderProgressPhotos() {
  const row = document.getElementById("photo-scroll-row");
  const addTile = '<button class="photo-add-tile" onclick="document.getElementById(\'photo-file-input\').click()">+</button>';
  if (!progressPhotos.length) {
    row.innerHTML = addTile;
    document.getElementById("photo-detail-card").classList.add("hidden");
    return;
  }
  row.innerHTML =
    progressPhotos
      .map((p, i) => {
        const d = new Date(p.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          '<button class="photo-thumb" onclick="showPhotoDetail(' + i + ')">' +
          '<img src="' + p.url + '" alt="Progress photo ' + d + '">' +
          '<span class="date-chip">' + d + "</span></button>"
        );
      })
      .join("") + addTile;
}

function showPhotoDetail(index) {
  const p = progressPhotos[index];
  const card = document.getElementById("photo-detail-card");
  const d = new Date(p.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  card.classList.remove("hidden");
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
    '<div style="font-weight:600;font-size:0.9rem;">' + d + "</div>" +
    '<button class="btn danger small" onclick="deleteProgressPhoto(' + p.id + ')">Delete</button></div>' +
    (p.note ? '<div style="font-size:0.82rem;margin-top:0.4rem;">' + p.note + "</div>" : "") +
    '<div style="font-size:0.78rem;color:var(--neutral-2);margin-top:0.6rem;font-style:italic;">' +
    (p.ai_impression || "No AI impression available for this photo (local vision model not running).") +
    "</div>";
}

async function deleteProgressPhoto(id) {
  await api("/progress/photos/" + id, { method: "DELETE" });
  document.getElementById("photo-detail-card").classList.add("hidden");
  loadProgressPhotos();
}

async function uploadProgressPhotoBlob(blob, filename) {
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("date", new Date().toISOString().slice(0, 10));
  const res = await fetch(API + "/progress/photos", { method: "POST", body: formData });
  if (!res.ok) {
    alert("Couldn't upload that photo. " + (await res.text()));
    return;
  }
  await loadProgressPhotos();
}

async function onPhotoFileSelected(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  await uploadProgressPhotoBlob(file, file.name);
}

// -- Take Photo: live camera capture. Requesting getUserMedia() is what
// actually triggers the browser's own camera-permission prompt -- there's no
// separate "ask permission" call, the prompt appears as a side effect of this
// request, and its outcome (granted/denied/no camera) is handled below.
let cameraStream = null;

async function openCameraCapture() {
  document.getElementById("camera-overlay").classList.remove("hidden");
  const note = document.getElementById("camera-permission-note");
  const video = document.getElementById("camera-video");
  const captureBtn = document.getElementById("camera-capture-btn");
  note.classList.add("hidden");
  captureBtn.classList.remove("hidden");
  video.classList.remove("hidden");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    note.textContent = "Camera access isn't available in this browser. Use \"Choose from Library\" instead.";
    note.classList.remove("hidden");
    video.classList.add("hidden");
    captureBtn.classList.add("hidden");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = cameraStream;
  } catch (err) {
    // NotAllowedError = user denied the permission prompt (or blocked previously);
    // NotFoundError = no camera device present. Either way, fail into the
    // library picker rather than leaving a dead camera screen.
    note.textContent =
      err.name === "NotAllowedError"
        ? "Camera access was denied. Enable it in your browser's site settings to take photos directly, or choose from your library instead."
        : "Couldn't access a camera on this device. Choose from your library instead.";
    note.classList.remove("hidden");
    video.classList.add("hidden");
    captureBtn.classList.add("hidden");
  }
}

function closeCameraCapture() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  document.getElementById("camera-video").srcObject = null;
  document.getElementById("camera-overlay").classList.add("hidden");
}

function captureCameraPhoto() {
  const video = document.getElementById("camera-video");
  const canvas = document.getElementById("camera-canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(async (blob) => {
    closeCameraCapture();
    if (blob) await uploadProgressPhotoBlob(blob, "camera-photo.jpg");
  }, "image/jpeg", 0.9);
}

// --------------------------------------------------------------- Ask Toci chat ----

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function loadCoachChat() {
  const messages = await api("/coach/chat");
  renderChatMessages(messages);
  renderCoachNotesCard(messages);
}

function renderCoachNotesCard(messages) {
  const card = document.getElementById("program-coach-notes-card");
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) {
    card.innerHTML =
      '<div style="display:flex;gap:0.7rem;align-items:flex-start;">' +
      '<div class="icon-circle sm" style="flex:none;">' + PROGRAM_TODAY_ICONS.person + "</div>" +
      '<div class="empty-note" style="padding:0;">Ask Toci a question about your program and its replies will show up here.</div>' +
      "</div>";
    return;
  }
  card.innerHTML =
    '<div style="display:flex;gap:0.7rem;align-items:flex-start;">' +
    '<div class="icon-circle sm" style="flex:none;">' + PROGRAM_TODAY_ICONS.person + "</div>" +
    '<div style="min-width:0;">' +
    '<div style="font-size:0.85rem;line-height:1.42;">' + escapeHtml(lastAssistant.content) + "</div>" +
    '<div style="font-size:0.75rem;color:var(--brand);font-weight:700;margin-top:0.45rem;">Coach Toci</div>' +
    "</div></div>";
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderChatMessages(messages) {
  const el = document.getElementById("chat-messages");
  if (!messages.length) {
    el.innerHTML = '<div class="empty-note">Ask about your program — e.g. "give me a bit more pull volume" or "swap Friday for something easier."</div>';
  } else {
    el.innerHTML = messages
      .map((m) => '<div class="chat-bubble ' + m.role + '">' + escapeHtml(m.content) + "</div>")
      .join("");
  }
  el.scrollTop = el.scrollHeight;

  const pending = [...messages].reverse().find((m) => m.proposal_status === "pending");
  if (pending) {
    renderProposalCard(pending.id, pending.proposal);
  } else {
    document.getElementById("chat-proposal-card").classList.add("hidden");
  }
}

function renderProposalCard(messageId, proposal) {
  const card = document.getElementById("chat-proposal-card");
  card.classList.remove("hidden");
  const rows = [...proposal.days]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => '<div class="proposal-day-row"><span class="day">' + WEEKDAY_NAMES[d.weekday] + "</span><span>" + escapeHtml(d.label) + "</span></div>")
    .join("");
  card.innerHTML =
    '<div style="font-weight:600;font-size:0.85rem;margin-bottom:0.4rem;">Proposed program</div>' +
    rows +
    '<div class="btn-row" style="margin-top:0.7rem;">' +
    '<button class="btn primary small" onclick="applyChatProposal(' + messageId + ')">Apply</button>' +
    '<button class="btn gray small" onclick="discardChatProposal(' + messageId + ')">Discard</button>' +
    "</div>";
}

async function sendCoachChat() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  document.getElementById("chat-send-btn").disabled = true;
  try {
    await api("/coach/chat", { method: "POST", body: JSON.stringify({ message }) });
    await loadCoachChat();
  } finally {
    document.getElementById("chat-send-btn").disabled = false;
  }
}

async function applyChatProposal(messageId) {
  try {
    await api("/coach/chat/" + messageId + "/apply", { method: "POST" });
    toast("Program updated");
    await loadProgram();
  } catch (err) {
    alert("Couldn't apply that: " + err.message);
  }
}

async function discardChatProposal(messageId) {
  await api("/coach/chat/" + messageId + "/discard", { method: "POST" });
  await loadCoachChat();
}

async function clearCoachChat() {
  await api("/coach/chat", { method: "DELETE" });
  await loadCoachChat();
}

// --------------------------------------------------------------- settings ----

function setNotifToggle(btn, on) {
  btn.textContent = on ? "On" : "Off";
  btn.classList.toggle("subtle", on);
  btn.classList.toggle("gray", !on);
  btn.dataset.on = on ? "1" : "0";
}

async function loadSettings() {
  const data = await api("/settings");
  state.units = data.units;
  state.settings = data;

  document.getElementById("set-input-name").value = data.name || "";
  document.getElementById("set-input-age").value = data.age ?? "";
  document.getElementById("height-unit-label").textContent = heightUnit();
  document.getElementById("set-input-height").value = data.height_cm != null ? cmToDisplay(data.height_cm) : "";
  document.getElementById("set-input-goal").value = data.goal;
  document.getElementById("set-input-experience").value = data.experience_level;
  document.getElementById("set-input-equipment").value = data.equipment;

  document.getElementById("set-weight-unit-label").textContent = weightUnit();
  document.getElementById("set-weight-unit-label-2").textContent = weightUnit();
  document.getElementById("set-input-goal-weight").value = data.goal_weight_kg != null ? kgToDisplay(data.goal_weight_kg) : "";
  document.getElementById("set-input-goal-pace").value = data.goal_pace_key || "lose_1";
  document.getElementById("set-input-activity").value = data.activity_level || "active";
  document.getElementById("set-current-weight-display").textContent = data.current_weight_kg != null ? fmtWeight(data.current_weight_kg) : "Not logged yet";
  document.querySelectorAll("#set-sex-chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.val === (data.sex || "male")));
  document.getElementById("set-calorie-goal-display").textContent = data.daily_calorie_goal_kcal != null ? Math.round(data.daily_calorie_goal_kcal) + " kcal" : "Not set yet";

  const initial = (data.name || "?").trim().charAt(0).toUpperCase();
  document.getElementById("btn-avatar").textContent = initial;
  document.getElementById("profile-avatar-lg").textContent = initial;
  document.getElementById("profile-name-lg").textContent = data.name || "—";
  document.getElementById("profile-age").textContent = data.age ?? "—";
  document.getElementById("profile-age-sub").textContent = data.age != null ? "years" : "";
  if (data.height_cm != null) {
    if (state.units === "imperial") {
      const totalIn = data.height_cm / 2.54;
      const ft = Math.floor(totalIn / 12), inch = Math.round(totalIn % 12);
      document.getElementById("profile-height").textContent = ft + "'" + inch + '"';
    } else {
      document.getElementById("profile-height").textContent = Math.round(data.height_cm);
    }
    document.getElementById("profile-height-sub").textContent = state.units === "imperial" ? Math.round(data.height_cm) + " cm" : "cm";
  } else {
    document.getElementById("profile-height").textContent = "—";
    document.getElementById("profile-height-sub").textContent = "";
  }
  document.getElementById("profile-weight").textContent = data.current_weight_kg != null ? kgToDisplay(data.current_weight_kg) : "—";
  document.getElementById("profile-weight-unit").textContent = weightUnit();
  document.getElementById("profile-goal-label").textContent = GOAL_LABELS[data.goal] || titleCase(data.goal);

  setNotifToggle(document.getElementById("toggle-premium"), data.is_premium);

  document.querySelectorAll("#units-chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.val === data.units));

  setNotifToggle(document.getElementById("toggle-notif-daily"), data.notif_daily_recommendation);
  setNotifToggle(document.getElementById("toggle-notif-readiness"), data.notif_readiness_alerts);

  const injuryList = document.getElementById("injury-list");
  if (!data.injuries.length) {
    injuryList.innerHTML = '<div class="empty-note">None active.</div>';
  } else {
    injuryList.innerHTML = data.injuries
      .map((i) => {
        const note = i.description ? " — " + i.description : "";
        return '<div class="set-row"><span class="k">' + titleCase(i.body_region) + note + '</span>' +
          '<span class="v"><button class="btn small danger" data-injid="' + i.id + '">Remove</button></span></div>';
      })
      .join("");
    injuryList.querySelectorAll("[data-injid]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api("/injuries/" + btn.dataset.injid, { method: "DELETE" });
        toast("Injury removed");
        loadSettings();
        loadToday();
      });
    });
  }

  renderDietPreferenceChips(data.dietary_preferences || []);
  renderFoodRestrictionChips(data.food_restrictions || []);

  document.getElementById("set-input-shopping-budget").value = data.shopping_weekly_budget != null ? data.shopping_weekly_budget : "";
  state.householdSize = data.household_size || 1;
  document.getElementById("set-household-size-display").textContent = state.householdSize;

  await loadSpotifySettings();
  await loadWhoopSettings();
}

document.getElementById("btn-household-minus").addEventListener("click", () => {
  state.householdSize = Math.max(1, state.householdSize - 1);
  document.getElementById("set-household-size-display").textContent = state.householdSize;
});
document.getElementById("btn-household-plus").addEventListener("click", () => {
  state.householdSize = Math.min(12, state.householdSize + 1);
  document.getElementById("set-household-size-display").textContent = state.householdSize;
});

document.getElementById("btn-save-shopping-settings").addEventListener("click", async () => {
  const budgetVal = document.getElementById("set-input-shopping-budget").value;
  await api("/settings", {
    method: "PATCH",
    body: JSON.stringify({
      household_size: state.householdSize,
      shopping_weekly_budget: budgetVal ? parseFloat(budgetVal) : null,
    }),
  });
  toast("Smart Cart settings saved");
});

function renderDietPreferenceChips(selected) {
  document.querySelectorAll("#diet-preference-chips .chip").forEach((c) => {
    c.classList.toggle("active", selected.includes(c.dataset.val));
  });
}

// ------------------------------------------------------------------- profile ----

function switchProfileSegment(segment) {
  document.querySelectorAll("#profile-segmented-tabs .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.pseg === segment));
  document.querySelectorAll(".profile-segment").forEach((el) => el.classList.toggle("hidden", el.dataset.pseg !== segment));
}
document.getElementById("profile-segmented-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (btn) switchProfileSegment(btn.dataset.pseg);
});
document.querySelectorAll("[data-goto-profile-segment]").forEach((btn) => {
  btn.addEventListener("click", () => switchProfileSegment(btn.dataset.gotoProfileSegment));
});

const appearanceChips = document.querySelectorAll("#appearance-chips .chip");
appearanceChips.forEach((c) => c.classList.toggle("active", c.dataset.val === (localStorage.getItem("toci_appearance") || "dark")));
appearanceChips.forEach((c) => {
  c.addEventListener("click", () => {
    appearanceChips.forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
    const mode = c.dataset.val;
    localStorage.setItem("toci_appearance", mode);
    const resolved = mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
    document.documentElement.setAttribute("data-theme", resolved);
  });
});

async function loadProfileOverview() {
  const [weekly, weightHistory] = await Promise.all([api("/progress/weekly-summary"), api("/body-weight/history?days=7")]);
  const goal = state.settings && state.settings.daily_calorie_goal_kcal;

  const statRow = document.getElementById("profile-current-stats-row");
  const stat = (icon, value, sub, label) =>
    '<div class="stat-tile" style="text-align:center;"><div class="icon-circle sm" style="margin:0 auto 0.4rem;">' + icon + "</div>" +
    '<div class="value tnum" style="font-size:0.92rem;">' + value + "</div>" +
    '<div class="label" style="text-transform:none;font-weight:500;">' + label + "</div>" +
    '<div class="sub tnum">' + sub + "</div></div>";
  statRow.innerHTML =
    stat(GOAL_KIND_ICONS.consistency, weekly.avg_daily_calories.toLocaleString(), "avg / day", "Calories") +
    stat(PROGRAM_TODAY_ICONS.lift, weekly.avg_daily_protein_g + "g", "avg / day", "Protein") +
    stat('<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor"><path d="M4 17c1-6 2-9 6-9s5 3 6 9" stroke-width="1.5" stroke-linecap="round"/></svg>', "—", "not tracked", "Steps") +
    stat(PROGRAM_TODAY_ICONS.rest, "—", "not tracked", "Sleep");

  const svg = document.getElementById("profile-weight-sparkline");
  const daysEl = document.getElementById("profile-weight-sparkline-days");
  if (weightHistory.points.length >= 2) {
    svg.style.display = "";
    const W = 280, H = 70;
    const values = weightHistory.points.map((p) => kgToDisplay(p.weight_kg));
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const pad = (max - min) * 0.25 || 2;
    const yMin = min - pad, yMax = max + pad;
    const n = values.length;
    const xFor = (i) => (n === 1 ? W : (i / (n - 1)) * W);
    const yFor = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
    const coords = values.map((v, i) => [xFor(i), yFor(v)]);
    const line = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
    svg.innerHTML =
      '<path d="' + line + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      coords.map((c, i) => '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (i === n - 1 ? 5 : 3) + '" fill="var(--brand)"' + (i === n - 1 ? ' stroke="var(--surface)" stroke-width="2"' : "") + "/>").join("");
    daysEl.innerHTML = weightHistory.points.map((p) => '<span>' + new Date(p.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" }) + "</span>").join("");
  } else {
    svg.innerHTML = "";
    daysEl.innerHTML = '<span style="color:var(--neutral-2);">Log your weight a few times to see a trend.</span>';
  }

  const targetBody = document.getElementById("profile-daily-target-body");
  const targetBar = (icon, label, value, pct) =>
    '<div style="margin-bottom:0.8rem;"><div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;margin-bottom:0.3rem;">' +
    '<span style="display:flex;align-items:center;gap:0.4rem;"><span class="icon-circle sm" style="width:26px;height:26px;">' + icon + "</span>" + label + "</span>" +
    '<span class="tnum" style="font-weight:700;">' + value + "</span></div>" +
    '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;"></div></div></div>';
  if (goal) {
    const proteinTarget = Math.round((goal * MACRO_SPLIT.protein) / MACRO_KCAL_PER_G.protein);
    targetBody.innerHTML =
      targetBar(GOAL_KIND_ICONS.consistency, "Calories", Math.round(goal).toLocaleString() + " kcal", 100) +
      targetBar(PROGRAM_TODAY_ICONS.lift, "Protein", proteinTarget + " g", 100) +
      '<div class="empty-note" style="padding:0.2rem 0;">Steps and water targets aren\'t tracked yet.</div>';
  } else {
    targetBody.innerHTML = '<div class="empty-note">Complete onboarding to set daily targets.</div>';
  }

  const activityBody = document.getElementById("profile-activity-body");
  const activityLabels = {
    sedentary: ["Not Much Activity", "Little to no structured exercise"],
    lightly_active: ["Lightly Active", "1–2 workouts per week"],
    active: ["Active", "3–5 workouts per week"],
    very_active: ["Very Active", "6+ workouts per week"],
  };
  const level = (state.settings && state.settings.activity_level) || "active";
  const [levelTitle, levelSub] = activityLabels[level] || activityLabels.active;
  const trainingPct = weekly.planned_days ? Math.round(100 * weekly.matched_days / weekly.planned_days) : 0;
  activityBody.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.7rem;background:var(--brand-subtle-bg);border-radius:14px;padding:0.7rem 0.8rem;margin-bottom:0.8rem;">' +
    '<span class="icon-circle sm">' + PROGRAM_TODAY_ICONS.run + '</span>' +
    '<div><div style="font-weight:700;font-size:0.85rem;color:var(--brand-subtle-text);">' + levelTitle + '</div>' +
    '<div style="font-size:0.76rem;color:var(--neutral);">' + levelSub + "</div></div></div>" +
    '<div style="font-size:0.78rem;color:var(--neutral-2);margin-bottom:0.6rem;">This helps us personalize your plans and daily targets.</div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + trainingPct + '%;"></div></div>' +
    '<div class="tnum" style="font-size:0.76rem;color:var(--neutral-2);margin-top:0.4rem;">' + weekly.matched_days + " of " + weekly.planned_days + " planned training days done this week</div>";
}

async function loadProfileGoals() {
  const goals = await api("/goals");
  const list = document.getElementById("profile-goals-list");
  if (!goals.length) {
    list.innerHTML = '<div class="empty-note">No goals set yet.</div>';
    return;
  }
  list.innerHTML = goals
    .map((g) => {
      const pct = g.progress_pct != null ? g.progress_pct : 0;
      const valueLine = g.current_value != null && g.target_value != null
        ? fmtGoalValue(g.current_value, g.unit) + " → " + fmtGoalValue(g.target_value, g.unit) + " · "
        : "";
      return (
        '<div class="card tight" style="margin-bottom:0.6rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
        '<span style="font-size:0.85rem;font-weight:600;">' + escapeHtml(g.title) + "</span>" +
        '<span class="badge neutral" style="font-size:0.62rem;">' + (GOAL_STATUS_LABELS[g.status] || "Stable") + "</span></div>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;"></div></div>' +
        '<div class="tnum" style="font-size:0.75rem;color:var(--neutral-2);margin-top:0.35rem;">' + valueLine + pct + "% there</div>" +
        "</div>"
      );
    })
    .join("");
}

const FIXED_RESTRICTION_VALS = ["shellfish", "peanuts", "dairy", "gluten", "eggs", "pork", "beef"];

function renderFoodRestrictionChips(selected) {
  const wrap = document.getElementById("food-restriction-chips");
  wrap.querySelectorAll(".chip").forEach((c) => {
    if (FIXED_RESTRICTION_VALS.includes(c.dataset.val)) {
      c.classList.toggle("active", selected.includes(c.dataset.val));
    } else {
      c.remove();
    }
  });
  selected.filter((v) => !FIXED_RESTRICTION_VALS.includes(v)).forEach((v) => {
    wrap.appendChild(makeRestrictionChip(v, true));
  });
}

function makeRestrictionChip(val, active) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip" + (active ? " active" : "");
  chip.dataset.val = val;
  chip.textContent = titleCase(val);
  chip.addEventListener("click", () => chip.classList.toggle("active"));
  return chip;
}

document.querySelectorAll("#diet-preference-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});
document.querySelectorAll("#food-restriction-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});

document.getElementById("btn-add-custom-restriction").addEventListener("click", () => {
  const input = document.getElementById("custom-restriction-input");
  const val = input.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!val) return;
  const wrap = document.getElementById("food-restriction-chips");
  if (wrap.querySelector('[data-val="' + val + '"]')) {
    toast("Already added");
    return;
  }
  wrap.appendChild(makeRestrictionChip(val, true));
  input.value = "";
});

document.getElementById("btn-save-diet-prefs").addEventListener("click", async () => {
  const dietary_preferences = Array.from(document.querySelectorAll("#diet-preference-chips .chip.active")).map((c) => c.dataset.val);
  const food_restrictions = Array.from(document.querySelectorAll("#food-restriction-chips .chip.active")).map((c) => c.dataset.val);
  await api("/settings", { method: "PATCH", body: JSON.stringify({ dietary_preferences, food_restrictions }) });
  toast("Diet preferences saved");
});

document.getElementById("btn-add-injury").addEventListener("click", async () => {
  const region = document.getElementById("injury-region").value;
  const note = document.getElementById("injury-note").value;
  await api("/injuries", { method: "POST", body: JSON.stringify({ body_region: region, description: note || null }) });
  document.getElementById("injury-note").value = "";
  toast("Injury added — today's plan will reflect it");
  loadSettings();
  loadToday();
});

// Units: applies immediately (like a toggle), refreshes any weight already on screen.
document.querySelectorAll("#units-chips .chip").forEach((chip) => {
  chip.addEventListener("click", async () => {
    const newUnits = chip.dataset.val;
    document.querySelectorAll("#units-chips .chip").forEach((c) => c.classList.toggle("active", c === chip));
    state.units = newUnits;
    document.getElementById("height-unit-label").textContent = heightUnit();
    document.getElementById("set-weight-unit-label").textContent = weightUnit();
    document.getElementById("set-weight-unit-label-2").textContent = weightUnit();
    await api("/settings", { method: "PATCH", body: JSON.stringify({ units: newUnits }) });
    toast("Units set to " + (newUnits === "imperial" ? "lb / in" : "kg / cm"));
    await loadSettings();
    await loadToday();
    // if the Progress tab has already been visited its chart needs a refresh too
    const progressSelect = document.getElementById("progress-exercise-select");
    if (progressSelect.dataset.wired) renderProgressChart(progressSelect.value);
  });
});

document.getElementById("btn-save-profile").addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-profile");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const heightVal = document.getElementById("set-input-height").value;
    const goalWeightVal = document.getElementById("set-input-goal-weight").value;
    await api("/settings", {
      method: "PATCH",
      body: JSON.stringify({
        name: document.getElementById("set-input-name").value.trim() || undefined,
        age: parseInt(document.getElementById("set-input-age").value, 10) || null,
        height_cm: heightVal ? displayToCm(heightVal) : null,
        goal: document.getElementById("set-input-goal").value,
        experience_level: document.getElementById("set-input-experience").value,
        equipment: document.getElementById("set-input-equipment").value,
        goal_weight_kg: goalWeightVal ? displayToKg(goalWeightVal) : null,
        goal_pace_key: document.getElementById("set-input-goal-pace").value,
        activity_level: document.getElementById("set-input-activity").value,
        sex: document.querySelector("#set-sex-chips .chip.active").dataset.val,
      }),
    });
    toast("Profile saved");
    loadToday();
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Profile";
  }
});

document.getElementById("btn-log-weight").addEventListener("click", async () => {
  const input = document.getElementById("set-input-log-weight");
  const val = input.value;
  if (!val) {
    toast("Enter a weight first");
    return;
  }
  await api("/body-weight", { method: "POST", body: JSON.stringify({ weight_kg: displayToKg(val) }) });
  input.value = "";
  toast("Weight logged");
  loadSettings();
});

document.getElementById("btn-redo-onboarding").addEventListener("click", async (e) => {
  e.preventDefault();
  await api("/settings", { method: "PATCH", body: JSON.stringify({ onboarding_completed: false }) });
  location.reload();
});

document.getElementById("btn-recalculate-calories").addEventListener("click", async () => {
  const data = await api("/settings/recalculate-calories", { method: "POST" });
  document.getElementById("set-calorie-goal-display").textContent = Math.round(data.daily_calorie_goal_kcal) + " kcal";
  toast("Calorie goal recalculated");
  await loadSettings();
});

document.getElementById("toggle-premium").addEventListener("click", async () => {
  const btn = document.getElementById("toggle-premium");
  const nowOn = btn.dataset.on !== "1";
  setNotifToggle(btn, nowOn);
  await api("/settings", { method: "PATCH", body: JSON.stringify({ is_premium: nowOn }) });
  toast(nowOn ? "Premium simulated" : "Premium disabled");
  await loadSettings();
});

[
  ["toggle-notif-daily", "notif_daily_recommendation"],
  ["toggle-notif-readiness", "notif_readiness_alerts"],
].forEach(([btnId, field]) => {
  document.getElementById(btnId).addEventListener("click", async () => {
    const btn = document.getElementById(btnId);
    const nowOn = btn.dataset.on !== "1";
    setNotifToggle(btn, nowOn);
    await api("/settings", { method: "PATCH", body: JSON.stringify({ [field]: nowOn }) });
    toast((nowOn ? "Enabled" : "Disabled") + " — " + titleCase(field.replace("notif_", "")));
  });
});

document.getElementById("btn-save-password").addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-password");
  const pw = document.getElementById("set-input-password");
  const pwConfirm = document.getElementById("set-input-password-confirm");
  if (!pw.value || pw.value.length < 8) {
    toast("Password must be at least 8 characters");
    return;
  }
  if (pw.value !== pwConfirm.value) {
    toast("Passwords don't match");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await api("/settings/password", {
      method: "POST",
      body: JSON.stringify({ new_password: pw.value, confirm_password: pwConfirm.value }),
    });
    pw.value = "";
    pwConfirm.value = "";
    toast("Password updated");
  } catch (e) {
    toast("Something went wrong — try again");
  } finally {
    btn.disabled = false;
    btn.textContent = "Update Password";
  }
});

// -------------------------------------------------------------- spotify -----
// Real Authorization Code + PKCE flow against the Spotify Web API -- no
// client secret involved, that's the point of PKCE for a public client.

const SPOTIFY_SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state";

function base64UrlEncode(buffer) {
  let str = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomVerifier(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const random = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(random).map((b) => chars[b % chars.length]).join("");
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

async function connectSpotify(clientId, redirectUri) {
  if (!clientId) {
    toast("Save a Client ID first");
    return;
  }
  const verifier = randomVerifier(64);
  sessionStorage.setItem("spotify_code_verifier", verifier);
  const challenge = await pkceChallenge(verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES,
  });
  window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
}

async function handleSpotifyRedirectIfPresent() {
  if (!window.location.pathname.startsWith("/spotify")) return; // Whoop's callback lands on a different path
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const authError = params.get("error");
  if (!code && !authError) return;

  history.replaceState({}, "", "/");

  if (authError) {
    toast("Spotify: " + authError);
    return;
  }
  const verifier = sessionStorage.getItem("spotify_code_verifier");
  sessionStorage.removeItem("spotify_code_verifier");
  if (!verifier) {
    toast("Spotify connection expired — try connecting again");
    return;
  }
  try {
    const status = await api("/spotify/status"); // canonical redirect_uri, same one used to open the auth request
    await api("/spotify/callback", {
      method: "POST",
      body: JSON.stringify({ code: code, code_verifier: verifier, redirect_uri: status.redirect_uri }),
    });
    toast("Spotify connected");
  } catch (e) {
    toast("Spotify connection failed");
  }
}

async function loadSpotifySettings() {
  const status = await api("/spotify/status");
  document.getElementById("spotify-redirect-display").textContent = status.redirect_uri;
  document.getElementById("spotify-client-id-input").value = status.client_id;

  const area = document.getElementById("spotify-connect-area");
  if (!status.client_id_configured) {
    area.innerHTML = '<div class="empty-note">Save a Client ID above first.</div>';
  } else if (status.connected) {
    area.innerHTML = '<button class="btn outline" id="btn-disconnect-spotify">Disconnect Spotify</button>';
    document.getElementById("btn-disconnect-spotify").addEventListener("click", async () => {
      await api("/spotify/disconnect", { method: "POST" });
      toast("Spotify disconnected");
      loadSpotifySettings();
    });
  } else {
    area.innerHTML = '<button class="btn primary" id="btn-connect-spotify">Connect Spotify</button>';
    document.getElementById("btn-connect-spotify").addEventListener("click", () => connectSpotify(status.client_id, status.redirect_uri));
  }
}

document.getElementById("btn-save-spotify-client-id").addEventListener("click", async () => {
  const input = document.getElementById("spotify-client-id-input");
  const val = input.value.trim();
  if (!val) {
    toast("Paste a Client ID first");
    return;
  }
  await api("/spotify/client-id", { method: "POST", body: JSON.stringify({ client_id: val }) });
  toast("Client ID saved");
  loadSpotifySettings();
});

document.querySelectorAll("[data-stub-note]").forEach((btn) => {
  btn.addEventListener("click", () => toast(btn.dataset.stubNote));
});

// Toci doesn't store explicit protein/carb/fat targets (only the overall
// calorie goal computed at onboarding) -- these are a standard macro split
// derived from that goal, the same convention as the goal itself, just to
// give the 4 stat cards something to show progress against.
const MACRO_SPLIT = { protein: 0.30, carbs: 0.40, fat: 0.30 };
const MACRO_KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

function setMacroTile(key, value, target, unit) {
  document.getElementById("macro-" + key + "-val").textContent = Math.round(value).toLocaleString() + (unit || "");
  document.getElementById("macro-" + key + "-sub").textContent = target ? "of " + Math.round(target).toLocaleString() + (unit || "") : "—";
  const pct = target ? Math.min(100, Math.round(100 * value / target)) : 0;
  document.getElementById("macro-" + key + "-bar").style.width = pct + "%";
}

async function loadTodayMacroStats() {
  const [nutrition, wearable] = await Promise.all([api("/nutrition/today"), api("/wearable/today")]);
  const goal = state.settings && state.settings.daily_calorie_goal_kcal;
  const food = nutrition.totals.calories;
  const exercise = wearable.exercise_calories_burned || 0;

  setMacroTile("calories", food, goal, "");
  if (goal) {
    setMacroTile("protein", nutrition.totals.protein_g, (goal * MACRO_SPLIT.protein) / MACRO_KCAL_PER_G.protein, "g");
    setMacroTile("carbs", nutrition.totals.carbs_g, (goal * MACRO_SPLIT.carbs) / MACRO_KCAL_PER_G.carbs, "g");
    setMacroTile("fat", nutrition.totals.fat_g, (goal * MACRO_SPLIT.fat) / MACRO_KCAL_PER_G.fat, "g");
  } else {
    setMacroTile("protein", nutrition.totals.protein_g, null, "g");
    setMacroTile("carbs", nutrition.totals.carbs_g, null, "g");
    setMacroTile("fat", nutrition.totals.fat_g, null, "g");
  }

  const coaching = (nutrition.coaching || []).join(" ");
  if (exercise || coaching) {
    document.getElementById("macro-calories-sub").textContent =
      (goal ? "of " + Math.round(goal).toLocaleString() : "—") + (exercise ? " (+" + Math.round(exercise) + " burned)" : "");
  }

  document.getElementById("today-macro-stat-row").classList.toggle("hidden", !goal);
  document.getElementById("nutrition-setup-note").classList.toggle("hidden", !!goal);
}

document.getElementById("nutrition-summary-card").addEventListener("click", () => {
  if (state.settings && state.settings.daily_calorie_goal_kcal) {
    document.querySelector('.tab-bar [data-tab="view-food"]').click();
  } else {
    document.querySelector('.tab-bar [data-tab="view-settings"]').click();
    setTimeout(() => switchProfileSegment("account"), 50);
  }
});

function renderWeightSparkline(points) {
  const svg = document.getElementById("weight-sparkline");
  if (!svg || points.length < 2) return;
  const W = 280, H = 60;
  const values = points.map((p) => kgToDisplay(p.weight_kg));
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const pad = (max - min) * 0.2 || 2;
  const yMin = min - pad, yMax = max + pad;
  const n = values.length;
  const xFor = (i) => (n === 1 ? W : (i / (n - 1)) * W);
  const yFor = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
  const coords = values.map((v, i) => [xFor(i), yFor(v)]);
  const linePath = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  svg.innerHTML =
    '<path d="' + linePath + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + coords[n - 1][0] + '" cy="' + coords[n - 1][1] + '" r="4" fill="var(--brand)" stroke="var(--surface)" stroke-width="2"/>';
}

async function loadWeightProgressCard() {
  const body = document.getElementById("weight-progress-body");
  const data = await api("/body-weight/history?days=30");
  const current = state.settings && state.settings.current_weight_kg;
  if (current == null) {
    body.innerHTML = '<div class="empty-note" style="padding:0.3rem 0 0;">Log your weight to see progress here.</div>';
    return;
  }
  const chartHtml = '<div class="sparkline-wrap" style="margin:0.5rem 0;height:52px;"><svg id="weight-sparkline" width="100%" height="52" viewBox="0 0 280 52" preserveAspectRatio="none"></svg></div>';
  let deltaHtml;
  if (data.points.length >= 2) {
    const deltaKg = data.points[data.points.length - 1].weight_kg - data.points[0].weight_kg;
    const deltaDisplay = Math.abs(Math.round(kgToDisplay(deltaKg) * 10) / 10);
    const arrow = deltaKg < -0.05 ? "↓" : deltaKg > 0.05 ? "↑" : "→";
    const color = deltaKg < -0.05 ? "var(--success-text)" : deltaKg > 0.05 ? "var(--warn-text)" : "var(--neutral-2)";
    deltaHtml = '<div class="tnum" style="font-size:0.85rem;color:' + color + ';font-weight:700;margin-top:0.2rem;">' +
      arrow + " " + deltaDisplay + weightUnit() + " this month</div>";
  } else {
    deltaHtml = '<div class="empty-note" style="padding:0.2rem 0 0;">Not enough data yet</div>';
  }
  body.innerHTML =
    chartHtml +
    '<div class="hero-number tnum" style="font-size:1.5rem;">' + fmtWeight(current) + "</div>" +
    deltaHtml;
  if (data.points.length >= 2) renderWeightSparkline(data.points);
}

document.getElementById("weight-progress-card").addEventListener("click", () => {
  document.querySelector('.tab-bar [data-tab="view-progress"]').click();
});
document.getElementById("this-week-streak-card").addEventListener("click", () => {
  document.querySelector('.tab-bar [data-tab="view-program"]').click();
  setTimeout(() => switchProgramSegment("schedule"), 50);
});
document.getElementById("steps-card").addEventListener("click", () => {
  document.querySelector('.tab-bar [data-tab="view-settings"]').click();
  setTimeout(() => switchProfileSegment("devices"), 50);
});

// ---------------------------------------------------------------- wearable ----
// Real OAuth against Whoop -- Authorization Code, confidential client (Whoop
// requires a client secret, unlike Spotify's PKCE-only flow). A random
// `state` nonce stands in for PKCE's verifier as CSRF protection.

function randomState(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(random).map((b) => chars[b % chars.length]).join("");
}

function connectWhoop(clientId, redirectUri, scopes) {
  if (!clientId) {
    toast("Save a Client ID and Secret first");
    return;
  }
  const state = randomState(16);
  sessionStorage.setItem("whoop_oauth_state", state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state: state,
  });
  window.location.href = "https://api.prod.whoop.com/oauth/oauth2/auth?" + params.toString();
}

async function handleWhoopRedirectIfPresent() {
  if (!window.location.pathname.startsWith("/whoop")) return; // Spotify's callback lands on a different path
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const authError = params.get("error");
  if (!code && !authError) return;

  history.replaceState({}, "", "/");

  if (authError) {
    toast("Whoop: " + authError);
    return;
  }
  const savedState = sessionStorage.getItem("whoop_oauth_state");
  const returnedState = params.get("state");
  sessionStorage.removeItem("whoop_oauth_state");
  if (!savedState || savedState !== returnedState) {
    toast("Whoop connection expired — try connecting again");
    return;
  }
  try {
    const status = await api("/wearable/status"); // canonical redirect_uri, same one used to open the auth request
    await api("/wearable/whoop/callback", {
      method: "POST",
      body: JSON.stringify({ code: code, redirect_uri: status.redirect_uri, state: returnedState }),
    });
    toast("Whoop connected");
  } catch (e) {
    toast("Whoop connection failed");
  }
}

function renderWhoopStatsPicker(status) {
  const card = document.getElementById("whoop-stats-card");
  card.classList.toggle("hidden", !status.connected);
  if (!status.connected) return;

  const chips = document.getElementById("whoop-stats-chips");
  const selected = new Set(status.display_stats || []);
  chips.innerHTML = Object.entries(status.catalog)
    .map(([key, meta]) => '<button type="button" class="chip' + (selected.has(key) ? " active" : "") + '" data-stat="' + key + '">' + meta.label + "</button>")
    .join("");

  chips.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const key = chip.dataset.stat;
      if (selected.has(key)) {
        selected.delete(key);
        chip.classList.remove("active");
      } else {
        if (selected.size >= 3) {
          toast("Pick at most 3 stats");
          return;
        }
        selected.add(key);
        chip.classList.add("active");
      }
      await api("/wearable/display-stats", { method: "POST", body: JSON.stringify({ stats: Array.from(selected) }) });
      loadWearableCard();
    });
  });
}

async function loadWhoopSettings() {
  const status = await api("/wearable/status");
  document.getElementById("whoop-redirect-display").textContent = status.redirect_uri;
  document.getElementById("whoop-client-id-input").value = status.client_id;

  const area = document.getElementById("whoop-connect-area");
  if (!status.client_id_configured) {
    area.innerHTML = '<div class="empty-note">Save a Client ID and Secret above first.</div>';
  } else if (status.connected) {
    area.innerHTML = '<button class="btn outline" id="btn-disconnect-whoop">Disconnect Whoop</button>';
    document.getElementById("btn-disconnect-whoop").addEventListener("click", async () => {
      await api("/wearable/whoop/disconnect", { method: "POST" });
      toast("Whoop disconnected");
      loadWhoopSettings();
      loadWearableCard();
    });
  } else {
    area.innerHTML = '<button class="btn primary" id="btn-connect-whoop">Connect Whoop</button>';
    document.getElementById("btn-connect-whoop").addEventListener("click", () => connectWhoop(status.client_id, status.redirect_uri, status.scopes));
  }

  renderWhoopStatsPicker(status);
}

document.getElementById("btn-save-whoop-credentials").addEventListener("click", async () => {
  const clientId = document.getElementById("whoop-client-id-input").value.trim();
  const clientSecret = document.getElementById("whoop-client-secret-input").value.trim();
  if (!clientId || !clientSecret) {
    toast("Paste both a Client ID and Client Secret first");
    return;
  }
  await api("/wearable/whoop/credentials", {
    method: "POST",
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  document.getElementById("whoop-client-secret-input").value = "";
  toast("Whoop credentials saved");
  loadWhoopSettings();
});

async function loadWearableCard() {
  const el = document.getElementById("readiness-summary");
  const data = await api("/wearable/today");
  if (!data.connected) {
    el.innerHTML = 'Connect a wearable in <a href="#" id="wearable-goto-settings">Settings</a> for live stats.';
    const link = document.getElementById("wearable-goto-settings");
    if (link) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector('.tab-bar [data-tab="view-settings"]').click();
      });
    }
    return;
  }
  if (!data.stats.length) {
    el.textContent = "Connected — pick stats to show in Settings.";
  } else {
    el.textContent = data.stats.map((s) => s.label + " " + s.value + s.unit).join(" · ");
  }
  announceReadinessAccessibility();
}

function announceReadinessAccessibility() {
  if (!state.today) return;
  const score = Math.round(state.today.readiness.score);
  const band = state.today.readiness.band;
  const bandWord = band === "green" ? "Good" : band === "amber" ? "Moderate" : "Take It Easy";
  const summary = document.getElementById("readiness-summary").textContent;
  document.getElementById("readiness-hero-card").setAttribute("aria-label", "Readiness " + score + " out of 100, " + bandWord + ". " + summary);
}

// --------------------------------------------------------------- onboarding ----

const GOAL_PACE_OPTIONS = [
  { key: "lose_2", label: "Lose 2 lb/week", desc: "Aggressive pace — best for those with more weight to lose." },
  { key: "lose_1_5", label: "Lose 1.5 lb/week", desc: "Fast pace — noticeable results, still sustainable for most." },
  { key: "lose_1", label: "Lose 1 lb/week", desc: "Moderate pace — the most commonly recommended rate for steady fat loss." },
  { key: "lose_0_5", label: "Lose 0.5 lb/week", desc: "Gradual pace — easier to sustain, best when preserving muscle matters." },
  { key: "maintain", label: "Maintain weight", desc: "Hold steady — focus on performance, not the scale." },
  { key: "gain_0_5", label: "Gain 0.5 lb/week", desc: "Lean gain pace — slow, muscle-focused weight gain with minimal fat." },
  { key: "gain_1", label: "Gain 1 lb/week", desc: "Standard gain pace — faster muscle growth with some added fat." },
];

const ACTIVITY_LEVEL_OPTIONS = [
  { key: "sedentary", label: "Not Much Activity", desc: "Desk job, little to no regular exercise." },
  { key: "lightly_active", label: "Lightly Active", desc: "Light exercise or sports 1–3 days a week." },
  { key: "active", label: "Active", desc: "Moderate exercise or sports 3–5 days a week." },
  { key: "very_active", label: "Very Active", desc: "Hard exercise 6–7 days a week, or a physically demanding job." },
];

function renderOptionCards(containerId, options, selectedKey, onSelect) {
  const container = document.getElementById(containerId);
  container.innerHTML = options
    .map((o) => (
      '<button type="button" class="option-card' + (o.key === selectedKey ? " active" : "") + '" data-key="' + o.key + '">' +
      '<div class="title">' + o.label + '</div><div class="desc">' + o.desc + "</div></button>"
    ))
    .join("");
  container.querySelectorAll(".option-card").forEach((card) => {
    card.addEventListener("click", () => {
      container.querySelectorAll(".option-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      onSelect(card.dataset.key);
    });
  });
}

function updateSplashStatus(text) {
  const el = document.getElementById("splash-status");
  if (el) el.textContent = text;
}

function showOnboarding() {
  document.getElementById("onb-weight-unit-1").textContent = weightUnit();
  document.getElementById("onb-weight-unit-2").textContent = weightUnit();
  document.getElementById("onb-current-weight").value = "";
  document.getElementById("onb-goal-weight").value = "";
  renderOptionCards("onb-pace-options", GOAL_PACE_OPTIONS, state.onboardingPace, (key) => { state.onboardingPace = key; });
  renderOptionCards("onb-activity-options", ACTIVITY_LEVEL_OPTIONS, state.onboardingActivity, (key) => { state.onboardingActivity = key; });
  document.getElementById("app").classList.add("onboarding-mode");
  showView("view-onboarding");
}

async function finishOnboardingIntoToday() {
  await loadToday();
  await loadTodayMacroStats();
  await loadWeightProgressCard();
  updateSplashStatus("Syncing wearable data…");
  await loadWearableCard();
  showView("view-today");
}

document.getElementById("btn-onboarding-continue").addEventListener("click", async () => {
  const btn = document.getElementById("btn-onboarding-continue");
  const currentVal = document.getElementById("onb-current-weight").value;
  const goalVal = document.getElementById("onb-goal-weight").value;
  if (!currentVal || !goalVal) {
    toast("Enter both your current and goal weight");
    return;
  }
  const sex = document.querySelector("#onb-sex-chips .chip.active").dataset.val;
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await api("/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({
        current_weight_kg: displayToKg(currentVal),
        goal_weight_kg: displayToKg(goalVal),
        goal_pace_key: state.onboardingPace,
        activity_level: state.onboardingActivity,
        sex: sex,
      }),
    });
    await loadSettings(); // refresh state.settings with the new calorie goal before rendering Today
    document.getElementById("app").classList.remove("onboarding-mode");
    await finishOnboardingIntoToday();
  } catch (e) {
    toast("Something went wrong — try again");
  } finally {
    btn.disabled = false;
    btn.textContent = "Continue";
  }
});

// ------------------------------------------------------------------- boot ----

(async function boot() {
  const splashStart = Date.now();
  await handleSpotifyRedirectIfPresent(); // must run before the settings/today fetches below
  await handleWhoopRedirectIfPresent();
  await loadSettings(); // populates state.units + state.settings before anything renders a weight

  if (!state.settings.onboarding_completed) {
    showOnboarding();
  } else {
    await loadToday();
    await loadTodayMacroStats();
    await loadWeightProgressCard();
    updateSplashStatus("Syncing wearable data…");
    await loadWearableCard();
  }

  const MIN_SPLASH_MS = 700; // avoids a flash-of-nothing on a warm cache/fast load
  const elapsed = Date.now() - splashStart;
  if (elapsed < MIN_SPLASH_MS) await new Promise((r) => setTimeout(r, MIN_SPLASH_MS - elapsed));
  document.getElementById("splash-screen").classList.add("hide");
})();
