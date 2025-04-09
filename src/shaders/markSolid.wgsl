// Constants for cell types.
const SOLID: u32 = 2u;
const AIR: u32 = 1u;

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
@group(0) @binding(1) var terrainTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    // Calculate the grid position from the flattened index
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
    
    // Convert grid coordinate to world space for terrain lookup
    let worldX = f32(x) * params.grid_to_world_x;
    let worldY = f32(y) * params.grid_to_world_y;
    
    // Calculate texture coordinate for textureLoad (integer coords)
    let u = clamp(worldX / params.length_x, 0.0, 0.99);
    let pixel_x = u32(u * f32(params.upscaled_terrain_count - 1u));
    
    // Use textureLoad instead of textureSampleLevel (no sampler needed)
    let terrainData = textureLoad(terrainTexture, vec2<u32>(pixel_x, 0u), 0);
    let terrainHeight = terrainData.r;
    
    // Mark cells below terrain as SOLID
    if (worldY <= terrainHeight) {
        grid[index] = SOLID;
    }
    
    // // Sspecial handling for cells exactly at the terrain surface
    // // This creates better-looking terrain edges
    // if (abs(worldY - terrainHeight) < 0.5 * params.grid_to_world_y) {
    //     // Get normal from texture G,B channels
    //     let normal = vec2<f32>(
    //         textureSampleLevel(terrainTexture, terrainSampler, vec2<f32>(u, 0.0), 0.0).g,
    //         textureSampleLevel(terrainTexture, terrainSampler, vec2<f32>(u, 0.0), 0.0).b
    //     );
        
    //     // If normal points significantly upward, mark as solid
    //     // This creates smoother terrain tops
    //     if (normal.y > 0.7) {
    //         grid[index] = SOLID;
    //     }
    // }
}