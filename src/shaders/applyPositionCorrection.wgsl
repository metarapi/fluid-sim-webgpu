// Constants for cell types
const LIQUID: u32 = 0u;
const AIR: u32 = 1u;
const SOLID: u32 = 2u;

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

@group(0) @binding(0) var<storage, read_write> particlePos: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read> positionCorrectionX: array<f32>;
@group(0) @binding(2) var<storage, read> positionCorrectionY: array<f32>;
@group(0) @binding(3) var<uniform> params: SimParams;
@group(0) @binding(4) var<uniform> physicsParams: PhysicsParams;
@group(0) @binding(5) var terrainTexture: texture_2d<f32>;
@group(0) @binding(6) var<storage, read> cellType: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pid = id.x;
    if (pid >= params.particle_count) { return; }

    // Get particle position
    let pos = particlePos[pid];

    // Get particle position in grid coordinates
    let i = pos.x * params.world_to_grid_x;
    let j = pos.y * params.world_to_grid_y;
    
    // For X position correction: interpolate from staggered grid faces
    let posX = i;
    let posY = j;
    
    // Get cell indices and interpolation weights for X-direction correction
    let i0 = u32(floor(posX));
    let j0 = u32(floor(posY));
    let s = posX - f32(i0); // X-interpolation fraction
    let t = posY - f32(j0); // Y-interpolation fraction
    
    // Sample X-correction from 4 surrounding face centers
    var corrX = 0.0;
    if (i0 < params.size_x && j0 < params.size_y) {
        let x00 = sampleCorrX(i0, j0);
        let x10 = sampleCorrX(i0+1u, j0);
        let x01 = sampleCorrX(i0, j0+1u);
        let x11 = sampleCorrX(i0+1u, j0+1u);
        
        // Bilinear interpolation
        corrX = mix(mix(x00, x10, s), mix(x01, x11, s), t);
    }
    
    // For Y position correction (staggered in Y direction)
    let posX_y = i;
    let posY_y = j;
    
    // Get cell indices and interpolation weights for Y-direction correction
    let i0_y = u32(floor(posX_y));
    let j0_y = u32(floor(posY_y));
    let s_y = posX_y - f32(i0_y); // X-interpolation fraction
    let t_y = posY_y - f32(j0_y); // Y-interpolation fraction
    
    // Sample Y-correction from 4 surrounding face centers
    var corrY = 0.0;
    if (i0_y < params.size_x && j0_y < params.size_y) {
        let y00 = sampleCorrY(i0_y, j0_y);
        let y10 = sampleCorrY(i0_y+1u, j0_y);
        let y01 = sampleCorrY(i0_y, j0_y+1u);
        let y11 = sampleCorrY(i0_y+1u, j0_y+1u);
        
        // Bilinear interpolation
        corrY = mix(mix(y00, y10, s_y), mix(y01, y11, s_y), t_y);
    }
    
    // Apply correction with timestep and strength factors
    let dt = physicsParams.dt;
    let correctionScale = physicsParams.density_correction_strength;
    
    // Calculate the correction vector
    let correction = vec2<f32>(corrX, corrY) * dt * correctionScale;
    
    // Limit maximum correction distance
    // let maxCorrectionDistance = params.grid_to_world_x * 0.5;  // Half a cell width
    // let corrMagnitude = length(correction);
    var scaledCorrection = correction * 10000.0; // Magic number - no idea why (might be because of not using phyiscal units?)
    // let scalingFactor = (dt * dt) / physicsParams.target_density; 
    // var scaledCorrection = correction * scalingFactor;

    // if (corrMagnitude > maxCorrectionDistance && corrMagnitude > 0.0001) {
    //     scaledCorrection = correction * (maxCorrectionDistance / corrMagnitude);
    // }
    
    var newPos = vec2<f32>(pos.x + scaledCorrection.x, pos.y + scaledCorrection.y);
    
    // Terrain collision check - similar to your current terrain collision
    let u = clamp(newPos.x / params.length_x, 0.0, 0.99);
    let pixel_x = u32(u * f32(params.upscaled_terrain_count - 1u));
    let terrainData = textureLoad(terrainTexture, vec2<u32>(pixel_x, 0u), 0);
    let terrainHeight = terrainData.r;

    // Check if particle is below terrain after position correction
    if (newPos.y < terrainHeight) {
        // Get terrain normal
        let normal = vec2<f32>(terrainData.g, terrainData.b);
        
        // Calculate penetration depth
        let penetrationDepth = terrainHeight - newPos.y;
        
        // Place particle along normal direction
        newPos += normal * (penetrationDepth + params.particle_radius);
    }
    
    // Update particle position
    particlePos[pid] = newPos;
}

// Helper functions to sample MAC grid
fn sampleCorrX(i: u32, j: u32) -> f32 {
    // X position correction is stored at cell faces (similar to u velocity)
    if (i >= params.size_x + 1u || j >= params.size_y) {
        return 0.0;
    }
    return positionCorrectionX[j * (params.size_x + 1u) + i];
}

fn sampleCorrY(i: u32, j: u32) -> f32 {
    // Y position correction is stored at cell faces (similar to v velocity)
    if (i >= params.size_x || j >= params.size_y + 1u) {
        return 0.0;
    }
    return positionCorrectionY[j * params.size_x + i];
}