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
    // Terrain properties
    upscaled_terrain_count: u32,
};

@group(0) @binding(0) var<storage, read> densityPressureGrid: array<f32>; 
@group(0) @binding(1) var<storage, read_write> positionCorrectionX: array<f32>;
@group(0) @binding(2) var<storage, read_write> positionCorrectionY: array<f32>;
@group(0) @binding(3) var<storage, read> cellType: array<u32>;
@group(0) @binding(4) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; }
  
  let i = idx % params.size_x;
  let j = idx / params.size_x;
  
  // Initialize boundary faces for this cell
  let u_idx_left = j * (params.size_x + 1u) + i;
  let v_idx_bottom = j * params.size_x + i;
  
  if (i == 0u) {
    positionCorrectionX[u_idx_left] = 0.0;
  }
  if (j == 0u) {
    positionCorrectionY[v_idx_bottom] = 0.0;
  }
  
  // Skip non-fluid cells for gradient calculations
  if (cellType[idx] != LIQUID) {
    return;
  }
  
  // Calculate X-direction gradient at cell faces
  if (i < params.size_x - 1u) {
    let right_idx = (j * params.size_x) + (i + 1u);
    let u_idx = j * (params.size_x + 1u) + (i + 1u);
    let dx = params.grid_to_world_x;
    
    if (cellType[right_idx] != SOLID) {
      // Apply negative gradient (move from high to low pressure)
      positionCorrectionX[u_idx] = -1.0 * (densityPressureGrid[right_idx] - densityPressureGrid[idx]) * dx;
    }
  }
  
  // Calculate Y-direction gradient at cell faces
  if (j < params.size_y - 1u) {
    let top_idx = ((j + 1u) * params.size_x) + i;
    let v_idx = (j + 1u) * params.size_x + i;
    let dy = params.grid_to_world_y;
    
    if (cellType[top_idx] != SOLID) {
      // Apply negative gradient (move from high to low pressure)
      positionCorrectionY[v_idx] = -1.0 * (densityPressureGrid[top_idx] - densityPressureGrid[idx]) * dy;
    }
  }
}