const STORE = "study-planner-v1";
const FOCUS_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

let tasks = load();
let filter = "active";
let query = "";
let editingId = null;
let timer = { taskId: null, mode: "focus", left: FOCUS_SECS, endAt: null, handle: null };

const $ = (id) => document.getElementById(id);

/* ---------- storage ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(tasks));
  } catch (e) {
    console.error("Could not save tasks", e);
  }
}

/* ---------- helpers ---------- */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const a = new Date(todayStr() + "T00:00:00");
  const b = new Date(dateStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}
function isOverdue(t) {
  const d = daysUntil(t.due);
  return !t.done && d !== null && d < 0;
}
// Higher score = do sooner.
function score(t) {
  const d = daysUntil(t.due);
  let urgency = 0;
  if (d !== null) urgency = d < 0 ? 10 : Math.max(0, 7 - d);
  return Number(t.priority) * 2 + urgency;
}
function dueLabel(t) {
  const d = daysUntil(t.due);
  if (d === null) return "No due date";
  if (d < 0) return "Overdue by " + Math.abs(d) + (Math.abs(d) === 1 ? " day" : " days");
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return "Due in " + d + " days";
}
const PRIORITY_NAME = { 3: "High", 2: "Medium", 1: "Low" };

/* ---------- task actions ---------- */
function resetForm() {
  editingId = null;
  $("taskForm").reset();
  $("priority").value = "2";
  $("formTitle").textContent = "Add a task";
  $("saveBtn").textContent = "Add task";
  $("cancelEdit").hidden = true;
}

$("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    title: $("title").value.trim(),
    subject: $("subject").value.trim(),
    due: $("due").value,
    priority: $("priority").value,
    estimate: Number($("estimate").value) || 0,
  };
  if (!data.title) return;

  if (editingId) {
    const t = tasks.find((x) => x.id === editingId);
    if (t) Object.assign(t, data);
  } else {
    tasks.push({ id: Date.now().toString(36), done: false, studied: 0, ...data });
  }
  save();
  resetForm();
  render();
});

$("cancelEdit").addEventListener("click", resetForm);

function toggleDone(id) {
  const t = tasks.find((x) => x.id === id);
  if (t) t.done = !t.done;
  save();
  render();
}
function removeTask(id) {
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter((x) => x.id !== id);
  if (timer.taskId === id) resetTimer(true);
  if (editingId === id) resetForm();
  save();
  render();
}
function editTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  $("title").value = t.title;
  $("subject").value = t.subject;
  $("due").value = t.due;
  $("priority").value = t.priority;
  $("estimate").value = t.estimate || "";
  $("formTitle").textContent = "Edit task";
  $("saveBtn").textContent = "Save changes";
  $("cancelEdit").hidden = false;
  $("title").focus();
  $("taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------- filters ---------- */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    render();
  });
});
$("search").addEventListener("input", (e) => {
  query = e.target.value.trim().toLowerCase();
  render();
});

/* ---------- timer ---------- */
function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
function updateTimerUI() {
  $("timerDisplay").textContent = fmt(timer.left);
  $("timerMode").textContent = timer.mode === "focus" ? "Focus" : "Break";
  $("timerToggle").textContent = timer.handle ? "Pause" : "Start";
  const t = tasks.find((x) => x.id === timer.taskId);
  $("timerTask").textContent = t ? t.title : "Pick a task with Start";
  document.title = timer.handle ? fmt(timer.left) + " · Study Planner" : "Smart Task & Study Planner";
}
function tick() {
  timer.left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  if (timer.left === 0) {
    clearInterval(timer.handle);
    timer.handle = null;
    if (timer.mode === "focus") {
      const t = tasks.find((x) => x.id === timer.taskId);
      if (t) {
        t.studied = (t.studied || 0) + 25;
        save();
      }
      timer.mode = "break";
      timer.left = BREAK_SECS;
    } else {
      timer.mode = "focus";
      timer.left = FOCUS_SECS;
    }
    alert(timer.mode === "break" ? "Focus session done. Take a 5 minute break." : "Break over. Ready for the next session?");
    render();
  }
  updateTimerUI();
}
function startTimer(taskId) {
  if (taskId && taskId !== timer.taskId) {
    resetTimer(true);
    timer.taskId = taskId;
  }
  if (timer.handle) return;
  timer.endAt = Date.now() + timer.left * 1000;
  timer.handle = setInterval(tick, 500);
  updateTimerUI();
}
function pauseTimer() {
  clearInterval(timer.handle);
  timer.handle = null;
  updateTimerUI();
}
function resetTimer(keepTask) {
  clearInterval(timer.handle);
  timer.handle = null;
  timer.mode = "focus";
  timer.left = FOCUS_SECS;
  if (!keepTask) timer.taskId = null;
  updateTimerUI();
}
$("timerToggle").addEventListener("click", () => {
  if (timer.handle) pauseTimer();
  else startTimer(timer.taskId);
});
$("timerReset").addEventListener("click", () => resetTimer(true));

/* ---------- render ---------- */
function renderStats() {
  const done = tasks.filter((t) => t.done).length;
  const open = tasks.length - done;
  const overdue = tasks.filter(isOverdue).length;
  const minutes = tasks.reduce((sum, t) => sum + (t.studied || 0), 0);
  $("statDone").textContent = done;
  $("statOpen").textContent = open;
  $("statOverdue").textContent = overdue;
  $("statMinutes").textContent = minutes;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  $("barFill").style.width = pct + "%";
  $("barWrap").setAttribute("aria-valuenow", pct);
}

function renderTopThree() {
  const list = $("topThree");
  list.textContent = "";
  const top = tasks.filter((t) => !t.done).sort((a, b) => score(b) - score(a)).slice(0, 3);
  if (!top.length) {
    const li = document.createElement("li");
    li.textContent = "Nothing open. Add a task.";
    list.appendChild(li);
    return;
  }
  top.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t.title;
    const small = document.createElement("small");
    small.textContent = dueLabel(t);
    li.appendChild(small);
    list.appendChild(li);
  });
}

function renderList() {
  const list = $("taskList");
  list.textContent = "";
  let shown = tasks.filter((t) => {
    if (filter === "active" && t.done) return false;
    if (filter === "done" && !t.done) return false;
    if (query && !(t.title + " " + t.subject).toLowerCase().includes(query)) return false;
    return true;
  });
  shown.sort((a, b) => (a.done - b.done) || (score(b) - score(a)));

  const empty = $("empty");
  empty.hidden = shown.length > 0;
  if (!shown.length) {
    empty.textContent = tasks.length
      ? "No tasks match this view."
      : "No tasks yet. Add your first task above.";
  }

  shown.forEach((t) => {
    const li = document.createElement("li");
    li.className = "task p" + t.priority + (t.done ? " done" : "") + (isOverdue(t) ? " overdue" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.setAttribute("aria-label", "Mark done: " + t.title);
    cb.addEventListener("change", () => toggleDone(t.id));

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "t-title";
    title.textContent = t.title;

    const meta = document.createElement("div");
    meta.className = "t-meta";
    const parts = [];
    if (t.subject) parts.push(t.subject);
    parts.push(PRIORITY_NAME[t.priority] + " priority");
    if (t.estimate) parts.push(t.estimate + " min est.");
    if (t.studied) parts.push(t.studied + " min studied");
    parts.forEach((p) => {
      const s = document.createElement("span");
      s.textContent = p;
      meta.appendChild(s);
    });
    const due = document.createElement("span");
    due.textContent = dueLabel(t);
    if (isOverdue(t)) due.className = "late";
    meta.appendChild(due);

    body.append(title, meta);
    li.append(cb, body);

    const actions = document.createElement("div");
    actions.className = "t-actions";
    const mk = (label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ghost small";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };
    if (!t.done) actions.appendChild(mk("Start focus", () => startTimer(t.id)));
    actions.appendChild(mk("Edit", () => editTask(t.id)));
    actions.appendChild(mk("Delete", () => removeTask(t.id)));
    li.appendChild(actions);

    list.appendChild(li);
  });
}

function render() {
  renderStats();
  renderTopThree();
  renderList();
  updateTimerUI();
}

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});
render();
