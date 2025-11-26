export class MasterBus {
    private context: AudioContext;
    private input: GainNode;
    private limiter: DynamicsCompressorNode;
    private output: GainNode;
    private recordingSendNode: GainNode | null = null;

    constructor(context: AudioContext) {
        this.context = context;

        // Input Node (where engines connect)
        this.input = this.context.createGain();

        // Limiter (Compressor with high ratio)
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.value = -1.0;
        this.limiter.knee.value = 0.0;
        this.limiter.ratio.value = 20.0; // High ratio for limiting
        this.limiter.attack.value = 0.005;
        this.limiter.release.value = 0.050;

        // Output Node (Master Volume)
        this.output = this.context.createGain();
        this.output.gain.value = 0.8; // Default volume

        // Connect Chain
        this.input.connect(this.limiter);
        this.limiter.connect(this.output);
        this.output.connect(this.context.destination);
        
        console.log('[MasterBus] Chain connected: input → limiter → output → destination');
        console.log('[MasterBus] Output gain:', this.output.gain.value, 'Input gain:', this.input.gain.value);
    }

    public getInputNode(): AudioNode {
        return this.input;
    }

    /**
     * Get the output node for connecting recording or analysis chains.
     * This is after the limiter but before final gain, capturing the mixed audio.
     */
    public getOutputNode(): GainNode {
        return this.output;
    }

    /**
     * Connect a recording destination to the output.
     * Creates a parallel send so recording captures same audio as speakers.
     */
    public connectRecordingDestination(destinationInput: AudioNode): void {
        // Create a send node if not exists
        if (!this.recordingSendNode) {
            this.recordingSendNode = this.context.createGain();
            this.recordingSendNode.gain.value = 1.0;
            // Tap from after the limiter (output node)
            this.output.connect(this.recordingSendNode);
        }
        
        // Connect to the recording destination
        this.recordingSendNode.connect(destinationInput);
        console.log('[MasterBus] Recording destination connected');
    }

    /**
     * Disconnect recording destination.
     */
    public disconnectRecordingDestination(destinationInput: AudioNode): void {
        if (this.recordingSendNode) {
            try {
                this.recordingSendNode.disconnect(destinationInput);
                console.log('[MasterBus] Recording destination disconnected');
            } catch (e) {
                // Already disconnected
            }
        }
    }

    public setVolume(value: number) {
        this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
    }

    public getContext(): AudioContext {
        return this.context;
    }
}
