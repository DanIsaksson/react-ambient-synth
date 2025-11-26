import React, { useState } from 'react';
import { Activity, Cpu, HardDrive, Volume2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { usePerformanceMonitor, type PerformanceWarning } from '../../hooks/usePerformanceMonitor';
import { useAudioStore } from '../../store/useAudioStore';

// ============================================================================
// PERFORMANCE PANEL
// Debug panel showing FPS, memory, and audio metrics
// ============================================================================

interface PerformancePanelProps {
    /** Position on screen */
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Start collapsed */
    defaultCollapsed?: boolean;
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
    position = 'bottom-left',
    defaultCollapsed = true,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const { getCore } = useAudioStore();
    
    // Get audio context from core
    const audioContext = getCore().getContext();
    
    const { metrics, formatMemory, isHealthy, hasCriticalWarnings } = usePerformanceMonitor(
        audioContext,
        undefined,
        true // Always enabled in debug mode
    );

    // Position classes
    const positionClasses = {
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
    };

    // FPS color based on value
    const getFpsColor = (fps: number): string => {
        if (fps >= 55) return 'text-green-400';
        if (fps >= 30) return 'text-yellow-400';
        return 'text-red-400';
    };

    // Memory color based on utilization
    const getMemoryColor = (utilization: number): string => {
        if (utilization < 0.5) return 'text-green-400';
        if (utilization < 0.75) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div 
            className={`fixed ${positionClasses[position]} z-50 font-mono text-xs`}
            style={{ pointerEvents: 'auto' }}
        >
            <div className="bg-black/80 backdrop-blur-sm border border-gray-800 
                          rounded-lg overflow-hidden shadow-lg min-w-[180px]">
                {/* Header */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full flex items-center justify-between px-3 py-2 
                             hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Activity size={12} className={isHealthy ? 'text-green-400' : 'text-amber-400'} />
                        <span className="text-gray-300">Performance</span>
                        {hasCriticalWarnings && (
                            <AlertTriangle size={10} className="text-red-400" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={getFpsColor(metrics.fps)}>
                            {metrics.fps} FPS
                        </span>
                        {isCollapsed ? (
                            <ChevronDown size={12} className="text-gray-500" />
                        ) : (
                            <ChevronUp size={12} className="text-gray-500" />
                        )}
                    </div>
                </button>

                {/* Expanded content */}
                {!isCollapsed && (
                    <div className="border-t border-gray-800 px-3 py-2 space-y-2">
                        {/* FPS Stats */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-gray-500">
                                <Cpu size={10} />
                                <span>Avg FPS</span>
                            </div>
                            <span className={getFpsColor(metrics.avgFps)}>
                                {metrics.avgFps}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-gray-500">
                                <Cpu size={10} />
                                <span>Min FPS</span>
                            </div>
                            <span className={getFpsColor(metrics.minFps)}>
                                {metrics.minFps}
                            </span>
                        </div>

                        {/* Memory */}
                        {metrics.totalJSHeapSize > 0 && (
                            <>
                                <div className="border-t border-gray-800 my-2" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <HardDrive size={10} />
                                        <span>Heap Used</span>
                                    </div>
                                    <span className={getMemoryColor(metrics.heapUtilization)}>
                                        {formatMemory(metrics.usedJSHeapSize)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <HardDrive size={10} />
                                        <span>Heap Total</span>
                                    </div>
                                    <span className="text-gray-400">
                                        {formatMemory(metrics.totalJSHeapSize)}
                                    </span>
                                </div>
                                {/* Memory bar */}
                                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all ${
                                            metrics.heapUtilization < 0.5 ? 'bg-green-500' :
                                            metrics.heapUtilization < 0.75 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${metrics.heapUtilization * 100}%` }}
                                    />
                                </div>
                            </>
                        )}

                        {/* Audio */}
                        <div className="border-t border-gray-800 my-2" />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-gray-500">
                                <Volume2 size={10} />
                                <span>Audio State</span>
                            </div>
                            <span className={
                                metrics.audioContextState === 'running' ? 'text-green-400' :
                                metrics.audioContextState === 'suspended' ? 'text-yellow-400' : 'text-gray-400'
                            }>
                                {metrics.audioContextState || 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-gray-500">
                                <Volume2 size={10} />
                                <span>Sample Rate</span>
                            </div>
                            <span className="text-cyan-400">
                                {(metrics.sampleRate / 1000).toFixed(1)}kHz
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-gray-500">
                                <Volume2 size={10} />
                                <span>Latency</span>
                            </div>
                            <span className={metrics.audioLatency > 20 ? 'text-yellow-400' : 'text-green-400'}>
                                {metrics.audioLatency.toFixed(1)}ms
                            </span>
                        </div>

                        {/* Warnings */}
                        {metrics.warnings.length > 0 && (
                            <>
                                <div className="border-t border-gray-800 my-2" />
                                <div className="space-y-1">
                                    {metrics.warnings.slice(0, 3).map((warning, i) => (
                                        <WarningItem key={i} warning={warning} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Warning item component
const WarningItem: React.FC<{ warning: PerformanceWarning }> = ({ warning }) => {
    const severityColors = {
        low: 'text-blue-400',
        medium: 'text-amber-400',
        high: 'text-red-400',
    };

    return (
        <div className={`text-[10px] ${severityColors[warning.severity]} flex items-start gap-1`}>
            <AlertTriangle size={8} className="mt-0.5 shrink-0" />
            <span>{warning.message}</span>
        </div>
    );
};

export default PerformancePanel;
