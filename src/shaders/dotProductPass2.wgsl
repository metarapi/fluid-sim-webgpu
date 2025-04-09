@group(0) @binding(0) var<storage, read> partialSumsIn: array<f32>;
@group(0) @binding(1) var<storage, read_write> finalSum: f32;

const WG_SIZE: u32 = 256;  // Single workgroup with 256 threads
var<workgroup> localSums: array<f32, WG_SIZE>;

@compute @workgroup_size(WG_SIZE)
fn main(
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let tid = local_id.x;
    var sum: f32 = 0.0;
    
    // Each thread processes 16 elements
    let base_idx = tid * 16;
    
    // Sum 16 consecutive elements from the partial sums
    if (base_idx < arrayLength(&partialSumsIn)) {
        for (var i: u32 = 0; i < 16; i++) {
            if (base_idx + i < arrayLength(&partialSumsIn)) {
                sum += partialSumsIn[base_idx + i];
            }
        }
    }

    localSums[tid] = sum;
    workgroupBarrier();

    // Reduction for 32 threads
    if tid < 128 { localSums[tid] += localSums[tid + 128]; } workgroupBarrier();
    if tid < 64 { localSums[tid] += localSums[tid + 64]; } workgroupBarrier();
    if tid < 32 { localSums[tid] += localSums[tid + 32]; } workgroupBarrier();
    if tid < 16 { localSums[tid] += localSums[tid + 16]; } workgroupBarrier();
    if tid < 8 { localSums[tid] += localSums[tid + 8]; } workgroupBarrier();
    if tid < 4 { localSums[tid] += localSums[tid + 4]; } workgroupBarrier();
    if tid < 2 { localSums[tid] += localSums[tid + 2]; } workgroupBarrier();
    if tid < 1 { localSums[tid] += localSums[tid + 1]; } workgroupBarrier();

    if (tid == 0) {
        finalSum = localSums[0];
    }
}