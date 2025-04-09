import { runMonolithicSimulationStep } from './monolithEncoder.js';
import { FluidRenderer } from '../renderer/FluidRenderer.js';
import { GridRenderer } from '../renderer/GridRenderer.js';

export class SimulationController {
  constructor(state, renderer, options = {}) {
    // Core simulation state
    this.state = state;
    this.renderer = renderer;
    this.status = {
      frame: 0,
      lastTime: performance.now(),
      maxFrames: options.maxFrames || Infinity,
    };
    
    // Animation control state
    this.id = Date.now();
    this.animationFrame = null;
    this.running = false;
    this.stepMode = false;
    this.terminated = false;
    
    // Create status display
    this.statusElement = this.createStatusElement();
    this.updateStatus("Simulation ready - press Start to begin");
    
    // Bind methods to prevent 'this' context issues
    this.animate = this.animate.bind(this);
    this.runStep = this.runStep.bind(this);
  }
  
  // Getter for the controller ID
  getId() {
    return this.id;
  }
  
  // Run a single simulation step
  async runStep() {
    if (this.terminated) return;
    
    try {
      const now = performance.now();
      const dt = Math.min((now - this.status.lastTime) / 1000, 1/60);
      this.status.lastTime = now;
      
      // Run the actual physics step
      await runMonolithicSimulationStep(this.state);
      this.status.frame++;
      
      // Render the result
      this.renderer.render(this.state.buffers);
      
      // If in step mode, turn off running after this step
      if (this.stepMode) {
        this.stepMode = false;
        this.running = false;
      }
      
      this.updateStatus(`Running: frame ${this.status.frame}`);
    } catch (err) {
      console.error("Error in simulation:", err);
      this.running = false;
      this.updateStatus(`Error at frame ${this.status.frame}: ${err.message}`);
    }
  }
  
  // Start/resume the simulation
  start() {
    if (!this.running && !this.terminated) {
      this.running = true;
      this.status.lastTime = performance.now();
      this.animate();
      this.updateStatus(`Simulation resumed at frame ${this.status.frame}`);
    }
  }
  
  // Pause the simulation
  pause() {
    if (this.running && !this.terminated) {
      this.running = false;
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      this.updateStatus(`Paused at frame ${this.status.frame}`);
    }
  }
  
  // Single step the simulation
  step() {
    if (!this.running && !this.terminated) {
      this.stepMode = true;
      this.running = true;
      this.runStep().then(() => {
        this.running = false;
      });
    }
  }
  
  // Toggle between paused and running
  togglePause() {
    if (this.terminated) return;
    
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }
  
  // The animation loop function
  async animate() {
    if (this.terminated || !this.running) return;
    
    // Run a simulation step
    await this.runStep();
    
    // Check if we've reached max frames
    if (this.status.maxFrames && this.status.frame >= this.status.maxFrames) {
      this.running = false;
      this.updateStatus(`Simulation stopped at frame ${this.status.frame} (reached maxFrames)`);
      return;
    }
    
    // Schedule next frame if still running
    if (this.running && !this.terminated) {
      this.animationFrame = requestAnimationFrame(this.animate);
    }
  }
  
  // Clean up resources and stop the simulation
  terminate() {
    console.log(`Terminating controller ${this.id}`);
    
    // Set terminated flag FIRST
    this.terminated = true;
    
    // Stop animation immediately
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // Clean up renderer
    if (this.renderer) {
      try {
        this.renderer.destroy();
      } catch (e) {
        console.error("Error destroying renderer:", e);
      }
      this.renderer = null;
    }
    
    // Remove status element
    if (this.statusElement && this.statusElement.parentNode) {
      try {
        this.statusElement.parentNode.removeChild(this.statusElement);
      } catch (e) {
        console.error("Error removing status element:", e);
      }
      this.statusElement = null;
    }
    
    // Clear all references to break potential cycles
    this.state = null;
    
    console.log(`Controller ${this.id} terminated`);
  }
  
  // Create the status UI element
  createStatusElement() {
    // Create a NEW status element with a unique ID for each controller
    const element = document.createElement('div');
    element.id = `simulation-status-${this.id}`;
    element.style.position = 'absolute';
    element.style.top = '80px';
    element.style.right = '10px';
    element.style.backgroundColor = 'rgba(0,0,0,0.7)';
    element.style.color = 'white';
    element.style.padding = '5px 10px';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '14px';
    element.style.borderRadius = '4px';
    element.style.zIndex = '1000';
    
    // Remove any existing status elements first
    const existingStatus = document.getElementById('simulation-status');
    if (existingStatus && existingStatus.parentNode) {
      existingStatus.parentNode.removeChild(existingStatus);
    }
    
    // Use a consistent ID for the active element
    element.id = 'simulation-status';
    document.body.appendChild(element);
    
    return element;
  }
  
  // Update the status UI element and log
  updateStatus(message) {
    // Only log if not terminated
    if (this.terminated) return;
    
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
    console.log(`[Sim #${this.id}] ${message}`);
  }
  
  // Set the maximum number of frames
  setMaxFrames(frames) {
    this.status.maxFrames = frames;
    this.updateStatus(`Max frames set to ${frames}`);
  }
  
  // Get the current frame
  getCurrentFrame() {
    return this.status.frame;
  }
  
  // Force a render without simulation step
  render() {
    if (this.renderer && this.state.buffers) {
      this.renderer.render(this.state.buffers);
    }
  }

   // Switch to particle (fluid) rendering
   async switchToParticleRenderer() {
    // Clean up existing renderer
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    // Check if state is valid before proceeding
    if (!this.state || !this.state.device) {
      console.error("Cannot switch renderer: state or device is null");
      return;
    }

    // Get the canvas from the old renderer or find it in the document
    const canvas = this.renderer?.canvas || document.getElementById('canvas');
    
    // Create and initialize a new fluid renderer
    this.renderer = new FluidRenderer(this.state.device, canvas, this.state.config);
    await this.renderer.initialize();
    
    // Render the current state immediately
    this.render();
  }
  
  // Switch to grid rendering
  async switchToGridRenderer() {
    // Clean up existing renderer
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    // Check if state is valid before proceeding
    if (!this.state || !this.state.device) {
      console.error("Cannot switch renderer: state or device is null");
      return;
    }

    // Get the canvas from the old renderer or find it in the document
    const canvas = this.renderer?.canvas || document.getElementById('canvas');
    
    // Create and initialize a new grid renderer
    this.renderer = new GridRenderer(this.state.device, canvas, this.state.config);
    await this.renderer.initialize();
    
    // Render the current state immediately
    this.render();
  }
}