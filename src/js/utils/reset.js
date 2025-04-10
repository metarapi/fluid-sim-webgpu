export async function resetSimulation(simState, newConfig = {}) {
    // 1. Pause current simulation
    if (window.simControl) {
      window.simControl.pause();
    }
    
    // 2. Destroy existing GPU resources but keep the device
    if (simState.buffers) {
        Object.values(simState.buffers).forEach(resource => {
        if (resource && typeof resource.destroy === 'function') {
            resource.destroy();
        }
        });
    }
    
    // 3. Create new configuration (reuse the device)
    simState.config = createConfig(newConfig);
    
    // 4. Reinitialize components
    console.log("Reinitializing buffers...");
    simState.buffers = await initBuffers(simState);
    
    console.log("Reinitializing pipelines...");
    simState.pipelines = await initPipelines(simState);
    
    console.log("Reinitializing bind groups...");
    simState.bindGroups = await initBindGroups(simState);
    
    // 5. Restart simulation
    console.log("Restarting simulation...");
    const simControl = await runSimulation(simState, {
      maxFrames: Infinity,
      autoStart: false,
      skipRender: false
    });
    
    // 6. Update global references
    window.simControl = simControl;
    
    // 7. Update UI controls
    setupUI(simState, {
      onSaveState: () => saveState(simState),
      onStart: () => simControl.start(),
      onPause: () => simControl.pause(),
      onStep: () => simControl.step(),
      onReset: () => simControl.reset(),
      onTogglePause: () => simControl.togglePause()
    });
    
    return simControl;
  }