// The fire in GLSL, on the GPU (WebGL 2). Two textures take turns: one
// holds the last step, and the shader writes the next step into the other.

const VERTEX = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

const DRAW = `#version 300 es
precision highp float;
uniform sampler2D u_fire;
uniform sampler2D u_palette;
uniform ivec2 u_size;
out vec4 color;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int i = int(texelFetch(u_fire, p, 0).r * 255.0 + 0.5);
  color = texelFetch(u_palette, ivec2(i, 0), 0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function program(gl, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, "a_position");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const uniforms = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
    const name = gl.getActiveUniform(p, i).name;
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { p, uniforms };
}

export class GLSLFire {
  name = "GLSL";
  where = "GPU · WebGL 2";

  async init(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("this browser has no WebGL 2");
    this.gl = gl;
    this.canvas = canvas;
    const source = await (await fetch("engines/fire.frag")).text();
    this.stepProgram = program(gl, source);
    this.drawProgram = program(gl, DRAW);

    // One triangle that covers the whole canvas.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.paletteTexture = gl.createTexture();
    this.textures = [];
    this.framebuffers = [];
    this.current = 0;
    this.seed = 1;
    this.cfg = null;
  }

  texture(w, h) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(w * h));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return [t, fb];
  }

  configure(cfg) {
    const gl = this.gl;
    if (!this.cfg || cfg.width !== this.cfg.width || cfg.height !== this.cfg.height) {
      this.textures.forEach((t) => gl.deleteTexture(t));
      this.framebuffers.forEach((f) => gl.deleteFramebuffer(f));
      const a = this.texture(cfg.width, cfg.height);
      const b = this.texture(cfg.width, cfg.height);
      this.textures = [a[0], b[0]];
      this.framebuffers = [a[1], b[1]];
      this.canvas.width = cfg.width;
      this.canvas.height = cfg.height;
    }
    this.cfg = cfg;
  }

  palette(rgba) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 37, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  step(n = 1) {
    const gl = this.gl;
    const { p, uniforms: u } = this.stepProgram;
    const { width, height, decay, wind, source } = this.cfg;
    gl.useProgram(p);
    gl.viewport(0, 0, width, height);
    gl.uniform2i(u.u_size, width, height);
    gl.uniform1i(u.u_decay, decay);
    gl.uniform1i(u.u_wind, wind);
    gl.uniform1i(u.u_source, source);
    gl.uniform1i(u.u_fire, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (let i = 0; i < n; i++) {
      const next = 1 - this.current;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[next]);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[this.current]);
      gl.uniform1ui(u.u_seed, this.seed++ >>> 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.current = next;
    }
  }

  draw() {
    const gl = this.gl;
    const { p, uniforms: u } = this.drawProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(p);
    gl.viewport(0, 0, this.cfg.width, this.cfg.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.current]);
    gl.uniform1i(u.u_fire, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.uniform1i(u.u_palette, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  // sync waits for the GPU: reading one pixel makes the browser finish
  // all the work before it.
  sync() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.current]);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }
}
