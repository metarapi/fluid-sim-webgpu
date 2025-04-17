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

@group(0) @binding(0) var terrainTexture: texture_2d<f32>;
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

    // Border cells: force to 0.0 (solid)
    if (x == 0u || y == 0u || x == params.size_x - 1u || y == params.size_y - 1u) {
        volumeFractions[index] = 0.0;
        return;
    }

    // Cell world-space bounds
    let cell_left = f32(x) * params.grid_to_world_x;
    let cell_bottom = f32(y) * params.grid_to_world_y;
    let cell_top = cell_bottom + params.grid_to_world_y;

    // Multi-sample terrain height across cell width
    let numSamples = 4u;
    var fluidFraction = 0.0;
    for (var s = 0u; s < numSamples; s = s + 1u) {
        let sample_x = cell_left + (f32(s) + 0.5) * params.grid_to_world_x / f32(numSamples);
        let u = clamp(sample_x / params.length_x, 0.0, 0.99);
        let pixel_x = u32(u * f32(params.upscaled_terrain_count - 1u));
        let terrainData = textureLoad(terrainTexture, vec2<u32>(pixel_x, 0u), 0);
        let terrainHeight = terrainData.r;

        // Compute fluid fraction for this sample
        var sampleFraction = 1.0;
        if (terrainHeight > cell_bottom && terrainHeight < cell_top) {
            sampleFraction = (cell_top - terrainHeight) / params.grid_to_world_y;
        } else if (terrainHeight >= cell_top) {
            sampleFraction = 0.0;
        }
        fluidFraction = fluidFraction + sampleFraction;
    }
    fluidFraction = fluidFraction / f32(numSamples);

    volumeFractions[index] = fluidFraction;
}