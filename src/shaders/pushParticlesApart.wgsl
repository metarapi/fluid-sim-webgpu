struct Particle {
    pos: vec2<f32>, // World-space position. Memory layout template
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

@group(0) @binding(0) var<storage, read> particlePosIn: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> particlePosOut: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> firstCellParticle: array<u32>;
@group(0) @binding(3) var<storage, read> cellParticleIds: array<u32>;
@group(0) @binding(4) var<uniform> params: SimParams;
@group(0) @binding(5) var terrainTexture: texture_2d<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pid = global_id.x;
  if (pid >= params.particle_count) { return; }
  


  // Dummy read from highres to avoid unused variable warning
  // let dummyN = highresNormals[0];
  // let dummyT = highresTerrain[0];
  // let dummyH = terrainParams.highres_terrain_count;

  let p1Pos = particlePosIn[pid];
  let cellX = u32(p1Pos.x * params.world_to_grid_x);
  let cellY = u32(p1Pos.y * params.world_to_grid_y);
  
  // Initialize accumulators (less global memory access)
  var accumulatedPushX = 0.0;
  var accumulatedPushY = 0.0;
  var pushCount = 0;

  // // Scale push factor by number of substeps (linear)
  // let pushScale = 1.0 / f32(params.num_substeps);

  // Scale push factor with exponential decay
  let baseScale = 1.5;                                      // Start with stronger push
  let decayRate = 0.5;                                    // Decay factor (0.5-0.8 works well)
  let substepFactor = f32(params.current_substep) / f32(params.num_substeps);
  let pushScale = baseScale * pow(decayRate, substepFactor * 4.0);
  
  // Check neighboring cells
  for (var i = -1; i <= 1; i++) {
    for (var j = -1; j <= 1; j++) {
      let nx = i32(cellX) + i;
      let ny = i32(cellY) + j;
      
      // Skip out-of-bounds cells
      if (nx < 0 || nx >= i32(params.size_x) || 
          ny < 0 || ny >= i32(params.size_y)) {
        continue;
      }
    
      let neighborCell = u32(ny) * params.size_x + u32(nx);

      let start = firstCellParticle[neighborCell];
      let end = firstCellParticle[neighborCell + 1];
      
      // Check particles in this cell
      for (var idx = start; idx < end; idx++) {
        let p2Id = cellParticleIds[idx];
        if (p2Id == pid) { continue; } // Skip self
        
        let p2Pos = particlePosIn[p2Id];
        let dx = p2Pos.x - p1Pos.x;
        let dy = p2Pos.y - p1Pos.y;
        let d2 = dx*dx + dy*dy;
        
        // if (d2 > params.min_dist2 || d2 < 0.000001) { continue; }
        if (d2 >= params.min_dist2 ) { continue; }

        let d = sqrt(d2);
        // let s = 0.5 * (params.min_dist - d) / d * pushScale;
        let s = 0.5 * (params.min_dist - d) / (d + 1e-8) * pushScale;
        let pushX = dx * s;
        let pushY = dy * s;
        
        accumulatedPushX -= pushX * 0.5;
        accumulatedPushY -= pushY * 0.5;

        pushCount += 1;
      }
    }
  }
  
  // Apply accumulated push once at the end
  var newPos = p1Pos;
  if (pushCount > 0) {
    // Cap maximum displacement for stability (optional, for robustness)
    let maxPushMag = params.min_dist * 1.0;
    let pushMag = sqrt(accumulatedPushX*accumulatedPushX + accumulatedPushY*accumulatedPushY);
    if (pushMag > maxPushMag) {
      let scaleFactor = maxPushMag / pushMag;
      accumulatedPushX *= scaleFactor;
      accumulatedPushY *= scaleFactor;
    }
    
    newPos.x += accumulatedPushX;
    newPos.y += accumulatedPushY;
  }
  
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

  }

  particlePosOut[pid] = newPos;
}
