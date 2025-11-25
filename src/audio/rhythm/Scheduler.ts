/**
 * Lookahead Scheduler - Sample-accurate timing for rhythmic events.
 * 
 * Uses the "lookahead" technique to ensure timing accuracy:
 * 1. A setInterval runs every ~25ms
 * 2. It looks ahead ~100ms into the future
 * 3. Events are scheduled with exact AudioContext times
 * 
 * This prevents main-thread lag from affecting audio timing.
 * 
 * @module audio/rhythm/Scheduler
 */

import type {
  TriggerEvent,
  SequenceStep,
  SchedulerConfig,
  TrackState,
  ClockEvent,
} from './types';
import { DEFAULT_SCHEDULER_CONFIG } from './types';

// ===========================================
// TYPES
// ===========================================

export type TriggerCallback = (event: TriggerEvent) => void;
export type ClockCallback = (event: ClockEvent) => void;

// ===========================================
// SCHEDULER CLASS
// ===========================================

export class Scheduler {
  private audioContext: AudioContext;
  private config: SchedulerConfig;
  
  // Timing state
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private startTime = 0;
  
  // Tracks
  private tracks: Map<string, TrackState> = new Map();
  
  // Callbacks
  private triggerCallbacks: Map<string, TriggerCallback[]> = new Map();
  private clockCallbacks: ClockCallback[] = [];
  
  // Visual sync
  private lastScheduledBeat = 0;
  private lastScheduledBar = 0;

  constructor(audioContext: AudioContext, config: Partial<SchedulerConfig> = {}) {
    this.audioContext = audioContext;
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  // ===========================================
  // PLAYBACK CONTROL
  // ===========================================

  /**
   * Start the scheduler.
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = this.audioContext.currentTime;
    
    // Reset all tracks to beginning
    for (const track of this.tracks.values()) {
      track.currentStep = 0;
      track.nextStepTime = this.startTime;
      track.loopCount = 0;
      track.isPlaying = true;
    }
    
    // Start the lookahead interval
    this.intervalId = setInterval(() => this.tick(), this.config.intervalMs);
    
    console.log('[Scheduler] Started at', this.startTime.toFixed(3));
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Stop all tracks
    for (const track of this.tracks.values()) {
      track.isPlaying = false;
    }
    
    console.log('[Scheduler] Stopped');
  }

  /**
   * Pause/resume the scheduler.
   */
  toggle(): void {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  // ===========================================
  // TRACK MANAGEMENT
  // ===========================================

  /**
   * Add a new track to the scheduler.
   */
  addTrack(
    id: string,
    pattern: SequenceStep[],
    stepsPerBeat: number = 4
  ): void {
    const track: TrackState = {
      id,
      isPlaying: false,
      currentStep: 0,
      nextStepTime: 0,
      loopCount: 0,
      stepsPerBeat,
      totalSteps: pattern.length,
      pattern,
    };
    
    this.tracks.set(id, track);
    this.triggerCallbacks.set(id, []);
    
    // If scheduler is already running, start this track
    if (this.isRunning) {
      track.isPlaying = true;
      track.nextStepTime = this.audioContext.currentTime;
    }
  }

  /**
   * Remove a track from the scheduler.
   */
  removeTrack(id: string): void {
    this.tracks.delete(id);
    this.triggerCallbacks.delete(id);
  }

  /**
   * Update a track's pattern.
   */
  updatePattern(id: string, pattern: SequenceStep[]): void {
    const track = this.tracks.get(id);
    if (track) {
      track.pattern = pattern;
      track.totalSteps = pattern.length;
    }
  }

  /**
   * Update a track's steps per beat (for polyrhythms).
   */
  setStepsPerBeat(id: string, stepsPerBeat: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.stepsPerBeat = stepsPerBeat;
    }
  }

  /**
   * Set a single step's properties.
   */
  setStep(id: string, stepIndex: number, step: Partial<SequenceStep>): void {
    const track = this.tracks.get(id);
    if (track && stepIndex < track.pattern.length) {
      track.pattern[stepIndex] = { ...track.pattern[stepIndex], ...step };
    }
  }

  /**
   * Toggle a step's active state.
   */
  toggleStep(id: string, stepIndex: number): void {
    const track = this.tracks.get(id);
    if (track && stepIndex < track.pattern.length) {
      track.pattern[stepIndex].active = !track.pattern[stepIndex].active;
    }
  }

  // ===========================================
  // CONFIGURATION
  // ===========================================

  /**
   * Set the tempo in BPM.
   */
  setTempo(bpm: number): void {
    this.config.bpm = Math.max(20, Math.min(300, bpm));
  }

  /**
   * Set swing amount (0.0 - 1.0).
   */
  setSwing(swing: number): void {
    this.config.swing = Math.max(0, Math.min(1, swing));
  }

  /**
   * Get current tempo.
   */
  get bpm(): number {
    return this.config.bpm;
  }

  /**
   * Get current beat position (fractional).
   */
  get beatPosition(): number {
    if (!this.isRunning) return 0;
    const elapsed = this.audioContext.currentTime - this.startTime;
    return (elapsed * this.config.bpm) / 60;
  }

  /**
   * Get current bar number.
   */
  get barNumber(): number {
    return Math.floor(this.beatPosition / this.config.beatsPerBar);
  }

  // ===========================================
  // CALLBACKS
  // ===========================================

  /**
   * Register a callback for trigger events from a specific track.
   */
  onTrigger(trackId: string, callback: TriggerCallback): () => void {
    const callbacks = this.triggerCallbacks.get(trackId);
    if (callbacks) {
      callbacks.push(callback);
    }
    
    // Return unsubscribe function
    return () => {
      const cbs = this.triggerCallbacks.get(trackId);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx !== -1) cbs.splice(idx, 1);
      }
    };
  }

  /**
   * Register a callback for clock events (beats, bars).
   */
  onClock(callback: ClockCallback): () => void {
    this.clockCallbacks.push(callback);
    
    return () => {
      const idx = this.clockCallbacks.indexOf(callback);
      if (idx !== -1) this.clockCallbacks.splice(idx, 1);
    };
  }

  // ===========================================
  // CORE SCHEDULING LOOP
  // ===========================================

  /**
   * The main scheduling tick - called every intervalMs.
   */
  private tick(): void {
    if (!this.isRunning) return;
    
    const now = this.audioContext.currentTime;
    const lookahead = now + this.config.lookaheadMs / 1000;
    
    // Process each track
    for (const track of this.tracks.values()) {
      if (!track.isPlaying) continue;
      
      // Schedule all steps that fall within the lookahead window
      while (track.nextStepTime < lookahead) {
        this.scheduleStep(track);
        this.advanceStep(track);
      }
    }
    
    // Emit clock events
    this.emitClockEvents(now, lookahead);
  }

  /**
   * Schedule a single step for a track.
   */
  private scheduleStep(track: TrackState): void {
    const step = track.pattern[track.currentStep];
    if (!step) return;
    
    // Check probability and conditions
    if (!this.shouldTrigger(step, track)) return;
    
    // Apply swing to off-beats
    let time = track.nextStepTime;
    if (track.currentStep % 2 === 1 && this.config.swing > 0) {
      const swingAmount = this.getStepDuration(track) * this.config.swing * 0.5;
      time += swingAmount;
    }
    
    // Create and emit trigger event
    const event: TriggerEvent = {
      type: 'trigger',
      time,
      velocity: step.velocity,
      pitch: step.pitchOffset ? 440 * Math.pow(2, step.pitchOffset / 12) : undefined,
      sourceId: track.id,
      step: track.currentStep,
    };
    
    this.emitTrigger(track.id, event);
  }

  /**
   * Advance a track to the next step.
   */
  private advanceStep(track: TrackState): void {
    track.nextStepTime += this.getStepDuration(track);
    track.currentStep++;
    
    // Handle loop
    if (track.currentStep >= track.totalSteps) {
      track.currentStep = 0;
      track.loopCount++;
    }
  }

  /**
   * Check if a step should trigger based on probability and conditions.
   */
  private shouldTrigger(step: SequenceStep, track: TrackState): boolean {
    if (!step.active) return false;
    
    // Check probability
    if (step.probability < 1 && Math.random() >= step.probability) {
      return false;
    }
    
    // Check conditions
    if (step.condition) {
      switch (step.condition.type) {
        case 'first':
          return track.loopCount === 0;
        case 'not_first':
          return track.loopCount > 0;
        case 'every_n':
          return step.condition.n ? track.loopCount % step.condition.n === 0 : true;
        case 'fill':
          // Fill would be controlled by external state
          return false;
        case 'always':
        default:
          return true;
      }
    }
    
    return true;
  }

  /**
   * Get the duration of one step in seconds.
   */
  private getStepDuration(track: TrackState): number {
    const beatDuration = 60 / this.config.bpm;
    return beatDuration / track.stepsPerBeat;
  }

  /**
   * Emit trigger event to all registered callbacks.
   */
  private emitTrigger(trackId: string, event: TriggerEvent): void {
    const callbacks = this.triggerCallbacks.get(trackId);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(event);
      }
    }
  }

  /**
   * Emit clock events for beats and bars.
   */
  private emitClockEvents(now: number, lookahead: number): void {
    const beatDuration = 60 / this.config.bpm;
    
    // Find beats in the lookahead window
    let beat = this.lastScheduledBeat;
    let beatTime = this.startTime + beat * beatDuration;
    
    while (beatTime < lookahead) {
      if (beatTime >= now) {
        const bar = Math.floor(beat / this.config.beatsPerBar);
        const isBarStart = beat % this.config.beatsPerBar === 0;
        
        // Emit beat event
        const beatEvent: ClockEvent = {
          type: 'beat',
          time: beatTime,
          beat: beat % this.config.beatsPerBar,
          bar,
        };
        this.emitClock(beatEvent);
        
        // Emit bar event if this is the start of a bar
        if (isBarStart && bar > this.lastScheduledBar) {
          const barEvent: ClockEvent = {
            type: 'bar',
            time: beatTime,
            beat: 0,
            bar,
          };
          this.emitClock(barEvent);
          this.lastScheduledBar = bar;
        }
      }
      
      beat++;
      beatTime = this.startTime + beat * beatDuration;
    }
    
    this.lastScheduledBeat = beat;
  }

  /**
   * Emit clock event to all registered callbacks.
   */
  private emitClock(event: ClockEvent): void {
    for (const callback of this.clockCallbacks) {
      callback(event);
    }
  }

  // ===========================================
  // GETTERS
  // ===========================================

  /**
   * Get current state for visualization.
   */
  getVisualizationState(): {
    isRunning: boolean;
    bpm: number;
    beatPosition: number;
    barNumber: number;
    tracks: Map<string, { currentStep: number; totalSteps: number }>;
  } {
    const tracks = new Map<string, { currentStep: number; totalSteps: number }>();
    
    for (const [id, track] of this.tracks) {
      tracks.set(id, {
        currentStep: track.currentStep,
        totalSteps: track.totalSteps,
      });
    }
    
    return {
      isRunning: this.isRunning,
      bpm: this.config.bpm,
      beatPosition: this.beatPosition,
      barNumber: this.barNumber,
      tracks,
    };
  }

  /**
   * Get track state by ID.
   */
  getTrack(id: string): TrackState | undefined {
    return this.tracks.get(id);
  }

  /**
   * Check if scheduler is currently running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose of the scheduler.
   */
  dispose(): void {
    this.stop();
    this.tracks.clear();
    this.triggerCallbacks.clear();
    this.clockCallbacks = [];
    console.log('[Scheduler] Disposed');
  }
}

export default Scheduler;
