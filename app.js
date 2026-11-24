const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
let currentMode = "focus";
let remaining = MODES.focus;
let timerId = null;
let audioCtx = null;
let noiseNode = null;
let noiseGain = null;

const clockEl = document.getElementById("clockDisplay");
const progressEl = document.getElementById("progressFill");
const toggleBtn = document.getElementById("toggleBtn");
const resetBtn = document.getElementById("resetBtn");
const noiseBtn = document.getElementById("noiseBtn");
const sessionEl = document.getElementById("sessionCount");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

let sessions = Number(localStorage.getItem("focusdesk_sessions") || 0);
let tasks = JSON.parse(localStorage.getItem("focusdesk_tasks") || "[]");
sessionEl.textContent = sessions;

function renderClock() {
  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  clockEl.textContent = `${m}:${s}`;
  document.title = `${m}:${s} — FocusDesk`;
  const pct = ((MODES[currentMode] - remaining) / MODES[currentMode]) * 100;
  progressEl.style.width = `${pct}%`;
}

function playChime() {
  const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx = ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(528, ctx.currentTime);
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.1);
}

function toggleNoise() {
  if (noiseNode) {
    noiseNode.stop();
    noiseNode.disconnect();
    noiseNode = null;
    noiseBtn.textContent = "Ambient Noise: Off";
    return;
  }
  const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx = ctx;
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 2.8;
  }
  noiseNode = ctx.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;
  noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.08;
  noiseNode.connect(noiseGain).connect(ctx.destination);
  noiseNode.start();
  noiseBtn.textContent = "Ambient Noise: Brown";
}

function startOrPause() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    toggleBtn.textContent = "Resume";
    return;
  }
  toggleBtn.textContent = "Pause";
  timerId = setInterval(() => {
    remaining -= 1;
    renderClock();
    if (remaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      playChime();
      if (currentMode === "focus") {
        sessions += 1;
        localStorage.setItem("focusdesk_sessions", String(sessions));
        sessionEl.textContent = sessions;
      }
      toggleBtn.textContent = "Start Focus";
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  remaining = MODES[currentMode];
  toggleBtn.textContent = "Start Focus";
  renderClock();
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    resetTimer();
  });
});

function renderTasks() {
  localStorage.setItem("focusdesk_tasks", JSON.stringify(tasks));
  taskList.innerHTML = "";
  tasks.forEach((task, idx) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""}`;
    li.innerHTML = `
      <label class="task-left">
        <input type="checkbox" ${task.done ? "checked" : ""} />
        <span></span>
      </label>
      <button class="del-btn" aria-label="Delete">Remove</button>
    `;
    li.querySelector("span").textContent = task.text;
    li.querySelector("input").addEventListener("change", () => {
      tasks[idx].done = !tasks[idx].done;
      renderTasks();
    });
    li.querySelector(".del-btn").addEventListener("click", () => {
      tasks.splice(idx, 1);
      renderTasks();
    });
    taskList.appendChild(li);
  });
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.push({ text, done: false });
  taskInput.value = "";
  renderTasks();
});

toggleBtn.addEventListener("click", startOrPause);
resetBtn.addEventListener("click", resetTimer);
noiseBtn.addEventListener("click", toggleNoise);

window.addEventListener("keydown", (e) => {
  if (document.activeElement === taskInput) return;
  if (e.code === "Space") { e.preventDefault(); startOrPause(); }
  if (e.key.toLowerCase() === "r") resetTimer();
});

renderClock();
renderTasks();
