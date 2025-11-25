class RingBuffer {
    constructor(sharedBuffer) {
        this.buffer = sharedBuffer;
        this.header = new Int32Array(this.buffer, 0, 2);
        this.view = new Uint8Array(this.buffer, 8);
        this.capacity = this.view.length;
    }

    // Read data from the buffer (Audio Thread)
    read(output) {
        const readIndex = Atomics.load(this.header, 0);
        const writeIndex = Atomics.load(this.header, 1);

        if (readIndex === writeIndex) {
            return 0; // Buffer empty
        }

        const available = (writeIndex - readIndex + this.capacity) % this.capacity;
        const toRead = Math.min(available, output.length);

        for (let i = 0; i < toRead; i++) {
            output[i] = this.view[(readIndex + i) % this.capacity];
        }

        Atomics.store(this.header, 0, (readIndex + toRead) % this.capacity);
        return toRead;
    }
}

// Export for Worklet scope
// In AudioWorklet, we don't have modules yet in all browsers, so we attach to global
globalThis.RingBuffer = RingBuffer;
