import type { SoundScene } from './SoundScene';

export class Dungeon8BitScene implements SoundScene {
    name = "8-bit Dungeon";
    private droneOsc: OscillatorNode | null = null;
    private droneGain: GainNode | null = null;
    private context: AudioContext | null = null;
    private destination: AudioNode | null = null;
    private sequenceTimeout: number | null = null;

    // Params
    private sequenceRate: number = 0.5; // pulseSpeed
    private sequenceDensity: number = 0.2; // pulseDepth
    private droneVolume: number = 0.5; // rumble

    setup(context: AudioContext, destination: AudioNode) {
        this.context = context;
        this.destination = destination;

        // Drone (Bass)
        this.droneOsc = context.createOscillator();
        this.droneOsc.type = 'triangle';
        this.droneOsc.frequency.value = 55; // Low A

        // Add subtle LFO to drone for movement
        const lfo = context.createOscillator();
        lfo.frequency.value = 0.1;
        const lfoGain = context.createGain();
        lfoGain.gain.value = 2; // +/- 2Hz
        lfo.connect(lfoGain);
        lfoGain.connect(this.droneOsc.frequency);
        lfo.start();

        this.droneGain = context.createGain();
        this.droneGain.gain.value = this.droneVolume * 0.3;

        this.droneOsc.connect(this.droneGain);
        this.droneGain.connect(destination);
        this.droneOsc.start();

        this.scheduleSequence();
    }

    teardown() {
        if (this.droneOsc) {
            this.droneOsc.stop();
            this.droneOsc.disconnect();
        }
        if (this.droneGain) {
            this.droneGain.disconnect();
        }
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
        }
    }

    setParam(param: string, value: number) {
        if (param === 'pulseSpeed') {
            this.sequenceRate = value; // 0 to 1
        } else if (param === 'pulseDepth') {
            this.sequenceDensity = value; // 0 to 1
        } else if (param === 'rumble') {
            this.droneVolume = value;
            if (this.droneGain) {
                this.droneGain.gain.setTargetAtTime(this.droneVolume * 0.3, this.context?.currentTime || 0, 0.1);
            }
        }
    }

    private scheduleSequence() {
        // Rate: 0.5 = 500ms, 1.0 = 100ms, 0.0 = 2000ms
        const interval = 2000 - (this.sequenceRate * 1900);

        this.sequenceTimeout = window.setTimeout(() => {
            this.triggerStep();
            this.scheduleSequence();
        }, interval);
    }

    private triggerStep() {
        if (!this.context || !this.destination) return;

        // Probabilistic Step
        if (Math.random() > this.sequenceDensity) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'square';
        // Pentatonic Scale: A Minor (A, C, D, E, G)
        const scale = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25];
        const note = scale[Math.floor(Math.random() * scale.length)];

        osc.frequency.value = note;

        // Short envelope
        const t = this.context.currentTime;
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(this.destination);

        osc.start(t);
        osc.stop(t + 0.2);
    }
}
