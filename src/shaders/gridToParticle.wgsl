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

@group(0) @binding(0) var<storage, read> particlePos: array<ParticlePos>;
@group(0) @binding(1) var<storage, read_write> particleVel: array<ParticleVel>;
@group(0) @binding(2) var<storage, read> uGrid: array<f32>; // Current velocities
@group(0) @binding(3) var<storage, read> vGrid: array<f32>; 
@group(0) @binding(4) var<storage, read> uGridPrev: array<f32>; // Pre-projection velocities
@group(0) @binding(5) var<storage, read> vGridPrev: array<f32>;
@group(0) @binding(6) var<uniform> params: SimParams;
@group(0) @binding(7) var<uniform> physicsParams: PhysicsParams;
@group(0) @binding(8) var<storage, read> densityGrid: array<f32>;

// const FLIP_RATIO: f32 = 0.85; // 85% FLIP, 15% PIC blend (remember, more PIC = more viscosity [Bridson, 2016. p. 118])

// @compute @workgroup_size(256)
// fn main(@builtin(global_invocation_id) id: vec3<u32>) {
//     let pid = id.x;
//     if (pid >= params.particle_count) { return; }
    
//     let pic_flip_ratio = physicsParams.pic_flip_ratio;
//     let velocity_damping = physicsParams.velocity_damping;

//     // Get particle position
//     let pos = particlePos[pid];

//     // Get particle position in grid coordinates
//     let i = pos.pos.x * params.world_to_grid_x;
//     let j = pos.pos.y * params.world_to_grid_y;
    
//     // For U-velocity: shift horizontally by +0.5 to align with u-velocity points
//     let ui = i + 0.5;
//     let uj = j;
//     let ui0 = u32(floor(ui));
//     let uj0 = u32(floor(uj));
//     let su = ui - f32(ui0); // U-interpolation fraction
//     let sv = uj - f32(uj0); // V-interpolation fraction

//     // For V-velocity: shift vertically by +0.5 to align with v-velocity points
//     let vi = i;
//     let vj = j + 0.5;
//     let vi0 = u32(floor(vi));
//     let vj0 = u32(floor(vj));
//     let sv_u = vi - f32(vi0); // U-interpolation fraction for v
//     let sv_v = vj - f32(vj0); // V-interpolation fraction for v
    
//     // Sample 4 surrounding velocities for U and V components
//     // Sample U velocities
//     let u00 = sampleU(ui0, uj0);
//     let u10 = sampleU(ui0+1u, uj0);
//     let u01 = sampleU(ui0, uj0+1u);
//     let u11 = sampleU(ui0+1u, uj0+1u);

//     // Sample V velocities
//     let v00 = sampleV(vi0, vj0);
//     let v10 = sampleV(vi0+1u, vj0);
//     let v01 = sampleV(vi0, vj0+1u);
//     let v11 = sampleV(vi0+1u, vj0+1u);
    
//     // Same for old grid velocities
//     let uOld00 = sampleUOld(ui0, uj0);
//     let uOld10 = sampleUOld(ui0+1u, uj0);
//     let uOld01 = sampleUOld(ui0, uj0+1u);
//     let uOld11 = sampleUOld(ui0+1u, uj0+1u);

//     let vOld00 = sampleVOld(vi0, vj0);
//     let vOld10 = sampleVOld(vi0+1u, vj0);
//     let vOld01 = sampleVOld(vi0, vj0+1u);
//     let vOld11 = sampleVOld(vi0+1u, vj0+1u);
    
//     // Bilinear interpolation for current grid
//     let uPIC = mix(mix(u00, u10, su), mix(u01, u11, su), sv);
//     let vPIC = mix(mix(v00, v10, sv_u), mix(v01, v11, sv_u), sv_v);
    
//     // Bilinear interpolation for old grid
//     let uOldInterp = mix(mix(uOld00, uOld10, su), mix(uOld01, uOld11, su), sv);
//     let vOldInterp = mix(mix(vOld00, vOld10, sv_u), mix(vOld01, vOld11, sv_u), sv_v);
    
//     // Current particle velocity
//     let oldVel = particleVel[pid].vel;
    
//     // FLIP: Transfer velocity change
//     let uFLIP = oldVel.x + (uPIC - uOldInterp);
//     let vFLIP = oldVel.y + (vPIC - vOldInterp);
    
//     // Blend PIC and FLIP
//     let newVel = vec2<f32>(
//         mix(uPIC, uFLIP, pic_flip_ratio),
//         mix(vPIC, vFLIP, pic_flip_ratio)
//     );
    
//     // Fake viscous dissipation
//     // Store new velocity
//     particleVel[pid].vel = newVel * velocity_damping;
// }

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pid = id.x;
    if (pid >= params.particle_count) { return; }
    
    let pic_flip_ratio = physicsParams.pic_flip_ratio;
    let velocity_damping = physicsParams.velocity_damping;

    // Get particle position
    let pos = particlePos[pid];

    // Get particle position in grid coordinates
    let i = pos.pos.x * params.world_to_grid_x;
    let j = pos.pos.y * params.world_to_grid_y;
    
    // For U-velocity: shift horizontally by +0.5 to align with u-velocity points
    let ui = i + 0.5;
    let uj = j;
    let ui0 = u32(floor(ui));
    let uj0 = u32(floor(uj));
    let su = ui - f32(ui0); // U-interpolation fraction
    let sv = uj - f32(uj0); // V-interpolation fraction

    // For V-velocity: shift vertically by +0.5 to align with v-velocity points
    let vi = i;
    let vj = j + 0.5;
    let vi0 = u32(floor(vi));
    let vj0 = u32(floor(vj));
    let sv_u = vi - f32(vi0); // U-interpolation fraction for v
    let sv_v = vj - f32(vj0); // V-interpolation fraction for v
    
    // Sample 4 surrounding velocities for U and V components
    let u00 = sampleU(ui0, uj0);
    let u10 = sampleU(ui0+1u, uj0);
    let u01 = sampleU(ui0, uj0+1u);
    let u11 = sampleU(ui0+1u, uj0+1u);

    let v00 = sampleV(vi0, vj0);
    let v10 = sampleV(vi0+1u, vj0);
    let v01 = sampleV(vi0, vj0+1u);
    let v11 = sampleV(vi0+1u, vj0+1u);
    
    // Same for old grid velocities
    let uOld00 = sampleUOld(ui0, uj0);
    let uOld10 = sampleUOld(ui0+1u, uj0);
    let uOld01 = sampleUOld(ui0, uj0+1u);
    let uOld11 = sampleUOld(ui0+1u, uj0+1u);

    let vOld00 = sampleVOld(vi0, vj0);
    let vOld10 = sampleVOld(vi0+1u, vj0);
    let vOld01 = sampleVOld(vi0, vj0+1u);
    let vOld11 = sampleVOld(vi0+1u, vj0+1u);
    
    // Bilinear interpolation for current grid
    let uPIC = mix(mix(u00, u10, su), mix(u01, u11, su), sv);
    let vPIC = mix(mix(v00, v10, sv_u), mix(v01, v11, sv_u), sv_v);
    
    // Bilinear interpolation for old grid
    let uOldInterp = mix(mix(uOld00, uOld10, su), mix(uOld01, uOld11, su), sv);
    let vOldInterp = mix(mix(vOld00, vOld10, sv_u), mix(vOld01, vOld11, sv_u), sv_v);
    
    // Current particle velocity
    let oldVel = particleVel[pid].vel;
    
    // FLIP: Transfer velocity change
    let uFLIP = oldVel.x + (uPIC - uOldInterp);
    let vFLIP = oldVel.y + (vPIC - vOldInterp);
    
    // Blend PIC and FLIP
    let newVel = vec2<f32>(
        mix(uPIC, uFLIP, pic_flip_ratio),
        mix(vPIC, vFLIP, pic_flip_ratio)
    );

    // --- Adaptive velocity damping based on local density ---
    // Sample density from 4 surrounding cells
    let di = pos.pos.x * params.world_to_grid_x;
    let dj = pos.pos.y * params.world_to_grid_y;
    let di0 = u32(floor(di));
    let dj0 = u32(floor(dj));
    let sdi = di - f32(di0);
    let sdj = dj - f32(dj0);

    let d00 = densityGrid[dj0 * params.size_x + di0];
    let d10 = densityGrid[dj0 * params.size_x + (di0 + 1u)];
    let d01 = densityGrid[(dj0 + 1u) * params.size_x + di0];
    let d11 = densityGrid[(dj0 + 1u) * params.size_x + (di0 + 1u)];

    // Bilinear interpolate density
    let particleDensity = mix(mix(d00, d10, sdi), mix(d01, d11, sdi), sdj);

    // Calculate adaptive damping
    let density_ratio = particleDensity / physicsParams.target_density;
    let adaptive_damping = mix(
        0.95,                   // Strong damping in low-density regions
        velocity_damping,       // Default damping at target density
        clamp(density_ratio, 0.0, 1.0)
    );

    // Store new velocity with adaptive damping
    particleVel[pid].vel = newVel * adaptive_damping;
}



// Helper functions to sample MAC grid
fn sampleU(i: u32, j: u32) -> f32 {
    // U is stored at the left face of cells
    if (i >= params.size_x + 1u || j >= params.size_y) {
        return 0.0;
    }
    return uGrid[j * (params.size_x + 1u) + i];
}

fn sampleV(i: u32, j: u32) -> f32 {
    // V is stored at the bottom face of cells
    if (i >= params.size_x || j >= params.size_y + 1u) {
        return 0.0;
    }
    return vGrid[j * params.size_x + i];
}

fn sampleUOld(i: u32, j: u32) -> f32 {
    // U previous grid
    if (i >= params.size_x + 1u || j >= params.size_y) {
        return 0.0;
    }
    return uGridPrev[j * (params.size_x + 1u) + i];
}

fn sampleVOld(i: u32, j: u32) -> f32 {
    // V previous grid
    if (i >= params.size_x || j >= params.size_y + 1u) {
        return 0.0;
    }
    return vGridPrev[j * params.size_x + i];
}