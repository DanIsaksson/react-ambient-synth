import type { AudioMessage } from '../types';

export class SynthEngine {
    private context: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private output: GainNode;
    private pendingMessages: (AudioMessage | any)[] = [];

    constructor(context: AudioContext) {
        this.context = context;
        this.output = this.context.createGain();
    }

    public async init() {
        try {
            // We assume the worklet file is at the correct path relative to the public root or built assets
            // Note: In Vite, we might need to handle this differently, but for now using the same pattern as before
            await this.context.audioWorklet.addModule(new URL('../worklets/main-processor.js', import.meta.url).href);
            this.workletNode = new AudioWorkletNode(this.context, 'main-processor');
            this.workletNode.connect(this.output);
            console.log("SynthEngine: AudioWorklet loaded successfully");
            
            // Flush any messages that arrived before worklet was ready
            this.flushPendingMessages();
        } catch (e) {
            console.error("SynthEngine: Failed to load AudioWorklet:", e);
        }
    }

    /**
     * Flushes queued messages that arrived before the worklet was ready.
     * Called automatically at end of init().
     */
    private flushPendingMessages() {
        if (this.workletNode && this.pendingMessages.length > 0) {
            console.log(`SynthEngine: Flushing ${this.pendingMessages.length} queued messages`);
            for (const msg of this.pendingMessages) {
                this.workletNode.port.postMessage(msg);
            }
            this.pendingMessages = [];
        }
    }

    public connect(destination: AudioNode) {
        this.output.connect(destination);
        console.log('[SynthEngine] Connected to destination. Output gain:', this.output.gain.value);
    }

    public sendMessage(message: AudioMessage | any) {
        if (this.workletNode) {
            this.workletNode.port.postMessage(message);
        } else {
            // Queue message for when worklet is ready instead of dropping it
            this.pendingMessages.push(message);
            console.log("SynthEngine: Message queued (worklet loading...)");
        }
    }

    /**
     * Cleanup: disconnect worklet and clear pending messages.
     */
    public dispose() {
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        this.pendingMessages = [];
        console.log("SynthEngine: Disposed");
    }

    /**
     * DIAGNOSTIC: Play a test tone using native oscillator (bypasses worklet)
     * to verify SynthEngine → MasterBus connection works.
     */
    public playTestTone(durationMs: number = 500) {
        console.log('[SynthEngine] Playing test tone to verify audio chain...');
        console.log('[SynthEngine] Output gain value:', this.output.gain.value);
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        
        osc.connect(gain);
        gain.connect(this.output); // Connect to SynthEngine's output GainNode
        
        osc.start();
        osc.stop(this.context.currentTime + durationMs / 1000);
        
        console.log('[SynthEngine] Test tone started. If you hear a beep, SynthEngine→MasterBus chain works.');
        console.log('[SynthEngine] If silent, the connection to MasterBus is broken.');
    }

    /**
     * DIAGNOSTIC: Connect worklet directly to destination, bypassing SynthEngine.output
     * Call from console: audioCore.getSynth().bypassToDestination()
     */
    public bypassToDestination() {
        if (!this.workletNode) {
            console.error('[SynthEngine] No worklet node to bypass');
            return;
        }
        
        console.log('[SynthEngine] Connecting worklet DIRECTLY to destination (bypass test)...');
        console.log('[SynthEngine] Worklet node:', this.workletNode);
        console.log('[SynthEngine] Worklet numberOfOutputs:', this.workletNode.numberOfOutputs);
        console.log('[SynthEngine] Worklet channelCount:', this.workletNode.channelCount);
        
        // Disconnect from current chain
        this.workletNode.disconnect();
        
        // Connect directly to destination
        this.workletNode.connect(this.context.destination);
        
        console.log('[SynthEngine] Worklet now connected directly to destination.');
        console.log('[SynthEngine] If you hear sound NOW, the worklet output works.');
        console.log('[SynthEngine] Call audioCore.getSynth().restoreConnection() to restore normal routing.');
    }

    /**
     * DIAGNOSTIC: Restore normal worklet connection
     */
    public restoreConnection() {
        if (!this.workletNode) {
            console.error('[SynthEngine] No worklet node');
            return;
        }
        this.workletNode.disconnect();
        this.workletNode.connect(this.output);
        console.log('[SynthEngine] Restored normal worklet → output connection');
    }

    /**
     * DIAGNOSTIC: Enable test tone mode in main-processor worklet
     * This bypasses all graph logic and generates a simple sine wave
     */
    public setTestToneMode(enabled: boolean) {
        this.sendMessage({
            target: 'system',
            action: 'TEST_TONE_MODE',
            payload: enabled
        });
        console.log('[SynthEngine] Test tone mode:', enabled);
    }

    /**
     * DIAGNOSTIC: Enable simple graph mode in main-processor worklet
     * Uses graph oscillator but simplified output (no connection routing)
     */
    public setSimpleGraphMode(enabled: boolean) {
        this.sendMessage({
            target: 'system',
            action: 'SIMPLE_GRAPH_MODE',
            payload: enabled
        });
        console.log('[SynthEngine] Simple graph mode:', enabled);
    }

    /**
     * DIAGNOSTIC: Force simple audio generation in normal code path
     * Tests if the buffer reference works correctly past the mode checks
     */
    public setForceSimpleNormal(enabled: boolean) {
        this.sendMessage({
            target: 'system',
            action: 'FORCE_SIMPLE_NORMAL',
            payload: enabled
        });
        console.log('[SynthEngine] Force simple in normal path:', enabled);
    }

    /**
     * Mute/unmute the Graph Mode (SynthEngine) output
     */
    public setMuted(muted: boolean) {
        this.output.gain.value = muted ? 0 : 1;
        console.log('[SynthEngine] Muted:', muted);
    }
}
