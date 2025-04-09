@group(0) @binding(0) var<storage,read> inputBuffer: array<u32>;
@group(0) @binding(1) var<storage,read_write> outputBuffer: array<u32>;
@group(0) @binding(2) var<storage,read_write> intermediateBuffer: array<u32>;

const WG_SIZE: u32 = 256;
var<workgroup> sdata: array<vec4u, WG_SIZE>;

@compute @workgroup_size(WG_SIZE)
fn main(@builtin(workgroup_id) gid: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
    var tid: u32 = local_id.x;

    var gOff: u32 = gid.x * WG_SIZE * 4;
    sdata[tid] = vec4u(
        inputBuffer[gOff + tid],
        inputBuffer[gOff + tid + WG_SIZE],
        inputBuffer[gOff + tid + 2 * WG_SIZE],
        inputBuffer[gOff + tid + 3 * WG_SIZE],
    );
    workgroupBarrier();

    if (tid & 1)  != 0 { sdata[tid] += sdata[tid - 1]; } workgroupBarrier();
    if (tid & 2)  != 0 { sdata[tid] += sdata[(tid & 254) - 1]; } workgroupBarrier();
    if (tid & 4)  != 0 { sdata[tid] += sdata[(tid & 252) - 1]; } workgroupBarrier();
    if (tid & 8)  != 0 { sdata[tid] += sdata[(tid & 248) - 1]; } workgroupBarrier();
    if (tid & 16) != 0 { sdata[tid] += sdata[(tid & 240) - 1]; } workgroupBarrier();
    if (tid & 32) != 0 { sdata[tid] += sdata[(tid & 224) - 1]; } workgroupBarrier();
    if (tid & 64) != 0 { sdata[tid] += sdata[(tid & 192) - 1]; } workgroupBarrier();
    if (tid & 128) != 0 { sdata[tid] += sdata[(tid & 128) - 1]; } workgroupBarrier();

    let val = sdata[tid];

    outputBuffer[gOff + tid] = val.x;
    outputBuffer[gOff + tid + WG_SIZE] = val.y;
    outputBuffer[gOff + tid + 2 * WG_SIZE] = val.z;
    outputBuffer[gOff + tid + 3 * WG_SIZE] = val.w;

    if (tid == WG_SIZE - 1) {
        let base = 4u * gid.x;
        intermediateBuffer[base + 0] = val.x;
        intermediateBuffer[base + 1] = val.y;
        intermediateBuffer[base + 2] = val.z;
        intermediateBuffer[base + 3] = val.w;
    }
}