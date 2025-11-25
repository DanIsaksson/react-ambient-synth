import type { AudioModule } from '../core/AudioModule';

export class AtmosphereModule implements AudioModule {
    input: GainNode;
    output: GainNode;
    private convolver: ConvolverNode;
    private wetGain: GainNode;
    private dryGain: GainNode;
    private context: AudioContext;

    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.convolver = context.createConvolver();

        this.wetGain = context.createGain();
        this.dryGain = context.createGain();

        // Create synthetic impulse response
        this.convolver.buffer = this.createImpulseResponse();

        // Routing
        // Input -> Dry -> Output
        // Input -> Convolver -> Wet -> Output
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);

        this.input.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.output);

        this.wetGain.gain.value = 0; // Default 0% wet
        this.dryGain.gain.value = 1;
    }

    private createImpulseResponse(): AudioBuffer {
        const rate = this.context.sampleRate;
        const length = rate * 3; // 3 seconds tail
        const decay = 2.0;
        const impulse = this.context.createBuffer(2, length, rate);

        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay noise
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }

        return impulse;
    }

    connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    setParam(param: string, value: number) {
        if (param === 'mix') {
            // Crossfade Dry/Wet
            this.wetGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
            this.dryGain.gain.setTargetAtTime(1 - (value * 0.5), this.context.currentTime, 0.1);
        }
    }
}
