/**
 * WasmLoader - Handles WASM module loading and initialization
 * 
 * # Responsibilities
 * 1. Fetch and compile WASM binary on main thread (non-blocking)
 * 2. Pass compiled module to AudioWorklet via MessagePort
 * 3. Handle initialization errors gracefully
 * 
 * # Usage
 * ```typescript
 * // During app startup
 * await wasmLoader.load();
 * 
 * // When creating WASM DSP node
 * await wasmLoader.initWorklet(audioWorkletNode);
 * ```
 */

export interface WasmLoaderConfig {
    /** Path to WASM binary (relative to public folder) */
    wasmPath: string;
    /** Sample rate for DSP engine */
    sampleRate: number;
    /** Buffer size in samples (must match AudioWorklet quantum) */
    bufferSize: number;
}

export interface WasmLoaderState {
    isLoading: boolean;
    isReady: boolean;
    error: string | null;
}

export class WasmLoader {
    private config: WasmLoaderConfig;
    private module: WebAssembly.Module | null = null;
    private state: WasmLoaderState = {
        isLoading: false,
        isReady: false,
        error: null,
    };
    
    constructor(config: Partial<WasmLoaderConfig> = {}) {
        this.config = {
            wasmPath: '/wasm/dsp_core_bg.wasm',
            sampleRate: 44100,
            bufferSize: 128,
            ...config,
        };
    }
    
    /**
     * Load and compile the WASM module.
     * Call this during app initialization (not during audio playback).
     * 
     * Uses streaming compilation for efficiency - the browser can start
     * compiling while still downloading the binary.
     */
    async load(): Promise<WebAssembly.Module> {
        // Return cached module if already loaded
        if (this.module) {
            return this.module;
        }
        
        this.state.isLoading = true;
        this.state.error = null;
        
        try {
            // Fetch WASM binary
            const response = await fetch(this.config.wasmPath);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
            }
            
            // Compile streaming (most efficient - compiles while downloading)
            // Falls back to arrayBuffer + compile if streaming not supported
            try {
                this.module = await WebAssembly.compileStreaming(response);
            } catch {
                // Fallback for browsers/servers that don't support streaming
                const buffer = await response.arrayBuffer();
                this.module = await WebAssembly.compile(buffer);
            }
            
            this.state.isReady = true;
            console.log('[WasmLoader] Module compiled successfully');
            
            return this.module;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.state.error = message;
            console.error('[WasmLoader] Failed to load:', message);
            throw error;
            
        } finally {
            this.state.isLoading = false;
        }
    }
    
    /**
     * Initialize WASM in an AudioWorkletNode.
     * 
     * Sends the compiled module to the worklet thread via MessagePort,
     * waits for initialization confirmation.
     * 
     * @param node - The AudioWorkletNode to initialize
     * @param timeoutMs - Timeout in milliseconds (default 5000)
     */
    async initWorklet(node: AudioWorkletNode, timeoutMs = 5000): Promise<void> {
        // Ensure module is loaded
        if (!this.module) {
            await this.load();
        }
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                node.port.removeEventListener('message', handleMessage);
                reject(new Error('WASM initialization timeout'));
            }, timeoutMs);
            
            const handleMessage = (event: MessageEvent) => {
                const { type, error } = event.data;
                
                if (type === 'initialized') {
                    clearTimeout(timeout);
                    node.port.removeEventListener('message', handleMessage);
                    console.log('[WasmLoader] Worklet initialized successfully');
                    resolve();
                } else if (type === 'error') {
                    clearTimeout(timeout);
                    node.port.removeEventListener('message', handleMessage);
                    reject(new Error(error));
                }
            };
            
            node.port.addEventListener('message', handleMessage);
            node.port.start();
            
            // Send compiled module to worklet
            node.port.postMessage({
                type: 'init-wasm',
                module: this.module,
                config: {
                    sampleRate: this.config.sampleRate,
                    bufferSize: this.config.bufferSize,
                },
            });
        });
    }
    
    /**
     * Update the loader configuration.
     * Must be called before load() to take effect.
     */
    configure(config: Partial<WasmLoaderConfig>): void {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * Get current loader state (for UI feedback).
     */
    getState(): WasmLoaderState {
        return { ...this.state };
    }
    
    /**
     * Check if the module is ready for use.
     */
    isReady(): boolean {
        return this.state.isReady;
    }
    
    /**
     * Reset the loader (allows re-loading with different config).
     */
    reset(): void {
        this.module = null;
        this.state = {
            isLoading: false,
            isReady: false,
            error: null,
        };
    }
}

// Singleton instance for convenience
export const wasmLoader = new WasmLoader();
