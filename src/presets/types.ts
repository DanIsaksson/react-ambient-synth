/**
 * Preset Types - Data structures for patch serialization.
 * 
 * Defines the schema for saving and loading complete audio patches
 * including visual layout, audio parameters, and metadata.
 * 
 * @module presets/types
 */

import type { Node, Edge } from '@xyflow/react';

// ===========================================
// METADATA
// ===========================================

export interface PatchMeta {
  /** Display name of the patch */
  name: string;
  /** Creator name or handle */
  author: string;
  /** Semantic version for compatibility */
  version: string;
  /** Category for organization */
  category?: PatchCategory;
  /** Short description */
  description?: string;
  /** Tags for search */
  tags?: string[];
  /** Creation timestamp */
  createdAt?: number;
  /** Last modified timestamp */
  updatedAt?: number;
  /** Thumbnail data URL (optional) */
  thumbnail?: string;
}

export type PatchCategory = 'sleep' | 'focus' | 'ambient' | 'scifi' | 'nature' | 'experimental' | 'user';

// ===========================================
// GRAPH DATA
// ===========================================

export interface GraphData {
  /** React Flow nodes with positions and types */
  nodes: Node[];
  /** React Flow edges (connections) */
  edges: Edge[];
}

// ===========================================
// AUDIO DATA
// ===========================================

export interface NodeAudioParams {
  [paramName: string]: number | string | boolean | number[] | { [key: string]: any };
}

export interface AudioData {
  /** Per-node audio parameters keyed by node ID */
  nodes: {
    [nodeId: string]: NodeAudioParams;
  };
}

// ===========================================
// GLOBAL STATE
// ===========================================

export interface GlobalState {
  /** Master volume (0-1) */
  masterVolume: number;
  /** Global BPM */
  bpm: number;
  /** Active scene ID (if any) */
  activeScene?: string;
}

// ===========================================
// MODULATION STATE
// ===========================================

export interface ModulationData {
  /** LFO configurations */
  lfos: {
    id: string;
    frequency: number;
    waveform: string;
    depth: number;
    targetParam?: string;
  }[];
  /** Macro configurations */
  macros: {
    id: string;
    label: string;
    value: number;
    mappings: {
      nodeId: string;
      param: string;
      min: number;
      max: number;
    }[];
  }[];
}

// ===========================================
// COMPLETE PATCH
// ===========================================

export interface PatchData {
  /** Patch metadata */
  meta: PatchMeta;
  /** Visual graph state */
  graph: GraphData;
  /** Audio parameter state */
  audio: AudioData;
  /** Global settings */
  global: GlobalState;
  /** Modulation routing (optional) */
  modulation?: ModulationData;
}

// ===========================================
// PRESET DEFINITIONS
// ===========================================

export interface PresetDefinition {
  /** Unique ID */
  id: string;
  /** Patch data */
  patch: PatchData;
  /** Is this a factory preset? */
  isFactory: boolean;
}

// ===========================================
// VERSION MIGRATION
// ===========================================

export interface MigrationFn {
  (oldPatch: any): PatchData;
}

export interface VersionMigrations {
  [fromVersion: string]: MigrationFn;
}

// ===========================================
// DEFAULTS
// ===========================================

export const DEFAULT_PATCH_META: PatchMeta = {
  name: 'Untitled Patch',
  author: 'Anonymous',
  version: '1.0.0',
  category: 'user',
};

export const DEFAULT_GLOBAL_STATE: GlobalState = {
  masterVolume: 0.7,
  bpm: 120,
};

export const CURRENT_PATCH_VERSION = '1.0.0';
