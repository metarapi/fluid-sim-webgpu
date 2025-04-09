// Constants for cell types.
const LIQUID: u32 = 0u;
const AIR: u32    = 1u;
const SOLID: u32  = 2u;

struct SimParams {
    // Grid physical dimensions
    length_x: f32,      // Physical width of the grid (world units)
    length_y: f32,      // Physical height of the grid (world units)
    // Grid cell counts
    size_x: u32,        // Number of columns (e.g., 200)
    size_y: u32,        // Number of rows (e.g., 200)
    // Object counts
    particle_count: u32,    // Total number of particles in the particles buffer
    // Conversion factors (precomputed for performance)
    world_to_grid_x: f32, // size_x / length_x
    world_to_grid_y: f32, // size_y / length_y
    grid_to_world_x: f32, // length_x / size_x
    grid_to_world_y: f32, // length_y / size_y
    // Particle properties
    min_dist: f32,          // Minimum distance between particles
    min_dist2: f32,         // min_dist squared (precomputed for performance)
    particle_radius: f32,   // Particle radius
    // Simulation control
    num_substeps: u32,
    current_substep: u32,
    workgroup_count: u32,
};

struct PCGParams {
  sigma: f32,       // r·z
  alpha_denom: f32, // p·q 
  alpha: f32,       // sigma / alpha_denom
  beta: f32,        // new_sigma / sigma
  new_sigma: f32,   // z·r (after update)
  tolerance: f32,   // Convergence threshold
}

@group(0) @binding(0) var<storage, read_write> pressure: array<f32>; // x
@group(0) @binding(1) var<storage, read> searchDirection: array<f32>; // p
@group(0) @binding(2) var<storage, read> cellType: array<u32>;
@group(0) @binding(3) var<storage, read_write> pcgParams: PCGParams;
@group(0) @binding(4) var<uniform> params: SimParams;


@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; }
  
  // Skip non-fluid cells
  if (cellType[idx] != LIQUID) {
    pressure[idx] = 0.0;
    return;
  }
  
  // Read alpha from params buffer
  let alpha = pcgParams.alpha;
  
  // Update pressure: x = x + alpha * p
  pressure[idx] = pressure[idx] + alpha * searchDirection[idx];
}