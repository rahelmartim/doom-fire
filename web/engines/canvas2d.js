// Draws intensities on a 2D canvas, for the engines that run on the CPU.

export class CanvasDrawer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.image = null;
    this.colors = new Uint32Array(37);
  }

  palette(rgba) {
    // One 32-bit color for each intensity, in the byte order of ImageData.
    this.colors = new Uint32Array(rgba.buffer.slice(0));
  }

  draw(pixels, w, h) {
    if (!this.image || this.image.width !== w || this.image.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.image = this.context.createImageData(w, h);
    }
    const out = new Uint32Array(this.image.data.buffer);
    for (let i = 0; i < pixels.length; i++) out[i] = this.colors[pixels[i]];
    this.context.putImageData(this.image, 0, 0);
  }
}
