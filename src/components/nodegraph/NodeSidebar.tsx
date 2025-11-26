import React, { useState } from 'react';

// ============================================================================
// MODULE DEFINITIONS - Categorized by function
// ============================================================================

type NodeCategory = 'source' | 'effect' | 'control' | 'output';
type SignalIO = 'audio-out' | 'audio-in' | 'audio-thru' | 'mod-out' | 'gate-out' | 'trigger-in';

interface ModuleDef {
    type: string;
    label: string;
    fullName: string;         // Full descriptive name
    iconPath: string;         // SVG path data
    rgb: string;              // RGB for glow effects
    category: NodeCategory;
    signals: SignalIO[];      // What signals this node produces/consumes
    implemented: boolean;     // Whether audio processing is implemented
}

// Signal type colors (matching handleTypes.ts)
const SIGNAL_COLORS: Record<SignalIO, string> = {
    'audio-out': '#06b6d4',   // Cyan - audio output
    'audio-in': '#3b82f6',    // Blue - audio input
    'audio-thru': '#06b6d4',  // Cyan - audio passthrough
    'mod-out': '#a855f7',     // Purple - modulation output
    'gate-out': '#ef4444',    // Red - gate/trigger output
    'trigger-in': '#f97316',  // Orange - trigger input
};

// ============================================================================
// CATEGORIZED MODULE LISTS
// ============================================================================

const SOURCES: ModuleDef[] = [
    { type: 'oscillator', label: 'OSC', fullName: 'Oscillator', rgb: '6,182,212', iconPath: 'M2 12c2-4 4-8 6 0s4 4 6 0 4-8 6 0', category: 'source', signals: ['audio-out'], implemented: true },
    { type: 'karplus', label: 'STR', fullName: 'Karplus-String', rgb: '236,72,153', iconPath: 'M12 4v16M8 6v12M16 6v12M5 9v6M19 9v6', category: 'source', signals: ['trigger-in', 'audio-out'], implemented: true },
    { type: 'resonator', label: 'RES', fullName: 'Resonator', rgb: '167,139,250', iconPath: 'M12 3v18M6 6v12M18 6v12M3 9v6M21 9v6', category: 'source', signals: ['audio-in', 'audio-out'], implemented: true },
    { type: 'noise', label: 'NSE', fullName: 'Noise', rgb: '16,185,129', iconPath: 'M2 12c0.5-1 1-2 1.5-1s1 2 1.5 0 1-3 1.5-1 1 2 1.5 0 1-2 1.5-1 1 3 1.5 0 1-2 1.5-1 1 2 1.5 0 1-2 1.5-1', category: 'source', signals: ['audio-out', 'mod-out'], implemented: true },
    { type: 'sample', label: 'SMP', fullName: 'Sample Player', rgb: '6,182,212', iconPath: 'M4 4h16v16H4zM8 16V8l8 4z', category: 'source', signals: ['trigger-in', 'audio-out'], implemented: true },
    { type: 'texture', label: 'TXT', fullName: 'Texture (Granular)', rgb: '34,211,238', iconPath: 'M12 3c-4 0-8 3-8 8s4 8 8 8 8-4 8-8-4-8-8-8zM8 10a1 1 0 100 2 1 1 0 000-2zM16 12a1 1 0 100 2 1 1 0 000-2zM12 14a1 1 0 100 2 1 1 0 000-2z', category: 'source', signals: ['audio-out'], implemented: true },
];

const EFFECTS: ModuleDef[] = [
    { type: 'filter', label: 'FLT', fullName: 'Filter', rgb: '168,85,247', iconPath: 'M3 12h4l2-6 4 12 2-6h6', category: 'effect', signals: ['audio-in', 'audio-out'], implemented: true },
    { type: 'spatial', label: '3D', fullName: 'Spatial 3D', rgb: '56,189,248', iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', category: 'effect', signals: ['audio-thru'], implemented: true },
];

const CONTROL: ModuleDef[] = [
    { type: 'lfo', label: 'LFO', fullName: 'LFO', rgb: '139,92,246', iconPath: 'M2 12c1.5-3 3-6 4.5 0s3 3 4.5 0 3-6 4.5 0 3 3 4.5 0', category: 'control', signals: ['mod-out'], implemented: true },
    { type: 'envelope', label: 'ENV', fullName: 'Envelope', rgb: '245,158,11', iconPath: 'M3 18l4-10 3 4 4-8 4 14', category: 'control', signals: ['mod-out'], implemented: true },
    { type: 'sequencer', label: 'SEQ', fullName: 'Sequencer', rgb: '249,115,22', iconPath: 'M4 16v4M8 12v8M12 8v12M16 14v6M20 10v10', category: 'control', signals: ['gate-out'], implemented: true },
    { type: 'euclidean', label: 'EUC', fullName: 'Euclidean', rgb: '251,146,60', iconPath: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2', category: 'control', signals: ['gate-out'], implemented: true },
    { type: 'physics', label: 'PHY', fullName: 'Physics', rgb: '20,184,166', iconPath: 'M12 4a4 4 0 100 8 4 4 0 000-8zM12 14v6', category: 'control', signals: ['mod-out'], implemented: true },
];

const OUTPUTS: ModuleDef[] = [
    { type: 'output', label: 'OUT', fullName: 'Output', rgb: '16,185,129', iconPath: 'M6 10v4M10 8v8M14 6v12M18 9v6', category: 'output', signals: ['audio-in'], implemented: true },
];

// ============================================================================
// MODULE TILE - Compact draggable button
// ============================================================================

const ModuleTile: React.FC<{ mod: ModuleDef }> = ({ mod }) => {
    const [hover, setHover] = useState(false);
    const [dragging, setDragging] = useState(false);

    // Get primary signal colors for indicator dots
    const getSignalDots = () => {
        return mod.signals.map(sig => SIGNAL_COLORS[sig]);
    };
    const signalDots = getSignalDots();

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
                width: 56,
                height: 60,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                cursor: 'grab',
                userSelect: 'none',
                transition: 'all 150ms ease',
                transform: hover ? 'scale(1.1)' : dragging ? 'scale(0.95)' : 'scale(1)',
                opacity: mod.implemented ? (dragging ? 0.5 : 1) : 0.5,
                background: hover 
                    ? `radial-gradient(circle, rgba(${mod.rgb},0.2) 0%, transparent 70%)` 
                    : 'rgba(255,255,255,0.03)',
                border: `1px solid rgba(${mod.rgb}, ${hover ? 0.6 : 0.2})`,
                boxShadow: hover ? `0 0 20px rgba(${mod.rgb},0.4)` : 'none',
                position: 'relative',
            }}
            title={`${mod.fullName}${!mod.implemented ? ' (Coming Soon)' : ''}`}
        >
            
            {/* Icon */}
            <svg 
                width="18" 
                height="18" 
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
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: hover ? `rgb(${mod.rgb})` : '#666',
            }}>
                {mod.label}
            </span>
            
            {/* Signal type indicator dots */}
            <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
                {signalDots.slice(0, 3).map((color, i) => (
                    <div
                        key={i}
                        style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            backgroundColor: color,
                            boxShadow: hover ? `0 0 4px ${color}` : 'none',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

// Category separator component with horizontal bracket
const CategorySeparator: React.FC<{ label: string }> = ({ label }) => (
    <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6,
        padding: '0 4px',
        height: 60,
    }}>
        {/* Left bracket */}
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'center',
        }}>
            <div style={{ 
                width: 12, 
                height: 1, 
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 1,
            }} />
        </div>
        {/* Label */}
        <span style={{ 
            fontSize: 8, 
            color: '#666', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontWeight: 600,
            writingMode: 'horizontal-tb',
        }}>
            {label}
        </span>
        {/* Right bracket */}
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'center',
        }}>
            <div style={{ 
                width: 12, 
                height: 1, 
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 1,
            }} />
        </div>
    </div>
);

// ============================================================================
// MODULE DOCK - Fixed bottom toolbar with categories
// ============================================================================

export const ModuleDock: React.FC = () => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
            {/* Sources */}
            <CategorySeparator label="SRC" />
            {SOURCES.map(mod => (
                <ModuleTile key={mod.type} mod={mod} />
            ))}
            
            <CategorySeparator label="FX" />
            
            {/* Effects */}
            {EFFECTS.map(mod => (
                <ModuleTile key={mod.type} mod={mod} />
            ))}
            
            <CategorySeparator label="MOD" />
            
            {/* Control / Modulation */}
            {CONTROL.map(mod => (
                <ModuleTile key={mod.type} mod={mod} />
            ))}
            
            <CategorySeparator label="OUT" />
            
            {/* Output */}
            {OUTPUTS.map(mod => (
                <ModuleTile key={mod.type} mod={mod} />
            ))}
            
            {/* Spacer */}
            <div style={{ width: 8 }} />
            
            {/* Hint */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                gap: 2, 
                color: '#444', 
                fontSize: 9,
                padding: '0 8px',
            }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                <span>Drag</span>
            </div>
        </div>
    );
};

export const NodeToolbar = ModuleDock;
export const NodeSidebar = ModuleDock;
