import type { AudioModule } from '../core/AudioModule';

export class LorenzChaosModule implements AudioModule {
    name = "Lorenz Chaos";
    input: AudioNode;
    output: AudioNode;

    private context: AudioContext;
    private panner: StereoPannerNode;
    private filter: BiquadFilterNode;

    // Lorenz State
    private x: number = 0.1;
    private y: number = 0;
    private z: number = 0;

    // Parameters
    private sigma: number = 10;
    private rho: number = 28;
    private beta: number = 8 / 3;
    private dt: number = 0.01; // Speed of chaos

    private animationFrameId: number | null = null;

    constructor(context: AudioContext) {
        this.context = context;

        // Create Nodes
        this.input = context.createGain();
        this.panner = context.createStereoPanner();
        this.filter = context.createBiquadFilter();
        this.output = context.createGain();

        // Configure Filter
        this.filter.type = 'lowpass';
        this.filter.Q.value = 5; // Resonance for effect

        // Connect Chain: Input -> Panner -> Filter -> Output
        this.input.connect(this.panner);
        this.panner.connect(this.filter);
        this.filter.connect(this.output);

        // Start the chaos loop
        this.startChaosLoop();
    }

    connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    setParam(param: string, value: number) {
        if (param === 'chaosSpeed') {
            // Map 0-1 to 0.001 - 0.05
            this.dt = 0.001 + (value * 0.049);
        }
    }

    private startChaosLoop() {
        const loop = () => {
            this.updateLorenz();
            this.applyModulation();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    private updateLorenz() {
        // Euler Integration
        const dx = (this.sigma * (this.y - this.x)) * this.dt;
        const dy = (this.x * (this.rho - this.z) - this.y) * this.dt;
        const dz = (this.x * this.y - this.beta * this.z) * this.dt;

        this.x += dx;
        this.y += dy;
        this.z += dz;
    }

    private applyModulation() {
        // Map x (-20 to 20) to Pan (-1 to 1)
        // Clamp to be safe
        let pan = this.x / 20;
        pan = Math.max(-1, Math.min(1, pan));

        // Map z (0 to 50) to Filter Frequency (200Hz to 2000Hz)
        // z usually fluctuates around 20-30
        let freq = 200 + (this.z * 40);
        freq = Math.max(50, Math.min(20000, freq));

        // Apply to nodes
        // Use setTargetAtTime for smooth transitions, but since we are running per frame, 
        // direct assignment or very short ramp is fine.
        const t = this.context.currentTime;
        this.panner.pan.setTargetAtTime(pan, t, 0.01);
        this.filter.frequency.setTargetAtTime(freq, t, 0.01);
    }

    // Cleanup if needed (not strictly in interface but good practice)
    dispose() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    getVisualState() {
        return {
            x: this.x,
            y: this.y,
            z: this.z
        };
    }
}
