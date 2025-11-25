import { memo, useState, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';

export const KarplusNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
    const [frequency, setFrequency] = useState(data.frequency || 220);
    const [damping, setDamping] = useState(data.damping || 0.5);
    const [isPlucking, setIsPlucking] = useState(false);

    const handlePluck = useCallback(() => {
        setIsPlucking(true);
        // Visual feedback animation
        setTimeout(() => setIsPlucking(false), 150);
        // TODO: Send pluck message to AudioWorklet
    }, []);

    const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500
        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(236,72,153,0.5)]
        [&::-webkit-slider-thumb]:cursor-pointer`;

    return (
        <BaseNode 
            title="String Synth" 
            type="source" 
            selected={selected}
            handles={HANDLE_PRESETS.stringSynth}
            icon="🎸"
        >
            <div className="flex flex-col gap-4">
                {/* String Visualization */}
                <div className="bg-black/40 rounded-lg p-3 border border-white/5 relative overflow-hidden">
                    <svg width="180" height="30" className="w-full">
                        <defs>
                            <linearGradient id="stringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" />
                                <stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
                                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.2" />
                            </linearGradient>
                        </defs>
                        {/* String line */}
                        <path 
                            d={isPlucking 
                                ? "M 0 15 Q 45 0, 90 15 Q 135 30, 180 15" 
                                : "M 0 15 L 180 15"
                            }
                            stroke="url(#stringGrad)"
                            strokeWidth="2"
                            fill="none"
                            className={`transition-all duration-150 ${isPlucking ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : ''}`}
                        />
                        {/* Bridge dots */}
                        <circle cx="5" cy="15" r="3" fill="#ec4899" opacity="0.6" />
                        <circle cx="175" cy="15" r="3" fill="#ec4899" opacity="0.6" />
                    </svg>
                </div>

                {/* Frequency Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Pitch</label>
                        <span className="text-[10px] text-pink-400 font-mono">{frequency} Hz</span>
                    </div>
                    <input
                        type="range"
                        min="50"
                        max="1000"
                        value={frequency}
                        onChange={(e) => setFrequency(Number(e.target.value))}
                        className={sliderClass}
                    />
                </div>

                {/* Damping Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Damping</label>
                        <span className="text-[10px] text-pink-400 font-mono">{(damping * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={damping}
                        onChange={(e) => setDamping(Number(e.target.value))}
                        className={sliderClass}
                    />
                </div>

                {/* Pluck Button */}
                <button 
                    onClick={handlePluck}
                    style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: isPlucking ? '1px solid #ec4899' : '1px solid rgba(236,72,153,0.4)',
                        background: isPlucking 
                            ? 'linear-gradient(135deg, rgba(236,72,153,0.4) 0%, rgba(236,72,153,0.2) 100%)' 
                            : 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(236,72,153,0.05) 100%)',
                        color: isPlucking ? '#fff' : '#ec4899',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        boxShadow: isPlucking 
                            ? '0 0 25px rgba(236,72,153,0.5), inset 0 0 15px rgba(236,72,153,0.2)' 
                            : '0 0 0 rgba(236,72,153,0)',
                        transition: 'all 150ms ease',
                        cursor: 'pointer',
                        transform: isPlucking ? 'scale(0.97)' : 'scale(1)',
                    }}
                >
                    ⚡ Pluck
                </button>
            </div>
        </BaseNode>
    );
});
