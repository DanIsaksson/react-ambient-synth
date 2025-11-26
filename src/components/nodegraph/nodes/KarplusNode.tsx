import { memo, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { ModulatableSlider } from '../shared/ModulatableSlider';

interface KarplusNodeProps {
    id: string;
    data: {
        frequency?: number;
        damping?: number;
        stiffness?: number;
        brightness?: number;
        [key: string]: unknown;
    };
    selected?: boolean;
}

export const KarplusNode = memo(({ id, selected }: KarplusNodeProps) => {
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
    const frequency = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.frequency ?? 220);
    const damping = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.damping ?? 0.5);
    const stiffness = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.stiffness ?? 0);
    const brightness = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.brightness ?? 0.5);

    // Handlers for modulatable parameters
    const handleFrequencyChange = useCallback((value: number) => {
        updateNodeData(id, { frequency: value });
    }, [id, updateNodeData]);

    const handleDampingChange = useCallback((value: number) => {
        updateNodeData(id, { damping: value });
    }, [id, updateNodeData]);

    const handleStiffnessChange = useCallback((value: number) => {
        updateNodeData(id, { stiffness: value });
    }, [id, updateNodeData]);

    const handleBrightnessChange = useCallback((value: number) => {
        updateNodeData(id, { brightness: value });
    }, [id, updateNodeData]);

    return (
        <BaseNode 
            title="Karplus-String" 
            type="source" 
            selected={selected}
            nodeId={id}
            nodeType="karplus"
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
                        {/* String line - animated via CSS */}
                        <path 
                            d="M 0 15 L 180 15"
                            stroke="url(#stringGrad)"
                            strokeWidth="2"
                            fill="none"
                            className="transition-all duration-150"
                        />
                        {/* Bridge dots */}
                        <circle cx="5" cy="15" r="3" fill="#ec4899" opacity="0.6" />
                        <circle cx="175" cy="15" r="3" fill="#ec4899" opacity="0.6" />
                    </svg>
                </div>

                {/* Frequency Control with Modulation Target */}
                <ModulatableSlider
                    nodeId={id}
                    paramName="frequency"
                    label="Pitch"
                    value={frequency}
                    min={50}
                    max={1000}
                    onChange={handleFrequencyChange}
                    unit=" Hz"
                    logarithmic
                    accentColor="red"
                />

                {/* Damping Control with Modulation Target */}
                <ModulatableSlider
                    nodeId={id}
                    paramName="damping"
                    label="Damp"
                    value={damping}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={handleDampingChange}
                    accentColor="red"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                />

                {/* Stiffness Control with Modulation Target */}
                <ModulatableSlider
                    nodeId={id}
                    paramName="stiffness"
                    label="Stiff"
                    value={stiffness}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={handleStiffnessChange}
                    accentColor="red"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                />

                {/* Brightness Control with Modulation Target */}
                <ModulatableSlider
                    nodeId={id}
                    paramName="brightness"
                    label="Bright"
                    value={brightness}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={handleBrightnessChange}
                    accentColor="red"
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                />

                {/* Connection hint */}
                <div 
                    style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(236,72,153,0.2)',
                        background: 'rgba(236,72,153,0.05)',
                        fontSize: 9,
                        color: '#ec4899',
                        textAlign: 'center',
                        opacity: 0.7,
                    }}
                >
                    Connect Euclidean, Sequencer, or Oscillator to input
                </div>
            </div>
        </BaseNode>
    );
});
