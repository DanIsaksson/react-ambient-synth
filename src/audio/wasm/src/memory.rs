//! Memory Management Module
//! 
//! # Design Principles
//! 1. All buffers allocated at init time
//! 2. Fixed offsets for JS interop
//! 3. No runtime allocation in audio path
//!
//! # Memory Layout
//! ```text
//! 0x0000: Engine State (256 bytes)
//! 0x0100: Input Buffer L (512 samples = 2KB)
//! 0x0300: Input Buffer R (512 samples = 2KB)
//! 0x0500: Output Buffer L (512 samples = 2KB)
//! 0x0700: Output Buffer R (512 samples = 2KB)
//! 0x0900: Work Buffer 1 (512 samples = 2KB)
//! 0x1100: Work Buffer 2 (512 samples = 2KB)
//! 0x1900: Granular Source Buffer (up to 3.5MB)
//! 0x380000: IR Buffer (up to 1.9MB)
//! 0x560000: FFT Buffers
//! ```

use std::ptr;
use core::ptr::{addr_of, addr_of_mut};

// ============================================================================
// MEMORY LAYOUT CONSTANTS
// ============================================================================

/// Offset for engine state struct
pub const STATE_OFFSET: usize = 0x0000;
/// Size of engine state struct
pub const STATE_SIZE: usize = 256;

/// Offset for input buffer left channel
pub const INPUT_L_OFFSET: usize = 0x0100;
/// Offset for input buffer right channel
pub const INPUT_R_OFFSET: usize = 0x0300;
/// Offset for output buffer left channel  
pub const OUTPUT_L_OFFSET: usize = 0x0500;
/// Offset for output buffer right channel
pub const OUTPUT_R_OFFSET: usize = 0x0700;

/// Maximum buffer size in samples
pub const MAX_BUFFER_SIZE: usize = 512;
/// Buffer size in bytes (f32 = 4 bytes)
pub const BUFFER_BYTES: usize = MAX_BUFFER_SIZE * 4;

/// Offset for work buffers
pub const WORK1_OFFSET: usize = 0x0900;
pub const WORK2_OFFSET: usize = 0x1100;
pub const WORK_BUFFER_SIZE: usize = 512;

/// Offset for granular source buffer
pub const GRANULAR_SOURCE_OFFSET: usize = 0x1900;
/// Maximum granular source: 10 seconds @ 44.1kHz stereo
pub const MAX_GRANULAR_SOURCE_SAMPLES: usize = 44100 * 10 * 2;

/// Offset for impulse response buffer
pub const IR_OFFSET: usize = 0x380000;
/// Maximum IR: 5 seconds @ 48kHz stereo
pub const MAX_IR_SAMPLES: usize = 48000 * 5 * 2;

/// Offset for FFT buffers
pub const FFT_OFFSET: usize = 0x560000;
/// FFT size
pub const FFT_SIZE: usize = 4096;

// ============================================================================
// ENGINE STATE
// ============================================================================

/// Engine state stored at fixed memory location
/// 
/// # Memory Layout
/// This struct is laid out in C format for predictable memory access from JS.
/// Total size: 256 bytes (padded with reserved space for future expansion).
#[repr(C)]
pub struct EngineState {
    /// Sample rate in Hz (44100, 48000, etc.)
    pub sample_rate: f32,
    /// Buffer size in samples (128, 256, etc.)
    pub buffer_size: u32,
    /// Initialization flags (see FLAG_* constants)
    pub flags: u32,
    /// Granular source length in samples
    pub granular_source_len: u32,
    /// IR length in samples
    pub ir_len: u32,
    /// Reserved for future use
    _reserved: [u8; 232],
}

/// Global engine state pointer
static mut ENGINE: *mut EngineState = ptr::null_mut();

/// Flag: Engine is initialized
pub const FLAG_INITIALIZED: u32 = 1 << 0;
/// Flag: Granular source loaded
pub const FLAG_GRANULAR_READY: u32 = 1 << 1;
/// Flag: IR loaded
pub const FLAG_IR_READY: u32 = 1 << 2;

// ============================================================================
// INITIALIZATION
// ============================================================================

/// Initialize the DSP engine
/// 
/// # Arguments
/// * `sample_rate` - Audio sample rate (e.g., 44100.0)
/// * `buffer_size` - Samples per process block (e.g., 128)
/// 
/// # Returns
/// Pointer to engine state (as u32 offset), or 0 on failure
/// 
/// # Safety
/// Must be called before any other DSP functions.
/// Must only be called once per engine lifetime.
/// 
/// # Example (from JS)
/// ```javascript
/// const statePtr = exports.dsp_init(44100.0, 128);
/// if (statePtr === 0) throw new Error('Init failed');
/// ```
pub fn init_engine(sample_rate: f32, buffer_size: u32) -> u32 {
    unsafe {
        // Validate inputs
        // Sample rate must be reasonable (8kHz to 192kHz)
        if sample_rate < 8000.0 || sample_rate > 192000.0 {
            return 0;
        }
        // Buffer size must be power-of-two-ish and within limits
        if buffer_size < 32 || buffer_size > MAX_BUFFER_SIZE as u32 {
            return 0;
        }

        // Get pointer to state at fixed offset
        // In WASM, memory starts at 0 and we use fixed offsets
        // SAFETY: Single-threaded WASM context, using raw pointer for Rust 2024
        let engine_ptr = addr_of_mut!(ENGINE);
        *engine_ptr = STATE_OFFSET as *mut EngineState;
        
        // Initialize state struct
        let engine = *engine_ptr;
        (*engine).sample_rate = sample_rate;
        (*engine).buffer_size = buffer_size;
        (*engine).flags = FLAG_INITIALIZED;
        (*engine).granular_source_len = 0;
        (*engine).ir_len = 0;
        (*engine)._reserved = [0u8; 232];

        // Zero all I/O buffers to prevent garbage on first process
        zero_buffer(INPUT_L_OFFSET, BUFFER_BYTES);
        zero_buffer(INPUT_R_OFFSET, BUFFER_BYTES);
        zero_buffer(OUTPUT_L_OFFSET, BUFFER_BYTES);
        zero_buffer(OUTPUT_R_OFFSET, BUFFER_BYTES);
        zero_buffer(WORK1_OFFSET, WORK_BUFFER_SIZE * 4);
        zero_buffer(WORK2_OFFSET, WORK_BUFFER_SIZE * 4);

        // Return state pointer as success indicator
        STATE_OFFSET as u32
    }
}

/// Zero a memory region
/// 
/// # Safety
/// Caller must ensure offset and size are valid memory regions.
#[inline]
unsafe fn zero_buffer(offset: usize, size: usize) {
    ptr::write_bytes(offset as *mut u8, 0, size);
}

// ============================================================================
// BUFFER ACCESS
// ============================================================================

/// Get pointer to input buffer for specified channel
/// 
/// # Arguments
/// * `channel` - 0 for left, 1 for right
/// 
/// # Returns
/// Mutable pointer to f32 buffer, or null if invalid channel
/// 
/// # Usage from JS
/// ```javascript
/// const inputPtrL = exports.dsp_get_input_ptr(0);
/// const inputPtrR = exports.dsp_get_input_ptr(1);
/// // Write samples: memory.set(inputSamples, inputPtrL / 4);
/// ```
#[inline]
pub fn get_input_buffer(channel: u32) -> *mut f32 {
    match channel {
        0 => INPUT_L_OFFSET as *mut f32,
        1 => INPUT_R_OFFSET as *mut f32,
        _ => ptr::null_mut(),
    }
}

/// Get pointer to output buffer for specified channel
/// 
/// # Arguments
/// * `channel` - 0 for left, 1 for right
/// 
/// # Returns
/// Const pointer to f32 buffer, or null if invalid channel
/// 
/// # Usage from JS
/// ```javascript
/// const outputPtrL = exports.dsp_get_output_ptr(0);
/// // Read samples: output[0].set(memory.subarray(outputPtrL / 4, ...));
/// ```
#[inline]
pub fn get_output_buffer(channel: u32) -> *const f32 {
    match channel {
        0 => OUTPUT_L_OFFSET as *const f32,
        1 => OUTPUT_R_OFFSET as *const f32,
        _ => ptr::null(),
    }
}

/// Get slice reference to input buffer
/// 
/// # Safety
/// Caller must ensure engine is initialized and channel is valid (0 or 1).
/// 
/// # Panics
/// Will cause undefined behavior if engine not initialized.
#[inline]
pub unsafe fn input_slice(channel: u32) -> &'static [f32] {
    let ptr = get_input_buffer(channel);
    let engine = *addr_of!(ENGINE);
    let len = (*engine).buffer_size as usize;
    std::slice::from_raw_parts(ptr, len)
}

/// Get mutable slice reference to output buffer
/// 
/// # Safety
/// Caller must ensure engine is initialized and channel is valid (0 or 1).
#[inline]
pub unsafe fn output_slice_mut(channel: u32) -> &'static mut [f32] {
    let ptr = get_output_buffer(channel) as *mut f32;
    let engine = *addr_of!(ENGINE);
    let len = (*engine).buffer_size as usize;
    std::slice::from_raw_parts_mut(ptr, len)
}

/// Get work buffer 1 as mutable slice
/// 
/// # Safety
/// Engine must be initialized. Work buffer has fixed size (WORK_BUFFER_SIZE).
#[inline]
pub unsafe fn work_buffer_1() -> &'static mut [f32] {
    std::slice::from_raw_parts_mut(WORK1_OFFSET as *mut f32, WORK_BUFFER_SIZE)
}

/// Get work buffer 2 as mutable slice
/// 
/// # Safety
/// Engine must be initialized. Work buffer has fixed size (WORK_BUFFER_SIZE).
#[inline]
pub unsafe fn work_buffer_2() -> &'static mut [f32] {
    std::slice::from_raw_parts_mut(WORK2_OFFSET as *mut f32, WORK_BUFFER_SIZE)
}

// ============================================================================
// GRANULAR SOURCE BUFFER
// ============================================================================

/// Get pointer to granular source buffer
/// 
/// # Returns
/// Mutable pointer to the granular source buffer start
#[inline]
pub fn get_granular_source_ptr() -> *mut f32 {
    GRANULAR_SOURCE_OFFSET as *mut f32
}

/// Set granular source length after loading
/// 
/// # Arguments
/// * `length` - Number of samples loaded
/// 
/// # Safety
/// Engine must be initialized.
pub unsafe fn set_granular_source_len(length: u32) {
    let engine = *addr_of!(ENGINE);
    if !engine.is_null() {
        (*engine).granular_source_len = length;
        (*engine).flags |= FLAG_GRANULAR_READY;
    }
}

/// Get granular source as slice
/// 
/// # Safety
/// Engine must be initialized and granular source must be loaded.
#[inline]
pub unsafe fn granular_source_slice() -> &'static [f32] {
    let engine = *addr_of!(ENGINE);
    let len = (*engine).granular_source_len as usize;
    std::slice::from_raw_parts(GRANULAR_SOURCE_OFFSET as *const f32, len)
}

// ============================================================================
// IR BUFFER
// ============================================================================

/// Get pointer to IR buffer
/// 
/// # Returns
/// Mutable pointer to the IR buffer start
#[inline]
pub fn get_ir_ptr() -> *mut f32 {
    IR_OFFSET as *mut f32
}

/// Set IR length after loading
/// 
/// # Arguments
/// * `length` - Number of samples loaded
/// 
/// # Safety
/// Engine must be initialized.
pub unsafe fn set_ir_len(length: u32) {
    let engine = *addr_of!(ENGINE);
    if !engine.is_null() {
        (*engine).ir_len = length;
        (*engine).flags |= FLAG_IR_READY;
    }
}

/// Get IR as slice
/// 
/// # Safety
/// Engine must be initialized and IR must be loaded.
#[inline]
pub unsafe fn ir_slice() -> &'static [f32] {
    let engine = *addr_of!(ENGINE);
    let len = (*engine).ir_len as usize;
    std::slice::from_raw_parts(IR_OFFSET as *const f32, len)
}

// ============================================================================
// SAMPLE RATE & BUFFER SIZE ACCESS
// ============================================================================

/// Get current sample rate
/// 
/// # Safety
/// Engine must be initialized.
#[inline]
pub fn sample_rate() -> f32 {
    unsafe {
        let engine = *addr_of!(ENGINE);
        if engine.is_null() { 44100.0 } else { (*engine).sample_rate }
    }
}

/// Get current buffer size
/// 
/// # Safety
/// Engine must be initialized.
#[inline]
pub fn buffer_size() -> u32 {
    unsafe {
        let engine = *addr_of!(ENGINE);
        if engine.is_null() { 128 } else { (*engine).buffer_size }
    }
}

/// Check if engine is initialized
#[inline]
pub fn is_initialized() -> bool {
    unsafe {
        let engine = *addr_of!(ENGINE);
        !engine.is_null() && ((*engine).flags & FLAG_INITIALIZED) != 0
    }
}

/// Check if granular source is loaded
#[inline]
pub fn is_granular_ready() -> bool {
    unsafe {
        let engine = *addr_of!(ENGINE);
        !engine.is_null() && ((*engine).flags & FLAG_GRANULAR_READY) != 0
    }
}

/// Check if IR is loaded
#[inline]
pub fn is_ir_ready() -> bool {
    unsafe {
        let engine = *addr_of!(ENGINE);
        !engine.is_null() && ((*engine).flags & FLAG_IR_READY) != 0
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

/// Clean up engine state
/// 
/// Note: In WASM, memory isn't truly freed. This just resets state flags
/// so the engine can be re-initialized if needed.
pub fn cleanup() {
    unsafe {
        let engine_ptr = addr_of_mut!(ENGINE);
        let engine = *engine_ptr;
        if !engine.is_null() {
            (*engine).flags = 0;
            (*engine).granular_source_len = 0;
            (*engine).ir_len = 0;
        }
        *engine_ptr = ptr::null_mut();
    }
}
