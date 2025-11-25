import type { SoundScene } from './SoundScene';

export class BrownNoiseScene implements SoundScene {
    name = "Brown Noise";
    private sourceNode: AudioBufferSourceNode | null = null;

    setup(context: AudioContext, destination: AudioNode) {
        this.sourceNode = context.createBufferSource();
        this.sourceNode.buffer = this.createStereoBrownNoiseBuffer(context);
        this.sourceNode.loop = true;
        this.sourceNode.connect(destination);
        this.sourceNode.start();
    }

    teardown() {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
    }

    private createStereoBrownNoiseBuffer(context: AudioContext): AudioBuffer {
        const bufferSize = context.sampleRate * 5;
        const buffer = context.createBuffer(2, bufferSize, context.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let lastOut = 0;
            let maxVal = 0;
            let sum = 0;

            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut;
                sum += lastOut;
            }

            const mean = sum / bufferSize;

            for (let i = 0; i < bufferSize; i++) {
                data[i] -= mean;
                const abs = Math.abs(data[i]);
                if (abs > maxVal) maxVal = abs;
            }

            const scale = 0.95 / maxVal;
            for (let i = 0; i < bufferSize; i++) {
                data[i] *= scale;
            }
        }

        return buffer;
    }
}
