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
@group(0) @binding(2) var<storage, read_write> aux: array<f32>; // z = M⁻¹r
@group(0) @binding(3) var<uniform> params: SimParams;
@group(0) @binding(4) var<storage, read> volumeFractions: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= params.size_x * params.size_y) { return; }
    
    if (cellType[idx] != LIQUID) {
        aux[idx] = 0.0;
        return;
    }
    
    let i = idx % params.size_x;
    let j = idx / params.size_x;
    let dx2 = params.grid_to_world_x * params.grid_to_world_x;
    
    // Calculate actual diagonal using face fractions
    var diag = 0.0;
    
    // Right
    if (i < params.size_x - 1u && cellType[idx + 1u] != SOLID) {
        diag += min(volumeFractions[idx], volumeFractions[idx + 1u]);
    }
    // Left
    if (i > 0u && cellType[idx - 1u] != SOLID) {
        diag += min(volumeFractions[idx], volumeFractions[idx - 1u]);
    }
    // Top
    if (j < params.size_y - 1u && cellType[idx + params.size_x] != SOLID) {
        diag += min(volumeFractions[idx], volumeFractions[idx + params.size_x]);
    }
    // Bottom
    if (j > 0u && cellType[idx - params.size_x] != SOLID) {
        diag += min(volumeFractions[idx], volumeFractions[idx - params.size_x]);
    }
    
    // Preconditioner: M⁻¹ ≈ (Δx²/diag)
    aux[idx] = (dx2 / (diag + 1e-7)) * residual[idx];
}