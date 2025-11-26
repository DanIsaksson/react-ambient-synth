import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// PWA INSTALL PROMPT HOOK
// Captures the beforeinstallprompt event and provides install functionality
// ============================================================================

// Extend Window interface for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

export interface InstallPromptState {
    /** Whether the app can be installed (install prompt is available) */
    canInstall: boolean;
    /** Whether the app is already installed as a PWA */
    isInstalled: boolean;
    /** Trigger the install prompt */
    install: () => Promise<boolean>;
    /** Dismiss the install prompt for this session */
    dismiss: () => void;
}

export const useInstallPrompt = (): InstallPromptState => {
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Check if already installed
        const checkInstalled = () => {
            // Check display-mode media query
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            // iOS Safari doesn't support display-mode, check navigator
            const isIOSInstalled = ('standalone' in window.navigator) && 
                                   (window.navigator as { standalone?: boolean }).standalone === true;
            setIsInstalled(isStandalone || isIOSInstalled);
        };
        
        checkInstalled();

        // Listen for install prompt
        const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
            // Prevent Chrome's default mini-infobar
            e.preventDefault();
            // Store the event for later use
            deferredPrompt.current = e;
            setCanInstall(true);
            console.log('[PWA] Install prompt captured');
        };

        // Listen for successful installation
        const handleAppInstalled = () => {
            console.log('[PWA] App installed successfully');
            setIsInstalled(true);
            setCanInstall(false);
            deferredPrompt.current = null;
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const install = useCallback(async (): Promise<boolean> => {
        if (!deferredPrompt.current) {
            console.log('[PWA] No install prompt available');
            return false;
        }

        try {
            // Show the install prompt
            await deferredPrompt.current.prompt();
            
            // Wait for user response
            const { outcome } = await deferredPrompt.current.userChoice;
            console.log('[PWA] User choice:', outcome);
            
            if (outcome === 'accepted') {
                setCanInstall(false);
                deferredPrompt.current = null;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[PWA] Install prompt error:', error);
            return false;
        }
    }, []);

    const dismiss = useCallback(() => {
        setCanInstall(false);
        // Keep the deferred prompt in case user wants to install later
        // It will be available via browser menu
    }, []);

    return {
        canInstall,
        isInstalled,
        install,
        dismiss,
    };
};

export default useInstallPrompt;
