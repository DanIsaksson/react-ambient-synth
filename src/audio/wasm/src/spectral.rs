//! Spectral Processing
//! 
//! Implements spectral freeze, pitch shifting, and vocoder effects
//! using FFT-based analysis/resynthesis.
//!
//! # Spectral Freeze Algorithm
//! 1. Maintain FFT analysis of current frame
//! 2. When freeze_amount > 0:
//!    - Blend current spectrum with frozen spectrum
//!    - frozen_spec = lerp(current_spec, frozen_spec, freeze_amount)
//! 3. Apply frequency shift by rotating bins
//! 4. IFFT back to time domain
//!
//! # Phase Vocoder
//! Uses overlap-add with phase accumulation for artifact-free resynthesis.

use crate::memory;
use rustfft::{FftPlanner, num_complex::Complex};
use core::f32::consts::PI;
use core::ptr::addr_of_mut;

// ============================================================================
// CONSTANTS
// ============================================================================

/// FFT size for spectral analysis
const FFT_SIZE: usize = 2048;

/// Hop size (overlap factor of 4)
const HOP_SIZE: usize = FFT_SIZE / 4;

/// Number of frequency bins (FFT_SIZE / 2 + 1)
const NUM_BINS: usize = FFT_SIZE / 2 + 1;

// ============================================================================
// SPECTRAL STATE
// ============================================================================

/// Spectral processing state
struct SpectralState {
    /// FFT planner
    planner: FftPlanner<f32>,
    /// Input accumulation buffer
    input_buffer_l: Vec<f32>,
    input_buffer_r: Vec<f32>,
    /// Output overlap-add buffer
    output_buffer_l: Vec<f32>,
    output_buffer_r: Vec<f32>,
    /// Current position in input buffer
    input_pos: usize,
    /// FFT scratch buffers
    fft_buffer: Vec<Complex<f32>>,
    ifft_buffer: Vec<Complex<f32>>,
    /// Frozen spectrum (magnitude and phase)
    frozen_mag_l: Vec<f32>,
    frozen_mag_r: Vec<f32>,
    frozen_phase_l: Vec<f32>,
    frozen_phase_r: Vec<f32>,
    /// Previous phase for phase vocoder
    prev_phase_l: Vec<f32>,
    prev_phase_r: Vec<f32>,
    /// Phase accumulator for resynthesis
    synth_phase_l: Vec<f32>,
    synth_phase_r: Vec<f32>,
    /// Window function
    window: Vec<f32>,
    /// Freeze state (true when frozen)
    is_frozen: bool,
    /// Initialized flag
    initialized: bool,
}

/// Global spectral state
static mut STATE: Option<SpectralState> = None;

// ============================================================================
// INITIALIZATION
// ============================================================================

/// Ensure spectral state is initialized
fn ensure_state() -> &'static mut SpectralState {
    unsafe {
        // SAFETY: Single-threaded WASM context, using raw pointer for Rust 2024
        let state_ptr = addr_of_mut!(STATE);
        if (*state_ptr).is_none() {
            // Create Hann window
            let mut window = vec![0.0; FFT_SIZE];
            for i in 0..FFT_SIZE {
                window[i] = 0.5 - 0.5 * (2.0 * PI * i as f32 / FFT_SIZE as f32).cos();
            }
            
            *state_ptr = Some(SpectralState {
                planner: FftPlanner::new(),
                input_buffer_l: vec![0.0; FFT_SIZE],
                input_buffer_r: vec![0.0; FFT_SIZE],
                output_buffer_l: vec![0.0; FFT_SIZE * 2],
                output_buffer_r: vec![0.0; FFT_SIZE * 2],
                input_pos: 0,
                fft_buffer: vec![Complex::new(0.0, 0.0); FFT_SIZE],
                ifft_buffer: vec![Complex::new(0.0, 0.0); FFT_SIZE],
                frozen_mag_l: vec![0.0; NUM_BINS],
                frozen_mag_r: vec![0.0; NUM_BINS],
                frozen_phase_l: vec![0.0; NUM_BINS],
                frozen_phase_r: vec![0.0; NUM_BINS],
                prev_phase_l: vec![0.0; NUM_BINS],
                prev_phase_r: vec![0.0; NUM_BINS],
                synth_phase_l: vec![0.0; NUM_BINS],
                synth_phase_r: vec![0.0; NUM_BINS],
                window,
                is_frozen: false,
                initialized: true,
            });
        }
        (*state_ptr).as_mut().unwrap()
    }
}

// ============================================================================
// PROCESSING
// ============================================================================

/// Process spectral freeze/shift effect
/// 
/// # Arguments
/// * `freeze_amount` - Amount of spectral freeze (0 = none, 1 = full freeze)
/// * `shift` - Frequency shift in semitones (-24 to +24)
pub fn process(freeze_amount: f32, shift: f32) {
    let state = ensure_state();
    
    let freeze_amount = freeze_amount.clamp(0.0, 1.0);
    let shift = shift.clamp(-24.0, 24.0);
    
    // Calculate pitch shift ratio
    let shift_ratio = 2.0_f32.powf(shift / 12.0);
    
    unsafe {
        let buffer_size = memory::buffer_size() as usize;
        let input_l = memory::input_slice(0);
        let input_r = memory::input_slice(1);
        let output_l = memory::output_slice_mut(0);
        let output_r = memory::output_slice_mut(1);
        
        // Process sample by sample
        for i in 0..buffer_size {
            // Add input to buffer
            state.input_buffer_l[state.input_pos] = input_l[i];
            state.input_buffer_r[state.input_pos] = input_r[i];
            state.input_pos += 1;
            
            // Process when we have a full hop
            if state.input_pos >= HOP_SIZE {
                // Shift input buffer
                for j in 0..(FFT_SIZE - HOP_SIZE) {
                    state.input_buffer_l[j] = state.input_buffer_l[j + HOP_SIZE];
                    state.input_buffer_r[j] = state.input_buffer_r[j + HOP_SIZE];
                }
                state.input_pos = FFT_SIZE - HOP_SIZE;
                
                // Process left channel
                process_frame(
                    &state.input_buffer_l,
                    &mut state.output_buffer_l,
                    &mut state.fft_buffer,
                    &mut state.ifft_buffer,
                    &mut state.frozen_mag_l,
                    &mut state.frozen_phase_l,
                    &mut state.prev_phase_l,
                    &mut state.synth_phase_l,
                    &state.window,
                    freeze_amount,
                    shift_ratio,
                    &mut state.planner,
                    &mut state.is_frozen,
                );
                
                // Process right channel
                let mut is_frozen_dummy = state.is_frozen;
                process_frame(
                    &state.input_buffer_r,
                    &mut state.output_buffer_r,
                    &mut state.fft_buffer,
                    &mut state.ifft_buffer,
                    &mut state.frozen_mag_r,
                    &mut state.frozen_phase_r,
                    &mut state.prev_phase_r,
                    &mut state.synth_phase_r,
                    &state.window,
                    freeze_amount,
                    shift_ratio,
                    &mut state.planner,
                    &mut is_frozen_dummy,
                );
            }
            
            // Read from output buffer
            output_l[i] = state.output_buffer_l[i];
            output_r[i] = state.output_buffer_r[i];
        }
        
        // Shift output buffer
        for j in 0..(state.output_buffer_l.len() - buffer_size) {
            state.output_buffer_l[j] = state.output_buffer_l[j + buffer_size];
            state.output_buffer_r[j] = state.output_buffer_r[j + buffer_size];
        }
        for j in (state.output_buffer_l.len() - buffer_size)..state.output_buffer_l.len() {
            state.output_buffer_l[j] = 0.0;
            state.output_buffer_r[j] = 0.0;
        }
    }
}

/// Process one spectral frame
#[allow(clippy::too_many_arguments)]
fn process_frame(
    input: &[f32],
    output: &mut [f32],
    fft_buffer: &mut [Complex<f32>],
    ifft_buffer: &mut [Complex<f32>],
    frozen_mag: &mut [f32],
    frozen_phase: &mut [f32],
    prev_phase: &mut [f32],
    synth_phase: &mut [f32],
    window: &[f32],
    freeze_amount: f32,
    shift_ratio: f32,
    planner: &mut FftPlanner<f32>,
    is_frozen: &mut bool,
) {
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let ifft = planner.plan_fft_inverse(FFT_SIZE);
    
    // Apply window and copy to FFT buffer
    for i in 0..FFT_SIZE {
        fft_buffer[i] = Complex::new(input[i] * window[i], 0.0);
    }
    
    // FFT
    fft.process(fft_buffer);
    
    // Extract magnitude and phase
    let mut current_mag = vec![0.0f32; NUM_BINS];
    let mut current_phase = vec![0.0f32; NUM_BINS];
    
    for i in 0..NUM_BINS {
        let re = fft_buffer[i].re;
        let im = fft_buffer[i].im;
        current_mag[i] = (re * re + im * im).sqrt();
        current_phase[i] = im.atan2(re);
    }
    
    // Handle freeze
    if freeze_amount > 0.0 {
        if !*is_frozen {
            // Capture frozen spectrum
            frozen_mag.copy_from_slice(&current_mag);
            frozen_phase.copy_from_slice(&current_phase);
            *is_frozen = true;
        }
        
        // Blend current with frozen
        for i in 0..NUM_BINS {
            current_mag[i] = current_mag[i] * (1.0 - freeze_amount) + frozen_mag[i] * freeze_amount;
            // Keep phase evolving slightly for more natural sound
            current_phase[i] = current_phase[i] * (1.0 - freeze_amount * 0.9) 
                             + frozen_phase[i] * freeze_amount * 0.9;
        }
    } else {
        *is_frozen = false;
    }
    
    // Apply frequency shift
    let mut shifted_mag = vec![0.0f32; NUM_BINS];
    let mut shifted_phase = vec![0.0f32; NUM_BINS];
    
    if (shift_ratio - 1.0).abs() > 0.001 {
        // Shift bins
        for i in 0..NUM_BINS {
            let src_bin = i as f32 / shift_ratio;
            let src_bin_int = src_bin as usize;
            let frac = src_bin - src_bin_int as f32;
            
            if src_bin_int < NUM_BINS - 1 {
                // Linear interpolation
                shifted_mag[i] = current_mag[src_bin_int] * (1.0 - frac) 
                               + current_mag[src_bin_int + 1] * frac;
                
                // Phase interpolation (with unwrapping)
                let p1 = current_phase[src_bin_int];
                let p2 = current_phase[src_bin_int + 1];
                shifted_phase[i] = p1 + (p2 - p1) * frac;
            } else if src_bin_int < NUM_BINS {
                shifted_mag[i] = current_mag[src_bin_int];
                shifted_phase[i] = current_phase[src_bin_int];
            }
        }
    } else {
        shifted_mag.copy_from_slice(&current_mag);
        shifted_phase.copy_from_slice(&current_phase);
    }
    
    // Phase vocoder: accumulate phase
    let hop_phase = 2.0 * PI * HOP_SIZE as f32 / FFT_SIZE as f32;
    
    for i in 0..NUM_BINS {
        // Expected phase advance
        let expected_phase = prev_phase[i] + i as f32 * hop_phase;
        
        // Phase deviation
        let phase_diff = shifted_phase[i] - expected_phase;
        
        // Wrap to [-π, π]
        let wrapped = phase_diff - (phase_diff / (2.0 * PI)).round() * 2.0 * PI;
        
        // True frequency
        let true_freq = i as f32 + wrapped / hop_phase;
        
        // Accumulate synthesis phase
        synth_phase[i] += true_freq * hop_phase * shift_ratio;
        
        prev_phase[i] = shifted_phase[i];
    }
    
    // Reconstruct complex spectrum
    for i in 0..NUM_BINS {
        let mag = shifted_mag[i];
        let phase = synth_phase[i];
        ifft_buffer[i] = Complex::new(mag * phase.cos(), mag * phase.sin());
        
        // Mirror for negative frequencies
        if i > 0 && i < NUM_BINS - 1 {
            ifft_buffer[FFT_SIZE - i] = ifft_buffer[i].conj();
        }
    }
    
    // IFFT
    ifft.process(ifft_buffer);
    
    // Overlap-add with window
    let scale = 1.0 / FFT_SIZE as f32;
    for i in 0..FFT_SIZE {
        output[i] += ifft_buffer[i].re * window[i] * scale;
    }
}

// ============================================================================
// UTILITY
// ============================================================================

/// Reset spectral state
pub fn reset() {
    // SAFETY: Single-threaded WASM context
    let state_ptr = unsafe { addr_of_mut!(STATE) };
    if let Some(state) = unsafe { (*state_ptr).as_mut() } {
        state.input_buffer_l.fill(0.0);
        state.input_buffer_r.fill(0.0);
        state.output_buffer_l.fill(0.0);
        state.output_buffer_r.fill(0.0);
        state.frozen_mag_l.fill(0.0);
        state.frozen_mag_r.fill(0.0);
        state.frozen_phase_l.fill(0.0);
        state.frozen_phase_r.fill(0.0);
        state.prev_phase_l.fill(0.0);
        state.prev_phase_r.fill(0.0);
        state.synth_phase_l.fill(0.0);
        state.synth_phase_r.fill(0.0);
        state.input_pos = 0;
        state.is_frozen = false;
    }
}
