// The fire of Doom in C, for a terminal with 24-bit color.
//
//   cc -O2 -o fire fire.c && ./fire --width 80 --height 30 --wind 1
//
// The options are --width, --height, --decay, --wind, --source, --fps,
// and --frames (0 draws until Ctrl+C).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_INTENSITY 36

static const unsigned char palette[MAX_INTENSITY + 1][3] = {
    {7, 7, 7}, {31, 7, 7}, {47, 15, 7}, {71, 15, 7}, {87, 23, 7}, {103, 31, 7}, {119, 31, 7},
    {143, 39, 7}, {159, 47, 7}, {175, 63, 7}, {191, 71, 7}, {199, 71, 7}, {223, 79, 7},
    {223, 87, 7}, {223, 87, 7}, {215, 95, 7}, {215, 95, 7}, {215, 103, 15}, {207, 111, 15},
    {207, 119, 15}, {207, 127, 15}, {207, 135, 23}, {199, 135, 23}, {199, 143, 23},
    {199, 151, 31}, {191, 159, 31}, {191, 159, 31}, {191, 167, 39}, {191, 167, 39},
    {191, 175, 47}, {183, 175, 47}, {183, 183, 47}, {183, 183, 55}, {207, 207, 111},
    {223, 223, 159}, {239, 239, 199}, {255, 255, 255},
};

static int clamp(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }

// step:start
void step(unsigned char *pixels, int w, int h, int decay_max, int wind, int source) {
    for (int x = 0; x < w; x++) pixels[(h - 1) * w + x] = (unsigned char)source;
    // From the top down, so that each row reads the row below it before
    // that row changes.
    for (int y = 0; y < h - 1; y++) {
        for (int x = 0; x < w; x++) {
            int decay = decay_max > 0 ? rand() % (decay_max + 1) : 0;
            int from = ((x + decay * wind) % w + w) % w;
            int v = pixels[(y + 1) * w + from] - decay;
            pixels[y * w + x] = (unsigned char)(v < 0 ? 0 : v);
        }
    }
}
// step:end

static void draw(const unsigned char *pixels, int w, int h) {
    fputs("\x1b[H", stdout);
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            const unsigned char *c = palette[pixels[y * w + x]];
            printf("\x1b[48;2;%d;%d;%dm  ", c[0], c[1], c[2]);
        }
        fputs("\x1b[0m\n", stdout);
    }
    fflush(stdout);
}

int main(int argc, char **argv) {
    int w = 80, h = 30, decay = 3, wind = 0, source = MAX_INTENSITY, fps = 30, frames = 0;
    for (int i = 1; i + 1 < argc; i += 2) {
        int v = atoi(argv[i + 1]);
        if (!strcmp(argv[i], "--width")) w = v;
        else if (!strcmp(argv[i], "--height")) h = v;
        else if (!strcmp(argv[i], "--decay")) decay = v;
        else if (!strcmp(argv[i], "--wind")) wind = v;
        else if (!strcmp(argv[i], "--source")) source = v;
        else if (!strcmp(argv[i], "--fps")) fps = v;
        else if (!strcmp(argv[i], "--frames")) frames = v;
    }
    w = clamp(w, 1, 400), h = clamp(h, 2, 300), decay = clamp(decay, 0, 12);
    wind = clamp(wind, -3, 3), source = clamp(source, 0, MAX_INTENSITY), fps = clamp(fps, 1, 240);

    unsigned char *pixels = calloc((size_t)w * h, 1);
    if (!pixels) return 1;
    srand((unsigned)time(NULL));
    struct timespec pause = {0, 1000000000L / fps};

    fputs("\x1b[?25l\x1b[2J", stdout);
    for (int n = 0; frames == 0 || n < frames; n++) {
        step(pixels, w, h, decay, wind, source);
        draw(pixels, w, h);
        nanosleep(&pause, NULL);
    }
    fputs("\x1b[0m\x1b[?25h", stdout);
    free(pixels);
    return 0;
}
