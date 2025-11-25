import { create } from 'zustand';

export interface LFO {
    id: string;
    frequency: number;
    waveform: 'sine' | 'triangle' | 'square' | 'sawtooth';
    depth: number;
    targetParam?: string; // e.g., "node-1.frequency"
}

export interface Macro {
    id: string;
    label: string;
    value: number; // 0-1
    mappings: {
        nodeId: string;
        param: string;
        min: number;
        max: number;
    }[];
}

interface ModulationState {
    lfos: LFO[];
    macros: Macro[];
    addLFO: () => void;
    updateLFO: (id: string, data: Partial<LFO>) => void;
    addMacro: (label: string) => void;
    setMacroValue: (id: string, value: number) => void;
    addMacroMapping: (macroId: string, mapping: Macro['mappings'][0]) => void;
}

export const useModulationStore = create<ModulationState>((set) => ({
    lfos: [],
    macros: [
        { id: 'macro-1', label: 'Tension', value: 0, mappings: [] },
        { id: 'macro-2', label: 'Space', value: 0, mappings: [] },
        { id: 'macro-3', label: 'Force', value: 0, mappings: [] },
        { id: 'macro-4', label: 'Flow', value: 0, mappings: [] },
    ],
    addLFO: () => set((state) => ({
        lfos: [...state.lfos, {
            id: `lfo-${Date.now()}`,
            frequency: 1,
            waveform: 'sine',
            depth: 0.5
        }]
    })),
    updateLFO: (id, data) => set((state) => ({
        lfos: state.lfos.map(lfo => lfo.id === id ? { ...lfo, ...data } : lfo)
    })),
    addMacro: (label) => set((state) => ({
        macros: [...state.macros, {
            id: `macro-${Date.now()}`,
            label,
            value: 0,
            mappings: []
        }]
    })),
    setMacroValue: (id, value) => set((state) => ({
        macros: state.macros.map(m => m.id === id ? { ...m, value } : m)
    })),
    addMacroMapping: (macroId, mapping) => set((state) => ({
        macros: state.macros.map(m => m.id === macroId ? {
            ...m,
            mappings: [...m.mappings, mapping]
        } : m)
    })),
}));
