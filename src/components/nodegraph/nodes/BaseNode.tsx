import React, { useRef, useCallback, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { useConnectionStateStore } from '../../../store/connectionStateStore';
import { getHandleSignalType, isSignalCompatible } from '../handleTypes';
import { getNodeInfo } from '../nodeInfo';

// ============================================================================
// TYPES
// ============================================================================

type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

interface HandleConfig {
    id: string;
    type: 'source' | 'target';
    position: HandlePosition;
    label?: string;
    color?: string; // Tailwind color name (e.g., 'cyan', 'purple', 'orange')
    offset?: number; // Percentage offset from center (0-100), useful for multiple handles on same side
}

interface BaseNodeProps {
    title: string;
    type: 'source' | 'effect' | 'control' | 'output' | 'io';
    selected?: boolean;
    children: React.ReactNode;
    handles?: HandleConfig[];
    icon?: React.ReactNode;
    compact?: boolean; // For smaller nodes like Output
    nodeId?: string; // For delete functionality
    nodeType?: string; // For compatibility checking during connection
    // Future: signalLevel for metering (Phase 6)
    signalLevel?: number;
    // Mute functionality
    isMuted?: boolean;
    onMuteToggle?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_COLORS: Record<string, { border: string; glow: string; accent: string }> = {
    source: {
        border: 'border-cyan-500',
        glow: 'shadow-[0_0_20px_rgba(6,182,212,0.4)]',
        accent: '#06b6d4',
    },
    effect: {
        border: 'border-purple-500',
        glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
        accent: '#a855f7',
    },
    control: {
        border: 'border-amber-500',
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
        accent: '#f59e0b',
    },
    output: {
        border: 'border-emerald-500',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
        accent: '#10b981',
    },
    io: {
        border: 'border-white',
        glow: 'shadow-[0_0_20px_rgba(255,255,255,0.3)]',
        accent: '#ffffff',
    },
};

const HANDLE_COLORS: Record<string, string> = {
    cyan: '#06b6d4',
    purple: '#a855f7',
    amber: '#f59e0b',
    orange: '#f97316',
    emerald: '#10b981',
    green: '#22c55e',
    red: '#ef4444',
    pink: '#ec4899',
    blue: '#3b82f6',
    white: '#ffffff',
};

const POSITION_MAP: Record<HandlePosition, Position> = {
    top: Position.Top,
    bottom: Position.Bottom,
    left: Position.Left,
    right: Position.Right,
};

// ============================================================================
// DEFAULT HANDLES
// ============================================================================

const DEFAULT_HANDLES: HandleConfig[] = [
    { id: 'input', type: 'target', position: 'top', color: 'blue' },
    { id: 'output', type: 'source', position: 'bottom', color: 'orange' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const BaseNode: React.FC<BaseNodeProps> = ({
    title,
    type,
    selected = false,
    children,
    handles = DEFAULT_HANDLES,
    icon,
    compact = false,
    nodeId,
    nodeType,
    signalLevel = 0,
    isMuted: externalMuted,
    onMuteToggle,
}) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const colors = TYPE_COLORS[type] || TYPE_COLORS.source;
    const deleteNode = useNodeGraphStore(state => state.deleteNode);
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Connection state for visual feedback
    const { isConnecting, sourceNodeType, sourceHandleId, sourceHandleType } = useConnectionStateStore();
    
    // Calculate compatibility for a handle during active connection
    const getHandleCompatibility = useMemo(() => {
        return (handleId: string, handleType: 'source' | 'target'): 'neutral' | 'compatible' | 'incompatible' => {
            if (!isConnecting || !sourceNodeType || !sourceHandleId || !nodeType) {
                return 'neutral';
            }
            
            // Can't connect same types (source to source, target to target)
            if (sourceHandleType === handleType) {
                return 'neutral';
            }
            
            // Get signal types
            const sourceSignal = getHandleSignalType(sourceNodeType, sourceHandleId);
            const targetSignal = getHandleSignalType(nodeType, handleId);
            
            if (!sourceSignal || !targetSignal) {
                return 'neutral';
            }
            
            // Check compatibility based on direction
            let isCompatible: boolean;
            if (sourceHandleType === 'source') {
                // Dragging from source -> this target
                isCompatible = handleType === 'target' && isSignalCompatible(sourceSignal, targetSignal);
            } else {
                // Dragging from target -> this source
                isCompatible = handleType === 'source' && isSignalCompatible(targetSignal, sourceSignal);
            }
            
            return isCompatible ? 'compatible' : 'incompatible';
        };
    }, [isConnecting, sourceNodeType, sourceHandleId, sourceHandleType, nodeType]);
    
    // Read muted state from store if nodeId is provided
    const storedMuted = useNodeGraphStore(state => {
        if (!nodeId) return false;
        const node = state.nodes.find(n => n.id === nodeId);
        return node?.data?.isMuted ?? false;
    });
    
    // Use external muted prop if provided, otherwise use stored state
    const isMuted = externalMuted ?? storedMuted;

    // Mute handler - toggles muted state in store
    const handleMuteToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onMuteToggle) {
            onMuteToggle();
        } else if (nodeId) {
            // Toggle muted state in store
            updateNodeData(nodeId, { isMuted: !isMuted });
        }
    }, [onMuteToggle, nodeId, isMuted, updateNodeData]);

    // Delete handler
    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent node selection
        e.preventDefault();
        if (nodeId) {
            deleteNode(nodeId);
        }
    }, [nodeId, deleteNode]);

    // Info popup state
    const [showInfo, setShowInfo] = useState(false);
    const nodeInfo = nodeType ? getNodeInfo(nodeType) : null;
    
    const handleInfoToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowInfo(prev => !prev);
    }, []);

    // Group handles by position for offset calculation
    const handlesByPosition = handles.reduce((acc, handle) => {
        if (!acc[handle.position]) acc[handle.position] = [];
        acc[handle.position].push(handle);
        return acc;
    }, {} as Record<HandlePosition, HandleConfig[]>);

    // Calculate handle style with offset
    const getHandleStyle = (handle: HandleConfig, index: number, total: number): React.CSSProperties => {
        const color = HANDLE_COLORS[handle.color || 'blue'] || handle.color || '#3b82f6';
        const baseStyle: React.CSSProperties = {
            background: selected ? color : '#1f2937',
            borderColor: color,
            borderWidth: 2,
            width: 12,
            height: 12,
            transition: 'all 0.2s ease',
        };

        // Calculate offset for multiple handles on same side
        if (total > 1) {
            const spacing = 100 / (total + 1);
            const offset = spacing * (index + 1);

            if (handle.position === 'left' || handle.position === 'right') {
                baseStyle.top = `${handle.offset ?? offset}%`;
            } else {
                baseStyle.left = `${handle.offset ?? offset}%`;
            }
        }

        return baseStyle;
    };

    return (
        <div
            ref={nodeRef}
            className={`
                relative rounded-2xl overflow-visible
                transition-all duration-200 ease-out
                ${compact ? 'min-w-[100px]' : 'min-w-[180px]'}
                ${selected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
            `}
            style={{
                '--signal-level': signalLevel,
                '--accent-color': colors.accent,
                background: `linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(10,10,15,0.98) 100%)`,
                border: `1px solid ${selected ? colors.accent : 'rgba(255,255,255,0.08)'}`,
                boxShadow: selected 
                    ? `0 0 30px -5px ${colors.accent}50, 0 20px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)` 
                    : `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)`,
            } as React.CSSProperties}
        >
            {/* Glow effect overlay */}
            <div 
                className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
                style={{
                    opacity: selected ? 0.15 : 0,
                    background: `radial-gradient(ellipse at top, ${colors.accent} 0%, transparent 70%)`,
                }}
            />

            {/* Header - drag handle */}
            <div className={`px-3 py-2 flex items-center gap-2 border-b border-white/5 cursor-grab active:cursor-grabbing`}>
                {/* Status dot */}
                <div 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                        backgroundColor: selected ? colors.accent : 'rgba(255,255,255,0.2)',
                        boxShadow: selected ? `0 0 6px ${colors.accent}` : 'none',
                    }}
                />
                
                {/* Title */}
                <span 
                    className="text-[10px] font-semibold tracking-wider uppercase truncate flex-1"
                    style={{ color: selected ? colors.accent : 'rgba(255,255,255,0.6)' }}
                >
                    {title}
                </span>
                
                {/* Icon (if provided) */}
                {icon && (
                    <span className="text-xs opacity-40">{icon}</span>
                )}

                {/* Mute button - always visible when nodeId is present */}
                {nodeId && (
                    <button
                        onClick={handleMuteToggle}
                        className={`w-5 h-5 flex items-center justify-center rounded
                                   transition-all duration-150
                                   ${isMuted 
                                       ? 'text-red-400 bg-red-500/20' 
                                       : 'text-white/30 hover:text-amber-500 hover:bg-amber-500/20'}`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                                <line x1="23" y1="9" x2="17" y2="15" />
                                <line x1="17" y1="9" x2="23" y2="15" />
                            </svg>
                        ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                        )}
                    </button>
                )}

                {/* Info button */}
                {nodeType && (
                    <button
                        onClick={handleInfoToggle}
                        className={`w-5 h-5 flex items-center justify-center rounded
                                   transition-all duration-150
                                   ${showInfo 
                                       ? 'text-cyan-400 bg-cyan-500/20' 
                                       : 'text-white/30 hover:text-cyan-400 hover:bg-cyan-500/20'}`}
                        title="Node Info"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                        </svg>
                    </button>
                )}

                {/* Delete button */}
                {nodeId && (
                    <button
                        onClick={handleDelete}
                        className="w-5 h-5 flex items-center justify-center rounded
                                   text-white/30 hover:text-red-500 hover:bg-red-500/20
                                   transition-all duration-150"
                        title="Delete node"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path 
                                d="M2 2L10 10M10 2L2 10" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                )}
            </div>
            
            {/* Info Popup */}
            {showInfo && nodeInfo && (
                <div 
                    className="absolute left-full top-0 ml-2 z-50 w-64 bg-gray-900/95 border border-cyan-500/30 rounded-xl p-3 shadow-xl backdrop-blur-sm"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-cyan-400 font-semibold text-sm">{nodeInfo.name}</span>
                        <button 
                            onClick={handleInfoToggle}
                            className="text-white/30 hover:text-white transition-colors"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12">
                                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Description */}
                    <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                        {nodeInfo.description}
                    </p>
                    
                    {/* I/O Info */}
                    <div className="space-y-2 mb-3">
                        <div className="flex items-start gap-2">
                            <span className="text-[9px] text-cyan-500 uppercase font-bold w-10 shrink-0">Out:</span>
                            <span className="text-[9px] text-gray-300">{nodeInfo.outputs}</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-[9px] text-blue-500 uppercase font-bold w-10 shrink-0">In:</span>
                            <span className="text-[9px] text-gray-300">{nodeInfo.inputs}</span>
                        </div>
                    </div>
                    
                    {/* Compatible nodes */}
                    <div className="mb-3">
                        <span className="text-[9px] text-green-500 uppercase font-bold block mb-1">Works with:</span>
                        <div className="flex flex-wrap gap-1">
                            {nodeInfo.compatibleWith.map(compat => (
                                <span 
                                    key={compat}
                                    className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] text-gray-400"
                                >
                                    {compat}
                                </span>
                            ))}
                        </div>
                    </div>
                    
                    {/* Example */}
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                        <span className="text-[9px] text-amber-500 uppercase font-bold block mb-1">Example:</span>
                        <p className="text-[9px] text-gray-300 leading-relaxed">{nodeInfo.example}</p>
                    </div>
                    
                    {/* Not implemented warning */}
                    {!nodeInfo.implemented && (
                        <div className="mt-2 flex items-center gap-2 text-[9px] text-orange-400 bg-orange-500/10 rounded px-2 py-1">
                            <span>⚠️</span>
                            <span>Audio processing not yet implemented</span>
                        </div>
                    )}
                </div>
            )}

            {/* Content - nodrag prevents ReactFlow from intercepting mouse events on interactive elements */}
            <div className={`nodrag cursor-default ${compact ? 'p-2' : 'p-3'} ${isMuted ? 'opacity-40 grayscale' : ''} transition-all duration-200`}>
                {children}
            </div>
            
            {/* Muted overlay indicator */}
            {isMuted && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-red-500/30 bg-red-900/10" />
            )}

            {/* Signal Level Bar */}
            {signalLevel > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50 overflow-hidden">
                    <div 
                        className="h-full transition-all duration-75"
                        style={{
                            width: `${Math.min(signalLevel * 100, 100)}%`,
                            backgroundColor: colors.accent,
                            boxShadow: `0 0 8px ${colors.accent}`,
                        }}
                    />
                </div>
            )}

            {/* Handles with enhanced styling and direction arrows */}
            {Object.entries(handlesByPosition).map(([_position, posHandles]) =>
                posHandles.map((handle, index) => {
                    const handleColor = HANDLE_COLORS[handle.color || 'blue'] || handle.color || '#3b82f6';
                    const isInput = handle.type === 'target';
                    
                    // Determine arrow rotation based on position and type
                    const getArrowRotation = () => {
                        if (handle.position === 'top') return isInput ? 180 : 0;
                        if (handle.position === 'bottom') return isInput ? 0 : 180;
                        if (handle.position === 'left') return isInput ? 90 : -90;
                        if (handle.position === 'right') return isInput ? -90 : 90;
                        return 0;
                    };
                    
                    return (
                        (() => {
                            const compatibility = getHandleCompatibility(handle.id, handle.type);
                            const isCompatibleHandle = compatibility === 'compatible';
                            const isIncompatibleHandle = compatibility === 'incompatible';
                            
                            // Compute dynamic styles based on compatibility
                            // Compatible: grow slightly + glow (NO color change)
                            // Incompatible: dim + red border
                            const compatStyle: React.CSSProperties = isCompatibleHandle ? {
                                // Keep original color, just add size increase and white glow
                                boxShadow: `0 0 12px ${handleColor}, 0 0 24px rgba(255, 255, 255, 0.6)`,
                                transform: 'scale(1.3)',
                                zIndex: 100,
                            } : isIncompatibleHandle ? {
                                background: 'radial-gradient(circle at center, #374151 40%, transparent 70%)',
                                border: '2px solid #ef4444',
                                opacity: 0.5,
                            } : {};
                            
                            return (
                                <div key={handle.id} className="relative">
                                    <Handle
                                        id={handle.id}
                                        type={handle.type}
                                        position={POSITION_MAP[handle.position]}
                                        style={{
                                            ...getHandleStyle(handle, index, posHandles.length),
                                            width: 14,
                                            height: 14,
                                            background: `radial-gradient(circle at center, ${handleColor} 40%, transparent 70%)`,
                                            border: `2px solid ${handleColor}`,
                                            boxShadow: `0 0 8px ${handleColor}60`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 150ms ease',
                                            ...compatStyle,
                                        }}
                                        className={`!rounded-full hover:!scale-150 transition-all duration-150 ${
                                            isCompatibleHandle ? 'animate-pulse' : ''
                                        }`}
                                        title={handle.label || (isInput ? 'Input' : 'Output')}
                                    >
                                        {/* Direction arrow */}
                                        <svg
                                            width="8"
                                            height="8"
                                            viewBox="0 0 8 8"
                                            style={{
                                                transform: `rotate(${getArrowRotation()}deg)`,
                                                opacity: isIncompatibleHandle ? 0.3 : 0.9,
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            <path
                                                d="M4 1L7 5H1L4 1Z"
                                                fill="white"
                                                stroke="none"
                                            />
                                        </svg>
                                    </Handle>
                                    
                                    {/* Red X for incompatible handles */}
                                    {isIncompatibleHandle && (
                                        <div 
                                            className="absolute pointer-events-none"
                                            style={{
                                                width: 16,
                                                height: 16,
                                                top: handle.offset ? `${handle.offset}%` : '50%',
                                                left: handle.position === 'left' ? -8 : handle.position === 'right' ? 'calc(100% - 8px)' : '50%',
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: 101,
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <circle cx="8" cy="8" r="7" fill="#ef4444" opacity="0.9" />
                                                <path d="M5 5l6 6M11 5l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    );
                })
            )}

            {/* Handle labels */}
            {handles.filter(h => h.label).map(handle => {
                const isLeft = handle.position === 'left';
                const isRight = handle.position === 'right';
                
                if (!isLeft && !isRight) return null;
                
                return (
                    <div
                        key={`label-${handle.id}`}
                        className={`
                            absolute text-[8px] font-medium uppercase tracking-wider
                            pointer-events-none
                            ${isLeft ? 'left-4' : 'right-4'}
                        `}
                        style={{
                            top: `${handle.offset || 50}%`,
                            transform: 'translateY(-50%)',
                            color: 'rgba(255,255,255,0.3)',
                        }}
                    >
                        {handle.label}
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================================
// PRESET HANDLE CONFIGURATIONS
// ============================================================================

export const HANDLE_PRESETS = {
    // Standard audio flow: top input, bottom output
    audioThrough: [
        { id: 'in', type: 'target' as const, position: 'top' as const, color: 'blue' },
        { id: 'out', type: 'source' as const, position: 'bottom' as const, color: 'orange' },
    ],
    // Source only: just an output
    sourceOnly: [
        { id: 'out', type: 'source' as const, position: 'bottom' as const, color: 'cyan' },
    ],
    // Sink only: just an input
    sinkOnly: [
        { id: 'in', type: 'target' as const, position: 'top' as const, color: 'emerald' },
    ],
    // Envelope: gate trigger + control output
    envelope: [
        { id: 'gate', type: 'target' as const, position: 'left' as const, label: 'Gate', color: 'red', offset: 50 },
        { id: 'out', type: 'source' as const, position: 'right' as const, color: 'purple', offset: 50 },
    ],
    // Sequencer: dual outputs (gate on bottom, CV on right) - separate positions for easy selection
    sequencer: [
        { id: 'gate', type: 'source' as const, position: 'bottom' as const, label: 'Gate', color: 'red', offset: 50 },
        { id: 'cv', type: 'source' as const, position: 'right' as const, label: 'CV', color: 'orange', offset: 50 },
    ],
    // Physics: dual control outputs
    physics: [
        { id: 'position', type: 'source' as const, position: 'right' as const, label: 'Pos', color: 'cyan', offset: 35 },
        { id: 'velocity', type: 'source' as const, position: 'right' as const, label: 'Vel', color: 'blue', offset: 65 },
    ],
    // String synth: trigger input + audio output
    stringSynth: [
        { id: 'trigger', type: 'target' as const, position: 'left' as const, label: 'Trig', color: 'red', offset: 50 },
        { id: 'out', type: 'source' as const, position: 'right' as const, color: 'pink', offset: 50 },
    ],
    // Filter: audio through with modulation input
    filter: [
        { id: 'in', type: 'target' as const, position: 'left' as const, label: 'In', color: 'blue', offset: 35 },
        { id: 'mod', type: 'target' as const, position: 'left' as const, label: 'Mod', color: 'purple', offset: 65 },
        { id: 'out', type: 'source' as const, position: 'right' as const, color: 'blue', offset: 50 },
    ],
};
