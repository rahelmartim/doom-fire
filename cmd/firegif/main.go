// Firegif writes an animated GIF of the fire, for the README.
//
//	go run ./cmd/firegif -out docs/fire.gif
//
// It draws three fires side by side, in the doom, blue, and green colors,
// with the wind changing over time.
package main

import (
	"flag"
	"image"
	"image/color"
	"image/gif"
	"log"
	"os"

	"github.com/rahelmartim/doom-fire/fire"
)

func main() {
	out := flag.String("out", "docs/fire.gif", "file to write")
	frames := flag.Int("frames", 90, "frames in the loop")
	scale := flag.Int("scale", 3, "size of one fire pixel in the GIF")
	flag.Parse()

	const w, h, gap = 90, 45, 4
	// Each fire gets its own 37 colors, with one shared black.
	maps := []func(c [3]uint8) [3]uint8{
		func(c [3]uint8) [3]uint8 { return c },
		func(c [3]uint8) [3]uint8 { return [3]uint8{c[2], c[1], c[0]} },
		func(c [3]uint8) [3]uint8 { return [3]uint8{c[1], c[0], c[2]} },
	}
	palette := color.Palette{color.RGBA{13, 13, 15, 255}}
	for _, m := range maps {
		for _, c := range fire.Palette {
			rgb := m(c)
			palette = append(palette, color.RGBA{rgb[0], rgb[1], rgb[2], 255})
		}
	}

	fires := make([]*fire.Fire, len(maps))
	for i := range fires {
		fires[i] = fire.New(fire.Config{Width: w, Height: h, Decay: 3, Source: fire.MaxIntensity}, uint64(i+1))
		for range h { // light it before the first frame
			fires[i].Step()
		}
	}

	width := (len(maps)*w + (len(maps)-1)*gap) * *scale
	anim := &gif.GIF{}
	for n := 0; n < *frames; n++ {
		// The wind blows left, then right, in one loop.
		wind := []int{0, -1, -2, -1, 0, 1, 2, 1}[n*8/(*frames)]
		img := image.NewPaletted(image.Rect(0, 0, width, h**scale), palette)
		for i, f := range fires {
			f.Configure(fire.Config{Width: w, Height: h, Decay: 3, Wind: wind, Source: fire.MaxIntensity})
			f.Step()
			left := i * (w + gap) * *scale
			for y := 0; y < h; y++ {
				for x := 0; x < w; x++ {
					index := uint8(1 + i*len(fire.Palette) + int(f.Pixels[y*w+x]))
					for dy := 0; dy < *scale; dy++ {
						row := img.Pix[(y**scale+dy)*img.Stride+left+x**scale:]
						for dx := 0; dx < *scale; dx++ {
							row[dx] = index
						}
					}
				}
			}
		}
		anim.Image = append(anim.Image, img)
		anim.Delay = append(anim.Delay, 4) // in 1/100 s
	}

	file, err := os.Create(*out)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()
	if err := gif.EncodeAll(file, anim); err != nil {
		log.Fatal(err)
	}
}
