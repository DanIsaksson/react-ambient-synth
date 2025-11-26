/**
 * TimeStretchProcessor - WSOLA-based time stretching without pitch change.
 * 
 * WSOLA (Waveform Similarity Overlap-Add):
 * 1. Split input into overlapping grains
 * 2. Find optimal overlap position using cross-correlation
 * 3. Crossfade grains together
 * 4. Adjust read position based on stretch ratio
 * 
 * Parameters:
 * - stretchRatio: 0.5 (half speed) to 2.0 (double speed)
 * - grainSize: Analysis window size (samples)
 * - overlap: Overlap factor (0.5 = 50% overlap)
 * 
 * @module audio/worklets/time-stretch-processor
 */

class TimeStretchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Buffer to hold the sample data
    this.buffer = null;
    this.bufferLength = 0;
    this.numChannels = 1;
    
    // Playback state
    this.isPlaying = false;
    this.readPosition = 0;
    
    // WSOLA parameters
    this.grainSize = 2048;          // Grain size in samples
    this.overlap = 0.5;             // 50% overlap
    this.hopSize = this.grainSize * (1 - this.overlap);
    this.searchRange = 256;         // Samples to search for best match
    
    // Output buffer for grain overlap
    this.outputBuffer = new Float32Array(this.grainSize * 2);
    this.outputWritePos = 0;
    this.outputReadPos = 0;
    
    // Previous grain for correlation
    this.prevGrain = new Float32Array(this.grainSize);
    this.currentGrain = new Float32Array(this.grainSize);
    
    // Hann window for smooth crossfade
    this.window = this.createHannWindow(this.grainSize);
    
    // Handle messages from main thread
    this.port.onmessage = (event) => {
      const { action, payload } = event.data;
      
      switch (action) {
        case 'LOAD_BUFFER':
          this.loadBuffer(payload);
          break;
        case 'PLAY':
          this.play(payload?.offset || 0);
          break;
        case 'STOP':
          this.stop();
          break;
        case 'SEEK':
          this.seek(payload.position);
          break;
        case 'SET_GRAIN_SIZE':
          this.setGrainSize(payload.size);
          break;
      }
    };
    
    console.log('[TimeStretchProcessor] Initialized');
  }

  /**
   * Create a Hann window for grain crossfading.
   */
  createHannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  /**
   * Load audio buffer from main thread.
   */
  loadBuffer(payload) {
    const { channelData, length, numChannels } = payload;
    
    this.buffer = channelData[0]; // Use first channel for now
    this.bufferLength = length;
    this.numChannels = numChannels;
    this.readPosition = 0;
    
    console.log(`[TimeStretchProcessor] Buffer loaded: ${length} samples, ${numChannels} channels`);
    
    // Notify main thread
    this.port.postMessage({ type: 'BUFFER_LOADED', length, numChannels });
  }

  /**
   * Start playback.
   */
  play(offset = 0) {
    if (!this.buffer) {
      console.warn('[TimeStretchProcessor] No buffer loaded');
      return;
    }
    
    this.readPosition = Math.floor(offset * this.bufferLength);
    this.isPlaying = true;
    this.outputWritePos = 0;
    this.outputReadPos = 0;
    this.outputBuffer.fill(0);
    
    console.log(`[TimeStretchProcessor] Playing from ${offset}`);
  }

  /**
   * Stop playback.
   */
  stop() {
    this.isPlaying = false;
    this.port.postMessage({ type: 'STOPPED' });
  }

  /**
   * Seek to position (0-1).
   */
  seek(position) {
    this.readPosition = Math.floor(position * this.bufferLength);
  }

  /**
   * Update grain size (affects quality vs. latency).
   */
  setGrainSize(size) {
    this.grainSize = size;
    this.hopSize = this.grainSize * (1 - this.overlap);
    this.window = this.createHannWindow(this.grainSize);
    this.prevGrain = new Float32Array(this.grainSize);
    this.currentGrain = new Float32Array(this.grainSize);
    this.outputBuffer = new Float32Array(this.grainSize * 2);
  }

  /**
   * Find best overlap position using cross-correlation.
   * This is the key to WSOLA quality.
   */
  findBestOverlap(targetPos, prevGrainEnd) {
    if (!this.buffer) return targetPos;
    
    let bestOffset = 0;
    let bestCorrelation = -Infinity;
    
    const overlapSize = Math.floor(this.grainSize * this.overlap);
    const searchStart = Math.max(0, targetPos - this.searchRange);
    const searchEnd = Math.min(this.bufferLength - this.grainSize, targetPos + this.searchRange);
    
    // Search for best correlation within range
    for (let offset = searchStart; offset < searchEnd; offset++) {
      let correlation = 0;
      
      // Calculate normalized cross-correlation for overlap region
      for (let i = 0; i < overlapSize; i++) {
        const prevSample = this.prevGrain[this.grainSize - overlapSize + i];
        const currSample = this.buffer[offset + i];
        correlation += prevSample * currSample;
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
    
    return bestOffset;
  }

  /**
   * Extract a grain from the buffer with windowing.
   */
  extractGrain(position, output) {
    if (!this.buffer) return;
    
    for (let i = 0; i < this.grainSize; i++) {
      const bufferPos = position + i;
      if (bufferPos >= 0 && bufferPos < this.bufferLength) {
        output[i] = this.buffer[bufferPos] * this.window[i];
      } else {
        output[i] = 0;
      }
    }
  }

  /**
   * Process audio - called by AudioWorklet system.
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output[0];
    
    if (!outputChannel) return true;
    
    // Get stretch ratio from parameter
    const stretchRatio = parameters.stretchRatio?.[0] ?? 1.0;
    
    // If not playing, output silence
    if (!this.isPlaying || !this.buffer) {
      outputChannel.fill(0);
      return true;
    }
    
    // Calculate synthesis hop (how much to advance output position)
    const synthesisHop = this.hopSize;
    // Calculate analysis hop (how much to advance read position)
    const analysisHop = this.hopSize / stretchRatio;
    
    // Fill output buffer
    for (let i = 0; i < outputChannel.length; i++) {
      // Check if we need to generate a new grain
      if (this.outputReadPos >= this.outputWritePos) {
        // Find best position for next grain (WSOLA magic)
        const targetPos = this.readPosition;
        const bestPos = this.findBestOverlap(targetPos, this.grainSize - synthesisHop);
        
        // Extract new grain
        this.extractGrain(bestPos, this.currentGrain);
        
        // Overlap-add to output buffer
        const overlapSize = Math.floor(this.grainSize * this.overlap);
        
        // Add overlapping part with previous grain
        for (let j = 0; j < overlapSize; j++) {
          const fadeOut = 1 - (j / overlapSize);
          const fadeIn = j / overlapSize;
          const outputIdx = (this.outputWritePos + j) % this.outputBuffer.length;
          this.outputBuffer[outputIdx] = 
            this.prevGrain[this.grainSize - overlapSize + j] * fadeOut +
            this.currentGrain[j] * fadeIn;
        }
        
        // Add non-overlapping part
        for (let j = overlapSize; j < this.grainSize; j++) {
          const outputIdx = (this.outputWritePos + j) % this.outputBuffer.length;
          this.outputBuffer[outputIdx] = this.currentGrain[j];
        }
        
        // Store current grain for next overlap
        this.prevGrain.set(this.currentGrain);
        
        // Advance positions
        this.outputWritePos += synthesisHop;
        this.readPosition += analysisHop;
        
        // Check for end of buffer
        if (this.readPosition >= this.bufferLength) {
          this.stop();
          outputChannel.fill(0, i);
          return true;
        }
      }
      
      // Read from output buffer
      const readIdx = this.outputReadPos % this.outputBuffer.length;
      outputChannel[i] = this.outputBuffer[readIdx];
      this.outputReadPos++;
    }
    
    // Report playback position
    if (this.processCounter++ % 100 === 0) {
      this.port.postMessage({
        type: 'POSITION',
        position: this.readPosition / this.bufferLength,
      });
    }
    
    return true;
  }

  /**
   * Define audio parameters.
   */
  static get parameterDescriptors() {
    return [
      {
        name: 'stretchRatio',
        defaultValue: 1.0,
        minValue: 0.25,
        maxValue: 4.0,
        automationRate: 'k-rate', // Control rate (per block)
      },
    ];
  }
}

// Track process calls for position reporting
TimeStretchProcessor.prototype.processCounter = 0;

registerProcessor('time-stretch-processor', TimeStretchProcessor);
