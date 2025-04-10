struct Uniforms {
    worldSize: vec2<f32>,
    gridSize: vec2<f32>,
    cellSize: vec2<f32>,
    minMaxDensity: vec2<f32>, // x: min density, y: max density
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> densityGrid: array<f32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) density: f32,
};

@vertex
fn vertexMain(
    @location(0) position: vec2f,       // Quad vertex positions (0-1)
    @location(1) uv: vec2f,             // Texture coordinates
    @location(2) cellIdx: vec2<u32>     // Instance data (grid x,y)
) -> VertexOutput {
    var output: VertexOutput;
    
    // Calculate grid index
    let gridIndex = cellIdx.y * u32(uniforms.gridSize.x) + cellIdx.x;
    
    // Get cell density
    let density = densityGrid[gridIndex];
    output.density = density;
    
    // Scale to the proper cell size
    let scaledPos = position * uniforms.cellSize;
    
    // Convert cellIdx to float vector for math operations
    let cellIdxFloat = vec2f(f32(cellIdx.x), f32(cellIdx.y));
    
    // Offset to cell position - FIXED: Using float vector
    let worldPos = scaledPos + cellIdxFloat * uniforms.cellSize;
    
    // Convert to clip space
    let x = (worldPos.x / uniforms.worldSize.x) * 2.0 - 1.0;
    let y = (worldPos.y / uniforms.worldSize.y) * 2.0 - 1.0;
    
    output.position = vec4f(x, y, 0.0, 1.0);
    output.uv = uv;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Normalize the density to [0,1] range
    let minDensity = uniforms.minMaxDensity.x;
    let maxDensity = uniforms.minMaxDensity.y;
    let normalizedDensity = clamp((input.density - minDensity) / (maxDensity - minDensity), 0.0, 1.0);
    
    // Create a color gradient:
    // - Low density: dark blue to blue
    // - Medium density: blue to cyan to green
    // - High density: green to yellow to red
    
    var color: vec3f;
    
    if (normalizedDensity < 0.5) {
        // blue to cyan (0.0-0.5)
        let t = normalizedDensity * 2.0; // scale to 0-1
        color = mix(vec3f(0.0, 0.0, 0.5), vec3f(0.0, 1.0, 1.0), t);
    } else {
        // cyan to yellow to red (0.5-1.0)
        let t = (normalizedDensity - 0.5) * 2.0; // scale to 0-1
        if (t < 0.5) {
            // cyan to green to yellow
            color = mix(vec3f(0.0, 1.0, 1.0), vec3f(1.0, 1.0, 0.0), t * 2.0);
        } else {
            // yellow to red
            color = mix(vec3f(1.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), (t - 0.5) * 2.0);
        }
    }
    
    // Add a thin grid line at cell borders
    let cellBorder = 0.2;
    var edgeHighlight = 1.0;
    
    if (input.uv.x < cellBorder || input.uv.x > (1.0 - cellBorder) || 
        input.uv.y < cellBorder || input.uv.y > (1.0 - cellBorder)) {
        edgeHighlight = 0.7;
    }
    
    color = color * edgeHighlight;
    
    // Low-density cells should be more transparent
    let alpha = 0.1 + 0.9 * smoothstep(0.0, 0.4, normalizedDensity);
    
    return vec4f(color, alpha);
}