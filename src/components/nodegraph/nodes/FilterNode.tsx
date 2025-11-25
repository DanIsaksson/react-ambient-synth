import { memo, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

interface FilterNodeProps {
    id: string;
    data: {
        cutoff?: number;
        resonance?: number;
        filterType?: string;
        [key: string]: any;
    };
    selected?: boolean;
}

export const FilterNode = memo(({ id, data, selected }: FilterNodeProps) => {
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
    const cutoff = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.cutoff ?? 1000);
    const resonance = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.resonance ?? 1);
    const filterType = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.filterType ?? 'lowpass');

    // Convert linear slider to logarithmic for frequency
    const freqToSlider = (freq: number) => Math.log2(freq / 20) / Math.log2(20000 / 20) * 100;
    const sliderToFreq = (val: number) => Math.round(20 * Math.pow(20000 / 20, val / 100));

    // Handlers
    const handleCutoffChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { cutoff: sliderToFreq(Number(e.target.value)) });
    }, [id, updateNodeData]);

    const handleResonanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { resonance: Number(e.target.value) });
    }, [id, updateNodeData]);

    const handleFilterTypeChange = useCallback((type: string) => {
        updateNodeData(id, { filterType: type });
    }, [id, updateNodeData]);

    return (
        <BaseNode 
            title="Filter" 
            type="effect" 
            selected={selected}
            nodeId={id}
            handles={HANDLE_PRESETS.filter}
            icon="⫘"
        >
            <div className="flex flex-col gap-4">
                {/* Cutoff Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Cutoff</label>
                        <span className="text-[10px] text-purple-400 font-mono">
                            {cutoff >= 1000 ? `${(cutoff / 1000).toFixed(1)}k` : cutoff} Hz
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={freqToSlider(cutoff)}
                        onChange={handleCutoffChange}
                        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                </div>

                {/* Resonance Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Resonance</label>
                        <span className="text-[10px] text-purple-400 font-mono">{resonance.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="30"
                        step="0.1"
                        value={resonance}
                        onChange={handleResonanceChange}
                        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                </div>

                {/* Filter Type Select */}
                <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Type</label>
                    <div className="grid grid-cols-3 gap-1">
                        {['lowpass', 'highpass', 'bandpass'].map((type) => (
                            <button
                                key={type}
                                onClick={() => handleFilterTypeChange(type)}
                                style={{
                                    padding: '6px 8px',
                                    fontSize: 9,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    borderRadius: 6,
                                    border: filterType === type 
                                        ? '1px solid rgb(168,85,247)' 
                                        : '1px solid rgba(255,255,255,0.1)',
                                    background: filterType === type 
                                        ? 'rgba(168,85,247,0.15)' 
                                        : 'rgba(0,0,0,0.3)',
                                    color: filterType === type 
                                        ? 'rgb(168,85,247)' 
                                        : 'rgba(255,255,255,0.4)',
                                    boxShadow: filterType === type 
                                        ? '0 0 12px rgba(168,85,247,0.3), inset 0 0 8px rgba(168,85,247,0.1)' 
                                        : 'none',
                                    transition: 'all 150ms ease',
                                    cursor: 'pointer',
                                }}
                            >
                                {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});
