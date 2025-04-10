/**
 * Initialize all terrain-related buffers and load terrain data
 * @param {GPUDevice} device - WebGPU device
 * @param {Object} config - Simulation configuration
 * @returns {Object} All terrain textures and metadata
 */
export async function initializeTerrain(device, config) {
  // Step 1: Load terrain data from file
  const terrainData = await loadTerrainData(config);
  
  // Step 2: Update config with terrain metadata
  updateTerrainConfig(config, terrainData);
  
  // Step 3: Create terrain textures with the loaded data
  const terrainTextures = createTerrainTextures(device, config, terrainData);
    
  return {
    terrainTexture: terrainTextures.terrainTexture,
  };
}

/**
* Load terrain data from file
* @returns {Object} Terrain data and metadata
*/
async function loadTerrainData(config, scaleFactor = 0.5) {
  const { lengthX, lengthY } = config;
  
  try {
    // Use URL constructor for proper path resolution
    const csvUrl = new URL('../../assets/hill_map.csv', import.meta.url).href;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to load terrain data: ${response.status}`);
    }
    
    const text = await response.text();
    const heights = text.trim().split('\n').map(str => parseFloat(str) * scaleFactor);
    const terrainCount = heights.length;
    
    // Calculate highest point for collision optimizations
    const maxHeight = Math.max(...heights) * lengthY;
    
    return {
      heights,
      terrainCount,
      maxHeight
    };
    
  } catch (error) {
    console.error("Error loading terrain data:", error);
    console.warn("Using fallback terrain (flat ground)");
    
    // Create minimal terrain (flat ground)
    const terrainCount = 1024;
    const heights = new Array(terrainCount).fill(0);
    
    return {
      heights,
      terrainCount,
      maxHeight: 0
    };
  }
}

/**
* Update terrain configuration with loaded data
*/
function updateTerrainConfig(config, terrainData) {
  const { terrainCount, maxHeight } = terrainData;
  
  // Update config with terrain information
  config.terrainCount = terrainCount;
  config.maxTerrainHeight = maxHeight;
  
  // Precompute upscaling info for the shader
  const upscaleRatio = 4;
  config.upscaledTerrainCount = terrainCount * upscaleRatio;
  config.terrainUpscaleRatio = upscaleRatio;
}

/**
* Create texture for terrain data
*/
function createTerrainTextures(device, config, terrainData) {
  const { heights, terrainCount } = terrainData;
  const { lengthX, lengthY, upscaledTerrainCount, terrainUpscaleRatio } = config;
  
  // Use the values from config instead of hardcoding
  const upscaledSize = upscaledTerrainCount;
  const upscaleRatio = terrainUpscaleRatio;
  
  // Generate upscaled heights with interpolation
  const upscaledData = new Float32Array(upscaledSize * 4); // RGBA
  
  // Calculate normals for the original terrain first
  const normals = calculateTerrainNormals(heights, lengthX, lengthY);
  
  // Upscale and interpolate both heights and normals
  for (let i = 0; i < upscaledSize; i++) {
    const originalPosition = (i / upscaleRatio);
    const index1 = Math.floor(originalPosition);
    const index2 = Math.min(Math.ceil(originalPosition), terrainCount - 1);
    const blend = originalPosition - index1;
    
    // Linear interpolation between the two nearest points
    const height = (1 - blend) * heights[index1] + blend * heights[index2];
    
    // Also interpolate normals
    const normalX1 = normals[index1].x;
    const normalX2 = normals[index2].x;
    const normalY1 = normals[index1].y;
    const normalY2 = normals[index2].y;
    
    const normalX = (1 - blend) * normalX1 + blend * normalX2;
    const normalY = (1 - blend) * normalY1 + blend * normalY2;
    
    // Store in RGBA format
    upscaledData[i * 4] = height * lengthY;  // R: height
    upscaledData[i * 4 + 1] = normalX;       // G: normal.x
    upscaledData[i * 4 + 2] = normalY;       // B: normal.y
    upscaledData[i * 4 + 3] = 1.0;           // Alpha
  }
  
  // Create the texture using rgba32float which works for large widths
  const terrainTexture = device.createTexture({
    size: [upscaledSize, 1, 1],
    format: 'rgba32float', // Switch to 32-bit floats for reliable operation
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    label: 'terrain-texture-upscaled'
  });
  
  // Write upscaled data - proper bytesPerRow for 32-bit floats
  const bytesPerRow = upscaledSize * 4 * 4; // width * components * bytes_per_float32
  
  device.queue.writeTexture(
    { texture: terrainTexture },
    upscaledData,
    { bytesPerRow: bytesPerRow, rowsPerImage: 1 },
    { width: upscaledSize, height: 1 }
  );
  
  // Store the upscale information in config for use in shaders
  config.upscaledTerrainCount = upscaledSize;
  config.terrainUpscaleRatio = upscaleRatio; 
 
  return { terrainTexture }; 
}

/**
* Create sampler for terrain texture
*/
function createTerrainSampler(device) {
  return device.createSampler({
    magFilter: 'nearest', 
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    label: 'terrain-sampler'
  });
}

function calculateTerrainNormals(heights, lengthX, lengthY) {
  let normals = [];
  const terrainCount = heights.length;
  let dx = lengthX / (terrainCount - 1);
  
  for (let i = 0; i < terrainCount; i++) {
    // Use central difference where possible, forward/backward difference at edges
    let heightDifference;
    if (i === 0) {
      // Forward difference at left edge
      heightDifference = heights[i+1] - heights[i];
    } else if (i === terrainCount - 1) {
      // Backward difference at right edge
      heightDifference = heights[i] - heights[i-1];
    } else {
      // Central difference for interior points
      heightDifference = heights[i+1] - heights[i-1];
      dx *= 2; // Adjust for central difference (points are 2*dx apart)
    }
    
    // Calculate normal (perpendicular to slope)
    const slope = heightDifference / dx * lengthY;
    const normalX = -slope;
    const normalY = 1.0;
    
    // Normalize
    const length = Math.sqrt(normalX * normalX + normalY * normalY);
    normals.push({
      x: normalX / length,
      y: normalY / length
    });
    
    // Reset dx if we modified it
    if (i > 0 && i < terrainCount - 1) {
      dx /= 2;
    }
  }
  
  return normals;
}