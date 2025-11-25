/**
 * LFONode - Low Frequency Oscillator for modulation.
 * 
 * Features:
 * - Multiple waveforms: sine, triangle, square, sawtooth, random (S&H)
 * - Frequency range: 0.01 Hz to 100 Hz
 * - Bipolar (-1 to +1) or unipolar (0 to 1) output
 * - Sync to tempo (future)
 * - Phase offset
 * 
 * @module audio/modulation/LFONode
 */

// ===========================================
// TYPES
// ===========================================

export type LFOWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'random';

export interface LFOParams {
  /** Frequency in Hz */
  frequency: number;
  /** Waveform type */
  waveform: LFOWaveform;
  /** Depth/amplitude (0-1) */
  depth: number;
  /** Phase offset in degrees (0-360) */
  phase: number;
  /** Bipolar (-1 to +1) or unipolar (0 to 1) */
  bipolar: boolean;
}

// ===========================================
// DEFAULT PARAMETERS
// ===========================================

const DEFAULT_PARAMS: LFOParams = {
  frequency: 1,
  waveform: 'sine',
  depth: 1,
  phase: 0,
  bipolar: true,
};

// ===========================================
// LFO NODE CLASS
// ===========================================

export class LFONode {
  private audioContext: AudioContext;
  private params: LFOParams;

  // Audio nodes
  private oscillator: OscillatorNode | null = null;
  private depthGain: GainNode;
  private outputGain: GainNode;
  private dcOffset: ConstantSourceNode;

  // For random (S&H) waveform
  private randomInterval: ReturnType<typeof setInterval> | null = null;
  private randomValue = 0;

  // Current value for visualization
  private currentValue = 0;
  private valueUpdateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(audioContext: AudioContext, params: Partial<LFOParams> = {}) {
    this.audioContext = audioContext;
    this.params = { ...DEFAULT_PARAMS, ...params };

    // Create gain nodes
    this.depthGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.outputGain.gain.value = 1;

    // DC offset for unipolar mode
    this.dcOffset = audioContext.createConstantSource();
    this.dcOffset.offset.value = 0;
    this.dcOffset.start();

    // Connect depth -> output
    this.depthGain.connect(this.outputGain);
    this.dcOffset.connect(this.outputGain);

    // Initialize oscillator
    this.createOscillator();
    this.applyParams();

    // Start value update for visualization
    this.startValueUpdater();
  }

  // ===========================================
  // OSCILLATOR MANAGEMENT
  // ===========================================

  private createOscillator(): void {
    if (this.params.waveform === 'random') {
      this.createRandomLFO();
      return;
    }

    // Stop previous oscillator
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
    }

    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = this.getOscillatorType(this.params.waveform);
    this.oscillator.frequency.value = this.params.frequency;
    this.oscillator.connect(this.depthGain);
    this.oscillator.start();
  }

  private getOscillatorType(waveform: LFOWaveform): OscillatorType {
    switch (waveform) {
      case 'sine': return 'sine';
      case 'triangle': return 'triangle';
      case 'square': return 'square';
      case 'sawtooth': return 'sawtooth';
      default: return 'sine';
    }
  }

  private createRandomLFO(): void {
    // Stop regular oscillator
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }

    // Clear previous interval
    if (this.randomInterval) {
      clearInterval(this.randomInterval);
    }

    // Create a ConstantSourceNode for random values
    const constantSource = this.audioContext.createConstantSource();
    constantSource.connect(this.depthGain);
    constantSource.start();

    // Update at LFO frequency
    const intervalMs = 1000 / Math.max(0.1, this.params.frequency);
    this.randomInterval = setInterval(() => {
      // Sample & Hold: random value held until next trigger
      this.randomValue = Math.random() * 2 - 1; // -1 to +1
      constantSource.offset.setTargetAtTime(
        this.randomValue,
        this.audioContext.currentTime,
        0.001
      );
    }, intervalMs);
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  private applyParams(): void {
    const { frequency, depth, bipolar } = this.params;

    // Set depth
    this.depthGain.gain.setTargetAtTime(depth, this.audioContext.currentTime, 0.01);

    // Set DC offset for unipolar mode
    if (bipolar) {
      this.dcOffset.offset.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    } else {
      // Shift from [-1, 1] to [0, 1]
      this.dcOffset.offset.setTargetAtTime(depth, this.audioContext.currentTime, 0.01);
      this.depthGain.gain.setTargetAtTime(depth * 0.5, this.audioContext.currentTime, 0.01);
    }

    // Set frequency
    if (this.oscillator) {
      this.oscillator.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.01);
    }

    // Note: Phase offset would require recreating the oscillator or using detune
    // For simplicity, we skip runtime phase changes
  }

  /**
   * Set LFO frequency in Hz.
   */
  setFrequency(hz: number): void {
    this.params.frequency = Math.max(0.01, Math.min(100, hz));
    
    if (this.oscillator) {
      this.oscillator.frequency.setTargetAtTime(
        this.params.frequency,
        this.audioContext.currentTime,
        0.01
      );
    }

    // Recreate random LFO if needed
    if (this.params.waveform === 'random') {
      this.createRandomLFO();
    }
  }

  /**
   * Set LFO waveform.
   */
  setWaveform(waveform: LFOWaveform): void {
    if (this.params.waveform === waveform) return;
    
    this.params.waveform = waveform;
    
    // Clear random interval if switching away from random
    if (this.randomInterval && waveform !== 'random') {
      clearInterval(this.randomInterval);
      this.randomInterval = null;
    }

    this.createOscillator();
  }

  /**
   * Set modulation depth (0-1).
   */
  setDepth(depth: number): void {
    this.params.depth = Math.max(0, Math.min(1, depth));
    this.applyParams();
  }

  /**
   * Set bipolar/unipolar mode.
   */
  setBipolar(bipolar: boolean): void {
    this.params.bipolar = bipolar;
    this.applyParams();
  }

  /**
   * Set multiple parameters at once.
   */
  setParams(params: Partial<LFOParams>): void {
    const waveformChanged = params.waveform && params.waveform !== this.params.waveform;
    
    Object.assign(this.params, params);
    
    if (waveformChanged) {
      this.createOscillator();
    }
    
    this.applyParams();
  }

  // ===========================================
  // VISUALIZATION
  // ===========================================

  private startValueUpdater(): void {
    // Update current value at 60fps for UI
    this.valueUpdateInterval = setInterval(() => {
      const t = this.audioContext.currentTime;
      const freq = this.params.frequency;
      const phase = (this.params.phase / 360) * 2 * Math.PI;
      
      // Calculate current value based on waveform
      let value: number;
      
      switch (this.params.waveform) {
        case 'sine':
          value = Math.sin(2 * Math.PI * freq * t + phase);
          break;
        case 'triangle':
          value = 2 * Math.abs(2 * ((freq * t + this.params.phase / 360) % 1) - 1) - 1;
          break;
        case 'square':
          value = Math.sin(2 * Math.PI * freq * t + phase) >= 0 ? 1 : -1;
          break;
        case 'sawtooth':
          value = 2 * ((freq * t + this.params.phase / 360) % 1) - 1;
          break;
        case 'random':
          value = this.randomValue;
          break;
        default:
          value = 0;
      }

      // Apply depth
      value *= this.params.depth;

      // Convert to unipolar if needed
      if (!this.params.bipolar) {
        value = (value + 1) * 0.5;
      }

      this.currentValue = value;
    }, 1000 / 60);
  }

  /**
   * Get current value for visualization (normalized 0-1).
   */
  getValue(): number {
    if (this.params.bipolar) {
      return (this.currentValue + 1) * 0.5; // Convert to 0-1
    }
    return this.currentValue;
  }

  /**
   * Get current raw value (-1 to +1 for bipolar, 0-1 for unipolar).
   */
  getRawValue(): number {
    return this.currentValue;
  }

  // ===========================================
  // CONNECTIONS
  // ===========================================

  /**
   * Get the output node for connecting to modulation targets.
   */
  get output(): GainNode {
    return this.outputGain;
  }

  /**
   * Connect to a destination (AudioParam or AudioNode).
   */
  connect(destination: AudioParam | AudioNode): void {
    if (destination instanceof AudioParam) {
      this.outputGain.connect(destination);
    } else {
      this.outputGain.connect(destination);
    }
  }

  /**
   * Disconnect from all or specific destination.
   */
  disconnect(destination?: AudioParam | AudioNode): void {
    if (destination) {
      if (destination instanceof AudioParam) {
        this.outputGain.disconnect(destination);
      } else {
        this.outputGain.disconnect(destination);
      }
    } else {
      this.outputGain.disconnect();
    }
  }

  // ===========================================
  // GETTERS
  // ===========================================

  get currentParams(): LFOParams {
    return { ...this.params };
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose of the LFO and free resources.
   */
  dispose(): void {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
    }

    if (this.randomInterval) {
      clearInterval(this.randomInterval);
    }

    if (this.valueUpdateInterval) {
      clearInterval(this.valueUpdateInterval);
    }

    this.dcOffset.stop();
    this.dcOffset.disconnect();
    this.depthGain.disconnect();
    this.outputGain.disconnect();

    console.log('[LFONode] Disposed');
  }
}

export default LFONode;
