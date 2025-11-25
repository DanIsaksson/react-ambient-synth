import React, { useRef } from 'react';
import { Handle, Position } from '@xyflow/react';

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
    // Future: signalLevel for metering (Phase 6)
    signalLevel?: number;
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
    signalLevel = 0,
}) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const colors = TYPE_COLORS[type] || TYPE_COLORS.source;

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

            {/* Header */}
            <div className={`px-3 py-2 flex items-center gap-2 border-b border-white/5`}>
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
                    className="text-[10px] font-semibold tracking-wider uppercase truncate"
                    style={{ color: selected ? colors.accent : 'rgba(255,255,255,0.6)' }}
                >
                    {title}
                </span>
                
                {/* Icon (if provided, right-aligned) */}
                {icon && (
                    <span className="ml-auto text-xs opacity-40">{icon}</span>
                )}
            </div>

            {/* Content */}
            <div className={`${compact ? 'p-2' : 'p-3'}`}>
                {children}
            </div>

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

            {/* Handles with enhanced styling */}
            {Object.entries(handlesByPosition).map(([_position, posHandles]) =>
                posHandles.map((handle, index) => {
                    const handleColor = HANDLE_COLORS[handle.color || 'blue'] || handle.color || '#3b82f6';
                    return (
                        <Handle
                            key={handle.id}
                            id={handle.id}
                            type={handle.type}
                            position={POSITION_MAP[handle.position]}
                            style={{
                                ...getHandleStyle(handle, index, posHandles.length),
                                width: 10,
                                height: 10,
                                background: `radial-gradient(circle at center, ${handleColor} 40%, transparent 70%)`,
                                border: `2px solid ${handleColor}`,
                                boxShadow: `0 0 8px ${handleColor}60`,
                            }}
                            className="!rounded-full hover:!scale-150 transition-transform duration-150"
                            title={handle.label}
                        />
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
    // Sequencer: dual outputs (gate + CV)
    sequencer: [
        { id: 'gate', type: 'source' as const, position: 'right' as const, label: 'Gate', color: 'red', offset: 35 },
        { id: 'cv', type: 'source' as const, position: 'right' as const, label: 'CV', color: 'orange', offset: 65 },
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
