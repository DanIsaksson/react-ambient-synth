import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// ONBOARDING STATE HOOK
// Tracks whether the user has completed the onboarding tour
// ============================================================================

const ONBOARDING_STORAGE_KEY = 'ambient-flow-onboarding';

interface OnboardingState {
    hasSeenWelcome: boolean;
    hasSeenClassicTour: boolean;
    hasSeenGraphTour: boolean;
    completedAt?: string;
}

const DEFAULT_STATE: OnboardingState = {
    hasSeenWelcome: false,
    hasSeenClassicTour: false,
    hasSeenGraphTour: false,
};

export const useOnboarding = () => {
    const [state, setState] = useState<OnboardingState>(() => {
        try {
            const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[Onboarding] Failed to load state from localStorage');
        }
        return DEFAULT_STATE;
    });

    // Persist state changes
    useEffect(() => {
        try {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('[Onboarding] Failed to save state to localStorage');
        }
    }, [state]);

    // Check if this is the user's first visit
    const isFirstVisit = !state.hasSeenWelcome;

    // Check if user should see classic mode tour
    const shouldShowClassicTour = state.hasSeenWelcome && !state.hasSeenClassicTour;

    // Check if user should see graph mode tour
    const shouldShowGraphTour = state.hasSeenWelcome && !state.hasSeenGraphTour;

    // Mark welcome as seen
    const completeWelcome = useCallback(() => {
        setState(prev => ({ ...prev, hasSeenWelcome: true }));
        console.log('[Onboarding] Welcome completed');
    }, []);

    // Mark classic tour as completed
    const completeClassicTour = useCallback(() => {
        setState(prev => ({ ...prev, hasSeenClassicTour: true }));
        console.log('[Onboarding] Classic tour completed');
    }, []);

    // Mark graph tour as completed
    const completeGraphTour = useCallback(() => {
        setState(prev => ({ ...prev, hasSeenGraphTour: true }));
        console.log('[Onboarding] Graph tour completed');
    }, []);

    // Mark all onboarding as complete
    const completeAll = useCallback(() => {
        setState({
            hasSeenWelcome: true,
            hasSeenClassicTour: true,
            hasSeenGraphTour: true,
            completedAt: new Date().toISOString(),
        });
        console.log('[Onboarding] All onboarding completed');
    }, []);

    // Reset onboarding (for testing)
    const resetOnboarding = useCallback(() => {
        setState(DEFAULT_STATE);
        console.log('[Onboarding] Reset to initial state');
    }, []);

    // Skip remaining onboarding
    const skipOnboarding = useCallback(() => {
        completeAll();
    }, [completeAll]);

    return {
        // State
        isFirstVisit,
        shouldShowClassicTour,
        shouldShowGraphTour,
        hasCompletedOnboarding: state.hasSeenWelcome && state.hasSeenClassicTour && state.hasSeenGraphTour,
        
        // Actions
        completeWelcome,
        completeClassicTour,
        completeGraphTour,
        completeAll,
        skipOnboarding,
        resetOnboarding,
    };
};

export default useOnboarding;
