"""The fire of Doom in Python, for a terminal with 24-bit color.

    python3 fire.py --width 80 --height 30 --wind 1

Press Ctrl+C to stop.
"""

import argparse
import random
import sys
import time

MAX_INTENSITY = 36

PALETTE = [
    (7, 7, 7), (31, 7, 7), (47, 15, 7), (71, 15, 7), (87, 23, 7), (103, 31, 7), (119, 31, 7),
    (143, 39, 7), (159, 47, 7), (175, 63, 7), (191, 71, 7), (199, 71, 7), (223, 79, 7),
    (223, 87, 7), (223, 87, 7), (215, 95, 7), (215, 95, 7), (215, 103, 15), (207, 111, 15),
    (207, 119, 15), (207, 127, 15), (207, 135, 23), (199, 135, 23), (199, 143, 23),
    (199, 151, 31), (191, 159, 31), (191, 159, 31), (191, 167, 39), (191, 167, 39),
    (191, 175, 47), (183, 175, 47), (183, 183, 47), (183, 183, 55), (207, 207, 111),
    (223, 223, 159), (239, 239, 199), (255, 255, 255),
]


# step:start
def step(pixels, w, h, decay_max, wind, source):
    for x in range(w):
        pixels[(h - 1) * w + x] = source
    # From the top down, so that each row reads the row below it before
    # that row changes.
    for y in range(h - 1):
        for x in range(w):
            decay = random.randint(0, decay_max) if decay_max > 0 else 0
            source_x = (x + decay * wind) % w
            pixels[y * w + x] = max(pixels[(y + 1) * w + source_x] - decay, 0)
# step:end


def draw(pixels, w, h):
    rows = []
    for y in range(h):
        cells = []
        for x in range(w):
            r, g, b = PALETTE[pixels[y * w + x]]
            cells.append(f"\x1b[48;2;{r};{g};{b}m  ")
        rows.append("".join(cells) + "\x1b[0m")
    sys.stdout.write("\x1b[H" + "\n".join(rows) + "\n")
    sys.stdout.flush()


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def main():
    parser = argparse.ArgumentParser(description="The fire of Doom in a terminal.")
    parser.add_argument("--width", type=int, default=80)
    parser.add_argument("--height", type=int, default=30)
    parser.add_argument("--decay", type=int, default=3)
    parser.add_argument("--wind", type=int, default=0)
    parser.add_argument("--source", type=int, default=MAX_INTENSITY)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--frames", type=int, default=0, help="0 draws until Ctrl+C")
    a = parser.parse_args()
    w, h = clamp(a.width, 1, 400), clamp(a.height, 2, 300)
    decay, wind = clamp(a.decay, 0, 12), clamp(a.wind, -3, 3)
    source, fps = clamp(a.source, 0, MAX_INTENSITY), clamp(a.fps, 1, 240)

    pixels = [0] * (w * h)
    sys.stdout.write("\x1b[?25l\x1b[2J")
    try:
        n = 0
        while a.frames == 0 or n < a.frames:
            step(pixels, w, h, decay, wind, source)
            draw(pixels, w, h)
            time.sleep(1 / fps)
            n += 1
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\x1b[0m\x1b[?25h\n")


if __name__ == "__main__":
    main()
