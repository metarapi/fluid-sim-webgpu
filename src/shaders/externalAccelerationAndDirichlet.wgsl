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


@group(0) @binding(0) var<storage, read_write> uGrid: array<f32>;
@group(0) @binding(1) var<storage, read_write> velocityY: array<f32>;
@group(0) @binding(2) var<storage, read> cellTypes: array<u32>;
@group(0) @binding(3) var<uniform> params: SimParams;

@compute @workgroup_size(16, 16)
fn applyExternalAcceleration(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let j = id.y;
  
  if (i >= params.gridSizeX || j >= params.gridSizeY) { return; }
  
  let index = i + j * params.gridSizeX;
  
  // Only apply to LIQUID cells (CellType.LIQUID = 0)
  if (cellTypes[index] == 0u) {
    velocityX[index] += params.accelX * params.deltaTime;
    velocityY[index] += params.accelY * params.deltaTime;
  }
}


@group(0) @binding(0) var<storage, read_write> velocityX: array<f32>;
@group(0) @binding(1) var<storage, read_write> velocityY: array<f32>;
@group(0) @binding(2) var<storage, read> cellTypes: array<u32>;
@group(0) @binding(3) var<uniform> params: SimParams;

@compute @workgroup_size(16, 16)
fn enforceDirichletBoundary(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let j = id.y;
  
  if (i >= params.gridSizeX || j >= params.gridSizeY) { return; }
  
  // Get indices for the cell types needed
  let index = i + j * params.gridSizeX;
  let iMinus1 = max(i, 1u) - 1u;
  let jMinus1 = max(j, 1u) - 1u;
  
  // X velocity check - stop flow into solid boundaries
  if ((cellTypes[iMinus1 + j * params.gridSizeX] == SOLID_CELL && velocityX[index] < 0.0) || 
      (cellTypes[index] == SOLID_CELL && velocityX[index] > 0.0)) {
    velocityX[index] = 0.0;
  }
  
  // Y velocity check - stop flow into solid boundaries
  if ((cellTypes[i + jMinus1 * params.gridSizeX] == SOLID_CELL && velocityY[index] < 0.0) || 
      (cellTypes[index] == SOLID_CELL && velocityY[index] > 0.0)) {
    velocityY[index] = 0.0;
  }
}