SITE := site
PORT ?= 8080

.PHONY: test web serve fire c python node clean

## test: vet and run the Go tests (they also run the C, Python, and JavaScript versions)
test:
	go vet ./...
	go test -race ./...

## web: build the page into site/
web:
	rm -rf $(SITE) && mkdir -p $(SITE)/engines $(SITE)/code
	cp web/index.html web/style.css web/app.js $(SITE)/
	cp web/engines/*.js web/engines/*.frag $(SITE)/engines/
	# As .txt: Go must not read site/code as a package.
	cp fire/fire.go $(SITE)/code/fire.go.txt
	cp languages/c/fire.c $(SITE)/code/fire.c.txt
	cp languages/python/fire.py $(SITE)/code/fire.py.txt
	cp "$$(go env GOROOT)/lib/wasm/wasm_exec.js" $(SITE)/
	GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o $(SITE)/fire.wasm ./cmd/fire-wasm

## serve: build the page and serve it on http://localhost:$(PORT)
serve: web
	python3 -m http.server $(PORT) --directory $(SITE)

## fire: the fire in Go, in the terminal
fire:
	go run ./cmd/doomfire

## c: the fire in C, in the terminal
c:
	cc -O2 -o /tmp/doomfire-c languages/c/fire.c && /tmp/doomfire-c

## python: the fire in Python, in the terminal
python:
	python3 languages/python/fire.py

## node: the fire in JavaScript, in the terminal
node:
	node languages/javascript/fire.mjs

clean:
	rm -rf $(SITE)
