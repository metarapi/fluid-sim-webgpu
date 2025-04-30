// // Cell marking shaders
// import markSolid from '../../shaders/markSolid.wgsl';
// import markLiquid from '../../shaders/markLiquid.wgsl';

// // Prefix sum shaders
// import prefixSumUpsweepPass12 from '../../shaders/prefixSumUpsweepPass12.wgsl';
// import prefixSumUpsweepPass3 from '../../shaders/prefixSumUpsweepPass3.wgsl';
// import prefixSumDownsweepPass from '../../shaders/prefixSumDownsweepPass.wgsl';
// import prefixSumDownsweepPassSmall from '../../shaders/prefixSumDownsweepPassSmall.wgsl';

// // Particle to grid mapping shaders
// import particleToCellMapping from '../../shaders/particleToCellMapping.wgsl';
// import addGuard from '../../shaders/addGuard.wgsl';
// import particleIdAssign from '../../shaders/particleIdAssign.wgsl';

// // Particle separation shader
// import pushParticlesApart from '../../shaders/pushParticlesApart.wgsl';

// // Particle to grid velocity transfer shaders
// import particleToGridU from '../../shaders/particleToGridU.wgsl';
// import particleToGridV from '../../shaders/particleToGridV.wgsl';

// // Acceleration and boundary condition shaders
// import addAccelerationAndDirichletU from '../../shaders/addAccelerationAndDirichletU.wgsl';
// import addAccelerationAndDirichletV from '../../shaders/addAccelerationAndDirichletV.wgsl';

// // Velocity extension shaders
// import extendVelocityU from '../../shaders/extendVelocityU.wgsl';
// import extendVelocityV from '../../shaders/extendVelocityV.wgsl';

// // Density calculation
// import calculateDensity from '../../shaders/calculateDensity.wgsl';

// // PCG solver shaders
// import applyLaplacian from '../../shaders/applyLaplacian.wgsl';
// import applyPressure from '../../shaders/applyPressure.wgsl';
// import applyPreconditioner from '../../shaders/applyPreconditioner.wgsl';
// import calculateAlphaBeta from '../../shaders/calculateAlphaBeta.wgsl';
// import calculateDivergence from '../../shaders/calculateDivergence.wgsl';
// import updateResidual from '../../shaders/updateResidual.wgsl';
// import updateSolution from '../../shaders/updateSolution.wgsl';
// import updateSearchDirection from '../../shaders/updateSearchDirection.wgsl';
// import dotProductPass1 from '../../shaders/dotProductPass1.wgsl';
// import dotProductPass2 from '../../shaders/dotProductPass2.wgsl';
// import computeMaxResidualPass1 from '../../shaders/computeMaxResidualPass1.wgsl';
// import computeMaxResidualPass2 from '../../shaders/computeMaxResidualPass2.wgsl';

// // Grid to particle velocity transfer
// import gridToParticle from '../../shaders/gridToParticle.wgsl';

// // Advection
// import advectParticlesAndHandleCollisions from '../../shaders/advectParticlesAndHandleCollisions.wgsl';

// export function getShaders() {
//     return {
//         markSolid: markSolid,
//         markLiquid: markLiquid,
//         particleToCellMapping: particleToCellMapping,
//         prefixSumUpsweepPass12: prefixSumUpsweepPass12,
//         prefixSumUpsweepPass3: prefixSumUpsweepPass3,
//         prefixSumDownsweepPass: prefixSumDownsweepPass,
//         prefixSumDownsweepPassSmall: prefixSumDownsweepPassSmall,
//         addGuard: addGuard,
//         particleIdAssign: particleIdAssign,
//         pushParticlesApart: pushParticlesApart,
//         particleToGridU: particleToGridU,
//         particleToGridV: particleToGridV,
//         addAccelerationAndDirichletU: addAccelerationAndDirichletU,
//         addAccelerationAndDirichletV: addAccelerationAndDirichletV,
//         extendVelocityU: extendVelocityU,
//         extendVelocityV: extendVelocityV,
//         calculateDensity: calculateDensity,
//         applyLaplacian: applyLaplacian,
//         applyPressure: applyPressure,
//         applyPreconditioner: applyPreconditioner,
//         calculateAlphaBeta: calculateAlphaBeta,
//         calculateDivergence: calculateDivergence,
//         updateResidual: updateResidual,
//         updateSolution: updateSolution,
//         updateSearchDirection: updateSearchDirection,
//         dotProductPass1: dotProductPass1,
//         dotProductPass2: dotProductPass2,
//         computeMaxResidualPass1: computeMaxResidualPass1,
//         computeMaxResidualPass2: computeMaxResidualPass2,
//         gridToParticle: gridToParticle,
//         advectParticlesAndHandleCollisions: advectParticlesAndHandleCollisions
//     };
// }

export async function getShaders() {
    const shaderPaths = [
      'markFluidFractions',
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
      'particleToGridU',
      'particleToGridV',
      'addAccelerationAndDirichletU',
      'addAccelerationAndDirichletV',
      'extendVelocityU',
      'extendVelocityV',
      'applyViscosity',
      'calculateDensity',
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
      // Density PCG shaders,
      'calculateDensityPressureRHS',
      'calculatePositionCorrection',
      'applyPositionCorrection',
      'gridToParticle',
      'advectParticlesAndHandleCollisions'
    ];
  
    // Get the base URL for shaders based on environment
    const getShaderUrl = (shaderName) => {
      // For production build, the files will be in the same directory structure
      return new URL(`../../shaders/${shaderName}.wgsl`, import.meta.url).href;
    };
  
    const shaders = {};
    await Promise.all(shaderPaths.map(async (path) => {
      try {
        const response = await fetch(getShaderUrl(path));
        if (!response.ok) {
          throw new Error(`Failed to load shader ${path}: ${response.status}`);
        }
        shaders[path] = await response.text();
        
        // Simple validation
        if (!shaders[path].includes('fn main(')) {
          console.warn(`Warning: Shader ${path} might be missing main entry point`);
        }
      } catch (error) {
        console.error(`Error loading shader ${path}:`, error);
      }
    }));
  
    return shaders;
  }