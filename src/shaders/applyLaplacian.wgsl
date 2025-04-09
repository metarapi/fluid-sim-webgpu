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

@group(0) @binding(0) var<storage, read> searchDirection: array<f32>; // p vector
@group(0) @binding(1) var<storage, read> cellType: array<u32>;  // SOLID=0, AIR=1, LIQUID=2
@group(0) @binding(2) var<storage, read_write> temp: array<f32>; // Ap result
@group(0) @binding(3) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; }
  
  // Skip non-fluid cells
  if (cellType[idx] != LIQUID) { // 0 = LIQUID
    temp[idx] = 0.0;
    return;
  }
  
  let i = idx % params.size_x;
  let j = idx / params.size_x;
  let dx2 = params.grid_to_world_y * params.grid_to_world_y; // Cell size squared
  
  // Calculate Laplacian on-the-fly (stencil)
  var sum_neighbors = 0.0;
  var n_non_solid = 0u;
  
  // Left neighbor
  if (i > 0u) {
    let nidx = idx - 1u;
    if (cellType[nidx] != SOLID) { // Not SOLID
      n_non_solid++;
      if (cellType[nidx] == LIQUID) { // LIQUID
        sum_neighbors += searchDirection[nidx];
      }
    }
  }
  
  // Right neighbor
  if (i < params.size_x - 1u) {
    let nidx = idx + 1u;
    if (cellType[nidx] != SOLID) {
      n_non_solid++;
      if (cellType[nidx] == LIQUID) {
        sum_neighbors += searchDirection[nidx];
      }
    }
  }
  
  // Bottom neighbor
  if (j > 0u) {
    let nidx = idx - params.size_x;
    if (cellType[nidx] != SOLID) {
      n_non_solid++;
      if (cellType[nidx] == LIQUID) {
        sum_neighbors += searchDirection[nidx];
      }
    }
  }
  
  // Top neighbor
  if (j < params.size_y - 1u) {
    let nidx = idx + params.size_x;
    if (cellType[nidx] != SOLID) {
      n_non_solid++;
      if (cellType[nidx] == LIQUID) {
        sum_neighbors += searchDirection[nidx];
      }
    }
  }
  
  // Handle case with no valid neighbors
  if (n_non_solid == 0u) {
    temp[idx] = 0.0;
    return;
  }
  
  // Compute A·p for this cell using the central difference Laplacian
  // The formula is (sum_neighbors - n_non_solid * center) / dx²
  temp[idx] = (sum_neighbors - f32(n_non_solid) * searchDirection[idx]) / dx2;
}