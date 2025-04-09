struct Particle {
    pos: vec2<f32>, // World-space position. Memory layout template
};

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

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> firstCellParticle: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> cellParticleIds: array<u32>;
@group(0) @binding(3) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pid = global_id.x;
  if (pid >= params.particle_count) { return; }
  
  let particle = particles[pid];
  let cellX = u32(particle.pos.x * params.world_to_grid_x);
  let cellY = u32(particle.pos.y * params.world_to_grid_y);
  let cellIndex = cellX + cellY * params.size_x;
//   let cellIndex = cellY + cellX * params.size_y;
  
  // Atomically decrement and get the previous value
  let originalValue = atomicSub(&firstCellParticle[cellIndex], 1u);
  let idx = originalValue - 1u;
  
  // Store the particle ID at the calculated index
  cellParticleIds[idx] = pid;
}