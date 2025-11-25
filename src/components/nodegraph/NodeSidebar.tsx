import React, { useState } from 'react';

// ============================================================================
// MODULE DEFINITIONS
// ============================================================================

interface ModuleDef {
    type: string;
    label: string;
    iconPath: string;  // SVG path data
    rgb: string;       // RGB for glow effects
}

const MODULES: ModuleDef[] = [
    { type: 'oscillator', label: 'OSC', rgb: '6,182,212', iconPath: 'M2 12c2-4 4-8 6 0s4 4 6 0 4-8 6 0' },
    { type: 'karplus', label: 'STR', rgb: '236,72,153', iconPath: 'M12 4v16M8 6v12M16 6v12M5 9v6M19 9v6' },
    { type: 'filter', label: 'FLT', rgb: '168,85,247', iconPath: 'M3 12h4l2-6 4 12 2-6h6' },
    { type: 'envelope', label: 'ENV', rgb: '245,158,11', iconPath: 'M3 18l4-10 3 4 4-8 4 14' },
    { type: 'sequencer', label: 'SEQ', rgb: '249,115,22', iconPath: 'M4 16v4M8 12v8M12 8v12M16 14v6M20 10v10' },
    { type: 'physics', label: 'PHY', rgb: '20,184,166', iconPath: 'M12 4a4 4 0 100 8 4 4 0 000-8zM12 14v6' },
    { type: 'output', label: 'OUT', rgb: '16,185,129', iconPath: 'M6 10v4M10 8v8M14 6v12M18 9v6' },
];

// ============================================================================
// MODULE TILE - Compact draggable button
// ============================================================================

const ModuleTile: React.FC<{ mod: ModuleDef }> = ({ mod }) => {
    const [hover, setHover] = useState(false);
    const [dragging, setDragging] = useState(false);

    return (
        <div
            draggable
            onDragStart={(e) => {
                setDragging(true);
                e.dataTransfer.setData('application/reactflow', mod.type);
                e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setDragging(false)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'grab',
                userSelect: 'none',
                transition: 'all 150ms ease',
                transform: hover ? 'scale(1.1)' : dragging ? 'scale(0.95)' : 'scale(1)',
                opacity: dragging ? 0.5 : 1,
                background: hover 
                    ? `radial-gradient(circle, rgba(${mod.rgb},0.2) 0%, transparent 70%)` 
                    : 'rgba(255,255,255,0.03)',
                border: `1px solid rgba(${mod.rgb}, ${hover ? 0.6 : 0.2})`,
                boxShadow: hover ? `0 0 20px rgba(${mod.rgb},0.4)` : 'none',
            }}
            title={mod.type}
        >
            {/* Icon */}
            <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={hover ? `rgb(${mod.rgb})` : '#888'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d={mod.iconPath} />
            </svg>
            
            {/* Label */}
            <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: hover ? `rgb(${mod.rgb})` : '#666',
            }}>
                {mod.label}
            </span>
        </div>
    );
};

// ============================================================================
// MODULE DOCK - Fixed bottom toolbar
// ============================================================================

export const ModuleDock: React.FC = () => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
            {MODULES.map(mod => (
                <ModuleTile key={mod.type} mod={mod} />
            ))}
            
            {/* Separator */}
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)', margin: '0 12px' }} />
            
            {/* Hint */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#555', fontSize: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                <span>Drag to canvas</span>
            </div>
        </div>
    );
};

export const NodeToolbar = ModuleDock;
export const NodeSidebar = ModuleDock;
