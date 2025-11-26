import { memo, useState, useCallback } from 'react';
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
        trigger?: boolean;
        [key: string]: any;
    };
    selected?: boolean;
}

export const KarplusNode = memo(({ id, data, selected }: KarplusNodeProps) => {
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
    const frequency = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.frequency ?? 220);
    const damping = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.damping ?? 0.5);
    const stiffness = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.stiffness ?? 0);
    const brightness = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.brightness ?? 0.5);
    
    // Local UI state for visual feedback
    const [isPlucking, setIsPlucking] = useState(false);

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

    const handlePluck = useCallback(() => {
        setIsPlucking(true);
        // Visual feedback animation
        setTimeout(() => setIsPlucking(false), 150);
        // Send trigger to worklet via store (will be synced to AudioWorklet)
        updateNodeData(id, { trigger: true });
        // Reset trigger after brief delay
        setTimeout(() => updateNodeData(id, { trigger: false }), 50);
    }, [id, updateNodeData]);

    return (
        <BaseNode 
            title="Karplus-Strong" 
            type="source" 
            selected={selected}
            nodeId={id}
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
