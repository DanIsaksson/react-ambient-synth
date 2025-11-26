/**
 * SmartHandle - Handle component with visual compatibility feedback.
 * 
 * When a connection drag is in progress, this component shows:
 * - Green glow + pulse: Compatible connection
 * - Red X overlay: Incompatible connection
 * - Normal state: No active drag
 * 
 * @module components/nodegraph/shared/SmartHandle
 */

import React, { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useConnectionStateStore } from '../../../store/connectionStateStore';
import { getHandleSignalType, isSignalCompatible } from '../handleTypes';
import type { SignalType } from '../handleTypes';

// ===========================================
// TYPES
// ===========================================

interface SmartHandleProps {
    /** Unique ID for this handle within the node */
    id: string;
    /** Whether this is a source (output) or target (input) handle */
    type: 'source' | 'target';
    /** Position on the node */
    position: Position;
    /** The node type this handle belongs to */
    nodeType: string;
    /** The node ID this handle belongs to */
    nodeId: string;
    /** Signal type (if known) - auto-detected if not provided */
    signalType?: SignalType;
    /** Tailwind color name for styling */
    color?: string;
    /** Additional CSS classes */
    className?: string;
    /** Style overrides */
    style?: React.CSSProperties;
    /** Label to show near the handle */
    label?: string;
}

// ===========================================
// COLOR MAPPINGS
// ===========================================

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
    gray: '#6b7280',
};

// ===========================================
// COMPONENT
// ===========================================

export const SmartHandle: React.FC<SmartHandleProps> = ({
    id,
    type,
    position,
    nodeType,
    nodeId: _nodeId,
    signalType: explicitSignalType,
    color = 'cyan',
    className = '',
    style = {},
    label,
}) => {
    // Get connection drag state
    const { isConnecting, sourceNodeType, sourceHandleId, sourceHandleType } = useConnectionStateStore();
    
    // Determine this handle's signal type
    const signalType = useMemo(() => {
        if (explicitSignalType) return explicitSignalType;
        return getHandleSignalType(nodeType, id);
    }, [explicitSignalType, nodeType, id]);
    
    // Calculate compatibility when dragging
    const compatibility = useMemo(() => {
        // Not dragging - neutral state
        if (!isConnecting || !sourceNodeType || !sourceHandleId) {
            return 'neutral';
        }
        
        // Can't connect source to source or target to target
        if (sourceHandleType === type) {
            return 'neutral'; // Same type handles - not a valid target
        }
        
        // Get source signal type
        const sourceSignal = getHandleSignalType(sourceNodeType, sourceHandleId);
        if (!sourceSignal || !signalType) {
            return 'neutral';
        }
        
        // Check compatibility based on drag direction
        // If dragging from source, this target should accept source's signal
        // If dragging from target (reverse), this source should produce target's expected signal
        let isCompatible: boolean;
        if (sourceHandleType === 'source') {
            // Dragging from source → checking if this target can accept
            isCompatible = type === 'target' && isSignalCompatible(sourceSignal, signalType);
        } else {
            // Dragging from target → checking if this source can provide
            isCompatible = type === 'source' && isSignalCompatible(signalType, sourceSignal);
        }
        
        // If this is the same type as source (both sources or both targets), it's not a valid target
        if (type === sourceHandleType) {
            return 'neutral';
        }
        
        return isCompatible ? 'compatible' : 'incompatible';
    }, [isConnecting, sourceNodeType, sourceHandleId, sourceHandleType, type, signalType]);
    
    // Compute dynamic styles based on compatibility
    const handleColor = HANDLE_COLORS[color] || HANDLE_COLORS.cyan;
    
    const dynamicStyle: React.CSSProperties = useMemo(() => {
        const base: React.CSSProperties = {
            backgroundColor: handleColor,
            borderColor: handleColor,
            ...style,
        };
        
        if (compatibility === 'compatible') {
            return {
                ...base,
                backgroundColor: '#22c55e', // Green
                borderColor: '#22c55e',
                boxShadow: `0 0 12px rgba(34, 197, 94, 0.8), 0 0 24px rgba(34, 197, 94, 0.4)`,
                transform: style.transform ? `${style.transform} scale(1.3)` : 'scale(1.3)',
                zIndex: 100,
            };
        }
        
        if (compatibility === 'incompatible') {
            return {
                ...base,
                backgroundColor: '#374151', // Gray
                borderColor: '#ef4444', // Red border
                opacity: 0.6,
            };
        }
        
        return base;
    }, [compatibility, handleColor, style]);
    
    // Compute dynamic classes
    const dynamicClasses = useMemo(() => {
        const classes = [
            '!w-3 !h-3',
            '!border-2',
            'transition-all duration-150',
            className,
        ];
        
        if (compatibility === 'compatible') {
            classes.push('animate-pulse');
        }
        
        return classes.join(' ');
    }, [compatibility, className]);
    
    return (
        <div className="relative">
            <Handle
                id={id}
                type={type}
                position={position}
                className={dynamicClasses}
                style={dynamicStyle}
            />
            
            {/* Incompatible indicator - red X */}
            {compatibility === 'incompatible' && (
                <div 
                    className="absolute pointer-events-none flex items-center justify-center"
                    style={{
                        width: 16,
                        height: 16,
                        top: '50%',
                        left: position === Position.Left ? -8 : position === Position.Right ? 'calc(100% - 8px)' : '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 101,
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" fill="#ef4444" opacity="0.9" />
                        <path d="M4 4l4 4M8 4l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
            )}
            
            {/* Label (optional) */}
            {label && (
                <span 
                    className="absolute text-[8px] text-gray-400 font-mono whitespace-nowrap pointer-events-none"
                    style={{
                        [position === Position.Left ? 'right' : 'left']: '100%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        marginLeft: position === Position.Left ? 0 : 6,
                        marginRight: position === Position.Right ? 0 : 6,
                    }}
                >
                    {label}
                </span>
            )}
        </div>
    );
};

export default SmartHandle;
