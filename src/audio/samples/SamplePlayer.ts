/**
 * SamplePlayer - High-quality sample playback with musical controls.
 * 
 * Features:
 * - Pitch control via semitones/cents (affects playback rate)
 * - Smooth attack/release envelope to prevent clicks
 * - Loop mode with crossfade
 * - Reverse playback
 * - Sample-accurate scheduling
 * - Pan control
 * 
 * Note: This uses native Web Audio API nodes. For time-stretching
 * (independent pitch/duration control), use the TimeStretchProcessor worklet.
 * 
 * @module audio/samples/SamplePlayer
 */

import type { SamplePlayerConfig, LoadedSample } from './types';
import { pitchToPlaybackRate } from './types';

// ===========================================
// DEFAULT CONFIG
// ===========================================

const DEFAULT_CONFIG: SamplePlayerConfig = {
  sampleId: '',
  pitch: 0,
  fineTune: 0,
  playbackRate: 1,
  reverse: false,
  timeStretch: false,
  stretchRatio: 1,
  stretchAlgorithm: 'granular',
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 0,
  loopCrossfade: 10,
  attack: 0.01,
  release: 0.05,
  gain: 0.8,
  pan: 0,
};

// ===========================================
// SAMPLE PLAYER CLASS
// ===========================================

export class SamplePlayer {
  private audioContext: AudioContext;
  private buffer: AudioBuffer | null = null;
  private config: SamplePlayerConfig;
  
  // Audio nodes
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private panNode: StereoPannerNode;
  private outputNode: GainNode; // Final output (for connecting to graph)
  
  // State
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pausePosition: number = 0;
  private onEndedCallback?: () => void;

  constructor(audioContext: AudioContext, config?: Partial<SamplePlayerConfig>) {
    this.audioContext = audioContext;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Create processing chain
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = this.config.gain;
    
    this.panNode = audioContext.createStereoPanner();
    this.panNode.pan.value = this.config.pan;
    
    this.outputNode = audioContext.createGain();
    this.outputNode.gain.value = 1;
    
    // Connect chain: source → gain → pan → output
    this.gainNode.connect(this.panNode);
    this.panNode.connect(this.outputNode);
  }

  // ===========================================
  // BUFFER MANAGEMENT
  // ===========================================

  /**
   * Set the audio buffer to play.
   */
  setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
    
    // Update loop end to buffer duration if not set
    if (this.config.loopEnd === 0) {
      this.config.loopEnd = buffer.duration;
    }
  }

  /**
   * Set buffer from a loaded sample.
   */
  setSample(sample: LoadedSample): void {
    this.setBuffer(sample.buffer);
    this.config.sampleId = sample.id;
  }

  /**
   * Get the current buffer.
   */
  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  // ===========================================
  // PLAYBACK CONTROL
  // ===========================================

  /**
   * Trigger playback.
   * @param when - AudioContext time to start (0 = immediately)
   * @param offset - Start position in seconds
   * @param duration - Play duration (undefined = full sample)
   */
  trigger(when: number = 0, offset: number = 0, duration?: number): void {
    if (!this.buffer) {
      console.warn('[SamplePlayer] No buffer loaded');
      return;
    }

    // Stop any existing playback
    this.stop(0);

    // Create new source node (they're single-use)
    this.sourceNode = this.audioContext.createBufferSource();
    
    // Apply buffer (reverse if needed)
    if (this.config.reverse) {
      this.sourceNode.buffer = this.createReversedBuffer(this.buffer);
    } else {
      this.sourceNode.buffer = this.buffer;
    }

    // Apply pitch via playback rate
    const rate = pitchToPlaybackRate(this.config.pitch, this.config.fineTune);
    this.sourceNode.playbackRate.value = rate;

    // Apply loop settings
    if (this.config.loopEnabled) {
      this.sourceNode.loop = true;
      this.sourceNode.loopStart = this.config.loopStart;
      this.sourceNode.loopEnd = this.config.loopEnd;
    }

    // Connect to gain node
    this.sourceNode.connect(this.gainNode);

    // Apply attack envelope
    const now = this.audioContext.currentTime;
    const startAt = when > 0 ? when : now;
    
    this.gainNode.gain.cancelScheduledValues(startAt);
    this.gainNode.gain.setValueAtTime(0, startAt);
    this.gainNode.gain.linearRampToValueAtTime(
      this.config.gain, 
      startAt + this.config.attack
    );

    // Schedule playback
    if (duration !== undefined) {
      this.sourceNode.start(startAt, offset, duration);
    } else {
      this.sourceNode.start(startAt, offset);
    }

    // Handle ended event
    this.sourceNode.onended = () => {
      this.isPlaying = false;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };

    this.isPlaying = true;
    this.startTime = startAt;
    this.pausePosition = offset;
  }

  /**
   * Stop playback with release envelope.
   * @param releaseTime - Release duration in seconds (0 = immediate)
   */
  stop(releaseTime?: number): void {
    if (!this.sourceNode || !this.isPlaying) return;

    const release = releaseTime ?? this.config.release;
    const now = this.audioContext.currentTime;

    if (release > 0) {
      // Smooth release
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + release);
      
      // Schedule actual stop after release
      this.sourceNode.stop(now + release + 0.01);
    } else {
      // Immediate stop
      this.sourceNode.stop(now);
    }

    this.isPlaying = false;
  }

  /**
   * Pause playback (remembers position).
   */
  pause(): void {
    if (!this.isPlaying || !this.sourceNode) return;

    // Calculate current position
    const now = this.audioContext.currentTime;
    const elapsed = (now - this.startTime) * this.sourceNode.playbackRate.value;
    this.pausePosition += elapsed;

    // Handle looping
    if (this.config.loopEnabled) {
      const loopDuration = this.config.loopEnd - this.config.loopStart;
      if (loopDuration > 0 && this.pausePosition > this.config.loopEnd) {
        this.pausePosition = this.config.loopStart + 
          ((this.pausePosition - this.config.loopStart) % loopDuration);
      }
    }

    this.stop(0.01);
  }

  /**
   * Resume from paused position.
   */
  resume(): void {
    if (this.isPlaying) return;
    this.trigger(0, this.pausePosition);
  }

  /**
   * Retrigger (stop and start from beginning).
   */
  retrigger(): void {
    this.stop(0);
    this.trigger(0, 0);
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  /**
   * Set pitch in semitones.
   */
  setPitch(semitones: number, fineTune: number = 0): void {
    this.config.pitch = semitones;
    this.config.fineTune = fineTune;
    
    if (this.sourceNode) {
      const rate = pitchToPlaybackRate(semitones, fineTune);
      this.sourceNode.playbackRate.setTargetAtTime(
        rate, 
        this.audioContext.currentTime, 
        0.01
      );
    }
  }

  /**
   * Set output gain.
   */
  setGain(gain: number): void {
    this.config.gain = Math.max(0, Math.min(1, gain));
    this.gainNode.gain.setTargetAtTime(
      this.config.gain,
      this.audioContext.currentTime,
      0.01
    );
  }

  /**
   * Set stereo pan.
   */
  setPan(pan: number): void {
    this.config.pan = Math.max(-1, Math.min(1, pan));
    this.panNode.pan.setTargetAtTime(
      this.config.pan,
      this.audioContext.currentTime,
      0.01
    );
  }

  /**
   * Set loop mode.
   */
  setLoop(enabled: boolean, start?: number, end?: number): void {
    this.config.loopEnabled = enabled;
    if (start !== undefined) this.config.loopStart = start;
    if (end !== undefined) this.config.loopEnd = end;

    if (this.sourceNode) {
      this.sourceNode.loop = enabled;
      this.sourceNode.loopStart = this.config.loopStart;
      this.sourceNode.loopEnd = this.config.loopEnd;
    }
  }

  /**
   * Set attack time.
   */
  setAttack(seconds: number): void {
    this.config.attack = Math.max(0, Math.min(2, seconds));
  }

  /**
   * Set release time.
   */
  setRelease(seconds: number): void {
    this.config.release = Math.max(0, Math.min(5, seconds));
  }

  /**
   * Set reverse mode.
   * Note: Requires retrigger to take effect.
   */
  setReverse(enabled: boolean): void {
    this.config.reverse = enabled;
  }

  /**
   * Update multiple config properties.
   */
  setConfig(config: Partial<SamplePlayerConfig>): void {
    Object.assign(this.config, config);
    
    // Apply immediate changes
    if (config.gain !== undefined) this.setGain(config.gain);
    if (config.pan !== undefined) this.setPan(config.pan);
    if (config.pitch !== undefined || config.fineTune !== undefined) {
      this.setPitch(this.config.pitch, this.config.fineTune);
    }
  }

  /**
   * Get current config.
   */
  getConfig(): SamplePlayerConfig {
    return { ...this.config };
  }

  // ===========================================
  // STATE QUERIES
  // ===========================================

  /**
   * Check if currently playing.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current playback position in seconds.
   */
  getPosition(): number {
    if (!this.isPlaying || !this.sourceNode) {
      return this.pausePosition;
    }

    const now = this.audioContext.currentTime;
    const elapsed = (now - this.startTime) * this.sourceNode.playbackRate.value;
    let position = this.pausePosition + elapsed;

    // Handle looping
    if (this.config.loopEnabled && this.buffer) {
      const loopDuration = this.config.loopEnd - this.config.loopStart;
      if (loopDuration > 0 && position > this.config.loopEnd) {
        position = this.config.loopStart + 
          ((position - this.config.loopStart) % loopDuration);
      }
    }

    return position;
  }

  /**
   * Get playback progress (0-1).
   */
  getProgress(): number {
    if (!this.buffer) return 0;
    return this.getPosition() / this.buffer.duration;
  }

  /**
   * Set callback for when playback ends.
   */
  onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  // ===========================================
  // CONNECTION
  // ===========================================

  /**
   * Get the output node for connecting to audio graph.
   */
  getOutputNode(): AudioNode {
    return this.outputNode;
  }

  /**
   * Connect output to destination.
   */
  connect(destination: AudioNode | AudioParam): void {
    if (destination instanceof AudioParam) {
      this.outputNode.connect(destination);
    } else {
      this.outputNode.connect(destination);
    }
  }

  /**
   * Disconnect from all destinations.
   */
  disconnect(): void {
    this.outputNode.disconnect();
  }

  // ===========================================
  // UTILITIES
  // ===========================================

  /**
   * Create a reversed copy of an AudioBuffer.
   */
  private createReversedBuffer(buffer: AudioBuffer): AudioBuffer {
    const reversed = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = reversed.getChannelData(ch);
      
      for (let i = 0; i < buffer.length; i++) {
        dest[i] = source[buffer.length - 1 - i];
      }
    }

    return reversed;
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.stop(0);
    this.disconnect();
    this.buffer = null;
  }
}

export default SamplePlayer;
