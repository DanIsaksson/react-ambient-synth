import { create } from 'zustand';
import { audioCore } from '../audio/engine/AudioCore';
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

    // Actions
    init: () => Promise<void>;
    togglePlay: () => void;           // Legacy: toggles both
    toggleClassic: () => void;        // Toggle Classic Mode only
    toggleGraph: () => void;          // Toggle Graph Mode only
    setVolume: (val: number) => void;
    setScene: (scene: SoundScene, name: string) => void;
    setAtmosphereParam: (param: string, value: number) => void;
    sendMessage: (msg: AudioMessage) => void;

    // Direct Access (use carefully)
    getCore: () => typeof audioCore;
}

export const useAudioStore = create<AudioState>((set, get) => ({
    isPlaying: false,
    isClassicPlaying: false,
    isGraphPlaying: false,
    volume: 0.8,
    currentScene: 'None',

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

    getCore: () => audioCore,
}));
