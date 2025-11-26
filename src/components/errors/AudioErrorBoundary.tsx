import { useState, useCallback, type ReactNode } from 'react';
import { Volume2, VolumeX, RefreshCw, AlertCircle } from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';

// ============================================================================
// AUDIO ERROR BOUNDARY
// Handles audio-specific errors with recovery options
// ============================================================================

interface AudioErrorState {
    hasError: boolean;
    errorType: 'context' | 'worklet' | 'device' | 'unknown';
    message: string;
}

interface AudioErrorBoundaryProps {
    children: ReactNode;
}

/**
 * Audio-specific error handling wrapper
 * Provides recovery options for common audio issues
 */
export const AudioErrorBoundary: React.FC<AudioErrorBoundaryProps> = ({ children }) => {
    const [error, setError] = useState<AudioErrorState | null>(null);
    const { init: initAudio, getCore } = useAudioStore();

    // Attempt to recover the audio context
    const handleRecoverContext = useCallback(async () => {
        try {
            const core = getCore();
            const ctx = core.getContext();
            
            if (ctx && ctx.state === 'suspended') {
                await ctx.resume();
                console.log('[AudioErrorBoundary] Context resumed successfully');
                setError(null);
                return;
            }
            
            // Full reinit if context is closed
            await initAudio();
            console.log('[AudioErrorBoundary] Audio reinitialized');
            setError(null);
        } catch (e) {
            console.error('[AudioErrorBoundary] Recovery failed:', e);
            setError({
                hasError: true,
                errorType: 'context',
                message: 'Failed to recover audio. Please refresh the page.',
            });
        }
    }, [initAudio, getCore]);

    // Handle device change (e.g., headphones unplugged)
    const handleDeviceChange = useCallback(async () => {
        try {
            // Re-enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
            
            if (audioOutputs.length === 0) {
                setError({
                    hasError: true,
                    errorType: 'device',
                    message: 'No audio output device found. Please connect speakers or headphones.',
                });
            } else {
                // Device available, try to recover
                await handleRecoverContext();
            }
        } catch (e) {
            console.error('[AudioErrorBoundary] Device check failed:', e);
        }
    }, [handleRecoverContext]);

    // Listen for device changes
    useState(() => {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
            return () => {
                navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            };
        }
    });

    // Render error UI if there's an audio error
    if (error?.hasError) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
                <div className="max-w-md w-full bg-gray-900 border border-gray-800 
                              rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-6 bg-amber-500/10 border-b border-amber-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-amber-500/20 
                                          flex items-center justify-center">
                                <VolumeX className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    Audio Issue Detected
                                </h2>
                                <p className="text-sm text-amber-300/80">
                                    {getErrorTitle(error.errorType)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Error message */}
                    <div className="p-6">
                        <div className="flex items-start gap-3 p-4 bg-black/30 rounded-lg mb-6">
                            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-300">
                                {error.message}
                            </p>
                        </div>

                        {/* Recovery options */}
                        <div className="space-y-2">
                            <button
                                onClick={handleRecoverContext}
                                className="w-full flex items-center justify-center gap-2 
                                         px-4 py-3 text-sm font-medium
                                         bg-green-500/20 hover:bg-green-500/30 text-green-400
                                         rounded-xl transition-colors"
                            >
                                <RefreshCw size={16} />
                                Restart Audio Engine
                            </button>
                            
                            {error.errorType === 'context' && (
                                <button
                                    onClick={() => window.location.reload()}
                                    className="w-full flex items-center justify-center gap-2 
                                             px-4 py-3 text-sm font-medium
                                             bg-gray-800 hover:bg-gray-700 text-white
                                             rounded-xl transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    Reload Page
                                </button>
                            )}
                            
                            <button
                                onClick={() => setError(null)}
                                className="w-full flex items-center justify-center gap-2 
                                         px-4 py-3 text-sm font-medium
                                         bg-gray-800/50 hover:bg-gray-800 text-gray-400
                                         rounded-xl transition-colors"
                            >
                                <Volume2 size={16} />
                                Continue Without Audio
                            </button>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-800">
                        <p className="text-xs text-gray-500">
                            <strong className="text-gray-400">Tip:</strong> If the issue persists, 
                            try checking your system audio settings or using a different browser.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

// Helper function for error titles
function getErrorTitle(type: AudioErrorState['errorType']): string {
    switch (type) {
        case 'context':
            return 'Audio context interrupted';
        case 'worklet':
            return 'Audio processor error';
        case 'device':
            return 'Audio device disconnected';
        default:
            return 'Unknown audio error';
    }
}

export default AudioErrorBoundary;
