import { memo, useState, useEffect, useRef } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';

export const SequencerNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
    const [bpm, setBpm] = useState(data.bpm || 120);
    const [steps, setSteps] = useState<boolean[]>(data.steps || Array(8).fill(false).map((_, i) => i % 2 === 0));
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Step sequencer animation
    useEffect(() => {
        if (isPlaying) {
            const intervalMs = (60 / bpm) * 1000 / 2; // 8th notes
            intervalRef.current = setInterval(() => {
                setCurrentStep(prev => (prev + 1) % 8);
            }, intervalMs);
        }
        return () => {
            if (intervalRef.current !== null) clearInterval(intervalRef.current);
        };
    }, [isPlaying, bpm]);

    const toggleStep = (index: number) => {
        setSteps(prev => {
            const newSteps = [...prev];
            newSteps[index] = !newSteps[index];
            return newSteps;
        });
    };

    return (
        <BaseNode 
            title="Sequencer" 
            type="control" 
            selected={selected}
            handles={HANDLE_PRESETS.sequencer}
            icon="🎹"
        >
            <div className="flex flex-col gap-4">
                {/* Step Grid */}
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="grid grid-cols-8 gap-1.5">
                        {steps.map((active, i) => (
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
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(249,115,22,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                </div>

                {/* Play/Stop Button */}
                <button 
                    onClick={() => setIsPlaying(!isPlaying)}
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
