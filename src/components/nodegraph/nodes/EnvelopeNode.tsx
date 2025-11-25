import { memo, useState, useMemo } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';

export const EnvelopeNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
    const [attack, setAttack] = useState(data.attack || 10);
    const [decay, setDecay] = useState(data.decay || 100);
    const [sustain, setSustain] = useState(data.sustain || 70);
    const [release, setRelease] = useState(data.release || 500);

    // Generate SVG path for envelope visualization
    const envPath = useMemo(() => {
        const width = 180;
        const height = 40;
        const maxTime = attack + decay + 200 + release; // 200ms sustain display
        
        const aX = (attack / maxTime) * width;
        const dX = aX + (decay / maxTime) * width;
        const sX = dX + (200 / maxTime) * width;
        const rX = width;
        
        const sY = height - (sustain / 100) * height;
        
        return `M 0 ${height} L ${aX} 0 L ${dX} ${sY} L ${sX} ${sY} L ${rX} ${height}`;
    }, [attack, decay, sustain, release]);

    const formatMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

    const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500
        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(245,158,11,0.5)]
        [&::-webkit-slider-thumb]:cursor-pointer`;

    return (
        <BaseNode 
            title="Envelope" 
            type="control" 
            selected={selected}
            handles={HANDLE_PRESETS.envelope}
            icon="📈"
        >
            <div className="flex flex-col gap-3">
                {/* Envelope Visualization */}
                <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                    <svg width="180" height="40" className="w-full">
                        <defs>
                            <linearGradient id="envGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path 
                            d={envPath} 
                            fill="url(#envGrad)"
                            stroke="#f59e0b" 
                            strokeWidth="2"
                            className="drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]"
                        />
                    </svg>
                </div>

                {/* ADSR Controls in 2x2 Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Attack */}
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <label className="text-[9px] text-gray-500 uppercase">Attack</label>
                            <span className="text-[9px] text-amber-400 font-mono">{formatMs(attack)}</span>
                        </div>
                        <input type="range" min="0" max="2000" value={attack} onChange={(e) => setAttack(Number(e.target.value))} className={sliderClass} />
                    </div>

                    {/* Decay */}
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <label className="text-[9px] text-gray-500 uppercase">Decay</label>
                            <span className="text-[9px] text-amber-400 font-mono">{formatMs(decay)}</span>
                        </div>
                        <input type="range" min="0" max="2000" value={decay} onChange={(e) => setDecay(Number(e.target.value))} className={sliderClass} />
                    </div>

                    {/* Sustain */}
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <label className="text-[9px] text-gray-500 uppercase">Sustain</label>
                            <span className="text-[9px] text-amber-400 font-mono">{sustain}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={sustain} onChange={(e) => setSustain(Number(e.target.value))} className={sliderClass} />
                    </div>

                    {/* Release */}
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <label className="text-[9px] text-gray-500 uppercase">Release</label>
                            <span className="text-[9px] text-amber-400 font-mono">{formatMs(release)}</span>
                        </div>
                        <input type="range" min="0" max="5000" value={release} onChange={(e) => setRelease(Number(e.target.value))} className={sliderClass} />
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});
