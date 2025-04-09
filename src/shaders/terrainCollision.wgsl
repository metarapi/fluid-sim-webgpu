struct ParticlePos {
    pos: vec2<f32>, // World-space position. Memory layout template
};

struct ParticleVel {
    vel: vec2<f32>, // World-space velocity. Memory layout template
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
    // Terrain properties
    upscaled_terrain_count: u32,
};

@group(0) @binding(0) var<storage, read> particlePos: array<ParticlePos>;
@group(0) @binding(1) var<storage, read_write> particlePosNew: array<ParticlePos>;
@group(0) @binding(2) var<storage, read_write> particleVel: array<ParticleVel>;
@group(0) @binding(3) var<uniform> params: SimParams;
@group(0) @binding(4) var terrainTexture: texture_2d<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pid = global_id.x;
    if (pid >= params.particle_count) { return; }
    
    let pos = particlePos[pid].pos;
    var vel = particleVel[pid].vel;
       
    // Convert world position to normalized coordinate
    let u = clamp(pos.x / params.length_x, 0.0, 0.99);
    
    // Convert to integer pixel coordinate for textureLoad
    let pixel_x = u32(u * f32(params.upscaled_terrain_count - 1u));
    
    // Use textureLoad instead of textureSampleLevel
    let terrainData = textureLoad(terrainTexture, vec2<u32>(pixel_x, 0u), 0);
    let terrainHeight = terrainData.r;
    
    // Check for collision
    if (pos.y < terrainHeight) {
        // Get normal vector from texture (g,b channels)
        let normal = vec2<f32>(terrainData.g, terrainData.b);
        
        // Corrected position - place slightly above terrain
        var newPos = vec2<f32>(pos.x, terrainHeight + params.particle_radius * 1.05);
        
        // Reflect velocity with damping (only if moving toward terrain)
        let velDotNormal = dot(vel, normal);
        if (velDotNormal < 0.0) {
            // Reflection formula: v_new = v - 2(v·n)n
            // With damping coefficient: v_new = v - (1+damp)(v·n)n
            vel -= (1.0 + 0.3) * velDotNormal * normal; // 0.3 = restitution
        }
        
        // Apply friction
        let tangent = vec2<f32>(normal.y, -normal.x); // Perpendicular to normal
        let velTangential = dot(vel, tangent) * tangent;
        vel = velTangential * 0.8; // 0.8 = friction coefficient
        
        // Update particle
        particlePosNew[pid].pos = newPos;
        particleVel[pid].vel = vel;
    }
}