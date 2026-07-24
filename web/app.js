const API = "/api";
const state = {
  today: null,
  exercises: [],
  activeWorkoutSessionId: null,
  activeWorkoutExercises: [],
};

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

  document.getElementById("readiness-summary").textContent =
    "HRV " + (data.recovery.hrv_ms ?? "—") + "ms · Sleep " + fmtHours(data.recovery.sleep_duration_min) +
    " · RHR " + (data.recovery.resting_hr_bpm ?? "—") + "bpm";

  document.getElementById("checkin-prompt").classList.toggle("hidden", data.checked_in);

  renderRecommendation(data.recommendation);
  renderWeekStrip(data.week);
}

function renderRecommendation(reco) {
  const kicker = document.getElementById("reco-kicker");
  const body = document.getElementById("reco-body");
  const startBtn = document.getElementById("btn-start-session");
  const p = reco.prescription;
  const reasoning = (reco.reasoning || []).join(" ");

  if (reco.session_type === "lift") {
    kicker.textContent = "Lift — " + (p.label || "");
    const rows = p.exercises
      .map((e) => '<div class="tnum" style="font-size:0.85rem;margin-top:0.25rem;">' + e.name + " — " + e.sets + "×" + e.reps + " @ " + e.load_kg + "kg</div>")
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

function renderWeekStrip(week) {
  const el = document.getElementById("week-strip");
  el.innerHTML = week
    .map((d) => {
      const dayName = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
      return (
        '<div class="day-pill ' + d.day_type + " " + (d.is_today ? "today" : "") + '">' +
        '<div class="d">' + dayName + "</div>" +
        '<div class="t">' + labelShort(d.day_type) + "</div></div>"
      );
    })
    .join("");
}

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

    state.activeWorkoutExercises.push({
      exercise_id: exerciseId,
      name: exerciseName,
      sets: 3,
      reps: 8,
      load_kg: 20,
      target_rir: 2,
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
    container.innerHTML = '<div class="empty-note">Nothing added yet — pick an exercise below to get started.</div>';
    return;
  }
  container.innerHTML = state.activeWorkoutExercises
    .map((ex, i) => {
      const loggedRows = ex.loggedSets
        .map((s, si) => '<div class="pr-row"><span class="name" style="font-weight:500;">Set ' + (si + 1) + '</span><span class="tnum" style="color:var(--neutral);font-size:0.82rem;">' + s.weight + "kg × " + s.reps + " · RIR " + s.rir + "</span></div>")
        .join("");
      return (
        '<div class="card"><span class="kicker">' + ex.name + '</span>' +
        '<div class="tnum" style="font-size:0.82rem;color:var(--neutral);margin-bottom:0.6rem;">Target: ' + ex.sets + "×" + ex.reps + " @ " + ex.load_kg + "kg · RIR " + ex.target_rir + "</div>" +
        '<div style="display:flex;gap:0.5rem;margin-bottom:0.6rem;">' +
        '<div class="field" style="margin-bottom:0;flex:1;"><label>Weight (kg)</label><input type="number" step="0.5" value="' + ex.load_kg + '" id="ex-' + i + '-weight"></div>' +
        '<div class="field" style="margin-bottom:0;flex:1;"><label>Reps</label><input type="number" value="' + ex.reps + '" id="ex-' + i + '-reps"></div>' +
        '<div class="field" style="margin-bottom:0;flex:1;"><label>RIR</label><input type="number" step="0.5" value="' + ex.target_rir + '" id="ex-' + i + '-rir"></div>' +
        '</div><button class="btn subtle" data-exi="' + i + '" data-action="log-set">Log Set</button>' +
        '<div style="margin-top:0.5rem;">' + loggedRows + "</div></div>"
      );
    })
    .join("");

  container.querySelectorAll('[data-action="log-set"]').forEach((btn) => {
    btn.addEventListener("click", () => logSet(parseInt(btn.dataset.exi, 10)));
  });
}

async function logSet(exi) {
  const ex = state.activeWorkoutExercises[exi];
  const weight = parseFloat(document.getElementById("ex-" + exi + "-weight").value);
  const reps = parseInt(document.getElementById("ex-" + exi + "-reps").value, 10);
  const rir = parseFloat(document.getElementById("ex-" + exi + "-rir").value);
  const setIndex = ex.loggedSets.length + 1;

  await api("/workouts/" + state.activeWorkoutSessionId + "/sets", {
    method: "POST",
    body: JSON.stringify({
      exercise_id: ex.exercise_id,
      set_index: setIndex,
      prescribed_reps: ex.reps,
      prescribed_load_kg: ex.load_kg,
      actual_reps: reps,
      actual_load_kg: weight,
      rir: rir,
    }),
  });
  ex.loggedSets.push({ weight: weight, reps: reps, rir: rir });
  renderLiftExercises();
  toast("Set " + setIndex + " logged");
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
  const data = await api("/progress/strength/" + exerciseId);
  const svg = document.getElementById("prog-chart");
  const emptyNote = document.getElementById("chart-empty");
  svg.innerHTML = "";

  if (!data.points.length) {
    emptyNote.classList.remove("hidden");
    return;
  }
  emptyNote.classList.add("hidden");

  const W = 280, H = 120;
  const values = data.points.map((p) => p.est_1rm_kg);
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const pad = (max - min) * 0.15 || 5;
  const yMin = min - pad, yMax = max + pad;
  const n = data.points.length;
  const xFor = (i) => (n === 1 ? W : (i / (n - 1)) * W);
  const yFor = (v) => H - ((v - yMin) / (yMax - yMin)) * H;

  const coords = data.points.map((p, i) => [xFor(i), yFor(p.est_1rm_kg)]);
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
    tip.textContent = data.points[nearest].date + " · " + data.points[nearest].est_1rm_kg + "kg";
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
      const val = p.est_1rm_kg != null ? p.est_1rm_kg + " kg" : p.pace_per_km + " /km";
      return '<div class="pr-row"><div><div class="name">' + p.exercise + '</div><div class="date">' + p.date + "</div></div>" +
        '<div class="val">▲ ' + val + "</div></div>";
    })
    .join("");
}

// --------------------------------------------------------------- program ----

async function loadProgram() {
  const data = await api("/program");
  document.getElementById("program-focus").textContent = data.program_name + " — " + data.focus;
  document.getElementById("program-week-title").textContent = "Week " + data.current_week + " of " + data.total_weeks;

  const deloadCard = document.getElementById("deload-card");
  if (data.deload_week) {
    deloadCard.classList.remove("hidden");
    document.getElementById("deload-week-badge").textContent = "Week " + data.deload_week;
  } else {
    deloadCard.classList.add("hidden");
  }

  const list = document.getElementById("program-week-list");
  list.innerHTML = data.week
    .map((d) => {
      const dayName = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
      const border = d.is_today ? "border:1.5px solid var(--brand);" : "";
      const nameColor = d.is_today ? "color:var(--brand-dark);" : "";
      return (
        '<div class="card tight" style="' + border + '"><div class="pr-row" style="border-bottom:none;">' +
        '<span class="name" style="' + nameColor + '">' + dayName + " — " + d.label + (d.is_today ? " · Today" : "") + "</span>" +
        '<span class="badge neutral" style="font-size:0.62rem;">' + labelShort(d.day_type) + "</span></div></div>"
      );
    })
    .join("");
}

// --------------------------------------------------------------- settings ----

async function loadSettings() {
  const data = await api("/settings");
  document.getElementById("set-name").textContent = data.name;
  document.getElementById("set-goal").textContent = titleCase(data.goal);
  document.getElementById("set-experience").textContent = titleCase(data.experience_level);
  document.getElementById("set-equipment").textContent = titleCase(data.equipment);

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
}

document.getElementById("btn-add-injury").addEventListener("click", async () => {
  const region = document.getElementById("injury-region").value;
  const note = document.getElementById("injury-note").value;
  await api("/injuries", { method: "POST", body: JSON.stringify({ body_region: region, description: note || null }) });
  document.getElementById("injury-note").value = "";
  toast("Injury added — today's plan will reflect it");
  loadSettings();
  loadToday();
});

// ------------------------------------------------------------------- boot ----

loadToday();
