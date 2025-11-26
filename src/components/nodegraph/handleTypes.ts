/**
 * Handle Type System - Defines signal types and compatibility rules for node connections.
 * 
 * Signal Types:
 * - audio: Audio signal (waveform data, -1 to +1 range)
 * - gate: Binary trigger signal (on/off, 0 or 1)
 * - trigger: One-shot impulse (momentary pulse)
 * - cv: Control voltage (continuous modulation signal, typically 0-1 or bipolar)
 * - modulation: Parameter modulation (connects to mod-* handles)
 * 
 * Compatibility Rules:
 * - audio → audio: Standard audio routing
 * - gate → trigger: Gate can trigger sample/synth
 * - gate → gate: Gate passthrough
 * - cv → modulation: CV modulates parameters
 * - cv → cv: CV passthrough
 * - trigger → trigger: Trigger passthrough
 * 
 * @module components/nodegraph/handleTypes
 */

// ===========================================
// SIGNAL TYPE DEFINITIONS
// ===========================================

/**
 * Available signal types in the graph.
 * Each type represents a different kind of data that flows through connections.
 */
export type SignalType = 'audio' | 'gate' | 'trigger' | 'cv' | 'modulation';

/**
 * Extended handle configuration with signal type information.
 */
export interface TypedHandle {
  id: string;
  type: 'source' | 'target';
  position: 'top' | 'bottom' | 'left' | 'right';
  signalType: SignalType;
  label?: string;
  color: string;
  offset?: number;
}

// ===========================================
// COMPATIBILITY MATRIX
// ===========================================

/**
 * Defines which source signal types can connect to which target signal types.
 * Key: source signal type
 * Value: array of compatible target signal types
 */
export const SIGNAL_COMPATIBILITY: Record<SignalType, SignalType[]> = {
  // Audio can only connect to audio inputs
  audio: ['audio'],
  
  // Gate can connect to triggers (to fire samples/synths) or other gates
  gate: ['gate', 'trigger'],
  
  // Trigger can connect to other triggers
  trigger: ['trigger'],
  
  // CV can modulate parameters or chain to other CV inputs
  cv: ['cv', 'modulation'],
  
  // Modulation output (from LFO/Envelope) can connect to mod handles or CV
  modulation: ['modulation', 'cv'],
};

/**
 * Check if a source signal type can connect to a target signal type.
 */
export function isSignalCompatible(source: SignalType, target: SignalType): boolean {
  return SIGNAL_COMPATIBILITY[source]?.includes(target) ?? false;
}

// ===========================================
// HANDLE COLOR BY SIGNAL TYPE
// ===========================================

/**
 * Standard colors for each signal type (for visual consistency).
 */
export const SIGNAL_TYPE_COLORS: Record<SignalType, string> = {
  audio: 'cyan',      // Audio flow: cyan/blue family
  gate: 'red',        // Gate/trigger: red (urgent/action)
  trigger: 'orange',  // Trigger input: orange (receive action)
  cv: 'purple',       // CV/modulation: purple family
  modulation: 'purple',
};

// ===========================================
// HANDLE PRESETS WITH SIGNAL TYPES
// ===========================================

/**
 * Pre-configured handle sets for common node types.
 * Each preset includes proper signal types for validation.
 */
export const TYPED_HANDLE_PRESETS = {
  // Standard audio processor: audio in → audio out
  audioThrough: [
    { id: 'in', type: 'target' as const, position: 'top' as const, signalType: 'audio' as SignalType, color: 'blue' },
    { id: 'out', type: 'source' as const, position: 'bottom' as const, signalType: 'audio' as SignalType, color: 'cyan' },
  ],
  
  // Audio source (oscillator, noise): audio out only
  audioSource: [
    { id: 'out', type: 'source' as const, position: 'bottom' as const, signalType: 'audio' as SignalType, color: 'cyan' },
  ],
  
  // Audio sink (output node): audio in only
  audioSink: [
    { id: 'in', type: 'target' as const, position: 'top' as const, signalType: 'audio' as SignalType, color: 'emerald' },
  ],
  
  // Sample player: trigger in → audio out
  samplePlayer: [
    { id: 'trigger', type: 'target' as const, position: 'left' as const, signalType: 'trigger' as SignalType, label: 'Trig', color: 'orange', offset: 50 },
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'audio' as SignalType, color: 'cyan', offset: 50 },
  ],
  
  // String synth (Karplus): trigger in → audio out
  stringSynth: [
    { id: 'trigger', type: 'target' as const, position: 'left' as const, signalType: 'trigger' as SignalType, label: 'Trig', color: 'orange', offset: 50 },
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'audio' as SignalType, color: 'pink', offset: 50 },
  ],
  
  // Envelope: gate in → CV/modulation out
  envelope: [
    { id: 'gate', type: 'target' as const, position: 'left' as const, signalType: 'gate' as SignalType, label: 'Gate', color: 'red', offset: 50 },
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'modulation' as SignalType, color: 'purple', offset: 50 },
  ],
  
  // LFO: CV/modulation output only
  lfo: [
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'modulation' as SignalType, color: 'purple', offset: 50 },
  ],
  
  // Sequencer: gate out (bottom) + CV out (right) - separate positions for easy selection
  sequencer: [
    { id: 'gate', type: 'source' as const, position: 'bottom' as const, signalType: 'gate' as SignalType, label: 'Gate', color: 'red', offset: 50 },
    { id: 'cv', type: 'source' as const, position: 'right' as const, signalType: 'cv' as SignalType, label: 'CV', color: 'orange', offset: 50 },
  ],
  
  // Euclidean sequencer: gate out + CV out (same as sequencer)
  euclidean: [
    { id: 'gate', type: 'source' as const, position: 'right' as const, signalType: 'gate' as SignalType, label: 'Gate', color: 'red', offset: 35 },
    { id: 'cv', type: 'source' as const, position: 'right' as const, signalType: 'cv' as SignalType, label: 'CV', color: 'orange', offset: 65 },
  ],
  
  // Physics: dual CV outputs (position + velocity)
  physics: [
    { id: 'position', type: 'source' as const, position: 'right' as const, signalType: 'cv' as SignalType, label: 'Pos', color: 'cyan', offset: 35 },
    { id: 'velocity', type: 'source' as const, position: 'right' as const, signalType: 'cv' as SignalType, label: 'Vel', color: 'blue', offset: 65 },
  ],
  
  // Filter: audio through with modulation input
  filter: [
    { id: 'in', type: 'target' as const, position: 'left' as const, signalType: 'audio' as SignalType, label: 'In', color: 'blue', offset: 35 },
    { id: 'mod', type: 'target' as const, position: 'left' as const, signalType: 'modulation' as SignalType, label: 'Mod', color: 'purple', offset: 65 },
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'audio' as SignalType, color: 'blue', offset: 50 },
  ],
  
  // Spatial 3D: audio through (processes audio with spatial positioning)
  spatial: [
    { id: 'in', type: 'target' as const, position: 'left' as const, signalType: 'audio' as SignalType, label: 'In', color: 'blue', offset: 50 },
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'audio' as SignalType, color: 'cyan', offset: 50 },
  ],
  
  // Noise: audio output only
  noise: [
    { id: 'out', type: 'source' as const, position: 'bottom' as const, signalType: 'audio' as SignalType, color: 'gray' },
  ],
  
  // Texture (granular): audio output
  texture: [
    { id: 'out', type: 'source' as const, position: 'bottom' as const, signalType: 'audio' as SignalType, color: 'emerald' },
  ],
  
  // Resonator: audio through
  resonator: [
    { id: 'in', type: 'target' as const, position: 'left' as const, signalType: 'audio' as SignalType, label: 'In', color: 'blue', offset: 50 },
    { id: 'out', type: 'source' as const, position: 'right' as const, signalType: 'audio' as SignalType, color: 'pink', offset: 50 },
  ],
} as const;

// ===========================================
// NODE TYPE → HANDLE PRESET MAPPING
// ===========================================

/**
 * Maps node types to their handle presets.
 * Used for connection validation without needing to access each node's config.
 */
export const NODE_TYPE_HANDLES: Record<string, readonly TypedHandle[]> = {
  oscillator: TYPED_HANDLE_PRESETS.audioSource,
  noise: TYPED_HANDLE_PRESETS.noise,
  texture: TYPED_HANDLE_PRESETS.texture,
  sample: TYPED_HANDLE_PRESETS.samplePlayer,
  karplus: TYPED_HANDLE_PRESETS.stringSynth,
  filter: TYPED_HANDLE_PRESETS.filter,
  resonator: TYPED_HANDLE_PRESETS.resonator,
  spatial: TYPED_HANDLE_PRESETS.spatial,
  envelope: TYPED_HANDLE_PRESETS.envelope,
  lfo: TYPED_HANDLE_PRESETS.lfo,
  sequencer: TYPED_HANDLE_PRESETS.sequencer,
  euclidean: TYPED_HANDLE_PRESETS.euclidean,
  physics: TYPED_HANDLE_PRESETS.physics,
  output: TYPED_HANDLE_PRESETS.audioSink,
};

// ===========================================
// VALIDATION HELPERS
// ===========================================

/**
 * Get the signal type for a specific handle on a node type.
 */
export function getHandleSignalType(nodeType: string, handleId: string): SignalType | null {
  const handles = NODE_TYPE_HANDLES[nodeType];
  if (!handles) return null;
  
  // Handle modulation handles (mod-*) specially
  if (handleId.startsWith('mod-')) {
    return 'modulation';
  }
  
  const handle = handles.find(h => h.id === handleId);
  return handle?.signalType ?? null;
}

/**
 * Validate if a connection between two handles is compatible.
 * 
 * @param sourceNodeType - Type of the source node
 * @param sourceHandleId - ID of the source handle
 * @param targetNodeType - Type of the target node  
 * @param targetHandleId - ID of the target handle
 * @returns Object with validity and reason
 */
export function validateConnection(
  sourceNodeType: string,
  sourceHandleId: string,
  targetNodeType: string,
  targetHandleId: string
): { valid: boolean; reason?: string } {
  const sourceSignal = getHandleSignalType(sourceNodeType, sourceHandleId);
  const targetSignal = getHandleSignalType(targetNodeType, targetHandleId);
  
  if (!sourceSignal) {
    return { valid: false, reason: `Unknown source handle: ${sourceHandleId} on ${sourceNodeType}` };
  }
  
  if (!targetSignal) {
    return { valid: false, reason: `Unknown target handle: ${targetHandleId} on ${targetNodeType}` };
  }
  
  if (!isSignalCompatible(sourceSignal, targetSignal)) {
    return { 
      valid: false, 
      reason: `${sourceSignal} cannot connect to ${targetSignal}` 
    };
  }
  
  return { valid: true };
}

/**
 * Get human-readable name for a signal type.
 */
export function getSignalTypeName(signalType: SignalType): string {
  const names: Record<SignalType, string> = {
    audio: 'Audio',
    gate: 'Gate',
    trigger: 'Trigger',
    cv: 'CV',
    modulation: 'Modulation',
  };
  return names[signalType];
}
