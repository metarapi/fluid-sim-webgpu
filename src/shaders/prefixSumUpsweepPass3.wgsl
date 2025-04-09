@group(0) @binding(0) var<storage,read> inputBuffer: array<u32>;
@group(0) @binding(1) var<storage,read_write> outputBuffer: array<u32>;

const WG_SIZE: u32 = 32;
var<workgroup> sdata: array<u32, WG_SIZE>;

@compute @workgroup_size(WG_SIZE)
fn main(@builtin(workgroup_id) gid: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
    let tid: u32 = local_id.x;
    let value = inputBuffer[tid];
    sdata[tid] = value;
    workgroupBarrier();

    // Perform prefix sum within the workgroup
    for (var i: u32 = 1; i < WG_SIZE; i *= 2) {
        if (tid >= i) {
            sdata[tid] += sdata[tid - i];
        }
        workgroupBarrier();
    }

    outputBuffer[tid] = sdata[tid];
}