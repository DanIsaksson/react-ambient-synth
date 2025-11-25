/**
 * Factory Presets - Curated patches that showcase the engine's capabilities.
 * 
 * @module presets/factory
 */

import type { PatchData } from '../types';

// ===========================================
// SLEEP CATEGORY - Deep, low-frequency drones
// ===========================================

export const DEEP_SLUMBER: PatchData = {
  meta: {
    name: 'Deep Slumber',
    author: 'Ambient Flow',
    version: '1.0.0',
    category: 'sleep',
    description: 'Brown noise with gentle filtering for deep sleep',
    tags: ['sleep', 'drone', 'brown noise', 'relaxation'],
  },
  graph: {
    nodes: [
      { id: 'osc-1', type: 'oscillator', position: { x: 100, y: 150 }, data: { label: 'Brown Noise', freq: 60, waveform: 'sawtooth' } },
      { id: 'flt-1', type: 'filter', position: { x: 300, y: 150 }, data: { label: 'Warmth', cutoff: 200, resonance: 0.5, type: 'lowpass' } },
      { id: 'lfo-1', type: 'lfo', position: { x: 100, y: 300 }, data: { label: 'Drift', frequency: 0.05, waveform: 'sine', depth: 0.3 } },
      { id: 'out-1', type: 'output', position: { x: 500, y: 150 }, data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1', source: 'osc-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'flt-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
  audio: {
    nodes: {
      'osc-1': { freq: 60, waveform: 'sawtooth' },
      'flt-1': { cutoff: 200, resonance: 0.5, type: 'lowpass' },
      'lfo-1': { frequency: 0.05, waveform: 'sine', depth: 0.3 },
    },
  },
  global: {
    masterVolume: 0.5,
    bpm: 60,
  },
};

// ===========================================
// FOCUS CATEGORY - Crisp, rhythmic textures
// ===========================================

export const PULSE_FOCUS: PatchData = {
  meta: {
    name: 'Pulse Focus',
    author: 'Ambient Flow',
    version: '1.0.0',
    category: 'focus',
    description: 'Euclidean rhythms with filtered pulses for concentration',
    tags: ['focus', 'rhythm', 'euclidean', 'work'],
  },
  graph: {
    nodes: [
      { id: 'euc-1', type: 'euclidean', position: { x: 100, y: 150 }, data: { label: 'Rhythm', steps: 8, pulses: 3, rotation: 0 } },
      { id: 'osc-1', type: 'oscillator', position: { x: 300, y: 100 }, data: { label: 'Tone', freq: 440, waveform: 'sine' } },
      { id: 'env-1', type: 'envelope', position: { x: 300, y: 250 }, data: { label: 'Shape', attack: 5, decay: 100, sustain: 30, release: 200 } },
      { id: 'flt-1', type: 'filter', position: { x: 500, y: 150 }, data: { label: 'Filter', cutoff: 2000, resonance: 2, type: 'bandpass' } },
      { id: 'out-1', type: 'output', position: { x: 700, y: 150 }, data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1', source: 'euc-1', target: 'env-1', sourceHandle: 'gate', targetHandle: 'gate' },
      { id: 'e2', source: 'osc-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e3', source: 'flt-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
  audio: {
    nodes: {
      'euc-1': { steps: 8, pulses: 3, rotation: 0, bpm: 90 },
      'osc-1': { freq: 440, waveform: 'sine' },
      'env-1': { attack: 5, decay: 100, sustain: 30, release: 200 },
      'flt-1': { cutoff: 2000, resonance: 2, type: 'bandpass' },
    },
  },
  global: {
    masterVolume: 0.6,
    bpm: 90,
  },
};

// ===========================================
// SCI-FI CATEGORY - Generative, chaotic FX
// ===========================================

export const SPACE_DRIFT: PatchData = {
  meta: {
    name: 'Space Drift',
    author: 'Ambient Flow',
    version: '1.0.0',
    category: 'scifi',
    description: 'Chaotic oscillators with spatial movement',
    tags: ['scifi', 'space', 'chaos', 'experimental'],
  },
  graph: {
    nodes: [
      { id: 'osc-1', type: 'oscillator', position: { x: 100, y: 100 }, data: { label: 'Carrier', freq: 110, waveform: 'sine' } },
      { id: 'osc-2', type: 'oscillator', position: { x: 100, y: 250 }, data: { label: 'Modulator', freq: 0.5, waveform: 'triangle' } },
      { id: 'noise-1', type: 'noise', position: { x: 100, y: 400 }, data: { label: 'Drift', speed: 0.2, depth: 0.5, smoothness: 0.8 } },
      { id: 'flt-1', type: 'filter', position: { x: 350, y: 150 }, data: { label: 'Resonance', cutoff: 800, resonance: 8, type: 'lowpass' } },
      { id: 'spatial-1', type: 'spatial', position: { x: 550, y: 150 }, data: { label: '3D', position: { x: 0, y: 0, z: -5 }, distanceModel: 'inverse' } },
      { id: 'out-1', type: 'output', position: { x: 750, y: 150 }, data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1', source: 'osc-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'flt-1', target: 'spatial-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e3', source: 'spatial-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
  audio: {
    nodes: {
      'osc-1': { freq: 110, waveform: 'sine' },
      'osc-2': { freq: 0.5, waveform: 'triangle' },
      'noise-1': { speed: 0.2, depth: 0.5, smoothness: 0.8 },
      'flt-1': { cutoff: 800, resonance: 8, type: 'lowpass' },
      'spatial-1': { position: { x: 0, y: 0, z: -5 }, distanceModel: 'inverse', rolloff: 1 },
    },
  },
  global: {
    masterVolume: 0.5,
    bpm: 60,
  },
};

// ===========================================
// NATURE CATEGORY - Field recordings + wind
// ===========================================

export const FOREST_MORNING: PatchData = {
  meta: {
    name: 'Forest Morning',
    author: 'Ambient Flow',
    version: '1.0.0',
    category: 'nature',
    description: 'Gentle textures with organic movement',
    tags: ['nature', 'forest', 'birds', 'peaceful'],
  },
  graph: {
    nodes: [
      { id: 'txt-1', type: 'texture', position: { x: 100, y: 150 }, data: { label: 'Ambience', sample: 'forest', position: 0.3, density: 0.4 } },
      { id: 'noise-1', type: 'noise', position: { x: 100, y: 300 }, data: { label: 'Wind', speed: 0.1, depth: 0.2, smoothness: 0.9 } },
      { id: 'flt-1', type: 'filter', position: { x: 350, y: 150 }, data: { label: 'Air', cutoff: 4000, resonance: 0.5, type: 'highpass' } },
      { id: 'out-1', type: 'output', position: { x: 550, y: 150 }, data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1', source: 'txt-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'flt-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
  audio: {
    nodes: {
      'txt-1': { sample: 'forest', position: 0.3, density: 0.4, grainSize: 100 },
      'noise-1': { speed: 0.1, depth: 0.2, smoothness: 0.9 },
      'flt-1': { cutoff: 4000, resonance: 0.5, type: 'highpass' },
    },
  },
  global: {
    masterVolume: 0.7,
    bpm: 60,
  },
};

// ===========================================
// AMBIENT CATEGORY - Classic ambient textures
// ===========================================

export const RESONANT_STRINGS: PatchData = {
  meta: {
    name: 'Resonant Strings',
    author: 'Ambient Flow',
    version: '1.0.0',
    category: 'ambient',
    description: 'Karplus-Strong with modal resonance',
    tags: ['ambient', 'strings', 'resonance', 'physical'],
  },
  graph: {
    nodes: [
      { id: 'seq-1', type: 'euclidean', position: { x: 100, y: 150 }, data: { label: 'Trigger', steps: 16, pulses: 5, rotation: 0 } },
      { id: 'karp-1', type: 'karplus', position: { x: 350, y: 100 }, data: { label: 'String', frequency: 110, damping: 0.3 } },
      { id: 'res-1', type: 'resonator', position: { x: 350, y: 280 }, data: { label: 'Body', material: 'wood', frequency: 220, decay: 0.6 } },
      { id: 'flt-1', type: 'filter', position: { x: 600, y: 180 }, data: { label: 'Warmth', cutoff: 1500, resonance: 1, type: 'lowpass' } },
      { id: 'out-1', type: 'output', position: { x: 800, y: 180 }, data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1', source: 'seq-1', target: 'karp-1', sourceHandle: 'gate', targetHandle: 'trigger' },
      { id: 'e2', source: 'seq-1', target: 'res-1', sourceHandle: 'gate', targetHandle: 'trigger' },
      { id: 'e3', source: 'karp-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e4', source: 'res-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e5', source: 'flt-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
  audio: {
    nodes: {
      'seq-1': { steps: 16, pulses: 5, rotation: 0, bpm: 40 },
      'karp-1': { frequency: 110, damping: 0.3, stiffness: 0.1 },
      'res-1': { material: 'wood', frequency: 220, decay: 0.6, brightness: 0.5 },
      'flt-1': { cutoff: 1500, resonance: 1, type: 'lowpass' },
    },
  },
  global: {
    masterVolume: 0.6,
    bpm: 40,
  },
};

// ===========================================
// EXPERIMENTAL CATEGORY
// ===========================================

export const CHAOS_ENGINE: PatchData = {
  meta: {
    name: 'Chaos Engine',
    author: 'Ambient Flow',
    version: '1.0.0',
    category: 'experimental',
    description: 'Multiple LFOs creating complex interference patterns',
    tags: ['experimental', 'chaos', 'lfo', 'generative'],
  },
  graph: {
    nodes: [
      { id: 'osc-1', type: 'oscillator', position: { x: 300, y: 150 }, data: { label: 'Core', freq: 220, waveform: 'sine' } },
      { id: 'lfo-1', type: 'lfo', position: { x: 100, y: 80 }, data: { label: 'LFO 1', frequency: 0.1, waveform: 'sine', depth: 0.8 } },
      { id: 'lfo-2', type: 'lfo', position: { x: 100, y: 220 }, data: { label: 'LFO 2', frequency: 0.17, waveform: 'triangle', depth: 0.6 } },
      { id: 'lfo-3', type: 'lfo', position: { x: 100, y: 360 }, data: { label: 'LFO 3', frequency: 0.23, waveform: 'random', depth: 0.4 } },
      { id: 'flt-1', type: 'filter', position: { x: 500, y: 150 }, data: { label: 'Filter', cutoff: 1000, resonance: 4, type: 'lowpass' } },
      { id: 'out-1', type: 'output', position: { x: 700, y: 150 }, data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1', source: 'osc-1', target: 'flt-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'flt-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
  audio: {
    nodes: {
      'osc-1': { freq: 220, waveform: 'sine' },
      'lfo-1': { frequency: 0.1, waveform: 'sine', depth: 0.8 },
      'lfo-2': { frequency: 0.17, waveform: 'triangle', depth: 0.6 },
      'lfo-3': { frequency: 0.23, waveform: 'random', depth: 0.4 },
      'flt-1': { cutoff: 1000, resonance: 4, type: 'lowpass' },
    },
  },
  global: {
    masterVolume: 0.5,
    bpm: 60,
  },
};

// ===========================================
// EXPORT ALL FACTORY PRESETS
// ===========================================

export const FACTORY_PRESETS: PatchData[] = [
  DEEP_SLUMBER,
  PULSE_FOCUS,
  SPACE_DRIFT,
  FOREST_MORNING,
  RESONANT_STRINGS,
  CHAOS_ENGINE,
];

/**
 * Get factory preset by name.
 */
export function getFactoryPreset(name: string): PatchData | undefined {
  return FACTORY_PRESETS.find(p => p.meta.name === name);
}

/**
 * Get factory presets by category.
 */
export function getPresetsByCategory(category: string): PatchData[] {
  return FACTORY_PRESETS.filter(p => p.meta.category === category);
}

export default FACTORY_PRESETS;
