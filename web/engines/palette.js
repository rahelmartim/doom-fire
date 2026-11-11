// The 37 colors of the fire of Doom, from cold to hot, and some variants.

export const MAX_INTENSITY = 36;

export const PALETTE = [
  [7, 7, 7], [31, 7, 7], [47, 15, 7], [71, 15, 7], [87, 23, 7], [103, 31, 7], [119, 31, 7],
  [143, 39, 7], [159, 47, 7], [175, 63, 7], [191, 71, 7], [199, 71, 7], [223, 79, 7],
  [223, 87, 7], [223, 87, 7], [215, 95, 7], [215, 95, 7], [215, 103, 15], [207, 111, 15],
  [207, 119, 15], [207, 127, 15], [207, 135, 23], [199, 135, 23], [199, 143, 23],
  [199, 151, 31], [191, 159, 31], [191, 159, 31], [191, 167, 39], [191, 167, 39],
  [191, 175, 47], [183, 175, 47], [183, 183, 47], [183, 183, 55], [207, 207, 111],
  [223, 223, 159], [239, 239, 199], [255, 255, 255],
];

// Each variant moves the red, green, and blue of the Doom colors.
export const PALETTES = {
  doom: ([r, g, b]) => [r, g, b],
  blue: ([r, g, b]) => [b, g, r],
  green: ([r, g, b]) => [g, r, b],
  purple: ([r, g, b]) => [r, b, g],
  smoke: ([r, g, b]) => {
    const v = Math.round((r + g + b) / 3);
    return [v, v, v];
  },
};

// rgba returns the palette as 37 RGBA colors, 4 bytes each.
export function rgba(name) {
  const map = PALETTES[name] ?? PALETTES.doom;
  const out = new Uint8Array(PALETTE.length * 4);
  PALETTE.forEach((color, i) => {
    out.set([...map(color), 255], i * 4);
  });
  return out;
}
