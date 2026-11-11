package fire

import "testing"

func TestTheSourceIsTheBottomRow(t *testing.T) {
	f := New(Config{Width: 10, Height: 5, Decay: 2, Source: 30}, 1)
	f.Step()
	for x := 0; x < 10; x++ {
		if got := f.Pixels[4*10+x]; got != 30 {
			t.Fatalf("bottom pixel %d is %d, want 30", x, got)
		}
	}
}

func TestWithoutDecayTheFireRisesOneRowEachStep(t *testing.T) {
	f := New(Config{Width: 4, Height: 6, Decay: 0, Source: MaxIntensity}, 1)
	for step := 1; step <= 5; step++ {
		f.Step()
		// After step s, the bottom row and the s rows above it burn.
		for y := 0; y < 6; y++ {
			want := uint8(0)
			if y >= 5-step {
				want = MaxIntensity
			}
			if got := f.Pixels[y*4]; got != want {
				t.Fatalf("step %d, row %d: %d, want %d", step, y, got, want)
			}
		}
	}
}

func TestDecayCoolsTheFireUpwards(t *testing.T) {
	f := New(Config{Width: 50, Height: 60, Decay: 3, Source: MaxIntensity}, 7)
	for range 200 {
		f.Step()
	}
	avg := func(y int) float64 {
		sum := 0
		for x := 0; x < 50; x++ {
			sum += int(f.Pixels[y*50+x])
		}
		return float64(sum) / 50
	}
	if !(avg(58) > avg(50) && avg(50) > avg(40)) {
		t.Fatalf("the fire does not cool upwards: %.1f, %.1f, %.1f", avg(58), avg(50), avg(40))
	}
	if avg(0) != 0 {
		t.Fatalf("a decay of up to 3 cannot reach 60 rows: the top is %.1f", avg(0))
	}
	for _, p := range f.Pixels {
		if p > MaxIntensity {
			t.Fatalf("intensity %d is over the maximum", p)
		}
	}
}

func TestPuttingOutTheSourceDarkensTheFire(t *testing.T) {
	f := New(Config{Width: 20, Height: 20, Decay: 2, Source: MaxIntensity}, 3)
	for range 50 {
		f.Step()
	}
	f.Configure(Config{Width: 20, Height: 20, Decay: 2, Source: 0})
	for range 30 {
		f.Step()
	}
	for i, p := range f.Pixels {
		if p != 0 {
			t.Fatalf("pixel %d still burns at %d", i, p)
		}
	}
}

func TestWindMovesTheFlames(t *testing.T) {
	// One hot column, no decay at random: with wind, the flame leans.
	lean := func(wind int) int {
		f := New(Config{Width: 40, Height: 10, Decay: 1, Wind: wind, Source: 0}, 5)
		for range 20 {
			for y := 0; y < 10; y++ {
				f.Pixels[y*40+20] = MaxIntensity
			}
			f.Step()
		}
		left, right := 0, 0
		for y := 0; y < 9; y++ {
			for x := 0; x < 40; x++ {
				if f.Pixels[y*40+x] > 0 {
					if x < 20 {
						left++
					} else if x > 20 {
						right++
					}
				}
			}
		}
		return right - left
	}
	// A pixel reads from x + decay*wind, so positive wind pulls the flame
	// to the left.
	if lean(2) >= 0 || lean(-2) <= 0 || lean(0) != 0 {
		t.Fatalf("leans: wind 2 → %d, wind -2 → %d, no wind → %d", lean(2), lean(-2), lean(0))
	}
}

func TestTheSameSeedMakesTheSameFire(t *testing.T) {
	a, b := New(Default, 42), New(Default, 42)
	for range 30 {
		a.Step()
		b.Step()
	}
	if string(a.Pixels) != string(b.Pixels) {
		t.Fatal("two fires with the same seed differ")
	}
}

func TestConfigureClampsAndResizes(t *testing.T) {
	f := New(Config{Width: 9999, Height: -1, Decay: 99, Wind: -9, Source: 99}, 1)
	if c := f.Config(); c != (Config{Width: MaxWidth, Height: 2, Decay: MaxDecay, Wind: -MaxWind, Source: MaxIntensity}) {
		t.Fatalf("clamped config %+v", c)
	}
	f.Configure(Config{Width: 3, Height: 4, Decay: 1, Source: 10})
	if len(f.Pixels) != 12 {
		t.Fatalf("%d pixels, want 12", len(f.Pixels))
	}
	f.Step()
	f.Configure(Config{Width: 3, Height: 4, Decay: 2, Source: 10})
	if f.Pixels[9] != 10 {
		t.Fatal("a change that keeps the size must keep the pixels")
	}
}

func BenchmarkStep(b *testing.B) {
	f := New(Default, 1)
	for b.Loop() {
		f.Step()
	}
}
