import { create } from 'zustand';
import { audioCore, EffectType } from '../audio/engine/AudioCore';
import type { GranularParams, ConvolutionParams, SpectralParams } from '../audio/engine/AudioCore';
import type { AudioMessage } from '../audio/types';
import type { SoundScene } from '../audio/scenes/SoundScene';

interface AudioState {
    // Legacy combined state (for backward compat)
    isPlaying: boolean;
    
    // Separate engine states
    isClassicPlaying: boolean;
    isGraphPlaying: boolean;
    
    volume: number;
    currentScene: string;

    // WASM DSP state
    wasmReady: boolean;
    wasmLoading: boolean;
    wasmError: string | null;
    wasmEffect: number;

    // Actions
    init: () => Promise<void>;
    togglePlay: () => void;           // Legacy: toggles both
    toggleClassic: () => void;        // Toggle Classic Mode only
    toggleGraph: () => void;          // Toggle Graph Mode only
    setVolume: (val: number) => void;
    setScene: (scene: SoundScene, name: string) => void;
    setAtmosphereParam: (param: string, value: number) => void;
    sendMessage: (msg: AudioMessage) => void;

    // WASM Actions
    initWasm: () => Promise<boolean>;
    setWasmEffect: (effect: number) => void;
    setGranularParams: (params: Partial<GranularParams>) => void;
    setConvolutionParams: (params: Partial<ConvolutionParams>) => void;
    setSpectralParams: (params: Partial<SpectralParams>) => void;

    // Direct Access (use carefully)
    getCore: () => typeof audioCore;
}

// Re-export effect types for convenience
export { EffectType };

export const useAudioStore = create<AudioState>((set, get) => ({
    isPlaying: false,
    isClassicPlaying: false,
    isGraphPlaying: false,
    volume: 0.8,
    currentScene: 'None',

    // WASM DSP initial state
    wasmReady: false,
    wasmLoading: false,
    wasmError: null,
    wasmEffect: EffectType.BYPASS,

    init: async () => {
        await audioCore.init();
    },

    // Legacy toggle - controls both engines (for backward compat)
    togglePlay: () => {
        const { isPlaying } = get();
        if (isPlaying) {
            audioCore.suspend();
            set({ isPlaying: false, isClassicPlaying: false, isGraphPlaying: false });
        } else {
            audioCore.resumeAll();
            set({ isPlaying: true, isClassicPlaying: true, isGraphPlaying: true });
        }
    },

    // Toggle Classic Mode (AtmosphereEngine) independently
    toggleClassic: () => {
        const { isClassicPlaying } = get();
        const atmosphere = audioCore.getAtmosphere();
        
        // Ensure context is running
        audioCore.resume();
        
        if (isClassicPlaying) {
            atmosphere?.stop();
            atmosphere?.setMuted(true);
            set({ isClassicPlaying: false });
        } else {
            atmosphere?.setMuted(false);
            atmosphere?.start();
            set({ isClassicPlaying: true });
        }
        
        // Update legacy isPlaying based on either being active
        const { isGraphPlaying } = get();
        set({ isPlaying: !isClassicPlaying || isGraphPlaying });
    },

    // Toggle Graph Mode (SynthEngine) independently
    toggleGraph: () => {
        const { isGraphPlaying } = get();
        const synth = audioCore.getSynth();
        
        // Ensure context is running
        audioCore.resume();
        
        if (isGraphPlaying) {
            synth?.setMuted(true);
            set({ isGraphPlaying: false });
        } else {
            synth?.setMuted(false);
            set({ isGraphPlaying: true });
        }
        
        // Update legacy isPlaying based on either being active
        const { isClassicPlaying } = get();
        set({ isPlaying: isClassicPlaying || !isGraphPlaying });
    },

    setVolume: (val: number) => {
        const core = audioCore.getMasterBus();
        if (core) {
            core.setVolume(val);
        }
        set({ volume: val });
    },

    setScene: (scene: SoundScene, name: string) => {
        audioCore.setScene(scene);
        set({ currentScene: name });
    },

    setAtmosphereParam: (param: string, value: number) => {
        const atmosphere = audioCore.getAtmosphere();
        if (atmosphere) {
            atmosphere.setParam(param, value);
        }
    },

    sendMessage: (msg: AudioMessage) => {
        const synth = audioCore.getSynth();
        if (synth) {
            synth.sendMessage(msg);
        }
    },

    // ========================================================================
    // WASM DSP ACTIONS
    // ========================================================================

    /**
     * Initialize WASM DSP module.
     * Call this when WASM processing is needed.
     */
    initWasm: async () => {
        const { wasmReady, wasmLoading } = get();
        
        // Skip if already ready or loading
        if (wasmReady || wasmLoading) {
            return wasmReady;
        }

        set({ wasmLoading: true, wasmError: null });

        try {
            const success = await audioCore.initWasm();
            set({ 
                wasmReady: success, 
                wasmLoading: false,
                wasmError: success ? null : 'WASM initialization failed',
            });
            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            set({ 
                wasmReady: false, 
                wasmLoading: false, 
                wasmError: message,
            });
            return false;
        }
    },

    /**
     * Set the active WASM effect type.
     * Use EffectType.GRANULAR, EffectType.CONVOLUTION, etc.
     */
    setWasmEffect: (effect: number) => {
        const wasmNode = audioCore.getWasmNode();
        if (wasmNode) {
            // Cast to EffectType - the value is validated at runtime
            wasmNode.setEffect(effect as typeof EffectType[keyof typeof EffectType]);
            set({ wasmEffect: effect });
        } else {
            console.warn('[useAudioStore] Cannot set effect: WASM not initialized');
        }
    },

    /**
     * Update granular synthesis parameters.
     */
    setGranularParams: (params: Partial<GranularParams>) => {
        const wasmNode = audioCore.getWasmNode();
        if (wasmNode) {
            wasmNode.setGranularParams(params);
        }
    },

    /**
     * Update convolution reverb parameters.
     */
    setConvolutionParams: (params: Partial<ConvolutionParams>) => {
        const wasmNode = audioCore.getWasmNode();
        if (wasmNode) {
            wasmNode.setConvolutionParams(params);
        }
    },

    /**
     * Update spectral effect parameters.
     */
    setSpectralParams: (params: Partial<SpectralParams>) => {
        const wasmNode = audioCore.getWasmNode();
        if (wasmNode) {
            wasmNode.setSpectralParams(params);
        }
    },

    getCore: () => audioCore,
}));
