import { create } from 'zustand';
import { audioCore } from '../audio/engine/AudioCore';
import type { AudioMessage } from '../audio/types';
import type { SoundScene } from '../audio/scenes/SoundScene';

interface AudioState {
    isPlaying: boolean;
    volume: number;
    currentScene: string;

    // Actions
    init: () => Promise<void>;
    togglePlay: () => void;
    setVolume: (val: number) => void;
    setScene: (scene: SoundScene, name: string) => void;
    setAtmosphereParam: (param: string, value: number) => void;
    sendMessage: (msg: AudioMessage) => void;

    // Direct Access (use carefully)
    getCore: () => typeof audioCore;
}

export const useAudioStore = create<AudioState>((set, get) => ({
    isPlaying: false,
    volume: 0.8,
    currentScene: 'None',

    init: async () => {
        await audioCore.init();
    },

    togglePlay: () => {
        const { isPlaying } = get();
        if (isPlaying) {
            audioCore.suspend();
            set({ isPlaying: false });
        } else {
            audioCore.resume();
            set({ isPlaying: true });
        }
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
