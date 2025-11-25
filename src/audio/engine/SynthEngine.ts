import type { AudioMessage } from '../types';

export class SynthEngine {
    private context: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private output: GainNode;

    constructor(context: AudioContext) {
        this.context = context;
        this.output = this.context.createGain();
    }

    public async init() {
        try {
            // We assume the worklet file is at the correct path relative to the public root or built assets
            // Note: In Vite, we might need to handle this differently, but for now using the same pattern as before
            await this.context.audioWorklet.addModule(new URL('../worklets/main-processor.js', import.meta.url).href);
            this.workletNode = new AudioWorkletNode(this.context, 'main-processor');
            this.workletNode.connect(this.output);
            console.log("SynthEngine: AudioWorklet loaded successfully");
        } catch (e) {
            console.error("SynthEngine: Failed to load AudioWorklet:", e);
        }
    }

    public connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    public sendMessage(message: AudioMessage | any) {
        if (this.workletNode) {
            this.workletNode.port.postMessage(message);
        } else {
            console.warn("SynthEngine: Worklet not initialized");
        }
    }
}
