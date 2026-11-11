// Doomfire draws the fire of Doom in a terminal with 24-bit color.
//
//	go run ./cmd/doomfire -width 80 -height 30 -wind 1
//
// Press Ctrl+C to stop.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"time"

	"github.com/rahelmartim/doom-fire/fire"
)

func main() {
	cfg := fire.Default
	flag.IntVar(&cfg.Width, "width", 80, "pixels in a row")
	flag.IntVar(&cfg.Height, "height", 30, "rows")
	flag.IntVar(&cfg.Decay, "decay", cfg.Decay, "largest random decay in one step (0 to 12)")
	flag.IntVar(&cfg.Wind, "wind", cfg.Wind, "side shift for each point of decay (-3 to 3)")
	flag.IntVar(&cfg.Source, "source", cfg.Source, "intensity of the bottom row (0 to 36)")
	fps := flag.Int("fps", 30, "frames per second")
	frames := flag.Int("frames", 0, "frames to draw; 0 draws until Ctrl+C")
	flag.Parse()

	f := fire.New(cfg, uint64(time.Now().UnixNano()))
	out := bufio.NewWriter(os.Stdout)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	fmt.Fprint(out, "\x1b[?25l\x1b[2J") // hide the cursor, clear the screen
	defer func() {
		fmt.Fprint(out, "\x1b[0m\x1b[?25h\n") // reset the colors, show the cursor
		out.Flush()
	}()

	tick := time.NewTicker(time.Second / time.Duration(max(1, *fps)))
	defer tick.Stop()
	for n := 0; *frames == 0 || n < *frames; n++ {
		f.Step()
		draw(out, f)
		select {
		case <-stop:
			return
		case <-tick.C:
		}
	}
}

// draw writes one frame. Each pixel is two spaces with a background color.
func draw(out *bufio.Writer, f *fire.Fire) {
	cfg := f.Config()
	fmt.Fprint(out, "\x1b[H")
	for y := 0; y < cfg.Height; y++ {
		for x := 0; x < cfg.Width; x++ {
			c := fire.Palette[f.Pixels[y*cfg.Width+x]]
			fmt.Fprintf(out, "\x1b[48;2;%d;%d;%dm  ", c[0], c[1], c[2])
		}
		fmt.Fprint(out, "\x1b[0m\n")
	}
	out.Flush()
}
