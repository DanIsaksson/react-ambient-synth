import React from 'react';
import { type EdgeProps, getBezierPath } from '@xyflow/react';

// ============================================================================
// MODULATION EDGE - Dashed purple line for control signal connections
// ============================================================================

export interface ModulationEdgeData {
    isModulation?: boolean;
    amount?: number;
    bipolar?: boolean;
    onAmountClick?: (edgeId: string) => void;
}

export const ModulationEdge: React.FC<EdgeProps> = ({
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

    // Cast data to our expected type
    const edgeData = data as ModulationEdgeData | undefined;
    const amount = edgeData?.amount ?? 0.5;
    const glowFilterId = `mod-glow-${id}`;

    // Calculate midpoint for amount badge
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    return (
        <g className="react-flow__edge-modulation">
            {/* Definitions for glow filter */}
            <defs>
                <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Shadow layer */}
            <path
                d={edgePath}
                fill="none"
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="8 4"
            />

            {/* Main modulation path - purple dashed line */}
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                fill="none"
                stroke={selected ? '#a855f7' : 'rgba(139, 92, 246, 0.7)'}
                strokeWidth={selected ? 2.5 : 2}
                strokeLinecap="round"
                strokeDasharray="8 4"
                style={{
                    filter: selected ? `url(#${glowFilterId})` : undefined,
                    transition: 'stroke 0.2s, stroke-width 0.2s',
                }}
            />

            {/* Animated flow particle */}
            <circle 
                r={3} 
                fill="#a855f7"
                style={{
                    filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.8))',
                }}
            >
                <animateMotion 
                    dur="1.5s" 
                    repeatCount="indefinite" 
                    path={edgePath}
                />
            </circle>

            {/* Amount indicator badge */}
            <foreignObject
                x={midX - 18}
                y={midY - 12}
                width={36}
                height={24}
                className="pointer-events-auto"
                style={{ overflow: 'visible' }}
            >
                <div 
                    className="bg-purple-900/90 text-purple-300 text-[9px] font-mono px-1.5 py-0.5 rounded-full text-center cursor-pointer hover:bg-purple-800 transition-colors border border-purple-500/30"
                    onClick={(e) => {
                        e.stopPropagation();
                        edgeData?.onAmountClick?.(id);
                    }}
                    title={`Modulation: ${Math.round(amount * 100)}%\nClick to edit`}
                    style={{
                        boxShadow: '0 0 8px rgba(168, 85, 247, 0.3)',
                    }}
                >
                    {Math.round(amount * 100)}%
                </div>
            </foreignObject>

            {/* Selection indicators at endpoints */}
            {selected && (
                <>
                    <circle 
                        cx={sourceX} 
                        cy={sourceY} 
                        r={5} 
                        fill="none" 
                        stroke="#a855f7"
                        strokeWidth={2}
                        opacity={0.8}
                    >
                        <animate
                            attributeName="r"
                            values="4;7;4"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="opacity"
                            values="0.8;0.3;0.8"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle 
                        cx={targetX} 
                        cy={targetY} 
                        r={5} 
                        fill="none" 
                        stroke="#a855f7"
                        strokeWidth={2}
                        opacity={0.8}
                    >
                        <animate
                            attributeName="r"
                            values="4;7;4"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="opacity"
                            values="0.8;0.3;0.8"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </>
            )}
        </g>
    );
};
