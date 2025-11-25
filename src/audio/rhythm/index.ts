/**
 * Rhythmic Intelligence Module
 * 
 * Exports for Euclidean rhythms, scheduling, and trigger events.
 * 
 * @module audio/rhythm
 */

// Euclidean algorithm and patterns
export {
  euclidean,
  rotatePattern,
  patternToString,
  stringToPattern,
  fromPreset,
  getPulseIndices,
  getPatternDensity,
  getPulseIntervals,
  invertPattern,
  combinePatterns,
  applyProbability,
  EUCLIDEAN_PRESETS,
  type EuclideanPattern,
  type EuclideanPresetName,
} from './euclidean';

// Types for trigger system
export {
  type TriggerEvent,
  type SequenceStep,
  type SchedulerConfig,
  type TrackState,
  type ClockSource,
  type ClockEvent,
  type PolyrhythmConfig,
  type StepCondition,
  calculatePolyCycle,
  createSequence,
  sequenceFromPattern,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_STEP,
} from './types';

// Scheduler
export { Scheduler, type TriggerCallback, type ClockCallback } from './Scheduler';
