@group(0) @binding(0) var<storage, read> partialMaxIn: array<f32>;
@group(0) @binding(1) var<storage, read_write> finalMax: f32;

const WG_SIZE: u32 = 256;  // Single workgroup with 256 threads
var<workgroup> localMaxValues: array<f32, WG_SIZE>;

@compute @workgroup_size(WG_SIZE)
fn main(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var current_max: f32 = 0.0;
  
  // Each thread processes multiple partial maximums
  for (var i: u32 = tid; i < arrayLength(&partialMaxIn); i += WG_SIZE) {
    current_max = max(current_max, partialMaxIn[i]);
  }
  
  // Store thread's maximum in workgroup memory
  localMaxValues[tid] = current_max;
  workgroupBarrier();
  
  // Parallel reduction to find maximum
  if tid < 128 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 128]); } workgroupBarrier();
  if tid < 64 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 64]); } workgroupBarrier();
  if tid < 32 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 32]); } workgroupBarrier();
  if tid < 16 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 16]); } workgroupBarrier();
  if tid < 8 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 8]); } workgroupBarrier();
  if tid < 4 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 4]); } workgroupBarrier();
  if tid < 2 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 2]); } workgroupBarrier();
  if tid < 1 { localMaxValues[tid] = max(localMaxValues[tid], localMaxValues[tid + 1]); } workgroupBarrier();
  
  // Thread 0 writes final result
  if (tid == 0) {
    finalMax = localMaxValues[0];
  }
}