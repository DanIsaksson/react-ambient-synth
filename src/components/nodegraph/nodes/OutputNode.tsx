import { memo, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useAudioMeter } from '../../../hooks/useAudioMeter';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

interface OutputNodeProps {
    id: string;
    selected?: boolean;
}

export const OutputNode = memo(({ id, selected }: OutputNodeProps) => {
    // Real audio metering from master bus
    const { left: meterL, right: meterR } = useAudioMeter(true);
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read from Zustand store to get latest values
    const volume = useNodeGraphStore(state => {
        const node = state.nodes.find(n => n.id === id);
        return node?.data?.gain ?? 0.7;
    });
    const isMuted = useNodeGraphStore(state => {
        const node = state.nodes.find(n => n.id === id);
        return node?.data?.isMuted ?? false;
    });

    // Update per-node gain in the graph (syncs to worklet automatically)
    const handleMuteToggle = useCallback(() => {
        updateNodeData(id, { isMuted: !isMuted });
    }, [id, isMuted, updateNodeData]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        updateNodeData(id, { gain: newVolume });
        if (isMuted && newVolume > 0) {
            updateNodeData(id, { isMuted: false });
        }
    }, [id, isMuted, updateNodeData]);

    const getMeterColor = (level: number) => {
        if (level > 0.9) return '#ef4444'; // Red - clipping
        if (level > 0.7) return '#f59e0b'; // Amber - hot
        return '#10b981'; // Green - normal
    };

    return (
        <div data-tour="output-node">
        <BaseNode 
            title="Output" 
            type="output" 
            selected={selected}
            nodeId={id}
            nodeType="output"
            handles={HANDLE_PRESETS.sinkOnly}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
            compact
        >
            <div className="flex flex-col items-center gap-3">
                {/* Volume Slider */}
                <div className="w-full px-1">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className={`
                            w-full h-1.5 rounded-full appearance-none cursor-pointer
                            ${isMuted ? 'bg-gray-800 opacity-50' : 'bg-gray-800'}
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full
                            ${isMuted 
                                ? '[&::-webkit-slider-thumb]:bg-gray-600' 
                                : '[&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                            }
                            [&::-webkit-slider-thumb]:cursor-pointer
                        `}
                    />
                </div>

                {/* Stereo Meters */}
                <div className="flex gap-2 w-full justify-center">
                    {/* Left Channel */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-4 h-16 bg-black/60 rounded-full overflow-hidden border border-white/10 relative">
                            <div 
                                className="absolute bottom-0 left-0 right-0 transition-all duration-75 rounded-full"
                                style={{
                                    height: `${(isMuted ? 0 : meterL) * 100}%`,
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
                                    height: `${(isMuted ? 0 : meterR) * 100}%`,
                                    background: `linear-gradient(to top, ${getMeterColor(meterR)}, ${getMeterColor(meterR)}88)`,
                                    boxShadow: `0 0 10px ${getMeterColor(meterR)}60`,
                                }}
                            />
                        </div>
                        <span className="text-[8px] text-gray-500">R</span>
                    </div>
                </div>

                <div className={`text-[9px] uppercase tracking-wider ${isMuted ? 'text-red-400' : 'text-gray-500'}`}>
                    {isMuted ? 'Muted' : 'Output'}
                </div>
            </div>
        </BaseNode>
        </div>
    );
});
