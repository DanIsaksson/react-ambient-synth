import React from 'react';
import { Play, Square, Waves, GitBranch, ArrowLeft } from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';

interface UnifiedHeaderProps {
    viewMode: 'classic' | 'graph';
    onSwitchMode: () => void;
}

/**
 * Unified Header - Consistent design across Classic and Graph modes
 * Includes global audio controls and mode switching
 */
export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({ viewMode, onSwitchMode }) => {
    const { 
        isClassicPlaying, 
        isGraphPlaying, 
        toggleClassic, 
        toggleGraph 
    } = useAudioStore();

    const isClassicMode = viewMode === 'classic';

    return (
        <div 
            style={{
                height: 48,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 100%)',
                zIndex: 50,
                position: 'relative',
            }}
        >
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#22d3ee',
                    boxShadow: '0 0 12px rgba(34, 211, 238, 0.6)',
                    animation: 'pulse 2s infinite',
                }} />
                <span style={{
                    fontSize: 13,
                    fontWeight: 300,
                    letterSpacing: '0.25em',
                    color: 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase',
                }}>
                    Ambient Flow
                </span>
            </div>

            {/* Center: Audio Controls */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
            }}>
                {/* Classic Mode Toggle */}
                <button
                    onClick={toggleClassic}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderRadius: 20,
                        border: isClassicPlaying 
                            ? '1px solid #a855f7' 
                            : '1px solid rgba(168, 85, 247, 0.3)',
                        background: isClassicPlaying 
                            ? 'rgba(168, 85, 247, 0.2)' 
                            : 'rgba(168, 85, 247, 0.05)',
                        color: isClassicPlaying ? '#a855f7' : 'rgba(168, 85, 247, 0.5)',
                        cursor: 'pointer',
                        transition: '150ms',
                        boxShadow: isClassicPlaying 
                            ? '0 0 15px rgba(168, 85, 247, 0.3)' 
                            : 'none',
                    }}
                    title={isClassicPlaying ? 'Stop Classic' : 'Play Classic'}
                >
                    {isClassicPlaying ? <Square size={10} /> : <Play size={10} />}
                    <Waves size={12} />
                    Classic
                </button>

                {/* Graph Mode Toggle */}
                <button
                    onClick={toggleGraph}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderRadius: 20,
                        border: isGraphPlaying 
                            ? '1px solid #22d3ee' 
                            : '1px solid rgba(34, 211, 238, 0.3)',
                        background: isGraphPlaying 
                            ? 'rgba(34, 211, 238, 0.2)' 
                            : 'rgba(34, 211, 238, 0.05)',
                        color: isGraphPlaying ? '#22d3ee' : 'rgba(34, 211, 238, 0.5)',
                        cursor: 'pointer',
                        transition: '150ms',
                        boxShadow: isGraphPlaying 
                            ? '0 0 15px rgba(34, 211, 238, 0.3)' 
                            : 'none',
                    }}
                    title={isGraphPlaying ? 'Stop Graph' : 'Play Graph'}
                >
                    {isGraphPlaying ? <Square size={10} /> : <Play size={10} />}
                    <GitBranch size={12} />
                    Graph
                </button>
            </div>

            {/* Right: Mode Switch & Current Mode Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ 
                    fontSize: 10, 
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    {isClassicMode ? 'Classic Mode' : 'Graph Mode'}
                </span>
                
                <button
                    onClick={onSwitchMode}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        transition: '150ms',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    }}
                >
                    {isClassicMode ? (
                        <>
                            <GitBranch size={12} />
                            Graph Mode →
                        </>
                    ) : (
                        <>
                            <ArrowLeft size={12} />
                            Classic Mode
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
