#version 300 es
// The step of the fire in GLSL. The GPU runs main once for every pixel,
// all at the same time. The texture has the bottom row at y = 0.
precision highp float;
precision highp int;

uniform sampler2D u_fire;  // the intensities of the last step, in the red channel
uniform ivec2 u_size;
uniform int u_decay;
uniform int u_wind;
uniform int u_source;
uniform uint u_seed;
out vec4 color;

// A small hash: a random number for each pixel and each step.
uint hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

// step:start
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (p.y == 0) {
    color = vec4(float(u_source) / 255.0);
    return;
  }
  uint r = hash(uint(p.x) + uint(p.y) * 4099u + u_seed * 16777259u);
  int decay = u_decay > 0 ? int(r % uint(u_decay + 1)) : 0;
  // Add a multiple of the width, so that % never sees a negative number.
  int from = (p.x + decay * u_wind + 40 * u_size.x) % u_size.x;
  int below = int(texelFetch(u_fire, ivec2(from, p.y - 1), 0).r * 255.0 + 0.5);
  color = vec4(float(max(below - decay, 0)) / 255.0);
}
// step:end
