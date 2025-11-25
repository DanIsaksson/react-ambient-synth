import { RingBuffer } from './RingBuffer';

export class SharedMemoryBridge {
    private ringBuffer: RingBuffer;

    constructor() {
        this.ringBuffer = new RingBuffer(4096); // 4KB buffer
    }

    getSharedBuffer() {
        return this.ringBuffer.sharedBuffer;
    }

    sendMessage(msg: any) {
        // Serialize message to JSON -> Uint8Array
        const str = JSON.stringify(msg);
        const encoder = new TextEncoder();
        const data = encoder.encode(str);

        // We need to frame the message: [Length (4 bytes)][Data...]
        // For simplicity in this phase, let's just write raw bytes and assume fixed size or single message
        // A real implementation needs a framing protocol.

        // Let's implement a simple length-prefixed protocol
        const len = data.length;
        const packet = new Uint8Array(4 + len);
        new DataView(packet.buffer).setUint32(0, len, true); // Little endian
        packet.set(data, 4);

        this.ringBuffer.write(packet);
    }
}
