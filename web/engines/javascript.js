// The fire in JavaScript, on the CPU.
import { CanvasDrawer } from "./canvas2d.js";
import { step } from "./step.js";

export class JavaScriptFire {
  name = "JavaScript";
  where = "CPU";

  async init(canvas) {
    this.drawer = new CanvasDrawer(canvas);
    this.cfg = null;
    this.pixels = new Uint8Array(0);
  }

  configure(cfg) {
    if (!this.cfg || cfg.width !== this.cfg.width || cfg.height !== this.cfg.height) {
      this.pixels = new Uint8Array(cfg.width * cfg.height);
    }
    this.cfg = cfg;
  }

  palette(rgba) {
    this.drawer.palette(rgba);
  }

  step(n = 1) {
    const { width, height, decay, wind, source } = this.cfg;
    for (let i = 0; i < n; i++) step(this.pixels, width, height, decay, wind, source);
  }

  draw() {
    this.drawer.draw(this.pixels, this.cfg.width, this.cfg.height);
  }

  sync() {}
}
