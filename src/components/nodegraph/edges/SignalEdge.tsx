import React, { useMemo } from 'react';
import { type EdgeProps, getBezierPath } from '@xyflow/react';

// ============================================================================
// SIGNAL EDGE - Animated cable with flowing signal packets
// ============================================================================

export const SignalEdge: React.FC<EdgeProps> = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    data,
}) => {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    // Edge configuration from data or defaults
    const signalType = data?.signalType || 'audio'; // 'audio' | 'control' | 'gate'
    const isActive = data?.isActive ?? true;
    
    // Color scheme based on signal type
    const colors = useMemo(() => {
        switch (signalType) {
            case 'control':
                return { 
                    cable: '#6366f1', // Indigo
                    glow: 'rgba(99,102,241,0.4)',
                    packet: '#818cf8',
                };
            case 'gate':
                return { 
                    cable: '#ef4444', // Red
                    glow: 'rgba(239,68,68,0.4)',
                    packet: '#f87171',
                };
            default: // audio
                return { 
                    cable: '#06b6d4', // Cyan
                    glow: 'rgba(6,182,212,0.4)',
                    packet: '#22d3ee',
                };
        }
    }, [signalType]);

    // Animation speed based on signal type
    const packetDuration = signalType === 'audio' ? '0.8s' : signalType === 'control' ? '2s' : '0.4s';
    const numPackets = signalType === 'audio' ? 3 : signalType === 'control' ? 1 : 2;

    // Generate unique IDs for gradients
    const gradientId = `signal-gradient-${id}`;
    const glowFilterId = `signal-glow-${id}`;

    return (
        <g className="react-flow__edge-signal">
            {/* Definitions for gradients and filters */}
            <defs>
                {/* Cable gradient */}
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={colors.cable} stopOpacity="0.3" />
                    <stop offset="50%" stopColor={colors.cable} stopOpacity="1" />
                    <stop offset="100%" stopColor={colors.cable} stopOpacity="0.3" />
                </linearGradient>

                {/* Glow filter */}
                <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Shadow/depth layer */}
            <path
                d={edgePath}
                fill="none"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={6}
                strokeLinecap="round"
            />

            {/* Base cable - dark core */}
            <path
                d={edgePath}
                fill="none"
                stroke="#1a1a2e"
                strokeWidth={4}
                strokeLinecap="round"
            />

            {/* Active cable with gradient */}
            <path
                d={edgePath}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={selected ? 3 : 2}
                strokeLinecap="round"
                className={`transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-70'}`}
                style={{
                    filter: selected ? `url(#${glowFilterId})` : 'none',
                }}
            />

            {/* Inner bright core */}
            <path
                d={edgePath}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
                strokeLinecap="round"
            />

            {/* Animated signal packets */}
            {isActive && Array.from({ length: numPackets }).map((_, i) => {
                const delay = `${(i / numPackets) * parseFloat(packetDuration)}s`;
                
                return (
                    <g key={i}>
                        {/* Packet glow */}
                        <circle 
                            r={selected ? 8 : 6} 
                            fill={colors.packet}
                            opacity={0.3}
                            className="transition-all duration-300"
                        >
                            <animateMotion 
                                dur={packetDuration} 
                                repeatCount="indefinite" 
                                path={edgePath}
                                begin={delay}
                            />
                        </circle>

                        {/* Packet core */}
                        <circle 
                            r={selected ? 4 : 3} 
                            fill={colors.packet}
                            className="transition-all duration-300"
                            style={{
                                filter: `drop-shadow(0 0 4px ${colors.glow})`,
                            }}
                        >
                            <animateMotion 
                                dur={packetDuration} 
                                repeatCount="indefinite" 
                                path={edgePath}
                                begin={delay}
                            />
                        </circle>

                        {/* Packet bright center */}
                        <circle 
                            r={1.5} 
                            fill="white"
                            opacity={0.8}
                        >
                            <animateMotion 
                                dur={packetDuration} 
                                repeatCount="indefinite" 
                                path={edgePath}
                                begin={delay}
                            />
                        </circle>
                    </g>
                );
            })}

            {/* Selection highlight ring at connection points */}
            {selected && (
                <>
                    <circle 
                        cx={sourceX} 
                        cy={sourceY} 
                        r={6} 
                        fill="none" 
                        stroke={colors.cable}
                        strokeWidth={2}
                        opacity={0.6}
                        className="animate-ping"
                    />
                    <circle 
                        cx={targetX} 
                        cy={targetY} 
                        r={6} 
                        fill="none" 
                        stroke={colors.cable}
                        strokeWidth={2}
                        opacity={0.6}
                        className="animate-ping"
                    />
                </>
            )}
        </g>
    );
};
