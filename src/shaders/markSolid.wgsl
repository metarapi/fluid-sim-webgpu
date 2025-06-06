// Constants for cell types.
const SOLID: u32 = 2u;
const AIR: u32 = 1u;

const VOLUME_FRACTION_THRESHOLD: f32 = 0.5; // Bridson recommends 0.1, but 0.5 appars to be more stable (p. 95)

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

@group(0) @binding(0) var<storage, read_write> grid: array<u32>;  
@group(0) @binding(1) var<uniform> params: SimParams;
@group(0) @binding(2) var<storage, read_write> volumeFractions: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let grid_size = params.size_x * params.size_y;
    if (index >= grid_size) {
        return;
    }

    let y = index / params.size_x;
    let x = index % params.size_x;

    // Border cells: force to SOLID
    if (x == 0u || y == 0u || x == params.size_x - 1u || y == params.size_y - 1u) {
        grid[index] = SOLID;
        return;
    }

    // Default to AIR if not already SOLID
    if (grid[index] != SOLID) {
        grid[index] = AIR;
    }

    let fluidFraction = volumeFractions[index];

    // Compute neighbor indices
    let idx_right  = index + 1u;
    let idx_left   = index - 1u;
    let idx_top    = index + params.size_x;
    let idx_bottom = index - params.size_x;

    // Compute face fractions
    let frac_right  = min(fluidFraction, volumeFractions[idx_right]);
    let frac_left   = min(fluidFraction, volumeFractions[idx_left]);
    let frac_top    = min(fluidFraction, volumeFractions[idx_top]);
    let frac_bottom = min(fluidFraction, volumeFractions[idx_bottom]);

    // Mark as SOLID if all face fractions are below threshold
    if (frac_right < VOLUME_FRACTION_THRESHOLD &&
        frac_left < VOLUME_FRACTION_THRESHOLD &&
        frac_top < VOLUME_FRACTION_THRESHOLD &&
        frac_bottom < VOLUME_FRACTION_THRESHOLD) {
        grid[index] = SOLID;
        return;
    }

    // Otherwise, mark as SOLID if the cell's own volume fraction is below threshold
    if (fluidFraction < VOLUME_FRACTION_THRESHOLD) {
        grid[index] = SOLID;
    }
}