import { createConfig } from '../config.js';
import { initBuffers } from '../simulation/buffers.js';
import { initPipelines } from '../simulation/pipelines.js';
import { initBindGroups } from '../simulation/bindGroups.js';
import { setupUI } from './controls.js';
import { saveState } from './io.js';
import { initWebGPU } from './initWebGPU.js';
import { SimulationController } from '../simulation/SimulationController.js';
import { FluidRenderer } from '../renderer/FluidRenderer.js';
import { GridRenderer } from '../renderer/GridRenderer.js';

/**
 * Set up WebGPU device
 * @returns {Promise<GPUDevice>} WebGPU device
 */
export async function setupWebGPU() {
  return await initWebGPU();
}

/**
 * Clear simulation resources
 * @param {Object} simState - Simulation state
 */
export function clearResources(simState) {
  // Pause current simulation
  if (window.simControl) {
    window.simControl.terminate();
  }
  
  // Destroy GPU resources except the device
  if (simState.buffers) {
    Object.values(simState.buffers).forEach(resource => {
      if (resource && typeof resource.destroy === 'function') {
        resource.destroy();
      }
    });
  }

  // Clear canvas
  const canvas = document.getElementById('canvas');
  if (canvas) {
    const ctx = canvas.getContext('webgpu');
    if (ctx) ctx.unconfigure();
    
    // Optional: clear the 2D context as well
    const ctx2d = canvas.getContext('2d');
    if (ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export async function setupSimulation(simState, config = {}) {
    // Create configuration and initialize components
    simState.config = createConfig(config);
    simState.buffers = await initBuffers(simState);
    simState.pipelines = await initPipelines(simState);
    simState.bindGroups = await initBindGroups(simState);
    
    // Create renderer
    const canvas = document.getElementById('canvas') || createCanvas();
    const renderer = await new FluidRenderer(simState.device, canvas, simState.config).initialize();
    
    // Create controller
    const controller = new SimulationController(simState, renderer, {
      maxFrames: Infinity
    });
    
    // Store controller reference
    window.simControl = controller;
    
    // Set up UI
    setupUI(simState, {
      onStart: () => controller.start(),
      onPause: () => controller.pause(),
      onStep: async () => {
        if (!controller.running) {
          await controller.runStep();
        }
      },
      onReset: () => recreateSimulation(simState),
      onTogglePause: () => 
        controller.running ? controller.pause() : controller.start(),
      onSwitchToParticleView: () => controller.switchToParticleRenderer(),
      onSwitchToGridView: () => controller.switchToGridRenderer(),
    });
    
    return controller;
  }

/**
 * Create UI callback functions
 */
function createUICallbacks(simState, simControl) {
  return {
    onSaveState: () => saveState(simState),
    onStart: () => simControl.start(),
    onPause: () => simControl.pause(),
    onStep: () => simControl.step(),
    onReset: () => recreateSimulation(simState),
    onTogglePause: () => simControl.togglePause()
  };
}

/**
 * Initialize the simulation from scratch
 * @param {Object} simState - Empty simulation state object
 * @param {Object} config - Configuration options
 */
export async function initializeSimulation(simState, config = {}) {
  // Set up WebGPU
  simState.device = await setupWebGPU();
  
  // Set up simulation
  return await setupSimulation(simState, config);
}

/**
 * Hard reset: Recreates the entire simulation with new parameters
 * @param {Object} simState - Simulation state
 * @param {Object} newConfig - New configuration 
 */
export async function recreateSimulation(simState, newConfig = {}) {
  // Clear existing resources
  clearResources(simState);
  
  // Merge original config with any new parameters
  const originalConfig = {
    gridSizeX: simState.config.gridSizeX,
    gridSizeY: simState.config.gridSizeY, 
    lengthX: simState.config.lengthX,
    lengthY: simState.config.lengthY,
    particleCount: simState.config.particleCount
  };
  
  // Combine original config with new parameters
  const combinedConfig = {...originalConfig, ...newConfig};
  
  // Set up simulation with combined config
  return await setupSimulation(simState, combinedConfig);
}

function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    return canvas;
  }