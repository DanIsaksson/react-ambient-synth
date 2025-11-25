/**
 * ConvolutionReverbNode - High-quality convolution reverb using impulse responses.
 * 
 * Features:
 * - Load impulse responses (IRs) for realistic acoustic spaces
 * - Wet/dry mix control
 * - Pre-delay for spatial separation
 * - High/low frequency damping
 * - Built-in IR library with Cathedral, Room, Cave, Plate presets
 * 
 * Architecture:
 * Input → [Dry Path] ────────────────────────────→ [Mix] → Output
 *       → [Pre-delay] → [EQ] → [Convolver] → [Wet] ─┘
 * 
 * @module audio/nodes/effects/ConvolutionReverbNode
 */

import type { SampleManager } from '../../engine/SampleManager';

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface ConvolutionReverbParams {
  /** Wet/dry mix (0 = dry, 1 = wet) */
  mix: number;
  /** Pre-delay in milliseconds */
  preDelay: number;
  /** High frequency damping (0-1) */
  highDamp: number;
  /** Low frequency damping (0-1) */
  lowDamp: number;
  /** Output level (0-1) */
  level: number;
}

export interface ConvolutionReverbOptions {
  /** Initial parameters */
  params?: Partial<ConvolutionReverbParams>;
}

// ===========================================
// BUILT-IN IR PRESETS
// ===========================================

export const IR_PRESETS = {
  cathedral: {
    id: 'ir-cathedral',
    name: 'Cathedral',
    description: 'Large reverberant cathedral space',
    decay: 4.5,
  },
  smallRoom: {
    id: 'ir-small-room',
    name: 'Small Room',
    description: 'Intimate room ambience',
    decay: 0.8,
  },
  cave: {
    id: 'ir-cave',
    name: 'Cave',
    description: 'Dark, resonant cave',
    decay: 3.2,
  },
  plate: {
    id: 'ir-plate',
    name: 'Plate',
    description: 'Classic plate reverb',
    decay: 2.0,
  },
} as const;

export type IRPresetName = keyof typeof IR_PRESETS;

// ===========================================
// DEFAULT PARAMETERS
// ===========================================

const DEFAULT_PARAMS: ConvolutionReverbParams = {
  mix: 0.3,
  preDelay: 20,
  highDamp: 0.3,
  lowDamp: 0.1,
  level: 1.0,
};

// ===========================================
// CONVOLUTION REVERB NODE CLASS
// ===========================================

export class ConvolutionReverbNode {
  private audioContext: AudioContext;
  private params: ConvolutionReverbParams;

  // Audio nodes
  private inputGain: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private preDelayNode: DelayNode;
  private convolver: ConvolverNode;
  private highShelf: BiquadFilterNode;
  private lowShelf: BiquadFilterNode;
  private outputGain: GainNode;

  // State
  private currentIRId: string | null = null;
  private isInitialized = false;

  constructor(audioContext: AudioContext, options: ConvolutionReverbOptions = {}) {
    this.audioContext = audioContext;
    this.params = { ...DEFAULT_PARAMS, ...options.params };

    // ===========================================
    // CREATE AUDIO NODES
    // ===========================================

    // Input stage
    this.inputGain = audioContext.createGain();
    this.inputGain.gain.value = 1.0;

    // Dry path
    this.dryGain = audioContext.createGain();

    // Wet path: Pre-delay → EQ → Convolver → Wet gain
    this.preDelayNode = audioContext.createDelay(0.5); // Max 500ms pre-delay
    
    // High frequency damping (shelf filter)
    this.highShelf = audioContext.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.value = 4000;

    // Low frequency damping (shelf filter)
    this.lowShelf = audioContext.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = 200;

    // Convolver
    this.convolver = audioContext.createConvolver();
    this.convolver.normalize = true;

    // Wet gain
    this.wetGain = audioContext.createGain();

    // Output
    this.outputGain = audioContext.createGain();

    // ===========================================
    // CONNECT AUDIO GRAPH
    // ===========================================

    // Dry path: Input → Dry Gain → Output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Wet path: Input → Pre-delay → Low EQ → High EQ → Convolver → Wet Gain → Output
    this.inputGain.connect(this.preDelayNode);
    this.preDelayNode.connect(this.lowShelf);
    this.lowShelf.connect(this.highShelf);
    this.highShelf.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial parameters
    this.applyParams();

    this.isInitialized = true;
    console.log('[ConvolutionReverbNode] Initialized');
  }

  // ===========================================
  // IMPULSE RESPONSE LOADING
  // ===========================================

  /**
   * Load an IR from the SampleManager.
   */
  async loadIR(sampleManager: SampleManager, irId: string): Promise<void> {
    const sample = await sampleManager.loadSample(irId);
    this.setIRBuffer(sample.buffer);
    this.currentIRId = irId;
  }

  /**
   * Load an IR by preset name.
   */
  async loadPreset(sampleManager: SampleManager, preset: IRPresetName): Promise<void> {
    const presetConfig = IR_PRESETS[preset];
    await this.loadIR(sampleManager, presetConfig.id);
  }

  /**
   * Set the IR buffer directly.
   */
  setIRBuffer(buffer: AudioBuffer): void {
    this.convolver.buffer = buffer;
    console.log(`[ConvolutionReverbNode] IR loaded: ${buffer.duration.toFixed(2)}s`);
  }

  /**
   * Generate a synthetic IR for testing (algorithmic reverb).
   */
  generateSyntheticIR(duration: number = 2, decay: number = 0.5): void {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        // Exponential decay with random noise
        const t = i / length;
        const envelope = Math.exp(-decay * 6 * t);
        
        // Random reverb tail with some diffusion
        const noise = (Math.random() * 2 - 1);
        
        // Add some early reflections
        let earlyReflections = 0;
        if (i < sampleRate * 0.1) {
          const reflectionTimes = [0.013, 0.027, 0.041, 0.055, 0.069];
          for (const rt of reflectionTimes) {
            const reflectionSample = Math.floor(rt * sampleRate);
            if (i === reflectionSample) {
              earlyReflections = (Math.random() - 0.5) * 0.5;
            }
          }
        }
        
        data[i] = (noise * envelope + earlyReflections) * 0.5;
      }
    }

    this.setIRBuffer(buffer);
    this.currentIRId = 'synthetic';
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  /**
   * Set multiple parameters at once.
   */
  setParams(params: Partial<ConvolutionReverbParams>): void {
    Object.assign(this.params, params);
    this.applyParams();
  }

  /**
   * Apply current parameters to audio nodes.
   */
  private applyParams(): void {
    const { mix, preDelay, highDamp, lowDamp, level } = this.params;
    const now = this.audioContext.currentTime;

    // Wet/dry mix (equal power crossfade)
    const dryLevel = Math.cos(mix * Math.PI * 0.5);
    const wetLevel = Math.sin(mix * Math.PI * 0.5);
    
    this.dryGain.gain.setTargetAtTime(dryLevel, now, 0.02);
    this.wetGain.gain.setTargetAtTime(wetLevel, now, 0.02);

    // Pre-delay
    this.preDelayNode.delayTime.setTargetAtTime(preDelay / 1000, now, 0.02);

    // High frequency damping (negative dB)
    const highDampDb = -highDamp * 12; // 0 to -12 dB
    this.highShelf.gain.setTargetAtTime(highDampDb, now, 0.02);

    // Low frequency damping
    const lowDampDb = -lowDamp * 12;
    this.lowShelf.gain.setTargetAtTime(lowDampDb, now, 0.02);

    // Output level
    this.outputGain.gain.setTargetAtTime(level, now, 0.02);
  }

  /**
   * Set wet/dry mix (0-1).
   */
  setMix(value: number): void {
    this.setParams({ mix: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set pre-delay in milliseconds.
   */
  setPreDelay(ms: number): void {
    this.setParams({ preDelay: Math.max(0, Math.min(500, ms)) });
  }

  /**
   * Set high frequency damping (0-1).
   */
  setHighDamp(value: number): void {
    this.setParams({ highDamp: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set low frequency damping (0-1).
   */
  setLowDamp(value: number): void {
    this.setParams({ lowDamp: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set output level (0-1).
   */
  setLevel(value: number): void {
    this.setParams({ level: Math.max(0, Math.min(2, value)) });
  }

  // ===========================================
  // CONNECTIONS
  // ===========================================

  /**
   * Get the input node for connections.
   */
  get input(): GainNode {
    return this.inputGain;
  }

  /**
   * Get the output node for connections.
   */
  get output(): GainNode {
    return this.outputGain;
  }

  /**
   * Connect an audio source to the reverb input.
   */
  connectInput(source: AudioNode): void {
    source.connect(this.inputGain);
  }

  /**
   * Connect the reverb output to a destination.
   */
  connect(destination: AudioNode | AudioParam): void {
    this.outputGain.connect(destination as AudioNode);
  }

  /**
   * Disconnect from destination.
   */
  disconnect(destination?: AudioNode | AudioParam): void {
    if (destination) {
      this.outputGain.disconnect(destination as AudioNode);
    } else {
      this.outputGain.disconnect();
    }
  }

  // ===========================================
  // GETTERS
  // ===========================================

  get irId(): string | null {
    return this.currentIRId;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  get currentParams(): ConvolutionReverbParams {
    return { ...this.params };
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose of the node and free resources.
   */
  dispose(): void {
    this.inputGain.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.preDelayNode.disconnect();
    this.highShelf.disconnect();
    this.lowShelf.disconnect();
    this.convolver.disconnect();
    this.outputGain.disconnect();

    // Clear the convolver buffer to free memory
    this.convolver.buffer = null;
    
    this.isInitialized = false;
    this.currentIRId = null;

    console.log('[ConvolutionReverbNode] Disposed');
  }
}

export default ConvolutionReverbNode;
