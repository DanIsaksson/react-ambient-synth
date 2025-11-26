/**
 * Memory Profiling Utility for WASM DSP Module
 * 
 * Detects memory leaks during sustained audio processing.
 * 
 * Usage (Node.js with Chrome DevTools):
 *   node --inspect tests/memory-profile.js
 * 
 * Usage (Browser console):
 *   import { runMemoryTest } from './tests/memory-profile.js';
 *   await runMemoryTest(60);
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    /** Test duration in seconds */
    durationSeconds: 60,
    
    /** Sample interval in milliseconds */
    sampleIntervalMs: 1000,
    
    /** Maximum allowed memory growth percentage */
    maxGrowthPercent: 5,
    
    /** Number of samples to average at start/end */
    averageWindowSize: 10,
    
    /** Simulated sample rate */
    sampleRate: 44100,
    
    /** Simulated buffer size */
    bufferSize: 128,
};

// ============================================================================
// MEMORY SAMPLING
// ============================================================================

/**
 * Collects memory samples over time
 * @param {number} durationMs - Duration to collect samples
 * @param {number} intervalMs - Interval between samples
 * @returns {Promise<Array<{time: number, heap: number}>>}
 */
async function collectMemorySamples(durationMs, intervalMs) {
    const samples = [];
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            
            // Try to get memory info (Chrome-specific API)
            if (typeof performance !== 'undefined' && performance.memory) {
                samples.push({
                    time: elapsed,
                    heap: performance.memory.usedJSHeapSize,
                    heapTotal: performance.memory.totalJSHeapSize,
                });
            } else if (typeof process !== 'undefined' && process.memoryUsage) {
                // Node.js fallback
                const mem = process.memoryUsage();
                samples.push({
                    time: elapsed,
                    heap: mem.heapUsed,
                    heapTotal: mem.heapTotal,
                });
            }
            
            if (elapsed >= durationMs) {
                clearInterval(interval);
                resolve(samples);
            }
        }, intervalMs);
    });
}

// ============================================================================
// ANALYSIS
// ============================================================================

/**
 * Analyzes memory samples for leaks
 * @param {Array<{time: number, heap: number}>} samples
 * @returns {{growth: number, trend: string, leak: boolean}}
 */
function analyzeMemory(samples) {
    if (samples.length < CONFIG.averageWindowSize * 2) {
        return { growth: 0, trend: 'insufficient data', leak: false };
    }
    
    // Calculate average at start and end
    const startSamples = samples.slice(0, CONFIG.averageWindowSize);
    const endSamples = samples.slice(-CONFIG.averageWindowSize);
    
    const startAvg = startSamples.reduce((a, b) => a + b.heap, 0) / startSamples.length;
    const endAvg = endSamples.reduce((a, b) => a + b.heap, 0) / endSamples.length;
    
    const growth = ((endAvg - startAvg) / startAvg) * 100;
    
    // Calculate trend using linear regression
    const n = samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    samples.forEach((sample, i) => {
        sumX += i;
        sumY += sample.heap;
        sumXY += i * sample.heap;
        sumX2 += i * i;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const trend = slope > 1000 ? 'increasing' : slope < -1000 ? 'decreasing' : 'stable';
    
    return {
        growth,
        trend,
        leak: growth > CONFIG.maxGrowthPercent,
        startHeap: startAvg,
        endHeap: endAvg,
        slopePerSecond: slope * 1000 / CONFIG.sampleIntervalMs,
    };
}

// ============================================================================
// TEST RUNNER
// ============================================================================

/**
 * Runs memory leak test with simulated audio processing
 * @param {number} durationSeconds - Test duration
 * @param {Function} processCallback - Audio processing function to call
 * @returns {Promise<{passed: boolean, analysis: object}>}
 */
export async function runMemoryTest(durationSeconds = CONFIG.durationSeconds, processCallback = null) {
    console.log(`🧪 Starting memory test for ${durationSeconds} seconds...`);
    console.log(`   Sample interval: ${CONFIG.sampleIntervalMs}ms`);
    console.log(`   Max allowed growth: ${CONFIG.maxGrowthPercent}%`);
    console.log('');
    
    const durationMs = durationSeconds * 1000;
    
    // Start memory sampling in background
    const samplingPromise = collectMemorySamples(durationMs, CONFIG.sampleIntervalMs);
    
    // Simulate audio processing if callback provided
    if (processCallback) {
        const blocksPerSecond = CONFIG.sampleRate / CONFIG.bufferSize;
        const intervalMs = 1000 / blocksPerSecond;
        
        const processInterval = setInterval(() => {
            processCallback();
        }, intervalMs);
        
        // Stop processing when sampling is done
        samplingPromise.then(() => clearInterval(processInterval));
    }
    
    // Wait for sampling to complete
    const samples = await samplingPromise;
    
    // Analyze results
    const analysis = analyzeMemory(samples);
    
    // Report
    console.log('📊 Memory Analysis Results:');
    console.log(`   Samples collected: ${samples.length}`);
    console.log(`   Initial heap: ${formatBytes(analysis.startHeap)}`);
    console.log(`   Final heap: ${formatBytes(analysis.endHeap)}`);
    console.log(`   Growth: ${analysis.growth.toFixed(2)}%`);
    console.log(`   Trend: ${analysis.trend}`);
    console.log(`   Slope: ${formatBytes(analysis.slopePerSecond)}/s`);
    console.log('');
    
    if (analysis.leak) {
        console.log('❌ MEMORY LEAK DETECTED!');
        console.log(`   Growth of ${analysis.growth.toFixed(2)}% exceeds threshold of ${CONFIG.maxGrowthPercent}%`);
    } else {
        console.log('✅ No memory leak detected');
    }
    
    return {
        passed: !analysis.leak,
        analysis,
        samples,
    };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ============================================================================
// WASM INTEGRATION
// ============================================================================

/**
 * Run memory test with WASM DSP module
 * @param {string} wasmPath - Path to WASM JS wrapper
 * @param {number} durationSeconds - Test duration
 */
export async function runWasmMemoryTest(wasmPath, durationSeconds = CONFIG.durationSeconds) {
    try {
        // Dynamic import of WASM module
        const wasm = await import(wasmPath);
        await wasm.default();
        
        // Initialize DSP
        wasm.dsp_init(CONFIG.sampleRate, CONFIG.bufferSize);
        
        // Run test with granular processing
        return await runMemoryTest(durationSeconds, () => {
            wasm.dsp_process_granular(256, 50.0, 0.1, 0.5, 0.05);
        });
        
    } catch (error) {
        console.error('Failed to load WASM module:', error);
        throw error;
    }
}

// ============================================================================
// CLI RUNNER
// ============================================================================

// Run if called directly from Node.js
if (typeof process !== 'undefined' && process.argv[1]?.includes('memory-profile')) {
    const duration = parseInt(process.argv[2]) || CONFIG.durationSeconds;
    
    runMemoryTest(duration, () => {
        // Simulate work - allocate and process some data
        const buffer = new Float32Array(CONFIG.bufferSize);
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.sin(i * 0.01) * 0.5;
        }
    }).then(result => {
        process.exit(result.passed ? 0 : 1);
    });
}
