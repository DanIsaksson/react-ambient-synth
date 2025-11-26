import type { AudioMessage } from '../types';

// Callback type for sample trigger events from the worklet
type SampleTriggerCallback = (nodeId: string, sampleId?: string) => void;

// Timestamped message for queue TTL management
interface TimestampedMessage {
    message: AudioMessage | any;
    timestamp: number;
}

export class SynthEngine {
    private context: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private output: GainNode;
    private pendingMessages: TimestampedMessage[] = [];
    
    // Message queue constraints (P1 robustness)
    private readonly MAX_QUEUE_SIZE = 100;
    private readonly MESSAGE_TTL_MS = 5000;
    
    // Worklet health monitoring
    private lastHeartbeat: number = 0;
    private heartbeatCheckInterval: number | null = null;
    private readonly HEARTBEAT_TIMEOUT_MS = 5000;
    private onSampleTrigger: SampleTriggerCallback | null = null;

    constructor(context: AudioContext) {
        this.context = context;
        this.output = this.context.createGain();
    }

    /**
     * Set callback for when worklet triggers a sample node.
     * This bridges the worklet → main thread → SampleEngine communication.
     */
    public setOnSampleTrigger(callback: SampleTriggerCallback): void {
        this.onSampleTrigger = callback;
    }

    public async init() {
        try {
            // We assume the worklet file is at the correct path relative to the public root or built assets
            // Note: In Vite, we might need to handle this differently, but for now using the same pattern as before
            await this.context.audioWorklet.addModule(new URL('../worklets/main-processor.js', import.meta.url).href);
            this.workletNode = new AudioWorkletNode(this.context, 'main-processor');
            this.workletNode.connect(this.output);
            
            // Listen for messages from worklet (e.g., sample triggers, heartbeats)
            this.workletNode.port.onmessage = (event) => {
                const data = event.data;
                
                // Handle heartbeat from worklet
                if (data.type === 'HEARTBEAT') {
                    this.lastHeartbeat = Date.now();
                    return;
                }
                
                if (data.type === 'SAMPLE_TRIGGER' && this.onSampleTrigger) {
                    this.onSampleTrigger(data.nodeId, data.sampleId);
                }
            };
            
            // Start health monitoring
            this.setupHealthMonitoring();
            
            console.log("SynthEngine: AudioWorklet loaded successfully");
            
            // Flush any messages that arrived before worklet was ready
            this.flushPendingMessages();
        } catch (e) {
            console.error("SynthEngine: Failed to load AudioWorklet:", e);
        }
    }

    /**
     * Flushes queued messages that arrived before the worklet was ready.
     * Filters out stale messages beyond TTL.
     * Called automatically at end of init().
     */
    private flushPendingMessages(): void {
        if (!this.workletNode || this.pendingMessages.length === 0) return;
        
        const now = Date.now();
        let staleCount = 0;
        let sentCount = 0;
        
        for (const { message, timestamp } of this.pendingMessages) {
            // Skip stale messages
            if (now - timestamp > this.MESSAGE_TTL_MS) {
                staleCount++;
                continue;
            }
            this.workletNode.port.postMessage(message);
            sentCount++;
        }
        
        if (staleCount > 0) {
            console.warn(`[SynthEngine] Dropped ${staleCount} stale messages (TTL exceeded)`);
        }
        if (sentCount > 0) {
            console.log(`[SynthEngine] Flushed ${sentCount} queued messages`);
        }
        
        this.pendingMessages = [];
    }
    
    /**
     * Setup worklet health monitoring via heartbeat.
     * Detects if worklet has stalled and logs warning.
     */
    private setupHealthMonitoring(): void {
        this.lastHeartbeat = Date.now();
        
        // Check heartbeat every 2 seconds
        this.heartbeatCheckInterval = window.setInterval(() => {
            const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;
            
            if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT_MS) {
                console.error(
                    `[SynthEngine] Worklet heartbeat timeout (${timeSinceHeartbeat}ms since last heartbeat)`
                );
                // Don't auto-recover - just log for now. Recovery could cause audio glitches.
                // Future: emit event for UI to offer recovery option
            }
        }, 2000) as unknown as number;
    }

    public connect(destination: AudioNode) {
        this.output.connect(destination);
        console.log('[SynthEngine] Connected to destination. Output gain:', this.output.gain.value);
    }

    public sendMessage(message: AudioMessage | any): void {
        if (this.workletNode) {
            this.workletNode.port.postMessage(message);
        } else {
            // Queue message with timestamp for TTL management
            if (this.pendingMessages.length >= this.MAX_QUEUE_SIZE) {
                // Drop oldest message to make room
                const dropped = this.pendingMessages.shift();
                console.warn(
                    `[SynthEngine] Message queue full (${this.MAX_QUEUE_SIZE}), dropped oldest message:`,
                    dropped?.message?.action
                );
            }
            
            this.pendingMessages.push({
                message,
                timestamp: Date.now(),
            });
            
            // Only log occasionally to avoid console spam
            if (this.pendingMessages.length === 1 || this.pendingMessages.length % 10 === 0) {
                console.log(`[SynthEngine] Message queued (${this.pendingMessages.length} pending, worklet loading...)`);
            }
        }
    }

    /**
     * Send sample buffer to worklet for granular texture processing.
     * Transfers Float32Array data to the worklet for a specific node.
     */
    public loadSampleBuffer(nodeId: string, buffer: Float32Array, bufferSampleRate: number): void {
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                target: 'system',
                action: 'LOAD_SAMPLE_BUFFER',
                payload: {
                    nodeId,
                    buffer: Array.from(buffer), // Convert to regular array for transfer
                    sampleRate: bufferSampleRate,
                },
            });
            console.log(`[SynthEngine] Sent sample buffer for node ${nodeId}, length: ${buffer.length}`);
        } else {
            console.warn('[SynthEngine] Cannot load sample buffer: worklet not ready');
        }
    }

    /**
     * Cleanup: disconnect worklet, clear pending messages, stop health monitoring.
     */
    public dispose(): void {
        // Stop health monitoring
        if (this.heartbeatCheckInterval !== null) {
            clearInterval(this.heartbeatCheckInterval);
            this.heartbeatCheckInterval = null;
        }
        
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        this.pendingMessages = [];
        console.log('[SynthEngine] Disposed');
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
