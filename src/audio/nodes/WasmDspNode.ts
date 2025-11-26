/**
 * WasmDspNode - High-level wrapper for WASM DSP AudioWorkletNode
 * 
 * # Responsibilities
 * - Creating and connecting the AudioWorkletNode
 * - Loading source audio / impulse responses
 * - Updating parameters in real-time
 * - Switching between effect types
 * 
 * # Usage
 * ```typescript
 * const wasmDsp = new WasmDspNode(audioContext);
 * await wasmDsp.init();
 * 
 * // Connect to audio graph
 * sourceNode.connect(wasmDsp.getNode());
 * wasmDsp.getNode().connect(audioContext.destination);
 * 
 * // Load granular source
 * await wasmDsp.loadGranularSource(audioBuffer);
 * wasmDsp.setEffect(EffectType.GRANULAR);
 * wasmDsp.setGranularParams({ density: 40, pitchSpread: 0.2 });
 * ```
 */

import { wasmLoader } from '../wasm/WasmLoader';

// ============================================================================
// EFFECT TYPES
// ============================================================================

/**
 * Available DSP effect types.
 * Must match the values in wasm-dsp-processor.js
 */
export const EffectType = {
    /** Pass-through (no processing) */
    BYPASS: 0,
    /** Granular synthesis */
    GRANULAR: 1,
    /** Convolution reverb */
    CONVOLUTION: 2,
    /** Spectral freeze/shift */
    SPECTRAL: 3,
} as const;

export type EffectType = (typeof EffectType)[keyof typeof EffectType];

// ============================================================================
// PARAMETER INTERFACES
// ============================================================================

/**
 * Parameters for granular synthesis effect.
 */
export interface GranularParams {
    /** Grain size in samples (64-4096) */
    grainSize: number;
    /** Grains per second (1-100) */
    density: number;
    /** Random pitch variation (0-1) */
    pitchSpread: number;
    /** Playback position in source (0-1) */
    position: number;
    /** Position randomization amount (0-1) */
    spray: number;
}

/**
 * Parameters for convolution reverb effect.
 */
export interface ConvolutionParams {
    /** Dry/wet mix (0 = dry, 1 = wet) */
    dryWet: number;
}

/**
 * Parameters for spectral effect.
 */
export interface SpectralParams {
    /** Amount of spectral freeze (0-1) */
    freezeAmount: number;
    /** Frequency shift in semitones (-24 to +24) */
    frequencyShift: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type WasmDspEventType = 
    | 'initialized'
    | 'error'
    | 'granular-source-loaded'
    | 'ir-loaded';

export interface WasmDspEvent {
    type: WasmDspEventType;
    error?: string;
    length?: number;
    channels?: number;
}

export type WasmDspEventHandler = (event: WasmDspEvent) => void;

// ============================================================================
// WASM DSP NODE
// ============================================================================

export class WasmDspNode {
    private context: AudioContext;
    private node: AudioWorkletNode | null = null;
    private isInitialized = false;
    private currentEffect: EffectType = EffectType.BYPASS;
    private eventHandlers: Map<WasmDspEventType, WasmDspEventHandler[]> = new Map();
    
    constructor(context: AudioContext) {
        this.context = context;
    }
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize the WASM DSP node.
     * Must be called before using any other methods.
     * 
     * @throws Error if worklet registration or WASM init fails
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            return;
        }
        
        try {
            // Configure WASM loader with current context settings
            wasmLoader.configure({
                sampleRate: this.context.sampleRate,
                bufferSize: 128, // Standard AudioWorklet quantum
            });
            
            // Pre-load WASM module (can happen before worklet registration)
            await wasmLoader.load();
            
            // Register the worklet processor
            // Note: The path is relative to the HTML file (public folder)
            await this.context.audioWorklet.addModule('/worklets/wasm-dsp-processor.js');
            
            // Create the AudioWorkletNode
            this.node = new AudioWorkletNode(this.context, 'wasm-dsp-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [2], // Stereo output
            });
            
            // Set up message handler for events from worklet
            this.node.port.addEventListener('message', this.handleWorkletMessage.bind(this));
            this.node.port.start();
            
            // Initialize WASM in the worklet
            await wasmLoader.initWorklet(this.node);
            
            this.isInitialized = true;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[WasmDspNode] Initialization failed:', message);
            throw error;
        }
    }
    
    /**
     * Handle messages from the worklet.
     */
    private handleWorkletMessage(event: MessageEvent): void {
        const { type, ...data } = event.data as WasmDspEvent;
        
        // Invoke registered handlers
        const handlers = this.eventHandlers.get(type as WasmDspEventType);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler({ type, ...data } as WasmDspEvent);
                } catch (err) {
                    console.error('[WasmDspNode] Event handler error:', err);
                }
            }
        }
    }
    
    // ========================================================================
    // AUDIO GRAPH CONNECTION
    // ========================================================================
    
    /**
     * Get the underlying AudioNode for connecting to the audio graph.
     * 
     * @throws Error if not initialized
     */
    getNode(): AudioWorkletNode {
        if (!this.node) {
            throw new Error('WasmDspNode not initialized. Call init() first.');
        }
        return this.node;
    }
    
    /**
     * Check if the node is ready for use.
     */
    isReady(): boolean {
        return this.isInitialized && this.node !== null;
    }
    
    // ========================================================================
    // EFFECT CONTROL
    // ========================================================================
    
    /**
     * Set the active effect type.
     */
    setEffect(effect: EffectType): void {
        this.currentEffect = effect;
        this.sendMessage('set-effect', { effect });
    }
    
    /**
     * Get the current effect type.
     */
    getEffect(): EffectType {
        return this.currentEffect;
    }
    
    // ========================================================================
    // PARAMETER CONTROL
    // ========================================================================
    
    /**
     * Update granular synthesis parameters.
     * Only the provided fields are updated; others remain unchanged.
     */
    setGranularParams(params: Partial<GranularParams>): void {
        this.sendMessage('set-params', { params });
    }
    
    /**
     * Update convolution reverb parameters.
     */
    setConvolutionParams(params: Partial<ConvolutionParams>): void {
        this.sendMessage('set-params', { params });
    }
    
    /**
     * Update spectral effect parameters.
     */
    setSpectralParams(params: Partial<SpectralParams>): void {
        this.sendMessage('set-params', { params });
    }
    
    // ========================================================================
    // AUDIO DATA LOADING
    // ========================================================================
    
    /**
     * Load audio buffer as granular synthesis source.
     * 
     * The buffer is converted to interleaved format and sent to the worklet,
     * which writes it directly to WASM linear memory.
     * 
     * @param audioBuffer - The AudioBuffer to use as granular source
     */
    async loadGranularSource(audioBuffer: AudioBuffer): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('WasmDspNode not initialized');
        }
        
        const samples = this.audioBufferToInterleaved(audioBuffer);
        
        // Transferable would be ideal but Float32Array.buffer may be shared
        this.sendMessage('load-granular-source', {
            samples,
            channels: audioBuffer.numberOfChannels,
        });
    }
    
    /**
     * Load audio buffer as impulse response for convolution.
     * 
     * @param audioBuffer - The AudioBuffer to use as IR
     */
    async loadIR(audioBuffer: AudioBuffer): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('WasmDspNode not initialized');
        }
        
        const samples = this.audioBufferToInterleaved(audioBuffer);
        
        this.sendMessage('load-ir', {
            samples,
            channels: audioBuffer.numberOfChannels,
        });
    }
    
    /**
     * Convert AudioBuffer to interleaved Float32Array.
     * 
     * Layout: [L0, R0, L1, R1, L2, R2, ...]
     */
    private audioBufferToInterleaved(buffer: AudioBuffer): Float32Array {
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        const result = new Float32Array(length * numChannels);
        
        // Interleave channels
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                result[i * numChannels + ch] = buffer.getChannelData(ch)[i];
            }
        }
        
        return result;
    }
    
    // ========================================================================
    // EVENT HANDLING
    // ========================================================================
    
    /**
     * Register an event handler.
     */
    on(type: WasmDspEventType, handler: WasmDspEventHandler): void {
        if (!this.eventHandlers.has(type)) {
            this.eventHandlers.set(type, []);
        }
        this.eventHandlers.get(type)!.push(handler);
    }
    
    /**
     * Remove an event handler.
     */
    off(type: WasmDspEventType, handler: WasmDspEventHandler): void {
        const handlers = this.eventHandlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    // ========================================================================
    // INTERNAL HELPERS
    // ========================================================================
    
    /**
     * Send a message to the worklet processor.
     */
    private sendMessage(type: string, data: Record<string, unknown> = {}): void {
        if (!this.node) {
            console.warn('[WasmDspNode] Cannot send message: not initialized');
            return;
        }
        this.node.port.postMessage({ type, ...data });
    }
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    
    /**
     * Disconnect and clean up resources.
     */
    dispose(): void {
        if (this.node) {
            this.node.port.postMessage({ type: 'dispose' });
            this.node.disconnect();
            this.node = null;
        }
        this.isInitialized = false;
        this.eventHandlers.clear();
    }
}
