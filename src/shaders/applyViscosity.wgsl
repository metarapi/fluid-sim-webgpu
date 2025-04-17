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
    viscosity: f32,
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
@group(0) @binding(2) var<uniform> params: SimParams;
@group(0) @binding(3) var<uniform> physicsParams: PhysicsParams;
@group(0) @binding(4) var<storage, read> volumeFractions: array<f32>;
@group(0) @binding(5) var<storage, read> cellType: array<u32>;

// @compute @workgroup_size(256)
// fn main(@builtin(global_invocation_id) id: vec3<u32>) {
//     let idx = id.x;
//     if (idx >= params.size_x * params.size_y) { return; }
    
//     let i = idx % params.size_x;
//     let j = idx / params.size_x;
//     let dx = params.grid_to_world_x;
//     let dt = physicsParams.dt;
//     let nu = physicsParams.viscosity;

//     // Calculate velocity laplacian (2D)
//     var laplacian_u = 0.0;
//     var laplacian_v = 0.0;
    
//     // U-component neighbors (staggered grid)
//     if (i > 0u)          { laplacian_u += uGrid[idx] - uGrid[idx - 1u]; }
//     if (i < params.size_x - 1u) { laplacian_u += uGrid[idx] - uGrid[idx + 1u]; }
//     if (j > 0u)          { laplacian_u += uGrid[idx] - uGrid[idx - params.size_x]; }
//     if (j < params.size_y - 1u) { laplacian_u += uGrid[idx] - uGrid[idx + params.size_x]; }
    
//     // V-component neighbors (staggered grid)
//     if (i > 0u)          { laplacian_v += vGrid[idx] - vGrid[idx - 1u]; }
//     if (i < params.size_x - 1u) { laplacian_v += vGrid[idx] - vGrid[idx + 1u]; }
//     if (j > 0u)          { laplacian_v += vGrid[idx] - vGrid[idx - params.size_x]; }
//     if (j < params.size_y - 1u) { laplacian_v += vGrid[idx] - vGrid[idx + params.size_x]; }

//     // Explicit viscosity integration
//     uGrid[idx] += nu * dt * laplacian_u / (dx * dx);
//     vGrid[idx] += nu * dt * laplacian_v / (dx * dx);

//     // Dummy read for cellType and volumeFractions to prevent unused variable errors
//     let c = cellType[idx];
//     let v = volumeFractions[idx];
// }


@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= params.size_x * params.size_y) { return; }
    
    let i = idx % params.size_x;
    let j = idx / params.size_x;
    let dx = params.grid_to_world_x;
    let dt = physicsParams.dt;
    let nu = physicsParams.viscosity;

    // Calculate face fractions for each neighbor
    var face_frac_right = 0.0;
    if (i < params.size_x - 1u && cellType[idx + 1u] != SOLID) {
        face_frac_right = min(volumeFractions[idx], volumeFractions[idx + 1u]);
    }

    var face_frac_left = 0.0;
    if (i > 0u && cellType[idx - 1u] != SOLID) {
        face_frac_left = min(volumeFractions[idx], volumeFractions[idx - 1u]);
    }

    var face_frac_top = 0.0;
    if (j < params.size_y - 1u && cellType[idx + params.size_x] != SOLID) {
        face_frac_top = min(volumeFractions[idx], volumeFractions[idx + params.size_x]);
    }

    var face_frac_bottom = 0.0;
    if (j > 0u && cellType[idx - params.size_x] != SOLID) {
        face_frac_bottom = min(volumeFractions[idx], volumeFractions[idx - params.size_x]);
    }

    // Calculate velocity laplacian (2D)
    var laplacian_u = 0.0;
    var laplacian_v = 0.0;
    
    // Right neighbor contribution
    if (i < params.size_x - 1u) {
        laplacian_u += face_frac_right * (uGrid[idx + 1u] - uGrid[idx]);
        laplacian_v += face_frac_right * (vGrid[idx + 1u] - vGrid[idx]);
    }

    // Left neighbor contribution
    if (i > 0u) {
        laplacian_u += face_frac_left * (uGrid[idx - 1u] - uGrid[idx]);
        laplacian_v += face_frac_left * (vGrid[idx - 1u] - vGrid[idx]);
    }

    // Top neighbor contribution
    if (j < params.size_y - 1u) {
        laplacian_u += face_frac_top * (uGrid[idx + params.size_x] - uGrid[idx]);
        laplacian_v += face_frac_top * (vGrid[idx + params.size_x] - vGrid[idx]);
    }

    // Bottom neighbor contribution
    if (j > 0u) {
        laplacian_u += face_frac_bottom * (uGrid[idx - params.size_x] - uGrid[idx]);
        laplacian_v += face_frac_bottom * (vGrid[idx - params.size_x] - vGrid[idx]);
    }

    let dx2 = dx * dx;
    uGrid[idx] += nu * dt * laplacian_u / dx2;
    vGrid[idx] += nu * dt * laplacian_v / dx2;
}