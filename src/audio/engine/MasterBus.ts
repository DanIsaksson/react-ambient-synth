export class MasterBus {
    private context: AudioContext;
    private input: GainNode;
    private limiter: DynamicsCompressorNode;
    private output: GainNode;

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

    public setVolume(value: number) {
        this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
    }
}
