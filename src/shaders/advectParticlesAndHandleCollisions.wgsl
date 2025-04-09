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

@group(0) @binding(0) var<storage, read> particlePos: array<ParticlePos>;
@group(0) @binding(1) var<storage, read> particleVel: array<ParticleVel>;
@group(0) @binding(2) var<storage, read_write> particlePosNew: array<ParticlePos>;
@group(0) @binding(3) var<storage, read_write> particleVelNew: array<ParticleVel>;
@group(0) @binding(4) var<uniform> params: SimParams;
@group(0) @binding(5) var<uniform> physicsParams: PhysicsParams;
@group(0) @binding(6) var terrainTexture: texture_2d<f32>;


// const NORMAL_RESTITUTION: f32 = 0.1;
// const TANGENT_RESTITUTION: f32 = 0.8;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pid = id.x;
    if (pid >= params.particle_count) { return; }
    
    let pos = particlePos[pid].pos;
    let vel = particleVel[pid].vel;

    let normalRestitution = physicsParams.normal_restitution;
    let tangentRestitution = physicsParams.tangent_restitution;

    // Advect
    var newPos = pos + vel * physicsParams.dt;
    var newVel = vel;
    
    // Domain boundaries
    let minX = params.grid_to_world_x;
    let maxX = params.length_x - params.grid_to_world_x;
    let minY = params.grid_to_world_y;
    let maxY = params.length_y - params.grid_to_world_y;
    
    // Handle boundary collisions
    if (newPos.x < minX) {
        newPos.x = minX + params.particle_radius;
        newVel.x = 0.0;
    } else if (newPos.x > maxX) {
        newPos.x = maxX - params.particle_radius;
        newVel.x = 0.0;
    }

    if (newPos.y < minY) {
        newPos.y = minY + params.particle_radius;
        newVel.y = 0.0;
    } else if (newPos.y > maxY) {
        newPos.y = maxY - params.particle_radius;
        newVel.y = 0.0;
    }

    // Handle terrain collision
    // Convert to normalized coordinate for texture access
    let u = clamp(newPos.x / params.length_x, 0.0, 0.99);
    // Convert to integer pixel coordinate for textureLoad
    let pixel_x = u32(u * f32(params.upscaled_terrain_count - 1u));
    // Get terrain height and normal from texture
    let terrainData = textureLoad(terrainTexture, vec2<u32>(pixel_x, 0u), 0);
    let terrainHeight = terrainData.r;
    
    // Check if particle is below terrain
    if (newPos.y < terrainHeight) {
        // Get terrain normal
        let normal = vec2<f32>(terrainData.g, terrainData.b);
        
        let penetrationDepth = terrainHeight - newPos.y;

        // Place particle along the normal direction
        newPos += normal * (penetrationDepth + params.particle_radius);
        
        // Reflect velocity with restitution
        let velDotNormal = dot(newVel, normal);
        
        // Only reflect if velocity points into terrain
        if (velDotNormal < 0.0) {
            // Decompose velocity into normal and tangential components
            let normalComp = velDotNormal * normal;
            let tangentComp = newVel - normalComp;
            
            // Apply restitution coefficients
            newVel = tangentComp * tangentRestitution - normalComp * normalRestitution;
        }
    }

    // Store updated position and velocity
    particlePosNew[pid].pos = newPos;
    particleVelNew[pid].vel = newVel;
}