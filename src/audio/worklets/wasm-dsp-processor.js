/**
 * WasmDspProcessor - AudioWorkletProcessor with WASM integration
 * 
 * This processor runs in the audio thread and handles:
 * 1. WASM module instantiation (from compiled module passed via MessagePort)
 * 2. Audio buffer transfer to/from WASM linear memory
 * 3. Real-time DSP parameter updates via MessagePort
 * 
 * # Memory Layout (must match memory.rs constants)
 * - 0x0000: Engine State (256 bytes)
 * - 0x0100: Input Buffer L (512 samples = 2KB)
 * - 0x0300: Input Buffer R (512 samples = 2KB)
 * - 0x0500: Output Buffer L (512 samples = 2KB)
 * - 0x0700: Output Buffer R (512 samples = 2KB)
 * - 0x1900: Granular Source Buffer
 * - 0x380000: IR Buffer
 * 
 * @important NO ALLOCATIONS IN process() CALLBACK!
 */

// Memory layout constants (must match Rust memory.rs)
const MEMORY_LAYOUT = {
    INPUT_L_OFFSET: 0x0100,
    INPUT_R_OFFSET: 0x0300,
    OUTPUT_L_OFFSET: 0x0500,
    OUTPUT_R_OFFSET: 0x0700,
    GRANULAR_SOURCE_OFFSET: 0x1900,
    IR_OFFSET: 0x380000,
};

// Effect types matching Rust implementation
const EffectType = {
    BYPASS: 0,
    GRANULAR: 1,
    CONVOLUTION: 2,
    SPECTRAL: 3,
};

class WasmDspProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // ====================================================================
        // WASM INSTANCE STATE
        // ====================================================================
        
        /** @type {WebAssembly.Instance | null} */
        this.wasmInstance = null;
        /** @type {WebAssembly.Memory | null} */
        this.wasmMemory = null;
        /** @type {Object | null} - WASM exported functions */
        this.exports = null;
        
        // ====================================================================
        // BUFFER POINTERS (set after WASM init)
        // ====================================================================
        
        // These are byte offsets into WASM memory
        this.inputPtrL = 0;
        this.inputPtrR = 0;
        this.outputPtrL = 0;
        this.outputPtrR = 0;
        
        // ====================================================================
        // PROCESSING STATE
        // ====================================================================
        
        this.initialized = false;
        this.currentEffect = EffectType.BYPASS;
        
        // ====================================================================
        // DSP PARAMETERS (updated via MessagePort)
        // ====================================================================
        
        this.params = {
            // Granular synthesis parameters
            grainSize: 256,       // 64-4096 samples
            density: 20.0,        // 1-100 grains/sec
            pitchSpread: 0.1,     // 0-1
            position: 0.5,        // 0-1 (playback position in source)
            spray: 0.05,          // 0-1 (position randomization)
            
            // Convolution parameters
            dryWet: 0.5,          // 0-1
            
            // Spectral parameters
            freezeAmount: 0.0,    // 0-1
            frequencyShift: 0.0,  // -24 to +24 semitones
        };
        
        // ====================================================================
        // PRE-ALLOCATED VIEWS (reused in process() to avoid GC)
        // ====================================================================
        
        /** @type {Float32Array | null} - View into WASM linear memory */
        this.memoryView = null;
        
        // ====================================================================
        // MESSAGE PORT HANDLER
        // ====================================================================
        
        this.port.onmessage = this.handleMessage.bind(this);
    }
    
    // ========================================================================
    // MESSAGE HANDLING
    // ========================================================================
    
    /**
     * Handle messages from main thread.
     * All parameter updates come through here.
     */
    handleMessage(event) {
        const { type, ...data } = event.data;
        
        switch (type) {
            case 'init-wasm':
                this.initWasm(data.module, data.config);
                break;
                
            case 'set-effect':
                this.currentEffect = data.effect;
                break;
                
            case 'set-params':
                // Merge new params with existing (allows partial updates)
                Object.assign(this.params, data.params);
                break;
                
            case 'load-granular-source':
                this.loadGranularSource(data.samples, data.channels);
                break;
                
            case 'load-ir':
                this.loadIR(data.samples, data.channels);
                break;
                
            default:
                console.warn('[WasmDspProcessor] Unknown message type:', type);
        }
    }
    
    // ========================================================================
    // WASM INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize WASM module.
     * Called once after receiving compiled module from main thread.
     */
    async initWasm(module, config) {
        try {
            // Create WASM memory
            // Initial: 8MB (128 pages × 64KB), Max: 16MB (256 pages)
            // Must be large enough for all buffers defined in memory.rs
            this.wasmMemory = new WebAssembly.Memory({
                initial: 128,
                maximum: 256,
                shared: false, // SharedArrayBuffer requires COOP/COEP headers
            });
            
            // Define imports for WASM module
            // These are functions/memory that Rust code can call/access
            const imports = {
                env: {
                    memory: this.wasmMemory,
                    
                    // Math intrinsics (fallback if libm not linked)
                    // Note: With libm crate, these may not be needed
                    sinf: Math.sin,
                    cosf: Math.cos,
                    powf: Math.pow,
                    sqrtf: Math.sqrt,
                    fabsf: Math.abs,
                    floorf: Math.floor,
                    ceilf: Math.ceil,
                    expf: Math.exp,
                    logf: Math.log,
                    fmodf: (a, b) => a % b,
                    
                    // Panic handler (if Rust panics, log it)
                    __wbindgen_throw: (ptr, len) => {
                        // This would require reading string from WASM memory
                        console.error('[WasmDspProcessor] WASM panic occurred');
                    },
                },
            };
            
            // Instantiate the module
            this.wasmInstance = await WebAssembly.instantiate(module, imports);
            this.exports = this.wasmInstance.exports;
            
            // Initialize DSP engine with sample rate and buffer size
            // sampleRate is a global in AudioWorkletGlobalScope
            const statePtr = this.exports.dsp_init(
                config.sampleRate || sampleRate,
                config.bufferSize || 128
            );
            
            if (statePtr === 0) {
                throw new Error('DSP engine initialization failed (returned null)');
            }
            
            // Get buffer pointers from WASM
            // These are byte offsets we use to read/write audio data
            this.inputPtrL = this.exports.dsp_get_input_ptr(0);
            this.inputPtrR = this.exports.dsp_get_input_ptr(1);
            this.outputPtrL = this.exports.dsp_get_output_ptr(0);
            this.outputPtrR = this.exports.dsp_get_output_ptr(1);
            
            // Create reusable Float32Array view into WASM memory
            // This view spans the entire linear memory
            this.memoryView = new Float32Array(this.wasmMemory.buffer);
            
            this.initialized = true;
            
            // Notify main thread of success
            this.port.postMessage({ type: 'initialized' });
            
            console.log('[WasmDspProcessor] WASM initialized successfully', {
                sampleRate: config.sampleRate || sampleRate,
                bufferSize: config.bufferSize || 128,
                inputPtrL: this.inputPtrL,
                outputPtrL: this.outputPtrL,
            });
            
        } catch (error) {
            console.error('[WasmDspProcessor] WASM init failed:', error);
            this.port.postMessage({ 
                type: 'error', 
                error: error.message || 'Unknown initialization error'
            });
        }
    }
    
    // ========================================================================
    // AUDIO DATA LOADING
    // ========================================================================
    
    /**
     * Load source audio for granular synthesis.
     * Writes interleaved samples to WASM memory at GRANULAR_SOURCE_OFFSET.
     */
    loadGranularSource(samples, channels) {
        if (!this.initialized) {
            console.warn('[WasmDspProcessor] Cannot load source: not initialized');
            return;
        }
        
        // Refresh memory view in case memory grew
        if (this.memoryView.buffer !== this.wasmMemory.buffer) {
            this.memoryView = new Float32Array(this.wasmMemory.buffer);
        }
        
        // Write samples to WASM memory at granular source offset
        // Offset is in bytes, but memoryView is Float32Array (4 bytes each)
        const sourceOffset = MEMORY_LAYOUT.GRANULAR_SOURCE_OFFSET / 4;
        this.memoryView.set(samples, sourceOffset);
        
        // Tell Rust about the loaded source
        this.exports.dsp_load_granular_source(
            MEMORY_LAYOUT.GRANULAR_SOURCE_OFFSET, // byte offset
            samples.length / channels,             // sample count per channel
            channels                               // channel count
        );
        
        console.log(`[WasmDspProcessor] Loaded granular source: ${samples.length} samples, ${channels} channels`);
        
        // Notify main thread
        this.port.postMessage({ 
            type: 'granular-source-loaded',
            length: samples.length,
            channels: channels,
        });
    }
    
    /**
     * Load impulse response for convolution reverb.
     * Writes interleaved samples to WASM memory at IR_OFFSET.
     */
    loadIR(samples, channels) {
        if (!this.initialized) {
            console.warn('[WasmDspProcessor] Cannot load IR: not initialized');
            return;
        }
        
        // Refresh memory view in case memory grew
        if (this.memoryView.buffer !== this.wasmMemory.buffer) {
            this.memoryView = new Float32Array(this.wasmMemory.buffer);
        }
        
        // Write samples to WASM memory at IR offset
        const irOffset = MEMORY_LAYOUT.IR_OFFSET / 4;
        this.memoryView.set(samples, irOffset);
        
        // Tell Rust about the loaded IR
        this.exports.dsp_load_ir(
            MEMORY_LAYOUT.IR_OFFSET,    // byte offset
            samples.length / channels,   // sample count per channel
            channels                      // channel count
        );
        
        console.log(`[WasmDspProcessor] Loaded IR: ${samples.length} samples, ${channels} channels`);
        
        // Notify main thread
        this.port.postMessage({ 
            type: 'ir-loaded',
            length: samples.length,
            channels: channels,
        });
    }
    
    // ========================================================================
    // AUDIO PROCESSING (REAL-TIME CRITICAL)
    // ========================================================================
    
    /**
     * Main audio processing callback.
     * 
     * @important This runs in the real-time audio thread!
     * - NO allocations (no new objects, arrays, closures)
     * - NO console.log (only in error paths, never in hot path)
     * - NO try/catch (performance overhead)
     * - NO async/await
     * 
     * @param {Float32Array[][]} inputs - Input audio buffers
     * @param {Float32Array[][]} outputs - Output audio buffers
     * @param {Record<string, Float32Array>} parameters - AudioParam values
     * @returns {boolean} - true to keep processor alive
     */
    process(inputs, outputs, parameters) {
        // Keep processor alive even when not initialized
        // (allows receiving init message)
        if (!this.initialized) {
            return true;
        }
        
        const input = inputs[0];
        const output = outputs[0];
        
        // Handle no input case (silence)
        if (!input || !input[0]) {
            if (output[0]) output[0].fill(0);
            if (output[1]) output[1].fill(0);
            return true;
        }
        
        const numSamples = input[0].length;
        
        // Refresh memory view if buffer was detached (memory grew)
        // This is the ONLY allocation allowed in process() - and only when needed
        if (this.memoryView.buffer !== this.wasmMemory.buffer) {
            this.memoryView = new Float32Array(this.wasmMemory.buffer);
        }
        
        // ====================================================================
        // WRITE INPUT TO WASM MEMORY
        // ====================================================================
        
        // Convert byte offset to f32 index (divide by 4)
        const inL = this.inputPtrL >>> 2;
        const inR = this.inputPtrR >>> 2;
        
        // Write input samples to WASM memory
        this.memoryView.set(input[0], inL);
        this.memoryView.set(input[1] || input[0], inR); // Mono → duplicate
        
        // ====================================================================
        // CALL WASM PROCESSING FUNCTION
        // ====================================================================
        
        switch (this.currentEffect) {
            case EffectType.GRANULAR:
                this.exports.dsp_process_granular(
                    this.params.grainSize,
                    this.params.density,
                    this.params.pitchSpread,
                    this.params.position,
                    this.params.spray
                );
                break;
                
            case EffectType.CONVOLUTION:
                this.exports.dsp_process_convolution(this.params.dryWet);
                break;
                
            case EffectType.SPECTRAL:
                this.exports.dsp_process_spectral(
                    this.params.freezeAmount,
                    this.params.frequencyShift
                );
                break;
                
            case EffectType.BYPASS:
            default:
                // Copy input to output directly in WASM memory (bypass)
                {
                    const outL = this.outputPtrL >>> 2;
                    const outR = this.outputPtrR >>> 2;
                    this.memoryView.copyWithin(outL, inL, inL + numSamples);
                    this.memoryView.copyWithin(outR, inR, inR + numSamples);
                }
                break;
        }
        
        // ====================================================================
        // READ OUTPUT FROM WASM MEMORY
        // ====================================================================
        
        const outL = this.outputPtrL >>> 2;
        const outR = this.outputPtrR >>> 2;
        
        // Read processed samples from WASM memory to output buffers
        output[0].set(this.memoryView.subarray(outL, outL + numSamples));
        if (output[1]) {
            output[1].set(this.memoryView.subarray(outR, outR + numSamples));
        }
        
        return true;
    }
}

// Register the processor with the AudioWorklet system
registerProcessor('wasm-dsp-processor', WasmDspProcessor);
