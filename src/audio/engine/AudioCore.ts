import { MasterBus } from './MasterBus';
import { AtmosphereEngine } from './AtmosphereEngine';
import { SynthEngine } from './SynthEngine';
import type { SoundScene } from '../scenes/SoundScene';

export class AudioCore {
    private context: AudioContext | null = null;
    private masterBus: MasterBus | null = null;
    private atmosphere: AtmosphereEngine | null = null;
    private synth: SynthEngine | null = null;
    private isInitialized: boolean = false;

    constructor() {
        // Lazy initialization on user interaction
    }

    public async init() {
        if (this.isInitialized) return;

        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();

        this.masterBus = new MasterBus(this.context);
        this.atmosphere = new AtmosphereEngine(this.context);
        this.synth = new SynthEngine(this.context);

        // Connect Engines to MasterBus
        this.atmosphere.connect(this.masterBus.getInputNode());
        this.synth.connect(this.masterBus.getInputNode());

        // Initialize Synth Engine (loads Worklet)
        await this.synth.init();

        this.isInitialized = true;
        console.log("AudioCore initialized");
    }

    public getContext(): AudioContext | null {
        return this.context;
    }

    public getMasterBus(): MasterBus | null {
        return this.masterBus;
    }

    public getAtmosphere(): AtmosphereEngine | null {
        return this.atmosphere;
    }

    public getSynth(): SynthEngine | null {
        return this.synth;
    }

    public async resume() {
        if (!this.isInitialized) await this.init();
        if (this.context?.state === 'suspended') {
            await this.context.resume();
        }
        this.atmosphere?.start();
    }

    public suspend() {
        if (this.context?.state === 'running') {
            this.context.suspend();
        }
        this.atmosphere?.stop();
    }

    public setScene(scene: SoundScene) {
        this.atmosphere?.setScene(scene);
    }
}

export const audioCore = new AudioCore();
