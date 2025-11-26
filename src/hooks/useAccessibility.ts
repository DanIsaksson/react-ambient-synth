import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// ACCESSIBILITY HOOKS
// Provides reduced motion detection, screen reader announcements, and focus management
// ============================================================================

/**
 * Hook to detect user's reduced motion preference
 * Respects the prefers-reduced-motion media query
 */
export const useReducedMotion = (): boolean => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        // Modern browsers
        mediaQuery.addEventListener('change', handleChange);
        
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersReducedMotion;
};

/**
 * Hook to detect user's high contrast preference
 */
export const useHighContrast = (): boolean => {
    const [prefersHighContrast, setPrefersHighContrast] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-contrast: more)').matches;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-contrast: more)');
        
        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersHighContrast(event.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersHighContrast;
};

/**
 * Hook for live region announcements (screen readers)
 * Creates an ARIA live region and provides a function to announce messages
 */
export const useAnnounce = () => {
    const announcerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Create the live region element if it doesn't exist
        let announcer = document.getElementById('sr-announcer') as HTMLDivElement;
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.setAttribute('role', 'status');
            announcer.style.cssText = `
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            `;
            document.body.appendChild(announcer);
        }
        
        announcerRef.current = announcer;

        return () => {
            // Don't remove on unmount - other components might use it
        };
    }, []);

    const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
        if (!announcerRef.current) return;
        
        // Update aria-live based on priority
        announcerRef.current.setAttribute('aria-live', priority);
        
        // Clear and set message (triggers announcement)
        announcerRef.current.textContent = '';
        
        // Small delay to ensure screen readers pick up the change
        requestAnimationFrame(() => {
            if (announcerRef.current) {
                announcerRef.current.textContent = message;
            }
        });
    }, []);

    return announce;
};

/**
 * Hook for focus trap (modals, dialogs)
 * Traps focus within a container element
 */
export const useFocusTrap = (isActive: boolean) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        // Store the previously focused element
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Get all focusable elements
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(focusableSelector);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus the first element
        firstElement?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore focus to previous element
            previousFocusRef.current?.focus();
        };
    }, [isActive]);

    return containerRef;
};

/**
 * Hook to manage skip links for keyboard navigation
 */
export const useSkipLinks = () => {
    const skipToMain = useCallback(() => {
        const main = document.querySelector('main, [role="main"], #main-content');
        if (main instanceof HTMLElement) {
            main.tabIndex = -1;
            main.focus();
            main.removeAttribute('tabindex');
        }
    }, []);

    const skipToControls = useCallback(() => {
        const controls = document.querySelector('[data-tour="header"], .control-panel');
        if (controls instanceof HTMLElement) {
            const firstFocusable = controls.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
            firstFocusable?.focus();
        }
    }, []);

    return { skipToMain, skipToControls };
};

/**
 * Combined accessibility context values
 */
export interface AccessibilityState {
    prefersReducedMotion: boolean;
    prefersHighContrast: boolean;
    announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

/**
 * Combined hook for all accessibility features
 */
export const useAccessibility = (): AccessibilityState => {
    const prefersReducedMotion = useReducedMotion();
    const prefersHighContrast = useHighContrast();
    const announce = useAnnounce();

    return {
        prefersReducedMotion,
        prefersHighContrast,
        announce,
    };
};

export default useAccessibility;
