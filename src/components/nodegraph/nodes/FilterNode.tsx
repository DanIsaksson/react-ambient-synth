import { memo, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { ModulatableSlider } from '../shared/ModulatableSlider';

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

    // Handlers
    const handleCutoffChange = useCallback((value: number) => {
        updateNodeData(id, { cutoff: value });
    }, [id, updateNodeData]);

    const handleResonanceChange = useCallback((value: number) => {
        updateNodeData(id, { resonance: value });
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
            nodeType="filter"
            handles={HANDLE_PRESETS.filter}
            icon="⫘"
        >
            <div className="flex flex-col gap-4">
                {/* Cutoff Control with Modulation Target */}
                <ModulatableSlider
                    nodeId={id}
                    paramName="cutoff"
                    label="Cutoff"
                    value={cutoff}
                    min={20}
                    max={20000}
                    onChange={handleCutoffChange}
                    unit=" Hz"
                    logarithmic
                    accentColor="purple"
                />

                {/* Resonance Control with Modulation Target */}
                <ModulatableSlider
                    nodeId={id}
                    paramName="resonance"
                    label="Reso"
                    value={resonance}
                    min={0.1}
                    max={30}
                    step={0.1}
                    onChange={handleResonanceChange}
                    accentColor="purple"
                    formatValue={(v) => v.toFixed(1)}
                />

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
