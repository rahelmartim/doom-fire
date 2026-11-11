// The step of the fire in JavaScript. The page and languages/javascript
// use it.

// step:start
export function step(pixels, w, h, decayMax, wind, source) {
  for (let x = 0; x < w; x++) pixels[(h - 1) * w + x] = source;
  // From the top down, so that each row reads the row below it before
  // that row changes.
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      const decay = decayMax > 0 ? Math.floor(Math.random() * (decayMax + 1)) : 0;
      const from = (((x + decay * wind) % w) + w) % w;
      pixels[y * w + x] = Math.max(pixels[(y + 1) * w + from] - decay, 0);
    }
  }
}
// step:end
