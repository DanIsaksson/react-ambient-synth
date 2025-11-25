import type { AudioModule } from '../core/AudioModule';

export class DeepEndModule implements AudioModule {
    input: GainNode;
    output: GainNode;
    private filter: BiquadFilterNode;
    private context: AudioContext;

    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.filter = context.createBiquadFilter();

        this.filter.type = 'lowshelf';
        this.filter.frequency.value = 80; // Sub-bass range
        this.filter.gain.value = 0; // Default 0dB boost

        this.input.connect(this.filter);
        this.filter.connect(this.output);
    }

    connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    setParam(param: string, value: number) {
        if (param === 'rumble') {
            // Map 0-1 to 0dB - 15dB
            this.filter.gain.setTargetAtTime(value * 15, this.context.currentTime, 0.1);
        }
    }
}
