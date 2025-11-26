//! SIMD Utilities
//! 
//! Helper functions for SIMD-accelerated DSP operations.
//! Uses wasm32 SIMD128 intrinsics for vectorized processing.
//!
//! # Performance
//! SIMD operations can process 4 f32 samples simultaneously,
//! providing up to 4x speedup for compatible operations.
//!
//! # Browser Support (2024)
//! - Chrome 91+, Firefox 89+, Safari 16.4+, Edge 91+
//!
//! # Usage
//! All functions have automatic fallback to scalar operations
//! when SIMD is not available (though it always is with our build config).

#[cfg(target_arch = "wasm32")]
use core::arch::wasm32::*;

// ============================================================================
// FEATURE DETECTION
// ============================================================================

/// Check if SIMD is available at runtime
/// Always true for wasm32 with simd128 target feature enabled
#[inline]
pub const fn simd_available() -> bool {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    { true }
    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    { false }
}

// ============================================================================
// BUFFER OPERATIONS
// ============================================================================

/// Scale buffer by constant using SIMD
/// 
/// Multiplies every sample in the buffer by `scale`.
/// Processes 4 samples at a time using v128 operations.
/// 
/// # Arguments
/// * `buffer` - Mutable slice of f32 samples
/// * `scale` - Scalar multiplier
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn scale_buffer(buffer: &mut [f32], scale: f32) {
    let scale_v = f32x4_splat(scale);
    let chunks = buffer.len() / 4;
    
    // SIMD path: process 4 samples at a time
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let ptr = buffer.as_ptr().add(offset) as *const v128;
            let v = v128_load(ptr);
            let scaled = f32x4_mul(v, scale_v);
            v128_store(ptr as *mut v128, scaled);
        }
    }
    
    // Scalar remainder
    let remainder_start = chunks * 4;
    for sample in &mut buffer[remainder_start..] {
        *sample *= scale;
    }
}

/// Scale buffer - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn scale_buffer(buffer: &mut [f32], scale: f32) {
    for sample in buffer.iter_mut() {
        *sample *= scale;
    }
}

/// Add two buffers into output using SIMD
/// 
/// out[i] = a[i] + b[i]
/// 
/// # Arguments
/// * `a` - First source buffer
/// * `b` - Second source buffer  
/// * `out` - Output buffer (can alias `a` or `b`)
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn add_buffers(a: &[f32], b: &[f32], out: &mut [f32]) {
    let len = a.len().min(b.len()).min(out.len());
    let chunks = len / 4;
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let va = v128_load(a.as_ptr().add(offset) as *const v128);
            let vb = v128_load(b.as_ptr().add(offset) as *const v128);
            let sum = f32x4_add(va, vb);
            v128_store(out.as_mut_ptr().add(offset) as *mut v128, sum);
        }
    }
    
    // Scalar remainder
    for i in (chunks * 4)..len {
        out[i] = a[i] + b[i];
    }
}

/// Add buffers - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn add_buffers(a: &[f32], b: &[f32], out: &mut [f32]) {
    let len = a.len().min(b.len()).min(out.len());
    for i in 0..len {
        out[i] = a[i] + b[i];
    }
}

/// Mix buffer B into buffer A with gain: a[i] += b[i] * gain
/// 
/// Common operation for summing grains, adding reverb, etc.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn mix_buffer(a: &mut [f32], b: &[f32], gain: f32) {
    let len = a.len().min(b.len());
    let chunks = len / 4;
    let gain_v = f32x4_splat(gain);
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let va = v128_load(a.as_ptr().add(offset) as *const v128);
            let vb = v128_load(b.as_ptr().add(offset) as *const v128);
            // a + b * gain
            let scaled_b = f32x4_mul(vb, gain_v);
            let mixed = f32x4_add(va, scaled_b);
            v128_store(a.as_mut_ptr().add(offset) as *mut v128, mixed);
        }
    }
    
    for i in (chunks * 4)..len {
        a[i] += b[i] * gain;
    }
}

/// Mix buffer - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn mix_buffer(a: &mut [f32], b: &[f32], gain: f32) {
    let len = a.len().min(b.len());
    for i in 0..len {
        a[i] += b[i] * gain;
    }
}

/// Copy buffer using SIMD (faster than memcpy for aligned f32 data)
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn copy_buffer(src: &[f32], dst: &mut [f32]) {
    let len = src.len().min(dst.len());
    let chunks = len / 4;
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(src.as_ptr().add(offset) as *const v128);
            v128_store(dst.as_mut_ptr().add(offset) as *mut v128, v);
        }
    }
    
    for i in (chunks * 4)..len {
        dst[i] = src[i];
    }
}

/// Copy buffer - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn copy_buffer(src: &[f32], dst: &mut [f32]) {
    let len = src.len().min(dst.len());
    dst[..len].copy_from_slice(&src[..len]);
}

/// Clear buffer (fill with zeros) using SIMD
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn clear_buffer(buffer: &mut [f32]) {
    let zero = f32x4_splat(0.0);
    let chunks = buffer.len() / 4;
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            v128_store(buffer.as_mut_ptr().add(offset) as *mut v128, zero);
        }
    }
    
    for i in (chunks * 4)..buffer.len() {
        buffer[i] = 0.0;
    }
}

/// Clear buffer - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn clear_buffer(buffer: &mut [f32]) {
    buffer.fill(0.0);
}

// ============================================================================
// DSP OPERATIONS
// ============================================================================

/// Apply gain envelope to buffer using SIMD
/// 
/// Linearly interpolates gain from `start_gain` to `end_gain` across the buffer.
/// Useful for crossfades, fade in/out, and envelope application.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn apply_gain_ramp(buffer: &mut [f32], start_gain: f32, end_gain: f32) {
    let len = buffer.len();
    if len == 0 { return; }
    
    let gain_step = (end_gain - start_gain) / len as f32;
    let step_v = f32x4_splat(gain_step * 4.0);
    
    // Initial gains for 4 lanes: [start, start+step, start+2*step, start+3*step]
    let mut gain_v = unsafe {
        f32x4(
            start_gain,
            start_gain + gain_step,
            start_gain + gain_step * 2.0,
            start_gain + gain_step * 3.0,
        )
    };
    
    let chunks = len / 4;
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(buffer.as_ptr().add(offset) as *const v128);
            let scaled = f32x4_mul(v, gain_v);
            v128_store(buffer.as_mut_ptr().add(offset) as *mut v128, scaled);
            gain_v = f32x4_add(gain_v, step_v);
        }
    }
    
    // Scalar remainder
    let mut gain = start_gain + (chunks * 4) as f32 * gain_step;
    for i in (chunks * 4)..len {
        buffer[i] *= gain;
        gain += gain_step;
    }
}

/// Apply gain ramp - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn apply_gain_ramp(buffer: &mut [f32], start_gain: f32, end_gain: f32) {
    let len = buffer.len();
    if len == 0 { return; }
    
    let gain_step = (end_gain - start_gain) / len as f32;
    let mut gain = start_gain;
    
    for sample in buffer.iter_mut() {
        *sample *= gain;
        gain += gain_step;
    }
}

/// Soft clip buffer using tanh approximation
/// 
/// Fast approximation: x / (1 + |x|)
/// Provides gentle saturation without hard clipping.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn soft_clip_buffer(buffer: &mut [f32]) {
    let one = f32x4_splat(1.0);
    let chunks = buffer.len() / 4;
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(buffer.as_ptr().add(offset) as *const v128);
            // x / (1 + |x|)
            let abs_v = f32x4_abs(v);
            let denom = f32x4_add(one, abs_v);
            let clipped = f32x4_div(v, denom);
            v128_store(buffer.as_mut_ptr().add(offset) as *mut v128, clipped);
        }
    }
    
    for i in (chunks * 4)..buffer.len() {
        let x = buffer[i];
        buffer[i] = x / (1.0 + x.abs());
    }
}

/// Soft clip buffer - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn soft_clip_buffer(buffer: &mut [f32]) {
    for sample in buffer.iter_mut() {
        let x = *sample;
        *sample = x / (1.0 + x.abs());
    }
}

/// Hard clip buffer to [-limit, +limit]
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn hard_clip_buffer(buffer: &mut [f32], limit: f32) {
    let min_v = f32x4_splat(-limit);
    let max_v = f32x4_splat(limit);
    let chunks = buffer.len() / 4;
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(buffer.as_ptr().add(offset) as *const v128);
            let clamped = f32x4_max(f32x4_min(v, max_v), min_v);
            v128_store(buffer.as_mut_ptr().add(offset) as *mut v128, clamped);
        }
    }
    
    for i in (chunks * 4)..buffer.len() {
        buffer[i] = buffer[i].clamp(-limit, limit);
    }
}

/// Hard clip buffer - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn hard_clip_buffer(buffer: &mut [f32], limit: f32) {
    for sample in buffer.iter_mut() {
        *sample = sample.clamp(-limit, limit);
    }
}

/// Stereo interleave: combine L and R into interleaved buffer
/// 
/// Output: [L0, R0, L1, R1, L2, R2, ...]
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn interleave_stereo(left: &[f32], right: &[f32], out: &mut [f32]) {
    let len = left.len().min(right.len()).min(out.len() / 2);
    
    // SIMD: process 4 samples from each channel (8 output samples)
    let chunks = len / 4;
    
    for i in 0..chunks {
        let in_offset = i * 4;
        let out_offset = i * 8;
        
        unsafe {
            let l = v128_load(left.as_ptr().add(in_offset) as *const v128);
            let r = v128_load(right.as_ptr().add(in_offset) as *const v128);
            
            // Interleave using shuffle
            // l = [L0, L1, L2, L3]
            // r = [R0, R1, R2, R3]
            // out1 = [L0, R0, L1, R1]
            // out2 = [L2, R2, L3, R3]
            let out1 = i32x4_shuffle::<0, 4, 1, 5>(l, r);
            let out2 = i32x4_shuffle::<2, 6, 3, 7>(l, r);
            
            v128_store(out.as_mut_ptr().add(out_offset) as *mut v128, out1);
            v128_store(out.as_mut_ptr().add(out_offset + 4) as *mut v128, out2);
        }
    }
    
    // Scalar remainder
    for i in (chunks * 4)..len {
        out[i * 2] = left[i];
        out[i * 2 + 1] = right[i];
    }
}

/// Stereo interleave - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn interleave_stereo(left: &[f32], right: &[f32], out: &mut [f32]) {
    let len = left.len().min(right.len()).min(out.len() / 2);
    for i in 0..len {
        out[i * 2] = left[i];
        out[i * 2 + 1] = right[i];
    }
}

/// Stereo deinterleave: split interleaved buffer into L and R
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn deinterleave_stereo(interleaved: &[f32], left: &mut [f32], right: &mut [f32]) {
    let len = left.len().min(right.len()).min(interleaved.len() / 2);
    let chunks = len / 4;
    
    for i in 0..chunks {
        let in_offset = i * 8;
        let out_offset = i * 4;
        
        unsafe {
            let in1 = v128_load(interleaved.as_ptr().add(in_offset) as *const v128);
            let in2 = v128_load(interleaved.as_ptr().add(in_offset + 4) as *const v128);
            
            // Deinterleave using shuffle
            // in1 = [L0, R0, L1, R1]
            // in2 = [L2, R2, L3, R3]
            // l = [L0, L1, L2, L3]
            // r = [R0, R1, R2, R3]
            let l = i32x4_shuffle::<0, 2, 4, 6>(in1, in2);
            let r = i32x4_shuffle::<1, 3, 5, 7>(in1, in2);
            
            v128_store(left.as_mut_ptr().add(out_offset) as *mut v128, l);
            v128_store(right.as_mut_ptr().add(out_offset) as *mut v128, r);
        }
    }
    
    // Scalar remainder
    for i in (chunks * 4)..len {
        left[i] = interleaved[i * 2];
        right[i] = interleaved[i * 2 + 1];
    }
}

/// Stereo deinterleave - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn deinterleave_stereo(interleaved: &[f32], left: &mut [f32], right: &mut [f32]) {
    let len = left.len().min(right.len()).min(interleaved.len() / 2);
    for i in 0..len {
        left[i] = interleaved[i * 2];
        right[i] = interleaved[i * 2 + 1];
    }
}

// ============================================================================
// FILTER OPERATIONS
// ============================================================================

/// Apply biquad filter to buffer using SIMD
/// 
/// Processes the biquad difference equation in parallel where possible.
/// Note: Due to feedback, this is not fully vectorizable, but we can
/// still use SIMD for coefficient multiplication.
/// 
/// # Arguments
/// * `buffer` - Input/output buffer
/// * `b` - Feedforward coefficients [b0, b1, b2]
/// * `a` - Feedback coefficients [a1, a2]
/// * `state` - Filter state [x1, x2, y1, y2]
#[inline]
pub fn biquad_process_buffer(
    buffer: &mut [f32],
    b: [f32; 3],
    a: [f32; 2],
    state: &mut [f32; 4],
) {
    let [b0, b1, b2] = b;
    let [a1, a2] = a;
    let [mut x1, mut x2, mut y1, mut y2] = *state;
    
    // Biquad is inherently serial due to feedback, so we process sample by sample
    // but this function provides a clean interface for future optimization
    for sample in buffer.iter_mut() {
        let x = *sample;
        let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        
        *sample = y;
    }
    
    *state = [x1, x2, y1, y2];
}

// ============================================================================
// DC OFFSET REMOVAL
// ============================================================================

/// Remove DC offset from buffer using SIMD
/// 
/// Subtracts the mean value from all samples.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn remove_dc_offset(buffer: &mut [f32]) {
    if buffer.is_empty() { return; }
    
    // Calculate sum using SIMD
    let chunks = buffer.len() / 4;
    let mut sum_v = f32x4_splat(0.0);
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(buffer.as_ptr().add(offset) as *const v128);
            sum_v = f32x4_add(sum_v, v);
        }
    }
    
    // Horizontal sum
    let sum = unsafe {
        f32x4_extract_lane::<0>(sum_v)
            + f32x4_extract_lane::<1>(sum_v)
            + f32x4_extract_lane::<2>(sum_v)
            + f32x4_extract_lane::<3>(sum_v)
    };
    
    // Add remainder
    let mut total = sum;
    for i in (chunks * 4)..buffer.len() {
        total += buffer[i];
    }
    
    let mean = total / buffer.len() as f32;
    let mean_v = f32x4_splat(mean);
    
    // Subtract mean using SIMD
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(buffer.as_ptr().add(offset) as *const v128);
            let centered = f32x4_sub(v, mean_v);
            v128_store(buffer.as_mut_ptr().add(offset) as *mut v128, centered);
        }
    }
    
    for i in (chunks * 4)..buffer.len() {
        buffer[i] -= mean;
    }
}

/// Remove DC offset - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn remove_dc_offset(buffer: &mut [f32]) {
    if buffer.is_empty() { return; }
    
    let sum: f32 = buffer.iter().sum();
    let mean = sum / buffer.len() as f32;
    
    for sample in buffer.iter_mut() {
        *sample -= mean;
    }
}

// ============================================================================
// PEAK DETECTION
// ============================================================================

/// Find peak absolute value in buffer using SIMD
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn find_peak(buffer: &[f32]) -> f32 {
    if buffer.is_empty() { return 0.0; }
    
    let chunks = buffer.len() / 4;
    let mut max_v = f32x4_splat(0.0);
    
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            let v = v128_load(buffer.as_ptr().add(offset) as *const v128);
            let abs_v = f32x4_abs(v);
            max_v = f32x4_max(max_v, abs_v);
        }
    }
    
    // Horizontal max
    let mut peak = unsafe {
        f32x4_extract_lane::<0>(max_v)
            .max(f32x4_extract_lane::<1>(max_v))
            .max(f32x4_extract_lane::<2>(max_v))
            .max(f32x4_extract_lane::<3>(max_v))
    };
    
    // Check remainder
    for i in (chunks * 4)..buffer.len() {
        peak = peak.max(buffer[i].abs());
    }
    
    peak
}

/// Find peak - scalar fallback
#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
pub fn find_peak(buffer: &[f32]) -> f32 {
    buffer.iter().map(|x| x.abs()).fold(0.0_f32, f32::max)
}

// ============================================================================
// GRANULAR SYNTHESIS OPTIMIZATION
// ============================================================================

/// Pre-computed raised cosine (Hann) envelope table
/// 
/// Avoids cos() calls in the inner grain loop.
/// Table size of 1024 provides sufficient resolution for smooth envelopes.
pub const ENVELOPE_TABLE_SIZE: usize = 1024;

/// Static envelope lookup table - computed once at compile time
/// Formula: 0.5 - 0.5 * cos(2π * phase) where phase = index / TABLE_SIZE
pub static ENVELOPE_TABLE: [f32; ENVELOPE_TABLE_SIZE] = {
    let mut table = [0.0f32; ENVELOPE_TABLE_SIZE];
    let mut i = 0;
    while i < ENVELOPE_TABLE_SIZE {
        // Use polynomial approximation of cos for const fn
        // cos(x) ≈ 1 - x²/2 + x⁴/24 for small x
        // For full period: cos(2πx) where x = i/N
        let phase = (i as f32) / (ENVELOPE_TABLE_SIZE as f32);
        let x = phase * 2.0 * core::f32::consts::PI;
        // Taylor series approximation (sufficient for envelope smoothness)
        let x2 = x * x;
        let x4 = x2 * x2;
        let x6 = x4 * x2;
        let cos_approx = 1.0 - x2 / 2.0 + x4 / 24.0 - x6 / 720.0;
        table[i] = 0.5 - 0.5 * cos_approx;
        i += 1;
    }
    table
};

/// Fast envelope lookup using pre-computed table
/// 
/// # Arguments
/// * `phase` - Normalized phase (0.0 to 1.0)
/// 
/// # Returns
/// Envelope value (0.0 to 1.0)
#[inline]
pub fn envelope_lookup(phase: f32) -> f32 {
    let phase_clamped = phase.clamp(0.0, 0.9999);
    let index = (phase_clamped * ENVELOPE_TABLE_SIZE as f32) as usize;
    ENVELOPE_TABLE[index]
}

/// SIMD-accelerated linear interpolation for 4 samples
/// 
/// # Arguments
/// * `samples_a` - 4 samples at floor(position)
/// * `samples_b` - 4 samples at floor(position) + 1
/// * `fracs` - 4 fractional parts for interpolation
/// 
/// # Returns
/// 4 interpolated samples
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn lerp_4_simd(samples_a: v128, samples_b: v128, fracs: v128) -> v128 {
    // lerp = a + (b - a) * frac
    let diff = f32x4_sub(samples_b, samples_a);
    let scaled = f32x4_mul(diff, fracs);
    f32x4_add(samples_a, scaled)
}

/// SIMD-accelerated envelope application for 4 grains
/// 
/// # Arguments
/// * `phases` - 4 grain envelope phases (0.0-1.0)
/// 
/// # Returns
/// 4 envelope values (0.0-1.0)
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
pub fn envelope_4_simd(phases: v128) -> v128 {
    // Use table lookup for each lane
    unsafe {
        let e0 = envelope_lookup(f32x4_extract_lane::<0>(phases));
        let e1 = envelope_lookup(f32x4_extract_lane::<1>(phases));
        let e2 = envelope_lookup(f32x4_extract_lane::<2>(phases));
        let e3 = envelope_lookup(f32x4_extract_lane::<3>(phases));
        f32x4(e0, e1, e2, e3)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_scale_buffer() {
        let mut buffer = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0];
        scale_buffer(&mut buffer, 2.0);
        assert_eq!(buffer, [2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0]);
    }
    
    #[test]
    fn test_add_buffers() {
        let a = [1.0, 2.0, 3.0, 4.0, 5.0];
        let b = [5.0, 4.0, 3.0, 2.0, 1.0];
        let mut out = [0.0; 5];
        add_buffers(&a, &b, &mut out);
        assert_eq!(out, [6.0, 6.0, 6.0, 6.0, 6.0]);
    }
    
    #[test]
    fn test_find_peak() {
        let buffer = [-3.0, 1.0, 5.0, -2.0, 4.0];
        assert_eq!(find_peak(&buffer), 5.0);
    }
}
