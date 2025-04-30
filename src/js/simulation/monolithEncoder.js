/**
 * Run a single simulation step with monolithic command encoding
 * @param {Object} state - Main simulation state
 */
export async function runMonolithicSimulationStep(state) {
    const { device, config, buffers, pipelines, bindGroups } = state;
    const { gridSizeX, gridSizeY, particleCount, prefixSum, pcg } = config;
  
    // Create a single command encoder for the entire simulation step
    const encoder = device.createCommandEncoder();
  
    // === STAGE 1: CELL SETUP ===
    
    // Reset cell type buffer (mark all cells as AIR)
    encoder.clearBuffer(buffers.cellType);
 
    {
      const markFluidFractionsPass = encoder.beginComputePass();
      markFluidFractionsPass.setPipeline(pipelines.markFluidFractions.pipeline);
      markFluidFractionsPass.setBindGroup(0, bindGroups.markFluidFractions);
      markFluidFractionsPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      markFluidFractionsPass.end();
    }

    {
      const markSolidPass = encoder.beginComputePass();
      markSolidPass.setPipeline(pipelines.markSolid.pipeline);
      markSolidPass.setBindGroup(0, bindGroups.markSolid);
      markSolidPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      markSolidPass.end();
    }
  
    {
      const markLiquidPass = encoder.beginComputePass();
      markLiquidPass.setPipeline(pipelines.markLiquid.pipeline);
      markLiquidPass.setBindGroup(0, bindGroups.markLiquid);
      markLiquidPass.dispatchWorkgroups(Math.ceil(particleCount / 64));
      markLiquidPass.end();
    }
    
    // Reset particle counter buffers
    encoder.clearBuffer(buffers.numCellParticles);
    encoder.clearBuffer(buffers.firstCellParticle);
    
    // Count particles in each cell
    {
      const particleToCellPass = encoder.beginComputePass();
      particleToCellPass.setPipeline(pipelines.particleToCell.pipeline);
      particleToCellPass.setBindGroup(0, bindGroups.particleToCell);
      particleToCellPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
      particleToCellPass.end();
    }
  
    // === STAGE 2: PREFIX SUM COMPUTATION ===
    {
      const prefixSumPass = encoder.beginComputePass();
      
      // First pass - process grid cells in chunks (always needed)
      prefixSumPass.setPipeline(pipelines.prefixSumFirstPass.pipeline);
      prefixSumPass.setBindGroup(0, bindGroups.prefixSumFirstPass);
      prefixSumPass.dispatchWorkgroups(prefixSum.numWorkgroups1);
      
      if (prefixSum.isSmallGrid) {
        // For small grids: Second pass using the Third pass shader
        // (This pass handles the final summing for small grids)
        prefixSumPass.setPipeline(pipelines.prefixSumThirdPass.pipeline);
        prefixSumPass.setBindGroup(0, bindGroups.prefixSumThirdPass);
        prefixSumPass.dispatchWorkgroups(1);
        
        // Use the simplified downsweep pass for small grids
        prefixSumPass.setPipeline(pipelines.prefixSumFinalPassSmall.pipeline);
        prefixSumPass.setBindGroup(0, bindGroups.prefixSumFinalPassSmall);
        prefixSumPass.dispatchWorkgroups(prefixSum.finalPassWorkgroups);
      } else {
        // For larger grids: Standard three-pass approach
        
        // Second pass - process intermediate results
        prefixSumPass.setPipeline(pipelines.prefixSumFirstPass.pipeline);
        prefixSumPass.setBindGroup(0, bindGroups.prefixSumSecondPass);
        prefixSumPass.dispatchWorkgroups(prefixSum.numWorkgroups2);
        
        // Third pass - process second pass results
        prefixSumPass.setPipeline(pipelines.prefixSumThirdPass.pipeline);
        prefixSumPass.setBindGroup(0, bindGroups.prefixSumThirdPass);
        prefixSumPass.dispatchWorkgroups(prefixSum.numWorkgroups3);
        
        // Final pass - combine all results with the full downsweep
        prefixSumPass.setPipeline(pipelines.prefixSumFinalPass.pipeline);
        prefixSumPass.setBindGroup(0, bindGroups.prefixSumFinalPass);
        prefixSumPass.dispatchWorkgroups(prefixSum.finalPassWorkgroups);
      }
      
      // Add guard element (needed for both small and large grids)
      prefixSumPass.setPipeline(pipelines.addGuard.pipeline);
      prefixSumPass.setBindGroup(0, bindGroups.addGuard);
      prefixSumPass.dispatchWorkgroups(1);
      
      prefixSumPass.end();
    }
    
    // === STAGE 3: PARTICLE HANDLING AND MAPPING ===
    
    // Assign particle IDs to cells
    {
      const particleIdPass = encoder.beginComputePass();
      particleIdPass.setPipeline(pipelines.particleIdAssignment.pipeline);
      particleIdPass.setBindGroup(0, bindGroups.particleIdAssignment);
      particleIdPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
      particleIdPass.end();
    }
    
    // Push particles apart (using ping-pong buffers)
    for (let step = 0; step < config.pushApartSteps; step++) {
      // Update current step in simulation parameters
      device.queue.writeBuffer(buffers.simParams, 52, new Uint32Array([step]));

      const pushApartPass = encoder.beginComputePass();
      pushApartPass.setPipeline(pipelines.pushParticlesApart.pipeline);
      
      // Ping-pong between buffers based on odd/even step
      if (step % 2 === 0) {
        pushApartPass.setBindGroup(0, bindGroups.pushParticlesApartPing);
      } else {
        pushApartPass.setBindGroup(0, bindGroups.pushParticlesApartPong);
      }
      
      pushApartPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
      pushApartPass.end();
    }
    
    // If odd number of steps, copy back to main buffer
    if (config.pushApartSteps % 2 !== 0) {
      encoder.copyBufferToBuffer(
        buffers.particles.particlePositionPong, 0,
        buffers.particles.particlePosition, 0,
        buffers.particles.particlePosition.size
      );
    }
    
    // // Terrain collision pass
    // {
    //   const terrainCollisionPass = encoder.beginComputePass();
    //   terrainCollisionPass.setPipeline(pipelines.terrainCollision.pipeline);
    //   terrainCollisionPass.setBindGroup(0, bindGroups.terrainCollision);
    //   terrainCollisionPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
    //   terrainCollisionPass.end();
    // }

    // Calculate density field
    encoder.clearBuffer(buffers.densityGrid);
    
    {
      const densityPass = encoder.beginComputePass();
      densityPass.setPipeline(pipelines.calculateDensity.pipeline);
      densityPass.setBindGroup(0, bindGroups.calculateDensity);
      densityPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      densityPass.end();
    }

    // === STAGE 3.5: IMPLICIT DENSITY PROJECTION ===

    // Clear density pressure grid
    encoder.clearBuffer(buffers.densityPressureGrid);
    encoder.clearBuffer(buffers.positionCorrectionX);
    encoder.clearBuffer(buffers.positionCorrectionY);

    // Calculate RHS for density pressure equation
    {
      const densityRHSPass = encoder.beginComputePass();
      densityRHSPass.setPipeline(pipelines.calculateDensityPressureRHS.pipeline);
      densityRHSPass.setBindGroup(0, bindGroups.calculateDensityPressureRHS);
      densityRHSPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      densityRHSPass.end();
    }

    // Copy density RHS to residual
    encoder.copyBufferToBuffer(
      buffers.densityRHS, 0, 
      buffers.residual, 0, 
      buffers.densityRHS.size
    );

    // Apply preconditioner
    {
      const precondPass = encoder.beginComputePass();
      precondPass.setPipeline(pipelines.applyPreconditioner.pipeline);
      precondPass.setBindGroup(0, bindGroups.densityApplyPreconditioner);
      precondPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      precondPass.end();
    }

    // Copy aux to search direction
    encoder.copyBufferToBuffer(
      buffers.aux, 0, 
      buffers.searchDirection, 0, 
      buffers.aux.size
    );

    // Calculate initial sigma (r·z)
    {
      const dotPass1 = encoder.beginComputePass();
      dotPass1.setPipeline(pipelines.dotProductPass1.pipeline);
      dotPass1.setBindGroup(0, bindGroups.dotProductRZ); // Same as in regular PCG
      dotPass1.dispatchWorkgroups(pcg.workgroupCount);
      dotPass1.end();
    }

    {
      const dotPass2 = encoder.beginComputePass();
      dotPass2.setPipeline(pipelines.dotProductPass2.pipeline);
      dotPass2.setBindGroup(0, bindGroups.dotProductPass2); // Same as in regular PCG
      dotPass2.dispatchWorkgroups(1);
      dotPass2.end();
    }

    // Copy initial sigma to PCG params
    encoder.copyBufferToBuffer(
      buffers.finalDotProduct, 0, 
      buffers.pcgParams, 0, 
      4 // 4 bytes for a float
    );

    // Density PCG iteration loop
    const densityPCGIterations = Math.min(pcg.maxIterations, 500);
    // const densityPCGIterations = 50; // Hardcoded for testing
    
    // Create a staging buffer for temporary dot product value (reuse the one from regular PCG)
    const tempDotBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    
    // Run PCG iterations for density pressure
    for (let iter = 0; iter < densityPCGIterations; iter++) {
      // 1. Apply Laplacian: q = A·p
      const lapPass = encoder.beginComputePass();
      lapPass.setPipeline(pipelines.applyLaplacian.pipeline);
      lapPass.setBindGroup(0, bindGroups.densityApplyLaplacian);
      lapPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      lapPass.end();
      
      // 2. Compute p·q (alpha_denom)
      const dotPqPass1 = encoder.beginComputePass();
      dotPqPass1.setPipeline(pipelines.dotProductPass1.pipeline);
      dotPqPass1.setBindGroup(0, bindGroups.dotProductPQ); // Same as in regular PCG
      dotPqPass1.dispatchWorkgroups(pcg.workgroupCount);
      dotPqPass1.end();
      
      const dotPqPass2 = encoder.beginComputePass();
      dotPqPass2.setPipeline(pipelines.dotProductPass2.pipeline);
      dotPqPass2.setBindGroup(0, bindGroups.dotProductPass2);
      dotPqPass2.dispatchWorkgroups(1);
      dotPqPass2.end();
      
      // Copy to alpha_denom
      encoder.copyBufferToBuffer(
        buffers.finalDotProduct, 0, 
        buffers.pcgParams, 4, // alpha_denom at offset 4
        4
      );
      
      // 3. Calculate alpha and update solution+residual
      const alphaBetaPass = encoder.beginComputePass();
      alphaBetaPass.setPipeline(pipelines.calculateAlphaBeta.pipeline);
      alphaBetaPass.setBindGroup(0, bindGroups.calculateAlphaBeta);
      alphaBetaPass.dispatchWorkgroups(1);
      alphaBetaPass.end();
      
      // 4. Update pressure: x += alpha * p
      const updateSolnPass = encoder.beginComputePass();
      updateSolnPass.setPipeline(pipelines.updateSolution.pipeline);
      updateSolnPass.setBindGroup(0, bindGroups.densityUpdateSolution);
      updateSolnPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      updateSolnPass.end();
      
      // 5. Update residual: r -= alpha * q
      const updateResidualPass = encoder.beginComputePass();
      updateResidualPass.setPipeline(pipelines.updateResidual.pipeline);
      updateResidualPass.setBindGroup(0, bindGroups.densityUpdateResidual);
      updateResidualPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      updateResidualPass.end();
      
      // 6. Apply preconditioner: z = M⁻¹r
      const precondPass = encoder.beginComputePass();
      precondPass.setPipeline(pipelines.applyPreconditioner.pipeline);
      precondPass.setBindGroup(0, bindGroups.densityApplyPreconditioner);
      precondPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      precondPass.end();
      
      // 7. Compute z·r (new_sigma)
      const dotRzPass1 = encoder.beginComputePass();
      dotRzPass1.setPipeline(pipelines.dotProductPass1.pipeline);
      dotRzPass1.setBindGroup(0, bindGroups.dotProductRZ);
      dotRzPass1.dispatchWorkgroups(pcg.workgroupCount);
      dotRzPass1.end();
      
      const dotRzPass2 = encoder.beginComputePass();
      dotRzPass2.setPipeline(pipelines.dotProductPass2.pipeline);
      dotRzPass2.setBindGroup(0, bindGroups.dotProductPass2);
      dotRzPass2.dispatchWorkgroups(1);
      dotRzPass2.end();
      
      // We need to avoid directly copying from and to the same buffer
      encoder.copyBufferToBuffer(
        buffers.finalDotProduct, 0, 
        tempDotBuffer, 0, 
        4
      );
      
      encoder.copyBufferToBuffer(
        tempDotBuffer, 0, 
        buffers.pcgParams, 16, // new_sigma at offset 16
        4
      );
      
      // 8. Calculate beta and update search direction
      const betaPass = encoder.beginComputePass();
      betaPass.setPipeline(pipelines.calculateAlphaBeta.pipeline);
      betaPass.setBindGroup(0, bindGroups.calculateAlphaBeta);
      betaPass.dispatchWorkgroups(1);
      betaPass.end();
      
      // 9. Update search direction: p = z + beta*p
      const searchDirPass = encoder.beginComputePass();
      searchDirPass.setPipeline(pipelines.updateSearchDirection.pipeline);
      searchDirPass.setBindGroup(0, bindGroups.updateSearchDirection);
      searchDirPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      searchDirPass.end();
      
      // 10. sigma = new_sigma for next iteration
      // We need to avoid direct buffer-to-itself copy
      encoder.copyBufferToBuffer(
        buffers.pcgParams, 16, 
        tempDotBuffer, 0, 
        4
      );
      
      encoder.copyBufferToBuffer(
        tempDotBuffer, 0, 
        buffers.pcgParams, 0, 
        4
      );
    }

    // Calculate position corrections from density pressure gradient
    {
      const positionCorrectionPass = encoder.beginComputePass();
      positionCorrectionPass.setPipeline(pipelines.calculatePositionCorrection.pipeline);
      positionCorrectionPass.setBindGroup(0, bindGroups.calculatePositionCorrection);
      positionCorrectionPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      positionCorrectionPass.end();
    }

    // Apply position corrections to particles
    {
      const applyPositionCorrectionPass = encoder.beginComputePass();
      applyPositionCorrectionPass.setPipeline(pipelines.applyPositionCorrection.pipeline);
      applyPositionCorrectionPass.setBindGroup(0, bindGroups.applyPositionCorrection);
      applyPositionCorrectionPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
      applyPositionCorrectionPass.end();
    }

    // === STAGE 3.7: P2G VELOCITY TRANSFER ===

    // Map particle velocities to grid
    encoder.clearBuffer(buffers.uGrid);
    encoder.clearBuffer(buffers.vGrid);
    encoder.clearBuffer(buffers.uGridMask);
    encoder.clearBuffer(buffers.vGridMask);
    
    {
      const particleToGridUPass = encoder.beginComputePass();
      particleToGridUPass.setPipeline(pipelines.particleToGridU.pipeline);
      particleToGridUPass.setBindGroup(0, bindGroups.particleToGridU);
      particleToGridUPass.dispatchWorkgroups(Math.ceil((gridSizeX+1) * gridSizeY / 256));
      particleToGridUPass.end();
    }
    
    {
      const particleToGridVPass = encoder.beginComputePass();
      particleToGridVPass.setPipeline(pipelines.particleToGridV.pipeline);
      particleToGridVPass.setBindGroup(0, bindGroups.particleToGridV);
      particleToGridVPass.dispatchWorkgroups(Math.ceil(gridSizeX * (gridSizeY+1) / 256));
      particleToGridVPass.end();
    }
    
    encoder.copyBufferToBuffer(
      buffers.uGrid, 0, 
      buffers.uGridPrev, 0, 
      buffers.uGrid.size
    );
    
    encoder.copyBufferToBuffer(
      buffers.vGrid, 0, 
      buffers.vGridPrev, 0, 
      buffers.vGrid.size
    );

    // Extension passes - each extends one cell further
    const numExtensionPasses = 3; // Extend velocity field by 3 cells
    for (let pass = 0; pass < numExtensionPasses; pass++) {
      // Each pass must be a separate compute dispatch
      const extendUPass = encoder.beginComputePass();
      extendUPass.setPipeline(pipelines.extendVelocityU.pipeline);
      extendUPass.setBindGroup(0, bindGroups.extendVelocityU);
      extendUPass.dispatchWorkgroups(Math.ceil((gridSizeX+1) * gridSizeY / 256));
      extendUPass.end();
      
      const extendVPass = encoder.beginComputePass();
      extendVPass.setPipeline(pipelines.extendVelocityV.pipeline);
      extendVPass.setBindGroup(0, bindGroups.extendVelocityV);
      extendVPass.dispatchWorkgroups(Math.ceil(gridSizeX * (gridSizeY+1) / 256));
      extendVPass.end();
    }

    // // Apply viscosity pass (diffuse grid velocities - Laplacian)
    // {
    //   const viscosityPass = encoder.beginComputePass();
    //   viscosityPass.setPipeline(pipelines.applyViscosity.pipeline);
    //   viscosityPass.setBindGroup(0, bindGroups.applyViscosity);
    //   viscosityPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
    //   viscosityPass.end();
    // }

    // Apply external forces
    {
      const addAccelUPass = encoder.beginComputePass();
      addAccelUPass.setPipeline(pipelines.addAccelerationAndDirichletU.pipeline);
      addAccelUPass.setBindGroup(0, bindGroups.addAccelerationAndDirichletU);
      addAccelUPass.dispatchWorkgroups(Math.ceil((gridSizeX+1)*gridSizeY / 256));
      addAccelUPass.end();
    }
    
    {
      const addAccelVPass = encoder.beginComputePass();
      addAccelVPass.setPipeline(pipelines.addAccelerationAndDirichletV.pipeline);
      addAccelVPass.setBindGroup(0, bindGroups.addAccelerationAndDirichletV);
      addAccelVPass.dispatchWorkgroups(Math.ceil(gridSizeX*(gridSizeY+1) / 256));
      addAccelVPass.end();
    }
  
    // === STAGE 4: PRESSURE PROJECTION ===
    
    // Save grid velocities before pressure projection
    // encoder.copyBufferToBuffer(
    //   buffers.uGrid, 0, 
    //   buffers.uGridPrev, 0, 
    //   buffers.uGrid.size
    // );
    
    // encoder.copyBufferToBuffer(
    //   buffers.vGrid, 0, 
    //   buffers.vGridPrev, 0, 
    //   buffers.vGrid.size
    // );
    
    // Calculate divergence
    {
      const divPass = encoder.beginComputePass();
      divPass.setPipeline(pipelines.calculateDivergence.pipeline);
      divPass.setBindGroup(0, bindGroups.calculateDivergence);
      divPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      divPass.end();
    }
    
    // Initialize PCG variables
    encoder.copyBufferToBuffer(
      buffers.divergence, 0, 
      buffers.residual, 0, 
      buffers.divergence.size
    );
    
    encoder.clearBuffer(buffers.pressureGrid);
    
    {
      const precondPass = encoder.beginComputePass();
      precondPass.setPipeline(pipelines.applyPreconditioner.pipeline);
      precondPass.setBindGroup(0, bindGroups.applyPreconditioner);
      precondPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      precondPass.end();
    }
    
    encoder.copyBufferToBuffer(
      buffers.aux, 0, 
      buffers.searchDirection, 0, 
      buffers.aux.size
    );
    
    // Calculate initial sigma (r·z)
    {
      const dotPass1 = encoder.beginComputePass();
      dotPass1.setPipeline(pipelines.dotProductPass1.pipeline);
      dotPass1.setBindGroup(0, bindGroups.dotProductRZ);
      dotPass1.dispatchWorkgroups(pcg.workgroupCount);
      dotPass1.end();
    }
    
    {
      const dotPass2 = encoder.beginComputePass();
      dotPass2.setPipeline(pipelines.dotProductPass2.pipeline);
      dotPass2.setBindGroup(0, bindGroups.dotProductPass2);
      dotPass2.dispatchWorkgroups(1);
      dotPass2.end();
    }
    
    // Copy initial sigma to PCG params
    encoder.copyBufferToBuffer(
      buffers.finalDotProduct, 0, 
      buffers.pcgParams, 0, 
      4 // 4 bytes for a float
    );
  
    // PCG iteration loop - this is the key optimization
    // We do fixed number of iterations instead of checking convergence
    const pcgIterations = Math.min(pcg.maxIterations, 500); // Use up to X iterations

    // Clear instead
    encoder.clearBuffer(tempDotBuffer);
    
    // Run the PCG iterations
    for (let iter = 0; iter < pcgIterations; iter++) {
      // 1. Apply Laplacian: q = A·p
      const lapPass = encoder.beginComputePass();
      lapPass.setPipeline(pipelines.applyLaplacian.pipeline);
      lapPass.setBindGroup(0, bindGroups.applyLaplacian);
      lapPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      lapPass.end();
      
      // 2. Compute p·q (alpha_denom)
      const dotPqPass1 = encoder.beginComputePass();
      dotPqPass1.setPipeline(pipelines.dotProductPass1.pipeline);
      dotPqPass1.setBindGroup(0, bindGroups.dotProductPQ);
      dotPqPass1.dispatchWorkgroups(pcg.workgroupCount);
      dotPqPass1.end();
      
      const dotPqPass2 = encoder.beginComputePass();
      dotPqPass2.setPipeline(pipelines.dotProductPass2.pipeline);
      dotPqPass2.setBindGroup(0, bindGroups.dotProductPass2);
      dotPqPass2.dispatchWorkgroups(1);
      dotPqPass2.end();
      
      // Copy to alpha_denom
      encoder.copyBufferToBuffer(
        buffers.finalDotProduct, 0, 
        buffers.pcgParams, 4, // alpha_denom at offset 4
        4
      );
      
      // 3. Calculate alpha and update solution+residual
      const alphaBetaPass = encoder.beginComputePass();
      alphaBetaPass.setPipeline(pipelines.calculateAlphaBeta.pipeline);
      alphaBetaPass.setBindGroup(0, bindGroups.calculateAlphaBeta);
      alphaBetaPass.dispatchWorkgroups(1);
      alphaBetaPass.end();
      
      // 4. Update pressure: x += alpha * p
      const updateSolnPass = encoder.beginComputePass();
      updateSolnPass.setPipeline(pipelines.updateSolution.pipeline);
      updateSolnPass.setBindGroup(0, bindGroups.updateSolution);
      updateSolnPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      updateSolnPass.end();
      
      // 5. Update residual: r -= alpha * q
      const updateResidualPass = encoder.beginComputePass();
      updateResidualPass.setPipeline(pipelines.updateResidual.pipeline);
      updateResidualPass.setBindGroup(0, bindGroups.updateResidual);
      updateResidualPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      updateResidualPass.end();
      
      // 6. Apply preconditioner: z = M⁻¹r
      const precondPass = encoder.beginComputePass();
      precondPass.setPipeline(pipelines.applyPreconditioner.pipeline);
      precondPass.setBindGroup(0, bindGroups.applyPreconditioner);
      precondPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      precondPass.end();
      
      // 7. Compute z·r (new_sigma)
      const dotRzPass1 = encoder.beginComputePass();
      dotRzPass1.setPipeline(pipelines.dotProductPass1.pipeline);
      dotRzPass1.setBindGroup(0, bindGroups.dotProductRZ);
      dotRzPass1.dispatchWorkgroups(pcg.workgroupCount);
      dotRzPass1.end();
      
      const dotRzPass2 = encoder.beginComputePass();
      dotRzPass2.setPipeline(pipelines.dotProductPass2.pipeline);
      dotRzPass2.setBindGroup(0, bindGroups.dotProductPass2);
      dotRzPass2.dispatchWorkgroups(1);
      dotRzPass2.end();
      
      // We need to avoid directly copying from and to the same buffer
      encoder.copyBufferToBuffer(
        buffers.finalDotProduct, 0, 
        tempDotBuffer, 0, 
        4
      );
      
      encoder.copyBufferToBuffer(
        tempDotBuffer, 0, 
        buffers.pcgParams, 16, // new_sigma at offset 16
        4
      );
      
      // 8. Calculate beta and update search direction
      const betaPass = encoder.beginComputePass();
      betaPass.setPipeline(pipelines.calculateAlphaBeta.pipeline);
      betaPass.setBindGroup(0, bindGroups.calculateAlphaBeta);
      betaPass.dispatchWorkgroups(1);
      betaPass.end();
      
      // 9. Update search direction: p = z + beta*p
      const searchDirPass = encoder.beginComputePass();
      searchDirPass.setPipeline(pipelines.updateSearchDirection.pipeline);
      searchDirPass.setBindGroup(0, bindGroups.updateSearchDirection);
      searchDirPass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      searchDirPass.end();
      
      // 10. sigma = new_sigma for next iteration
      // We need to avoid direct buffer-to-itself copy
      encoder.copyBufferToBuffer(
        buffers.pcgParams, 16, 
        tempDotBuffer, 0, 
        4
      );
      
      encoder.copyBufferToBuffer(
        tempDotBuffer, 0, 
        buffers.pcgParams, 0, 
        4
      );
    }
  
    // Apply pressure gradient to velocities
    {
      const applyPressurePass = encoder.beginComputePass();
      applyPressurePass.setPipeline(pipelines.applyPressure.pipeline);
      applyPressurePass.setBindGroup(0, bindGroups.applyPressure);
      applyPressurePass.dispatchWorkgroups(Math.ceil(gridSizeX * gridSizeY / 256));
      applyPressurePass.end();
    }
  
    // === STAGE 5: GRID TO PARTICLE AND ADVECTION ===
    
    // Transfer grid velocities to particles
    {
      const gridToPartPass = encoder.beginComputePass();
      gridToPartPass.setPipeline(pipelines.gridToParticle.pipeline);
      gridToPartPass.setBindGroup(0, bindGroups.gridToParticle);
      gridToPartPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
      gridToPartPass.end();
    }
    
    // Advect particles
    {
      const advectPass = encoder.beginComputePass();
      advectPass.setPipeline(pipelines.advectParticles.pipeline);
      advectPass.setBindGroup(0, bindGroups.advectParticles);
      advectPass.dispatchWorkgroups(Math.ceil(particleCount / 256));
      advectPass.end();
    }
    
    // Copy results back to main buffers
    encoder.copyBufferToBuffer(
      buffers.particles.particlePositionPong, 0,
      buffers.particles.particlePosition, 0,
      buffers.particles.particlePosition.size
    );
    
    encoder.copyBufferToBuffer(
      buffers.particles.particleVelocityPong, 0,
      buffers.particles.particleVelocity, 0,
      buffers.particles.particleVelocity.size
    );
  
    // Submit the entire encoder in one go
    device.queue.submit([encoder.finish()]);
  }