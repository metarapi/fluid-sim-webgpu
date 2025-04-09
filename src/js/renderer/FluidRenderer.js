import { BaseRenderer } from './BaseRenderer.js';

export class FluidRenderer extends BaseRenderer {
  constructor(device, canvas, config) {
    super(device, canvas, config);
    this.device = device;
    this.canvas = canvas;
    this.config = config;
    this.context = canvas.getContext('webgpu');
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.renderResources = null;
  }

  // Initialize rendering resources
  async initialize() {
    // Get WebGPU context from canvas
    this.context = this.canvas.getContext('webgpu');
    if (!this.context) {
      throw new Error("Could not get WebGPU context from canvas");
    }
    // Configure canvas
    this.context.configure({
      device: this.device,
      format: this.canvasFormat,
      alphaMode: 'premultiplied'
    });

    // Create resources
    await this.createRenderResources();

    // Set up event listeners
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('canvasResize', this.handleResize);
    this.handleResize();

    return this;
  }

  destroy() {
    // Clean up event listeners
    window.removeEventListener('canvasResize', this.handleResize);

    // Unconfigure the context
    if (this.context) {
      try {
        this.context.unconfigure();
      } catch (e) {
        console.warn("Error unconfiguring context:", e);
      }
      this.context = null;
    }

    // Clean up buffer resources
    if (this.quadVertexBuffer) {
      this.quadVertexBuffer = null;
    }

    if (this.quadIndexBuffer) {
      this.quadIndexBuffer = null;
    }

    if (this.uniformBuffer) {
      this.uniformBuffer = null;
    }

    if (this.bindGroup) {
      this.bindGroup = null;
    }

    if (this.pipeline) {
      this.pipeline = null;
    }

    this.canvas = null;
    this.device = null;
    this.config = null;

    console.log("Renderer resources destroyed");
  }

  // Create all rendering resources (buffers, pipeline, etc.)
  async createRenderResources() {
    // Create quad buffer for particle rendering
    this.createQuadBuffers();

    // Load the shader module
    const shaderCode = await this.loadShader('particleRender.wgsl');

    const shaderModule = this.device.createShaderModule({
      label: "Particle shader",
      code: shaderCode
    });

    // Create pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [
          // Quad vertices buffer layout
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'vertex',
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2'
            }]
          },
          // Particle positions buffer layout (from simulation)
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'instance',
            attributes: [{
              shaderLocation: 1,
              offset: 0,
              format: 'float32x2'
            }]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.canvasFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      }
    });

    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      label: "Renderer uniforms",
      size: 16, // vec2<f32> + f32 + u32 = 16 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Set initial uniform values
    this.updateUniforms();

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    });
  }

  // Create quad vertex and index buffers
  createQuadBuffers() {
    // Create quad vertex buffer
    const quadVertexArray = new Float32Array([
      -0.5, -0.5,  // Vertex 0 (bottom-left)
      0.5, -0.5,   // Vertex 1 (bottom-right)
      -0.5, 0.5,   // Vertex 2 (top-left)
      0.5, 0.5,    // Vertex 3 (top-right)
    ]);

    this.quadVertexBuffer = this.device.createBuffer({
      label: "Quad vertices",
      size: quadVertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.quadVertexBuffer.getMappedRange()).set(quadVertexArray);
    this.quadVertexBuffer.unmap();

    // Create index buffer
    const indexArray = new Uint16Array([
      0, 1, 2,  // First triangle
      2, 1, 3   // Second triangle
    ]);

    this.indexBuffer = this.device.createBuffer({
      label: "Quad indices",
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indexArray);
    this.indexBuffer.unmap();
  }

  // Update uniform values
  updateUniforms() {
    const uniformData = new ArrayBuffer(16);
    const dataView = new DataView(uniformData);

    // worldSize (vec2<f32>)
    dataView.setFloat32(0, this.config.lengthX, true);
    dataView.setFloat32(4, this.config.lengthY, true);

    // Make particles bigger to be visible - use 10x minDistance
    dataView.setFloat32(8, this.config.minDistance, true); // particleSize
    //   dataView.setFloat32(8, 0.05, true); // Fixed particleSize of 0.05 (about 1/60th of world)

    dataView.setUint32(12, this.config.particleCount, true); // particleCount

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  // Modified handleResize function for both renderers
  handleResize() {
    // Get the container dimensions
    const container = this.canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Simply match the canvas size to the container size
    this.canvas.width = containerWidth;
    this.canvas.height = containerHeight;

    // Update uniforms when canvas size changes
    if (this.uniformBuffer) {
      this.updateUniforms();
    }
  }

  // Render particles from simulation buffers
  render(buffers) {
    if (!this.pipeline || !this.bindGroup) return;

    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.3, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    // Set pipeline and buffers
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.quadVertexBuffer);
    renderPass.setVertexBuffer(1, buffers.particles.particlePosition);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint16');

    // Draw particles as instanced quads (6 indices per quad)
    // renderPass.drawIndexed(6, Math.min(this.config.particleCount, 500000));
    renderPass.drawIndexed(6, this.config.particleCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  // Helper to load shader
  async loadShader(filename) {
    try {
      const response = await fetch(`src/shaders/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load shader: ${filename} (${response.status} ${response.statusText})`);
      }
      return await response.text();
    } catch (err) {
      console.error("Error loading shader:", err);
      throw err; // Re-throw to let the caller handle the error
    }
  }
}