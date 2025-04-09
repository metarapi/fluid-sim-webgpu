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
};

@group(0) @binding(0) var<storage, read> particlePos: array<ParticlePos>;
@group(0) @binding(1) var<storage, read> particleVel: array<ParticleVel>;
@group(0) @binding(2) var<storage, read> firstCellParticle: array<u32>;
@group(0) @binding(3) var<storage, read> cellParticleIds: array<u32>;
@group(0) @binding(4) var<storage, read_write> uGrid: array<f32>;
@group(0) @binding(5) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pid = global_id.x;
    if (pid >= (params.size_x + 1) * params.size_y) { return; }

    var accumVel: f32 = 0.0;
    var totalWeight: f32 = 0.0;

    // Origin cell
    let cellX = pid % (params.size_x + 1);
    let cellY = pid / (params.size_x + 1);

    // Node position in world space
    let nodeX = f32(cellX) * params.grid_to_world_x;
    let nodeY = (f32(cellY) + 0.5) * params.grid_to_world_y;

    // Loop over neighboring cells in the regular grid
    for (var xx = i32(cellX)-1; xx <= i32(cellX); xx += 1) {
        for (var yy = i32(cellY)-1; yy <= i32(cellY)+1; yy += 1) {
            if (xx >= 0 && u32(xx) < params.size_x && yy >= 0 && u32(yy) < params.size_y) {
                let cellIndex = u32(xx) + u32(yy) * params.size_x;
                
                let start = firstCellParticle[cellIndex];
                let end = firstCellParticle[cellIndex + 1];

                for (var pIdx = start; pIdx < end; pIdx += 1) {
                    let p = cellParticleIds[pIdx];
                    let particle = particlePos[p];
                    
                    // Check if particle can influence the MAC node
                    if (abs(particle.pos.x - nodeX) < params.grid_to_world_x && abs(particle.pos.y - nodeY) < params.grid_to_world_y) {
                        // Compute weight based on distance (bilinear interpolation)
                        let dx = abs(particle.pos.x - nodeX) / params.grid_to_world_x;
                        let dy = abs(particle.pos.y - nodeY) / params.grid_to_world_y;
                        // Ensure non-negative weight
                        let weight = max(0.0, 1.0 - dx) * max(0.0, 1.0 - dy);

                        accumVel += particleVel[p].vel.x * weight;
                        totalWeight += weight;
                    }
                }
            }
        }
    }

    if (totalWeight > 0.0) {
        uGrid[pid] = accumVel / totalWeight;
    } else {
        uGrid[pid] = 0.0;
    }
}