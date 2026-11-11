//go:build js && wasm

// The WebAssembly build of the Go fire, for the page. It sets a global
// object "goFire":
//
//	goFire.configure(width, height, decay, wind, source)
//	goFire.step(n)          runs n steps
//	goFire.read(uint8Array) copies the intensities into the array
package main

import (
	"syscall/js"
	"time"

	"github.com/rahelmartim/doom-fire/fire"
)

func main() {
	f := fire.New(fire.Default, uint64(time.Now().UnixNano()))
	api := js.Global().Get("Object").New()
	api.Set("configure", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) < 5 {
			return nil
		}
		f.Configure(fire.Config{
			Width: args[0].Int(), Height: args[1].Int(), Decay: args[2].Int(), Wind: args[3].Int(), Source: args[4].Int(),
		})
		return nil
	}))
	api.Set("step", js.FuncOf(func(_ js.Value, args []js.Value) any {
		n := 1
		if len(args) > 0 {
			n = max(1, args[0].Int())
		}
		for range n {
			f.Step()
		}
		return nil
	}))
	api.Set("read", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) < 1 {
			return 0
		}
		return js.CopyBytesToJS(args[0], f.Pixels)
	}))
	js.Global().Set("goFire", api)
	js.Global().Call("dispatchEvent", js.Global().Get("Event").New("gofire-ready"))
	select {}
}
