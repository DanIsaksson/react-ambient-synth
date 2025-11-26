import React, { createContext, useContext } from 'react';
import { useAccessibility, type AccessibilityState } from '../../hooks/useAccessibility';

// ============================================================================
// ACCESSIBILITY PROVIDER
// Provides accessibility state to the entire app via React Context
// ============================================================================

const AccessibilityContext = createContext<AccessibilityState | null>(null);

interface AccessibilityProviderProps {
    children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
    const accessibilityState = useAccessibility();

    return (
        <AccessibilityContext.Provider value={accessibilityState}>
            {/* Root element with accessibility attributes */}
            <div
                className={accessibilityState.prefersReducedMotion ? 'reduce-motion' : ''}
                data-high-contrast={accessibilityState.prefersHighContrast || undefined}
            >
                {children}
            </div>
        </AccessibilityContext.Provider>
    );
};

/**
 * Hook to access accessibility state from any component
 */
export const useAccessibilityContext = (): AccessibilityState => {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibilityContext must be used within AccessibilityProvider');
    }
    return context;
};

export default AccessibilityProvider;
