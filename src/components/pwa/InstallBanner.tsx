import React from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

// ============================================================================
// PWA INSTALL BANNER
// Shows when the app can be installed, with native app-like styling
// ============================================================================

export const InstallBanner: React.FC = () => {
    const { canInstall, isInstalled, install, dismiss } = useInstallPrompt();

    // Don't show if already installed or can't install
    if (isInstalled || !canInstall) {
        return null;
    }

    const handleInstall = async () => {
        const success = await install();
        if (success) {
            console.log('[InstallBanner] App installed successfully');
        }
    };

    return (
        <div 
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50
                       bg-gradient-to-br from-gray-900/95 to-gray-800/95 
                       backdrop-blur-xl border border-green-500/30 
                       rounded-2xl shadow-2xl shadow-green-500/10
                       p-4 animate-in slide-in-from-bottom duration-500"
        >
            {/* Glow effect */}
            <div 
                className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at top, rgba(0, 255, 136, 0.15) 0%, transparent 60%)',
                }}
            />

            <div className="relative flex items-start gap-3">
                {/* Icon */}
                <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 
                              flex items-center justify-center shadow-lg shadow-green-500/30">
                    <Smartphone className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                        Install Ambient Flow
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                        Add to your home screen for offline access and a native app experience.
                    </p>
                </div>

                {/* Dismiss button */}
                <button
                    onClick={dismiss}
                    className="shrink-0 p-1 text-gray-500 hover:text-gray-300 
                             hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Dismiss install prompt"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Actions */}
            <div className="relative flex gap-2 mt-3">
                <button
                    onClick={dismiss}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-400 
                             bg-white/5 hover:bg-white/10 
                             rounded-lg transition-colors"
                >
                    Not now
                </button>
                <button
                    onClick={handleInstall}
                    className="flex-1 px-3 py-2 text-xs font-semibold text-black
                             bg-gradient-to-r from-green-400 to-emerald-500 
                             hover:from-green-300 hover:to-emerald-400
                             rounded-lg transition-all
                             flex items-center justify-center gap-1.5
                             shadow-lg shadow-green-500/30"
                >
                    <Download className="w-3.5 h-3.5" />
                    Install
                </button>
            </div>
        </div>
    );
};

// ============================================================================
// COMPACT INSTALL BUTTON
// For use in headers/toolbars when install is available
// ============================================================================

export const InstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { canInstall, isInstalled, install } = useInstallPrompt();

    if (isInstalled || !canInstall) {
        return null;
    }

    return (
        <button
            onClick={install}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       text-green-400 bg-green-500/10 hover:bg-green-500/20
                       border border-green-500/30 rounded-lg transition-colors
                       ${className}`}
            title="Install Ambient Flow"
        >
            <Download className="w-3.5 h-3.5" />
            Install App
        </button>
    );
};

export default InstallBanner;
