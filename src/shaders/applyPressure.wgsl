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

@group(0) @binding(0) var<storage, read_write> uGrid: array<f32>; 
@group(0) @binding(1) var<storage, read_write> vGrid: array<f32>;
@group(0) @binding(2) var<storage, read> pressure: array<f32>;
@group(0) @binding(3) var<storage, read> cellType: array<u32>;
@group(0) @binding(4) var<uniform> params: SimParams;
@group(0) @binding(5) var<uniform> physicsParams: PhysicsParams;
@group(0) @binding(6) var<storage, read> densityGrid: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.size_x * params.size_y) { return; } // Fixed params.gridSizeX/Y to params.size_x/y
  
  let i = idx % params.size_x;
  let j = idx / params.size_x;
  
  // Only process cells that are liquid or have liquid neighbors
  if (cellType[idx] != LIQUID && 
      (i == 0u || cellType[idx - 1u] != LIQUID) && 
      (i == params.size_x - 1u || cellType[idx + 1u] != LIQUID) && 
      (j == 0u || cellType[idx - params.size_x] != LIQUID) && 
      (j == params.size_y - 1u || cellType[idx + params.size_x] != LIQUID)) {
    return;
  }
  
  // Calculate staggered grid indices
  let u_idx_right = j * (params.size_x + 1) + (i + 1);
  let u_idx_left = j * (params.size_x + 1) + i;
  let v_idx_top = (j + 1) * params.size_x + i;
  let v_idx_bottom = j * params.size_x + i;
  
  // const STIFFNESS: f32 = 0.04; // Under-relaxation factor (0.6 is the limit at dt = 1/60)
  let STIFFNESS = physicsParams.pressure_stiffness;

  let localDensity = densityGrid[idx];
  // var scale = STIFFNESS * physicsParams.dt / (physicsParams.fluid_density * params.grid_to_world_x);
  var scale = physicsParams.dt / (physicsParams.fluid_density * params.grid_to_world_x);

  // Right face
  if (i < params.size_x - 1u && (cellType[idx] == LIQUID || cellType[idx + 1u] == LIQUID)) {
    let pressure_right = select(0.0, pressure[idx + 1u], cellType[idx + 1u] == LIQUID);
    let pressure_center = select(0.0, pressure[idx], cellType[idx] == LIQUID);
    let grad_pressure = (pressure_right - pressure_center) * scale;
    uGrid[u_idx_right] -= grad_pressure;

    // Quasi-Dirichlet boundary condition (no flow into solid cells)
    if (cellType[idx] == SOLID && uGrid[u_idx_right] < 0.0) {
      uGrid[u_idx_right] = 0.0;
    } else if (cellType[idx + 1u] == SOLID && uGrid[u_idx_right] > 0.0) {
      uGrid[u_idx_right] = 0.0;
    }
  }
  
  // Left face
  if (i > 0u && (cellType[idx] == LIQUID || cellType[idx - 1u] == LIQUID)) {
    let pressure_left = select(0.0, pressure[idx - 1u], cellType[idx - 1u] == LIQUID);
    let pressure_center = select(0.0, pressure[idx], cellType[idx] == LIQUID);
    let grad_pressure = (pressure_center - pressure_left) * scale;
    uGrid[u_idx_left] -= grad_pressure;

    if (cellType[idx - 1u] == SOLID && uGrid[u_idx_left] < 0.0) {
      uGrid[u_idx_left] = 0.0;
    } else if (cellType[idx] == SOLID && uGrid[u_idx_left] > 0.0) {
      uGrid[u_idx_left] = 0.0;
    }
  }
  
  // Top face
  if (j < params.size_y - 1u && (cellType[idx] == LIQUID || cellType[idx + params.size_x] == LIQUID)) {
    let pressure_top = select(0.0, pressure[idx + params.size_x], cellType[idx + params.size_x] == LIQUID);
    let pressure_center = select(0.0, pressure[idx], cellType[idx] == LIQUID);
    let grad_pressure = (pressure_top - pressure_center) * scale;
    vGrid[v_idx_top] -= grad_pressure;

    if (cellType[idx + params.size_x] == SOLID && vGrid[v_idx_top] < 0.0) {
      vGrid[v_idx_top] = 0.0;
    } else if (cellType[idx] == SOLID && vGrid[v_idx_top] > 0.0) {
      vGrid[v_idx_top] = 0.0;
    }
  }
  
  // Bottom face
  if (j > 0u && (cellType[idx] == LIQUID || cellType[idx - params.size_x] == LIQUID)) {
    let pressure_bottom = select(0.0, pressure[idx - params.size_x], cellType[idx - params.size_x] == LIQUID);
    let pressure_center = select(0.0, pressure[idx], cellType[idx] == LIQUID);
    let grad_pressure = (pressure_center - pressure_bottom) * scale;
    vGrid[v_idx_bottom] -= grad_pressure;

    if (cellType[idx - params.size_x] == SOLID && vGrid[v_idx_bottom] < 0.0) {
      vGrid[v_idx_bottom] = 0.0;
    } else if (cellType[idx] == SOLID && vGrid[v_idx_bottom] > 0.0) {
      vGrid[v_idx_bottom] = 0.0;
    }
  }
}