@group(0) @binding(0) var<storage,read> inputBuffer1: array<f32>;
@group(0) @binding(1) var<storage,read> inputBuffer2: array<f32>;
@group(0) @binding(2) var<storage,read_write> partialSums: array<f32>;
@group(0) @binding(3) var<uniform> vectorLength: u32;

const WG_SIZE: u32 = 256;
const GRID_SIZE: u32 = 16;
var<workgroup> sdata: array<f32, WG_SIZE>;


@compute @workgroup_size(WG_SIZE)
fn main(
    @builtin(workgroup_id) gid: vec3<u32>, 
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let tid = local_id.x;
    let global_id = gid.x * WG_SIZE + tid;
    let idx = global_id * GRID_SIZE;
    var sum: f32 = 0.0;

    // Process 16 elements per iteration
    if (idx + 15 < vectorLength) {
    // Process all 16 elements at once using vec4
        let vec1_a = vec4<f32>(
            inputBuffer1[idx],
            inputBuffer1[idx+1],
            inputBuffer1[idx+2],
            inputBuffer1[idx+3]
        );
        let vec1_b = vec4<f32>(
            inputBuffer1[idx+4],
            inputBuffer1[idx+5],
            inputBuffer1[idx+6],
            inputBuffer1[idx+7]
        );
        let vec1_c = vec4<f32>(
            inputBuffer1[idx+8],
            inputBuffer1[idx+9],
            inputBuffer1[idx+10],
            inputBuffer1[idx+11]
        );
        let vec1_d = vec4<f32>(
            inputBuffer1[idx+12],
            inputBuffer1[idx+13],
            inputBuffer1[idx+14],
            inputBuffer1[idx+15]
        );

        // Load 16 elements as four vec4s from second buffer
        let vec2_a = vec4<f32>(
            inputBuffer2[idx],
            inputBuffer2[idx+1],
            inputBuffer2[idx+2],
            inputBuffer2[idx+3]
        );
        let vec2_b = vec4<f32>(
            inputBuffer2[idx+4],
            inputBuffer2[idx+5],
            inputBuffer2[idx+6],
            inputBuffer2[idx+7]
        );
        let vec2_c = vec4<f32>(
            inputBuffer2[idx+8],
            inputBuffer2[idx+9],
            inputBuffer2[idx+10],
            inputBuffer2[idx+11]
        );
        let vec2_d = vec4<f32>(
            inputBuffer2[idx+12],
            inputBuffer2[idx+13],
            inputBuffer2[idx+14],
            inputBuffer2[idx+15]
        );

        // Compute dot products and accumulate
        sum += dot(vec1_a, vec2_a) + dot(vec1_b, vec2_b) +
            dot(vec1_c, vec2_c) + dot(vec1_d, vec2_d);
    }
    

    sdata[tid] = sum;
    workgroupBarrier();

    // Unrolled reduction - doesn't use warp level optimizaton
    if tid < 128 { sdata[tid] += sdata[tid + 128]; } workgroupBarrier();
    if tid < 64 { sdata[tid] += sdata[tid + 64]; } workgroupBarrier();
    if tid < 32 { sdata[tid] += sdata[tid + 32]; } workgroupBarrier();
    if tid < 16 { sdata[tid] += sdata[tid + 16]; } workgroupBarrier();
    if tid < 8 { sdata[tid] += sdata[tid + 8]; } workgroupBarrier();
    if tid < 4 { sdata[tid] += sdata[tid + 4]; } workgroupBarrier();
    if tid < 2 { sdata[tid] += sdata[tid + 2]; } workgroupBarrier();
    if tid < 1 { sdata[tid] += sdata[tid + 1]; } workgroupBarrier();

    if tid == 0 {
    partialSums[gid.x] = sdata[0];
}
}