import React from 'react';
import { Sparkles, Play, X, Layers, Headphones } from 'lucide-react';

// ============================================================================
// WELCOME MODAL
// First-time visitor greeting with quick start options
// ============================================================================

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartClassic: () => void;
    onStartGraph: () => void;
    onSkip: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
    isOpen,
    onClose,
    onStartClassic,
    onStartGraph,
    onSkip,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Animated background */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-lg">
                {/* Subtle animated gradient */}
                <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(0, 255, 136, 0.2) 0%, transparent 60%)',
                        animation: 'pulse 4s ease-in-out infinite',
                    }}
                />
            </div>
            
            {/* Modal */}
            <div className="relative w-full max-w-xl bg-gray-900/80 border border-gray-800 
                          rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white 
                             hover:bg-white/10 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>
                
                {/* Header with glow */}
                <div className="relative px-8 pt-10 pb-6 text-center">
                    {/* Icon with glow */}
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-6
                                  bg-gradient-to-br from-green-500/20 to-emerald-600/20 
                                  rounded-2xl border border-green-500/30 shadow-lg shadow-green-500/20">
                        <Sparkles className="w-10 h-10 text-green-400" />
                    </div>
                    
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome to Ambient Flow
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Create evolving soundscapes and generative audio
                    </p>
                </div>
                
                {/* Mode options */}
                <div className="px-8 pb-8 space-y-4">
                    {/* Classic Mode Card */}
                    <button
                        onClick={onStartClassic}
                        className="w-full p-5 bg-gray-800/50 hover:bg-gray-800/80 
                                 border border-gray-700 hover:border-cyan-500/50
                                 rounded-2xl text-left transition-all group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-12 h-12 rounded-xl bg-cyan-500/10 
                                          flex items-center justify-center
                                          group-hover:bg-cyan-500/20 transition-colors">
                                <Headphones className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Classic Mode
                                </h3>
                                <p className="text-sm text-gray-400">
                                    Simple controls for ambient soundscapes. Perfect for relaxation, 
                                    focus, or sleep. Just press play and tweak the knobs.
                                </p>
                            </div>
                        </div>
                    </button>
                    
                    {/* Graph Mode Card */}
                    <button
                        onClick={onStartGraph}
                        className="w-full p-5 bg-gray-800/50 hover:bg-gray-800/80 
                                 border border-gray-700 hover:border-purple-500/50
                                 rounded-2xl text-left transition-all group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-12 h-12 rounded-xl bg-purple-500/10 
                                          flex items-center justify-center
                                          group-hover:bg-purple-500/20 transition-colors">
                                <Layers className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Graph Mode
                                </h3>
                                <p className="text-sm text-gray-400">
                                    Build your own audio patches with a node-based editor. 
                                    Connect oscillators, effects, and modulators for endless possibilities.
                                </p>
                            </div>
                        </div>
                    </button>
                </div>
                
                {/* Footer */}
                <div className="px-8 py-4 border-t border-gray-800 bg-gray-900/50 
                              flex items-center justify-between">
                    <button
                        onClick={onSkip}
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        Skip intro
                    </button>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Play className="w-3 h-3" />
                        Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Space</kbd> to play/pause
                    </div>
                </div>
            </div>
            
            {/* Keyframe animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.05); }
                }
            `}</style>
        </div>
    );
};

export default WelcomeModal;
