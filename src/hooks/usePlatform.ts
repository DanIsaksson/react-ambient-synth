import { useState, useEffect, useCallback } from 'react';

/**
 * Platform capabilities detected from the browser environment.
 */
export interface PlatformCapabilities {
  /** Device is mobile (phone/tablet) based on screen size and touch */
  isMobile: boolean;
  /** Device is a tablet (larger touch screen) */
  isTablet: boolean;
  /** Device is a desktop (mouse-primary) */
  isDesktop: boolean;
  /** Device supports touch input */
  hasTouch: boolean;
  /** Device has gyroscope/accelerometer (for tilt control) */
  hasGyroscope: boolean;
  /** Device supports haptic feedback */
  hasHaptics: boolean;
  /** Screen width in pixels */
  screenWidth: number;
  /** Screen height in pixels */
  screenHeight: number;
  /** Current orientation */
  orientation: 'portrait' | 'landscape';
  /** Pixel density ratio */
  pixelRatio: number;
  /** Device prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Device prefers dark color scheme */
  prefersDarkMode: boolean;
  /** Is running as installed PWA */
  isPWA: boolean;
}

/**
 * Breakpoints for responsive design.
 */
const BREAKPOINTS = {
  mobile: 640,   // Below this is phone
  tablet: 1024,  // Below this is tablet
  desktop: 1280, // Above this is desktop
};

/**
 * Check if device has gyroscope capability.
 */
async function checkGyroscope(): Promise<boolean> {
  if (!('DeviceOrientationEvent' in window)) {
    return false;
  }

  // On iOS 13+, need to request permission
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      // Don't actually request - just check if it's possible
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Check if device supports haptic feedback.
 */
function checkHaptics(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Check if running as installed PWA.
 */
function checkPWA(): boolean {
  // Check display mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Check iOS Safari specific
  if ((navigator as any).standalone === true) {
    return true;
  }
  return false;
}

/**
 * usePlatform - Hook for detecting platform capabilities and responsive breakpoints.
 * 
 * Usage:
 * ```tsx
 * const { isMobile, hasTouch, orientation } = usePlatform();
 * 
 * return isMobile ? <MobileUI /> : <DesktopUI />;
 * ```
 */
export function usePlatform(): PlatformCapabilities {
  const [capabilities, setCapabilities] = useState<PlatformCapabilities>(() => {
    // Initial values (SSR-safe defaults)
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const hasTouch = typeof window !== 'undefined' && 
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    return {
      isMobile: width < BREAKPOINTS.mobile,
      isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
      isDesktop: width >= BREAKPOINTS.tablet,
      hasTouch,
      hasGyroscope: false,
      hasHaptics: false,
      screenWidth: width,
      screenHeight: height,
      orientation: width > height ? 'landscape' : 'portrait',
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      prefersReducedMotion: false,
      prefersDarkMode: true,
      isPWA: false,
    };
  });

  // Update capabilities on mount and window changes
  useEffect(() => {
    const updateCapabilities = async () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Async checks
      const hasGyroscope = await checkGyroscope();
      const hasHaptics = checkHaptics();
      const isPWA = checkPWA();

      // Media query checks
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

      setCapabilities({
        isMobile: width < BREAKPOINTS.mobile || (hasTouch && width < BREAKPOINTS.tablet),
        isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet && hasTouch,
        isDesktop: width >= BREAKPOINTS.tablet && !hasTouch,
        hasTouch,
        hasGyroscope,
        hasHaptics,
        screenWidth: width,
        screenHeight: height,
        orientation: width > height ? 'landscape' : 'portrait',
        pixelRatio: window.devicePixelRatio,
        prefersReducedMotion,
        prefersDarkMode,
        isPWA,
      });
    };

    updateCapabilities();

    // Listen for resize/orientation changes
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setCapabilities(prev => ({
        ...prev,
        isMobile: width < BREAKPOINTS.mobile || (hasTouch && width < BREAKPOINTS.tablet),
        isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet && hasTouch,
        isDesktop: width >= BREAKPOINTS.tablet && !hasTouch,
        screenWidth: width,
        screenHeight: height,
        orientation: width > height ? 'landscape' : 'portrait',
      }));
    };

    // Listen for preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setCapabilities(prev => ({ ...prev, prefersReducedMotion: e.matches }));
    };

    const handleDarkChange = (e: MediaQueryListEvent) => {
      setCapabilities(prev => ({ ...prev, prefersDarkMode: e.matches }));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    motionQuery.addEventListener('change', handleMotionChange);
    darkQuery.addEventListener('change', handleDarkChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      motionQuery.removeEventListener('change', handleMotionChange);
      darkQuery.removeEventListener('change', handleDarkChange);
    };
  }, []);

  return capabilities;
}

/**
 * Request gyroscope permission (iOS 13+).
 * Must be called from a user gesture (click/tap).
 */
export async function requestGyroscopePermission(): Promise<boolean> {
  if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
    // No permission needed on this device
    return true;
  }

  try {
    const permission = await (DeviceOrientationEvent as any).requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('[usePlatform] Gyroscope permission denied:', error);
    return false;
  }
}

/**
 * Trigger haptic feedback if available.
 * @param pattern - Vibration pattern in milliseconds
 */
export function triggerHaptic(pattern: number | number[] = 10): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Hook for gyroscope data (device orientation).
 */
export function useGyroscope(enabled: boolean = true) {
  const [orientation, setOrientation] = useState({
    alpha: 0, // Z-axis rotation (0-360)
    beta: 0,  // X-axis rotation (-180 to 180)
    gamma: 0, // Y-axis rotation (-90 to 90)
  });

  const [calibration, setCalibration] = useState({ beta: 0, gamma: 0 });

  const calibrate = useCallback(() => {
    setCalibration({ beta: orientation.beta, gamma: orientation.gamma });
  }, [orientation.beta, orientation.gamma]);

  useEffect(() => {
    if (!enabled) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [enabled]);

  // Return calibrated values
  return {
    alpha: orientation.alpha,
    beta: orientation.beta - calibration.beta,
    gamma: orientation.gamma - calibration.gamma,
    raw: orientation,
    calibrate,
  };
}
