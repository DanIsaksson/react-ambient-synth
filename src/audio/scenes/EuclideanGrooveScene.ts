import type { SoundScene } from './SoundScene';

interface BresenhamGenerator {
    steps: number;
    pulses: number;
    error: number;
    currentStep: number;
    pattern: number[];
}

export class EuclideanGrooveScene implements SoundScene {
    name = "Euclidean Groove";
    private context: AudioContext | null = null;
    private destination: AudioNode | null = null;

    // Scheduler
    private isPlaying: boolean = false;
    private lookaheadInterval: number | null = null;
    private nextNoteTime: number = 0;
    private scheduleAheadTime: number = 0.1; // 100ms
    private lookaheadMs: number = 25; // 25ms

    // Generators
    private kickGen: BresenhamGenerator = { steps: 16, pulses: 4, error: 8, currentStep: 0, pattern: [] }; // E(4,16)
    private hatGen: BresenhamGenerator = { steps: 8, pulses: 3, error: 4, currentStep: 0, pattern: [] };   // E(3,8)

    // Params
    private tempo: number = 120;
    private tension: number = 0.1; // Controls decay

    setup(context: AudioContext, destination: AudioNode) {
        this.context = context;
        this.destination = destination;
        this.isPlaying = true;
        this.nextNoteTime = context.currentTime + 0.1;

        // Calculate initial patterns
        this.calculatePattern(this.kickGen);
        this.calculatePattern(this.hatGen);

        this.lookaheadInterval = window.setInterval(() => {
            this.scheduler();
        }, this.lookaheadMs);
    }

    teardown() {
        this.isPlaying = false;
        if (this.lookaheadInterval) {
            clearInterval(this.lookaheadInterval);
            this.lookaheadInterval = null;
        }
    }

    setParam(param: string, value: number) {
        if (param === 'density') {
            // Map 0-1 to 1-8 pulses
            const pulses = Math.floor(1 + value * 7);
            if (this.hatGen.pulses !== pulses) {
                this.hatGen.pulses = pulses;
                this.calculatePattern(this.hatGen);
            }
        } else if (param === 'tension') {
            // Map 0-1 to 0.05 - 0.5 decay
            this.tension = 0.05 + (value * 0.45);
        } else if (param === 'pulseSpeed') {
            // Map 0-1 to 60-180 BPM (also connects to Rhythm panel)
            this.tempo = 60 + (value * 120);
        } else if (param === 'pulseDepth') {
            // Map to kick density (0-1 to 2-8 pulses)
            const kickPulses = Math.floor(2 + value * 6);
            if (this.kickGen.pulses !== kickPulses) {
                this.kickGen.pulses = kickPulses;
                this.calculatePattern(this.kickGen);
            }
        }
    }

    private scheduler() {
        if (!this.context || !this.isPlaying) return;

        const now = this.context.currentTime;

        // Drift compensation: if we've fallen too far behind, resync
        // This prevents catch-up bursts after tab backgrounding or CPU spikes
        if (now - this.nextNoteTime > 0.5) {
            console.warn('[EuclideanGroove] Timing drift detected, resyncing');
            this.nextNoteTime = now + 0.05;
        }

        // While there are notes that will need to play before the next interval,
        // schedule them and advance the pointer.
        while (this.nextNoteTime < now + this.scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime);
            this.nextStep();
        }
    }

    private nextStep() {
        const secondsPerBeat = 60.0 / this.tempo;
        const sixteenthNoteTime = secondsPerBeat / 4; // 16th notes
        this.nextNoteTime += sixteenthNoteTime;
    }

    private scheduleNote(time: number) {
        if (!this.context || !this.destination) return;

        // Kick Logic (Bresenham)
        if (this.tick(this.kickGen)) {
            this.playKick(time);
        }

        // Hat Logic (Bresenham)
        if (this.tick(this.hatGen)) {
            this.playHat(time);
        }
    }

    // The Core Bresenham Logic
    private tick(gen: BresenhamGenerator): boolean {
        // Advance step
        gen.currentStep = (gen.currentStep + 1) % gen.steps;

        // Use pre-calculated pattern for consistency
        return gen.pattern[gen.currentStep] === 1;
    }

    private calculatePattern(gen: BresenhamGenerator) {
        gen.pattern = [];
        let error = gen.steps / 2; // Initial error
        for (let i = 0; i < gen.steps; i++) {
            error -= gen.pulses;
            if (error < 0) {
                gen.pattern.push(1);
                error += gen.steps;
            } else {
                gen.pattern.push(0);
            }
        }
    }

    private playKick(time: number) {
        if (!this.context || !this.destination) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

        osc.connect(gain);
        gain.connect(this.destination);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    private playHat(time: number) {
        if (!this.context || !this.destination) return;

        // Noise Burst
        const bufferSize = this.context.sampleRate * 0.1; // 0.1s buffer
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        // Bandpass Filter for "Hat" sound
        const filter = this.context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.context.createGain();
        // Use tension param for decay
        const decay = this.tension;

        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.destination);

        noise.start(time);
        noise.stop(time + decay);
    }

    getVisualState() {
        return {
            kick: {
                steps: this.kickGen.steps,
                pulses: this.kickGen.pulses,
                currentStep: this.kickGen.currentStep,
                pattern: this.kickGen.pattern
            },
            hat: {
                steps: this.hatGen.steps,
                pulses: this.hatGen.pulses,
                currentStep: this.hatGen.currentStep,
                pattern: this.hatGen.pattern
            }
        };
    }
}
