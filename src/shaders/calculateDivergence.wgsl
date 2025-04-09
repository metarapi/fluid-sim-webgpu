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

struct PhysicsParams {
    gravity: vec2<f32>,
    dt: f32,
    pressure_stiffness: f32,
    fluid_density: f32,
    target_density: f32,
    density_correction_strength: f32,
    velocity_damping: f32,
    pic_flip_ratio: f32,
    normal_restitution: f32,
    tangent_restitution: f32,
};

@group(0) @binding(0) var<storage, read> uGrid: array<f32>; // (size_x+1)*size_y
@group(0) @binding(1) var<storage, read> vGrid: array<f32>; // size_x*(size_y+1)
@group(0) @binding(2) var<storage, read> cellType: array<u32>; // SOLID=2, AIR=1, LIQUID=0
@group(0) @binding(3) var<storage, read_write> divergence: array<f32>;
@group(0) @binding(4) var<storage, read> densityGrid: array<f32>;
@group(0) @binding(5) var<uniform> params: SimParams;
@group(0) @binding(6) var<uniform> physicsParams: PhysicsParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; }
  
  let i = idx % params.size_x;
  let j = idx / params.size_x;
  
  // Skip non-fluid cells
  if (cellType[idx] != LIQUID) {
    divergence[idx] = 0.0;
    return;
  }
  
  let targetDensity = physicsParams.target_density;
  let correctionStrength = physicsParams.density_correction_strength;

  // Calculate staggered grid indices
  let u_idx_right = j * (params.size_x + 1) + (i + 1);
  let u_idx_left = j * (params.size_x + 1) + i;
  
  // V grid is size_x × (size_y+1) where V[i,j] is at bottom of cell
  let v_idx_top = (j + 1) * params.size_x + i;
  let v_idx_bottom = j * params.size_x + i;
  
  // Calculate divergence directly from MAC grid
  let div_x = uGrid[u_idx_right] - uGrid[u_idx_left];
  let div_y = vGrid[v_idx_top] - vGrid[v_idx_bottom];

  // Scale by grid spacing
  let scaled_div = (div_x / params.grid_to_world_x + div_y / params.grid_to_world_y);
  
  // Add density correction
  // let targetDensity = 3.2; // Tuned to desired particle density per cell
  let currentDensity = densityGrid[idx];

  // Only correct over-density (compressed regions)
  let compression = max(0.0, currentDensity - targetDensity);

  // Scale factor controls strength of correction
  // let correctionStrength = 0.5;
  // let densityCorrection = correctionStrength * compression;
  let densityCorrection = (correctionStrength) * compression;


  // Apply density correction
  divergence[idx] = scaled_div - densityCorrection;
}