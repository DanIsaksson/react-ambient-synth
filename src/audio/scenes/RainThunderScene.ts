import type { SoundScene } from './SoundScene';

export class RainThunderScene implements SoundScene {
    name = "Rain & Thunder";
    private rainNode: AudioBufferSourceNode | null = null;
    private thunderGain: GainNode | null = null;
    private context: AudioContext | null = null;
    private thunderTimeout: number | null = null;

    // Params
    private thunderIntensity: number = 0.5; // Mapped from 'rumble'

    setup(context: AudioContext, destination: AudioNode) {
        this.context = context;

        // Rain (Pink Noise)
        this.rainNode = context.createBufferSource();
        this.rainNode.buffer = this.createPinkNoiseBuffer(context);
        this.rainNode.loop = true;

        // Thunder System
        this.thunderGain = context.createGain();
        this.thunderGain.connect(destination);

        this.rainNode.connect(destination);
        this.rainNode.start();

        this.scheduleThunder();
    }

    teardown() {
        if (this.rainNode) {
            this.rainNode.stop();
            this.rainNode.disconnect();
        }
        if (this.thunderGain) {
            this.thunderGain.disconnect();
        }
        if (this.thunderTimeout) {
            clearTimeout(this.thunderTimeout);
        }
    }

    setParam(param: string, value: number) {
        if (param === 'rumble') {
            this.thunderIntensity = value;
        }
    }

    private createPinkNoiseBuffer(context: AudioContext): AudioBuffer {
        const bufferSize = context.sampleRate * 5;
        const buffer = context.createBuffer(2, bufferSize, context.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11;
                b6 = white * 0.115926;
            }
        }
        return buffer;
    }

    private scheduleThunder() {
        if (!this.context || !this.thunderGain) return;

        // Intensity affects frequency of thunder
        // Low intensity: 10-20s, High intensity: 3-8s
        const minDelay = 3000 + (1 - this.thunderIntensity) * 7000;
        const maxDelay = 8000 + (1 - this.thunderIntensity) * 12000;
        const delay = Math.random() * (maxDelay - minDelay) + minDelay;

        this.thunderTimeout = window.setTimeout(() => {
            this.triggerThunder();
            this.scheduleThunder();
        }, delay);
    }

    private triggerThunder() {
        if (!this.context || !this.thunderGain) return;

        // Complex Thunder Synthesis
        // 1. Low Rumble (Filtered Noise)
        // 2. Crack (High pass burst)

        const t = this.context.currentTime;
        const duration = 2.0 + Math.random() * 2.0;

        // Source: White Noise for texture
        const bufferSize = this.context.sampleRate * duration;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        // Filter: Lowpass sweep to simulate distance/rolling
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + duration);

        // Gain Envelope: Attack -> Decay
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(1 * this.thunderIntensity, t + 0.1); // Sharp attack
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.thunderGain);

        noise.start(t);
        noise.stop(t + duration);
    }
}
