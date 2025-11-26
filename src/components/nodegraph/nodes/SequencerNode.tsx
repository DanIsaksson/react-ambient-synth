import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

interface SequencerNodeProps {
    id: string;
    data: {
        bpm?: number;
        steps?: boolean[];
        playing?: boolean;
        [key: string]: any;
    };
    selected?: boolean;
}

// Default values defined OUTSIDE selector to avoid infinite loop
// (Zustand compares by reference - new array/object = re-render)
const DEFAULT_STEPS: boolean[] = [true, false, true, false, true, false, true, false];

export const SequencerNode = memo(({ id, data, selected }: SequencerNodeProps) => {
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
    const bpm = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.bpm ?? 120);
    const stepsFromStore = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.steps);
    const steps = stepsFromStore ?? DEFAULT_STEPS;
    const isPlaying = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.playing ?? false);
    
    // Local UI state for animation
    const [currentStep, setCurrentStep] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Step sequencer animation (visual only - synced with worklet timing)
    useEffect(() => {
        if (isPlaying) {
            const intervalMs = (60 / bpm) * 1000 / 2; // 8th notes (same as worklet)
            intervalRef.current = setInterval(() => {
                setCurrentStep(prev => (prev + 1) % steps.length);
            }, intervalMs);
        } else {
            setCurrentStep(0);
        }
        return () => {
            if (intervalRef.current !== null) clearInterval(intervalRef.current);
        };
    }, [isPlaying, bpm, steps.length]);

    // Handlers that update the store
    const handleBpmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { bpm: Number(e.target.value) });
    }, [id, updateNodeData]);

    const toggleStep = useCallback((index: number) => {
        const newSteps = [...steps];
        newSteps[index] = !newSteps[index];
        updateNodeData(id, { steps: newSteps });
    }, [id, steps, updateNodeData]);

    const togglePlaying = useCallback(() => {
        updateNodeData(id, { playing: !isPlaying });
    }, [id, isPlaying, updateNodeData]);

    return (
        <BaseNode 
            title="Sequencer" 
            type="control" 
            selected={selected}
            nodeId={id}
            nodeType="sequencer"
            handles={HANDLE_PRESETS.sequencer}
            icon="⏱️"
        >
            <div className="flex flex-col gap-4">
                {/* Step Grid */}
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="grid grid-cols-8 gap-1.5">
                        {steps.map((active: boolean, i: number) => (
                            <button
                                key={i}
                                onClick={() => toggleStep(i)}
                                className={`
                                    aspect-square rounded-md border-2 transition-all duration-75
                                    ${currentStep === i && isPlaying
                                        ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                                        : 'border-transparent'
                                    }
                                    ${active 
                                        ? `bg-orange-500 ${currentStep === i && isPlaying ? 'shadow-[0_0_20px_rgba(249,115,22,0.8)]' : 'shadow-[0_0_8px_rgba(249,115,22,0.4)]'}` 
                                        : 'bg-gray-800 hover:bg-gray-700'
                                    }
                                `}
                            />
                        ))}
                    </div>
                    {/* Beat markers */}
                    <div className="flex justify-between mt-2 px-1">
                        {[1, 2, 3, 4].map(beat => (
                            <span key={beat} className="text-[8px] text-gray-600 font-mono">{beat}</span>
                        ))}
                    </div>
                </div>

                {/* BPM Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Tempo</label>
                        <span className="text-[10px] text-orange-400 font-mono">{bpm} BPM</span>
                    </div>
                    <input
                        type="range"
                        min="60"
                        max="200"
                        value={bpm}
                        onChange={handleBpmChange}
                        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(249,115,22,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                </div>

                {/* Play/Stop Button */}
                <button 
                    onClick={togglePlaying}
                    className={`
                        w-full py-2 rounded-lg border font-bold text-xs uppercase tracking-wider
                        transition-all duration-150 active:scale-95
                        ${isPlaying 
                            ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)]' 
                            : 'bg-orange-500/10 border-orange-500/50 text-orange-400 hover:bg-orange-500/20'
                        }
                    `}
                >
                    {isPlaying ? '⏹ Stop' : '▶ Play'}
                </button>
            </div>
        </BaseNode>
    );
});
