/**
 * Initialize all simulation compute pipelines
 * @param {Object} state - Main simulation state object
 * @returns {Object} All created pipelines
 */
export async function initPipelines(state) {
    const { device, config } = state;

    // Load all shader code first
    const shaders = await loadShaders();

    // Create all pipelines
    const pipelines = {
        // Terrain (pre)processing pipelines
        // ...await createTerrainProcessingPipelines(device, shaders),

        // Cell marking pipelines
        ...await createMarkingPipelines(device, shaders),

        // Particle handling pipelines
        ...await createParticlePipelines(device, shaders),

        // Terrain collision pipelines
        ...await createTerrainCollisionPipelines(device, shaders),

        // Prefix sum pipelines
        ...await createPrefixSumPipelines(device, shaders),

        // Fluid dynamics pipelines
        ...await createFluidPipelines(device, shaders),

        // PCG solver pipelines
        ...await createPCGPipelines(device, shaders),

        // Transfer and advection pipelines
        ...await createTransferAndAdvectionPipelines(device, shaders)   
    };

    // Store shaders in the state for reference (optional)
    state.shaders = shaders;

    return pipelines;
}

/**
 * Load all shader code
 * @returns {Object} Object containing shader code strings
 */
async function loadShaders() {
    // Use camelCase names directly for shader files
    const shaderPaths = [
        // Cell marking
        'markSolid',
        'markLiquid',
        'particleToCellMapping',
        'prefixSumUpsweepPass12',
        'prefixSumUpsweepPass3',
        'prefixSumDownsweepPass',
        'prefixSumDownsweepPassSmall',
        'addGuard',
        'particleIdAssign',
        'pushParticlesApart',
        'terrainCollision',
        'particleToGridU',
        'particleToGridV',
        'addAccelerationAndDirichletU',
        'addAccelerationAndDirichletV',
        'extendVelocityU',
        'extendVelocityV',
        //Density calculation
        'calculateDensity',
        // PCG solver shaders
        'applyLaplacian',
        'applyPressure',
        'applyPreconditioner',
        'calculateAlphaBeta',
        'calculateDivergence',
        'updateResidual',
        'updateSolution',
        'updateSearchDirection',
        'dotProductPass1',
        'dotProductPass2',
        'computeMaxResidualPass1',
        'computeMaxResidualPass2',
        // Grid to particle velocity transfer
        'gridToParticle',
        // Advection
        'advectParticlesAndHandleCollisions'
    ];

    // Load all shaders in parallel
    const shaderPromises = shaderPaths.map(async (path) => {
        try {
            const response = await fetch(`src/shaders/${path}.wgsl`);
            if (!response.ok) {
                throw new Error(`Failed to load shader ${path}: ${response.status}`);
            }
            const code = await response.text();

            // Simple validation - check that shader has a main function
            if (!code.includes('fn main(')) {
                console.warn(`Warning: Shader ${path} might be missing main entry point`);
            }

            return { path, code };
        } catch (error) {
            console.error(`Error loading shader ${path}:`, error);
            throw error;
        }
    });

    // Wait for all shaders to load
    const loadedShaders = await Promise.all(shaderPromises);

    // Convert to object with shader names as keys - no regex needed!
    const shaders = {};
    for (const { path, code } of loadedShaders) {
        shaders[path] = code;
    }

    return shaders;
}

// /**
//  * Create terrain (pre)processing related pipelines
//  * @param {GPUDevice} device - WebGPU device
//  * @param {Object} shaders - Loaded shader code
//  * @returns {Object} Terrain processing pipelines
//   */
// async function createTerrainProcessingPipelines(device, shaders) {
//   // Create shader modules
//   const cubicInterpolateModule = device.createShaderModule({
//     code: shaders.cubicInterpolate
//   });

//   const calculateTerrainNormalsModule = device.createShaderModule({
//     code: shaders.calculateTerrainNormals
//   });

//   // Create pipelines
//   const cubicInterpolate = await device.createComputePipelineAsync({
//     layout: 'auto',
//     compute: { module: cubicInterpolateModule, entryPoint: 'main' }
//   });

//   const calculateTerrainNormals = await device.createComputePipelineAsync({
//     layout: 'auto',
//     compute: { module: calculateTerrainNormalsModule, entryPoint: 'main' }
//   });

//   return {
//     cubicInterpolate: {
//       pipeline: cubicInterpolate,
//       layout: cubicInterpolate.getBindGroupLayout(0)
//     },
//     calculateTerrainNormals: {
//       pipeline: calculateTerrainNormals,
//       layout: calculateTerrainNormals.getBindGroupLayout(0)
//     }
//   };
// }

// /**
//  * Create cell marking related pipelines
//  * @param {GPUDevice} device - WebGPU device
//  * @param {Object} shaders - Loaded shader code
//  * @returns {Object} Marking pipelines
//  */
// async function createMarkingPipelines(device, shaders) {
//     // Create shader modules
//     const bresenhamModule = device.createShaderModule({ code: shaders.bresenhamLine });
//     const markSolidModule = device.createShaderModule({ code: shaders.markSolid });
//     const markLiquidModule = device.createShaderModule({ code: shaders.markLiquid });

//     // Create pipelines
//     const bresenham = device.createComputePipeline({
//         layout: 'auto',
//         compute: { module: bresenhamModule, entryPoint: 'main' }
//     });

//     const markSolid = device.createComputePipeline({
//         layout: 'auto',
//         compute: { module: markSolidModule, entryPoint: 'main' }
//     });

//     const markLiquid = device.createComputePipeline({
//         layout: 'auto',
//         compute: { module: markLiquidModule, entryPoint: 'main' }
//     });

//     // Return pipelines and their layouts
//     return {
//         bresenham: { pipeline: bresenham, layout: bresenham.getBindGroupLayout(0) },
//         markSolid: { pipeline: markSolid, layout: markSolid.getBindGroupLayout(0) },
//         markLiquid: { pipeline: markLiquid, layout: markLiquid.getBindGroupLayout(0) }
//     };
// }

/**
 * Create cell marking related pipelines
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} shaders - Loaded shader code
 * @returns {Object} Marking pipelines
 */
async function createMarkingPipelines(device, shaders) {
    // Create shader modules
    const markSolidModule = device.createShaderModule({ code: shaders.markSolid });
    const markLiquidModule = device.createShaderModule({ code: shaders.markLiquid });

    // Create the bind group layout
    const markSolidBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // cellType array
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: 
          {
            sampleType: 'unfilterable-float',
            viewDimension: '2d'
          }
        },
        {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' }},  // SimParams uniform
      ]
    });
    
    // First create a pipeline layout using the bind group layout
    const markSolidPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [markSolidBindGroupLayout]
    });

    // Then use the pipeline layout when creating the pipeline
    const markSolid = device.createComputePipeline({
        layout: markSolidPipelineLayout,  // Use the pipeline layout, not an array
        compute: { module: markSolidModule, entryPoint: 'main' }
    });

    const markLiquid = device.createComputePipeline({
        layout: 'auto',
        compute: { module: markLiquidModule, entryPoint: 'main' }
    });

    // Return pipelines and their layouts
    return {
        markSolid: { pipeline: markSolid, layout: markSolidBindGroupLayout },
        markLiquid: { pipeline: markLiquid, layout: markLiquid.getBindGroupLayout(0) }
    };
}

  /**
   * Create terrain collision related pipelines
   * @param {GPUDevice} device - WebGPU device
   * @param {Object} shaders - Loaded shader code
   * @returns {Object} Terrain processing pipelines
   */
  async function createTerrainCollisionPipelines(device, shaders) {
    // Create shader modules
    const terrainCollisionModule = device.createShaderModule({
        code: shaders.terrainCollision
    });

    // Create custom bind group layout for terrain collision
    const terrainCollisionBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },  // particlePos
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },  // particlePosNew
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },  // particleVel
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },  // simParams
        { 
          binding: 4, 
          visibility: GPUShaderStage.COMPUTE, 
          texture: {
            sampleType: 'unfilterable-float',  // Critical for rgba32float textures
            viewDimension: '2d'
          }
        }
      ]
    });

    // Create pipeline layout using the custom bind group layout
    const terrainCollisionPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [terrainCollisionBindGroupLayout]
    });

    // Create pipeline using the custom layout
    const terrainCollision = device.createComputePipeline({
      layout: terrainCollisionPipelineLayout,
      compute: { module: terrainCollisionModule, entryPoint: 'main' }
    });

    return {
      terrainCollision: {
        pipeline: terrainCollision,
        layout: terrainCollisionBindGroupLayout
      }
    };
}

/**
 * Create particle handling related pipelines
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} shaders - Loaded shader code
 * @returns {Object} Particle pipelines
 */
async function createParticlePipelines(device, shaders) {

    // Create particle to cell module
    const particleToCellModule = device.createShaderModule({
        code: shaders.particleToCellMapping
    });

    // Create particle ID assignment pipeline using auto layout
    const particleIdAssignmentModule = device.createShaderModule({
        code: shaders.particleIdAssign
    });

    // Create push particles apart pipeline using auto layout
    const pushParticlesApartModule = device.createShaderModule({
        code: shaders.pushParticlesApart
    });

    // Create custom bind group layout for pushParticlesApart
    const pushParticlesApartBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // particlePosIn
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },          // particlePosOut
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // firstCellParticle
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // cellParticleIds
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },          // simParams
        // { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },          // current iteration
        { 
          binding: 5, 
          visibility: GPUShaderStage.COMPUTE, 
          texture: {
            sampleType: 'unfilterable-float',
            viewDimension: '2d'
          }
        }
      ]
    });

    // Create pipeline layout using the custom bind group layout
    const pushParticlesApartPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [pushParticlesApartBindGroupLayout]
    });

    // Create pipelines
    const particleToCell = device.createComputePipeline({
        layout: 'auto',
        compute: { module: particleToCellModule, entryPoint: 'main' }
    });

    const particleIdAssignment = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: particleIdAssignmentModule, entryPoint: 'main' }
    });

    // const pushParticlesApart = await device.createComputePipelineAsync({
    //     layout: 'auto',
    //     compute: { module: pushParticlesApartModule, entryPoint: 'main' }
    // });

    // Create pipeline using the custom layout
    const pushParticlesApart = device.createComputePipeline({
      layout: pushParticlesApartPipelineLayout,
      compute: { module: pushParticlesApartModule, entryPoint: 'main' }
    });

    return {
        particleToCell: {
            pipeline: particleToCell,
            layout: particleToCell.getBindGroupLayout(0)
        },
        particleIdAssignment: {
            pipeline: particleIdAssignment,
            layout: particleIdAssignment.getBindGroupLayout(0)
        },
        pushParticlesApart: {
            pipeline: pushParticlesApart,
            layout: pushParticlesApartBindGroupLayout
        }
    };
}

/**
 * Create prefix sum related pipelines
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} shaders - Loaded shader code
 * @returns {Object} Prefix sum pipelines
 */
async function createPrefixSumPipelines(device, shaders) {
    // Create shader modules
    const prefixSumPass12Module = device.createShaderModule({
        code: shaders.prefixSumUpsweepPass12
    });

    const prefixSumPass3Module = device.createShaderModule({
        code: shaders.prefixSumUpsweepPass3
    });

    const prefixSumDownsweepModule = device.createShaderModule({
        code: shaders.prefixSumDownsweepPass
    });

    const prefixSumDownsweepSmallModule = device.createShaderModule({
      code: shaders.prefixSumDownsweepPassSmall
    });

    const addGuardModule = device.createShaderModule({
        code: shaders.addGuard
    });

    // Create pipelines using auto layout
    const firstPass = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: prefixSumPass12Module, entryPoint: 'main' }
    });

    const secondPass = await device.createComputePipelineAsync({
        layout: "auto",
        compute: { module: prefixSumPass12Module, entryPoint: "main" },
    });

    const thirdPass = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: prefixSumPass3Module, entryPoint: 'main' }
    });

    const finalPass = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: prefixSumDownsweepModule, entryPoint: 'main' }
    });

    const finalPassSmall = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: prefixSumDownsweepSmallModule, entryPoint: 'main' }
    });

    const addGuard = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: addGuardModule, entryPoint: 'main' }
    });

    return {
        prefixSumFirstPass: {
            pipeline: firstPass,
            layout: firstPass.getBindGroupLayout(0)
        },
        prefixSumSecondPass: {
          pipeline: secondPass,
          layout: secondPass.getBindGroupLayout(0)
        },
        prefixSumThirdPass: {
            pipeline: thirdPass,
            layout: thirdPass.getBindGroupLayout(0)
        },
        prefixSumFinalPass: {
            pipeline: finalPass,
            layout: finalPass.getBindGroupLayout(0)
        },
        prefixSumFinalPassSmall: {
            pipeline: finalPassSmall,
            layout: finalPassSmall.getBindGroupLayout(0)
        },
        addGuard: {
            pipeline: addGuard,
            layout: addGuard.getBindGroupLayout(0)
        }
    };
}

/**
 * Create fluid dynamics related pipelines
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} shaders - Loaded shader code
 * @returns {Object} Fluid dynamics pipelines
 */
async function createFluidPipelines(device, shaders) {
    // Create shader modules
    const particleToGridUModule = device.createShaderModule({
        code: shaders.particleToGridU
    });

    const particleToGridVModule = device.createShaderModule({
        code: shaders.particleToGridV
    });

    const calculateDensityModule = device.createShaderModule({
      code: shaders.calculateDensity
    });

    const extendVelocityUModule = device.createShaderModule({
        code: shaders.extendVelocityU
    });

    const extendVelocityVModule = device.createShaderModule({
        code: shaders.extendVelocityV
    });

    const addAccelerationAndDirichletUModule = device.createShaderModule({
        code: shaders.addAccelerationAndDirichletU
    });

    const addAccelerationAndDirichletVModule = device.createShaderModule({
        code: shaders.addAccelerationAndDirichletV
    });

    // Create pipelines using auto layout
    const particleToGridU = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: particleToGridUModule, entryPoint: 'main' }
    });

    const particleToGridV = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: particleToGridVModule, entryPoint: 'main' }
    });

    const calculateDensity = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: calculateDensityModule, entryPoint: 'main' }
    });

    const extendVelocityU = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: extendVelocityUModule, entryPoint: 'main' }
    });

    const extendVelocityV = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: extendVelocityVModule, entryPoint: 'main' }
    });

    const addAccelerationAndDirichletU = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: addAccelerationAndDirichletUModule, entryPoint: 'main' }
    });

    const addAccelerationAndDirichletV = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: addAccelerationAndDirichletVModule, entryPoint: 'main' }
    });

    return {
        particleToGridU: {
            pipeline: particleToGridU,
            layout: particleToGridU.getBindGroupLayout(0)
        },
        particleToGridV: {
            pipeline: particleToGridV,
            layout: particleToGridV.getBindGroupLayout(0)
        },
        calculateDensity: {
          pipeline: calculateDensity,
          layout: calculateDensity.getBindGroupLayout(0)
        },
        extendVelocityU: {
            pipeline: extendVelocityU,
            layout: extendVelocityU.getBindGroupLayout(0)
        },
        extendVelocityV: {
            pipeline: extendVelocityV,
            layout: extendVelocityV.getBindGroupLayout(0)
        },
        addAccelerationAndDirichletU: {
            pipeline: addAccelerationAndDirichletU,
            layout: addAccelerationAndDirichletU.getBindGroupLayout(0)
        },
        addAccelerationAndDirichletV: {
            pipeline: addAccelerationAndDirichletV,
            layout: addAccelerationAndDirichletV.getBindGroupLayout(0)
        }
    };
}

/**
 * Create PCG solver related pipelines
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} shaders - Loaded shader code
 * @returns {Object} PCG solver pipelines
 */
async function createPCGPipelines(device, shaders) {
    // Create shader modules for all PCG shaders
    const applyLaplacianModule = device.createShaderModule({
      code: shaders.applyLaplacian
    });
    
    const applyPressureModule = device.createShaderModule({
      code: shaders.applyPressure
    });
    
    const applyPreconditionerModule = device.createShaderModule({
      code: shaders.applyPreconditioner
    });
    
    const calculateAlphaBetaModule = device.createShaderModule({
      code: shaders.calculateAlphaBeta
    });
    
    const calculateDivergenceModule = device.createShaderModule({
      code: shaders.calculateDivergence
    });
    
    const updateResidualModule = device.createShaderModule({
      code: shaders.updateResidual
    });
    
    const updateSolutionModule = device.createShaderModule({
      code: shaders.updateSolution
    });
    
    const updateSearchDirectionModule = device.createShaderModule({
      code: shaders.updateSearchDirection
    });
    
    const dotProductPass1Module = device.createShaderModule({
      code: shaders.dotProductPass1
    });
    
    const dotProductPass2Module = device.createShaderModule({
      code: shaders.dotProductPass2
    });
    
    const computeMaxResidualPass1Module = device.createShaderModule({
      code: shaders.computeMaxResidualPass1
    });
    
    const computeMaxResidualPass2Module = device.createShaderModule({
      code: shaders.computeMaxResidualPass2
    });
  
    // Create all compute pipelines using auto layout
    const applyLaplacian = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: applyLaplacianModule, entryPoint: 'main' }
    });
    
    const applyPressure = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: applyPressureModule, entryPoint: 'main' }
    });
    
    const applyPreconditioner = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: applyPreconditionerModule, entryPoint: 'main' }
    });
    
    const calculateAlphaBeta = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: calculateAlphaBetaModule, entryPoint: 'main' }
    });
    
    const calculateDivergence = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: calculateDivergenceModule, entryPoint: 'main' }
    });
    
    const updateResidual = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: updateResidualModule, entryPoint: 'main' }
    });
    
    const updateSolution = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: updateSolutionModule, entryPoint: 'main' }
    });
    
    const updateSearchDirection = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: updateSearchDirectionModule, entryPoint: 'main' }
    });
    
    const dotProductPass1 = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: dotProductPass1Module, entryPoint: 'main' }
    });
    
    const dotProductPass2 = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: dotProductPass2Module, entryPoint: 'main' }
    });
    
    const computeMaxResidualPass1 = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: computeMaxResidualPass1Module, entryPoint: 'main' }
    });
    
    const computeMaxResidualPass2 = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: computeMaxResidualPass2Module, entryPoint: 'main' }
    });
  
    return {
      applyLaplacian: {
        pipeline: applyLaplacian,
        layout: applyLaplacian.getBindGroupLayout(0)
      },
      applyPressure: {
        pipeline: applyPressure,
        layout: applyPressure.getBindGroupLayout(0)
      },
      applyPreconditioner: {
        pipeline: applyPreconditioner,
        layout: applyPreconditioner.getBindGroupLayout(0)
      },
      calculateAlphaBeta: {
        pipeline: calculateAlphaBeta,
        layout: calculateAlphaBeta.getBindGroupLayout(0)
      },
      calculateDivergence: {
        pipeline: calculateDivergence,
        layout: calculateDivergence.getBindGroupLayout(0)
      },
      updateResidual: {
        pipeline: updateResidual,
        layout: updateResidual.getBindGroupLayout(0)
      },
      updateSolution: {
        pipeline: updateSolution,
        layout: updateSolution.getBindGroupLayout(0)
      },
      updateSearchDirection: {
        pipeline: updateSearchDirection,
        layout: updateSearchDirection.getBindGroupLayout(0)
      },
      dotProductPass1: {
        pipeline: dotProductPass1,
        layout: dotProductPass1.getBindGroupLayout(0)
      },
      dotProductPass2: {
        pipeline: dotProductPass2,
        layout: dotProductPass2.getBindGroupLayout(0)
      },
      computeMaxResidualPass1: {
        pipeline: computeMaxResidualPass1,
        layout: computeMaxResidualPass1.getBindGroupLayout(0)
      },
      computeMaxResidualPass2: {
        pipeline: computeMaxResidualPass2,
        layout: computeMaxResidualPass2.getBindGroupLayout(0)
      }
    };
  }

/**
 * Create transfer and advection related pipelines
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} shaders - Loaded shader code
 * @returns {Object} Transfer and advection pipelines
 */
async function createTransferAndAdvectionPipelines(device, shaders) {
  // Create shader modules
  const gridToParticleModule = device.createShaderModule({
      code: shaders.gridToParticle
  });

  const advectParticlesModule = device.createShaderModule({
      code: shaders.advectParticlesAndHandleCollisions
  });

  // Create custom bind group layout for advectParticles
  const advectParticlesBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // particlePos
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // particleVel
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },           // particlePosNew
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },           // particleVelNew
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },           // simParams
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },           // physParams
      { 
        binding: 6, 
        visibility: GPUShaderStage.COMPUTE, 
        texture: {
          sampleType: 'unfilterable-float',
          viewDimension: '2d'
        }
      }
    ]
  });

  // Create pipeline layout
  const advectParticlesPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [advectParticlesBindGroupLayout]
  });

  // Create pipelines using auto layout
  const gridToParticle = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: gridToParticleModule, entryPoint: 'main' }
  });

  // const advectParticles = await device.createComputePipelineAsync({
  //     layout: 'auto',
  //     compute: { module: advectParticlesModule, entryPoint: 'main' }
  // });

  // Create pipeline using the custom layout
  const advectParticles = device.createComputePipeline({
    layout: advectParticlesPipelineLayout,
    compute: { module: advectParticlesModule, entryPoint: 'main' }
  });

  return {
      gridToParticle: {
          pipeline: gridToParticle,
          layout: gridToParticle.getBindGroupLayout(0)
      },
      advectParticles: {
          pipeline: advectParticles,
          layout: advectParticlesBindGroupLayout
      }
  };
}