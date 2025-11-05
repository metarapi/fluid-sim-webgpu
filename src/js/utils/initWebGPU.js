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

    const requiredLimits = {
      maxComputeWorkgroupStorageSize: 16384,  // 16KB
      maxStorageBufferBindingSize: 134217728  // 128MB
    };

    if (!adapter.features?.has('subgroups')) {
      throw new Error('WebGPU adapter is missing the required "subgroups" feature for the fluid simulation.');
    }

    const device = await adapter.requestDevice({
      requiredLimits,
      requiredFeatures: ['subgroups']
    });
    
    console.log("WebGPU initialized successfully");
    return device;
  }