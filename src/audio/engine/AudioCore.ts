import { MasterBus } from './MasterBus';
import { AtmosphereEngine } from './AtmosphereEngine';
import { SynthEngine } from './SynthEngine';
import { SampleEngine } from './SampleEngine';
import { SpatialEngine } from './SpatialEngine';
import { WasmDspNode } from '../nodes/WasmDspNode';
import { wasmLoader } from '../wasm/WasmLoader';
import type { SoundScene } from '../scenes/SoundScene';

export class AudioCore {
    private context: AudioContext | null = null;
    private masterBus: MasterBus | null = null;
    private atmosphere: AtmosphereEngine | null = null;
    private synth: SynthEngine | null = null;
    private samples: SampleEngine | null = null;
    private spatial: SpatialEngine | null = null;
    private wasmNode: WasmDspNode | null = null;
    private isInitialized: boolean = false;
    private useJsFallback: boolean = false;

    constructor() {
        // Lazy initialization on user interaction
    }

    public async init() {
        if (this.isInitialized) {
            console.log('[AudioCore] Already initialized, skipping');
            return;
        }

        console.log('[AudioCore] Initializing...');
        
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('[AudioCore] AudioContext created. State:', this.context.state, 'SampleRate:', this.context.sampleRate);

        this.masterBus = new MasterBus(this.context);
        this.atmosphere = new AtmosphereEngine(this.context);
        this.synth = new SynthEngine(this.context);
        this.samples = new SampleEngine(this.context);
        this.spatial = new SpatialEngine(this.context);

        // Connect Engines to MasterBus
        console.log('[AudioCore] Connecting engines to MasterBus...');
        this.atmosphere.connect(this.masterBus.getInputNode());
        this.synth.connect(this.masterBus.getInputNode());
        this.samples.connect(this.masterBus.getInputNode());
        this.spatial.connect(this.masterBus.getInputNode());

        // Initialize Synth Engine (loads Worklet)
        console.log('[AudioCore] Loading SynthEngine worklet...');
        await this.synth.init();

        // Initialize Sample Engine
        console.log('[AudioCore] Initializing SampleEngine...');
        await this.samples.init();

        // Bridge: When worklet sends SAMPLE_TRIGGER, call SampleEngine
        // This enables Sequencer/Euclidean → Sample node triggering via graph
        this.synth.setOnSampleTrigger((nodeId: string, sampleId?: string) => {
            console.log(`[AudioCore] Sample trigger received: node=${nodeId}, sample=${sampleId}`);
            if (this.samples && sampleId) {
                this.samples.retrigger(nodeId);
            }
        });

        this.isInitialized = true;
        console.log('[AudioCore] ✓ Initialization complete. Context state:', this.context.state);
    }

    public getContext(): AudioContext | null {
        return this.context;
    }

    public getMasterBus(): MasterBus | null {
        return this.masterBus;
    }

    public getAtmosphere(): AtmosphereEngine | null {
        return this.atmosphere;
    }

    public getSynth(): SynthEngine | null {
        return this.synth;
    }

    public getSamples(): SampleEngine | null {
        return this.samples;
    }

    public getSpatial(): SpatialEngine | null {
        return this.spatial;
    }

    /**
     * Resume the AudioContext (required after user gesture).
     * Note: Does NOT auto-start engines - use toggleClassic/toggleGraph for that.
     */
    public async resume() {
        console.log('[AudioCore] resume() called. isInitialized:', this.isInitialized, 'context state:', this.context?.state);
        
        if (!this.isInitialized) await this.init();
        
        if (this.context?.state === 'suspended') {
            console.log('[AudioCore] Resuming suspended context...');
            await this.context.resume();
            console.log('[AudioCore] Context resumed. New state:', this.context.state);
        } else {
            console.log('[AudioCore] Context already running or closed:', this.context?.state);
        }
        
        // DIAGNOSTIC: Log the audio graph connections
        console.log('[AudioCore] Audio chain status:', {
            contextState: this.context?.state,
            contextSampleRate: this.context?.sampleRate,
            masterBusExists: !!this.masterBus,
            synthExists: !!this.synth,
        });
    }

    /**
     * Resume AudioContext AND start both engines (legacy behavior)
     */
    public async resumeAll() {
        await this.resume();
        this.atmosphere?.start();
        this.synth?.setMuted(false);
    }

    public suspend() {
        if (this.context?.state === 'running') {
            this.context.suspend();
        }
        this.atmosphere?.stop();
    }

    public setScene(scene: SoundScene) {
        this.atmosphere?.setScene(scene);
    }

    /**
     * DIAGNOSTIC: Play test tone through SynthEngine to verify routing.
     * Call from console: audioCore.playTestTone()
     */
    public playTestTone() {
        if (!this.synth) {
            console.error('[AudioCore] Cannot play test tone - SynthEngine not initialized');
            return;
        }
        if (this.context?.state === 'suspended') {
            console.warn('[AudioCore] Context is suspended - resuming first...');
            this.context.resume().then(() => {
                this.synth?.playTestTone();
            });
        } else {
            this.synth.playTestTone();
        }
    }

    /**
     * DIAGNOSTIC: Load and play a minimal test worklet to verify AudioWorklet output works.
     * Call from console: audioCore.testWorkletOutput()
     */
    public async testWorkletOutput() {
        if (!this.context) {
            console.error('[AudioCore] No context');
            return;
        }

        console.log('[AudioCore] Loading minimal test worklet...');
        
        // Resume context first
        if (this.context.state === 'suspended') {
            console.log('[AudioCore] Resuming context...');
            await this.context.resume();
        }

        try {
            // Load the test processor
            await this.context.audioWorklet.addModule(
                new URL('../worklets/test-tone-processor.js', import.meta.url).href
            );
            console.log('[AudioCore] Test worklet loaded');

            // Create and connect directly to destination
            const testNode = new AudioWorkletNode(this.context, 'test-tone-processor');
            testNode.connect(this.context.destination);
            
            console.log('[AudioCore] Test worklet connected to destination');
            console.log('[AudioCore] You should hear a 440Hz sine wave for 3 seconds...');

            // Stop after 3 seconds
            setTimeout(() => {
                testNode.disconnect();
                console.log('[AudioCore] Test worklet disconnected');
            }, 3000);

        } catch (e) {
            console.error('[AudioCore] Test worklet failed:', e);
        }
    }

    /**
     * DIAGNOSTIC: Mute Classic Mode so Graph Mode can be tested in isolation
     * Call from console: audioCore.muteClassicMode(true)
     */
    public muteClassicMode(muted: boolean) {
        this.atmosphere?.setMuted(muted);
    }

    // ========================================================================
    // WASM DSP INTEGRATION
    // ========================================================================

    /**
     * Initialize WASM DSP module.
     * Call this after init() when WASM processing is needed.
     * 
     * @returns true if WASM initialized successfully, false if fallback is active
     */
    public async initWasm(): Promise<boolean> {
        if (this.wasmNode) {
            console.log('[AudioCore] WASM already initialized');
            return true;
        }

        if (!this.context) {
            console.warn('[AudioCore] Cannot init WASM: AudioContext not ready');
            return false;
        }

        try {
            console.log('[AudioCore] Initializing WASM DSP...');
            
            // Configure loader with current context settings
            wasmLoader.configure({
                sampleRate: this.context.sampleRate,
                bufferSize: 128,
            });

            // Pre-load WASM module
            await wasmLoader.load();

            // Create and initialize the WASM node
            this.wasmNode = new WasmDspNode(this.context);
            await this.wasmNode.init();

            console.log('[AudioCore] ✓ WASM DSP initialized successfully');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.warn('[AudioCore] WASM init failed, using JS fallback:', message);
            this.useJsFallback = true;
            return false;
        }
    }

    /**
     * Get the WASM DSP node for direct control.
     */
    public getWasmNode(): WasmDspNode | null {
        return this.wasmNode;
    }

    /**
     * Check if WASM DSP is ready for use.
     */
    public isWasmReady(): boolean {
        return this.wasmNode?.isReady() ?? false;
    }

    /**
     * Check if using JS fallback (WASM failed to load).
     */
    public isUsingJsFallback(): boolean {
        return this.useJsFallback;
    }

    /**
     * Connect WASM node to the audio graph.
     * Typical usage: source -> wasmNode -> masterBus
     * 
     * @param source - Source node to process through WASM
     */
    public connectWasmToGraph(source: AudioNode): void {
        if (!this.wasmNode || !this.masterBus) {
            console.warn('[AudioCore] Cannot connect WASM: not initialized');
            return;
        }

        try {
            source.connect(this.wasmNode.getNode());
            this.wasmNode.getNode().connect(this.masterBus.getInputNode());
            console.log('[AudioCore] WASM node connected to audio graph');
        } catch (error) {
            console.error('[AudioCore] Failed to connect WASM node:', error);
        }
    }
}

export const audioCore = new AudioCore();

// Re-export WASM types for convenience
export { EffectType } from '../nodes/WasmDspNode';
export type { GranularParams, ConvolutionParams, SpectralParams } from '../nodes/WasmDspNode';

// DIAGNOSTIC: Expose to window for console testing
(window as any).audioCore = audioCore;
