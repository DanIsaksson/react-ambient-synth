import type { SoundScene } from '../scenes/SoundScene';
import { BrownNoiseScene } from '../scenes/BrownNoiseScene';
import { DeepEndModule } from '../nodes/effects/DeepEndModule';
import { PulseModule } from '../nodes/sources/PulseModule';
import { XYDriftModule } from '../nodes/sources/XYDriftModule';
import { AtmosphereModule } from '../nodes/effects/AtmosphereModule';
import { LorenzChaosModule } from '../nodes/sources/LorenzChaosModule';

export class AtmosphereEngine {
    private context: AudioContext;
    private output: GainNode;
    private currentScene: SoundScene | null = null;
    private isPlaying: boolean = false;

    // Modules
    private deepEnd: DeepEndModule;
    private pulse: PulseModule;
    private xyDrift: XYDriftModule;
    private lorenz: LorenzChaosModule;
    private atmosphere: AtmosphereModule;

    // Chain Entry Point
    private chainInput: GainNode;

    constructor(context: AudioContext) {
        this.context = context;
        this.output = this.context.createGain();
        this.chainInput = this.context.createGain();

        // Initialize Modules
        this.deepEnd = new DeepEndModule(context);
        this.pulse = new PulseModule(context);
        this.xyDrift = new XYDriftModule(context);
        this.lorenz = new LorenzChaosModule(context);
        this.atmosphere = new AtmosphereModule(context);

        // Build Chain: Input -> DeepEnd -> Pulse -> XYDrift -> Lorenz -> Atmosphere -> Output
        this.chainInput.connect(this.deepEnd.input);
        this.deepEnd.output.connect(this.pulse.input);
        this.pulse.output.connect(this.xyDrift.input);
        this.xyDrift.output.connect(this.lorenz.input);
        this.lorenz.output.connect(this.atmosphere.input);
        this.atmosphere.output.connect(this.output);

        // Default Scene
        this.currentScene = new BrownNoiseScene();
    }

    public connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    public setScene(scene: SoundScene) {
        if (this.isPlaying) {
            this.currentScene?.teardown();
            this.currentScene = scene;
            // Connect Scene to Chain Input
            this.currentScene.setup(this.context, this.chainInput);
        } else {
            this.currentScene = scene;
        }
    }

    public start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        if (this.currentScene) {
            this.currentScene.setup(this.context, this.chainInput);
        }
    }

    public stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.currentScene) {
            this.currentScene.teardown();
        }
    }

    public setParam(param: string, value: number) {
        // Route parameters to specific modules
        switch (param) {
            case 'rumble':
                this.deepEnd.setParam('rumble', value);
                break;
            case 'pulseSpeed':
                this.pulse.setParam('speed', value);
                break;
            case 'pulseDepth':
                this.pulse.setParam('depth', value);
                break;
            case 'x':
                this.xyDrift.setParam('x', value);
                break;
            case 'y':
                this.xyDrift.setParam('y', value);
                break;
            case 'driftAuto':
                this.xyDrift.setParam('auto', value);
                break;
            case 'chaosSpeed':
                this.lorenz.setParam('chaosSpeed', value);
                break;
            case 'atmosphereMix':
                this.atmosphere.setParam('mix', value);
                break;
            default:
                // Pass to scene if not handled by modules
                if (this.currentScene && this.currentScene.setParam) {
                    this.currentScene.setParam(param, value);
                }
                break;
        }
    }
    public getCurrentScene(): SoundScene | null {
        return this.currentScene;
    }

    public getLorenzState() {
        return this.lorenz.getVisualState();
    }
}
