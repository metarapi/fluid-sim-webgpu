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
    gravity: vec2<f32>,         // Gravity force 
    dt: f32,                    // Timestep
    pressure_iterations: u32,   // Number of pressure solver iterations
    density: f32,               // Fluid density
}


@group(0) @binding(0) var<storage, read_write> uGrid: array<f32>;
@group(0) @binding(1) var<storage, read> grid: array<u32>; // Cell type grid
@group(0) @binding(2) var<uniform> params: SimParams;
@group(0) @binding(3) var<uniform> physicsParams: PhysicsParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= (params.size_x + 1u) * params.size_y) {
        return;
    }

    // Calculate cell coordinates for this U velocity component
    let cellX = index % (params.size_x + 1u);
    let cellY = index / (params.size_x + 1u);

    // Check for valid left and right cells
    if (cellX == 0u || cellX >= params.size_x) {
        // Edge cases at domain boundaries - set to zero (could apply inlet/outlet conditions here)
        uGrid[index] = 0.0;
        return;
    }

    // Get left and right cell types
    let leftCellType = grid[cellY * params.size_x + cellX - 1u];
    let rightCellType = grid[cellY * params.size_x + cellX];

    // // Apply horizontal gravitational acceleration if either adjacent cell is liquid
    // if (leftCellType == LIQUID || rightCellType == LIQUID) {
    //     uGrid[index] += physicsParams.gravity.x * physicsParams.dt;
    // }

    // Apply vertical gravitational acceleration
    uGrid[index] += physicsParams.gravity.x * physicsParams.dt;
    
    // Apply directional Dirichlet boundary conditions (not a true Dirichlet condition - more a slip condition)
    // Only zero out velocities that would cause flow into solid cells
    if (leftCellType == SOLID && uGrid[index] < 0.0) {
        // Zero out velocity going into solid from right to left
        uGrid[index] = 0.0;
    } else if (rightCellType == SOLID && uGrid[index] > 0.0) {
        // Zero out velocity going into solid from left to right
        uGrid[index] = 0.0;
    }
}
