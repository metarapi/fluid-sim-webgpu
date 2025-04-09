struct TerrainParams {
    // Original terrain info
    terrain_count: u32,       
    
    // High-resolution terrain info
    highres_terrain_count: u32,    
    highres_terrain_factor: f32,    
    
    // Reserved for future extensions
    padding1: u32,
    padding2: u32,
    padding3: u32,
    padding4: u32,
    padding5: u32,
}

@group(0) @binding(0) var<storage, read> highresTerrain: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> highresNormals: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: TerrainParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= params.highres_terrain_count) { return; }
  
  // For endpoints, use one-sided differences
  if (idx == 0) {
    // Forward difference for start point
    let p0 = highresTerrain[0];
    let p1 = highresTerrain[1];
    let dx = p1.x - p0.x;
    let dy = p1.y - p0.y;
    let len = sqrt(dx*dx + dy*dy);
    // Normal is perpendicular to tangent (-dy, dx)
    highresNormals[idx] = vec2<f32>(-dy/len, dx/len);
  } else if (idx == params.highres_terrain_count - 1u) {
    // Backward difference for end point
    let p0 = highresTerrain[params.highres_terrain_count - 2u];
    let p1 = highresTerrain[params.highres_terrain_count - 1u];
    let dx = p1.x - p0.x;
    let dy = p1.y - p0.y;
    let len = sqrt(dx*dx + dy*dy);
    // Normal is perpendicular to tangent (-dy, dx)
    highresNormals[idx] = vec2<f32>(-dy/len, dx/len);
  } else {
    // Central difference for interior points
    let p0 = highresTerrain[idx - 1u];
    let p1 = highresTerrain[idx + 1u];
    let dx = p1.x - p0.x;
    let dy = p1.y - p0.y;
    let len = sqrt(dx*dx + dy*dy);
    // Normal is perpendicular to tangent (-dy, dx)
    highresNormals[idx] = vec2<f32>(-dy/len, dx/len);
  }
  
  // Ensure normal points upward (y component is positive)
  if (highresNormals[idx].y < 0.0) {
    highresNormals[idx] = -highresNormals[idx];
  }
}