/**
 * Modulation Module - The Nervous System
 * 
 * Exports for modulation routing, LFOs, noise, and chaos generators.
 * 
 * @module audio/modulation
 */

// Modulation System
export {
  ModulationSystem,
  applyTransferCurve,
  mapRange,
  type ModulationConnection,
  type ModulationSource,
  type ModulationTarget,
  type TransferCurve,
} from './ModulationSystem';

// LFO
export {
  LFONode,
  type LFOWaveform,
  type LFOParams,
} from './LFONode';

// Noise
export {
  NoiseNode,
  type NoiseParams,
} from './NoiseNode';
