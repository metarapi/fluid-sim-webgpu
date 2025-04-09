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

@group(0) @binding(0) var<storage, read> residual: array<f32>;
@group(0) @binding(1) var<storage, read> cellType: array<u32>;
@group(0) @binding(2) var<storage, read_write> partialMax: array<f32>;
@group(0) @binding(3) var<uniform> params: SimParams;

const WG_SIZE: u32 = 256;
var<workgroup> localMax: array<f32, WG_SIZE>;

@compute @workgroup_size(WG_SIZE)
fn main(@builtin(workgroup_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let idx = gid.x * WG_SIZE + lid.x;
  let tid = lid.x;
  
  var max_val = 0.0;
  
  // Each thread processes multiple elements
  for (var i = idx; i < params.size_x * params.size_y; i += WG_SIZE * params.workgroup_count) {
    if (cellType[i] == LIQUID) {
      max_val = max(max_val, abs(residual[i]));
    }
  }
  
  // Store in local memory
  localMax[tid] = max_val;
  workgroupBarrier();
  
  // Reduction to find maximum
  if (tid < 128) { localMax[tid] = max(localMax[tid], localMax[tid + 128]); } workgroupBarrier();
  if (tid < 64) { localMax[tid] = max(localMax[tid], localMax[tid + 64]); } workgroupBarrier();
  if (tid < 32) { localMax[tid] = max(localMax[tid], localMax[tid + 32]); } workgroupBarrier();
  if (tid < 16) { localMax[tid] = max(localMax[tid], localMax[tid + 16]); } workgroupBarrier();
  if (tid < 8) { localMax[tid] = max(localMax[tid], localMax[tid + 8]); } workgroupBarrier();
  if (tid < 4) { localMax[tid] = max(localMax[tid], localMax[tid + 4]); } workgroupBarrier();
  if (tid < 2) { localMax[tid] = max(localMax[tid], localMax[tid + 2]); } workgroupBarrier();
  if (tid < 1) { localMax[tid] = max(localMax[tid], localMax[tid + 1]); } workgroupBarrier();
  
  if (tid == 0) {
    partialMax[gid.x] = localMax[0];
  }
}