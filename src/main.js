import './style.css'
import { initializeSimulation, recreateSimulation } from './js/utils/setup.js';
import { setupGridDropdown, setupParticleDropdown } from './js/utils/dropdownControls.js';


// Main state object
const simState = {
  config: null,
  device: null,
  buffers: {},
  pipelines: {},
  bindGroups: {}
};

async function init() {
  try {
    await initializeSimulation(simState, {
      gridSizeX: 512, 
      gridSizeY: 512,
      lengthX: 8.0,
      lengthY: 8.0, 
      particleCount: 262144/2,
    });
    
    // Set up dropdowns
    setupGridDropdown('gridDropdownMenu', 'gridDropdownButton', 'gridDropdownSelected',
      async (newSize) => {
        simState.config.gridSizeX = newSize;
        simState.config.gridSizeY = newSize;
        // Reinitialize simulation with new config
        await recreateSimulation(simState, simState.config);
      }
    );
    setupParticleDropdown('particleDropdownMenu', 'particleDropdownButton', 'particleDropdownSelected',
      async (newCount) => {
        simState.config.particleCount = newCount;
        // Reinitialize simulation with new config
        await recreateSimulation(simState, simState.config);
      }
    );

    // Make simState globally accessible for debugging
    window.simState = simState;    
  } catch (err) {
    console.error("Initialization failed:", err);
    document.body.innerHTML = `<div class="error">Error: ${err.message}</div>`;
  }
}

// Start the app when page loads
window.addEventListener('DOMContentLoaded', init);