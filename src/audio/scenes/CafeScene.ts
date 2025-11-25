import type { SoundScene } from './SoundScene';

export class CafeScene implements SoundScene {
    name = "Cafe";
    private ventNode: AudioBufferSourceNode | null = null;
    private babbleNodes: AudioNode[] = [];
    private context: AudioContext | null = null;
    private destination: AudioNode | null = null;

    // Params
    private babbleVolume: number = 0.3; // atmosphereMix

    setup(context: AudioContext, destination: AudioNode) {
        this.context = context;
        this.destination = destination;

        // Ventilation (Steady Broadband Fan)
        // White noise lowpassed
        this.ventNode = context.createBufferSource();
        this.ventNode.buffer = this.createWhiteNoiseBuffer(context);
        this.ventNode.loop = true;

        const ventFilter = context.createBiquadFilter();
        ventFilter.type = 'lowpass';
        ventFilter.frequency.value = 150; // Lower rumble

        const ventGain = context.createGain();
        ventGain.gain.value = 0.25;

        this.ventNode.connect(ventFilter);
        ventFilter.connect(ventGain);
        ventGain.connect(destination);
        this.ventNode.start();

        this.setupBabble();
    }

    teardown() {
        if (this.ventNode) {
            this.ventNode.stop();
            this.ventNode.disconnect();
        }
        this.babbleNodes.forEach(node => {
            if (node instanceof AudioBufferSourceNode || node instanceof OscillatorNode) {
                node.stop();
            }
            node.disconnect();
        });
        this.babbleNodes = [];
    }

    setParam(param: string, value: number) {
        if (param === 'atmosphereMix') {
            this.babbleVolume = value;
            // Update babble gain if possible, but we have a complex graph.
            // For simplicity, we'll just let it apply on next setup or we could store the master gain.
            // Let's store the master gain.
        }
    }

    private setupBabble() {
        if (!this.context || !this.destination) return;

        // Crowd Babble Synthesis
        // Source: Pink Noise
        const noise = this.context.createBufferSource();
        noise.buffer = this.createPinkNoiseBuffer(this.context);
        noise.loop = true;

        const masterBabbleGain = this.context.createGain();
        masterBabbleGain.gain.value = this.babbleVolume;
        masterBabbleGain.connect(this.destination);

        // Formant Filters (Vowels: A, E, I, O, U approx)
        // We modulate their gain to simulate different voices speaking
        const formants = [
            { f: 700, q: 5 },
            { f: 1200, q: 5 },
            { f: 2200, q: 8 },
            { f: 400, q: 4 }
        ];

        formants.forEach(fmt => {
            if (!this.context) return;

            const filter = this.context.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = fmt.f;
            filter.Q.value = fmt.q;

            const gain = this.context.createGain();
            gain.gain.value = 0;

            // LFO to modulate volume (Speech envelope)
            const lfo = this.context.createOscillator();
            lfo.frequency.value = Math.random() * 3 + 1; // 1-4Hz (syllable rate)

            const lfoGain = this.context.createGain();
            lfoGain.gain.value = 0.5;

            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(masterBabbleGain);

            lfo.start();
            this.babbleNodes.push(lfo, lfoGain, filter, gain);
        });

        noise.start();
        this.babbleNodes.push(noise, masterBabbleGain);
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

    private createWhiteNoiseBuffer(context: AudioContext): AudioBuffer {
        const bufferSize = context.sampleRate * 5;
        const buffer = context.createBuffer(2, bufferSize, context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        return buffer;
    }
}
