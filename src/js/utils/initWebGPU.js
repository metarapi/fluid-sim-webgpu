/**
 * Initialize WebGPU device with required features and limits
 * @returns {Promise<GPUDevice>} WebGPU device
 */
export async function initWebGPU() {
    // Check WebGPU support
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported on this browser.");
    }
    
    // Initialize WebGPU
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    
    if (!adapter) {
      throw new Error("No appropriate GPU adapter found.");
    }
    
    const device = await adapter.requestDevice({
      requiredFeatures: ['shader-f16'],
      requiredLimits: {
        maxComputeWorkgroupStorageSize: 32768,
        maxStorageBufferBindingSize: 1073741824 // 1GB
      }
    });
    
    console.log("WebGPU initialized successfully");
    return device;
  }