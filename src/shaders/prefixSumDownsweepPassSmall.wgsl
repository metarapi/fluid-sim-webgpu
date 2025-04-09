@group(0) @binding(0) var<storage,read> outputBuffer2: array<u32>; // From pass 2
@group(0) @binding(1) var<storage,read_write> outputBuffer1: array<u32>; // To update

const WG_SIZE: u32 = 256;

@compute @workgroup_size(WG_SIZE)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx: u32 = global_id.x;
    
    // Early exit if out of range
    if (idx >= arrayLength(&outputBuffer1)) {
        return;
    }
    
    // Calculate region indices
    let i = idx / WG_SIZE;
    
    // Get local value from current region
    let localValue = outputBuffer1[idx];
    
    // Add offsets from previous regions (only level-1)
    var offset: u32 = 0u;
    if (i > 0u && (i % (WG_SIZE)) != 0u) { 
        if (i - 1u < arrayLength(&outputBuffer2)) {
            offset = outputBuffer2[i - 1u];
        }
    }
    
    outputBuffer1[idx] = localValue + offset;
}