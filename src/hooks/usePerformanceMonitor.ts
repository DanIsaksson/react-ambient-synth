import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// PERFORMANCE MONITOR HOOK
// Tracks FPS, memory usage, and audio performance metrics
// ============================================================================

export interface PerformanceMetrics {
    // Frame rate
    fps: number;
    avgFps: number;
    minFps: number;
    
    // Memory (if available)
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    heapUtilization: number;
    
    // Audio context metrics
    audioContextState: AudioContextState | null;
    audioLatency: number;
    sampleRate: number;
    
    // Performance warnings
    warnings: PerformanceWarning[];
}

export interface PerformanceWarning {
    type: 'fps' | 'memory' | 'audio';
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
}

export interface PerformanceBudget {
    minFps: number;
    maxMemoryMB: number;
    maxAudioLatencyMs: number;
}

const DEFAULT_BUDGET: PerformanceBudget = {
    minFps: 30,
    maxMemoryMB: 512,
    maxAudioLatencyMs: 50,
};

export const usePerformanceMonitor = (
    audioContext: AudioContext | null,
    budget: PerformanceBudget = DEFAULT_BUDGET,
    enabled: boolean = true
) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        fps: 60,
        avgFps: 60,
        minFps: 60,
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        heapUtilization: 0,
        audioContextState: null,
        audioLatency: 0,
        sampleRate: 44100,
        warnings: [],
    });

    // FPS calculation state
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const fpsHistoryRef = useRef<number[]>([]);
    const rafIdRef = useRef<number | null>(null);

    // Calculate FPS
    const measureFps = useCallback(() => {
        if (!enabled) return;

        frameCountRef.current++;
        const now = performance.now();
        const elapsed = now - lastTimeRef.current;

        // Update FPS every second
        if (elapsed >= 1000) {
            const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
            
            // Keep history for average calculation
            fpsHistoryRef.current.push(currentFps);
            if (fpsHistoryRef.current.length > 60) {
                fpsHistoryRef.current.shift();
            }

            const avgFps = Math.round(
                fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
            );
            const minFps = Math.min(...fpsHistoryRef.current);

            // Get memory info (Chrome only)
            let memoryInfo = {
                usedJSHeapSize: 0,
                totalJSHeapSize: 0,
                heapUtilization: 0,
            };

            // @ts-expect-error - memory is Chrome-specific
            if (performance.memory) {
                // @ts-expect-error - memory is Chrome-specific
                const mem = performance.memory;
                memoryInfo = {
                    usedJSHeapSize: mem.usedJSHeapSize,
                    totalJSHeapSize: mem.totalJSHeapSize,
                    heapUtilization: mem.usedJSHeapSize / mem.jsHeapSizeLimit,
                };
            }

            // Get audio metrics
            let audioMetrics = {
                audioContextState: null as AudioContextState | null,
                audioLatency: 0,
                sampleRate: 44100,
            };

            if (audioContext) {
                audioMetrics = {
                    audioContextState: audioContext.state,
                    audioLatency: (audioContext.baseLatency || 0) * 1000, // Convert to ms
                    sampleRate: audioContext.sampleRate,
                };
            }

            // Check for warnings
            const warnings: PerformanceWarning[] = [];

            if (currentFps < budget.minFps) {
                warnings.push({
                    type: 'fps',
                    message: `Low frame rate: ${currentFps} FPS (target: ${budget.minFps})`,
                    severity: currentFps < budget.minFps / 2 ? 'high' : 'medium',
                    timestamp: Date.now(),
                });
            }

            const usedMemoryMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
            if (usedMemoryMB > budget.maxMemoryMB) {
                warnings.push({
                    type: 'memory',
                    message: `High memory usage: ${Math.round(usedMemoryMB)}MB (limit: ${budget.maxMemoryMB}MB)`,
                    severity: usedMemoryMB > budget.maxMemoryMB * 1.5 ? 'high' : 'medium',
                    timestamp: Date.now(),
                });
            }

            if (audioMetrics.audioLatency > budget.maxAudioLatencyMs) {
                warnings.push({
                    type: 'audio',
                    message: `High audio latency: ${Math.round(audioMetrics.audioLatency)}ms`,
                    severity: 'medium',
                    timestamp: Date.now(),
                });
            }

            setMetrics({
                fps: currentFps,
                avgFps,
                minFps,
                ...memoryInfo,
                ...audioMetrics,
                warnings,
            });

            // Reset counters
            frameCountRef.current = 0;
            lastTimeRef.current = now;
        }

        rafIdRef.current = requestAnimationFrame(measureFps);
    }, [enabled, audioContext, budget]);

    // Start/stop monitoring
    useEffect(() => {
        if (enabled) {
            rafIdRef.current = requestAnimationFrame(measureFps);
        }

        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, [enabled, measureFps]);

    // Format helpers
    const formatMemory = useCallback((bytes: number): string => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)}MB`;
    }, []);

    const formatLatency = useCallback((ms: number): string => {
        return `${ms.toFixed(1)}ms`;
    }, []);

    return {
        metrics,
        formatMemory,
        formatLatency,
        isHealthy: metrics.warnings.length === 0,
        hasWarnings: metrics.warnings.some(w => w.severity !== 'low'),
        hasCriticalWarnings: metrics.warnings.some(w => w.severity === 'high'),
    };
};

export default usePerformanceMonitor;
