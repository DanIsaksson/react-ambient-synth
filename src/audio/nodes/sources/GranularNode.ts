/**
 * GranularNode - Main thread wrapper for the GranularProcessor AudioWorklet.
 * 
 * Provides a high-level API for granular synthesis:
 * - Load samples and transfer to worklet
 * - Control playback and parameters
 * - Connect to audio graph
 * 
 * @module audio/nodes/sources/GranularNode
 */

import type { SampleManager, LoadedSample } from '../../engine/SampleManager';

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface GranularParams {
  /** Position in buffer (0-1) */
  position: number;
  /** Position randomness (0-1) */
  spray: number;
  /** Grains per second */
  density: number;
  /** Grain duration in seconds */
  size: number;
  /** Playback rate (1.0 = normal) */
  pitch: number;
  /** Pitch randomness in semitones */
  pitchSpray: number;
  /** Output gain (0-1) */
  gain: number;
  /** Stereo pan (0=L, 0.5=C, 1=R) */
  pan: number;
  /** Probability of reversed grains (0-1) */
  reverse: number;
}

export interface GranularNodeOptions {
  /** Initial parameters */
  params?: Partial<GranularParams>;
}

// ===========================================
// DEFAULT PARAMETERS
// ===========================================

const DEFAULT_PARAMS: GranularParams = {
  position: 0.5,
  spray: 0.1,
  density: 20,
  size: 0.1,
  pitch: 1.0,
  pitchSpray: 0,
  gain: 0.5,
  pan: 0.5,
  reverse: 0,
};

// ===========================================
// GRANULAR NODE CLASS
// ===========================================

export class GranularNode {
  private audioContext: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode;
  private isInitialized = false;
  private isPlaying = false;
  private currentSampleId: string | null = null;
  private params: GranularParams;

  constructor(audioContext: AudioContext, options: GranularNodeOptions = {}) {
    this.audioContext = audioContext;
    this.params = { ...DEFAULT_PARAMS, ...options.params };

    // Create gain node for volume control and connections
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 1.0;
  }

  // ===========================================
  // INITIALIZATION
  // ===========================================

  /**
   * Initialize the AudioWorklet.
   * Must be called before any other methods.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Register the worklet processor
      await this.audioContext.audioWorklet.addModule('/src/audio/worklets/granular-processor.js');

      // Create the worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'granular-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2], // Stereo output
      });

      // Connect worklet to gain node
      this.workletNode.connect(this.gainNode);

      // Set initial parameters
      this.setParams(this.params);

      this.isInitialized = true;
      console.log('[GranularNode] Initialized');
    } catch (error) {
      console.error('[GranularNode] Failed to initialize:', error);
      throw error;
    }
  }

  // ===========================================
  // SAMPLE MANAGEMENT
  // ===========================================

  /**
   * Load a sample from the SampleManager and transfer to worklet.
   */
  async loadSample(sampleManager: SampleManager, sampleId: string): Promise<void> {
    if (!this.workletNode) {
      throw new Error('GranularNode not initialized. Call init() first.');
    }

    // Load sample via manager
    const sample = await sampleManager.loadSample(sampleId);
    this.transferSampleToWorklet(sample);
    this.currentSampleId = sampleId;
  }

  /**
   * Load a sample directly from a LoadedSample object.
   */
  loadSampleDirect(sample: LoadedSample): void {
    if (!this.workletNode) {
      throw new Error('GranularNode not initialized. Call init() first.');
    }

    this.transferSampleToWorklet(sample);
    this.currentSampleId = sample.id;
  }

  /**
   * Transfer sample data to the AudioWorklet.
   */
  private transferSampleToWorklet(sample: LoadedSample): void {
    if (!this.workletNode) return;

    const { channelData, sampleRate } = sample;

    // Create copies for transfer (original arrays get detached)
    const left = new Float32Array(channelData[0]);
    const right = channelData.length > 1 
      ? new Float32Array(channelData[1]) 
      : new Float32Array(channelData[0]);

    // Send to worklet with transferable arrays
    this.workletNode.port.postMessage(
      {
        action: 'SET_BUFFER',
        payload: { left, right, sampleRate },
      },
      [left.buffer, right.buffer] // Transfer ownership
    );

    console.log(`[GranularNode] Sample loaded: ${sample.name}`);
  }

  // ===========================================
  // PLAYBACK CONTROL
  // ===========================================

  /**
   * Start granular playback.
   */
  play(): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({ action: 'PLAY' });
    this.isPlaying = true;
  }

  /**
   * Stop granular playback.
   */
  stop(): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({ action: 'STOP' });
    this.isPlaying = false;
  }

  /**
   * Trigger a single grain burst.
   */
  trigger(): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({ action: 'TRIGGER' });
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  /**
   * Set multiple parameters at once.
   */
  setParams(params: Partial<GranularParams>): void {
    Object.assign(this.params, params);

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        action: 'SET_PARAMS',
        payload: this.params,
      });
    }
  }

  /**
   * Set position in buffer (0-1).
   */
  setPosition(value: number): void {
    this.setParams({ position: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set position spray/jitter (0-1).
   */
  setSpray(value: number): void {
    this.setParams({ spray: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set grain density (grains per second).
   */
  setDensity(value: number): void {
    this.setParams({ density: Math.max(1, Math.min(100, value)) });
  }

  /**
   * Set grain size in seconds.
   */
  setSize(value: number): void {
    this.setParams({ size: Math.max(0.01, Math.min(0.5, value)) });
  }

  /**
   * Set pitch (playback rate).
   */
  setPitch(value: number): void {
    this.setParams({ pitch: Math.max(0.25, Math.min(4, value)) });
  }

  /**
   * Set pitch spray in semitones.
   */
  setPitchSpray(value: number): void {
    this.setParams({ pitchSpray: Math.max(0, Math.min(24, value)) });
  }

  /**
   * Set output gain (0-1).
   */
  setGain(value: number): void {
    this.setParams({ gain: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set stereo pan (0=L, 0.5=C, 1=R).
   */
  setPan(value: number): void {
    this.setParams({ pan: Math.max(0, Math.min(1, value)) });
  }

  /**
   * Set reverse probability (0-1).
   */
  setReverse(value: number): void {
    this.setParams({ reverse: Math.max(0, Math.min(1, value)) });
  }

  // ===========================================
  // CONNECTIONS
  // ===========================================

  /**
   * Get the output node for connecting to audio graph.
   */
  get output(): GainNode {
    return this.gainNode;
  }

  /**
   * Connect to a destination node.
   */
  connect(destination: AudioNode | AudioParam): void {
    this.gainNode.connect(destination as AudioNode);
  }

  /**
   * Disconnect from all or specific destination.
   */
  disconnect(destination?: AudioNode | AudioParam): void {
    if (destination) {
      this.gainNode.disconnect(destination as AudioNode);
    } else {
      this.gainNode.disconnect();
    }
  }

  // ===========================================
  // GETTERS
  // ===========================================

  get playing(): boolean {
    return this.isPlaying;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  get sampleId(): string | null {
    return this.currentSampleId;
  }

  get currentParams(): GranularParams {
    return { ...this.params };
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose of the node and free resources.
   */
  dispose(): void {
    this.stop();

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    this.gainNode.disconnect();
    this.isInitialized = false;
    this.currentSampleId = null;

    console.log('[GranularNode] Disposed');
  }
}

export default GranularNode;
