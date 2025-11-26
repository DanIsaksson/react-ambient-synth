/**
 * Node Information System - Compatibility info and usage examples for each node type.
 * 
 * This data is used by the info popup on each node to help users understand:
 * - What the node does
 * - Which nodes it works with
 * - Example use cases
 * 
 * @module components/nodegraph/nodeInfo
 */

export interface NodeInfo {
    /** Node type identifier */
    type: string;
    /** Display name */
    name: string;
    /** Short description */
    description: string;
    /** What this node outputs */
    outputs: string;
    /** What this node accepts as input */
    inputs: string;
    /** List of compatible node types that work well with this node */
    compatibleWith: string[];
    /** Example use case */
    example: string;
    /** Whether audio processing is implemented */
    implemented: boolean;
}

export const NODE_INFO: Record<string, NodeInfo> = {
    oscillator: {
        type: 'oscillator',
        name: 'Oscillator',
        description: 'Generates basic waveforms (sine, square, saw, triangle) at a specified frequency.',
        outputs: 'Audio signal',
        inputs: 'Frequency can be modulated via mod-freq handle',
        compatibleWith: ['filter', 'output', 'spatial', 'lfo', 'envelope'],
        example: 'Connect OSC → Filter → Output for a classic subtractive synth sound.',
        implemented: true,
    },
    
    karplus: {
        type: 'karplus',
        name: 'Karplus-String',
        description: 'Physical modeling string synthesis. Creates plucked string sounds using the Karplus-Strong algorithm.',
        outputs: 'Audio signal (plucked string)',
        inputs: 'Trigger input to pluck the string. Frequency, damping, stiffness, and brightness can be modulated.',
        compatibleWith: ['euclidean', 'sequencer', 'filter', 'output', 'lfo', 'envelope'],
        example: 'Connect Euclidean gate → STR trigger. LFO → mod-frequency for vibrato.',
        implemented: true,
    },
    
    resonator: {
        type: 'resonator',
        name: 'Resonator',
        description: 'Modal synthesis resonator. Simulates the resonant modes of physical materials (wood, metal, glass).',
        outputs: 'Audio signal (resonated)',
        inputs: 'Audio input to excite the resonator. Frequency, decay, and brightness can be modulated.',
        compatibleWith: ['oscillator', 'noise', 'filter', 'output', 'lfo'],
        example: 'Connect Noise → Resonator → Output for bell-like tones.',
        implemented: true,
    },
    
    noise: {
        type: 'noise',
        name: 'Noise',
        description: 'Generates noise (white, pink, brown) for textures, percussion, or modulation source.',
        outputs: 'Audio signal + Modulation signal',
        inputs: 'None (generates internally)',
        compatibleWith: ['filter', 'resonator', 'output', 'spatial'],
        example: 'Connect Noise → Filter (lowpass) → Output for ocean waves texture.',
        implemented: true,
    },
    
    sample: {
        type: 'sample',
        name: 'Sample Player',
        description: 'Plays audio samples from the library with pitch, reverse, and loop controls.',
        outputs: 'Audio signal',
        inputs: 'Trigger input to start playback.',
        compatibleWith: ['euclidean', 'sequencer', 'filter', 'output', 'spatial'],
        example: 'Connect Euclidean gate → Sample trigger for rhythmic sample playback.',
        implemented: true,
    },
    
    texture: {
        type: 'texture',
        name: 'Texture (Granular)',
        description: 'Granular synthesis for creating evolving, ambient textures from source material.',
        outputs: 'Audio signal',
        inputs: 'Grain density, size, and pitch can be modulated.',
        compatibleWith: ['filter', 'output', 'spatial', 'lfo'],
        example: 'Use standalone for ambient pads, modulate grain size with LFO.',
        implemented: true,
    },
    
    filter: {
        type: 'filter',
        name: 'Filter',
        description: 'Classic biquad filter with lowpass, highpass, bandpass modes. Shapes the tone of audio.',
        outputs: 'Filtered audio signal',
        inputs: 'Audio input required. Cutoff and resonance can be modulated.',
        compatibleWith: ['oscillator', 'karplus', 'noise', 'sample', 'output', 'lfo', 'envelope'],
        example: 'Connect OSC → Filter → Output. LFO → mod-cutoff for wah effect.',
        implemented: true,
    },
    
    spatial: {
        type: 'spatial',
        name: 'Spatial 3D',
        description: 'Positions audio in 3D space with stereo panning. Creates width and movement.',
        outputs: 'Spatialized audio signal',
        inputs: 'Audio input required. Position can be modulated.',
        compatibleWith: ['oscillator', 'filter', 'noise', 'output', 'lfo'],
        example: 'Connect any audio → Spatial → Output. LFO → mod-x for auto-pan.',
        implemented: true,
    },
    
    lfo: {
        type: 'lfo',
        name: 'LFO',
        description: 'Low Frequency Oscillator. Generates slow modulation signals to animate parameters.',
        outputs: 'Modulation signal (connects to purple mod-* handles)',
        inputs: 'None (generates internally)',
        compatibleWith: ['oscillator', 'filter', 'karplus', 'spatial', 'resonator'],
        example: 'Connect LFO out → any mod-* handle (e.g., mod-cutoff on Filter).',
        implemented: true,
    },
    
    envelope: {
        type: 'envelope',
        name: 'Envelope',
        description: 'ADSR envelope generator. Creates time-varying modulation triggered by gates.',
        outputs: 'Modulation signal',
        inputs: 'Gate input to trigger the envelope.',
        compatibleWith: ['filter', 'oscillator', 'sequencer', 'euclidean'],
        example: 'Connect Sequencer gate → Envelope gate. Envelope out → mod-cutoff.',
        implemented: true,
    },
    
    sequencer: {
        type: 'sequencer',
        name: 'Sequencer',
        description: 'Step sequencer with gate and CV outputs for creating rhythmic patterns.',
        outputs: 'Gate signal + CV signal',
        inputs: 'None (generates pattern internally)',
        compatibleWith: ['karplus', 'sample', 'envelope'],
        example: 'Connect gate → Karplus trigger, CV → mod-frequency for melodies.',
        implemented: true,
    },
    
    euclidean: {
        type: 'euclidean',
        name: 'Euclidean',
        description: 'Euclidean rhythm generator. Creates complex rhythmic patterns using Bjorklund\'s algorithm for optimal pulse distribution.',
        outputs: 'Gate signal (triggers connected nodes)',
        inputs: 'None (generates pattern internally)',
        compatibleWith: ['karplus', 'sample', 'envelope'],
        example: 'Set 5 pulses over 8 steps for Bossa Nova rhythm → Karplus trigger.',
        implemented: true,
    },
    
    physics: {
        type: 'physics',
        name: 'Physics',
        description: 'Bouncing ball physics simulation. Outputs position/velocity as modulation sources.',
        outputs: 'Position CV + Velocity CV',
        inputs: 'Gravity and restitution parameters.',
        compatibleWith: ['filter', 'oscillator', 'spatial'],
        example: 'Connect position → mod-cutoff for bouncing filter sweeps.',
        implemented: true,
    },
    
    output: {
        type: 'output',
        name: 'Output',
        description: 'Final destination for audio. All audio must route through Output to be heard.',
        outputs: 'None (sends to speakers)',
        inputs: 'Audio input required',
        compatibleWith: ['oscillator', 'filter', 'karplus', 'resonator', 'noise', 'sample', 'spatial'],
        example: 'Every audio chain must end with → Output to produce sound.',
        implemented: true,
    },
};

/**
 * Get info for a specific node type.
 */
export function getNodeInfo(nodeType: string): NodeInfo | null {
    return NODE_INFO[nodeType] ?? null;
}

/**
 * Get list of compatible node types for a given node.
 */
export function getCompatibleNodes(nodeType: string): string[] {
    return NODE_INFO[nodeType]?.compatibleWith ?? [];
}
