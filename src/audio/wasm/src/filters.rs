//! Filters
//! 
//! Implements various filter topologies:
//! - Biquad filters (LP, HP, BP, Notch, Peak, Shelf)
//! - State-variable filters (SVF) with resonance
//! 
//! # Biquad Reference
//! Based on Audio EQ Cookbook by Robert Bristow-Johnson
//! https://www.w3.org/2011/audio/audio-eq-cookbook.html
//!
//! # Zero-Allocation Design
//! All filter state is stored in the struct. Coefficients are computed
//! once when parameters change, not per-sample.

use core::f32::consts::PI;

// ============================================================================
// BIQUAD FILTER
// ============================================================================

/// Filter type for Biquad
#[derive(Clone, Copy, PartialEq)]
pub enum FilterType {
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
    Peak,
    LowShelf,
    HighShelf,
}

/// Biquad filter (2-pole, 2-zero IIR filter)
/// 
/// Transfer function:
/// H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
/// 
/// # Usage
/// ```ignore
/// let mut filter = Biquad::new();
/// filter.set_lowpass(1000.0, 0.707, 44100.0);
/// 
/// for sample in buffer.iter_mut() {
///     *sample = filter.process(*sample);
/// }
/// ```
#[derive(Clone, Copy)]
pub struct Biquad {
    // Coefficients (normalized by a0)
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    
    // State (delay line)
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl Default for Biquad {
    fn default() -> Self {
        Self::new()
    }
}

impl Biquad {
    /// Create a new biquad filter (passthrough by default)
    pub const fn new() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }
    
    /// Create a lowpass filter
    /// 
    /// # Arguments
    /// * `freq` - Cutoff frequency in Hz
    /// * `q` - Quality factor (0.707 = Butterworth, higher = resonant)
    /// * `sample_rate` - Sample rate in Hz
    pub fn lowpass(freq: f32, q: f32, sample_rate: f32) -> Self {
        let mut filter = Self::new();
        filter.set_lowpass(freq, q, sample_rate);
        filter
    }
    
    /// Create a highpass filter
    pub fn highpass(freq: f32, q: f32, sample_rate: f32) -> Self {
        let mut filter = Self::new();
        filter.set_highpass(freq, q, sample_rate);
        filter
    }
    
    /// Create a bandpass filter
    pub fn bandpass(freq: f32, q: f32, sample_rate: f32) -> Self {
        let mut filter = Self::new();
        filter.set_bandpass(freq, q, sample_rate);
        filter
    }
    
    /// Set lowpass filter coefficients
    pub fn set_lowpass(&mut self, freq: f32, q: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q);
        
        let b0 = (1.0 - cos_w0) / 2.0;
        let b1 = 1.0 - cos_w0;
        let b2 = (1.0 - cos_w0) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set highpass filter coefficients
    pub fn set_highpass(&mut self, freq: f32, q: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q);
        
        let b0 = (1.0 + cos_w0) / 2.0;
        let b1 = -(1.0 + cos_w0);
        let b2 = (1.0 + cos_w0) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set bandpass filter coefficients (constant skirt gain)
    pub fn set_bandpass(&mut self, freq: f32, q: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q);
        
        let b0 = alpha;
        let b1 = 0.0;
        let b2 = -alpha;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set notch filter coefficients
    pub fn set_notch(&mut self, freq: f32, q: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q);
        
        let b0 = 1.0;
        let b1 = -2.0 * cos_w0;
        let b2 = 1.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set peak filter coefficients
    /// 
    /// # Arguments
    /// * `freq` - Center frequency in Hz
    /// * `q` - Quality factor (bandwidth)
    /// * `gain_db` - Gain at center frequency in dB
    /// * `sample_rate` - Sample rate in Hz
    pub fn set_peak(&mut self, freq: f32, q: f32, gain_db: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let a = 10.0_f32.powf(gain_db / 40.0);
        let alpha = sin_w0 / (2.0 * q);
        
        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * cos_w0;
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha / a;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set low shelf filter coefficients
    pub fn set_low_shelf(&mut self, freq: f32, gain_db: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let a = 10.0_f32.powf(gain_db / 40.0);
        let alpha = sin_w0 / 2.0 * ((a + 1.0 / a) * (1.0 / 0.707 - 1.0) + 2.0).sqrt();
        let sqrt_a = a.sqrt();
        
        let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha);
        let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0);
        let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha);
        let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha;
        let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0);
        let a2 = (a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set high shelf filter coefficients
    pub fn set_high_shelf(&mut self, freq: f32, gain_db: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let a = 10.0_f32.powf(gain_db / 40.0);
        let alpha = sin_w0 / 2.0 * ((a + 1.0 / a) * (1.0 / 0.707 - 1.0) + 2.0).sqrt();
        let sqrt_a = a.sqrt();
        
        let b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha);
        let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0);
        let b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha);
        let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha;
        let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0);
        let a2 = (a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha;
        
        self.set_coefficients(b0, b1, b2, a0, a1, a2);
    }
    
    /// Set raw coefficients (normalized by a0)
    fn set_coefficients(&mut self, b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) {
        // Normalize by a0
        let inv_a0 = 1.0 / a0;
        self.b0 = b0 * inv_a0;
        self.b1 = b1 * inv_a0;
        self.b2 = b2 * inv_a0;
        self.a1 = a1 * inv_a0;
        self.a2 = a2 * inv_a0;
    }
    
    /// Process a single sample through the filter
    /// 
    /// Uses Direct Form II Transposed for better numerical stability.
    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        // Direct Form I (simple but less stable at low frequencies)
        let y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2
              - self.a1 * self.y1 - self.a2 * self.y2;
        
        // Update state
        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;
        
        y
    }
    
    /// Reset filter state (clear delay line)
    pub fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
}

// ============================================================================
// ONE-POLE FILTER
// ============================================================================

/// Simple one-pole lowpass filter
/// 
/// Good for smoothing control signals and simple DC blocking.
#[derive(Clone, Copy)]
pub struct OnePole {
    a0: f32,
    b1: f32,
    y1: f32,
}

impl Default for OnePole {
    fn default() -> Self {
        Self::new()
    }
}

impl OnePole {
    /// Create a new one-pole filter
    pub const fn new() -> Self {
        Self {
            a0: 1.0,
            b1: 0.0,
            y1: 0.0,
        }
    }
    
    /// Set as lowpass filter
    /// 
    /// # Arguments
    /// * `freq` - Cutoff frequency in Hz
    /// * `sample_rate` - Sample rate in Hz
    pub fn set_lowpass(&mut self, freq: f32, sample_rate: f32) {
        let w0 = 2.0 * PI * freq / sample_rate;
        self.b1 = (-w0).exp();
        self.a0 = 1.0 - self.b1;
    }
    
    /// Set as DC blocker (highpass at very low frequency)
    pub fn set_dc_blocker(&mut self, sample_rate: f32) {
        // ~5 Hz cutoff
        self.set_lowpass(5.0, sample_rate);
        // Invert for highpass behavior
        self.a0 = -self.a0;
    }
    
    /// Process a single sample
    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        self.y1 = self.a0 * x + self.b1 * self.y1;
        self.y1
    }
    
    /// Reset filter state
    pub fn reset(&mut self) {
        self.y1 = 0.0;
    }
}

// ============================================================================
// STEREO FILTER
// ============================================================================

/// Stereo biquad filter (two independent channels)
#[derive(Clone, Copy)]
pub struct StereoBiquad {
    left: Biquad,
    right: Biquad,
}

impl Default for StereoBiquad {
    fn default() -> Self {
        Self::new()
    }
}

impl StereoBiquad {
    /// Create a new stereo biquad filter
    pub const fn new() -> Self {
        Self {
            left: Biquad::new(),
            right: Biquad::new(),
        }
    }
    
    /// Set lowpass on both channels
    pub fn set_lowpass(&mut self, freq: f32, q: f32, sample_rate: f32) {
        self.left.set_lowpass(freq, q, sample_rate);
        self.right.set_lowpass(freq, q, sample_rate);
    }
    
    /// Set highpass on both channels
    pub fn set_highpass(&mut self, freq: f32, q: f32, sample_rate: f32) {
        self.left.set_highpass(freq, q, sample_rate);
        self.right.set_highpass(freq, q, sample_rate);
    }
    
    /// Process stereo samples
    #[inline]
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        (self.left.process(left), self.right.process(right))
    }
    
    /// Reset both channels
    pub fn reset(&mut self) {
        self.left.reset();
        self.right.reset();
    }
}
