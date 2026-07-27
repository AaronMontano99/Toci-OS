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
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + "h" + (m ? " " + m + "m" : "");
}

// ------------------------------------------------------------------- nav ----

document.querySelectorAll(".tab-bar .tab").forEach((t) => {
  t.addEventListener("click", () => {
    const id = t.dataset.tab;
    showView(id);
    if (id === "view-today") { loadCalorieBudgetCard(); loadWeightProgressCard(); loadWeeklyProgressCard(); loadMusicCard(); loadWearableCard(); }
    if (id === "view-food") loadFoodToday();
    if (id === "view-progress") loadProgress();
    if (id === "view-program") loadProgram();
    if (id === "view-settings") loadSettings();
    if (id === "view-log") loadLogChooser();
  });
});
document.querySelectorAll("[data-back]").forEach((b) => {
  b.addEventListener("click", () => showView(b.dataset.back));
});

// ----------------------------------------------------------------- today ----

async function loadToday() {
  const data = await api("/today");
  state.today = data;

  const d = new Date(data.date + "T00:00:00");
  document.getElementById("today-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const score = data.readiness.score;
  const band = data.readiness.band;
  document.getElementById("readiness-value").textContent = Math.round(score);

  const badge = document.getElementById("readiness-badge");
  const bandClass = band === "green" ? "success" : band === "amber" ? "warn" : "critical";
  const bandWord = band === "green" ? "GO" : band === "amber" ? "EASY" : "REST";
  badge.className = "badge " + bandClass;
  badge.innerHTML = '<span class="dot"></span>' + bandWord;

  const ringFill = document.getElementById("readiness-ring-fill");
  const circumference = 194.8;
  const strokeVar = band === "green" ? "var(--success)" : band === "amber" ? "var(--warn)" : "var(--critical)";
  ringFill.style.stroke = strokeVar;
  ringFill.setAttribute("stroke-dashoffset", String(circumference * (1 - score / 100)));

  document.getElementById("btn-goto-checkin").classList.toggle("hidden", data.checked_in);

  renderRecommendation(data.recommendation);
  renderExerciseSummary(data.week);
  renderNotifications(data);
}

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

function renderRecommendation(reco) {
  const kicker = document.getElementById("reco-kicker");
  const body = document.getElementById("reco-body");
  const startBtn = document.getElementById("btn-start-session");
  const p = reco.prescription;
  const reasoning = (reco.reasoning || []).join(" ");

  document.getElementById("reco-ico").innerHTML = pictogramFor(reco);

  if (reco.session_type === "lift") {
    kicker.textContent = "Lift — " + (p.label || "");
    const rows = p.exercises
      .map((e) => '<div class="tnum" style="font-size:0.85rem;margin-top:0.25rem;">' + e.name + " — " + fmtWeight(e.load_kg) + " × " + e.sets + " sets × " + e.reps + " reps</div>")
      .join("");
    body.innerHTML =
      '<div style="font-weight:700;font-size:1rem;">' + (p.exercises[0] ? p.exercises[0].name : "Lift session") + "</div>" +
      rows +
      '<div style="font-size:0.78rem;color:var(--neutral-2);font-style:italic;margin-top:0.6rem;">“' + reasoning + "”</div>";
    startBtn.textContent = "Start Workout";
    startBtn.classList.remove("hidden");
    startBtn.onclick = () => { showView("view-log"); loadLogChooser(); };
  } else if (reco.session_type === "run") {
    kicker.textContent = "Run";
    body.innerHTML =
      '<div style="font-weight:700;font-size:1rem;">' + labelForRunType(p.run_type) + "</div>" +
      '<div class="tnum" style="font-size:0.85rem;color:var(--neutral);margin-top:0.2rem;">' + p.duration_min + " min · Zone " + p.zone + "</div>" +
      '<div style="font-size:0.78rem;color:var(--neutral-2);font-style:italic;margin-top:0.6rem;">“' + reasoning + "”</div>";
    startBtn.textContent = "Start Run";
    startBtn.classList.remove("hidden");
    startBtn.onclick = () => { showView("view-log"); loadLogChooser(); };
  } else {
    kicker.textContent = reco.session_type === "recover" ? "Recovery" : "Rest";
    body.innerHTML =
      '<div style="font-weight:700;font-size:1rem;">' + (p.note || "Rest day") + "</div>" +
      '<div style="font-size:0.78rem;color:var(--neutral-2);font-style:italic;margin-top:0.6rem;">“' + reasoning + "”</div>";
    startBtn.classList.add("hidden");
  }
}

function renderExerciseSummary(week) {
  const el = document.getElementById("exercise-summary-list");
  el.innerHTML = week
    .map((d, i) => {
      const dayName = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
      const kStyle = d.is_today ? ' style="color:var(--brand-dark);font-weight:700;"' : "";
      const clickable = d.day_type === "lift" || d.day_type === "run";
      const rowAttrs = clickable ? ' data-summary-idx="' + i + '" style="cursor:pointer;"' : "";
      return (
        '<div class="set-row"' + rowAttrs + '><span class="k"' + kStyle + ">" + dayName + (d.is_today ? " · Today" : "") + "</span>" +
        '<span class="v">' + d.label + (clickable ? " ›" : "") + "</span></div>" +
        (clickable ? '<div class="empty-note hidden" id="exercise-detail-' + i + '"></div>' : "")
      );
    })
    .join("");

  el.querySelectorAll("[data-summary-idx]").forEach((row) => {
    const idx = parseInt(row.dataset.summaryIdx, 10);
    row.addEventListener("click", () => toggleExerciseDetail(idx, week[idx]));
  });
}

async function toggleExerciseDetail(idx, day) {
  const detail = document.getElementById("exercise-detail-" + idx);
  const wasHidden = detail.classList.contains("hidden");
  document.querySelectorAll('[id^="exercise-detail-"]').forEach((d) => d.classList.add("hidden"));
  if (!wasHidden) return;

  detail.classList.remove("hidden");
  detail.textContent = "Loading…";
  const data = await api("/workouts/last-session?label=" + encodeURIComponent(day.label) + "&day_type=" + day.day_type);
  if (!data.found) {
    detail.innerHTML = '<div style="padding:0.3rem 0;">No previous session for this split yet.</div>';
    return;
  }
  const dateLabel = new Date(data.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (data.type === "lift") {
    detail.innerHTML =
      '<div style="padding:0.4rem 0 0.25rem;font-size:0.72rem;">Last ' + day.label + " (" + dateLabel + "):</div>" +
      data.exercises
        .map((e) => '<div class="tnum" style="font-size:0.82rem;color:var(--ink);padding:0.1rem 0;">• ' +
          e.name + " — " + fmtWeight(e.top_load_kg) + " × " + e.sets + " sets × " + e.top_reps + " reps</div>")
        .join("");
  } else {
    detail.innerHTML =
      '<div style="padding:0.4rem 0 0.25rem;font-size:0.72rem;">Last run (' + dateLabel + "):</div>" +
      '<div class="tnum" style="font-size:0.82rem;color:var(--ink);">' + data.duration_min + " min · " + data.distance_km + " km" +
      (data.avg_hr ? " · " + data.avg_hr + " bpm avg" : "") + "</div>";
  }
}

function renderNotifications(data) {
  const items = [];
  if (!data.checked_in) items.push("You haven't done today's recovery check-in yet.");
  if (data.readiness.band === "red") items.push("Readiness is low today — today's plan was adjusted to recovery.");
  if (data.readiness.band === "amber") items.push("Readiness is moderate today — volume has been trimmed.");

  document.getElementById("notif-dot").classList.toggle("hidden", !items.length);
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
document.getElementById("btn-premium-upsell").addEventListener("click", () => {
  toast("Premium isn't available yet — this is a demo placeholder for a future subscription tier.");
});

document.getElementById("btn-goto-checkin").addEventListener("click", () => {
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

function loadLogChooser() {
  if (!state.today) return;
  const reco = state.today.recommendation;
  const liftTitle = document.getElementById("log-lift-title");
  const runTitle = document.getElementById("log-run-title");
  liftTitle.textContent = reco.session_type === "lift" ? reco.prescription.label + " — recommended today" : "Log any exercise freely";
  runTitle.textContent = reco.session_type === "run" ? labelForRunType(reco.prescription.run_type) + " — recommended today" : "Log a run freely";
}

document.getElementById("btn-open-lift").addEventListener("click", () => { openLiftSession(); });
document.getElementById("btn-open-run").addEventListener("click", () => {
  const reco = state.today && state.today.recommendation;
  document.getElementById("run-kicker").textContent = reco && reco.session_type === "run" ? labelForRunType(reco.prescription.run_type) : "Freeform run";
  showView("view-run");
});

// ------------------------------------------------------------ log a lift ----

async function ensureExercisesLoaded() {
  if (!state.exercises.length) state.exercises = await api("/exercises");
  return state.exercises;
}

async function openLiftSession() {
  const reco = state.today.recommendation;
  const exercises = reco.session_type === "lift" ? reco.prescription.exercises : [];
  if (!exercises.length) toast("No lift prescribed today — add exercises below to log freely");

  const session = await api("/workouts", { method: "POST", body: JSON.stringify({ label: reco.prescription.label || "Freeform" }) });
  state.activeWorkoutSessionId = session.id;
  state.activeWorkoutExercises = exercises.map((e) => Object.assign({}, e, { loggedSets: [] }));

  document.getElementById("lift-session-kicker").textContent = state.activeWorkoutExercises.length ? "In progress" : "Freeform";
  document.getElementById("lift-session-title").textContent = reco.prescription.label || "Workout";

  await ensureExercisesLoaded();
  populateAddExerciseSelect();
  resetAddExerciseForm();
  renderLiftExercises();
  showView("view-lift");
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

async function loadFoodToday() {
  const data = await api("/nutrition/today");
  const d = new Date(data.date + "T00:00:00");
  document.getElementById("food-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  document.getElementById("food-total-calories").textContent = Math.round(data.totals.calories);
  document.getElementById("food-total-protein").textContent = Math.round(data.totals.protein_g) + "g";
  document.getElementById("food-total-carbs").textContent = Math.round(data.totals.carbs_g) + "g";
  document.getElementById("food-total-fat").textContent = Math.round(data.totals.fat_g) + "g";
  document.getElementById("food-micro-line").textContent =
    "Fiber " + Math.round(data.totals.fiber_g) + "g · Sugar " + Math.round(data.totals.sugar_g) +
    "g · Sodium " + Math.round(data.totals.sodium_mg) + "mg";

  const list = document.getElementById("food-log-list");
  if (!data.entries.length) {
    list.innerHTML = '<div class="empty-note">Nothing logged yet today.</div>';
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
      loadFoodToday();
    });
  });
  list.querySelectorAll(".set-delete-btn[data-entry]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/nutrition/log/" + btn.dataset.entry, { method: "DELETE" });
      toast("Removed");
      loadFoodToday();
    });
  });
}

document.getElementById("btn-open-add-food").addEventListener("click", () => {
  resetFoodAddView();
  showView("view-food-add");
});
document.getElementById("btn-fab-add-food").addEventListener("click", () => {
  resetFoodAddView();
  showView("view-food-add");
});
document.querySelector("#view-food-add [data-back]").addEventListener("click", () => stopBarcodeScan());

document.getElementById("btn-copy-yesterday").addEventListener("click", async () => {
  const result = await api("/nutrition/copy", { method: "POST", body: JSON.stringify({ from_date: "yesterday" }) });
  if (!result.copied) {
    toast("Nothing logged yesterday to copy");
    return;
  }
  toast("Copied " + result.copied + " item" + (result.copied === 1 ? "" : "s") + " from yesterday");
  loadFoodToday();
});

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

document.getElementById("btn-quick-add").addEventListener("click", async () => {
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
    }),
  });
  toast("Added");
  showView("view-food");
  loadFoodToday();
});

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

document.getElementById("btn-create-custom-food").addEventListener("click", async () => {
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
});

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

document.getElementById("btn-add-to-today").addEventListener("click", async () => {
  if (!state.selectedFood) return;
  await api("/nutrition/log", {
    method: "POST",
    body: JSON.stringify({
      food_item_id: state.selectedFood.id,
      servings: state.selectedServings,
      meal_slot: state.selectedMealSlot || "snack",
    }),
  });
  toast(state.selectedFood.name + " added");
  showView("view-food");
  loadFoodToday();
});

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

document.getElementById("btn-open-saved-meals").addEventListener("click", () => {
  document.getElementById("new-meal-builder").classList.add("hidden");
  showView("view-food-meals");
  loadSavedMeals();
});

async function loadSavedMeals() {
  const data = await api("/nutrition/meals");
  const list = document.getElementById("saved-meals-list");
  if (!data.meals.length) {
    list.innerHTML = '<div class="empty-note">No saved meals yet.</div>';
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
    btn.addEventListener("click", async () => {
      const mealId = btn.dataset.logMeal;
      const multInput = list.querySelector('.meal-multiplier-input[data-meal="' + mealId + '"]');
      const mult = parseFloat(multInput.value) || 1;
      await api("/nutrition/meals/" + mealId + "/log", { method: "POST", body: JSON.stringify({ multiplier: mult }) });
      toast("Meal logged");
      loadFoodToday();
    });
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

document.getElementById("btn-open-recipes").addEventListener("click", () => {
  showView("view-food-recipes");
  loadRecipeHub();
});

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

  const [recommended, categories] = await Promise.all([
    api("/recipes/recommended"),
    api("/recipes/categories"),
  ]);

  recRow.innerHTML = recommended.recipes.map((r) => recipeCardHtml(r, true)).join("");
  wireRecipeCards(recRow);

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

document.getElementById("btn-log-recipe").addEventListener("click", async () => {
  const overrides = Object.entries(state.recipeOverrides).map(([id, o]) => ({ ingredient_id: parseInt(id, 10), ...o }));
  await api("/recipes/" + state.selectedRecipe.id + "/log", {
    method: "POST",
    body: JSON.stringify({
      servings: state.recipeLogServings,
      meal_slot: state.recipeLogMealSlot || "snack",
      overrides: overrides,
    }),
  });
  toast(state.selectedRecipe.name + " added");
  showView("view-food");
  loadFoodToday();
});

document.getElementById("btn-add-recipe-to-cart").addEventListener("click", async () => {
  const result = await api("/shopping/from-recipe/" + state.selectedRecipe.id, {
    method: "POST",
    body: JSON.stringify({ multiplier: state.recipeLogServings }),
  });
  toast(result.ingredients_added + " ingredient" + (result.ingredients_added === 1 ? "" : "s") + " added to Smart Cart");
});

// -- smart cart --

document.getElementById("btn-open-shopping-cart").addEventListener("click", () => {
  showView("view-shopping-cart");
  loadShoppingCart();
});

const CART_CATEGORY_ORDER = ["protein", "produce", "fruit", "carbs", "fats", "dairy", "frozen", "snacks", "drinks", "pantry"];
const CART_CATEGORY_LABELS = {
  protein: "Protein", produce: "Produce", fruit: "Fruit", carbs: "Carbohydrates", fats: "Healthy Fats",
  dairy: "Dairy", frozen: "Frozen", pantry: "Pantry", snacks: "Snacks", drinks: "Drinks",
};

async function loadShoppingCart() {
  const data = await api("/shopping");
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
  const data = await api("/pantry");
  const list = document.getElementById("pantry-list");
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

async function renderProgressChart(exerciseId) {
  document.getElementById("chart-kicker").textContent = "Est. 1RM (" + weightUnit() + ")";
  const data = await api("/progress/strength/" + exerciseId);
  const svg = document.getElementById("prog-chart");
  const emptyNote = document.getElementById("chart-empty");
  svg.innerHTML = "";

  if (!data.points.length) {
    emptyNote.classList.remove("hidden");
    return;
  }
  emptyNote.classList.add("hidden");
  data.points.forEach((p) => { p.est_1rm_display = kgToDisplay(p.est_1rm_kg); });

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

async function renderPRs() {
  const data = await api("/prs");
  const el = document.getElementById("pr-list");
  if (!data.prs.length) {
    el.innerHTML = '<div class="empty-note">Nothing logged yet.</div>';
    return;
  }
  el.innerHTML = data.prs
    .map((p) => {
      const val = p.est_1rm_kg != null ? fmtWeight(p.est_1rm_kg) : p.pace_per_km + " /km";
      return '<div class="pr-row"><div><div class="name">' + p.exercise + '</div><div class="date">' + p.date + "</div></div>" +
        '<div class="val">▲ ' + val + "</div></div>";
    })
    .join("");
}

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

function renderProgramToday(today) {
  const card = document.getElementById("program-today-card");
  const reasoning = (today.reasoning || []).join(" ");
  const p = today.prescription;
  if (today.session_type === "lift") {
    card.innerHTML =
      '<div style="font-weight:700;font-size:0.95rem;">' + (p.label || "Lift") + "</div>" +
      p.exercises.map((e) => '<div class="tnum" style="font-size:0.82rem;margin-top:0.25rem;">' + e.name + " — " + fmtWeight(e.load_kg) + " × " + e.sets + " sets × " + e.reps + " reps</div>").join("") +
      '<div style="font-size:0.76rem;color:var(--neutral-2);font-style:italic;margin-top:0.55rem;">“' + reasoning + "”</div>";
  } else if (today.session_type === "run") {
    card.innerHTML =
      '<div style="font-weight:700;font-size:0.95rem;">' + labelForRunType(p.run_type) + "</div>" +
      '<div class="tnum" style="font-size:0.82rem;color:var(--neutral);margin-top:0.2rem;">' + p.duration_min + " min · Zone " + p.zone + "</div>" +
      '<div style="font-size:0.76rem;color:var(--neutral-2);font-style:italic;margin-top:0.55rem;">“' + reasoning + "”</div>";
  } else {
    card.innerHTML =
      '<div style="font-weight:700;font-size:0.95rem;">' + (p.note || "Rest day") + "</div>" +
      '<div style="font-size:0.76rem;color:var(--neutral-2);font-style:italic;margin-top:0.55rem;">“' + reasoning + "”</div>";
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

  document.getElementById("program-focus").textContent = id.program_name + " — " + id.focus;
  document.getElementById("program-week-title").textContent = "Week " + id.current_week + " of " + id.total_weeks;
  document.getElementById("program-name").textContent = id.program_name;
  document.getElementById("program-phase-line").textContent = "Week " + id.current_week + " of " + id.total_weeks + " — " + id.focus + " phase";
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

  renderProgramToday(data.today);
  renderProgramWeek(data.week);
  renderProgramGoals(data.goals);

  const obsCard = document.getElementById("program-observations-card");
  obsCard.innerHTML = data.coach_observations.length
    ? data.coach_observations.map((o) => '<div class="observation-row"><span class="dot"></span><span>' + o + "</span></div>").join("")
    : '<div class="empty-note">Nothing notable yet — keep logging and patterns will show up here.</div>';

  loadProgressPhotos();
  loadCoachChat();
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

  document.getElementById("btn-avatar").textContent = (data.name || "?").trim().charAt(0).toUpperCase();
  document.getElementById("premium-banner").classList.toggle("hidden", !!data.is_premium);
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
      loadMusicCard();
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

async function loadCalorieBudgetCard() {
  const body = document.getElementById("calorie-budget-body");
  const [nutrition, wearable] = await Promise.all([api("/nutrition/today"), api("/wearable/today")]);
  const goal = state.settings && state.settings.daily_calorie_goal_kcal;
  const food = nutrition.totals.calories;
  const exercise = wearable.exercise_calories_burned || 0;

  if (!goal) {
    body.innerHTML = '<div class="empty-note">Complete onboarding to set a calorie goal.</div>';
    return;
  }
  const remaining = Math.round(goal - food + exercise);
  const row = (label, value, big) =>
    '<div class="set-row"' + (big ? ' style="border-bottom:none;"' : "") + '><span class="k">' + label + '</span>' +
    '<span class="v tnum"' + (big ? ' style="font-weight:800;font-size:1rem;color:var(--brand-dark);"' : "") + '>' + value + "</span></div>";

  const foodLink = !nutrition.entries.length ? ' · <a href="#" id="calorie-goto-food">log a meal</a>' : "";
  const coaching = (nutrition.coaching || [])
    .map((msg) => '<div class="tnum" style="font-size:0.78rem;color:var(--brand-dark);margin-top:0.35rem;">' + msg + "</div>")
    .join("");
  body.innerHTML =
    row("Goal", Math.round(goal).toLocaleString()) +
    row("Food", Math.round(food).toLocaleString()) +
    row("Exercise", (exercise ? "+" : "") + Math.round(exercise).toLocaleString()) +
    row("Remaining", remaining.toLocaleString(), true) +
    '<div class="tnum" style="font-size:0.78rem;color:var(--neutral-2);margin-top:0.5rem;">P ' +
    Math.round(nutrition.totals.protein_g) + "g · C " + Math.round(nutrition.totals.carbs_g) + "g · F " +
    Math.round(nutrition.totals.fat_g) + "g" + foodLink + "</div>" + coaching;

  if (!nutrition.entries.length) {
    document.getElementById("calorie-goto-food").addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('.tab-bar [data-tab="view-food"]').click();
    });
  }
}

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
    body.innerHTML = '<div class="empty-note">Log your weight in Settings to see progress here.</div>';
    return;
  }
  let deltaHtml;
  if (data.points.length >= 2) {
    const deltaKg = data.points[data.points.length - 1].weight_kg - data.points[0].weight_kg;
    const deltaDisplay = Math.abs(Math.round(kgToDisplay(deltaKg) * 10) / 10);
    const arrow = deltaKg < -0.05 ? "↓" : deltaKg > 0.05 ? "↑" : "→";
    const color = deltaKg < -0.05 ? "var(--success-text)" : deltaKg > 0.05 ? "var(--warn-text)" : "var(--neutral-2)";
    deltaHtml = '<div class="tnum" style="font-size:0.85rem;color:' + color + ';font-weight:700;margin-top:0.2rem;">' +
      arrow + " " + deltaDisplay + weightUnit() + " this month</div>";
  } else {
    deltaHtml = '<div class="empty-note">Log your weight a few times to see a trend.</div>';
  }
  body.innerHTML =
    '<div class="hero-number tnum" style="font-size:1.7rem;">' + fmtWeight(current) + "</div>" +
    deltaHtml +
    '<div class="sparkline-wrap" style="margin-top:0.6rem;"><svg id="weight-sparkline" width="100%" height="60" viewBox="0 0 280 60" preserveAspectRatio="none"></svg></div>';
  renderWeightSparkline(data.points);
}

async function loadWeeklyProgressCard() {
  const body = document.getElementById("weekly-progress-body");
  const data = await api("/progress/weekly-summary");
  const c = data.consistency;
  const bandColor = c.band === "Excellent" ? "var(--success-text)" : c.band === "Good" ? "var(--warn-text)" : "var(--critical-text)";
  let weightTrendText = "Not enough data yet";
  if (data.weight_delta_kg != null) {
    const d = data.weight_delta_kg;
    const arrow = d < -0.05 ? "↓" : d > 0.05 ? "↑" : "→";
    weightTrendText = arrow + " " + Math.abs(Math.round(kgToDisplay(d) * 10) / 10) + weightUnit() + " this week";
  }
  body.innerHTML =
    '<div class="set-row"><span class="k">Calories this week</span><span class="v tnum">' + data.calories_this_week.toLocaleString() + "</span></div>" +
    '<div class="set-row"><span class="k">Avg daily intake</span><span class="v tnum">' +
    (data.days_logged ? data.avg_daily_calories.toLocaleString() + " (" + data.days_logged + "d logged)" : "—") + "</span></div>" +
    '<div class="set-row"><span class="k">Weight trend</span><span class="v tnum">' + weightTrendText + "</span></div>" +
    '<div class="set-row" style="border-bottom:none;"><span class="k">Consistency</span><span class="v tnum" style="font-weight:800;color:' +
    bandColor + ';">' + c.score + " · " + c.band + "</span></div>";
}

async function loadMusicCard() {
  const body = document.getElementById("music-body");
  const status = await api("/spotify/status");
  if (!status.connected) {
    body.innerHTML = '<div style="font-size:0.85rem;color:var(--neutral-2);">Not connected — <a href="#" id="music-goto-settings">connect Spotify in Settings</a>.</div>';
    document.getElementById("music-goto-settings").addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('.tab-bar [data-tab="view-settings"]').click();
    });
    return;
  }
  const now = await api("/spotify/now-playing");
  if (!now.connected || !now.track) {
    body.innerHTML = '<div style="font-size:0.85rem;color:var(--neutral-2);">Connected — nothing playing right now.</div>';
    return;
  }
  const art = now.album_art ? '<img src="' + now.album_art + '" alt="" style="width:44px;height:44px;border-radius:8px;flex:none;">' : "";
  body.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.7rem;">' + art +
    '<div style="min-width:0;flex:1;">' +
    '<div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + now.track + "</div>" +
    '<div style="font-size:0.78rem;color:var(--neutral-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + now.artist + "</div></div>" +
    '<button class="btn small subtle" id="btn-toggle-playback" style="flex:none;">' + (now.playing ? "Pause" : "Play") + "</button></div>";
  document.getElementById("btn-toggle-playback").addEventListener("click", async () => {
    try {
      await api("/spotify/playback", { method: "POST", body: JSON.stringify({ action: now.playing ? "pause" : "play" }) });
      loadMusicCard();
    } catch (e) {
      toast("Playback control failed — is Spotify open somewhere?");
    }
  });
}

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
    return;
  }
  el.textContent = data.stats.map((s) => s.label + " " + s.value + s.unit).join(" · ");
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
  await loadCalorieBudgetCard();
  await loadWeightProgressCard();
  await loadWeeklyProgressCard();
  await loadMusicCard();
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
    await loadCalorieBudgetCard();
    await loadWeightProgressCard();
    await loadWeeklyProgressCard();
    await loadMusicCard();
    updateSplashStatus("Syncing wearable data…");
    await loadWearableCard();
  }

  const MIN_SPLASH_MS = 700; // avoids a flash-of-nothing on a warm cache/fast load
  const elapsed = Date.now() - splashStart;
  if (elapsed < MIN_SPLASH_MS) await new Promise((r) => setTimeout(r, MIN_SPLASH_MS - elapsed));
  document.getElementById("splash-screen").classList.add("hide");
})();
