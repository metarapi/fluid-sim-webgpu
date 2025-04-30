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

struct PhysicsParams {
    gravity: vec2<f32>,
    dt: f32,
    viscosity: f32,
    fluid_density: f32,
    target_density: f32,
    density_correction_strength: f32,
    velocity_damping: f32,
    pic_flip_ratio: f32,
    normal_restitution: f32,
    tangent_restitution: f32,
};

// Calculate RHS for density pressure equation: (1 - ρ*/ρ₀)
@group(0) @binding(0) var<storage, read> densityGrid: array<f32>;
@group(0) @binding(1) var<storage, read_write> densityRHS: array<f32>;
@group(0) @binding(2) var<uniform> physicsParams: PhysicsParams;
@group(0) @binding(3) var<storage, read> cellType: array<u32>;
@group(0) @binding(4) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; }
  
  // Only process fluid cells
  if (cellType[idx] != LIQUID) {
    densityRHS[idx] = 0.0;
    return;
  }
  
  let targetDensity = physicsParams.target_density;
  let currentDensity = densityGrid[idx];
  
  // "Our tests showed that clamping 1 - ρ*/ρ₀ to the interval [0.5, 1.5] limits the displacements so that the particles are not moved more than one cell width in one time step."
  // Calculate deviation from rest density, clamped to avoid too large corrections
  var densityDeviation = 1.0 - (currentDensity / targetDensity);
  
  // Clamp to avoid too large corrections (as suggested in the paper)
  densityDeviation = clamp(densityDeviation, -0.8, 0.8);
  
  densityRHS[idx] = densityDeviation;
}