//! Utility Functions
//! 
//! Math helpers and common DSP utilities:
//! - Interpolation (linear, cubic, hermite)
//! - dB/linear conversion
//! - Frequency/pitch conversion
//! - Clipping and saturation

/// Linear interpolation between two values
/// 
/// # Arguments
/// * `a` - Start value
/// * `b` - End value  
/// * `t` - Interpolation factor (0.0 to 1.0)
#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

/// Convert decibels to linear amplitude
/// 
/// # Arguments
/// * `db` - Value in decibels
#[inline]
pub fn db_to_linear(db: f32) -> f32 {
    libm::powf(10.0, db / 20.0)
}

/// Convert linear amplitude to decibels
/// 
/// # Arguments
/// * `linear` - Linear amplitude value
#[inline]
pub fn linear_to_db(linear: f32) -> f32 {
    20.0 * libm::log10f(linear.max(1e-10))
}

/// Convert MIDI note number to frequency in Hz
/// 
/// # Arguments
/// * `note` - MIDI note number (0-127, 69 = A4 = 440Hz)
#[inline]
pub fn midi_to_freq(note: f32) -> f32 {
    440.0 * libm::powf(2.0, (note - 69.0) / 12.0)
}

/// Soft clip a value to the range [-1, 1] using tanh
/// 
/// # Arguments
/// * `x` - Input value
#[inline]
pub fn soft_clip(x: f32) -> f32 {
    libm::tanhf(x)
}

/// Hard clip a value to the range [-limit, limit]
/// 
/// # Arguments
/// * `x` - Input value
/// * `limit` - Clipping threshold
#[inline]
pub fn hard_clip(x: f32, limit: f32) -> f32 {
    x.max(-limit).min(limit)
}
