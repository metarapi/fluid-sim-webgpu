export class BaseRenderer {
    constructor(device, canvas, config) {
      this.device = device;
      this.canvas = canvas;
      this.config = config;
      this.context = null;
      this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    }
    
    async initialize() { throw new Error("Not implemented"); }
    render(buffers) { throw new Error("Not implemented"); }
    destroy() { throw new Error("Not implemented"); }
    handleResize() { throw new Error("Not implemented"); }
  }