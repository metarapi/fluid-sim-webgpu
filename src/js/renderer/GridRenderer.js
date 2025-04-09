import { BaseRenderer } from './BaseRenderer.js';

export class GridRenderer extends BaseRenderer {
  constructor(device, canvas, config) {
    super(device, canvas, config);
    this.minDensity = 0;
    this.maxDensity = 30;
  }

  async initialize() {
    // Get WebGPU context
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

    // Create grid rendering resources
    await this.createRenderResources();

    // Set up event listeners
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('canvasResize', this.handleResize);
    this.handleResize();

    return this;
  }

  async createRenderResources() {
    // Load shader
    const shaderCode = await this.loadShader('gridRender.wgsl');

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      label: "Grid shader",
      code: shaderCode
    });

    // Create vertices for a quad
    this.createQuadBuffers();

    // Create uniform buffer for grid parameters
    this.uniformBuffer = this.device.createBuffer({
      label: "Grid uniforms",
      size: 40, // 2 vec2<f32> (worldSize, gridSize) + 2 vec2<f32> (cellSize, minMaxDensity) = 32 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Update uniform values
    this.updateUniforms();

    // Create pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [
          {
            // Quad vertex positions
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'vertex',
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2'
            }]
          },
          {
            // UVs
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'vertex',
            attributes: [{
              shaderLocation: 1,
              offset: 0,
              format: 'float32x2'
            }]
          },
          {
            // Grid cell indices (instance data)
            arrayStride: 2 * Uint32Array.BYTES_PER_ELEMENT,
            stepMode: 'instance',
            attributes: [{
              shaderLocation: 2,
              offset: 0,
              format: 'uint32x2'
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
  }

  // Create buffers for the rendering quads
  createQuadBuffers() {
    // Vertex buffer (positions)
    const positions = new Float32Array([
      0, 0,    // Bottom left
      1, 0,    // Bottom right
      0, 1,    // Top left
      1, 1     // Top right
    ]);

    this.positionBuffer = this.device.createBuffer({
      label: "Grid quad positions",
      size: positions.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.positionBuffer.getMappedRange()).set(positions);
    this.positionBuffer.unmap();

    // UV buffer
    const uvs = new Float32Array([
      0, 0,    // Bottom left
      1, 0,    // Bottom right
      0, 1,    // Top left
      1, 1     // Top right
    ]);

    this.uvBuffer = this.device.createBuffer({
      label: "Grid quad UVs",
      size: uvs.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.uvBuffer.getMappedRange()).set(uvs);
    this.uvBuffer.unmap();

    // Index buffer
    const indices = new Uint16Array([
      0, 1, 2,    // First triangle
      2, 1, 3     // Second triangle
    ]);

    this.indexBuffer = this.device.createBuffer({
      label: "Grid quad indices",
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();

    // Create grid cell instance data
    this.createGridInstanceData();
  }

  // Create buffer with one instance per grid cell
  createGridInstanceData() {
    const gridSizeX = this.config.gridSizeX;
    const gridSizeY = this.config.gridSizeY;
    const instanceCount = gridSizeX * gridSizeY;

    // Each instance needs its grid coordinates
    const instanceData = new Uint32Array(instanceCount * 2);

    let idx = 0;
    for (let j = 0; j < gridSizeY; j++) {
      for (let i = 0; i < gridSizeX; i++) {
        instanceData[idx++] = i;  // x grid coordinate
        instanceData[idx++] = j;  // y grid coordinate
      }
    }

    this.instanceBuffer = this.device.createBuffer({
      label: "Grid instance data",
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Uint32Array(this.instanceBuffer.getMappedRange()).set(instanceData);
    this.instanceBuffer.unmap();
  }

  // Update uniform values
  updateUniforms() {
    const data = new ArrayBuffer(40);
    const view = new DataView(data);

    // worldSize (vec2<f32>)
    view.setFloat32(0, this.config.lengthX, true);
    view.setFloat32(4, this.config.lengthY, true);

    // gridSize (vec2<f32>)
    view.setFloat32(8, this.config.gridSizeX, true);
    view.setFloat32(12, this.config.gridSizeY, true);

    // cellSize (vec2<f32>)
    view.setFloat32(16, this.config.lengthX / this.config.gridSizeX, true);
    view.setFloat32(20, this.config.lengthY / this.config.gridSizeY, true);

    // minMaxDensity (vec2<f32>)
    view.setFloat32(24, this.minDensity, true);
    view.setFloat32(28, this.maxDensity, true);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  // Render the grid visualization
  render(buffers) {
    if (!this.pipeline || !this.context) return;

    try {
      // Check for densityGrid instead of gridDensity
      if (!buffers.densityGrid) {
        console.warn("No density buffer available for grid rendering");
        console.log("Available buffers:", Object.keys(buffers));
        return;
      }

      // Create bind group for this frame with the correct buffer name
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer }
          },
          {
            binding: 1,
            resource: { buffer: buffers.densityGrid }
          }
        ]
      });

      // Create command encoder
      const commandEncoder = this.device.createCommandEncoder();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });

      // Set up rendering
      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.setVertexBuffer(0, this.positionBuffer);
      renderPass.setVertexBuffer(1, this.uvBuffer);
      renderPass.setVertexBuffer(2, this.instanceBuffer);
      renderPass.setIndexBuffer(this.indexBuffer, 'uint16');

      // Draw one instance per grid cell
      renderPass.drawIndexed(6, this.config.gridSizeX * this.config.gridSizeY);
      renderPass.end();

      // Submit command buffer
      this.device.queue.submit([commandEncoder.finish()]);
    } catch (err) {
      console.error("Error rendering grid:", err);
    }
  }

  // Handle window resize
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

  // Clean up resources
  destroy() {
    window.removeEventListener('canvasResize', this.handleResize);

    if (this.context) {
      try {
        this.context.unconfigure();
      } catch (e) {
        console.warn("Error unconfiguring context:", e);
      }
      this.context = null;
    }

    this.positionBuffer = null;
    this.uvBuffer = null;
    this.indexBuffer = null;
    this.instanceBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.device = null;
    this.canvas = null;
  }

  // Set the min/max density range for visualization
  setDensityRange(min, max) {
    this.minDensity = min;
    this.maxDensity = max;
    this.updateUniforms();
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
      throw err;
    }
  }
}