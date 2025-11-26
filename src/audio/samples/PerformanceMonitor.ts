/**
 * PerformanceMonitor - Latency and memory profiling for the sample system.
 * 
 * Metrics tracked:
 * - Sample load time (fetch + decode)
 * - Trigger latency (click to sound)
 * - Memory usage and cache efficiency
 * - AudioContext performance
 * 
 * @module audio/samples/PerformanceMonitor
 */

// ===========================================
// TYPES
// ===========================================

export interface LatencyMeasurement {
  id: string;
  operation: 'load' | 'trigger' | 'decode';
  startTime: number;
  endTime: number;
  duration: number;
  sampleId?: string;
}

export interface MemorySnapshot {
  timestamp: number;
  cacheSize: number;
  cacheCount: number;
  heapUsed: number;
  heapTotal: number;
}

export interface AudioContextMetrics {
  state: AudioContextState;
  sampleRate: number;
  baseLatency: number;
  outputLatency: number;
  currentTime: number;
}

export interface PerformanceReport {
  generated: Date;
  measurements: LatencyMeasurement[];
  memorySnapshots: MemorySnapshot[];
  audioContext: AudioContextMetrics | null;
  summary: {
    avgLoadTime: number;
    avgTriggerLatency: number;
    maxLoadTime: number;
    minLoadTime: number;
    totalMeasurements: number;
  };
}

// ===========================================
// PERFORMANCE MONITOR CLASS
// ===========================================

export class PerformanceMonitor {
  private measurements: LatencyMeasurement[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private audioContext: AudioContext | null = null;
  private pendingMeasurements: Map<string, number> = new Map();
  private maxMeasurements: number = 1000;

  constructor(audioContext?: AudioContext) {
    this.audioContext = audioContext ?? null;
  }

  // ===========================================
  // LATENCY MEASUREMENT
  // ===========================================

  /**
   * Start measuring an operation.
   */
  startMeasure(id: string, _operation: LatencyMeasurement['operation'], _sampleId?: string): void {
    this.pendingMeasurements.set(id, performance.now());
  }

  /**
   * End measurement and record result.
   */
  endMeasure(id: string, operation: LatencyMeasurement['operation'], sampleId?: string): LatencyMeasurement | null {
    void operation; // Used in measurement object
    void sampleId;  // Used in measurement object
    const startTime = this.pendingMeasurements.get(id);
    if (startTime === undefined) {
      console.warn(`[PerformanceMonitor] No start time for measurement: ${id}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const measurement: LatencyMeasurement = {
      id,
      operation,
      startTime,
      endTime,
      duration,
      sampleId,
    };

    this.addMeasurement(measurement);
    this.pendingMeasurements.delete(id);

    return measurement;
  }

  /**
   * Measure a function's execution time.
   */
  async measureAsync<T>(
    id: string,
    operation: LatencyMeasurement['operation'],
    fn: () => Promise<T>,
    sampleId?: string
  ): Promise<T> {
    this.startMeasure(id, operation, sampleId);
    try {
      const result = await fn();
      this.endMeasure(id, operation, sampleId);
      return result;
    } catch (error) {
      this.pendingMeasurements.delete(id);
      throw error;
    }
  }

  /**
   * Add a measurement.
   */
  private addMeasurement(measurement: LatencyMeasurement): void {
    this.measurements.push(measurement);
    
    // Trim old measurements if over limit
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements = this.measurements.slice(-this.maxMeasurements);
    }
  }

  // ===========================================
  // MEMORY MONITORING
  // ===========================================

  /**
   * Take a memory snapshot.
   */
  takeMemorySnapshot(cacheSize: number, cacheCount: number): MemorySnapshot {
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      cacheSize,
      cacheCount,
      heapUsed: 0,
      heapTotal: 0,
    };

    // Get heap info if available (Chrome only)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.heapUsed = memory.usedJSHeapSize;
      snapshot.heapTotal = memory.totalJSHeapSize;
    }

    this.memorySnapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots = this.memorySnapshots.slice(-100);
    }

    return snapshot;
  }

  // ===========================================
  // AUDIO CONTEXT METRICS
  // ===========================================

  /**
   * Get AudioContext performance metrics.
   */
  getAudioContextMetrics(): AudioContextMetrics | null {
    if (!this.audioContext) return null;

    return {
      state: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
      baseLatency: this.audioContext.baseLatency ?? 0,
      outputLatency: (this.audioContext as any).outputLatency ?? 0,
      currentTime: this.audioContext.currentTime,
    };
  }

  /**
   * Set the AudioContext reference.
   */
  setAudioContext(ctx: AudioContext): void {
    this.audioContext = ctx;
  }

  // ===========================================
  // REPORTING
  // ===========================================

  /**
   * Get measurements filtered by operation type.
   */
  getMeasurements(operation?: LatencyMeasurement['operation']): LatencyMeasurement[] {
    if (!operation) return [...this.measurements];
    return this.measurements.filter(m => m.operation === operation);
  }

  /**
   * Get average latency for an operation type.
   */
  getAverageLatency(operation: LatencyMeasurement['operation']): number {
    const measurements = this.getMeasurements(operation);
    if (measurements.length === 0) return 0;
    
    const total = measurements.reduce((sum, m) => sum + m.duration, 0);
    return total / measurements.length;
  }

  /**
   * Generate a full performance report.
   */
  generateReport(): PerformanceReport {
    const loadMeasurements = this.getMeasurements('load');
    
    return {
      generated: new Date(),
      measurements: [...this.measurements],
      memorySnapshots: [...this.memorySnapshots],
      audioContext: this.getAudioContextMetrics(),
      summary: {
        avgLoadTime: this.getAverageLatency('load'),
        avgTriggerLatency: this.getAverageLatency('trigger'),
        maxLoadTime: loadMeasurements.length > 0 ? Math.max(...loadMeasurements.map(m => m.duration)) : 0,
        minLoadTime: loadMeasurements.length > 0 ? Math.min(...loadMeasurements.map(m => m.duration)) : 0,
        totalMeasurements: this.measurements.length,
      },
    };
  }

  /**
   * Log performance report to console.
   */
  logReport(): void {
    const report = this.generateReport();
    
    console.group('[PerformanceMonitor] Report');
    console.log('Generated:', report.generated.toISOString());
    
    console.group('Summary');
    console.log(`Total measurements: ${report.summary.totalMeasurements}`);
    console.log(`Avg load time: ${report.summary.avgLoadTime.toFixed(2)}ms`);
    console.log(`Avg trigger latency: ${report.summary.avgTriggerLatency.toFixed(2)}ms`);
    console.log(`Load time range: ${report.summary.minLoadTime.toFixed(2)}ms - ${report.summary.maxLoadTime.toFixed(2)}ms`);
    console.groupEnd();
    
    if (report.audioContext) {
      console.group('AudioContext');
      console.log(`State: ${report.audioContext.state}`);
      console.log(`Sample rate: ${report.audioContext.sampleRate}Hz`);
      console.log(`Base latency: ${(report.audioContext.baseLatency * 1000).toFixed(2)}ms`);
      console.log(`Output latency: ${(report.audioContext.outputLatency * 1000).toFixed(2)}ms`);
      console.groupEnd();
    }
    
    if (report.memorySnapshots.length > 0) {
      const latest = report.memorySnapshots[report.memorySnapshots.length - 1];
      console.group('Memory');
      console.log(`Cache size: ${(latest.cacheSize / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`Cache count: ${latest.cacheCount} samples`);
      if (latest.heapUsed > 0) {
        console.log(`Heap used: ${(latest.heapUsed / (1024 * 1024)).toFixed(2)}MB`);
      }
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Clear all measurements.
   */
  clear(): void {
    this.measurements = [];
    this.memorySnapshots = [];
    this.pendingMeasurements.clear();
  }
}

// Singleton instance for global access
export const performanceMonitor = new PerformanceMonitor();

export default PerformanceMonitor;
