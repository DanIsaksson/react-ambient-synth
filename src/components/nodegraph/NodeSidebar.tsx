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
    { type: 'texture', label: 'TXT', rgb: '34,211,238', iconPath: 'M12 3c-4 0-8 3-8 8s4 8 8 8 8-4 8-8-4-8-8-8zM8 10a1 1 0 100 2 1 1 0 000-2zM16 12a1 1 0 100 2 1 1 0 000-2zM12 14a1 1 0 100 2 1 1 0 000-2z' },
    { type: 'resonator', label: 'RES', rgb: '167,139,250', iconPath: 'M12 3v18M6 6v12M18 6v12M3 9v6M21 9v6' },
    { type: 'filter', label: 'FLT', rgb: '168,85,247', iconPath: 'M3 12h4l2-6 4 12 2-6h6' },
    { type: 'envelope', label: 'ENV', rgb: '245,158,11', iconPath: 'M3 18l4-10 3 4 4-8 4 14' },
    { type: 'lfo', label: 'LFO', rgb: '139,92,246', iconPath: 'M2 12c1.5-3 3-6 4.5 0s3 3 4.5 0 3-6 4.5 0 3 3 4.5 0' },
    { type: 'noise', label: 'NSE', rgb: '16,185,129', iconPath: 'M2 12c0.5-1 1-2 1.5-1s1 2 1.5 0 1-3 1.5-1 1 2 1.5 0 1-2 1.5-1 1 3 1.5 0 1-2 1.5-1 1 2 1.5 0 1-2 1.5-1' },
    { type: 'spatial', label: '3D', rgb: '56,189,248', iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
    { type: 'sequencer', label: 'SEQ', rgb: '249,115,22', iconPath: 'M4 16v4M8 12v8M12 8v12M16 14v6M20 10v10' },
    { type: 'euclidean', label: 'EUC', rgb: '251,146,60', iconPath: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2' },
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
