/**
 * Creates a configuration object for fluid simulation with WebGPU
 * 
 * @param {Object} options - Optional configuration overrides
 * @returns {Object} Complete configuration object with derived values
 */
export function createConfig(options = {}) {
  // =========================================================
  // Core Configuration
  // =========================================================
  const config = {
    // Grid dimensions (512×512 = 262,144 cells)
      gridSizeX: options.gridSizeX || 256,
      gridSizeY: options.gridSizeY || 256,
      
      // World dimensions
      lengthX: options.lengthX || 8.0,
      lengthY: options.lengthY || 8.0,
      
      // Particle configuration (min: 262144, max: 2097152)
      particleCount: options.particleCount || 262144,
      
      // Physics parameters
      pushApartSteps: options.pushApartSteps || 4,
      minDistance: options.minDistance || 0.6,
    };

  // =========================================================
  // Derived Values
  // =========================================================
  
    // Add derived values
    let numberOfCells = config.gridSizeX * config.gridSizeY;
    config.numberOfCells = numberOfCells;
    
    // Compute helper values
    config.worldToGridX = config.gridSizeX / config.lengthX;
    config.worldToGridY = config.gridSizeY / config.lengthY;
    config.gridToWorldX = config.lengthX / config.gridSizeX;
    config.gridToWorldY = config.lengthY / config.gridSizeY;
  
  // Override minDistance based on grid cell size
  config.minDistance = config.gridToWorldX * 0.9;

  // =========================================================
  // Prefix Sum Configuration
  // =========================================================
  
  // Hardware optimization constants
  const WORKGROUP_SIZE = 256;
  const ELEMENTS_PER_THREAD = 4;  // Vec4 optimization in shader
  const CELLS_PER_THREAD = 16;    // For PCG reduction

  // Determine if we need small grid pipeline (for grids smaller than 256x256)
  const isSmallGrid = numberOfCells < 65536; // 256x256

  // Calculate primary workgroup count (first pass)
  const numWorkgroups1 = Math.ceil(numberOfCells / (WORKGROUP_SIZE * ELEMENTS_PER_THREAD));

  // For small grids (< 256x256), we only need two passes
  let numWorkgroups2, numWorkgroups3;

  if (isSmallGrid) {
    // For small grids, second pass can handle everything in one workgroup
    numWorkgroups2 = 1;
    numWorkgroups3 = 0; // No third pass needed
  } else {
    // Normal calculation for larger grids
    numWorkgroups2 = Math.ceil(numWorkgroups1 / WORKGROUP_SIZE);
    
    // Calculate third pass workgroup count
    const workgroupSize3 = Math.ceil(numberOfCells / (WORKGROUP_SIZE * WORKGROUP_SIZE));
    numWorkgroups3 = Math.ceil(numWorkgroups2 / (workgroupSize3 / 4));
  }

  // Final pass uses 4x the first pass workgroups (due to Vec4 optimization)
  const finalPassWorkgroups = numWorkgroups1 * 4;
  
  // =========================================================
  // PCG Solver Configuration
  // =========================================================
  
  const pcgWorkgroupCount = Math.ceil(numberOfCells / (WORKGROUP_SIZE * CELLS_PER_THREAD));

  // =========================================================
  // Combine All Configuration
  // =========================================================
  
  return {
    // Original core config
    ...config,
    
    // Prefix sum configuration 
    prefixSum: {
      workgroupSize: WORKGROUP_SIZE,
      elementsPerThread: ELEMENTS_PER_THREAD,
      isSmallGrid,
      numWorkgroups1,
      numWorkgroups2,
      numWorkgroups3,
      finalPassWorkgroups
    },
    
    // PCG solver configuration
    pcg: {
      workgroupCount: pcgWorkgroupCount,
      tolerance: options.pcgTolerance || 1e-5,
      maxIterations: options.pcgMaxIterations || 100,
      stiffness: options.pressureStiffness || 0.01,
    }
  };
}

/**
 * Default configuration with standard parameters
 */
export const defaultConfig = createConfig();