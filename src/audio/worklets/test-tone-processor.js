/**
 * DIAGNOSTIC: Minimal test processor that generates a pure sine wave.
 * This bypasses all graph logic to verify AudioWorklet output works.
 */
class TestToneProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase = 0;
        this.frequency = 440;
        console.log('[TestToneProcessor] Initialized');
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];
        
        if (!channel) {
            console.error('[TestToneProcessor] No output channel!');
            return true;
        }

        // Generate simple sine wave
        for (let i = 0; i < channel.length; i++) {
            channel[i] = Math.sin(this.phase) * 0.3; // 0.3 amplitude
            this.phase += (this.frequency * 2 * Math.PI) / sampleRate;
        }

        // Wrap phase to prevent overflow
        if (this.phase > 2 * Math.PI) {
            this.phase -= 2 * Math.PI;
        }

        // Copy to other channels
        for (let ch = 1; ch < output.length; ch++) {
            output[ch].set(channel);
        }

        return true;
    }
}

registerProcessor('test-tone-processor', TestToneProcessor);
