import type { AudioModule } from '../core/AudioModule';

export class XYDriftModule implements AudioModule {
    input: GainNode;
    output: GainNode;
    private panner: StereoPannerNode;
    private filter: BiquadFilterNode;
    private context: AudioContext;

    // Auto-Drift LFOs
    private xLfo: OscillatorNode | null = null;
    private yLfo: OscillatorNode | null = null;
    private xLfoGain: GainNode;
    private yLfoGain: GainNode;
    private isAuto: boolean = false;

    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();

        this.panner = context.createStereoPanner();
        this.filter = context.createBiquadFilter();

        this.filter.type = 'lowpass';
        this.filter.frequency.value = 1000; // Default center

        // LFO setup for automation
        this.xLfoGain = context.createGain();
        this.yLfoGain = context.createGain();
        this.xLfoGain.gain.value = 0;
        this.yLfoGain.gain.value = 0;

        // Chain: Input -> Filter -> Panner -> Output
        this.input.connect(this.filter);
        this.filter.connect(this.panner);
        this.panner.connect(this.output);

        this.startLFOs();
    }

    private startLFOs() {
        this.xLfo = this.context.createOscillator();
        this.yLfo = this.context.createOscillator();

        this.xLfo.frequency.value = 0.1; // Slow drift
        this.yLfo.frequency.value = 0.13; // Slightly different to create non-looping patterns

        // Connect LFOs
        // X LFO -> Panner Pan
        this.xLfo.connect(this.xLfoGain);
        this.xLfoGain.connect(this.panner.pan);

        // Y LFO -> Filter Frequency
        // This is tricky because frequency is exponential. 
        // We'll just modulate it linearly for simplicity or map it.
        // Actually, let's just modulate a gain node that connects to frequency?
        // Frequency parameter is AudioParam.
        // Let's just keep it simple: LFO -> Gain(Scale) -> Frequency.detune? Or Frequency directly.
        // Frequency value is large (100-10000). LFO is -1..1.
        // We need a huge gain for the LFO to affect frequency visibly.

        const filterModGain = this.context.createGain();
        filterModGain.gain.value = 2000; // +/- 2000Hz

        this.yLfo.connect(this.yLfoGain);
        this.yLfoGain.connect(filterModGain);
        filterModGain.connect(this.filter.frequency);

        this.xLfo.start();
        this.yLfo.start();
    }

    connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    setParam(param: string, value: number) {
        if (param === 'x') {
            // Pan: -1 to 1
            if (!this.isAuto) {
                this.panner.pan.setTargetAtTime(value, this.context.currentTime, 0.1);
            }
        } else if (param === 'y') {
            // Filter: 100 to 10000Hz
            if (!this.isAuto) {
                const minFreq = 100;
                const maxFreq = 10000;
                const frequency = minFreq * Math.pow(maxFreq / minFreq, value);
                this.filter.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.1);
            }
        } else if (param === 'auto') {
            this.isAuto = value > 0.5;
            // If auto, enable LFO gains
            const targetGain = this.isAuto ? 1 : 0;
            this.xLfoGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 1.0);
            this.yLfoGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 1.0);
        }
    }
}
