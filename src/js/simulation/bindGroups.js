/**
 * Initialize all bind groups needed for the simulation
 * @param {Object} state - Main simulation state
 * @returns {Object} All created bind groups
 */
export async function initBindGroups(state) {
    const { device, buffers, pipelines, config } = state;
    
    // Create all bind groups
    return {

      // Cell marking bind groups
      ...createMarkingBindGroups(device, buffers, pipelines),
      
      // Particle handling bind groups
      ...createParticleBindGroups(device, buffers, pipelines),
      
      // Prefix sum bind groups
      ...createPrefixSumBindGroups(device, buffers, pipelines, config),
      
      // Fluid dynamics bind groups
      ...createFluidBindGroups(device, buffers, pipelines),

      // PCG solver bind groups
      ...createPCGBindGroups(device, buffers, pipelines),

      // Transfer and advection bind groups
      ...createTransferAndAdvectionBindGroups(device, buffers, pipelines)
    };
  }
  
  /**
   * Create cell marking related bind groups
   * @param {GPUDevice} device - WebGPU device
   * @param {Object} buffers - All simulation buffers
   * @param {Object} pipelines - All simulation pipelines
   * @returns {Object} Cell marking bind groups
   */
  function createMarkingBindGroups(device, buffers, pipelines) {
    // Create Bresenham bind group for terrain line drawing
    // const bresenham = device.createBindGroup({
    //   layout: pipelines.bresenham.layout,
    //   entries: [
    //     { binding: 0, resource: { buffer: buffers.terrain } },
    //     { binding: 1, resource: { buffer: buffers.simParams } },
    //     { binding: 2, resource: { buffer: buffers.terrainHeights } },
    //     { binding: 3, resource: { buffer: buffers.terrainParams } }
    //   ]
    // });
  
    // Create mark solid bind group for marking solid cells
    const markSolid = device.createBindGroup({
      layout: pipelines.markSolid.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.cellType } },
        { binding: 1, resource: buffers.terrainTexture.createView() },
        { binding: 2, resource: { buffer: buffers.simParams } },
      ]
    });
  
    // Create mark liquid bind group for marking liquid cells
    const markLiquid = device.createBindGroup({
      layout: pipelines.markLiquid.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.cellType } },
        { binding: 1, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 2, resource: { buffer: buffers.simParams } }
      ]
    });
  
    return {
      // bresenham,
      markSolid,
      markLiquid
    };
  }
  
  /**
   * Create particle handling related bind groups
   * @param {GPUDevice} device - WebGPU device
   * @param {Object} buffers - All simulation buffers
   * @param {Object} pipelines - All simulation pipelines
   * @returns {Object} Particle bind groups
   */
  function createParticleBindGroups(device, buffers, pipelines) {
    // Create particle to cell mapping bind group
    const particleToCell = device.createBindGroup({
      layout: pipelines.particleToCell.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 1, resource: { buffer: buffers.numCellParticles } },
        { binding: 2, resource: { buffer: buffers.simParams } }
      ]
    });
    
    // Create particle ID assignment bind group
    const particleIdAssignment = device.createBindGroup({
      layout: pipelines.particleIdAssignment.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 1, resource: { buffer: buffers.firstCellParticle } },    
        { binding: 2, resource: { buffer: buffers.cellParticleIds } },       
        { binding: 3, resource: { buffer: buffers.simParams } }     
      ]
    });
    
    // Create push particles apart ping bind group (reading from position, writing to pong)
    const pushParticlesApartPing = device.createBindGroup({
      layout: pipelines.pushParticlesApart.layout,
      entries: [  
        { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 1, resource: { buffer: buffers.particles.particlePositionPong } },
        { binding: 2, resource: { buffer: buffers.firstCellParticle } },
        { binding: 3, resource: { buffer: buffers.cellParticleIds } },
        { binding: 4, resource: { buffer: buffers.simParams } },
        // { binding: 5, resource: { buffer: buffers.currentIteration } },
        { binding: 5, resource: buffers.terrainTexture.createView() }
      ]
    });
    
    // Create push particles apart pong bind group (reading from pong, writing to position)
    const pushParticlesApartPong = device.createBindGroup({
      layout: pipelines.pushParticlesApart.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.particles.particlePositionPong } },
        { binding: 1, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 2, resource: { buffer: buffers.firstCellParticle } },
        { binding: 3, resource: { buffer: buffers.cellParticleIds } },
        { binding: 4, resource: { buffer: buffers.simParams } },
        // { binding: 5, resource: { buffer: buffers.currentIteration } },
        { binding: 5, resource: buffers.terrainTexture.createView() }
      ]
    });
    
    return {
      particleToCell,
      particleIdAssignment,
      pushParticlesApartPing,
      pushParticlesApartPong
    };
  }
  
  /**
   * Create prefix sum related bind groups
   * @param {GPUDevice} device - WebGPU device
   * @param {Object} buffers - All simulation buffers
   * @param {Object} pipelines - All simulation pipelines
   * @param {Object} config - Simulation configuration
   * @returns {Object} Prefix sum bind groups
   */
  function createPrefixSumBindGroups(device, buffers, pipelines, config) {
    const { prefixSum } = config;
    
    // Create first pass bind group (processes input data)
    const prefixSumFirstPass = device.createBindGroup({
      layout: pipelines.prefixSumFirstPass.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.numCellParticles } },   // inputBuffer
        { binding: 1, resource: { buffer: buffers.firstCellParticle } },  // outputBuffer1
        { binding: 2, resource: { buffer: buffers.intermediateBuffer1 } }
      ]
    });
    
    // Create second pass bind group (processes first pass results)
    const prefixSumSecondPass = device.createBindGroup({
      layout: pipelines.prefixSumFirstPass.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.intermediateBuffer1 } },
        { binding: 1, resource: { buffer: buffers.outputBuffer2 } },
        { binding: 2, resource: { buffer: buffers.intermediateBuffer2 } }
      ]
    });

    // Create third pass bind group (processes second pass results)
    const prefixSumThirdPass = device.createBindGroup({
      layout: pipelines.prefixSumThirdPass.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.intermediateBuffer2 } },
        { binding: 1, resource: { buffer: buffers.outputBuffer3 } }
      ]
    });
    
    // Create final pass bind group (downsweep)
    const prefixSumFinalPass = device.createBindGroup({
      layout: pipelines.prefixSumFinalPass.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.outputBuffer2 } },  // From pass 2
        { binding: 1, resource: { buffer: buffers.outputBuffer3 } },  // From pass 3
        { binding: 2, resource: { buffer: buffers.firstCellParticle } },  // To update
      ]
    });

    // Create final pass bind group for small grids (downsweep)
    const prefixSumFinalPassSmall = device.createBindGroup({
      layout: pipelines.prefixSumFinalPassSmall.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.outputBuffer2 } },
        { binding: 1, resource: { buffer: buffers.firstCellParticle } }
      ]
    });
    
    // Create add guard bind group
    const addGuard = device.createBindGroup({
      layout: pipelines.addGuard.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.firstCellParticle } },
        { binding: 1, resource: { buffer: buffers.simParams } }
      ]
    });
    
    return {
      prefixSumFirstPass,
      prefixSumSecondPass,
      prefixSumThirdPass,
      prefixSumFinalPass,
      prefixSumFinalPassSmall,
      addGuard
    };
  }
  
  /**
   * Create fluid dynamics related bind groups
   * @param {GPUDevice} device - WebGPU device
   * @param {Object} buffers - All simulation buffers
   * @param {Object} pipelines - All simulation pipelines
   * @returns {Object} Fluid dynamics bind groups
   */
  function createFluidBindGroups(device, buffers, pipelines) {
    // Create particle to grid U bind group
    const particleToGridU = device.createBindGroup({
      layout: pipelines.particleToGridU.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 1, resource: { buffer: buffers.particles.particleVelocity } },
        { binding: 2, resource: { buffer: buffers.firstCellParticle } },
        { binding: 3, resource: { buffer: buffers.cellParticleIds } },
        { binding: 4, resource: { buffer: buffers.uGrid } },
        { binding: 5, resource: { buffer: buffers.simParams } }        
      ]
    });
   
    // Create particle to grid V bind group
    const particleToGridV = device.createBindGroup({
      layout: pipelines.particleToGridV.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 1, resource: { buffer: buffers.particles.particleVelocity } },
        { binding: 2, resource: { buffer: buffers.firstCellParticle } },
        { binding: 3, resource: { buffer: buffers.cellParticleIds } },
        { binding: 4, resource: { buffer: buffers.vGrid } },
        { binding: 5, resource: { buffer: buffers.simParams } } 
      ]
    });

    // Create a calculate density bind group
    const calculateDensity = device.createBindGroup({
      layout: pipelines.calculateDensity.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.cellType } },
        { binding: 1, resource: { buffer: buffers.densityGrid } },
        { binding: 2, resource: { buffer: buffers.firstCellParticle } },
        { binding: 3, resource: { buffer: buffers.cellParticleIds } },
        { binding: 4, resource: { buffer: buffers.particles.particlePosition } },
        { binding: 5, resource: { buffer: buffers.simParams } }
      ]
    });
    
    // Create external acceleration and boundary conditions U bind group
    const addAccelerationAndDirichletU = device.createBindGroup({
      layout: pipelines.addAccelerationAndDirichletU.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.uGrid } },
        { binding: 1, resource: { buffer: buffers.cellType } },
        { binding: 2, resource: { buffer: buffers.simParams } },
        { binding: 3, resource: { buffer: buffers.physParams } }
      ]
    });

    // Create external acceleration and boundary conditions V bind group
    const addAccelerationAndDirichletV = device.createBindGroup({
      layout: pipelines.addAccelerationAndDirichletV.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.vGrid } },
        { binding: 1, resource: { buffer: buffers.cellType } },
        { binding: 2, resource: { buffer: buffers.simParams } },
        { binding: 3, resource: { buffer: buffers.physParams } }
      ]
    });
    
    // Create bind groups for velocity extension
    const extendVelocityU = device.createBindGroup({
      layout: pipelines.extendVelocityU.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.uGrid } },
        { binding: 1, resource: { buffer: buffers.uGridMask } },
        { binding: 2, resource: { buffer: buffers.simParams } }
      ]
    });

    const extendVelocityV = device.createBindGroup({
      layout: pipelines.extendVelocityV.layout,
      entries: [
        { binding: 0, resource: { buffer: buffers.vGrid } },
        { binding: 1, resource: { buffer: buffers.vGridMask } },
        { binding: 2, resource: { buffer: buffers.simParams } }
      ]
    });
    
    return {
      particleToGridU,
      particleToGridV,
      calculateDensity,
      addAccelerationAndDirichletU,
      addAccelerationAndDirichletV,
      extendVelocityU,
      extendVelocityV
    };
  }

/**
 * Create PCG solver related bind groups
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} buffers - All simulation buffers
 * @param {Object} pipelines - All simulation pipelines
 * @returns {Object} PCG solver bind groups
 */
function createPCGBindGroups(device, buffers, pipelines) {
  // Create calculateDivergence bind group
  const calculateDivergence = device.createBindGroup({
    layout: pipelines.calculateDivergence.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.uGrid } },
      { binding: 1, resource: { buffer: buffers.vGrid } },
      { binding: 2, resource: { buffer: buffers.cellType } },
      { binding: 3, resource: { buffer: buffers.divergence } },
      { binding: 4, resource: { buffer: buffers.densityGrid } },
      { binding: 5, resource: { buffer: buffers.simParams } },
      { binding: 6, resource: { buffer: buffers.physParams } }
    ]
  });

  // Create applyPreconditioner bind group
  const applyPreconditioner = device.createBindGroup({
    layout: pipelines.applyPreconditioner.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.residual } },
      { binding: 1, resource: { buffer: buffers.cellType } },
      { binding: 2, resource: { buffer: buffers.aux } },
      { binding: 3, resource: { buffer: buffers.simParams } }
    ]
  });

  // Create applyLaplacian bind group
  const applyLaplacian = device.createBindGroup({
    layout: pipelines.applyLaplacian.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.searchDirection } },
      { binding: 1, resource: { buffer: buffers.cellType } },
      { binding: 2, resource: { buffer: buffers.temp } },
      { binding: 3, resource: { buffer: buffers.simParams } }
    ]
  });

  // Create dotProductPass1 bind groups (we need several for different dot products)
  // For r·z (sigma)
  const dotProductRZ = device.createBindGroup({
    layout: pipelines.dotProductPass1.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.residual } },
      { binding: 1, resource: { buffer: buffers.aux } },
      { binding: 2, resource: { buffer: buffers.partialDotProducts } },
      { binding: 3, resource: { buffer: buffers.simParams } } // Contains vectorLength
    ]
  });

  // For p·q (alpha denominator)
  const dotProductPQ = device.createBindGroup({
    layout: pipelines.dotProductPass1.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.searchDirection } },
      { binding: 1, resource: { buffer: buffers.temp } },
      { binding: 2, resource: { buffer: buffers.partialDotProducts } },
      { binding: 3, resource: { buffer: buffers.simParams } }
    ]
  });

  // Create dotProductPass2 bind group
  const dotProductPass2 = device.createBindGroup({
    layout: pipelines.dotProductPass2.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.partialDotProducts } },
      { binding: 1, resource: { buffer: buffers.finalDotProduct } } // Need to create this buffer
    ]
  });

  // Create calculateAlphaBeta bind group
  const calculateAlphaBeta = device.createBindGroup({
    layout: pipelines.calculateAlphaBeta.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.pcgParams } }
    ]
  });

  // Create updateSolution bind group
  const updateSolution = device.createBindGroup({
    layout: pipelines.updateSolution.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.pressureGrid } },
      { binding: 1, resource: { buffer: buffers.searchDirection } },
      { binding: 2, resource: { buffer: buffers.cellType } },
      { binding: 3, resource: { buffer: buffers.pcgParams } },
      { binding: 4, resource: { buffer: buffers.simParams } },
      // { binding: 5, resource: { buffer: buffers.physParams } }
    ]
  });

  // Create updateResidual bind group
  const updateResidual = device.createBindGroup({
    layout: pipelines.updateResidual.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.residual } },
      { binding: 1, resource: { buffer: buffers.temp } },
      { binding: 2, resource: { buffer: buffers.cellType } },
      { binding: 3, resource: { buffer: buffers.pcgParams } },
      { binding: 4, resource: { buffer: buffers.simParams } }
    ]
  });

  // Create updateSearchDirection bind group
  const updateSearchDirection = device.createBindGroup({
    layout: pipelines.updateSearchDirection.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.searchDirection } },
      { binding: 1, resource: { buffer: buffers.aux } },
      { binding: 2, resource: { buffer: buffers.cellType } },
      { binding: 3, resource: { buffer: buffers.pcgParams } },
      { binding: 4, resource: { buffer: buffers.simParams } }
    ]
  });

  // Create computeMaxResidualPass1 bind group
  const computeMaxResidualPass1 = device.createBindGroup({
    layout: pipelines.computeMaxResidualPass1.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.residual } },
      { binding: 1, resource: { buffer: buffers.cellType } },
      { binding: 2, resource: { buffer: buffers.partialMax } },
      { binding: 3, resource: { buffer: buffers.simParams } }
    ]
  });

  // Create computeMaxResidualPass2 bind group
  const computeMaxResidualPass2 = device.createBindGroup({
    layout: pipelines.computeMaxResidualPass2.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.partialMax } },
      { binding: 1, resource: { buffer: buffers.finalMax } }
    ]
  });

  // Create applyPressure bind group
  const applyPressure = device.createBindGroup({
    layout: pipelines.applyPressure.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.uGrid } },
      { binding: 1, resource: { buffer: buffers.vGrid } },
      { binding: 2, resource: { buffer: buffers.pressureGrid } },
      { binding: 3, resource: { buffer: buffers.cellType } },
      { binding: 4, resource: { buffer: buffers.simParams } },
      { binding: 5, resource: { buffer: buffers.physParams } },
      { binding: 6, resource: { buffer: buffers.densityGrid } },
    ]
  });

  return {
    calculateDivergence,
    applyPreconditioner,
    applyLaplacian,
    dotProductRZ,
    dotProductPQ,
    dotProductPass2,
    calculateAlphaBeta,
    updateSolution,
    updateResidual,
    updateSearchDirection,
    computeMaxResidualPass1,
    computeMaxResidualPass2,
    applyPressure
  };
}

/**
 * Create transfer and advection related bind groups
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} buffers - All simulation buffers
 * @param {Object} pipelines - All simulation pipelines
 * @returns {Object} Transfer and advection bind groups
 */
function createTransferAndAdvectionBindGroups(device, buffers, pipelines) {
  // Create grid to particle bind group
  const gridToParticle = device.createBindGroup({
    layout: pipelines.gridToParticle.layout,
    entries: [
      { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
      { binding: 1, resource: { buffer: buffers.particles.particleVelocity } },
      { binding: 2, resource: { buffer: buffers.uGrid } },
      { binding: 3, resource: { buffer: buffers.vGrid } },
      { binding: 4, resource: { buffer: buffers.uGridPrev } }, // Previous grid velocities
      { binding: 5, resource: { buffer: buffers.vGridPrev } },
      { binding: 6, resource: { buffer: buffers.simParams } },
      { binding: 7, resource: { buffer: buffers.physParams } },
    ]
  });

  // Create advect particles bind group
  const advectParticles = device.createBindGroup({
    layout: pipelines.advectParticles.layout,
    entries: [
      // Read from
      { binding: 0, resource: { buffer: buffers.particles.particlePosition } },
      { binding: 1, resource: { buffer: buffers.particles.particleVelocity } },
      // Write to
      { binding: 2, resource: { buffer: buffers.particles.particlePositionPong } },
      { binding: 3, resource: { buffer: buffers.particles.particleVelocityPong } },
      // Other bindings
      { binding: 4, resource: { buffer: buffers.simParams } },
      { binding: 5, resource: { buffer: buffers.physParams } },
      { binding: 6, resource: buffers.terrainTexture.createView() }
    ]
  });

  return {
    gridToParticle,
    advectParticles
  };
}