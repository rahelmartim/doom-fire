// Doom Fire: three engines, one set of parameters.
import { GLSLFire } from "./engines/glsl.js";
import { GoFire } from "./engines/go.js";
import { JavaScriptFire } from "./engines/javascript.js";
import { PALETTES, rgba } from "./engines/palette.js";

const $ = (selector) => document.querySelector(selector);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    // The page policy blocks style attributes, so set the styles one by one.
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children);
  return node;
}

/* Parameters */

const KNOBS = [
  { key: "width", label: "Width", min: 10, max: 300, note: "pixels in a row" },
  { key: "height", label: "Height", min: 10, max: 200, note: "rows" },
  { key: "decay", label: "Decay", min: 0, max: 12, note: "how fast the fire cools" },
  { key: "wind", label: "Wind", min: -3, max: 3, note: "negative blows to the left" },
  { key: "source", label: "Source", min: 0, max: 36, note: "heat of the bottom row" },
  { key: "fps", label: "Speed", min: 1, max: 60, note: "steps in one second" },
];

const DEFAULTS = { width: 80, height: 40, decay: 3, wind: 0, source: 36, fps: 30, palette: "doom" };

const PRESETS = {
  Classic: { ...DEFAULTS },
  Windy: { ...DEFAULTS, wind: 1 },
  Storm: { ...DEFAULTS, decay: 4, wind: -2, fps: 45 },
  Tall: { ...DEFAULTS, height: 100, decay: 1 },
  Embers: { ...DEFAULTS, decay: 7, fps: 20 },
  "Blue flame": { ...DEFAULTS, decay: 2, palette: "blue" },
  Toxic: { ...DEFAULTS, wind: 1, palette: "green" },
  Smoke: { ...DEFAULTS, decay: 2, fps: 20, palette: "smoke" },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

function readURL() {
  const q = new URLSearchParams(location.search);
  const cfg = { ...DEFAULTS };
  for (const k of KNOBS) {
    if (q.has(k.key) && Number.isFinite(Number(q.get(k.key)))) cfg[k.key] = clamp(Number(q.get(k.key)), k.min, k.max);
  }
  if (PALETTES[q.get("palette")]) cfg.palette = q.get("palette");
  return cfg;
}

function writeURL() {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(cfg)) if (v !== DEFAULTS[k]) q.set(k, v);
  const query = q.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}

let cfg = readURL();
let lit = cfg.source; // the heat to go back to after "Put out"
let paused = false;

/* Engines */

const engines = [
  { engine: new JavaScriptFire(), node: $('[data-engine="javascript"]') },
  { engine: new GoFire(), node: $('[data-engine="go"]') },
  { engine: new GLSLFire(), node: $('[data-engine="glsl"]') },
];

function apply() {
  const colors = rgba(cfg.palette);
  for (const e of engines) {
    if (!e.ready) continue;
    e.engine.configure(cfg);
    e.engine.palette(colors);
    e.node.querySelector("canvas").style.setProperty("--ratio", `${cfg.width} / ${cfg.height}`);
  }
  writeURL();
}

/* Controls */

function renderControls() {
  $("#presets").replaceChildren(
    ...Object.entries(PRESETS).map(([name, preset]) =>
      el("button", {
        type: "button",
        "aria-pressed": String(Object.entries(preset).every(([k, v]) => cfg[k] === v)),
        onclick: () => set(preset),
      }, name)),
  );
  $("#knobs").replaceChildren(
    ...KNOBS.map((k) => {
      const id = `knob-${k.key}`;
      const output = el("output", { for: id }, String(cfg[k.key]));
      const input = el("input", { id, name: k.key, type: "range", min: k.min, max: k.max, step: 1, value: cfg[k.key] });
      input.addEventListener("input", () => set({ [k.key]: Number(input.value) }, { keepControls: true, output }));
      return el("label", { class: "knob" }, el("span", {}, k.label), output, input, el("small", {}, k.note));
    }),
  );
  $("#palettes").replaceChildren(
    ...Object.keys(PALETTES).map((name) => {
      const colors = rgba(name);
      const hot = `rgb(${colors[28 * 4]}, ${colors[28 * 4 + 1]}, ${colors[28 * 4 + 2]})`;
      const mid = `rgb(${colors[12 * 4]}, ${colors[12 * 4 + 1]}, ${colors[12 * 4 + 2]})`;
      return el("button", {
        type: "button", "aria-pressed": String(cfg.palette === name), onclick: () => set({ palette: name }),
      }, el("span", { class: "swatch", style: { background: `linear-gradient(90deg, ${mid}, ${hot})` } }), name);
    }),
  );
  $("#light").textContent = cfg.source > 0 ? "Put out" : "Light";
}

function set(change, { keepControls = false, output = null } = {}) {
  cfg = { ...cfg, ...change };
  if (cfg.source > 0) lit = cfg.source;
  apply();
  if (keepControls) {
    if (output) output.textContent = String(Object.values(change)[0]);
    // Keep the slider that has the focus, but update the buttons.
    document.querySelectorAll("#presets button").forEach((b) => {
      b.setAttribute("aria-pressed", String(Object.entries(PRESETS[b.textContent]).every(([k, v]) => cfg[k] === v)));
    });
    $("#light").textContent = cfg.source > 0 ? "Put out" : "Light";
  } else {
    renderControls();
  }
}

$("#pause").addEventListener("click", () => {
  paused = !paused;
  $("#pause").textContent = paused ? "Play" : "Pause";
});

$("#light").addEventListener("click", () => set({ source: cfg.source > 0 ? 0 : lit || 36 }));

/* The loop */

let last = performance.now();
let owed = 0;

function frame(now) {
  if (!paused) {
    owed += now - last;
    const interval = 1000 / cfg.fps;
    let steps = Math.floor(owed / interval);
    owed -= steps * interval;
    steps = Math.min(steps, 3); // after a pause in the tab, do not run ahead
    if (steps > 0) {
      for (const e of engines) {
        if (!e.ready) continue;
        const t0 = performance.now();
        e.engine.step(steps);
        e.engine.draw();
        const ms = (performance.now() - t0) / steps;
        e.ms = e.ms === undefined ? ms : e.ms * 0.9 + ms * 0.1;
      }
    }
  }
  last = now;
  requestAnimationFrame(frame);
}

setInterval(() => {
  for (const e of engines) {
    if (e.ready && e.ms !== undefined) e.node.querySelector(".ms").textContent = `${e.ms.toFixed(2)} ms / step`;
  }
}, 300);

/* Benchmark */

$("#bench").addEventListener("click", async () => {
  const button = $("#bench");
  button.disabled = true;
  button.textContent = "Running…";
  const wasPaused = paused;
  paused = true;
  await new Promise((r) => setTimeout(r, 30));
  const steps = 300;
  const results = [];
  for (const e of engines) {
    if (!e.ready) continue;
    e.engine.step(20); // warm up
    e.engine.sync();
    const t0 = performance.now();
    e.engine.step(steps);
    e.engine.sync();
    const ms = (performance.now() - t0) / steps;
    e.engine.draw();
    results.push({ name: e.engine.name, where: e.engine.where, ms });
    await new Promise((r) => setTimeout(r, 0));
  }
  const slowest = Math.max(...results.map((r) => r.ms));
  $("#bench-rows").replaceChildren(
    ...results.map((r) =>
      el("tr", {},
        el("td", {}, `${r.name} `, el("span", { class: "hint" }, r.where)),
        el("td", { class: "num" }, `${r.ms < 0.01 ? r.ms.toFixed(4) : r.ms.toFixed(3)} ms`),
        el("td", { class: "num" }, Math.round(1000 / r.ms).toLocaleString("en-US")),
        el("td", { class: "bar-cell" }, el("div", { class: "bar", style: { width: `${Math.max(2, (r.ms / slowest) * 100)}%` } })))),
  );
  $("#bench-note").textContent = `${steps} steps of a ${cfg.width} × ${cfg.height} fire in each language, one after the other. A shorter bar is faster.`;
  $("#bench-result").hidden = false;
  paused = wasPaused;
  button.disabled = false;
  button.textContent = "Benchmark";
});

/* Code */

const CODE = [
  { name: "Go", file: "code/fire.go.txt", note: "fire/fire.go: the Go package, for the terminal and the WebAssembly build." },
  { name: "JavaScript", file: "engines/step.js", note: "web/engines/step.js: the page and languages/javascript use it." },
  { name: "GLSL", file: "engines/fire.frag", note: "web/engines/fire.frag: the GPU runs it once for each pixel, all at the same time. y = 0 is the bottom row." },
  { name: "C", file: "code/fire.c.txt", note: "languages/c/fire.c: for the terminal. It does not run on this page." },
  { name: "Python", file: "code/fire.py.txt", note: "languages/python/fire.py: for the terminal. It does not run on this page." },
];

const sources = new Map();

async function showCode(item) {
  if (!sources.has(item.file)) {
    const text = await (await fetch(item.file)).text();
    const lines = text.split("\n");
    const start = lines.findIndex((l) => l.includes("step:start"));
    const end = lines.findIndex((l) => l.includes("step:end"));
    sources.set(item.file, (start >= 0 && end > start ? lines.slice(start + 1, end) : lines).join("\n").trim());
  }
  const code = sources.get(item.file);
  $("#code").textContent = code;
  $("#code-note").textContent = `${item.note} ${code.split("\n").length} lines.`;
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.textContent === item.name)));
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === item.name)));
}

$("#tabs").replaceChildren(...CODE.map((item) => el("button", { type: "button", role: "tab", onclick: () => showCode(item) }, item.name)));

/* Start */

async function start() {
  renderControls();
  showCode(CODE[0]);
  await Promise.all(
    engines.map(async (e) => {
      try {
        await e.engine.init(e.node.querySelector("canvas"));
        e.ready = true;
      } catch (error) {
        e.node.classList.add("off");
        e.node.querySelector(".ms").textContent = `not available: ${error.message}`;
      }
    }),
  );
  apply();
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });
}

start();
