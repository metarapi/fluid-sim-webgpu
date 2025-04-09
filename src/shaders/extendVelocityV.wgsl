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

@group(0) @binding(0) var<storage, read_write> vGrid: array<f32>;
@group(0) @binding(1) var<storage, read_write> vGridMask: array<u32>;
@group(0) @binding(2) var<uniform> params: SimParams;

// Kernel for extending V velocities
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pid = global_id.x;
    if (pid >= params.size_x * (params.size_y + 1)) { return; }
    
    // 1. Check if this node already has direct contributions
    if (vGridMask[pid] != 0u) { return; }
    
    // Get grid coordinates
    let i = pid % params.size_x;
    let j = pid / params.size_x;
    
    // 2. Check if any neighbor has been written to
    var hasContributingNeighbor = false;
    
    // Search pattern: try immediate sides first, then diagonals
    let offsets = array<vec2<i32>, 8>(
        vec2<i32>(0, -1),  // Down
        vec2<i32>(0, 1),   // Up
        vec2<i32>(-1, 0),  // Left
        vec2<i32>(1, 0),   // Right
        vec2<i32>(-1, -1), // Down-Left
        vec2<i32>(-1, 1),  // Up-Left
        vec2<i32>(1, -1),  // Down-Right
        vec2<i32>(1, 1)    // Up-Right
    );
    
    // 3. Check if any neighbor has been written to (has mask == 1)
    for (var k = 0u; k < 8u; k++) {
        let ni = i32(i) + offsets[k].x;
        let nj = i32(j) + offsets[k].y;
        
        // Check bounds
        if (ni < 0 || ni >= i32(params.size_x) || 
            nj < 0 || nj >= i32(params.size_y + 1)) {
            continue;
        }
        
        // Get neighbor index
        let nIdx = u32(ni) + u32(nj) * params.size_x;
        
        // Check if this neighbor has velocity data
        if (vGridMask[nIdx] != 0u) {
            hasContributingNeighbor = true;
            break;
        }
    }
    
    // If no neighbors have velocity data, skip this node
    if (!hasContributingNeighbor) { return; }
    
    // 4 & 5. Accumulate velocities from grid nodes that have data
    var accumVel: f32 = 0.0;
    var validCount: u32 = 0u;
    
    for (var k = 0u; k < 8u; k++) {
        let ni = i32(i) + offsets[k].x;
        let nj = i32(j) + offsets[k].y;
        
        // Check bounds
        if (ni < 0 || ni >= i32(params.size_x) || 
            nj < 0 || nj >= i32(params.size_y + 1)) {
            continue;
        }
        
        // Get neighbor index
        let nIdx = u32(ni) + u32(nj) * params.size_x;
        
        // Skip if the neighbor isn't a valid source
        if (vGridMask[nIdx] == 0u) {
            continue;
        }
        
        // Get weight based on search pattern
        var weight: f32 = 1.0;
        if (k >= 4u) {
            weight = 0.7071; // 1/sqrt(2) for diagonals
        }
        
        // Accumulate weighted velocity
        accumVel += vGrid[nIdx] * weight;
        validCount += 1u;
    }
    
    // 6. Write the velocity if we have valid neighbors
    if (validCount > 0u) {
        vGrid[pid] = accumVel / f32(validCount);
        // Mark this node as having valid data for next pass
        vGridMask[pid] = 2u; // 2 indicates extended velocity (vs 1 for original particle contribution)
    }
}