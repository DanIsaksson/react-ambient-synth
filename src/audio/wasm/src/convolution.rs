//! FFT-based Convolution Reverb
//! 
//! Implements partitioned convolution for real-time impulse response processing.
//! Uses overlap-add method with FFT for efficient computation.
//!
//! # Algorithm: Overlap-Add FFT Convolution
//! 1. Pre-compute: FFT of IR, store frequency domain representation
//! 2. Per block:
//!    a. FFT input block (zero-padded to 2x size)
//!    b. Complex multiply with IR spectrum
//!    c. IFFT result
//!    d. Overlap-add with previous tail
//!
//! # Partitioned Convolution
//! For long IRs, the IR is split into partitions to reduce latency.
//! Each partition is the same size as the input block.
//!
//! # Note on Memory
//! This module uses Vec for FFT buffers since rustfft requires heap allocation.
//! The buffers are allocated once during load_ir and reused.

use crate::memory;
use crate::simd_utils;
use rustfft::{FftPlanner, num_complex::Complex};
use core::ptr::addr_of_mut;

// ============================================================================
// CONSTANTS
// ============================================================================

/// FFT size (must be power of 2, at least 2x block size for linear convolution)
const FFT_SIZE: usize = 512;

/// Maximum IR length in samples (affects memory usage)
const MAX_IR_SAMPLES: usize = 48000 * 5; // 5 seconds @ 48kHz

/// Maximum number of IR partitions
const MAX_PARTITIONS: usize = MAX_IR_SAMPLES / (FFT_SIZE / 2);

// ============================================================================
// CONVOLUTION STATE
// ============================================================================

/// FFT-based convolution reverb state
struct ConvolutionState {
    /// FFT planner (cached)
    planner: FftPlanner<f32>,
    /// IR partitions in frequency domain (complex)
    ir_partitions: Vec<Vec<Complex<f32>>>,
    /// Number of active IR partitions
    num_partitions: usize,
    /// Input buffer (accumulates samples until FFT_SIZE/2)
    input_buffer_l: Vec<f32>,
    input_buffer_r: Vec<f32>,
    /// Position in input buffer
    input_pos: usize,
    /// Overlap-add buffer (FFT_SIZE samples per channel)
    overlap_l: Vec<f32>,
    overlap_r: Vec<f32>,
    /// FFT scratch buffers
    fft_input: Vec<Complex<f32>>,
    fft_output: Vec<Complex<f32>>,
    fft_temp: Vec<Complex<f32>>,
    /// Frequency-domain accumulator for partition convolution
    fdl_l: Vec<Vec<Complex<f32>>>,
    fdl_r: Vec<Vec<Complex<f32>>>,
    /// Current FDL position
    fdl_pos: usize,
    /// IR loaded flag
    ir_loaded: bool,
}

/// Global convolution state
static mut STATE: Option<ConvolutionState> = None;

// ============================================================================
// INITIALIZATION
// ============================================================================

/// Initialize convolution state (called once)
fn ensure_state() -> &'static mut ConvolutionState {
    unsafe {
        // SAFETY: Single-threaded WASM context, using raw pointer for Rust 2024
        let state_ptr = addr_of_mut!(STATE);
        if (*state_ptr).is_none() {
            *state_ptr = Some(ConvolutionState {
                planner: FftPlanner::new(),
                ir_partitions: Vec::new(),
                num_partitions: 0,
                input_buffer_l: vec![0.0; FFT_SIZE / 2],
                input_buffer_r: vec![0.0; FFT_SIZE / 2],
                input_pos: 0,
                overlap_l: vec![0.0; FFT_SIZE],
                overlap_r: vec![0.0; FFT_SIZE],
                fft_input: vec![Complex::new(0.0, 0.0); FFT_SIZE],
                fft_output: vec![Complex::new(0.0, 0.0); FFT_SIZE],
                fft_temp: vec![Complex::new(0.0, 0.0); FFT_SIZE],
                fdl_l: Vec::new(),
                fdl_r: Vec::new(),
                fdl_pos: 0,
                ir_loaded: false,
            });
        }
        (*state_ptr).as_mut().unwrap()
    }
}

// ============================================================================
// IR LOADING
// ============================================================================

/// Load impulse response for convolution
/// 
/// # Arguments
/// * `_ptr` - Pointer (not used, samples are at IR_OFFSET)
/// * `length` - Number of sample frames
/// * `channels` - Number of channels (1 or 2)
/// 
/// # Note
/// The actual samples are written to WASM memory by JavaScript at
/// IR_OFFSET before calling this function.
pub fn load_ir(_ptr: *const f32, length: u32, channels: u32) {
    let state = ensure_state();
    
    let ir_samples = unsafe {
        std::slice::from_raw_parts(
            memory::IR_OFFSET as *const f32,
            (length * channels) as usize
        )
    };
    
    let block_size = FFT_SIZE / 2;
    let num_partitions = ((length as usize) + block_size - 1) / block_size;
    let num_partitions = num_partitions.min(MAX_PARTITIONS);
    
    // Pre-compute FFT of each IR partition
    state.ir_partitions.clear();
    state.ir_partitions.reserve(num_partitions);
    
    let fft = state.planner.plan_fft_forward(FFT_SIZE);
    
    for p in 0..num_partitions {
        let start = p * block_size;
        let mut partition = vec![Complex::new(0.0, 0.0); FFT_SIZE];
        
        // Copy IR samples to partition (zero-pad rest)
        for i in 0..block_size {
            let idx = start + i;
            if idx < length as usize {
                let sample = if channels == 2 {
                    // Average stereo to mono for IR
                    (ir_samples[idx * 2] + ir_samples[idx * 2 + 1]) * 0.5
                } else {
                    ir_samples[idx]
                };
                partition[i] = Complex::new(sample, 0.0);
            }
        }
        
        // FFT the partition
        fft.process(&mut partition);
        state.ir_partitions.push(partition);
    }
    
    state.num_partitions = num_partitions;
    
    // Initialize frequency-domain delay lines
    state.fdl_l.clear();
    state.fdl_r.clear();
    for _ in 0..num_partitions {
        state.fdl_l.push(vec![Complex::new(0.0, 0.0); FFT_SIZE]);
        state.fdl_r.push(vec![Complex::new(0.0, 0.0); FFT_SIZE]);
    }
    state.fdl_pos = 0;
    
    // Clear overlap buffers
    state.overlap_l.fill(0.0);
    state.overlap_r.fill(0.0);
    state.input_pos = 0;
    
    state.ir_loaded = true;
    
    unsafe {
        memory::set_ir_len(length);
    }
}

// ============================================================================
// PROCESSING
// ============================================================================

/// Process convolution reverb
/// 
/// # Arguments
/// * `dry_wet` - Mix between dry (0) and wet (1) signal
pub fn process(dry_wet: f32) {
    let state = ensure_state();
    
    if !state.ir_loaded || state.num_partitions == 0 {
        // No IR loaded - pass through dry signal using SIMD
        unsafe {
            let input_l = memory::input_slice(0);
            let input_r = memory::input_slice(1);
            let output_l = memory::output_slice_mut(0);
            let output_r = memory::output_slice_mut(1);
            
            simd_utils::copy_buffer(input_l, output_l);
            simd_utils::copy_buffer(input_r, output_r);
        }
        return;
    }
    
    let dry_wet = dry_wet.clamp(0.0, 1.0);
    let dry = 1.0 - dry_wet;
    let wet = dry_wet;
    
    unsafe {
        let buffer_size = memory::buffer_size() as usize;
        let input_l = memory::input_slice(0);
        let input_r = memory::input_slice(1);
        let output_l = memory::output_slice_mut(0);
        let output_r = memory::output_slice_mut(1);
        
        let block_size = FFT_SIZE / 2;
        
        // Process samples in chunks
        let mut sample_idx = 0;
        while sample_idx < buffer_size {
            // Fill input buffer
            while state.input_pos < block_size && sample_idx < buffer_size {
                state.input_buffer_l[state.input_pos] = input_l[sample_idx];
                state.input_buffer_r[state.input_pos] = input_r[sample_idx];
                state.input_pos += 1;
                sample_idx += 1;
            }
            
            // Process when input buffer is full
            if state.input_pos >= block_size {
                process_block(state);
                state.input_pos = 0;
            }
        }
        
        // Read output from overlap buffer
        for i in 0..buffer_size {
            let wet_l = state.overlap_l[i];
            let wet_r = state.overlap_r[i];
            
            output_l[i] = input_l[i] * dry + wet_l * wet;
            output_r[i] = input_r[i] * dry + wet_r * wet;
        }
        
        // Shift overlap buffer
        let shift = buffer_size;
        for i in 0..(FFT_SIZE - shift) {
            state.overlap_l[i] = state.overlap_l[i + shift];
            state.overlap_r[i] = state.overlap_r[i + shift];
        }
        for i in (FFT_SIZE - shift)..FFT_SIZE {
            state.overlap_l[i] = 0.0;
            state.overlap_r[i] = 0.0;
        }
    }
}

/// Process one block of FFT convolution
fn process_block(state: &mut ConvolutionState) {
    let block_size = FFT_SIZE / 2;
    let fft = state.planner.plan_fft_forward(FFT_SIZE);
    let ifft = state.planner.plan_fft_inverse(FFT_SIZE);
    
    // Process left channel
    process_channel_block(
        &state.input_buffer_l,
        &state.ir_partitions,
        &mut state.fdl_l,
        state.fdl_pos,
        state.num_partitions,
        &mut state.fft_input,
        &mut state.fft_output,
        &mut state.fft_temp,
        &mut state.overlap_l,
        &*fft,
        &*ifft,
        block_size,
    );
    
    // Process right channel
    process_channel_block(
        &state.input_buffer_r,
        &state.ir_partitions,
        &mut state.fdl_r,
        state.fdl_pos,
        state.num_partitions,
        &mut state.fft_input,
        &mut state.fft_output,
        &mut state.fft_temp,
        &mut state.overlap_r,
        &*fft,
        &*ifft,
        block_size,
    );
    
    // Advance FDL position
    state.fdl_pos = (state.fdl_pos + 1) % state.num_partitions;
}

/// Process one channel block
#[allow(clippy::too_many_arguments)]
fn process_channel_block(
    input: &[f32],
    ir_partitions: &[Vec<Complex<f32>>],
    fdl: &mut [Vec<Complex<f32>>],
    fdl_pos: usize,
    num_partitions: usize,
    fft_input: &mut [Complex<f32>],
    fft_output: &mut [Complex<f32>],
    fft_temp: &mut [Complex<f32>],
    overlap: &mut [f32],
    fft: &dyn rustfft::Fft<f32>,
    ifft: &dyn rustfft::Fft<f32>,
    block_size: usize,
) {
    // Prepare input: copy to fft_input, zero-pad
    for i in 0..FFT_SIZE {
        fft_input[i] = if i < block_size {
            Complex::new(input[i], 0.0)
        } else {
            Complex::new(0.0, 0.0)
        };
    }
    
    // FFT input
    fft.process(fft_input);
    
    // Store in FDL at current position
    fdl[fdl_pos].copy_from_slice(fft_input);
    
    // Clear accumulator
    for c in fft_output.iter_mut() {
        *c = Complex::new(0.0, 0.0);
    }
    
    // Convolve: sum over all partitions
    for p in 0..num_partitions {
        let fdl_idx = (fdl_pos + num_partitions - p) % num_partitions;
        let ir = &ir_partitions[p];
        let input_spectrum = &fdl[fdl_idx];
        
        // Complex multiply and accumulate
        for i in 0..FFT_SIZE {
            fft_output[i] += input_spectrum[i] * ir[i];
        }
    }
    
    // IFFT
    fft_temp.copy_from_slice(fft_output);
    ifft.process(fft_temp);
    
    // Normalize and overlap-add
    let scale = 1.0 / FFT_SIZE as f32;
    for i in 0..FFT_SIZE {
        overlap[i] += fft_temp[i].re * scale;
    }
}

// ============================================================================
// UTILITY
// ============================================================================

/// Reset convolution state
pub fn reset() {
    // SAFETY: Single-threaded WASM context
    let state_ptr = unsafe { addr_of_mut!(STATE) };
    if let Some(state) = unsafe { (*state_ptr).as_mut() } {
        state.overlap_l.fill(0.0);
        state.overlap_r.fill(0.0);
        for fdl in &mut state.fdl_l {
            fdl.fill(Complex::new(0.0, 0.0));
        }
        for fdl in &mut state.fdl_r {
            fdl.fill(Complex::new(0.0, 0.0));
        }
        state.input_pos = 0;
        state.fdl_pos = 0;
    }
}
