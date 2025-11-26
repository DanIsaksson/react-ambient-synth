//! Delay Lines
//! 
//! Implements various delay-based effects:
//! - Simple delay with feedback
//! - Comb filters (feedforward and feedback)
//! - All-pass filters (for diffusion)
//! - Stereo ping-pong delay
//!
//! # Zero-Allocation Design
//! All delay buffers use fixed-size arrays allocated at compile time.
//! Maximum delay time is determined by MAX_DELAY_SAMPLES constant.

use crate::filters::OnePole;

// ============================================================================
// CONSTANTS
// ============================================================================

/// Maximum delay time in samples at 48kHz (~2 seconds)
const MAX_DELAY_SAMPLES: usize = 96000;

/// Maximum delay for all-pass (shorter for memory efficiency)
const MAX_ALLPASS_SAMPLES: usize = 4096;

// ============================================================================
// SIMPLE DELAY LINE
// ============================================================================

/// Simple delay line with feedback and mix control
/// 
/// # Features
/// - Variable delay time (up to MAX_DELAY_SAMPLES)
/// - Feedback with damping filter
/// - Dry/wet mix control
/// - Linear interpolation for fractional delays
pub struct DelayLine {
    buffer: [f32; MAX_DELAY_SAMPLES],
    write_pos: usize,
    delay_samples: f32,
    feedback: f32,
    mix: f32,
    damping: OnePole,
}

impl Default for DelayLine {
    fn default() -> Self {
        Self::new()
    }
}

impl DelayLine {
    /// Create a new delay line
    pub fn new() -> Self {
        Self {
            buffer: [0.0; MAX_DELAY_SAMPLES],
            write_pos: 0,
            delay_samples: 1000.0,
            feedback: 0.5,
            mix: 0.5,
            damping: OnePole::new(),
        }
    }
    
    /// Set delay time in seconds
    pub fn set_delay_time(&mut self, time_seconds: f32, sample_rate: f32) {
        let samples = time_seconds * sample_rate;
        self.delay_samples = samples.clamp(1.0, (MAX_DELAY_SAMPLES - 1) as f32);
    }
    
    /// Set delay time in samples (for precise control)
    pub fn set_delay_samples(&mut self, samples: f32) {
        self.delay_samples = samples.clamp(1.0, (MAX_DELAY_SAMPLES - 1) as f32);
    }
    
    /// Set feedback amount (0-1, can be slightly higher for resonance)
    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(0.0, 0.99);
    }
    
    /// Set dry/wet mix (0 = dry, 1 = wet)
    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }
    
    /// Set damping filter frequency
    pub fn set_damping(&mut self, freq: f32, sample_rate: f32) {
        self.damping.set_lowpass(freq, sample_rate);
    }
    
    /// Process a single sample
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        // Read from delay buffer with linear interpolation
        let delay_int = self.delay_samples as usize;
        let delay_frac = self.delay_samples - delay_int as f32;
        
        let read_pos_1 = (self.write_pos + MAX_DELAY_SAMPLES - delay_int) % MAX_DELAY_SAMPLES;
        let read_pos_2 = (read_pos_1 + MAX_DELAY_SAMPLES - 1) % MAX_DELAY_SAMPLES;
        
        let sample_1 = self.buffer[read_pos_1];
        let sample_2 = self.buffer[read_pos_2];
        let delayed = sample_1 + (sample_2 - sample_1) * delay_frac;
        
        // Apply damping filter to delayed signal
        let delayed_damped = self.damping.process(delayed);
        
        // Write to buffer with feedback
        self.buffer[self.write_pos] = input + delayed_damped * self.feedback;
        
        // Advance write position
        self.write_pos = (self.write_pos + 1) % MAX_DELAY_SAMPLES;
        
        // Mix dry and wet signals
        input * (1.0 - self.mix) + delayed * self.mix
    }
    
    /// Clear the delay buffer
    pub fn clear(&mut self) {
        self.buffer.fill(0.0);
        self.damping.reset();
    }
}

// ============================================================================
// COMB FILTER
// ============================================================================

/// Feedback comb filter
/// 
/// Used in reverb algorithms (Schroeder reverb, etc.)
/// y[n] = x[n] + g * y[n-M]
pub struct CombFilter {
    buffer: [f32; MAX_DELAY_SAMPLES],
    write_pos: usize,
    delay_samples: usize,
    feedback: f32,
    damping: OnePole,
}

impl Default for CombFilter {
    fn default() -> Self {
        Self::new()
    }
}

impl CombFilter {
    /// Create a new comb filter
    pub fn new() -> Self {
        Self {
            buffer: [0.0; MAX_DELAY_SAMPLES],
            write_pos: 0,
            delay_samples: 1000,
            feedback: 0.5,
            damping: OnePole::new(),
        }
    }
    
    /// Set delay time in samples
    pub fn set_delay_samples(&mut self, samples: usize) {
        self.delay_samples = samples.min(MAX_DELAY_SAMPLES - 1).max(1);
    }
    
    /// Set feedback coefficient
    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(-0.99, 0.99);
    }
    
    /// Set damping frequency (lowpass on feedback path)
    pub fn set_damping(&mut self, freq: f32, sample_rate: f32) {
        self.damping.set_lowpass(freq, sample_rate);
    }
    
    /// Process a single sample
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let read_pos = (self.write_pos + MAX_DELAY_SAMPLES - self.delay_samples) % MAX_DELAY_SAMPLES;
        let delayed = self.buffer[read_pos];
        
        // Apply damping to feedback
        let feedback_signal = self.damping.process(delayed) * self.feedback;
        
        // Write input + feedback to buffer
        self.buffer[self.write_pos] = input + feedback_signal;
        self.write_pos = (self.write_pos + 1) % MAX_DELAY_SAMPLES;
        
        delayed
    }
    
    /// Clear buffer
    pub fn clear(&mut self) {
        self.buffer.fill(0.0);
        self.damping.reset();
    }
}

// ============================================================================
// ALL-PASS FILTER
// ============================================================================

/// All-pass filter for diffusion
/// 
/// Passes all frequencies equally but alters phase.
/// Used in reverb algorithms for diffusion.
/// y[n] = -g*x[n] + x[n-M] + g*y[n-M]
pub struct AllPassFilter {
    buffer: [f32; MAX_ALLPASS_SAMPLES],
    write_pos: usize,
    delay_samples: usize,
    coefficient: f32,
}

impl Default for AllPassFilter {
    fn default() -> Self {
        Self::new()
    }
}

impl AllPassFilter {
    /// Create a new all-pass filter
    pub fn new() -> Self {
        Self {
            buffer: [0.0; MAX_ALLPASS_SAMPLES],
            write_pos: 0,
            delay_samples: 500,
            coefficient: 0.5,
        }
    }
    
    /// Set delay time in samples
    pub fn set_delay_samples(&mut self, samples: usize) {
        self.delay_samples = samples.min(MAX_ALLPASS_SAMPLES - 1).max(1);
    }
    
    /// Set coefficient (typically 0.5-0.7)
    pub fn set_coefficient(&mut self, coeff: f32) {
        self.coefficient = coeff.clamp(-0.9, 0.9);
    }
    
    /// Process a single sample
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let read_pos = (self.write_pos + MAX_ALLPASS_SAMPLES - self.delay_samples) % MAX_ALLPASS_SAMPLES;
        let delayed = self.buffer[read_pos];
        
        let output = -self.coefficient * input + delayed;
        self.buffer[self.write_pos] = input + self.coefficient * output;
        
        self.write_pos = (self.write_pos + 1) % MAX_ALLPASS_SAMPLES;
        
        output
    }
    
    /// Clear buffer
    pub fn clear(&mut self) {
        self.buffer.fill(0.0);
    }
}

// ============================================================================
// STEREO PING-PONG DELAY
// ============================================================================

/// Stereo ping-pong delay
/// 
/// Delay bounces between left and right channels
pub struct PingPongDelay {
    left_buffer: [f32; MAX_DELAY_SAMPLES],
    right_buffer: [f32; MAX_DELAY_SAMPLES],
    write_pos: usize,
    delay_samples: usize,
    feedback: f32,
    mix: f32,
    damping_l: OnePole,
    damping_r: OnePole,
}

impl Default for PingPongDelay {
    fn default() -> Self {
        Self::new()
    }
}

impl PingPongDelay {
    /// Create a new ping-pong delay
    pub fn new() -> Self {
        Self {
            left_buffer: [0.0; MAX_DELAY_SAMPLES],
            right_buffer: [0.0; MAX_DELAY_SAMPLES],
            write_pos: 0,
            delay_samples: 22050,
            feedback: 0.5,
            mix: 0.5,
            damping_l: OnePole::new(),
            damping_r: OnePole::new(),
        }
    }
    
    /// Set delay time in seconds
    pub fn set_delay_time(&mut self, time_seconds: f32, sample_rate: f32) {
        let samples = (time_seconds * sample_rate) as usize;
        self.delay_samples = samples.clamp(1, MAX_DELAY_SAMPLES - 1);
    }
    
    /// Set feedback amount
    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(0.0, 0.95);
    }
    
    /// Set dry/wet mix
    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }
    
    /// Set damping frequency
    pub fn set_damping(&mut self, freq: f32, sample_rate: f32) {
        self.damping_l.set_lowpass(freq, sample_rate);
        self.damping_r.set_lowpass(freq, sample_rate);
    }
    
    /// Process stereo samples
    #[inline]
    pub fn process(&mut self, left_in: f32, right_in: f32) -> (f32, f32) {
        let read_pos = (self.write_pos + MAX_DELAY_SAMPLES - self.delay_samples) % MAX_DELAY_SAMPLES;
        
        // Read delayed samples
        let delayed_l = self.left_buffer[read_pos];
        let delayed_r = self.right_buffer[read_pos];
        
        // Apply damping
        let damped_l = self.damping_l.process(delayed_l);
        let damped_r = self.damping_r.process(delayed_r);
        
        // Ping-pong: left input + right feedback -> left buffer
        //            right input + left feedback -> right buffer
        self.left_buffer[self.write_pos] = left_in + damped_r * self.feedback;
        self.right_buffer[self.write_pos] = right_in + damped_l * self.feedback;
        
        self.write_pos = (self.write_pos + 1) % MAX_DELAY_SAMPLES;
        
        // Mix
        let out_l = left_in * (1.0 - self.mix) + delayed_l * self.mix;
        let out_r = right_in * (1.0 - self.mix) + delayed_r * self.mix;
        
        (out_l, out_r)
    }
    
    /// Clear buffers
    pub fn clear(&mut self) {
        self.left_buffer.fill(0.0);
        self.right_buffer.fill(0.0);
        self.damping_l.reset();
        self.damping_r.reset();
    }
}

// ============================================================================
// MODULATED DELAY (for chorus/flanger)
// ============================================================================

/// Modulated delay line for chorus/flanger effects
/// 
/// Uses fractional delay with cubic interpolation for smooth modulation.
pub struct ModulatedDelay {
    buffer: [f32; MAX_DELAY_SAMPLES],
    write_pos: usize,
    base_delay: f32,
    mod_depth: f32,
    feedback: f32,
}

impl Default for ModulatedDelay {
    fn default() -> Self {
        Self::new()
    }
}

impl ModulatedDelay {
    /// Create a new modulated delay
    pub fn new() -> Self {
        Self {
            buffer: [0.0; MAX_DELAY_SAMPLES],
            write_pos: 0,
            base_delay: 500.0,
            mod_depth: 100.0,
            feedback: 0.0,
        }
    }
    
    /// Set base delay time in samples
    pub fn set_base_delay(&mut self, samples: f32) {
        self.base_delay = samples.clamp(1.0, (MAX_DELAY_SAMPLES - 100) as f32);
    }
    
    /// Set modulation depth in samples
    pub fn set_mod_depth(&mut self, samples: f32) {
        self.mod_depth = samples.clamp(0.0, 1000.0);
    }
    
    /// Set feedback amount (for flanger)
    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(-0.95, 0.95);
    }
    
    /// Process with modulation input (typically LFO, range -1 to 1)
    #[inline]
    pub fn process(&mut self, input: f32, mod_signal: f32) -> f32 {
        // Calculate modulated delay
        let delay = self.base_delay + mod_signal * self.mod_depth;
        let delay = delay.clamp(1.0, (MAX_DELAY_SAMPLES - 1) as f32);
        
        // Cubic interpolation for smooth modulation
        let delay_int = delay as usize;
        let frac = delay - delay_int as f32;
        
        let idx0 = (self.write_pos + MAX_DELAY_SAMPLES - delay_int - 1) % MAX_DELAY_SAMPLES;
        let idx1 = (self.write_pos + MAX_DELAY_SAMPLES - delay_int) % MAX_DELAY_SAMPLES;
        let idx2 = (self.write_pos + MAX_DELAY_SAMPLES - delay_int + 1) % MAX_DELAY_SAMPLES;
        let idx3 = (self.write_pos + MAX_DELAY_SAMPLES - delay_int + 2) % MAX_DELAY_SAMPLES;
        
        let y0 = self.buffer[idx0];
        let y1 = self.buffer[idx1];
        let y2 = self.buffer[idx2];
        let y3 = self.buffer[idx3];
        
        // Cubic interpolation (Catmull-Rom spline)
        let c0 = y1;
        let c1 = 0.5 * (y2 - y0);
        let c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
        let c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
        
        let delayed = ((c3 * frac + c2) * frac + c1) * frac + c0;
        
        // Write with feedback
        self.buffer[self.write_pos] = input + delayed * self.feedback;
        self.write_pos = (self.write_pos + 1) % MAX_DELAY_SAMPLES;
        
        delayed
    }
    
    /// Clear buffer
    pub fn clear(&mut self) {
        self.buffer.fill(0.0);
    }
}
