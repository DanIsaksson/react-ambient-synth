import React from 'react';
import { Play, Square, Waves, GitBranch } from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';

/**
 * Global Audio Controls - Always visible toggle buttons for Classic & Graph modes
 * Can be placed anywhere in the app to allow independent control of each audio engine
 */
export const GlobalAudioControls: React.FC = () => {
    const { 
        isClassicPlaying, 
        isGraphPlaying, 
        toggleClassic, 
        toggleGraph 
    } = useAudioStore();

    return (
        <div 
            className="flex items-center gap-2 px-2 py-1 rounded-xl"
            style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
        >
            {/* Classic Mode Toggle */}
            <button
                onClick={toggleClassic}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                    background: isClassicPlaying 
                        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0.1) 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: isClassicPlaying 
                        ? '1px solid rgba(168, 85, 247, 0.5)' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: isClassicPlaying 
                        ? '0 0 20px rgba(168, 85, 247, 0.3)' 
                        : 'none',
                }}
                title={isClassicPlaying ? 'Stop Classic Mode' : 'Play Classic Mode'}
            >
                <Waves 
                    size={14} 
                    style={{ 
                        color: isClassicPlaying ? '#a855f7' : 'rgba(255, 255, 255, 0.5)',
                    }} 
                />
                <span 
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ 
                        color: isClassicPlaying ? '#a855f7' : 'rgba(255, 255, 255, 0.5)',
                    }}
                >
                    Classic
                </span>
                {isClassicPlaying ? (
                    <Square size={10} style={{ color: '#a855f7' }} />
                ) : (
                    <Play size={10} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                )}
            </button>

            {/* Divider */}
            <div 
                className="w-px h-6"
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
            />

            {/* Graph Mode Toggle */}
            <button
                onClick={toggleGraph}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                    background: isGraphPlaying 
                        ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0.1) 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: isGraphPlaying 
                        ? '1px solid rgba(6, 182, 212, 0.5)' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: isGraphPlaying 
                        ? '0 0 20px rgba(6, 182, 212, 0.3)' 
                        : 'none',
                }}
                title={isGraphPlaying ? 'Stop Graph Mode' : 'Play Graph Mode'}
            >
                <GitBranch 
                    size={14} 
                    style={{ 
                        color: isGraphPlaying ? '#06b6d4' : 'rgba(255, 255, 255, 0.5)',
                    }} 
                />
                <span 
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ 
                        color: isGraphPlaying ? '#06b6d4' : 'rgba(255, 255, 255, 0.5)',
                    }}
                >
                    Graph
                </span>
                {isGraphPlaying ? (
                    <Square size={10} style={{ color: '#06b6d4' }} />
                ) : (
                    <Play size={10} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                )}
            </button>
        </div>
    );
};
