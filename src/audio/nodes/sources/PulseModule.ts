import type { AudioModule } from '../core/AudioModule';

export class PulseModule implements AudioModule {
    input: GainNode;
    output: GainNode;
    private lfo: OscillatorNode | null = null;
    private lfoGain: GainNode;
    private depthNode: GainNode;
    private context: AudioContext;

    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();

        // LFO setup
        // We need to modulate the gain of the input signal.
        // Signal Flow: Input -> ModulatedGain -> Output
        // LFO -> DepthNode -> ModulatedGain.gain

        this.depthNode = context.createGain();
        this.depthNode.gain.value = 0; // Default depth 0

        // We connect input directly to output, but we will modulate input.gain?
        // No, we need a dedicated gain node for modulation.
        const modGain = context.createGain();
        this.input.connect(modGain);
        modGain.connect(this.output);

        // LFO connects to modGain.gain
        // But modGain.gain needs a base value (e.g. 1.0) and LFO adds/subtracts.
        // Or we can use a specific structure.
        // Let's keep it simple: LFO (0..1) -> Gain.

        // Better approach for Tremolo:
        // LFO (-1..1) -> Scale(0..1) -> GainNode.gain

        this.lfoGain = modGain;

        this.startLFO();
    }

    private startLFO() {
        this.lfo = this.context.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 0.5; // Default speed

        // Scale LFO output to control gain depth
        this.lfo.connect(this.depthNode);
        this.depthNode.connect(this.lfoGain.gain);

        this.lfo.start();
    }

    connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    setParam(param: string, value: number) {
        if (param === 'speed') {
            // 0.1Hz to 5Hz
            const speed = 0.1 + (value * 4.9);
            if (this.lfo) {
                this.lfo.frequency.setTargetAtTime(speed, this.context.currentTime, 0.1);
            }
        } else if (param === 'depth') {
            // 0 to 0.5 (so gain oscillates 1.0 +/- 0.5)
            this.depthNode.gain.setTargetAtTime(value * 0.5, this.context.currentTime, 0.1);
        }
    }
}
