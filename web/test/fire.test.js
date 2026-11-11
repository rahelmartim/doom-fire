// Tests the page in a headless Chrome, on the build in site/ (run
// "make web" first). Chrome uses SwiftShader, so the GLSL fire runs too.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { findChrome, launchChrome, serveApp } from "./browser.js";

const chromePath = findChrome();
const built = existsSync(resolve(import.meta.dirname, "..", "..", "site", "fire.wasm"));
const skip = !chromePath ? "Chrome is not installed" : !built ? "run make web first" : false;
const ENGINES = ["javascript", "go", "glsl"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe("Doom Fire in the browser", { skip }, () => {
  let chrome;
  let app;
  let page;

  before(async () => {
    app = await serveApp();
    chrome = await launchChrome(chromePath);
    page = await chrome.newPage({ width: 1300, height: 1000 });
    await page.goto(app.url);
    await page.waitFor("[...document.querySelectorAll('.fire .ms')].every((n) => n.textContent.includes('ms / step'))", 20000);
  });

  after(async () => {
    page?.close();
    await chrome?.close();
    app?.server.close();
  });

  // rows reads a canvas and returns, for each row, the share of dark
  // pixels and the color of its first pixel.
  const rows = (engine) =>
    page.eval(`(() => {
      const c = document.querySelector('[data-engine="${engine}"] canvas');
      const copy = document.createElement('canvas');
      copy.width = c.width;
      copy.height = c.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const out = [];
      for (let y = 0; y < c.height; y++) {
        let dark = 0;
        let blue = 0;
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          if (d[i] <= 7 && d[i + 1] <= 7 && d[i + 2] <= 7) dark++;
          if (d[i + 2] > d[i] + 40) blue++;
        }
        const i = y * c.width * 4;
        out.push({ dark: dark / c.width, blue: blue / c.width, first: [d[i], d[i + 1], d[i + 2]].join(',') });
      }
      return { width: c.width, height: c.height, rows: out };
    })()`);

  const setKnob = (name, value) =>
    page.eval(`(() => {
      const input = document.querySelector('input[name="${name}"]');
      input.value = ${value};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);

  test("the three languages burn the same kind of fire", async () => {
    await sleep(1500);
    for (const engine of ENGINES) {
      const fire = await rows(engine);
      assert.equal(fire.width, 80, engine);
      assert.equal(fire.height, 40, engine);
      assert.equal(fire.rows.at(-1).first, "255,255,255", `${engine}: the source is white`);
      assert.equal(fire.rows.at(-1).dark, 0, `${engine}: the source has no dark pixel`);
      assert.ok(fire.rows[0].dark > 0.9, `${engine}: the top is dark (${fire.rows[0].dark})`);
      assert.ok(fire.rows[30].dark < 0.2, `${engine}: the fire burns low (${fire.rows[30].dark})`);
    }
  });

  test("a knob changes all three fires, and the address keeps it", async () => {
    await setKnob("width", 50);
    await setKnob("height", 30);
    await sleep(600);
    for (const engine of ENGINES) {
      const fire = await rows(engine);
      assert.equal(`${fire.width}x${fire.height}`, "50x30", engine);
    }
    const search = await page.eval("location.search");
    assert.match(search, /width=50/);
    assert.match(search, /height=30/);
    assert.equal(await page.text('output[for="knob-width"]'), "50");
  });

  test("an animation sets the knobs and the colors", async () => {
    await page.clickText("#presets button", "Blue flame");
    await sleep(1200);
    assert.equal(await page.eval("document.querySelector('input[name=\"decay\"]').value"), "2");
    assert.match(await page.eval("location.search"), /palette=blue/);
    for (const engine of ENGINES) {
      const fire = await rows(engine);
      assert.equal(fire.width, 80, engine);
      assert.ok(fire.rows.slice(10, 38).some((r) => r.blue > 0.3), `${engine}: the flame is blue`);
    }
    assert.equal(await page.eval("document.querySelector('#presets [aria-pressed=\"true\"]').textContent"), "Blue flame");
  });

  test("put out darkens all three fires, and light starts them again", async () => {
    await page.click("#light");
    assert.equal(await page.text("#light"), "Light");
    await sleep(2500);
    for (const engine of ENGINES) {
      const fire = await rows(engine);
      assert.ok(fire.rows.every((r) => r.dark === 1), `${engine}: still burning`);
    }
    await page.click("#light");
    await sleep(1200);
    for (const engine of ENGINES) {
      assert.equal((await rows(engine)).rows.at(-1).first, "255,255,255", engine);
    }
  });

  test("pause stops the fires", async () => {
    await page.click("#pause");
    await sleep(200);
    const a = JSON.stringify(await rows("javascript"));
    await sleep(500);
    assert.equal(JSON.stringify(await rows("javascript")), a);
    await page.click("#pause");
    await sleep(300);
    assert.notEqual(JSON.stringify(await rows("javascript")), a);
  });

  test("the benchmark times each language", async () => {
    await page.click("#bench");
    await page.waitFor("!document.querySelector('#bench-result').hidden", 30000);
    const table = await page.text("#bench-rows");
    for (const name of ["JavaScript", "Go", "GLSL"]) assert.match(table, new RegExp(`${name}.*\\d+\\.\\d+ ms`));
    assert.equal(await page.eval("document.querySelectorAll('#bench-rows .bar').length"), 3);
  });

  test("the code tabs show the step in five languages", async () => {
    const expect = { Go: "func (f *Fire) Step()", JavaScript: "export function step", GLSL: "void main()", C: "rand() %", Python: "def step" };
    for (const [tab, text] of Object.entries(expect)) {
      await page.clickText("#tabs button", tab);
      await page.waitFor(`document.querySelector('#code').textContent.includes(${JSON.stringify(text)})`);
      assert.doesNotMatch(await page.text("#code"), /step:start|step:end/);
      assert.match(await page.text("#code-note"), /\d+ lines/);
    }
  });

  test("the address sets the values when the page opens", async () => {
    await page.goto(`${app.url}?width=60&height=20&wind=-2&palette=green`);
    await page.waitFor("[...document.querySelectorAll('.fire .ms')].every((n) => n.textContent.includes('ms / step'))", 20000);
    assert.equal(await page.eval("document.querySelector('input[name=\"wind\"]').value"), "-2");
    for (const engine of ENGINES) {
      const fire = await rows(engine);
      assert.equal(`${fire.width}x${fire.height}`, "60x20", engine);
    }
    assert.equal(await page.eval("document.querySelector('#palettes [aria-pressed=\"true\"]').textContent"), "green");
  });

  test("the page had no JavaScript errors", () => {
    assert.deepEqual(page.errors, []);
  });
});
