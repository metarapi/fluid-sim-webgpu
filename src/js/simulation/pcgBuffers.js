  /**
 * Initialize buffers for PCG solver
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} Created PCG buffers
 */
  export async function initPCGBuffers(device, config) {
    const { gridSizeX, gridSizeY, numberOfCells } = config;
    
    // Divergence (b vector)
    const divergence = device.createBuffer({
      size: numberOfCells * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Density RHS (b vector) - for implicit density projection loop
    const densityRHS = device.createBuffer({
      size: numberOfCells * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // Residual (r vector)
    const residual = device.createBuffer({
      size: numberOfCells * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // Search direction (p vector)
    const searchDirection = device.createBuffer({
      size: numberOfCells * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // Auxiliary vector for preconditioner (z = M⁻¹r)
    const aux = device.createBuffer({
      size: numberOfCells * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // Temporary vector for matrix-vector product (q = A·p)
    const temp = device.createBuffer({
      size: numberOfCells * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // PCG scalar parameters
    const pcgParams = device.createBuffer({
      size: 6 * Float32Array.BYTES_PER_ELEMENT, // sigma, alpha_denom, alpha, beta, new_sigma, tolerance
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // Initialize PCG parameters with tolerance
    const pcgParamsData = new Float32Array(6);
    pcgParamsData[5] = config.pcg.tolerance; // Set convergence tolerance
    device.queue.writeBuffer(pcgParams, 0, pcgParamsData);
    
    // Max residual reduction buffers
    const maxWorkgroups = config.pcg.workgroupCount; 
    const partialMax = device.createBuffer({
      size: maxWorkgroups * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    const finalMax = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    const finalMaxStaging = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    // Dot product reduction buffers
    const partialDotProducts = device.createBuffer({
      size: maxWorkgroups * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
  
    const finalDotProduct = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT, // Single float
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    return {
      divergence,
      densityRHS,
      residual,
      searchDirection,
      aux,
      temp,
      pcgParams,
      partialMax,
      finalMaxStaging,
      finalMax,
      partialDotProducts,
      finalDotProduct
    };
  }