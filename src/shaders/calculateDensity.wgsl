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

@group(0) @binding(0) var<storage, read> cellType: array<u32>;
@group(0) @binding(1) var<storage, read_write> densityGrid: array<f32>;
@group(0) @binding(2) var<storage, read> firstCellParticle: array<u32>;
@group(0) @binding(3) var<storage, read> cellParticleIds: array<u32>;
@group(0) @binding(4) var<storage, read> particlePos: array<vec2<f32>>;
@group(0) @binding(5) var<uniform> params: SimParams;


@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; }
  
  // Only process liquid cells
  if (cellType[idx] != LIQUID) {
    densityGrid[idx] = 0.0;
    return;
  }
  
  let i = idx % params.size_x;
  let j = idx / params.size_x;
  
  let cell_center_x = (f32(i) + 0.5) * params.grid_to_world_x;
  let cell_center_y = (f32(j) + 0.5) * params.grid_to_world_y;
  
  var totalDensity = 0.0;
  
  // Search for particles in 3×3 neighborhood
  for (var di = -1; di <= 1; di++) {
    for (var dj = -1; dj <= 1; dj++) {
      let ni = i32(i) + di;
      let nj = i32(j) + dj;
      
      // Skip out-of-bounds cells
      if (ni < 0 || ni >= i32(params.size_x) || 
          nj < 0 || nj >= i32(params.size_y)) {
        continue;
      }
      
      // Get range of particles in this neighbor cell
      let neighborCellIdx = u32(nj) * params.size_x + u32(ni);
      let startIdx = firstCellParticle[neighborCellIdx];
      let endIdx = firstCellParticle[neighborCellIdx + 1];
      
      // Process all particles in this cell
      for (var p = startIdx; p < endIdx; p++) {
        let particleId = cellParticleIds[p];
        let pos = particlePos[particleId];
        
        // Calculate distance from cell center to particle
        let dx = pos.x - cell_center_x;
        let dy = pos.y - cell_center_y;
        let d2 = dx*dx + dy*dy;
        
        // Use kernel radius of 2.0 * min_dist
        let h = 2.0 * params.min_dist;
        let h2 = h*h;
        
        if (d2 < h2) {
          // Poly6 kernel for density
          let q = sqrt(d2) / h;
          if (q < 1.0) {
            let densityContrib = (1.0 - q*q) * (1.0 - q*q) * (1.0 - q*q);
            totalDensity += densityContrib;
          }
        }
      }
    }
  }
  
  // Store final density
  densityGrid[idx] = totalDensity;
}