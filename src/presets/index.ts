/**
 * Presets Module
 * 
 * Exports for patch serialization, compression, and preset management.
 * 
 * @module presets
 */

// Types
export {
  type PatchData,
  type PatchMeta,
  type PatchCategory,
  type GraphData,
  type AudioData,
  type NodeAudioParams,
  type GlobalState,
  type ModulationData,
  type PresetDefinition,
  DEFAULT_PATCH_META,
  DEFAULT_GLOBAL_STATE,
  CURRENT_PATCH_VERSION,
} from './types';

// Preset Manager
export {
  PresetManager,
  presetManager,
} from './PresetManager';

// Factory Presets
export {
  FACTORY_PRESETS,
  getFactoryPreset,
  getPresetsByCategory,
  DEEP_SLUMBER,
  PULSE_FOCUS,
  SPACE_DRIFT,
  FOREST_MORNING,
  RESONANT_STRINGS,
  CHAOS_ENGINE,
} from './factory';
