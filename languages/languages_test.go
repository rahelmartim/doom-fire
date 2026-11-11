// Package languages_test runs the terminal versions of the fire in each
// language, and checks what they draw. A version is skipped when its
// compiler or interpreter is not installed.
package languages_test

import (
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

var cell = regexp.MustCompile(`\x1b\[48;2;(\d+);(\d+);(\d+)m  `)

// check reads the last frame: 6 rows of 10 pixels. The top row is still
// dark after 3 steps, and the bottom row is the white source.
func check(t *testing.T, out []byte) {
	t.Helper()
	text := string(out)
	last := text[strings.LastIndex(text, "\x1b[H")+3:]
	var rows []string
	for _, line := range strings.Split(last, "\n") {
		if cell.MatchString(line) {
			rows = append(rows, line)
		}
	}
	if len(rows) != 6 {
		t.Fatalf("%d rows, want 6:\n%q", len(rows), last)
	}
	for i, row := range rows {
		cells := cell.FindAllStringSubmatch(row, -1)
		if len(cells) != 10 {
			t.Fatalf("row %d has %d pixels, want 10", i, len(cells))
		}
		for _, c := range cells {
			color := c[1] + "," + c[2] + "," + c[3]
			if i == 0 && color != "7,7,7" {
				t.Fatalf("the top row burns after 3 steps: %s", color)
			}
			if i == 5 && color != "255,255,255" {
				t.Fatalf("the source is %s, want white", color)
			}
		}
	}
	if !strings.HasSuffix(strings.TrimSpace(text), "\x1b[?25h") {
		t.Fatal("the program did not show the cursor again")
	}
}

var args = []string{"--width", "10", "--height", "6", "--decay", "1", "--frames", "3", "--fps", "200"}

func run(t *testing.T, name string, arg ...string) []byte {
	t.Helper()
	out, err := exec.Command(name, arg...).Output()
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return out
}

func need(t *testing.T, tool string) {
	t.Helper()
	if _, err := exec.LookPath(tool); err != nil {
		t.Skipf("%s is not installed", tool)
	}
}

func TestC(t *testing.T) {
	need(t, "cc")
	bin := filepath.Join(t.TempDir(), "fire")
	if out, err := exec.Command("cc", "-O2", "-Wall", "-Werror", "-o", bin, "c/fire.c").CombinedOutput(); err != nil {
		t.Fatalf("cc: %v\n%s", err, out)
	}
	check(t, run(t, bin, args...))
}

func TestPython(t *testing.T) {
	need(t, "python3")
	check(t, run(t, "python3", append([]string{"python/fire.py"}, args...)...))
}

func TestJavaScript(t *testing.T) {
	need(t, "node")
	check(t, run(t, "node", append([]string{"javascript/fire.mjs"}, args...)...))
}

func TestGo(t *testing.T) {
	need(t, "go")
	goArgs := []string{"run", "../cmd/doomfire"}
	for i := 0; i < len(args); i += 2 {
		goArgs = append(goArgs, "-"+strings.TrimPrefix(args[i], "--"), args[i+1])
	}
	check(t, run(t, "go", goArgs...))
}
