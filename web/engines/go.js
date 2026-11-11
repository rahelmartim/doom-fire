// The fire in Go, compiled to WebAssembly (cmd/fire-wasm).
import { CanvasDrawer } from "./canvas2d.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`cannot load ${src}`));
    document.head.append(script);
  });
}

export class GoFire {
  name = "Go";
  where = "CPU · WebAssembly";

  async init(canvas) {
    this.drawer = new CanvasDrawer(canvas);
    await loadScript("wasm_exec.js");
    const go = new window.Go();
    const ready = new Promise((resolve) => window.addEventListener("gofire-ready", resolve, { once: true }));
    const result = await WebAssembly.instantiateStreaming(fetch("fire.wasm"), go.importObject);
    go.run(result.instance);
    await ready;
    this.api = window.goFire;
    this.cfg = null;
  }

  configure(cfg) {
    if (!this.cfg || cfg.width !== this.cfg.width || cfg.height !== this.cfg.height) {
      this.pixels = new Uint8Array(cfg.width * cfg.height);
    }
    this.cfg = cfg;
    this.api.configure(cfg.width, cfg.height, cfg.decay, cfg.wind, cfg.source);
  }

  palette(rgba) {
    this.drawer.palette(rgba);
  }

  step(n = 1) {
    this.api.step(n);
  }

  draw() {
    this.api.read(this.pixels);
    this.drawer.draw(this.pixels, this.cfg.width, this.cfg.height);
  }

  sync() {}
}
