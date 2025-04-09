@group(0) @binding(0) var<storage,read> outputBuffer2: array<u32>; // From pass 2
@group(0) @binding(1) var<storage,read> outputBuffer3: array<u32>; // From pass 3
@group(0) @binding(2) var<storage,read_write> outputBuffer1: array<u32>; // To update

const WG_SIZE: u32 = 256;
const WG_SIZE2: u32 = 256 * 256; // 65536

// @compute @workgroup_size(WG_SIZE)
// fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
//     let idx: u32 = global_id.x;
//     let i = idx / WG_SIZE;
//     let j = idx / WG_SIZE2;
    
//     // Get local value from current region
//     let localValue = outputBuffer1[idx];
    
//     // Add offsets from previous regions
//     var offset1: u32 = 0u;
//     if (i > 0u && (i % (WG_SIZE)) != 0u) { // Don't add level-2 offset at region boundaries!
//         offset1 = outputBuffer2[i - 1u];
//     }
    
//     var offset2: u32 = 0u;
//     if (j > 0u) {
//         offset2 = outputBuffer3[j - 1u];
//     }
    
//     outputBuffer1[idx] = localValue + offset1 + offset2;
// }

@compute @workgroup_size(WG_SIZE)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx: u32 = global_id.x;
    
    // Early exit if out of range
    if (idx >= arrayLength(&outputBuffer1)) {
        return;
    }
    
    // Calculate region indices safely
    let i = idx / WG_SIZE;
    let j = idx / WG_SIZE2;
    
    // Get local value from current region
    let localValue = outputBuffer1[idx];
    
    // Add offsets from previous regions
    var offset1: u32 = 0u;
    if (i > 0u && (i % (WG_SIZE)) != 0u) { // Don't add level-2 offset at region boundaries!
        if (i - 1u < arrayLength(&outputBuffer2)) {
            offset1 = outputBuffer2[i - 1u];
        }
    }
    
    var offset2: u32 = 0u;
    if (j > 0u) {
        if (j - 1u < arrayLength(&outputBuffer3)) {
            offset2 = outputBuffer3[j - 1u];
        }
    }
    
    outputBuffer1[idx] = localValue + offset1 + offset2;
}