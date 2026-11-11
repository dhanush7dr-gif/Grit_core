const STORAGE_KEYS = {
  workouts: "gritcore-workouts-v1",
  profile: "gritcore-profile-v1"
};

const EXERCISES = [
  "Push-ups",
  "Wide push-ups",
  "Diamond push-ups",
  "Knee push-ups",
  "Incline push-ups",
  "Decline push-ups",
  "Pike push-ups",
  "Sit-ups",
  "Crunches",
  "Bicycle crunches",
  "Squats",
  "Reverse lunges",
  "Glute bridges",
  "Calf raises",
  "Plank",
  "Side plank",
  "Mountain climbers",
  "Jumping jacks",
  "Burpees",
  "High knees",
  "Wall sit",
  "Yoga or stretching",
  "Walking or running",
  "Custom activity"
];

const ICONS = {
  "Push-ups": "↗",
  "Wide push-ups": "↗",
  "Diamond push-ups": "↗",
  "Knee push-ups": "↗",
  "Incline push-ups": "↗",
  "Decline push-ups": "↗",
  "Pike push-ups": "↗",
  "Sit-ups": "⌁",
  "Crunches": "⌁",
  "Bicycle crunches": "⌁",
  "Squats": "⌖",
  "Reverse lunges": "⌖",
  "Glute bridges": "⌖",
  "Calf raises": "⌖",
  "Plank": "◒",
  "Side plank": "◒",
  "Mountain climbers": "↟",
  "Jumping jacks": "✳",
  "Burpees": "↟",
  "High knees": "↟",
  "Wall sit": "◒",
  "Yoga or stretching": "✧",
  "Walking or running": "➜",
  "Walking": "➜",
  "Running": "➜"
};

const DEFAULT_PROFILE = {
  name: "",
  age: null,
  weight: null,
  height: null,
  weeklyGoal: 3,
  focus: "general"
};

const toast = document.querySelector("#toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch (error) {
    console.error(`Could not read saved app data (${key}).`, error);
    showToast("Saved data could not be read. You can clear it in My details.");
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save app data (${key}).`, error);
    showToast("Could not save data. Check available storage in your browser.");
    return false;
  }
}

let workouts = readStorage(STORAGE_KEYS.workouts, []);
let profile = { ...DEFAULT_PROFILE, ...readStorage(STORAGE_KEYS.profile, {}) };
if (!Array.isArray(workouts)) {
  console.error("Saved workout history has an invalid format.");
  workouts = [];
  showToast("Workout history could not be read and was reset.");
}

const exerciseSelect = document.querySelector("#exercise");
const cameraVideo = document.querySelector("#camera-video");
const poseCanvas = document.querySelector("#pose-canvas");
const poseContext = poseCanvas.getContext("2d");
const cameraFrame = document.querySelector(".camera-frame");
const cameraMessage = document.querySelector("#camera-message");
const cameraStartButton = document.querySelector("#camera-start");
const cameraStopButton = document.querySelector("#camera-stop");
const cameraSaveButton = document.querySelector("#camera-save");
const repCountOutput = document.querySelector("#rep-count");

let activeStream = null;
let poseLandmarker = null;
let poseLandmarkerPromise = null;
let animationFrame = 0;
let cameraStartedAt = 0;
let cameraRepCount = 0;
let cameraPhase = "unarmed";
let lastRepAt = 0;
let angleSamples = [];
let pendingInstallPrompt = null;
const activityTracker = {
  mode: "walk",
  state: "idle",
  steps: 0,
  distanceMeters: 0,
  elapsedMs: 0,
  startedAt: 0,
  baseline: null,
  stepArmed: true,
  lastStepAt: 0,
  lastPosition: null,
  watchId: null,
  timerId: null,
  motionAvailable: false,
  starting: false
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function workoutTotals(entries) {
  return entries.reduce((totals, entry) => {
    if (entry.mode !== "activity") totals.reps += Number(entry.reps) * Number(entry.sets);
    totals.minutes += Number(entry.duration);
    return totals;
  }, { reps: 0, minutes: 0 });
}

function recentWeekEntries() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return workouts.filter((entry) => new Date(entry.date).getTime() >= start.getTime());
}

function makeWorkoutRow(entry, shortDate = true) {
  const row = document.createElement("div");
  row.className = "workout-row";

  const dot = document.createElement("span");
  dot.className = "workout-dot";
  dot.setAttribute("aria-hidden", "true");
  dot.textContent = ICONS[entry.exercise] || "✦";

  const copy = document.createElement("div");
  copy.className = "workout-row-copy";
  const title = document.createElement("strong");
  title.textContent = entry.exercise;
  const details = document.createElement("span");
  details.textContent = entry.mode === "activity"
    ? `${Number(entry.steps || 0).toLocaleString()} steps · ${(Number(entry.distanceMeters || 0) / 1000).toFixed(2)} km`
    : `${entry.sets} set${Number(entry.sets) === 1 ? "" : "s"} · ${entry.reps} reps/set${entry.duration ? ` · ${entry.duration} min` : ""}`;
  copy.append(title, details);

  const date = document.createElement("span");
  date.className = "workout-date";
  date.textContent = shortDate ? formatShortDate(entry.date) : formatDate(entry.date);

  row.append(dot, copy, date);
  return row;
}

function getRangeEntries(range) {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return workouts.filter((entry) => new Date(entry.date).getTime() >= start.getTime());
  }
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return workouts.filter((entry) => new Date(entry.date).getTime() >= start.getTime());
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return workouts.filter((entry) => new Date(entry.date).getTime() >= start.getTime());
}

function setSummaryRange(range) {
  for (const item of document.querySelectorAll(".summary-chip")) {
    item.classList.toggle("active", item.dataset.range === range);
  }
  renderDashboard();
}

window.setSummaryRange = setSummaryRange;

function setWellnessFocus(focus) {
  profile.focus = focus;
  if (saveStorage(STORAGE_KEYS.profile, profile)) {
    renderProfile();
  }
  showToast(`${focus.charAt(0).toUpperCase() + focus.slice(1)} mode selected.`);
}

window.setWellnessFocus = setWellnessFocus;

function renderDashboard() {
  const activeRange = document.querySelector(".summary-chip.active")?.dataset.range || "today";
  const entries = getRangeEntries(activeRange);
  const totals = workoutTotals(entries);
  const goalValue = Number(profile.weeklyGoal || 3);

  const labels = {
    today: { workouts: "Sessions today", reps: "Reps today", minutes: "Minutes today", goal: "Daily goal" },
    week: { workouts: "Sessions this week", reps: "Reps this week", minutes: "Minutes this week", goal: "Weekly goal" },
    month: { workouts: "Sessions this month", reps: "Reps this month", minutes: "Minutes this month", goal: "Monthly goal" }
  };

  document.querySelector("#stat-workouts-label").textContent = labels[activeRange].workouts;
  document.querySelector("#stat-reps-label").textContent = labels[activeRange].reps;
  document.querySelector("#stat-minutes-label").textContent = labels[activeRange].minutes;
  document.querySelector("#stat-goal-label").textContent = labels[activeRange].goal;
  document.querySelector("#stat-workouts").textContent = String(entries.length);
  document.querySelector("#stat-reps").textContent = String(totals.reps);
  document.querySelector("#stat-minutes").textContent = String(totals.minutes);
  document.querySelector("#stat-goal").textContent = String(goalValue);

  const goalReached = entries.length >= goalValue;
  document.querySelector("#goal-progress").textContent = goalReached
    ? `${activeRange === "today" ? "Daily" : activeRange === "month" ? "Monthly" : "Weekly"} goal reached — great work!`
    : `${Math.max(0, goalValue - entries.length)} more to reach your goal`;

  const recent = [...workouts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);
  const list = document.querySelector("#recent-workouts");
  list.replaceChildren(...recent.map((entry) => makeWorkoutRow(entry)));
  document.querySelector("#empty-recent").hidden = recent.length > 0;
}

function renderHistory() {
  const list = document.querySelector("#history-list");
  list.replaceChildren();
  const entries = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  document.querySelector("#empty-history").hidden = entries.length > 0;

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "history-row";
    const main = document.createElement("div");
    main.className = "history-main";
    const dot = document.createElement("span");
    dot.className = "workout-dot";
    dot.setAttribute("aria-hidden", "true");
    dot.textContent = ICONS[entry.exercise] || "✦";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.exercise;
    const details = document.createElement("span");
    details.textContent = entry.mode === "activity"
      ? `${Number(entry.steps || 0).toLocaleString()} steps · ${(Number(entry.distanceMeters || 0) / 1000).toFixed(2)} km`
      : `${entry.sets} set${Number(entry.sets) === 1 ? "" : "s"} · ${entry.reps} reps/set${entry.mode === "camera" ? " · camera count" : ""}`;
    copy.append(title, details);
    main.append(dot, copy);

    const meta = document.createElement("span");
    meta.className = "history-meta";
    meta.textContent = `${formatDate(entry.date)}${entry.duration ? ` · ${entry.duration} min` : ""}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${entry.exercise} workout`);
    remove.addEventListener("click", () => deleteWorkout(entry.id));

    row.append(main, meta, remove);
    if (entry.notes) {
      const note = document.createElement("span");
      note.className = "history-meta";
      note.textContent = entry.notes;
      row.append(note);
    }
    list.append(row);
  }
}

function renderProfile() {
  document.querySelector("#profile-name").value = profile.name || "";
  document.querySelector("#profile-age").value = profile.age ?? "";
  document.querySelector("#profile-weight").value = profile.weight ?? "";
  document.querySelector("#profile-height").value = profile.height ?? "";
  document.querySelector("#profile-goal").value = profile.weeklyGoal || 3;
  document.querySelector("#profile-focus").value = profile.focus || "general";
  const heightInMeters = Number(profile.height) / 100;
  const weight = Number(profile.weight);
  if (heightInMeters > 0 && weight > 0) {
    document.querySelector("#bmi-value").textContent = (weight / (heightInMeters * heightInMeters)).toFixed(1);
    document.querySelector("#bmi-caption").textContent = "BMI estimate (kg/m²). This is only a rough screening measure.";
  } else {
    document.querySelector("#bmi-value").textContent = "—";
    document.querySelector("#bmi-caption").textContent = "Add height and weight to see an optional BMI estimate.";
  }
}

function renderAll() {
  renderDashboard();
  renderHistory();
  renderProfile();
}

function showView(name) {
  const viewName = ["dashboard", "workout", "history", "profile"].includes(name) ? name : "dashboard";
  for (const view of document.querySelectorAll(".view")) {
    const active = view.id === `view-${viewName}`;
    view.classList.toggle("active", active);
    view.hidden = !active;
  }
  for (const button of document.querySelectorAll("[data-view]")) {
    button.classList.toggle("active", button.dataset.view === viewName);
  }
  if (location.hash !== `#${viewName}`) {
    history.replaceState(null, "", `#${viewName}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addWorkout({ exercise, sets, reps, duration, notes = "", mode = "manual", steps, distanceMeters }) {
  const entry = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    exercise,
    sets: Number(sets),
    reps: Number(reps),
    duration: Number(duration),
    notes: String(notes).trim(),
    mode,
    date: new Date().toISOString()
  };
  if (mode === "activity") {
    entry.steps = Number(steps || 0);
    entry.distanceMeters = Number(distanceMeters || 0);
  }
  workouts = [entry, ...workouts];
  if (!saveStorage(STORAGE_KEYS.workouts, workouts)) {
    workouts = workouts.slice(1);
    return false;
  }
  renderAll();
  showToast(`${exercise} saved to your workout history.`);
  return true;
}

function deleteWorkout(id) {
  const updated = workouts.filter((entry) => entry.id !== id);
  if (updated.length === workouts.length) return;
  workouts = updated;
  if (saveStorage(STORAGE_KEYS.workouts, workouts)) {
    renderAll();
    showToast("Workout removed from this device.");
  }
}

function formatActivityTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateActivityDisplay() {
  const elapsed = activityTracker.elapsedMs +
    (activityTracker.state === "running" ? Date.now() - activityTracker.startedAt : 0);
  document.querySelector("#activity-time").textContent = formatActivityTime(elapsed);
  document.querySelector("#activity-steps").textContent = activityTracker.steps.toLocaleString();
  document.querySelector("#activity-distance").innerHTML =
    `${(activityTracker.distanceMeters / 1000).toFixed(2)} <small>km</small>`;

  const running = activityTracker.state === "running";
  const canFinish = running || activityTracker.state === "paused";
  document.querySelector("#activity-start").disabled = running || activityTracker.starting;
  document.querySelector("#activity-pause").disabled = !canFinish;
  document.querySelector("#activity-finish").disabled = !canFinish;
  document.querySelector("#activity-pause").textContent = activityTracker.state === "paused" ? "Resume" : "Pause";
  document.querySelector("#activity-start").textContent = `Start ${activityTracker.mode === "walk" ? "walking" : "running"}`;
  document.querySelectorAll("[data-activity-mode]").forEach((button) => {
    button.disabled = activityTracker.starting || running || activityTracker.state === "paused";
    button.classList.toggle("active", button.dataset.activityMode === activityTracker.mode);
  });
}

function setActivityStatus(message, kind = "") {
  const status = document.querySelector("#activity-status");
  status.textContent = message;
  status.classList.toggle("error", kind === "error");
  status.classList.toggle("success", kind === "success");
}

function handleDeviceMotion(event) {
  const acceleration = event.acceleration || event.accelerationIncludingGravity;
  if (!acceleration || !Number.isFinite(acceleration.x) ||
    !Number.isFinite(acceleration.y) || !Number.isFinite(acceleration.z)) {
    return;
  }

  const magnitude = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
  if (activityTracker.baseline === null) {
    activityTracker.baseline = magnitude;
    return;
  }

  const deviation = Math.abs(magnitude - activityTracker.baseline);
  activityTracker.baseline = activityTracker.baseline * 0.9 + magnitude * 0.1;
  const now = event.timeStamp || performance.now();
  if (deviation > 1.25 && activityTracker.stepArmed && now - activityTracker.lastStepAt > 300) {
    activityTracker.steps += 1;
    activityTracker.lastStepAt = now;
    activityTracker.stepArmed = false;
    updateActivityDisplay();
  } else if (deviation < 0.35) {
    activityTracker.stepArmed = true;
  }
}

function distanceBetween(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function handleActivityPosition(position) {
  if (activityTracker.state !== "running" || position.coords.accuracy > 50) return;
  const current = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy
  };
  if (activityTracker.lastPosition) {
    const distance = distanceBetween(activityTracker.lastPosition, current);
    if (distance <= Math.max(100, activityTracker.lastPosition.accuracy + current.accuracy)) {
      activityTracker.distanceMeters += distance;
      updateActivityDisplay();
    }
  }
  activityTracker.lastPosition = current;
}

function stopActivitySensors() {
  window.removeEventListener("devicemotion", handleDeviceMotion);
  if (activityTracker.watchId !== null) {
    navigator.geolocation.clearWatch(activityTracker.watchId);
    activityTracker.watchId = null;
  }
  if (activityTracker.timerId !== null) {
    clearInterval(activityTracker.timerId);
    activityTracker.timerId = null;
  }
}

async function requestMotionPermission() {
  const MotionEvent = window.DeviceMotionEvent;
  if (!MotionEvent) {
    activityTracker.motionAvailable = false;
    return false;
  }
  if (typeof MotionEvent.requestPermission === "function") {
    const permission = await MotionEvent.requestPermission();
    activityTracker.motionAvailable = permission === "granted";
    return activityTracker.motionAvailable;
  }
  activityTracker.motionAvailable = true;
  return true;
}

async function startActivity() {
  if (activityTracker.state === "running" || activityTracker.starting) return;
  activityTracker.starting = true;
  updateActivityDisplay();
  if (activityTracker.state === "idle" || activityTracker.state === "finished") {
    activityTracker.steps = 0;
    activityTracker.distanceMeters = 0;
    activityTracker.elapsedMs = 0;
    activityTracker.lastPosition = null;
    activityTracker.baseline = null;
    activityTracker.lastStepAt = 0;
    activityTracker.stepArmed = true;
  }

  let motionAllowed = false;
  try {
    motionAllowed = await requestMotionPermission();
  } catch (error) {
    console.error("Could not request motion sensor permission.", error);
    activityTracker.motionAvailable = false;
  }

  activityTracker.starting = false;
  activityTracker.state = "running";
  activityTracker.startedAt = Date.now();
  activityTracker.baseline = null;
  activityTracker.lastPosition = null;
  if (motionAllowed) {
    window.addEventListener("devicemotion", handleDeviceMotion);
  }
  if (navigator.geolocation) {
    activityTracker.watchId = navigator.geolocation.watchPosition(
      handleActivityPosition,
      (error) => {
        console.warn("Outdoor activity location tracking is unavailable.", error);
        setActivityStatus("Activity timer is running. Allow location access for GPS distance; steps require phone motion sensors.", "error");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }
  activityTracker.timerId = setInterval(updateActivityDisplay, 1000);
  const gpsAvailable = Boolean(navigator.geolocation);
  setActivityStatus(motionAllowed
    ? `Tracking started. Keep your phone with you; ${gpsAvailable ? "GPS distance may take a moment to appear." : "GPS is not available on this device."}`
    : `Timer started, but this device did not grant motion access. ${gpsAvailable ? "GPS distance may still be recorded." : "GPS is not available either."}`,
    motionAllowed ? "" : "error");
  updateActivityDisplay();
}

function pauseActivity() {
  if (activityTracker.state === "running") {
    activityTracker.elapsedMs += Date.now() - activityTracker.startedAt;
    activityTracker.state = "paused";
    stopActivitySensors();
    setActivityStatus("Activity paused. Resume when you’re ready.");
  } else if (activityTracker.state === "paused") {
    startActivity();
    return;
  } else {
    return;
  }
  updateActivityDisplay();
}

function finishActivity() {
  if (activityTracker.state === "running") {
    activityTracker.elapsedMs += Date.now() - activityTracker.startedAt;
  }
  stopActivitySensors();
  activityTracker.state = "paused";
  const exercise = activityTracker.mode === "walk" ? "Walking" : "Running";
  const saved = addWorkout({
    exercise,
    sets: 1,
    reps: 0,
    duration: Math.round(activityTracker.elapsedMs / 60000),
    mode: "activity",
    steps: activityTracker.steps,
    distanceMeters: activityTracker.distanceMeters
  });
  if (saved) {
    activityTracker.state = "finished";
    setActivityStatus(`${exercise} saved: ${activityTracker.steps.toLocaleString()} estimated steps, ${(activityTracker.distanceMeters / 1000).toFixed(2)} km.`, "success");
  }
  updateActivityDisplay();
}

function selectActivityMode(mode) {
  if (activityTracker.state === "running" || activityTracker.state === "paused") return;
  activityTracker.mode = mode === "run" ? "run" : "walk";
  updateActivityDisplay();
}

function fillExerciseOptions() {
  for (const name of EXERCISES) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    exerciseSelect.append(option);
  }
}

function setCameraMessage(message, kind = "") {
  cameraMessage.textContent = message;
  cameraMessage.classList.toggle("error", kind === "error");
  cameraMessage.classList.toggle("success", kind === "success");
}

function cameraExerciseKind() {
  return document.querySelector("#camera-exercise").value.toLowerCase().includes("push-up")
    ? "push-up"
    : "sit-up";
}

function angleAtJoint(first, joint, last) {
  const aspectRatio = cameraVideo.videoWidth && cameraVideo.videoHeight
    ? cameraVideo.videoWidth / cameraVideo.videoHeight
    : 1;
  const a = Math.atan2(first.y - joint.y, (first.x - joint.x) * aspectRatio);
  const b = Math.atan2(last.y - joint.y, (last.x - joint.x) * aspectRatio);
  let degrees = Math.abs((a - b) * 180 / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

function visible(point) {
  return point && Number(point.visibility ?? 1) >= 0.6;
}

function chooseSide(landmarks, leftIds, rightIds) {
  const visibilityScore = (ids) => ids.reduce((sum, id) => sum + Number(landmarks[id]?.visibility || 0), 0);
  const leftScore = visibilityScore(leftIds);
  const rightScore = visibilityScore(rightIds);
  return leftScore >= rightScore ? leftIds : rightIds;
}

function getExerciseMetrics(landmarks, type, exercise) {
  const ids = type === "push-up"
    ? chooseSide(landmarks, [11, 13, 15, 23, 25, 27], [12, 14, 16, 24, 26, 28])
    : chooseSide(landmarks, [11, 23, 25, 27], [12, 24, 26, 28]);
  const [shoulder, joint, last] = ids.slice(0, 3).map((id) => landmarks[id]);
  if (!visible(landmarks[0]) || !ids.every((id) => visible(landmarks[id]))) return null;

  const angle = angleAtJoint(shoulder, joint, last);
  const hipAngle = type === "push-up"
    ? angleAtJoint(landmarks[ids[0]], landmarks[ids[3]], landmarks[exercise.toLowerCase().includes("knee") ? ids[4] : ids[5]])
    : null;
  const aligned = type !== "push-up" || (exercise.toLowerCase().includes("pike")
    ? hipAngle >= 60 && hipAngle <= 145
    : hipAngle >= 145);
  return { angle, aligned };
}

function evaluatePosture(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const nose = landmarks[0];
  const leftEye = landmarks[1];
  const rightEye = landmarks[2];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !nose) {
    return { ok: false, reason: "Wrong move — keep shoulders, hips, and face visible." };
  }

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const torsoShift = Math.abs(shoulderCenterX - hipCenterX);
  const headShift = Math.abs(nose.x - shoulderCenterX);
  const eyeVisible = visible(leftEye) || visible(rightEye);

  if (!eyeVisible) {
    return { ok: false, reason: "Wrong move — turn your face toward the camera." };
  }

  if (torsoShift > 0.18 || headShift > 0.22) {
    return { ok: false, reason: "Wrong move — keep your torso straight and square to the camera." };
  }

  return { ok: true, reason: "" };
}

function drawPoseWarning(message) {
  if (!poseCanvas.width || !poseCanvas.height) return;
  poseContext.fillStyle = "rgba(120, 32, 26, 0.78)";
  poseContext.fillRect(16, 16, Math.min(280, poseCanvas.width - 32), 46);
  poseContext.strokeStyle = "rgba(255, 205, 175, 0.9)";
  poseContext.lineWidth = 2;
  poseContext.strokeRect(16, 16, Math.min(280, poseCanvas.width - 32), 46);
  poseContext.fillStyle = "#fff7f1";
  poseContext.font = '700 16px "Segoe UI", sans-serif';
  poseContext.fillText("Wrong move", 28, 44);
  poseContext.font = '600 11px "Segoe UI", sans-serif';
  poseContext.fillStyle = "#ffd7c8";
  const wrapped = message.length > 34 ? `${message.slice(0, 34)}…` : message;
  poseContext.fillText(wrapped, 28, 58);
}

const POSE_CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23],
  [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [1, 5], [2, 5]
];

function drawPose(landmarks) {
  if (!cameraVideo.videoWidth) return;
  if (poseCanvas.width !== cameraVideo.videoWidth || poseCanvas.height !== cameraVideo.videoHeight) {
    poseCanvas.width = cameraVideo.videoWidth;
    poseCanvas.height = cameraVideo.videoHeight;
  }
  poseContext.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
  poseContext.lineWidth = Math.max(3, poseCanvas.width / 180);
  poseContext.strokeStyle = "#87d4af";
  poseContext.fillStyle = "#fef6ef";
  for (const [first, second] of POSE_CONNECTIONS) {
    if (!visible(landmarks[first]) || !visible(landmarks[second])) continue;
    poseContext.beginPath();
    poseContext.moveTo(landmarks[first].x * poseCanvas.width, landmarks[first].y * poseCanvas.height);
    poseContext.lineTo(landmarks[second].x * poseCanvas.width, landmarks[second].y * poseCanvas.height);
    poseContext.stroke();
  }

  const faceAndHands = [0, 1, 2, 3, 4, 7, 8, 9, 10, 13, 14, 15, 16];
  for (const id of faceAndHands) {
    const point = landmarks[id];
    if (!visible(point)) continue;
    const x = point.x * poseCanvas.width;
    const y = point.y * poseCanvas.height;
    const radius = [0, 1, 2, 3, 4].includes(id) ? Math.max(4, poseCanvas.width / 110) : Math.max(5, poseCanvas.width / 90);
    poseContext.beginPath();
    poseContext.arc(x, y, radius, 0, Math.PI * 2);
    poseContext.fillStyle = [0, 1, 2, 3, 4].includes(id) ? "#ffd9a8" : "#f6f1ff";
    poseContext.fill();
  }
}

function updateRepCounter(angle, timestamp) {
  if (angle === null) {
    angleSamples = [];
    cameraPhase = "unarmed";
    setCameraMessage("Step back and turn sideways. Keep your head, hands, hips, knees, and feet visible.");
    return;
  }

  angleSamples.push(angle);
  if (angleSamples.length > 5) angleSamples.shift();
  if (angleSamples.length < 5) {
    setCameraMessage("Hold your starting position while the tracker checks your form.");
    return;
  }

  const sortedAngles = [...angleSamples].sort((a, b) => a - b);
  const smoothedAngle = sortedAngles[Math.floor(sortedAngles.length / 2)];
  const kind = cameraExerciseKind();
  const startingAngle = kind === "push-up" ? 150 : 130;

  if (cameraPhase === "unarmed") {
    const ready = smoothedAngle >= startingAngle;
    if (ready) {
      cameraPhase = kind === "push-up" ? "top" : "bottom";
      setCameraMessage(kind === "push-up"
        ? "Starting position detected. Lower with control."
        : "Starting position detected. Sit up with control.");
    } else {
      setCameraMessage(kind === "push-up"
        ? "Start with your arms extended and body in a straight line."
        : "Start lying back with your head, hips, and knees visible.");
    }
    return;
  }

  if (kind === "push-up") {
    if (cameraPhase === "top" && smoothedAngle < 95) {
      cameraPhase = "bottom";
      setCameraMessage("Good depth. Push back up to complete the rep.");
    } else if (cameraPhase === "bottom" && smoothedAngle > 155) {
      cameraPhase = "top";
      const counted = timestamp - lastRepAt > 900;
      if (counted) {
        cameraRepCount += 1;
        lastRepAt = timestamp;
        repCountOutput.textContent = String(cameraRepCount);
      }
      setCameraMessage(counted
        ? "Rep counted. Lower with control for your next rep."
        : "Move more slowly between reps; this repetition was not counted.", counted ? "success" : "");
    } else if (cameraPhase === "top") {
      setCameraMessage("Start from a straight-arm position, then lower with control.");
    }
  } else if (cameraPhase === "bottom" && smoothedAngle < 100) {
    cameraPhase = "up";
    setCameraMessage("Nice. Return to the lying position to complete the rep.");
  } else if (cameraPhase === "up" && smoothedAngle > 140) {
    cameraPhase = "bottom";
    const counted = timestamp - lastRepAt > 900;
    if (counted) {
      cameraRepCount += 1;
      lastRepAt = timestamp;
      repCountOutput.textContent = String(cameraRepCount);
    }
    setCameraMessage(counted
      ? "Rep counted. Sit up again when you're ready."
      : "Move more slowly between reps; this repetition was not counted.", counted ? "success" : "");
  } else if (cameraPhase === "bottom") {
    setCameraMessage("Start lying back with your head, hips, and knees visible.");
  }
}

function detectFrame(timestamp) {
  if (!poseLandmarker || cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationFrame = requestAnimationFrame(detectFrame);
    return;
  }
  try {
    const result = poseLandmarker.detectForVideo(cameraVideo, timestamp);
    const landmarks = result.landmarks?.[0];
    if (landmarks) {
      drawPose(landmarks);
      const selectedExercise = document.querySelector("#camera-exercise").value;
      const posture = evaluatePosture(landmarks, selectedExercise);
      if (!posture.ok) {
        drawPoseWarning(posture.reason);
        angleSamples = [];
        cameraPhase = "unarmed";
        setCameraMessage(posture.reason, "error");
        return;
      }

      const metrics = getExerciseMetrics(landmarks, cameraExerciseKind(), selectedExercise);
      if (metrics && !metrics.aligned) {
        angleSamples = [];
        cameraPhase = "unarmed";
        setCameraMessage("Hold a steady starting pose and keep your full body visible.");
      } else {
        updateRepCounter(metrics?.angle ?? null, timestamp);
      }
    } else {
      angleSamples = [];
      cameraPhase = "unarmed";
      poseContext.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
      setCameraMessage("Step back until your head, hands, and feet are all in frame.");
    }
  } catch (error) {
    console.error("Camera pose detection stopped unexpectedly.", error);
    setCameraMessage("Pose tracking stopped because of an error. Stop the camera and try again.", "error");
    stopCamera();
    return;
  }
  animationFrame = requestAnimationFrame(detectFrame);
}

async function loadPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;
  if (poseLandmarkerPromise) return poseLandmarkerPromise;
  poseLandmarkerPromise = (async () => {
    const visionVersion = "0.10.21";
    const visionModuleUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${visionVersion}`;
    const vision = await import(visionModuleUrl);
    const fileset = await vision.FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${visionVersion}/wasm`
    );
    const options = {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5
    };
    try {
      poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, options);
    } catch (gpuError) {
      console.warn("GPU pose tracking was unavailable; retrying on CPU.", gpuError);
      options.baseOptions.delegate = "CPU";
      poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, options);
    }
    return poseLandmarker;
  })();
  try {
    return await poseLandmarkerPromise;
  } catch (error) {
    poseLandmarkerPromise = null;
    throw error;
  }
}

async function startCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setCameraMessage("Camera access requires HTTPS or localhost. Open the app from a secure website or this computer's localhost.", "error");
    return;
  }
  cameraStartButton.disabled = true;
  setCameraMessage("Requesting camera access…");
  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    cameraVideo.srcObject = activeStream;
    await cameraVideo.play();
    cameraFrame.classList.add("is-live");
    setCameraMessage("Loading on-device pose tracker. The first load needs an internet connection…");
    await loadPoseLandmarker();
    cameraStartedAt = Date.now();
    cameraRepCount = 0;
    lastRepAt = 0;
    cameraPhase = "unarmed";
    angleSamples = [];
    repCountOutput.textContent = "0";
    cameraStopButton.disabled = false;
    cameraSaveButton.disabled = false;
    setCameraMessage("Tracker ready. Keep your full body in view and begin in the starting position.");
    animationFrame = requestAnimationFrame(detectFrame);
  } catch (error) {
    console.error("Could not start the workout camera or pose tracker.", error);
    if (activeStream) {
      for (const track of activeStream.getTracks()) track.stop();
      activeStream = null;
    }
    cameraVideo.srcObject = null;
    cameraFrame.classList.remove("is-live");
    const message = error.name === "NotAllowedError"
      ? "Camera permission was denied. Allow camera access in your browser settings, then try again."
      : error.name === "NotFoundError"
        ? "No camera was found on this device."
        : "Could not start camera tracking. Check your connection and camera permission, then try again.";
    setCameraMessage(message, "error");
  } finally {
    cameraStartButton.disabled = false;
  }
}

function stopCamera() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  if (activeStream) {
    for (const track of activeStream.getTracks()) track.stop();
    activeStream = null;
  }
  cameraVideo.srcObject = null;
  cameraFrame.classList.remove("is-live");
  angleSamples = [];
  cameraStopButton.disabled = true;
  cameraSaveButton.disabled = true;
  cameraStartButton.disabled = false;
  poseContext.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
}

function saveCameraSet() {
  if (cameraRepCount < 1) {
    showToast("Complete at least one rep before saving this set.");
    return;
  }
  const duration = Math.max(0, Math.round((Date.now() - cameraStartedAt) / 60000));
  const exercise = document.querySelector("#camera-exercise").value;
  if (addWorkout({ exercise, sets: 1, reps: cameraRepCount, duration, mode: "camera" })) {
    stopCamera();
    setCameraMessage(`${cameraRepCount} reps saved. Great work!`, "success");
  }
}

function handleWorkoutSubmit(event) {
  event.preventDefault();
  const selected = exerciseSelect.value;
  const exercise = selected === "Custom activity"
    ? document.querySelector("#custom-exercise").value.trim()
    : selected;
  const sets = Number(document.querySelector("#sets").value);
  const reps = Number(document.querySelector("#reps").value);
  const duration = Number(document.querySelector("#duration").value);
  const notes = document.querySelector("#notes").value;
  if (!exercise) {
    showToast("Enter a name for your custom activity.");
    return;
  }
  if (!Number.isInteger(sets) || sets < 1 || !Number.isInteger(reps) || reps < 0 ||
    !Number.isInteger(duration) || duration < 0 || (reps === 0 && duration === 0)) {
    showToast("Add at least one rep or one minute, and check your sets and values.");
    return;
  }
  if (addWorkout({ exercise, sets, reps, duration, notes })) {
    event.target.reset();
    document.querySelector("#sets").value = "3";
    document.querySelector("#reps").value = "10";
    document.querySelector("#duration").value = "10";
    document.querySelector("#custom-exercise-wrap").hidden = true;
    showView("dashboard");
  }
}

function handleProfileSubmit(event) {
  event.preventDefault();
  const numberOrNull = (selector) => {
    const value = document.querySelector(selector).value;
    return value === "" ? null : Number(value);
  };
  profile = {
    name: document.querySelector("#profile-name").value.trim(),
    age: numberOrNull("#profile-age"),
    weight: numberOrNull("#profile-weight"),
    height: numberOrNull("#profile-height"),
    weeklyGoal: Number(document.querySelector("#profile-goal").value),
    focus: document.querySelector("#profile-focus").value
  };
  if (saveStorage(STORAGE_KEYS.profile, profile)) {
    renderAll();
    showToast("Your details have been saved on this device.");
  }
}

function clearAllData() {
  if (!window.confirm("Clear all workout history and profile details from this browser? This cannot be undone.")) return;
  try {
    localStorage.removeItem(STORAGE_KEYS.workouts);
    localStorage.removeItem(STORAGE_KEYS.profile);
  } catch (error) {
    console.error("Could not clear app data.", error);
    showToast("The browser could not clear app data. Try clearing this site's storage in browser settings.");
    return;
  }
  workouts = [];
  profile = { ...DEFAULT_PROFILE };
  renderAll();
  showToast("Workout history and details were cleared.");
}

function configureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pendingInstallPrompt = event;
    document.querySelector("#install-button").hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    pendingInstallPrompt = null;
    document.querySelector("#install-button").hidden = true;
    showToast("GRITCORE is installed and ready.");
  });
  document.querySelector("#install-button").addEventListener("click", async () => {
    if (!pendingInstallPrompt) {
      showToast("Use your browser menu and choose Add to Home Screen or Install app.");
      return;
    }
    pendingInstallPrompt.prompt();
    await pendingInstallPrompt.userChoice;
    pendingInstallPrompt = null;
    document.querySelector("#install-button").hidden = true;
  });
}

function initialize() {
  fillExerciseOptions();
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date()).toUpperCase();
  renderAll();

  for (const button of document.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => showView(button.dataset.view));
  }
  for (const button of document.querySelectorAll("[data-go-workout]")) {
    button.addEventListener("click", () => showView("workout"));
  }
  for (const button of document.querySelectorAll("[data-view-link]")) {
    button.addEventListener("click", () => showView(button.dataset.viewLink));
  }
  for (const button of document.querySelectorAll("[data-quick-start]")) {
    button.addEventListener("click", () => {
      exerciseSelect.value = button.dataset.quickStart;
      showView("workout");
    });
  }
  for (const chip of document.querySelectorAll(".summary-chip")) {
    chip.addEventListener("click", () => {
      for (const item of document.querySelectorAll(".summary-chip")) {
        item.classList.toggle("active", item === chip);
      }
      renderDashboard();
    });
  }
  for (const card of document.querySelectorAll(".wellness-card")) {
    card.addEventListener("click", () => {
      const focus = card.dataset.focus;
      profile.focus = focus;
      if (saveStorage(STORAGE_KEYS.profile, profile)) {
        renderProfile();
      }
      showToast(`Focus set to ${focus.charAt(0).toUpperCase() + focus.slice(1)}.`);
    });
  }
  document.querySelector("#activity-start").addEventListener("click", startActivity);
  document.querySelector("#activity-pause").addEventListener("click", pauseActivity);
  document.querySelector("#activity-finish").addEventListener("click", finishActivity);
  for (const button of document.querySelectorAll("[data-activity-mode]")) {
    button.addEventListener("click", () => selectActivityMode(button.dataset.activityMode));
  }
  updateActivityDisplay();
  exerciseSelect.addEventListener("change", () => {
    document.querySelector("#custom-exercise-wrap").hidden = exerciseSelect.value !== "Custom activity";
  });
  document.querySelector("#workout-form").addEventListener("submit", handleWorkoutSubmit);
  document.querySelector("#profile-form").addEventListener("submit", handleProfileSubmit);
  document.querySelector("#clear-data").addEventListener("click", clearAllData);
  cameraStartButton.addEventListener("click", startCamera);
  cameraStopButton.addEventListener("click", stopCamera);
  cameraSaveButton.addEventListener("click", saveCameraSet);
  document.querySelector("#camera-exercise").addEventListener("change", () => {
    cameraPhase = "unarmed";
    angleSamples = [];
    cameraRepCount = 0;
    lastRepAt = 0;
    cameraStartedAt = activeStream ? Date.now() : 0;
    repCountOutput.textContent = "0";
    setCameraMessage("Exercise changed. Begin from the starting position for a fresh count.");
  });
  window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
  showView(location.hash.slice(1));
  configureInstallPrompt();
  if (navigator.storage?.persist) {
    navigator.storage.persist().then((persisted) => {
      if (!persisted) console.info("The browser did not grant persistent storage; local data may be removed if site data is cleared.");
    }).catch((error) => {
      console.error("Could not request persistent storage for workout data.", error);
    });
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Could not register the offline app shell.", error);
      showToast("Offline installation is unavailable in this browser session.");
    });
  }
}

initialize();
