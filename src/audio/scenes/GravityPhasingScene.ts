import type { SoundScene } from './SoundScene';

interface PhysicsBody {
    y: number;
    velocity: number;
    gravity: number;
    restitution: number;
    name: string;
}

export class GravityPhasingScene implements SoundScene {
    name = "Gravity Phasing";
    private context: AudioContext | null = null;
    private destination: AudioNode | null = null;

    private isPlaying: boolean = false;
    private animationFrameId: number | null = null;

    // Physics State
    // Earth: Low gravity (slow), High restitution (bounces long)
    private earth: PhysicsBody = { y: 10, velocity: 0, gravity: 9.8, restitution: 0.85, name: 'Earth' };
    // Moon: High gravity (fast), Low restitution (bounces fast)
    private moon: PhysicsBody = { y: 10, velocity: 0, gravity: 15, restitution: 0.7, name: 'Moon' };

    // Simulation Time
    private lastFrameTime: number = 0;

    // Params
    private gravityMultiplier: number = 1.0; // pulseSpeed
    private restitutionMultiplier: number = 1.0; // pulseDepth

    setup(context: AudioContext, destination: AudioNode) {
        this.context = context;
        this.destination = destination;
        this.isPlaying = true;
        this.lastFrameTime = performance.now() / 1000;

        // Reset bodies with initial energy
        this.resetBody(this.earth);
        this.resetBody(this.moon);

        console.log("Gravity Scene Setup Complete. Starting Loop.");
        this.loop();
    }

    teardown() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log("Gravity Scene Teardown.");
    }

    setParam(param: string, value: number) {
        if (param === 'pulseSpeed') {
            // Map 0-1 to 0.5 - 2.0 gravity multiplier
            this.gravityMultiplier = 0.5 + (value * 1.5);
        } else if (param === 'pulseDepth') {
            // Map 0-1 to 0.8 - 1.1 restitution multiplier
            this.restitutionMultiplier = 0.8 + (value * 0.2);
        }
    }

    private loop() {
        if (!this.isPlaying) return;

        const currentTime = performance.now() / 1000;
        let dt = currentTime - this.lastFrameTime;

        // Cap dt to avoid huge jumps if tab was backgrounded
        if (dt > 0.1) dt = 0.1;

        this.lastFrameTime = currentTime;

        // Physics Tick
        this.tick(this.earth, dt);
        this.tick(this.moon, dt);

        this.animationFrameId = window.requestAnimationFrame(() => this.loop());
    }

    private tick(body: PhysicsBody, dt: number) {
        // Apply Gravity Multiplier
        const g = body.gravity * this.gravityMultiplier;

        // Euler Integration
        // Gravity pulls DOWN towards 0.
        body.velocity -= g * dt;
        body.y += body.velocity * dt;

        // Floor Impact
        if (body.y <= 0) {
            // Trigger Audio
            this.triggerSound(body);

            // Reflect
            let r = body.restitution * this.restitutionMultiplier;
            // Clamp r to < 1.0 to prevent infinite energy
            if (r > 0.99) r = 0.99;

            body.velocity = Math.abs(body.velocity) * r; // Ensure positive velocity
            body.y = 0;

            // Evolution / Auto-Reset
            // If velocity is very low (stopped bouncing), reset.
            if (Math.abs(body.velocity) < 1.0) {
                this.resetBody(body);
            }
        }
    }

    private resetBody(body: PhysicsBody) {
        // Random height between 5 and 15
        body.y = 5 + Math.random() * 10;
        body.velocity = 0;
    }

    private impacts: { x: number, time: number }[] = [];

    getVisualState() {
        // Filter old impacts
        const now = performance.now() / 1000;
        this.impacts = this.impacts.filter(i => now - i.time < 0.2); // Keep for 200ms

        return {
            bodies: [this.earth, this.moon],
            impacts: this.impacts
        };
    }

    private triggerSound(body: PhysicsBody) {
        if (!this.context || !this.destination) return;

        // Record impact for visuals
        this.impacts.push({ x: body.name === 'Earth' ? 0.33 : 0.66, time: performance.now() / 1000 });

        const t = this.context.currentTime;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        if (body.name === 'Earth') {
            // Bass Sine
            osc.type = 'sine';
            osc.frequency.setValueAtTime(60, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);

            gain.gain.setValueAtTime(0.6, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        } else {
            // Moon: Metallic Ping
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, t);

            // FM
            const mod = this.context.createOscillator();
            mod.frequency.value = 1200;
            const modGain = this.context.createGain();
            modGain.gain.value = 500;
            mod.connect(modGain);
            modGain.connect(osc.frequency);
            mod.start(t);
            mod.stop(t + 0.3);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        }

        osc.connect(gain);
        gain.connect(this.destination);
        osc.start(t);
        osc.stop(t + 1.0);
    }
}
