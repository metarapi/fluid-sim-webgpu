export function setupUI(simState, handlers = {}) {
  // Clean up existing handlers first
  cleanupExistingHandlers();
  
  // Set up buttons with event handlers if they exist
  setupButton('saveStateButton', handlers.onSaveState);
  setupButton('startButton', handlers.onStart);
  setupButton('pauseButton', handlers.onPause);
  setupButton('stepButton', handlers.onStep);
  setupButton('resetButton', handlers.onReset);
  setupButton('particleViewButton', handlers.onSwitchToParticleView);
  setupButton('gridViewButton', handlers.onSwitchToGridView);
  
  // Set up radio buttons for renderer selection
  const particleViewRadio = document.getElementById('particleViewRadio');
  const gridViewRadio = document.getElementById('gridViewRadio');
  
  if (particleViewRadio && gridViewRadio) {
    particleViewRadio.checked = true;
    gridViewRadio.checked = false;
    
    // Call the onSwitchToParticleView handler to select the correct renderer
    if (handlers.onSwitchToParticleView) {
      handlers.onSwitchToParticleView();
    }
  }
  
  document.getElementById('particleViewRadio').addEventListener('change', function() {
    if (this.checked) handlers.onSwitchToParticleView();
  });
  
  document.getElementById('gridViewRadio').addEventListener('change', function() {
    if (this.checked) handlers.onSwitchToGridView();
  });

  setupPhysicsSliders(simState);

  // Store handlers for cleanup later
  window.currentUIHandlers = handlers;
  
  // Set up keyboard shortcuts - with cleanup
  const keydownHandler = (e) => {
    try {
      if (e.key === ' ' && handlers.onTogglePause) {
        handlers.onTogglePause(); // Space bar to toggle pause
      } else if (e.key === 's' && handlers.onStep) {
        handlers.onStep();        // 's' key to step
      } else if (e.key === 'r' && handlers.onReset) {
        handlers.onReset();       // 'r' key to reset
      }
    } catch (err) {
      console.error("Error in keyboard handler:", err);
    }
  };
  
  document.addEventListener('keydown', keydownHandler);
  
  // Store the keydown handler for cleanup
  window.currentKeydownHandler = keydownHandler;
}

function cleanupExistingHandlers() {
  // Clean up keyboard handler
  if (window.currentKeydownHandler) {
      document.removeEventListener('keydown', window.currentKeydownHandler);
      window.currentKeydownHandler = null;
  }
  
  // Clean up button handlers
  const buttons = ['saveStateButton', 'startButton', 'pauseButton', 'stepButton', 'resetButton'];
  buttons.forEach(id => {
      const button = document.getElementById(id);
      if (button) {
          // Clone the button to remove all event listeners
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);
      }
  });
  
  // Clean up radio button handlers - Add this section
  const radioButtons = ['particleViewRadio', 'gridViewRadio'];
  radioButtons.forEach(id => {
      const radio = document.getElementById(id);
      if (radio) {
          // Clone the radio button to remove all event listeners
          const newRadio = radio.cloneNode(true);
          radio.parentNode.replaceChild(newRadio, radio);
      }
  });
  
  window.currentUIHandlers = null;
}

function setupButton(id, handler) {
  const button = document.getElementById(id);
  if (button && handler) {
      const safeHandler = (e) => {
          try {
              handler(e);
          } catch (err) {
              console.error(`Error in ${id} handler:`, err);
          }
      };
      
      button.addEventListener('click', safeHandler);
  }
}

function setupPhysicsSliders(simState) {
  // Gravity adjustment
  setupSlider('gravitySlider', 'gravityValue', -9.81, (value) => {
    // Write to offset 4 (second float, gravity.y)
    const gravityBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 4, gravityBuffer);
  });
  
  // PIC/FLIP Ratio
  setupSlider('picFlipSlider', 'picFlipValue', 0.95, (value) => {
    // Write to offset 28 (eighth float, pic_flip_ratio)
    const ratioBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 32, ratioBuffer);
  });
  
  // Target Density
  setupSlider('targetDensitySlider', 'targetDensityValue', 5.0, (value) => {
    // Write to offset 20 (fifth float, target_density)
    const densityBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 20, densityBuffer);
    // Debug log
    console.log("Target Density set to:", value);
  });
  
  // Density Correction Strength
  setupSlider('densityCorrectionStrengthSlider', 'densityCorrectionStrengthValue', 1.0, (value) => {
    // Write to offset 24 (sixth float, density_correction_strength)
    const strengthBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 24, strengthBuffer);
  });
  
  // Velocity Damping
  setupSlider('velocityDampingSlider', 'velocityDampingValue', 0.95, (value) => {
    // Write to offset 24 (seventh float, velocity_damping)
    const dampingBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 28, dampingBuffer);
  });
  
  // Normal Restitution
  setupSlider('normalRestitutionSlider', 'normalRestitutionValue', 0.1, (value) => {
    // Write to offset 32 (ninth float, normal_restitution)
    const normalBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 36, normalBuffer);
  });
  
  // Tangent Restitution
  setupSlider('tangentRestitutionSlider', 'tangentRestitutionValue', 0.8, (value) => {
    // Write to offset 36 (tenth float, tangent_restitution)
    const tangentBuffer = new Float32Array([value]);
    simState.device.queue.writeBuffer(simState.buffers.physParams, 40, tangentBuffer);
  });

  // PCG Iterations
  setupSlider('pcgIterationsSlider', 'pcgIterationsValue', 50, (value) => {
    // Update config value directly
    simState.config.pcg.maxIterations = value;
  });
}

function setupSlider(sliderId, valueId, defaultValue, onChangeCallback) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(valueId);
  
  if (!slider || !valueDisplay) return;
  
  // Set initial values
  slider.value = defaultValue;
  valueDisplay.textContent = defaultValue;
  
  // Add event listener
  slider.addEventListener('input', function() {
    const value = parseFloat(this.value);
    valueDisplay.textContent = value.toFixed(2);
    onChangeCallback(value);
  });
}