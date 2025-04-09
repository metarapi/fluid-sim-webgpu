// import { FluidRenderer } from '../renderer.js';
// import { runMonolithicSimulationStep } from './monolithEncoder.js';

// /**
//  * Main simulation loop
//  * @param {Object} state - Main simulation state
//  * @param {Object} options - Simulation options
//  * @param {number} [options.maxFrames] - Maximum number of frames to run (undefined for continuous)
//  * @param {boolean} [options.autoStart=true] - Whether to start the simulation automatically
//  * @returns {Object} Control interface for the simulation
//  */
// export async function runSimulation(state, options = {}) {
//     const { device, config, buffers, pipelines, bindGroups } = state;
    
//     // Give a unique ID to the simulation instance
//     const simulationId = Date.now();

//     // Initialize animation state
//     const animState = {
//       id: simulationId,
//       running: options.autoStart !== false,
//       frame: 0,
//       lastTime: performance.now(),
//       maxFrames: options.maxFrames,
//       stepMode: false,
//       animationFrameId: null,
//       terminated: false
//     };
    
//     // Create a canvas for visualization
//     const canvas = document.getElementById('canvas') || createCanvas();
    
//     // Create WebGPU renderer
//     const renderer = await new FluidRenderer(device, canvas, config).initialize();
    
//     // Status display element
//     const statusElement = createStatusElement();
    
//     // Main simulation loop
//     async function simulationLoop() {
//       // Check if we've reached max frames (if defined)
//       if (window.simControl && window.simControl.getId() !== simulationId) {
//         console.log(`Stopping old simulation loop ${simulationId}`);
//         return;
//       }
//       if (animState.maxFrames !== undefined && animState.frame >= animState.maxFrames) {
//         animState.running = false;
//         updateStatus(`Simulation stopped at frame ${animState.frame} (reached maxFrames)`);
//         return;
//       }
      
//       // If not running, don't schedule next frame unless in step mode
//       if (!animState.running && !animState.stepMode) {
//         updateStatus(`Simulation paused at frame ${animState.frame}`);
//         return;
//       }
      
//       // Calculate delta time (clamped to avoid large steps)
//       const now = performance.now();
//       const dt = Math.min((now - animState.lastTime) / 1000, 1/60); // Max 1/30 second
//       animState.lastTime = now;
      
//       // Run simulation step
//       try {
//         await runSimulationStep(state);
//         animState.frame++;
        
//         // Only render if not skipping
//         if (!options.skipRender) {
//           renderer.render(buffers);
//         }
        
//         // Update status
//         updateStatus(`Running: frame ${animState.frame}${animState.maxFrames ? ' of ' + animState.maxFrames : ''}`);
        
//         // If in step mode, turn off running after this frame
//         if (animState.stepMode) {
//           animState.stepMode = false;
//           animState.running = false;
//         }
        
//         // Schedule next frame if still running
//         if (animState.running) {
//           // requestAnimationFrame(simulationLoop);
//           // Store the ID when requesting a frame
//           animState.animationFrameId = requestAnimationFrame(simulationLoop);
//         }
//       } catch (err) {
//         console.error("Error in simulation:", err);
//         animState.running = false;
//         updateStatus(`Error at frame ${animState.frame}: ${err.message}`);
//       }
//     }
    
//     // Helper to update the status display
//     function updateStatus(message) {
//       if (statusElement) {
//         statusElement.textContent = message;
//       }
//       console.log(message);
//     }
    
//     // Start loop if autoStart is true (default)
//     if (animState.running) {
//       // requestAnimationFrame(simulationLoop);
//       // Store the ID when requesting a frame
//       animState.animationFrameId = requestAnimationFrame(simulationLoop);
//       updateStatus("Simulation started");
//     } else {
//       updateStatus("Simulation ready - press Start to begin");
//     }
    
//     // Return control interface
//     return {
//       getId: () => simulationId,

//       // Get the current frame
//       getCurrentFrame: () => animState.frame,
      
//       // Set the maximum number of frames
//       setMaxFrames: (frames) => {
//         animState.maxFrames = frames;
//         updateStatus(`Max frames set to ${frames}`);
//       },
      
//       // Start/resume the simulation
//       start: () => {
//         if (!animState.running) {
//           animState.running = true;
//           animState.lastTime = performance.now();
//           // requestAnimationFrame(simulationLoop);
//           // Request new frame and store the ID
//           animState.animationFrameId = requestAnimationFrame(simulationLoop);
//           updateStatus(`Simulation resumed at frame ${animState.frame}`);
//         }
//       },
      
//       // Pause the simulation
//       pause: () => {
//         animState.running = false;
//         // Cancel any pending animation frame
//         if (animState.animationFrameId !== null) {
//           cancelAnimationFrame(animState.animationFrameId);
//           animState.animationFrameId = null;
//         }
//         updateStatus(`Simulation paused at frame ${animState.frame}`);
//       },

//       terminate: () => {
//         animState.terminated = true;
//         animState.running = false;
        
//         if (animState.animationFrameId !== null) {
//           cancelAnimationFrame(animState.animationFrameId);
//           animState.animationFrameId = null;
//         }
        
//         // Clean up renderer
//         if (renderer) {
//           renderer.destroy();
//         }
        
//         // Remove status element
//         if (statusElement && statusElement.parentNode) {
//           statusElement.parentNode.removeChild(statusElement);
//         }
//       },
      
//       // Toggle pause/resume
//       togglePause: () => {
//         animState.running = !animState.running;
//         if (animState.running) {
//           animState.lastTime = performance.now();
//           // requestAnimationFrame(simulationLoop);
//           // Request new frame and store the ID
//           animState.animationFrameId = requestAnimationFrame(simulationLoop);
//           updateStatus(`Simulation resumed at frame ${animState.frame}`);
//         } else {
//           // Cancel any pending animation frame
//           if (animState.animationFrameId !== null) {
//             cancelAnimationFrame(animState.animationFrameId);
//             animState.animationFrameId = null;
//           }
//           updateStatus(`Simulation paused at frame ${animState.frame}`);
//         }
//       },
      
//       // Step a single frame
//       step: () => {
//         if (!animState.running) {
//           animState.stepMode = true;
//           animState.running = true;
//           animState.lastTime = performance.now();
//           // requestAnimationFrame(simulationLoop);
//           // Request new frame and store the ID
//           animState.animationFrameId = requestAnimationFrame(simulationLoop);
//           updateStatus(`Stepping frame ${animState.frame + 1}`);
//         }
//       },
            
//       // Force render an update frame
//       render: () => {
//         renderer.render(buffers);
//       }
//     };
//   }
  
//   /**
//    * Create a canvas element for visualization if none exists
//    * @returns {HTMLCanvasElement} The created canvas
//    */
//   function createCanvas() {
//     const canvas = document.createElement('canvas');
//     canvas.id = 'canvas';
//     canvas.width = 800;
//     canvas.height = 600;
//     document.body.appendChild(canvas);
//     return canvas;
//   }

// /**
//  * Create a status display element
//  * @returns {HTMLElement} Status element
//  */
// function createStatusElement() {
//     // Check if status element already exists
//     let statusElement = document.getElementById('simulation-status');
    
//     if (!statusElement) {
//       // Create status element
//       statusElement = document.createElement('div');
//       statusElement.id = 'simulation-status';
//       statusElement.style.position = 'absolute';
//       statusElement.style.top = '10px';
//       statusElement.style.right = '10px';
//       statusElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
//       statusElement.style.color = 'white';
//       statusElement.style.padding = '5px 10px';
//       statusElement.style.fontFamily = 'monospace';
//       statusElement.style.fontSize = '14px';
//       statusElement.style.borderRadius = '4px';
//       statusElement.style.zIndex = '1000';
//       document.body.appendChild(statusElement);
//     }
    
//     return statusElement;
//   }
  
//   async function runSimulationStep(state) {
//     // Use the monolithic encoder
//     await runMonolithicSimulationStep(state);
//   }
  