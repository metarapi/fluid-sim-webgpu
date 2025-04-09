struct Uniforms {
    worldSize: vec2<f32>,
    particleSize: f32,
    particleCount: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) color: vec4f,
};

@vertex
fn vertexMain(
    @location(0) quadPosition: vec2f,  // Quad vertex positions
    @location(1) particle: vec2f       // Instance data (x, y)
) -> VertexOutput {
    var output: VertexOutput;
    
    // Default color for water particles
    output.color = vec4f(0.2, 0.4, 0.8, 0.8);
    
    // Convert particle world position to clip space
    let worldPos = quadPosition * uniforms.particleSize*1.0 + particle;
    let x = (worldPos.x / uniforms.worldSize.x) * 2.0 - 1.0;
    let y = (worldPos.y / uniforms.worldSize.y) * 2.0 - 1.0;
    
    output.position = vec4f(x, y, 0.0, 1.0);
    output.uv = quadPosition + 0.5;  // UV from [0,0] to [1,1]
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Calculate distance from center to create circle
    let distFromCenter = length(input.uv - 0.5) * 2.0;
    
    // Soft circle with gradient edge
    let alpha = 1.0 - smoothstep(0.8, 1.0, distFromCenter);
    if (alpha < 0.01) {
        discard;
    }
    
    return vec4f(input.color.rgb, alpha * input.color.a);
}