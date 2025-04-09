struct PCGParams {
  sigma: f32,       // r·z
  alpha_denom: f32, // p·q 
  alpha: f32,       // sigma / alpha_denom
  beta: f32,        // new_sigma / sigma
  new_sigma: f32,   // z·r (after update)
  tolerance: f32,   // Convergence threshold
}

@group(0) @binding(0) var<storage, read_write> pcgParams: PCGParams;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x != 0u) { return; }
  
  let sigma = pcgParams.sigma;
  let alpha_denom = pcgParams.alpha_denom;
  let new_sigma = pcgParams.new_sigma;
  
  // Avoid division by zero
  if (abs(alpha_denom) < 0.000001) {
    pcgParams.alpha = 0.0; // alpha
  } else {
    pcgParams.alpha = sigma / alpha_denom; // alpha
  }
  
  // Avoid division by zero
  if (abs(sigma) < 0.000001) {
    pcgParams.beta = 0.0; // beta
  } else {
    pcgParams.beta = new_sigma / sigma; // beta
  }
}

// Trivial, but better than reading the values from the GPU to the CPU and back !
// Why can't we have nice things like true async gpu readback...