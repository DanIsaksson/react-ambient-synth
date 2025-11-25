import type { SoundScene } from './SoundScene';

export class HangarStormScene implements SoundScene {
    name = "Hangar Storm";
    private rumbleNode: AudioBufferSourceNode | null = null;
    private windNode: AudioBufferSourceNode | null = null;
    private windFilter: BiquadFilterNode | null = null;
    private windLfo: OscillatorNode | null = null;
    private context: AudioContext | null = null;
    private destination: AudioNode | null = null;
    private creakTimeout: number | null = null;

    // Params
    private windCreakBalance: number = 0.3; // atmosphereMix

    setup(context: AudioContext, destination: AudioNode) {
        this.context = context;
        this.destination = destination;

        // Rumble (Brown Noise) - Outside Storm
        this.rumbleNode = context.createBufferSource();
        this.rumbleNode.buffer = this.createBrownNoiseBuffer(context);
        this.rumbleNode.loop = true;

        const rumbleGain = context.createGain();
        rumbleGain.gain.value = 0.6;
        this.rumbleNode.connect(rumbleGain);
        rumbleGain.connect(destination);

        // Wind (Filtered White Noise) - Whistling
        this.windNode = context.createBufferSource();
        this.windNode.buffer = this.createWhiteNoiseBuffer(context);
        this.windNode.loop = true;

        this.windFilter = context.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.Q.value = 8; // Sharp resonance

        // LFO for wind frequency
        this.windLfo = context.createOscillator();
        this.windLfo.type = 'sine';
        this.windLfo.frequency.value = 0.15;

        const lfoGain = context.createGain();
        lfoGain.gain.value = 300;

        this.windFilter.frequency.value = 500;

        this.windLfo.connect(lfoGain);
        lfoGain.connect(this.windFilter.frequency);

        const windGain = context.createGain();
        windGain.gain.value = 0.1 + (this.windCreakBalance * 0.2); // Modulated by param

        this.windNode.connect(this.windFilter);
        this.windFilter.connect(windGain);
        windGain.connect(destination);

        this.rumbleNode.start();
        this.windNode.start();
        this.windLfo.start();

        this.scheduleCreak();
    }

    teardown() {
        if (this.rumbleNode) {
            this.rumbleNode.stop();
            this.rumbleNode.disconnect();
        }
        if (this.windNode) {
            this.windNode.stop();
            this.windNode.disconnect();
        }
        if (this.windLfo) {
            this.windLfo.stop();
            this.windLfo.disconnect();
        }
        if (this.creakTimeout) {
            clearTimeout(this.creakTimeout);
        }
    }

    setParam(param: string, value: number) {
        if (param === 'atmosphereMix') {
            this.windCreakBalance = value;
        }
    }

    private scheduleCreak() {
        // Creaks happen more often if balance is high? Or just louder?
        // Let's make them random
        const delay = Math.random() * 5000 + 2000;
        this.creakTimeout = window.setTimeout(() => {
            this.triggerCreak();
            this.scheduleCreak();
        }, delay);
    }

    private triggerCreak() {
        if (!this.context || !this.destination) return;

        // Metallic Creak: FM Synthesis
        // Carrier: Low Sine, Modulator: Low Sine with high index
        const t = this.context.currentTime;
        const duration = 1.5;

        const carrier = this.context.createOscillator();
        const modulator = this.context.createOscillator();
        const modGain = this.context.createGain();
        const masterGain = this.context.createGain();

        carrier.frequency.value = 80 + Math.random() * 50;
        modulator.frequency.value = 40 + Math.random() * 20;

        modGain.gain.value = 200; // FM Index

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        carrier.connect(masterGain);
        masterGain.connect(this.destination);

        masterGain.gain.setValueAtTime(0, t);
        masterGain.gain.linearRampToValueAtTime(0.1 * this.windCreakBalance, t + 0.5);
        masterGain.gain.linearRampToValueAtTime(0, t + duration);

        carrier.start(t);
        modulator.start(t);
        carrier.stop(t + duration);
        modulator.stop(t + duration);
    }

    private createBrownNoiseBuffer(context: AudioContext): AudioBuffer {
        const bufferSize = context.sampleRate * 5;
        const buffer = context.createBuffer(2, bufferSize, context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5;
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
