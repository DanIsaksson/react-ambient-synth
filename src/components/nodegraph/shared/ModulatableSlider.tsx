import React, { useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

// ============================================================================
// MODULATABLE SLIDER - Slider with modulation target handle
// ============================================================================

interface ModulatableSliderProps {
    nodeId: string;
    paramName: string;        // Parameter name (e.g., 'freq', 'cutoff')
    label: string;            // Display label
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (value: number) => void;
    logarithmic?: boolean;    // Use logarithmic scale
    accentColor?: 'cyan' | 'purple' | 'green' | 'orange' | 'red';
    showModHandle?: boolean;  // Show modulation target handle (default: true)
    formatValue?: (value: number) => string;
}

// Logarithmic conversion helpers
const valueToSlider = (value: number, min: number, max: number): number => {
    const minLog = Math.log(Math.max(min, 1));
    const maxLog = Math.log(max);
    return ((Math.log(Math.max(value, min)) - minLog) / (maxLog - minLog)) * 100;
};

const sliderToValue = (slider: number, min: number, max: number): number => {
    const minLog = Math.log(Math.max(min, 1));
    const maxLog = Math.log(max);
    return Math.exp(minLog + (slider / 100) * (maxLog - minLog));
};

// Color mapping
const colorClasses = {
    cyan: {
        track: 'bg-cyan-500/30',
        fill: 'bg-cyan-500',
        text: 'text-cyan-400',
        glow: 'shadow-[0_0_8px_rgba(6,182,212,0.4)]',
        handle: '!bg-cyan-500 !border-cyan-400',
    },
    purple: {
        track: 'bg-purple-500/30',
        fill: 'bg-purple-500',
        text: 'text-purple-400',
        glow: 'shadow-[0_0_8px_rgba(168,85,247,0.4)]',
        handle: '!bg-purple-500 !border-purple-400',
    },
    green: {
        track: 'bg-green-500/30',
        fill: 'bg-green-500',
        text: 'text-green-400',
        glow: 'shadow-[0_0_8px_rgba(34,197,94,0.4)]',
        handle: '!bg-green-500 !border-green-400',
    },
    orange: {
        track: 'bg-orange-500/30',
        fill: 'bg-orange-500',
        text: 'text-orange-400',
        glow: 'shadow-[0_0_8px_rgba(249,115,22,0.4)]',
        handle: '!bg-orange-500 !border-orange-400',
    },
    red: {
        track: 'bg-red-500/30',
        fill: 'bg-red-500',
        text: 'text-red-400',
        glow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]',
        handle: '!bg-red-500 !border-red-400',
    },
};

export const ModulatableSlider: React.FC<ModulatableSliderProps> = ({
    nodeId,
    paramName,
    label,
    value,
    min,
    max,
    step,
    unit = '',
    onChange,
    logarithmic = false,
    accentColor = 'cyan',
    showModHandle = true,
    formatValue,
}) => {
    const edges = useNodeGraphStore(state => state.edges);
    const colors = colorClasses[accentColor];

    // Check if this parameter is being modulated
    const modConnections = useMemo(() => {
        return edges.filter(
            e => e.target === nodeId && 
                 e.targetHandle === `mod-${paramName}` &&
                 (e.data as any)?.isModulation
        );
    }, [edges, nodeId, paramName]);

    const isModulated = modConnections.length > 0;
    const totalModAmount = modConnections.reduce((sum, e) => sum + ((e.data as any)?.amount || 0.5), 0);

    // Handle slider change
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = Number(e.target.value);
        const actualValue = logarithmic ? sliderToValue(rawValue, min, max) : rawValue;
        onChange(actualValue);
    }, [onChange, logarithmic, min, max]);

    // Calculate slider position for display
    const sliderValue = logarithmic ? valueToSlider(value, min, max) : value;
    const fillPercent = logarithmic 
        ? sliderValue 
        : ((value - min) / (max - min)) * 100;

    // Format display value
    const displayValue = formatValue 
        ? formatValue(value) 
        : value >= 1000 
            ? `${(value / 1000).toFixed(1)}k` 
            : value.toFixed(value < 10 ? 2 : 0);

    // Generate a short symbol/abbreviation for the label (max 2 chars)
    const shortLabel = label.length <= 2 ? label : label.slice(0, 2).toUpperCase();

    return (
        <div className="relative flex items-center gap-1.5 py-1">
            {/* Modulation target handle - positioned outside the flow */}
            {showModHandle && (
                <Handle
                    type="target"
                    id={`mod-${paramName}`}
                    position={Position.Left}
                    className={`!w-2 !h-2 !bg-purple-500 !border-purple-400 !border transition-all ${
                        isModulated ? 'scale-125 !shadow-[0_0_8px_rgba(168,85,247,0.6)]' : ''
                    }`}
                    style={{
                        left: -8,
                        borderRadius: 2,
                        transform: 'rotate(45deg)',
                    }}
                />
            )}

            {/* Compact Label - just 2 chars */}
            <span 
                className="text-[9px] text-gray-500 uppercase font-medium w-5 shrink-0 text-center"
                title={label}
            >
                {shortLabel}
            </span>

            {/* Slider container - takes most space */}
            <div className="relative flex-1 h-4 flex items-center min-w-0">
                {/* Interaction layer - invisible input on top for mouse/touch */}
                <input
                    type="range"
                    min={logarithmic ? 0 : min}
                    max={logarithmic ? 100 : max}
                    step={logarithmic ? 0.1 : step}
                    value={sliderValue}
                    onChange={handleChange}
                    className="nodrag nopan absolute inset-0 w-full h-full cursor-pointer z-20"
                    style={{ 
                        opacity: 0,
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                    }}
                />

                {/* Track background */}
                <div className={`absolute inset-0 h-1.5 rounded-full ${colors.track} z-0`} style={{ top: '50%', transform: 'translateY(-50%)' }} />
                
                {/* Fill */}
                <div 
                    className={`absolute left-0 h-1.5 rounded-full ${colors.fill} transition-all duration-75 z-10`}
                    style={{ width: `${fillPercent}%`, top: '50%', transform: 'translateY(-50%)' }}
                />

                {/* Modulation indicator ring */}
                {isModulated && (
                    <div 
                        className="absolute left-0 h-1.5 rounded-full bg-purple-500/30 animate-pulse z-10"
                        style={{ 
                            width: `${Math.min(100, fillPercent + totalModAmount * 50)}%`,
                            top: '50%', 
                            transform: 'translateY(-50%)',
                        }}
                    />
                )}

                {/* Thumb indicator - visual only */}
                <div 
                    className={`absolute w-3 h-3 rounded-full ${colors.fill} ${colors.glow} pointer-events-none transition-all duration-75 z-10`}
                    style={{ 
                        left: `calc(${fillPercent}% - 6px)`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                    }}
                />
            </div>

            {/* Value display - compact */}
            <span className={`text-[9px] ${colors.text} font-mono shrink-0 text-right min-w-[32px]`}>
                {displayValue}{unit}
            </span>

            {/* Modulation indicator dot */}
            {isModulated && (
                <div 
                    className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-purple-500 animate-pulse"
                    style={{ 
                        opacity: 0.3 + totalModAmount * 0.7,
                        boxShadow: `0 0 ${4 + totalModAmount * 6}px rgba(139, 92, 246, 0.5)`,
                    }}
                    title={`Modulated by ${modConnections.length} source(s)`}
                />
            )}
        </div>
    );
};

// ============================================================================
// MODULATION AMOUNT EDITOR - Popover for editing modulation connection
// ============================================================================

interface ModulationAmountEditorProps {
    edgeId: string;
    amount: number;
    bipolar: boolean;
    position: { x: number; y: number };
    onClose: () => void;
}

export const ModulationAmountEditor: React.FC<ModulationAmountEditorProps> = ({
    edgeId,
    amount,
    bipolar,
    position,
    onClose,
}) => {
    const updateEdgeData = useNodeGraphStore(state => state.updateEdgeData);
    const deleteEdge = useNodeGraphStore(state => state.deleteEdge);

    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateEdgeData(edgeId, { amount: Number(e.target.value) });
    }, [edgeId, updateEdgeData]);

    const handleBipolarToggle = useCallback(() => {
        updateEdgeData(edgeId, { bipolar: !bipolar });
    }, [edgeId, bipolar, updateEdgeData]);

    const handleDelete = useCallback(() => {
        deleteEdge(edgeId);
        onClose();
    }, [edgeId, deleteEdge, onClose]);

    return (
        <div 
            className="fixed z-50 bg-gray-900/95 border border-purple-500/30 rounded-lg p-3 shadow-xl backdrop-blur-sm"
            style={{ 
                left: position.x, 
                top: position.y,
                transform: 'translate(-50%, -100%) translateY(-10px)',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col gap-3 w-40">
                {/* Amount slider */}
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-[10px] text-gray-400 uppercase">Amount</span>
                        <span className="text-[10px] text-purple-400 font-mono">
                            {Math.round(amount * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={amount}
                        onChange={handleAmountChange}
                        className="nodrag nopan w-full h-1.5 bg-purple-900/50 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-3
                            [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-purple-500
                            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                    />
                </div>
                
                {/* Bipolar toggle */}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase">Bipolar (±)</span>
                    <button
                        onClick={handleBipolarToggle}
                        className={`w-8 h-4 rounded-full transition-colors ${
                            bipolar ? 'bg-purple-500' : 'bg-gray-700'
                        }`}
                    >
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                            bipolar ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                    </button>
                </div>
                
                {/* Delete button */}
                <button
                    onClick={handleDelete}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors text-left"
                >
                    Remove Connection
                </button>
            </div>
        </div>
    );
};

export default ModulatableSlider;
