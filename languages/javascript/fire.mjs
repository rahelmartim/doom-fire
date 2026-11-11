// The fire of Doom in JavaScript, for a terminal with 24-bit color.
//
//   node fire.mjs --width 80 --height 30 --wind 1
//
// Press Ctrl+C to stop. The page uses the same step function
// (web/engines/javascript.js).
import { parseArgs } from "node:util";
import { step } from "../../web/engines/step.js";
import { PALETTE, MAX_INTENSITY } from "../../web/engines/palette.js";

const { values } = parseArgs({
  options: {
    width: { type: "string", default: "80" },
    height: { type: "string", default: "30" },
    decay: { type: "string", default: "3" },
    wind: { type: "string", default: "0" },
    source: { type: "string", default: String(MAX_INTENSITY) },
    fps: { type: "string", default: "30" },
    frames: { type: "string", default: "0" },
  },
});
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.parseInt(v, 10) || 0));
const w = clamp(values.width, 1, 400);
const h = clamp(values.height, 2, 300);
const decay = clamp(values.decay, 0, 12);
const wind = clamp(values.wind, -3, 3);
const source = clamp(values.source, 0, MAX_INTENSITY);
const fps = clamp(values.fps, 1, 240);
const frames = clamp(values.frames, 0, 1e9);

const pixels = new Uint8Array(w * h);

function draw() {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const [r, g, b] = PALETTE[pixels[y * w + x]];
      row += `\x1b[48;2;${r};${g};${b}m  `;
    }
    rows.push(`${row}\x1b[0m`);
  }
  process.stdout.write(`\x1b[H${rows.join("\n")}\n`);
}

const finish = () => {
  process.stdout.write("\x1b[0m\x1b[?25h\n");
  process.exit(0);
};
process.on("SIGINT", finish);
process.stdout.write("\x1b[?25l\x1b[2J");

let n = 0;
const timer = setInterval(() => {
  step(pixels, w, h, decay, wind, source);
  draw();
  n += 1;
  if (frames && n >= frames) {
    clearInterval(timer);
    finish();
  }
}, 1000 / fps);
