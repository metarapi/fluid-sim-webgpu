import { initializeTerrain } from './terrainBuffers.js';
import { initPCGBuffers } from './pcgBuffers.js';

/**
 * Initialize all simulation buffers
 * @param {Object} state - Main simulation state object
 * @returns {Object} All created buffers
 */
export async function initBuffers(state) {
    const { device, config } = state;
    
    // Create all simulation buffers
    const buffers = {
      // Unified terrain initialization
      ...await initializeTerrain(device, config),

      // Simulation parameters (uniform buffer)
      ...await initSimParams(device, config),

      // Physics parameters (uniform buffer)
      ...await initPhysicsParams(device, config),
      
      // Particle-related buffers
      particles: await initParticles(device, config),
      
      // Grid-related buffers 
      ...await initGrids(device, config),
            
      // Prefix sum buffers
      ...await initPrefixSumBuffers(device, config),

      // PCG solver buffers
      ...await initPCGBuffers(device, config)
    };

    // Return all created buffers
    return buffers;
  }

/**
 * Initialize simulation parameters buffer
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} Created buffer
 */
async function initSimParams(device, config) {
    const {
      lengthX, lengthY,
      gridSizeX, gridSizeY,
      particleCount, pushApartSteps,
      worldToGridX, worldToGridY,
      gridToWorldX, gridToWorldY,
      minDistance,
    } = config;
    
    // Create unified simulation parameters (16 parameters * 4 bytes each)
    const buffer = new ArrayBuffer(16 * 4);
    const dataView = new DataView(buffer);
    let offset = 0;
    
    // Simulation dimensions
    dataView.setFloat32(offset, lengthX, true); offset += 4;      // length_x
    dataView.setFloat32(offset, lengthY, true); offset += 4;      // length_y
    
    // Grid dimensions
    dataView.setUint32(offset, gridSizeX, true); offset += 4;     // size_x
    dataView.setUint32(offset, gridSizeY, true); offset += 4;     // size_y
    
    // Object counts
    dataView.setUint32(offset, particleCount, true); offset += 4; // particle_count
    
    // Precomputed conversion factors
    dataView.setFloat32(offset, worldToGridX, true); offset += 4; // world_to_grid_x
    dataView.setFloat32(offset, worldToGridY, true); offset += 4; // world_to_grid_y
    dataView.setFloat32(offset, gridToWorldX, true); offset += 4; // grid_to_world_x
    dataView.setFloat32(offset, gridToWorldY, true); offset += 4; // grid_to_world_y
    
    // Particle properties
    dataView.setFloat32(offset, minDistance, true); offset += 4;                // min_dist
    dataView.setFloat32(offset, minDistance * minDistance, true); offset += 4;  // min_dist2
    dataView.setFloat32(offset, minDistance/2, true); offset += 4;              // particle_radius
    
    // Simulation control
    dataView.setUint32(offset, pushApartSteps, true); offset += 4;              // num_substeps
    dataView.setUint32(offset, 0, true);offset += 4;                            // current_substep
    dataView.setUint32(offset, config.workgroupCount || 64, true); offset += 4;

    dataView.setUint32(offset, config.upscaledTerrainCount || 4096, true);      // upscaled_terrain_count
    
    // Create and initialize the buffer
    const simParamsBuffer = device.createBuffer({
      size: buffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(simParamsBuffer, 0, buffer);
        
    return { simParams: simParamsBuffer };
  }

/**
 * Initialize physics parameters buffer
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} Created buffer
 */
async function initPhysicsParams(device, config) {

  // Create unified physics parameters (12 parameters * 4 bytes each)
  const buffer = new ArrayBuffer(12 * 4);
  const dataView = new DataView(buffer);
  let offset = 0;

  // Gravity (vec2)
  dataView.setFloat32(offset, 0.0, true); offset += 4;          // gravity_x  #0
  dataView.setFloat32(offset, -9.81, true); offset += 4;        // gravity_y  #4
  // dataView.setFloat32(offset, 0.0, true); offset += 4;        // gravity_y

  // Time step
  dataView.setFloat32(offset, 1/60, true); offset += 4;          // dt  #8

  // Pressure solver parameters
  dataView.setFloat32(offset, 0.001, true); offset += 4;          // dynamic(?) viscosity coefficient #12

  // Fluid density parameters
  dataView.setFloat32(offset, 1.0, true); offset += 4;           // fluid_density (not in kg/m³)  #16
  dataView.setFloat32(offset, 20.0, true); offset += 4;          // target_density  #20
  dataView.setFloat32(offset, 1.0, true); offset += 4;           // density_correction_strength #24

  // Viscosity and PIC/FLIP
  dataView.setFloat32(offset, 0.95, true); offset += 4;          // velocity_damping  #28
  dataView.setFloat32(offset, 0.95, true); offset += 4;          // pic_flip_ratio (0=PIC, 1=FLIP)  #32

  // Collision parameters
  dataView.setFloat32(offset, 0.1, true); offset += 4;           // normal_restitution  #36
  dataView.setFloat32(offset, 0.8, true); offset += 4;           // tangent_restitution #40

  // Padding to meet alignment requirements
  dataView.setFloat32(offset, 0.0, true);                        // padding #44

  // Create and initialize the buffer
  const physParamsBuffer = device.createBuffer({
    size: buffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(physParamsBuffer, 0, buffer);
      
  return { physParams: physParamsBuffer };
}



  /**
 * Initialize particle-related buffers
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} Created particle buffers
 */
async function initParticles(device, config) {
    const { particleCount, lengthX, lengthY } = config;
    
    const positionData = new Float32Array(particleCount * 2);  // x,y
    const velocityData = new Float32Array(particleCount * 2);  // u,v
    const particleVelocityPongData = new Float32Array(particleCount * 2);  // prev_u,prev_v
    
    // Calculate grid dimensions (assuming particleCount has an integer square root)
    const side = Math.sqrt(particleCount);
    
    // Define the rectangle parameters
    const startX = lengthX * 0.05;  // Starting X position (80% of grid width)
    const startY = lengthY * 0.55;  // Starting Y position (middle of grid height)
    const width = lengthX * 0.9;  // Width of particle rectangle
    const height = lengthY * 0.40; // Height of particle rectangle
    
    // Calculate spacing between particles
    const spacingX = width / (side - 1);
    const spacingY = height / (side - 1);
    
    // Place particles in a grid pattern
    for(let i = 0; i < particleCount; i++) {
      const row = Math.floor(i / side);
      const col = i % side;
      
      positionData[i * 2] = startX + (col * spacingX)      // + (Math.random() - 0.5) * 0.1; // Add random noise
      positionData[i * 2 + 1] = startY + (row * spacingY)  // + (Math.random() - 0.5) * 0.1; // Add random noise
      
      // Ensure particles stay within world bounds
      // positionData[i * 2] = Math.min(Math.max(positionData[i * 2], 1), lengthX - 1);
      // positionData[i * 2 + 1] = Math.min(Math.max(positionData[i * 2 + 1], 1), lengthY - 1);
      
      // Velocity (u,v) - initialized to 0
      velocityData[i * 2] = 0.0;        // u
      velocityData[i * 2 + 1] = 0.0;    // v

      // // Testing: spatially varying velocity field
      // velocityData[i * 2] = Math.sin(i/10) * Math.cos(i/15) * 1000.0;  // u - spatially varying
      // velocityData[i * 2 + 1] = -0.981 + Math.sin(i/8) * 1000.0;       // v - spatially varying
      
      // Pong velocity - initialized to 0
      particleVelocityPongData[i * 2] = 0.0;      // prev_u
      particleVelocityPongData[i * 2 + 1] = 0.0;  // prev_v
    }
    
    // Create and initialize the buffers
    const particlePosition = device.createBuffer({
      size: positionData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
    });
    
    const particlePositionPong = device.createBuffer({
      size: positionData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    const particleVelocity = device.createBuffer({
      size: velocityData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    const particleVelocityPong = device.createBuffer({
      size: particleVelocityPongData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
   
    device.queue.writeBuffer(particlePosition, 0, positionData);
    device.queue.writeBuffer(particlePositionPong, 0, positionData);
    device.queue.writeBuffer(particleVelocity, 0, velocityData);
    device.queue.writeBuffer(particleVelocityPong, 0, particleVelocityPongData);
    
    return {
      particlePosition,
      particlePositionPong,
      particleVelocity,
      particleVelocityPong,
    };
  }

  /**
 * Initialize grid-related buffers
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} Created grid buffers
 */
async function initGrids(device, config) {
    const { gridSizeX, gridSizeY, numberOfCells } = config;
    
    // Initialize the pressure grid and the MAC grids
    const pressureData = new Float32Array(numberOfCells);
    const densityData = new Float32Array(numberOfCells);
    const uData = new Float32Array((gridSizeX + 1) * gridSizeY);
    const vData = new Float32Array(gridSizeX * (gridSizeY + 1));
    const uMask = new Uint32Array((gridSizeX + 1) * gridSizeY).fill(0); // 0 for empty cells
    const vMask = new Uint32Array(gridSizeX * (gridSizeY + 1)).fill(0); // 0 for empty cells
    const cellTypeArray = new Uint32Array(config.numberOfCells).fill(1); // AIR by default
    const volumeFractionsArray = new Float32Array(numberOfCells).fill(0.0); // 0.0 for solid cells
    
    // Create buffers for the grids
    const pressureGrid = device.createBuffer({
      size: pressureData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    const densityGrid = device.createBuffer({
      size: densityData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    const uGrid = device.createBuffer({
      size: uData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    const vGrid = device.createBuffer({
      size: vData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    // Setup the MAC grid masks for the velocity transfer
    const uGridMask = device.createBuffer({
      size: uMask.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const vGridMask = device.createBuffer({
      size: vMask.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // Set up the previous buffers for the MAC grid (for the PIC/FLIP delta)
    const uGridPrev = device.createBuffer({
      size: uData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    const vGridPrev = device.createBuffer({
      size: vData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // Initialize cell types
    const cellType = device.createBuffer({
        size: cellTypeArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    // Initialize volume fractions (if needed)
    const volumeFractions = device.createBuffer({
        size: volumeFractionsArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // Write the data to the buffers
    device.queue.writeBuffer(pressureGrid, 0, pressureData);
    device.queue.writeBuffer(densityGrid, 0, densityData);
    device.queue.writeBuffer(uGrid, 0, uData);
    device.queue.writeBuffer(vGrid, 0, vData);
    device.queue.writeBuffer(uGridMask, 0, uMask);
    device.queue.writeBuffer(vGridMask, 0, vMask);
    device.queue.writeBuffer(uGridPrev, 0, uData);
    device.queue.writeBuffer(vGridPrev, 0, vData);
    device.queue.writeBuffer(cellType, 0, cellTypeArray);
    device.queue.writeBuffer(volumeFractions, 0, volumeFractionsArray);

    return {
      pressureGrid,
      densityGrid,
      uGrid,
      vGrid,
      uGridMask,
      vGridMask,
      uGridPrev,
      vGridPrev,
      cellType,
      volumeFractions,
    };
  }

  /**
 * Initialize buffers for prefix sum algorithm
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} Created prefix sum buffers
 */
async function initPrefixSumBuffers(device, config) {
    const { numberOfCells, particleCount, prefixSum } = config;
    
    // Get workgroup sizes from configuration
    const { workgroupSize, numWorkgroups1, numWorkgroups2, numWorkgroups3 } = prefixSum;
       
    // Initialize numCellParticles buffer with zeros (this is the inputBuffer for prefix sum)
    const numCellParticles = new Uint32Array(numberOfCells).fill(0);
    const numCellParticlesBuffer = device.createBuffer({
      size: numCellParticles.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(numCellParticlesBuffer, 0, numCellParticles);
    
    // Initialize the firstCellParticle buffer with zeros (this is the outputBuffer1 for prefix sum)
    const firstCellParticle = new Uint32Array(numberOfCells + 1).fill(0); // +1 for the guard element
    const firstCellParticleBuffer = device.createBuffer({
      size: firstCellParticle.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(firstCellParticleBuffer, 0, firstCellParticle);
    
    // Create intermediate buffers for prefix sum algorithm
    const intermediateBuffer1 = device.createBuffer({
      size: numWorkgroups1 * 4 * 4, // numWorkgroups1 * vec4 * 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    const outputBuffer2 = device.createBuffer({
      size: numWorkgroups1 * 4 * 4, // Same as intermediateBuffer1
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    const intermediateBuffer2 = device.createBuffer({
      size: numWorkgroups2 * 4 * 4, // numWorkgroups2 * vec4 * 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    const outputBuffer3 = device.createBuffer({
      size: numWorkgroups2 * 4 * 4, // Same as intermediateBuffer2
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    // Create particle ID assignment buffer
    const cellParticleIds = new Int32Array(particleCount).fill(-1);
    const cellParticleIdsBuffer = device.createBuffer({
      size: cellParticleIds.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(cellParticleIdsBuffer, 0, cellParticleIds);
    
    return {
      numCellParticles: numCellParticlesBuffer,
      firstCellParticle: firstCellParticleBuffer,
      intermediateBuffer1,
      outputBuffer2,
      intermediateBuffer2,
      outputBuffer3,
      cellParticleIds: cellParticleIdsBuffer
    };
  }