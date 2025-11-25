import { memo, useState, useEffect, useRef } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';

interface OutputNodeProps {
    id: string;
    selected?: boolean;
}

export const OutputNode = memo(({ id, selected }: OutputNodeProps) => {
    // Fake meter animation (will be replaced by real metering in Phase 6)
    const [meterL, setMeterL] = useState(0);
    const [meterR, setMeterR] = useState(0);
    const animRef = useRef<number | null>(null);

    useEffect(() => {
        // Simulated meter movement for visual demonstration
        const animate = () => {
            setMeterL(prev => {
                const target = 0.3 + Math.random() * 0.4;
                return prev + (target - prev) * 0.3;
            });
            setMeterR(prev => {
                const target = 0.3 + Math.random() * 0.4;
                return prev + (target - prev) * 0.3;
            });
            animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    const getMeterColor = (level: number) => {
        if (level > 0.9) return '#ef4444'; // Red - clipping
        if (level > 0.7) return '#f59e0b'; // Amber - hot
        return '#10b981'; // Green - normal
    };

    return (
        <BaseNode 
            title="Output" 
            type="output" 
            selected={selected}
            nodeId={id}
            handles={HANDLE_PRESETS.sinkOnly}
            icon="🔊"
            compact
        >
            <div className="flex flex-col items-center gap-3">
                {/* Stereo Meters */}
                <div className="flex gap-2 w-full justify-center">
                    {/* Left Channel */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-4 h-16 bg-black/60 rounded-full overflow-hidden border border-white/10 relative">
                            <div 
                                className="absolute bottom-0 left-0 right-0 transition-all duration-75 rounded-full"
                                style={{
                                    height: `${meterL * 100}%`,
                                    background: `linear-gradient(to top, ${getMeterColor(meterL)}, ${getMeterColor(meterL)}88)`,
                                    boxShadow: `0 0 10px ${getMeterColor(meterL)}60`,
                                }}
                            />
                        </div>
                        <span className="text-[8px] text-gray-500">L</span>
                    </div>
                    
                    {/* Right Channel */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-4 h-16 bg-black/60 rounded-full overflow-hidden border border-white/10 relative">
                            <div 
                                className="absolute bottom-0 left-0 right-0 transition-all duration-75 rounded-full"
                                style={{
                                    height: `${meterR * 100}%`,
                                    background: `linear-gradient(to top, ${getMeterColor(meterR)}, ${getMeterColor(meterR)}88)`,
                                    boxShadow: `0 0 10px ${getMeterColor(meterR)}60`,
                                }}
                            />
                        </div>
                        <span className="text-[8px] text-gray-500">R</span>
                    </div>
                </div>

                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Master</div>
            </div>
        </BaseNode>
    );
});
