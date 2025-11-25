/**
 * Rhythmic Intelligence Types
 * 
 * Defines the event system for graph-based rhythm triggering.
 * 
 * @module audio/rhythm/types
 */

// ===========================================
// TRIGGER EVENTS
// ===========================================

/**
 * A trigger event sent from sequencers to audio nodes.
 */
export interface TriggerEvent {
  /** Event type */
  type: 'note_on' | 'note_off' | 'trigger';
  /** Absolute AudioContext time when event should fire */
  time: number;
  /** Velocity/intensity (0.0 - 1.0) */
  velocity: number;
  /** Optional pitch in Hz */
  pitch?: number;
  /** Optional duration in seconds */
  duration?: number;
  /** Source node ID */
  sourceId?: string;
  /** Step index that generated this event */
  step?: number;
}

/**
 * A step in a sequence with probability and velocity.
 */
export interface SequenceStep {
  /** Is this step active? */
  active: boolean;
  /** Probability of triggering (0.0 - 1.0) */
  probability: number;
  /** Velocity for this step (0.0 - 1.0) */
  velocity: number;
  /** Optional pitch offset in semitones */
  pitchOffset?: number;
  /** Conditional logic */
  condition?: StepCondition;
}

/**
 * Conditional triggering rules for advanced patterns.
 */
export interface StepCondition {
  /** Condition type */
  type: 'always' | 'first' | 'every_n' | 'not_first' | 'fill';
  /** Value for 'every_n' condition */
  n?: number;
}

// ===========================================
// SCHEDULER TYPES
// ===========================================

/**
 * Configuration for the lookahead scheduler.
 */
export interface SchedulerConfig {
  /** How often to check for events (ms) */
  intervalMs: number;
  /** How far ahead to schedule (ms) */
  lookaheadMs: number;
  /** Tempo in BPM */
  bpm: number;
  /** Time signature numerator */
  beatsPerBar: number;
  /** Time signature denominator (4 = quarter note, 8 = eighth note) */
  beatUnit: number;
  /** Swing amount (0.0 - 1.0) */
  swing: number;
}

/**
 * Scheduler state for a single sequencer track.
 */
export interface TrackState {
  /** Track ID */
  id: string;
  /** Is this track playing? */
  isPlaying: boolean;
  /** Current step index */
  currentStep: number;
  /** Next scheduled time */
  nextStepTime: number;
  /** Loop iteration count */
  loopCount: number;
  /** Steps per beat for this track (allows polyrhythm) */
  stepsPerBeat: number;
  /** Total steps in pattern */
  totalSteps: number;
  /** Pattern data */
  pattern: SequenceStep[];
}

// ===========================================
// CLOCK TYPES
// ===========================================

/**
 * Clock source for synchronization.
 */
export interface ClockSource {
  /** Current AudioContext time */
  currentTime: number;
  /** Tempo in BPM */
  bpm: number;
  /** Is the clock running? */
  isRunning: boolean;
  /** Time when playback started */
  startTime: number;
  /** Current beat position (fractional) */
  beatPosition: number;
  /** Current bar number */
  barNumber: number;
}

/**
 * Clock event emitted on beat/bar boundaries.
 */
export interface ClockEvent {
  type: 'beat' | 'bar' | 'step';
  time: number;
  beat: number;
  bar: number;
  step?: number;
}

// ===========================================
// POLYRHYTHM TYPES
// ===========================================

/**
 * Configuration for polyrhythmic relationships.
 */
export interface PolyrhythmConfig {
  /** Track A steps per cycle */
  trackA: number;
  /** Track B steps per cycle */
  trackB: number;
  /** Common cycle length (LCM of trackA and trackB) */
  cycleLength: number;
}

/**
 * Calculate the least common multiple for polyrhythm cycle.
 */
export function calculatePolyCycle(a: number, b: number): number {
  const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
  return (a * b) / gcd(a, b);
}

// ===========================================
// DEFAULT VALUES
// ===========================================

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  intervalMs: 25,
  lookaheadMs: 100,
  bpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  swing: 0,
};

export const DEFAULT_STEP: SequenceStep = {
  active: false,
  probability: 1.0,
  velocity: 0.8,
};

/**
 * Create a sequence of steps with default values.
 */
export function createSequence(length: number, activeIndices: number[] = []): SequenceStep[] {
  return Array.from({ length }, (_, i) => ({
    ...DEFAULT_STEP,
    active: activeIndices.includes(i),
  }));
}

/**
 * Create a sequence from a boolean pattern.
 */
export function sequenceFromPattern(pattern: boolean[]): SequenceStep[] {
  return pattern.map(active => ({
    ...DEFAULT_STEP,
    active,
  }));
}
