// Package fire is the fire effect of the PlayStation port of Doom.
//
// The fire is a grid of intensities from 0 (black) to 36 (white). The
// bottom row is the source. In each step, every other pixel takes the
// intensity of a pixel below it, minus a small random decay. The wind
// moves the pixel that it reads to the side.
package fire

import "math/rand/v2"

// MaxIntensity is the hottest intensity: the last color of the palette.
const MaxIntensity = 36

// Config holds the parameters of a fire.
type Config struct {
	Width  int // pixels in a row
	Height int // rows
	Decay  int // largest random decay in one step
	Wind   int // side shift for each point of decay; negative blows left
	Source int // intensity of the bottom row
}

// Default is the classic fire.
var Default = Config{Width: 80, Height: 40, Decay: 3, Wind: 0, Source: MaxIntensity}

// Limits of the parameters.
const (
	MaxWidth  = 400
	MaxHeight = 300
	MaxDecay  = 12
	MaxWind   = 3
)

func clamp(v, lo, hi int) int {
	return max(lo, min(hi, v))
}

// Clamped returns the config with every value inside its limits.
func (c Config) Clamped() Config {
	return Config{
		Width:  clamp(c.Width, 1, MaxWidth),
		Height: clamp(c.Height, 2, MaxHeight),
		Decay:  clamp(c.Decay, 0, MaxDecay),
		Wind:   clamp(c.Wind, -MaxWind, MaxWind),
		Source: clamp(c.Source, 0, MaxIntensity),
	}
}

// Fire is the state of one fire.
type Fire struct {
	cfg Config
	// Pixels has one intensity for each pixel, row by row, from the top.
	Pixels []uint8
	rng    *rand.Rand
}

// New makes a dark fire. Step lights it.
func New(cfg Config, seed uint64) *Fire {
	f := &Fire{rng: rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))}
	f.Configure(cfg)
	return f
}

// Config returns the parameters in use.
func (f *Fire) Config() Config {
	return f.cfg
}

// Configure changes the parameters. A new size starts a dark fire.
func (f *Fire) Configure(cfg Config) {
	cfg = cfg.Clamped()
	if cfg.Width != f.cfg.Width || cfg.Height != f.cfg.Height {
		f.Pixels = make([]uint8, cfg.Width*cfg.Height)
	}
	f.cfg = cfg
}

// step:start

// Step moves the fire one row up.
func (f *Fire) Step() {
	w, h := f.cfg.Width, f.cfg.Height
	for x := 0; x < w; x++ {
		f.Pixels[(h-1)*w+x] = uint8(f.cfg.Source)
	}
	// From the top down, so that each row reads the row below it before
	// that row changes.
	for y := 0; y < h-1; y++ {
		for x := 0; x < w; x++ {
			decay := 0
			if f.cfg.Decay > 0 {
				decay = f.rng.IntN(f.cfg.Decay + 1)
			}
			from := ((x+decay*f.cfg.Wind)%w + w) % w
			v := int(f.Pixels[(y+1)*w+from]) - decay
			f.Pixels[y*w+x] = uint8(max(v, 0))
		}
	}
}

// step:end

// Palette is the 37 colors of the fire of Doom, from cold to hot.
var Palette = [MaxIntensity + 1][3]uint8{
	{7, 7, 7}, {31, 7, 7}, {47, 15, 7}, {71, 15, 7}, {87, 23, 7}, {103, 31, 7}, {119, 31, 7},
	{143, 39, 7}, {159, 47, 7}, {175, 63, 7}, {191, 71, 7}, {199, 71, 7}, {223, 79, 7},
	{223, 87, 7}, {223, 87, 7}, {215, 95, 7}, {215, 95, 7}, {215, 103, 15}, {207, 111, 15},
	{207, 119, 15}, {207, 127, 15}, {207, 135, 23}, {199, 135, 23}, {199, 143, 23},
	{199, 151, 31}, {191, 159, 31}, {191, 159, 31}, {191, 167, 39}, {191, 167, 39},
	{191, 175, 47}, {183, 175, 47}, {183, 183, 47}, {183, 183, 55}, {207, 207, 111},
	{223, 223, 159}, {239, 239, 199}, {255, 255, 255},
}
