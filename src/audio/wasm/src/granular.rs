//! Granular Synthesis Engine
//! 
//! Implements real-time granular synthesis with:
//! - Variable grain size (64-4096 samples)
//! - Density control (grains per second)
//! - Pitch spreading with random variation
//! - Position spray for texture variation
//! - Raised cosine envelope for smooth grain transitions
//!
//! # Algorithm
//! 1. Maintain pool of N grains (max 100)
//! 2. Each grain tracks: position, phase, rate, amplitude
//! 3. Per audio block:
//!    - Spawn new grains based on density
//!    - Sum active grains with envelope
//!    - Remove finished grains
//!
//! # Zero-Allocation Design
//! All grain state is pre-allocated in static arrays.
//! No heap allocation occurs during process().

use crate::memory;
use crate::simd_utils;
use core::f32::consts::PI;

// ============================================================================
// CONSTANTS
// ============================================================================

/// Maximum number of simultaneous grains
const MAX_GRAINS: usize = 100;

/// Minimum grain size in samples
const MIN_GRAIN_SIZE: u32 = 64;

/// Maximum grain size in samples
const MAX_GRAIN_SIZE: u32 = 4096;

// ============================================================================
// GRAIN STATE
// ============================================================================

/// Represents a single grain of audio
/// 
/// # Memory Layout
/// Packed struct to minimize cache misses when iterating grains.
#[derive(Clone, Copy)]
struct Grain {
    /// Whether this grain slot is in use
    active: bool,
    /// Normalized position in source buffer (0.0 - 1.0)
    source_pos: f32,
    /// Envelope phase (0.0 - 1.0, grain complete when >= 1.0)
    phase: f32,
    /// Playback rate (1.0 = normal, 2.0 = octave up, 0.5 = octave down)
    rate: f32,
    /// Grain amplitude (0.0 - 1.0)
    amp: f32,
    /// Grain duration in samples
    size_samples: u32,
    /// Pan position (-1.0 = left, 0.0 = center, 1.0 = right)
    pan: f32,
}

impl Default for Grain {
    fn default() -> Self {
        Self {
            active: false,
            source_pos: 0.0,
            phase: 0.0,
            rate: 1.0,
            amp: 1.0,
            size_samples: 256,
            pan: 0.0,
        }
    }
}

// ============================================================================
// GLOBAL STATE (Pre-allocated)
// ============================================================================

/// Pre-allocated grain pool - no runtime allocation
static mut GRAINS: [Grain; MAX_GRAINS] = [Grain {
    active: false,
    source_pos: 0.0,
    phase: 0.0,
    rate: 1.0,
    amp: 1.0,
    size_samples: 256,
    pan: 0.0,
}; MAX_GRAINS];

/// Random number generator state (LCG for determinism and speed)
static mut RNG_STATE: u32 = 12345;

/// Length of loaded source in samples (interleaved)
static mut SOURCE_LEN: usize = 0;

/// Number of channels in source (1 or 2)
static mut SOURCE_CHANNELS: u32 = 1;

/// Accumulator for grain spawn timing
static mut SPAWN_ACCUMULATOR: f32 = 0.0;

// ============================================================================
// RANDOM NUMBER GENERATION
// ============================================================================

/// Fast LCG random number generator
/// Returns value in range [0.0, 1.0)
#[inline]
unsafe fn random_f32() -> f32 {
    // Linear Congruential Generator (Numerical Recipes parameters)
    RNG_STATE = RNG_STATE.wrapping_mul(1664525).wrapping_add(1013904223);
    // Convert to float in [0, 1)
    (RNG_STATE as f32) / (u32::MAX as f32)
}

/// Random value in range [-1.0, 1.0)
#[inline]
unsafe fn random_bipolar() -> f32 {
    random_f32() * 2.0 - 1.0
}

// ============================================================================
// ENVELOPE
// ============================================================================

/// Raised cosine (Hann) envelope
/// Provides smooth attack and release with no discontinuities.
/// 
/// # Arguments
/// * `phase` - Envelope phase (0.0 to 1.0)
/// 
/// # Returns
/// Envelope amplitude (0.0 to 1.0)
#[inline]
fn envelope(phase: f32) -> f32 {
    // Raised cosine: 0.5 - 0.5 * cos(2π * phase)
    // At phase=0: env=0, phase=0.5: env=1, phase=1: env=0
    0.5 - 0.5 * (phase * PI * 2.0).cos()
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/// Process one audio block through granular synthesis
/// 
/// # Arguments
/// * `grain_size` - Grain duration in samples (64-4096)
/// * `density` - Grains spawned per second (1-100)
/// * `pitch_spread` - Random pitch variation amount (0-1)
/// * `position` - Base playback position in source (0-1)
/// * `spray` - Position randomization amount (0-1)
/// 
/// # Safety
/// Reads from WASM linear memory at GRANULAR_SOURCE_OFFSET.
/// Writes to output buffers via memory module.
pub fn process(
    grain_size: u32,
    density: f32,
    pitch_spread: f32,
    position: f32,
    spray: f32,
) {
    unsafe {
        // Early exit if no source loaded
        if SOURCE_LEN == 0 {
            // Clear output buffers using SIMD
            let output_l = memory::output_slice_mut(0);
            let output_r = memory::output_slice_mut(1);
            simd_utils::clear_buffer(output_l);
            simd_utils::clear_buffer(output_r);
            return;
        }
        
        let buffer_size = memory::buffer_size() as usize;
        let sample_rate = memory::sample_rate();
        
        // Clamp parameters to valid ranges
        let grain_size = grain_size.clamp(MIN_GRAIN_SIZE, MAX_GRAIN_SIZE);
        let density = density.clamp(1.0, 100.0);
        let pitch_spread = pitch_spread.clamp(0.0, 1.0);
        let position = position.clamp(0.0, 1.0);
        let spray = spray.clamp(0.0, 1.0);
        
        // Get output buffer slices
        let output_l = memory::output_slice_mut(0);
        let output_r = memory::output_slice_mut(1);
        
        // Clear output buffers using SIMD
        simd_utils::clear_buffer(output_l);
        simd_utils::clear_buffer(output_r);
        
        // Get source buffer
        let source = get_source_slice();
        let source_frames = SOURCE_LEN / SOURCE_CHANNELS as usize;
        
        // Calculate spawn interval (samples between grains)
        let spawn_interval = sample_rate / density;
        
        // Process each sample in the block
        for sample_idx in 0..buffer_size {
            // ================================================================
            // GRAIN SPAWNING
            // ================================================================
            
            SPAWN_ACCUMULATOR += 1.0;
            
            if SPAWN_ACCUMULATOR >= spawn_interval {
                SPAWN_ACCUMULATOR -= spawn_interval;
                
                // Find an inactive grain slot
                for grain in GRAINS.iter_mut() {
                    if !grain.active {
                        // Calculate randomized position
                        let pos_offset = random_bipolar() * spray;
                        let grain_pos = (position + pos_offset).clamp(0.0, 1.0);
                        
                        // Calculate randomized pitch
                        // pitch_spread of 1.0 = ±1 octave
                        let pitch_offset = random_bipolar() * pitch_spread;
                        let grain_rate = 2.0_f32.powf(pitch_offset);
                        
                        // Random pan position
                        let grain_pan = random_bipolar() * 0.7; // ±70% pan spread
                        
                        // Random amplitude variation (80-100%)
                        let grain_amp = 0.8 + random_f32() * 0.2;
                        
                        // Initialize grain
                        grain.active = true;
                        grain.source_pos = grain_pos;
                        grain.phase = 0.0;
                        grain.rate = grain_rate;
                        grain.amp = grain_amp;
                        grain.size_samples = grain_size;
                        grain.pan = grain_pan;
                        
                        break; // Only spawn one grain per interval
                    }
                }
            }
            
            // ================================================================
            // GRAIN PROCESSING
            // ================================================================
            
            for grain in GRAINS.iter_mut() {
                if !grain.active {
                    continue;
                }
                
                // Calculate source position in samples
                let source_sample_pos = grain.source_pos * source_frames as f32;
                let source_idx = source_sample_pos as usize;
                
                // Read sample from source with linear interpolation
                let sample = if source_idx < source_frames - 1 {
                    let frac = source_sample_pos - source_idx as f32;
                    
                    if SOURCE_CHANNELS == 2 {
                        // Stereo source: average L+R for mono grain
                        let idx = source_idx * 2;
                        let s0 = (source[idx] + source[idx + 1]) * 0.5;
                        let s1 = (source[idx + 2] + source[idx + 3]) * 0.5;
                        s0 + (s1 - s0) * frac
                    } else {
                        // Mono source
                        let s0 = source[source_idx];
                        let s1 = source[source_idx + 1];
                        s0 + (s1 - s0) * frac
                    }
                } else {
                    0.0
                };
                
                // Apply envelope
                let env = envelope(grain.phase);
                let out = sample * env * grain.amp;
                
                // Apply stereo pan (constant power)
                // pan: -1 = left, 0 = center, 1 = right
                let pan_norm = (grain.pan + 1.0) * 0.5; // 0 to 1
                let left_gain = (1.0 - pan_norm).sqrt();
                let right_gain = pan_norm.sqrt();
                
                output_l[sample_idx] += out * left_gain;
                output_r[sample_idx] += out * right_gain;
                
                // Advance grain playback position
                // rate affects how fast we move through source
                grain.source_pos += grain.rate / source_frames as f32;
                
                // Advance envelope phase
                grain.phase += 1.0 / grain.size_samples as f32;
                
                // Deactivate finished grains
                if grain.phase >= 1.0 || grain.source_pos >= 1.0 {
                    grain.active = false;
                }
            }
        }
        
        // Apply output gain to prevent clipping from overlapping grains
        // Normalize by approximate number of overlapping grains
        let overlap_estimate = (density * grain_size as f32 / sample_rate).max(1.0);
        let output_gain = 1.0 / overlap_estimate.sqrt();
        
        // Apply output gain using SIMD
        simd_utils::scale_buffer(output_l, output_gain);
        simd_utils::scale_buffer(output_r, output_gain);
    }
}

// ============================================================================
// SOURCE LOADING
// ============================================================================

/// Load source audio buffer for granular synthesis
/// 
/// # Arguments
/// * `ptr` - Pointer to source samples in WASM memory (not used directly,
///           samples are at GRANULAR_SOURCE_OFFSET)
/// * `length` - Number of sample frames
/// * `channels` - Number of channels (1 or 2)
/// 
/// # Note
/// The actual samples are written to WASM memory by JavaScript at
/// GRANULAR_SOURCE_OFFSET before calling this function.
pub fn load_source(_ptr: *const f32, length: u32, channels: u32) {
    unsafe {
        // Store metadata about the loaded source
        SOURCE_LEN = (length * channels) as usize;
        SOURCE_CHANNELS = channels.clamp(1, 2);
        
        // Reset all grains when loading new source
        for grain in GRAINS.iter_mut() {
            grain.active = false;
        }
        
        // Reset spawn accumulator
        SPAWN_ACCUMULATOR = 0.0;
        
        // Update engine state flags
        memory::set_granular_source_len(length);
    }
}

/// Get a slice reference to the granular source buffer
/// 
/// # Safety
/// Source must be loaded (SOURCE_LEN > 0)
#[inline]
unsafe fn get_source_slice() -> &'static [f32] {
    std::slice::from_raw_parts(
        memory::GRANULAR_SOURCE_OFFSET as *const f32,
        SOURCE_LEN
    )
}

// ============================================================================
// UTILITY
// ============================================================================

/// Reset granular engine state
/// Called when switching effects or stopping playback
pub fn reset() {
    unsafe {
        for grain in GRAINS.iter_mut() {
            grain.active = false;
        }
        SPAWN_ACCUMULATOR = 0.0;
    }
}
