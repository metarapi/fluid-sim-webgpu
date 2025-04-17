export async function readBufferData(buffer, type = "uint", device) {
    const readBuffer = device.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
    device.queue.submit([commandEncoder.finish()]);
    
    await readBuffer.mapAsync(GPUMapMode.READ);
    let results;
    if (type === "uint") {
      results = new Uint32Array(readBuffer.getMappedRange());
    } else if (type === "float") {
      results = new Float32Array(readBuffer.getMappedRange());
    } else {
      throw new Error(`Unsupported buffer data type: ${type}`);
    }
  
    const copy = new results.constructor(results.length);
    copy.set(results);
    readBuffer.unmap();
    
    return copy;
  }
  
  export async function saveState(state) {
    const { device, config, buffers } = state;
    
    try {
      console.log("Attempting to save state...");

      // // Save the 2 arrays for neighborhood lookup (firstCellParticle and cellParticleIds)
      // const firstCellParticle = await readBufferData(
      //   buffers.firstCellParticle, 
      //   "uint", 
      //   device
      // );

      // const cellParticleIds = await readBufferData(
      //   buffers.cellParticleIds, 
      //   "uint", 
      //   device
      // );

      // const numCellParticles = await readBufferData(
      //   buffers.numCellParticles, 
      //   "uint", 
      //   device
      // );

      // const firstCellParticleCSV = firstCellParticle.join(',');
      // const cellParticleIdsCSV = cellParticleIds.join(',');
      // const numCellParticlesCSV = numCellParticles.join(',');

      // downloadCSV(firstCellParticleCSV, 'firstCellParticle.csv');
      // downloadCSV(cellParticleIdsCSV, 'cellParticleIds.csv');
      // downloadCSV(numCellParticlesCSV, 'numCellParticles.csv');

      // // Save particle positions
      // const positions = await readBufferData(
      //   buffers.particles.particlePosition,
      //   "float", 
      //   device
      // );
      
      // // Format as CSV
      // const particleCSV = Array.from(
      //   { length: config.particleCount }, 
      //   (_, i) => `${positions[i*2]},${positions[i*2+1]}`
      // ).join('\n');
      
      // // Download the file
      // downloadCSV(particleCSV, 'particles.csv');
      
      // Save grid cells
      const gridData = await readBufferData(
        buffers.cellType, 
        "uint", 
        device
      );

      const volumeFractionsData = await readBufferData(
        buffers.volumeFractions, 
        "float", 
        device
      );
      
      // Format as 2D grid
      const gridCSV = [];
      for(let y = 0; y < config.gridSizeY; y++) {
        const row = [];
        for(let x = 0; x < config.gridSizeX; x++) {
          row.push(gridData[x + y * config.gridSizeX]);
        }
        gridCSV.push(row.join(','));
      }

      const volumeFractionsCSV = [];
      for(let y = 0; y < config.gridSizeY; y++) {
        const row = [];
        for(let x = 0; x < config.gridSizeX; x++) {
          row.push(volumeFractionsData[x + y * config.gridSizeX]);
        }
        volumeFractionsCSV.push(row.join(','));
      }
      
      // Download the file
      downloadCSV(gridCSV.join('\n'), 'cellType.csv');
      downloadCSV(volumeFractionsCSV.join('\n'), 'volumeFractions.csv');


      // console.log("Saving terrain texture data...");
      // await saveTextureAsCSV(buffers.terrainTexture, device, 'terrain_texture.csv');

    } catch (err) {
      console.error("Error saving state:", err);
    }
  }
  
  function downloadCSV(data, filename) {
    const blob = new Blob([data], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

/**
 * Save texture data as CSV file
 * @param {GPUTexture} texture - The texture to save
 * @param {GPUDevice} device - WebGPU device
 * @param {string} filename - Output file name
 */
/**
 * Save texture data as CSV file
 * @param {GPUTexture} texture - The texture to save
 * @param {GPUDevice} device - WebGPU device
 * @param {string} filename - Output file name
 */
export async function saveTextureAsCSV(texture, device, filename) {
  const width = texture.width;
  const height = texture.height;
  
  console.log(`Saving texture ${texture.label || 'unnamed'} (${width}x${height})`);
  
  // For rgba32float: each component is 4 bytes (not 2 bytes)
  const bytesPerComponent = 4; // 32-bit float = 4 bytes
  const componentsPerPixel = 4; // RGBA = 4 components
  const bytesPerPixel = bytesPerComponent * componentsPerPixel; // 16 bytes per pixel
  
  // Calculate bytesPerRow correctly for rgba32float
  const bytesPerRow = width * bytesPerPixel;
  
  console.log("Texture read parameters:", {
    width, height,
    format: texture.format,
    bytesPerComponent,
    componentsPerPixel,
    bytesPerPixel,
    bytesPerRow
  });
  
  // Create buffer with exact size needed
  const stagingBuffer = device.createBuffer({
    size: width * height * bytesPerPixel,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    label: 'texture-staging-buffer'
  });
  
  // Copy texture to buffer with correct parameters
  const encoder = device.createCommandEncoder({ label: 'texture-read-encoder' });
  encoder.copyTextureToBuffer(
    { texture },
    { 
      buffer: stagingBuffer,
      bytesPerRow: bytesPerRow,
      rowsPerImage: 1
    },
    { width, height: 1 }
  );
  device.queue.submit([encoder.finish()]);
  
  // Read buffer data
  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(stagingBuffer.getMappedRange());
  
  console.log("Buffer read complete:", {
    dataLength: data.length,
    expectedComponents: width * height * componentsPerPixel
  });
  
  // Sample some data points for verification
  console.log("Texture data samples:");
  console.log("- First pixel:", data.slice(0, 4));
  if (width > 1000) {
    console.log("- Pixel 1000:", data.slice(1000 * 4, 1000 * 4 + 4));
  }
  console.log("- Last pixel:", data.slice((width - 1) * 4, width * 4));
  
  // Extract data for CSV 
  const rows = ["Index,Height,NormalX,NormalY,Alpha"];
  
  // Save a subset of the data if it's very large
  const saveEvery = width > 4096 ? Math.floor(width / 1024) : 1;
  
  for (let i = 0; i < width; i += saveEvery) {
    const r = data[i * 4];     // Height (R channel)
    const g = data[i * 4 + 1]; // Normal.x (G channel)
    const b = data[i * 4 + 2]; // Normal.y (B channel)
    const a = data[i * 4 + 3]; // Alpha (A channel)
    
    rows.push(`${i},${r},${g},${b},${a}`);
  }
  
  // Download the file
  downloadCSV(rows.join('\n'), filename);
  stagingBuffer.unmap();
}