/**
 * GranularProcessor - AudioWorklet for real-time granular synthesis.
 * 
 * Granular synthesis works by:
 * 1. Reading small "grains" (10-500ms) from a source buffer
 * 2. Applying a window function (Hanning) to each grain to prevent clicks
 * 3. Overlapping many grains to create smooth, cloud-like textures
 * 4. Adding jitter/randomness to avoid mechanical artifacts
 * 
 * @module audio/worklets/granular-processor
 */

// ===========================================
// GRAIN CLASS
// ===========================================

class Grain {
  constructor(startSample, grainSamples, playbackRate, amplitude) {
    this.startSample = startSample;      // Where to read from in buffer
    this.grainSamples = grainSamples;    // Length of grain in samples
    this.playbackRate = playbackRate;    // Pitch shift (1.0 = normal)
    this.amplitude = amplitude;          // Volume of this grain
    this.position = 0;                   // Current playback position
    this.active = true;                  // Is grain still playing?
  }

  /**
   * Read a sample from the grain with Hanning window applied.
   * @param {Float32Array} buffer - Source audio buffer
   * @param {number} bufferLength - Length of source buffer
   * @returns {number} - Windowed sample value
   */
  process(buffer, bufferLength) {
    if (!this.active) return 0;

    // Calculate window position (0 to 1)
    const windowPos = this.position / this.grainSamples;
    
    // Hanning window: 0.5 * (1 - cos(2π * pos))
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * windowPos));

    // Calculate read position in source buffer
    const readPos = this.startSample + (this.position * this.playbackRate);
    const readIndex = Math.floor(readPos) % bufferLength;
    
    // Linear interpolation for smooth pitch shifting
    const frac = readPos - Math.floor(readPos);
    const nextIndex = (readIndex + 1) % bufferLength;
    const sample = buffer[readIndex] * (1 - frac) + buffer[nextIndex] * frac;

    // Advance position
    this.position++;

    // Check if grain is finished
    if (this.position >= this.grainSamples) {
      this.active = false;
    }

    return sample * window * this.amplitude;
  }
}

// ===========================================
// GRANULAR PROCESSOR
// ===========================================

class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // ===========================================
    // STATE
    // ===========================================
    
    /** @type {Float32Array | null} */
    this.bufferL = null;
    /** @type {Float32Array | null} */
    this.bufferR = null;
    this.bufferLength = 0;
    this.bufferSampleRate = 44100;

    /** @type {Grain[]} */
    this.grains = [];

    // Timing
    this.samplesSinceLastGrain = 0;
    this.samplesPerGrain = 512; // Calculated from density

    // Parameters (updated via message port)
    this.params = {
      position: 0.5,      // 0-1, where in buffer to read
      spray: 0.1,         // 0-1, randomness of position
      density: 20,        // Grains per second (Hz)
      size: 0.1,          // Grain duration in seconds
      pitch: 1.0,         // Playback rate
      pitchSpray: 0,      // Randomness of pitch (semitones)
      gain: 0.5,          // Output gain
      pan: 0.5,           // Stereo pan (0=L, 0.5=C, 1=R)
      reverse: 0,         // 0-1, probability of reversed grains
    };

    this.isPlaying = false;

    // ===========================================
    // MESSAGE HANDLING
    // ===========================================

    this.port.onmessage = (event) => {
      const { action, payload } = event.data;

      switch (action) {
        case 'SET_BUFFER':
          this.setBuffer(payload);
          break;

        case 'SET_PARAMS':
          Object.assign(this.params, payload);
          this.updateTiming();
          break;

        case 'PLAY':
          this.isPlaying = true;
          break;

        case 'STOP':
          this.isPlaying = false;
          this.grains = [];
          break;

        case 'TRIGGER':
          // Trigger a single grain burst
          this.spawnGrain();
          break;
      }
    };
  }

  // ===========================================
  // BUFFER MANAGEMENT
  // ===========================================

  setBuffer(payload) {
    const { left, right, sampleRate } = payload;
    
    this.bufferL = left;
    this.bufferR = right || left; // Mono fallback
    this.bufferLength = left.length;
    this.bufferSampleRate = sampleRate || 44100;

    console.log(`[GranularProcessor] Buffer loaded: ${this.bufferLength} samples`);
  }

  // ===========================================
  // TIMING CALCULATIONS
  // ===========================================

  updateTiming() {
    // Calculate samples between grain spawns based on density
    this.samplesPerGrain = Math.floor(sampleRate / Math.max(1, this.params.density));
  }

  // ===========================================
  // GRAIN SPAWNING
  // ===========================================

  spawnGrain() {
    if (!this.bufferL || this.bufferLength === 0) return;

    // Calculate grain parameters with jitter
    const { position, spray, size, pitch, pitchSpray, reverse } = this.params;

    // Position with spray (randomness)
    const jitteredPosition = position + (Math.random() - 0.5) * spray;
    const clampedPosition = Math.max(0, Math.min(1, jitteredPosition));
    const startSample = Math.floor(clampedPosition * this.bufferLength);

    // Grain size in samples
    const grainSamples = Math.floor(size * sampleRate);

    // Pitch with spray (in semitones, converted to rate)
    const pitchJitter = (Math.random() - 0.5) * pitchSpray;
    const pitchRate = pitch * Math.pow(2, pitchJitter / 12);

    // Reverse probability
    const isReversed = Math.random() < reverse;
    const finalRate = isReversed ? -pitchRate : pitchRate;

    // Random amplitude variation for organic sound
    const amplitude = 0.8 + Math.random() * 0.4;

    // Create and add grain
    const grain = new Grain(startSample, grainSamples, finalRate, amplitude);
    this.grains.push(grain);

    // Limit max concurrent grains (performance budget)
    if (this.grains.length > 50) {
      this.grains.shift();
    }
  }

  // ===========================================
  // PROCESS LOOP
  // ===========================================

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outputL = output[0];
    const outputR = output[1] || output[0];
    const frameSize = outputL.length;

    // Zero output buffers
    outputL.fill(0);
    outputR.fill(0);

    // Early exit if no buffer or not playing
    if (!this.bufferL || !this.isPlaying) {
      return true;
    }

    const { gain, pan } = this.params;

    // Calculate pan gains (equal power)
    const panAngle = pan * Math.PI * 0.5;
    const panL = Math.cos(panAngle);
    const panR = Math.sin(panAngle);

    // Process each sample
    for (let i = 0; i < frameSize; i++) {
      // Check if it's time to spawn a new grain
      this.samplesSinceLastGrain++;
      if (this.samplesSinceLastGrain >= this.samplesPerGrain) {
        this.spawnGrain();
        this.samplesSinceLastGrain = 0;
      }

      // Sum all active grains
      let sumL = 0;
      let sumR = 0;

      for (const grain of this.grains) {
        if (!grain.active) continue;

        const sampleL = grain.process(this.bufferL, this.bufferLength);
        const sampleR = grain.process(this.bufferR, this.bufferLength);

        sumL += sampleL;
        sumR += sampleR;
      }

      // Apply gain and pan
      outputL[i] = sumL * gain * panL;
      outputR[i] = sumR * gain * panR;
    }

    // Clean up finished grains
    this.grains = this.grains.filter(g => g.active);

    // Soft clip output
    for (let i = 0; i < frameSize; i++) {
      outputL[i] = Math.tanh(outputL[i]);
      outputR[i] = Math.tanh(outputR[i]);
    }

    return true;
  }
}

registerProcessor('granular-processor', GranularProcessor);
