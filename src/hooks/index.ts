export { usePlatform, useGyroscope, requestGyroscopePermission, triggerHaptic } from './usePlatform';
export type { PlatformCapabilities } from './usePlatform';
export { useInstallPrompt } from './useInstallPrompt';
export { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from './useKeyboardShortcuts';
export { useOnboarding } from './useOnboarding';
export { useAudioMeter } from './useAudioMeter';
export { 
    useReducedMotion, 
    useHighContrast, 
    useAnnounce, 
    useFocusTrap,
    useSkipLinks,
    useAccessibility 
} from './useAccessibility';
export type { AccessibilityState } from './useAccessibility';
export { usePerformanceMonitor } from './usePerformanceMonitor';
export type { PerformanceMetrics, PerformanceWarning, PerformanceBudget } from './usePerformanceMonitor';
