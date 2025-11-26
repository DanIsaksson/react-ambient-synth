//! DSP Core - WebAssembly Module for Ambient Flow
//! 
//! This module provides high-performance audio processing functions
//! callable from JavaScript AudioWorkletProcessor.
//!
//! # Memory Model
//! All audio buffers are pre-allocated in WASM linear memory.
//! JavaScript writes input samples directly to memory, calls process
//! functions, then reads output samples.
//!
//! # Thread Safety
//! This module is NOT thread-safe. It's designed for single-threaded
//! use within an AudioWorkletProcessor.
//!
//! # Note on no_std
//! This module currently uses std for compatibility with stable Rust.
//! A future optimization pass can convert to no_std with a custom allocator
//! for reduced binary size (~20% smaller).

#![allow(clippy::missing_safety_doc)]

mod granular;
mod convolution;
mod spectral;
mod oscillators;
mod filters;
mod envelopes;
mod delay;
mod simd_utils;
mod memory;
mod utils;

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/// Initialize the DSP engine with the given sample rate and buffer size
/// 
/// # Arguments
/// * `sample_rate` - Audio sample rate (e.g., 44100, 48000)
/// * `buffer_size` - Number of samples per process block (e.g., 128, 256)
/// 
/// # Returns
/// Pointer to allocated state struct, or 0 on failure
#[no_mangle]
pub extern "C" fn dsp_init(sample_rate: f32, buffer_size: u32) -> u32 {
    memory::init_engine(sample_rate, buffer_size)
}

/// Get pointer to input buffer for writing samples from JavaScript
/// 
/// # Arguments
/// * `channel` - Channel index (0 = left, 1 = right)
/// 
/// # Returns
/// Pointer to f32 buffer of length `buffer_size`
#[no_mangle]
pub extern "C" fn dsp_get_input_ptr(channel: u32) -> *mut f32 {
    memory::get_input_buffer(channel)
}

/// Get pointer to output buffer for reading samples from JavaScript
/// 
/// # Arguments
/// * `channel` - Channel index (0 = left, 1 = right)
/// 
/// # Returns
/// Pointer to f32 buffer of length `buffer_size`
#[no_mangle]
pub extern "C" fn dsp_get_output_ptr(channel: u32) -> *const f32 {
    memory::get_output_buffer(channel)
}

/// Process granular synthesis
/// 
/// # Arguments
/// * `grain_size` - Grain size in samples (64-4096)
/// * `density` - Grains per second (1-100)
/// * `pitch_spread` - Random pitch variation (0-1)
/// * `position` - Playback position in source (0-1)
/// * `spray` - Position randomization (0-1)
#[no_mangle]
pub extern "C" fn dsp_process_granular(
    grain_size: u32,
    density: f32,
    pitch_spread: f32,
    position: f32,
    spray: f32,
) {
    granular::process(grain_size, density, pitch_spread, position, spray);
}

/// Process convolution reverb
/// 
/// # Arguments
/// * `dry_wet` - Dry/wet mix (0 = dry, 1 = wet)
#[no_mangle]
pub extern "C" fn dsp_process_convolution(dry_wet: f32) {
    convolution::process(dry_wet);
}

/// Process spectral freeze
/// 
/// # Arguments
/// * `freeze_amount` - Amount of spectral freeze (0-1)
/// * `shift` - Frequency shift in semitones (-24 to +24)
#[no_mangle]
pub extern "C" fn dsp_process_spectral(freeze_amount: f32, shift: f32) {
    spectral::process(freeze_amount, shift);
}

/// Load impulse response for convolution
/// 
/// # Arguments
/// * `ir_ptr` - Pointer to IR sample data
/// * `ir_length` - Number of samples in IR
/// * `ir_channels` - Number of channels (1 or 2)
#[no_mangle]
pub extern "C" fn dsp_load_ir(ir_ptr: *const f32, ir_length: u32, ir_channels: u32) {
    convolution::load_ir(ir_ptr, ir_length, ir_channels);
}

/// Load source buffer for granular synthesis
/// 
/// # Arguments
/// * `source_ptr` - Pointer to source sample data
/// * `source_length` - Number of samples
/// * `source_channels` - Number of channels (1 or 2)
#[no_mangle]
pub extern "C" fn dsp_load_granular_source(
    source_ptr: *const f32,
    source_length: u32,
    source_channels: u32,
) {
    granular::load_source(source_ptr, source_length, source_channels);
}

/// Free all allocated memory (call on AudioWorklet disposal)
#[no_mangle]
pub extern "C" fn dsp_cleanup() {
    memory::cleanup();
}
