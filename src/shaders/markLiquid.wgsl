// Constants for cell types.
const LIQUID: u32 = 0u;
const AIR: u32    = 1u;
const SOLID: u32  = 2u;

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

@group(0) @binding(0) var<storage, read_write> grid: array<atomic<u32>>;
// The grid is stored in row-major order. Index = x + y * size_x.

@group(0) @binding(1) var<storage, read> particles: array<Particle>;
// Reads the flat array in steps of 2 (vec2<f32>) as defined in the Particle struct

@group(0) @binding(2) var<uniform> params: SimParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let particle_idx: u32 = global_id.x;
    if (particle_idx >= params.particle_count) {
        return;
    }
    
    // Read the particle's world position.
    let p: Particle = particles[particle_idx];
    
    // Convert world position to grid coordinates.
    // Note: Make sure the conversion matches how you set up your grid.
    // For example, assuming the grid covers [0, length_x] x [0, length_y]:
    let fx: f32 = p.pos.x * params.world_to_grid_x;
    let fy: f32 = p.pos.y * params.world_to_grid_y;
    
    // Clamp to grid bounds.
    let grid_x: u32 = clamp(u32(p.pos.x * params.world_to_grid_x), 0u, params.size_x - 1u);
    let grid_y: u32 = clamp(u32(p.pos.y * params.world_to_grid_y), 0u, params.size_y - 1u);
    
    // Compute the flattened grid index.
    let index: u32 = grid_x + grid_y * params.size_x;
    
    // We want to update the cell to LIQUID if it is currently AIR.
    // If the cell is SOLID (or already LIQUID), leave it as is.
    loop {
        let current_val: u32 = atomicLoad(&grid[index]);
        if (current_val != AIR) {
            // If it's already SOLID or LIQUID, we do nothing.
            break;
        }
        // Attempt to update the cell to LIQUID.
        let result = atomicCompareExchangeWeak(&grid[index], current_val, LIQUID);
        if (result.exchanged) {
            break; // Update succeeded.
        }
        // Otherwise, the value was changed by another thread.
        // The loop re-reads the new value and tries again.
    }
}        