/**
 * Sample System Types
 * 
 * Type definitions for the sample playback and library system.
 * @module audio/samples/types
 */

// ===========================================
// SAMPLE CATEGORIES
// ===========================================

export type SampleCategory = 
  | 'ambient'      // Rain, wind, nature sounds
  | 'texture'      // Noise, vinyl, tape hiss
  | 'tonal'        // Pads, drones, sustained chords
  | 'percussion'   // Hits, clicks, impacts
  | 'vocal'        // Human voice textures
  | 'sfx'          // Effects, risers, sweeps
  | 'impulse'      // Impulse responses for convolution
  | 'user';        // User-uploaded samples

// ===========================================
// SAMPLE METADATA
// ===========================================

export interface SampleMetadata {
  /** Unique identifier for the sample */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Category for organization */
  category: SampleCategory;
  
  /** Searchable tags */
  tags: string[];
  
  /** URL or path to the audio file */
  url: string;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Audio format */
  format: 'wav' | 'flac' | 'ogg' | 'mp3';
  
  /** Duration in seconds (populated after loading) */
  duration?: number;
  
  /** Original sample rate */
  sampleRate?: number;
  
  /** Number of channels (1=mono, 2=stereo) */
  channels?: number;
  
  /** Bit depth (16, 24, 32) */
  bitDepth?: number;
  
  // Musical properties (optional)
  
  /** BPM for rhythmic loops */
  bpm?: number;
  
  /** Musical key (e.g., 'C minor') */
  key?: string;
  
  /** Root note as MIDI number (for chromatic samples) */
  rootNote?: number;
  
  // Visual data
  
  /** Pre-computed waveform peaks for display (normalized 0-1) */
  waveformPeaks?: number[];
}

// ===========================================
// LOADED SAMPLE
// ===========================================

export interface LoadedSample extends SampleMetadata {
  /** The decoded AudioBuffer */
  buffer: AudioBuffer;
  
  /** Channel data extracted for worklet transfer */
  channelData: Float32Array[];
  
  /** Timestamp when last accessed (for LRU cache) */
  lastAccessed: number;
  
  /** Memory size in bytes (computed from buffer) */
  memorySize: number;
}

// ===========================================
// SAMPLE PLAYER CONFIG
// ===========================================

export interface SamplePlayerConfig {
  /** Sample ID to play */
  sampleId: string;
  
  // Pitch Control
  
  /** Pitch shift in semitones (-24 to +24) */
  pitch: number;
  
  /** Fine tune in cents (-100 to +100) */
  fineTune: number;
  
  /** Computed playback rate (derived from pitch + fineTune) */
  playbackRate: number;
  
  /** Play sample in reverse */
  reverse: boolean;
  
  // Time Stretch (requires AudioWorklet)
  
  /** Enable time stretching (independent pitch/time) */
  timeStretch: boolean;
  
  /** Stretch ratio (0.5 = half speed, 2.0 = double speed) */
  stretchRatio: number;
  
  /** Algorithm for time stretching */
  stretchAlgorithm: 'wsola' | 'granular' | 'phase-vocoder';
  
  // Loop Settings
  
  /** Enable looping */
  loopEnabled: boolean;
  
  /** Loop start point in seconds */
  loopStart: number;
  
  /** Loop end point in seconds */
  loopEnd: number;
  
  /** Crossfade duration at loop point in ms (0-100) */
  loopCrossfade: number;
  
  // Envelope
  
  /** Attack time in seconds (0-2) */
  attack: number;
  
  /** Release time in seconds (0-5) */
  release: number;
  
  // Output
  
  /** Output gain (0-1) */
  gain: number;
  
  /** Stereo pan (-1 to 1) */
  pan: number;
}

// ===========================================
// SAMPLE NODE DATA (for React Flow)
// ===========================================

export interface SampleNodeData extends Partial<SamplePlayerConfig> {
  /** Currently selected sample ID */
  sample?: string;
  
  /** Whether sample is currently playing */
  playing?: boolean;
  
  /** Trigger flag (set true to trigger playback) */
  trigger?: boolean;
  
  /** Current playback position (0-1, for UI) */
  playbackPosition?: number;
}

// ===========================================
// MEMORY BUDGET
// ===========================================

export interface MemoryBudget {
  /** Maximum bytes for sample cache */
  maxBytes: number;
  
  /** Warning threshold (0-1) */
  warningThreshold: number;
  
  /** Critical threshold - force eviction (0-1) */
  criticalThreshold: number;
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudget = {
  maxBytes: 200 * 1024 * 1024, // 200MB
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Calculate memory size of an AudioBuffer in bytes.
 */
export function getBufferMemorySize(buffer: AudioBuffer): number {
  // Float32 = 4 bytes per sample
  return buffer.length * buffer.numberOfChannels * 4;
}

/**
 * Convert semitones + cents to playback rate.
 */
export function pitchToPlaybackRate(semitones: number, cents: number = 0): number {
  const totalCents = semitones * 100 + cents;
  return Math.pow(2, totalCents / 1200);
}

/**
 * Convert playback rate to semitones.
 */
export function playbackRateToPitch(rate: number): number {
  return 12 * Math.log2(rate);
}

/**
 * Format duration as MM:SS.ms
 */
export function formatSampleDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Format file size in human readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
