export class RingBuffer {
    private buffer: SharedArrayBuffer;
    private view: Uint8Array;
    private header: Int32Array; // [readIndex, writeIndex]
    private capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
        // Header (8 bytes) + Data (capacity bytes)
        this.buffer = new SharedArrayBuffer(8 + capacity);
        this.header = new Int32Array(this.buffer, 0, 2);
        this.view = new Uint8Array(this.buffer, 8, capacity);
    }

    get sharedBuffer() {
        return this.buffer;
    }

    // Write data to the buffer (Main Thread)
    write(data: Uint8Array): boolean {
        const readIndex = Atomics.load(this.header, 0);
        const writeIndex = Atomics.load(this.header, 1);

        const available = (readIndex - writeIndex - 1 + this.capacity) % this.capacity;

        if (data.length > available) {
            return false; // Buffer full
        }

        for (let i = 0; i < data.length; i++) {
            this.view[(writeIndex + i) % this.capacity] = data[i];
        }

        Atomics.store(this.header, 1, (writeIndex + data.length) % this.capacity);
        return true;
    }
}
