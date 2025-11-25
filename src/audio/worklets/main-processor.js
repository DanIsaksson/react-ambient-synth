class MainProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.nodes = new Map(); // id -> { type, params, state }
        this.connections = []; // { source, target, sourceHandle, targetHandle }
        this.macros = new Map(); // id -> value

        this.port.onmessage = (event) => {
            const { target, action, payload } = event.data;

            if (target === 'system') {
                if (action === 'UPDATE_GRAPH') {
                    this.updateGraph(payload);
                } else if (action === 'UPDATE_MACROS') {
                    this.updateMacros(payload);
                }
            }
            // Future: Handle node-specific messages
            // else if (this.nodes.has(target)) { ... }
        };
    }

    updateMacros(macros) {
        macros.forEach(macro => {
            this.macros.set(macro.id, macro.value);
        });
        // console.log('[AudioWorklet] Macros updated:', this.macros);
    }

    updateGraph(patch) {
        // Update nodes
        this.nodes.clear();
        patch.nodes.forEach(node => {
            this.nodes.set(node.id, {
                type: node.type,
                params: node.params,
                phase: 0, // For oscillators
                output: 0, // Current output value
                envelope: { stage: 'idle', value: 0, timer: 0 }, // For envelopes
                sequencer: { step: 0, timer: 0 }, // For sequencers
                // Physics state
                physics: { y: 1, vy: 0 },
                // Karplus state
                delayLine: null, ptr: 0, val: 0
            });
        });
        this.connections = patch.connections;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outputChannel = output[0]; // Mono for now
        const frameSize = outputChannel.length;

        // Zero out buffer
        outputChannel.fill(0);

        // Find Output Node
        let outputNodeId = null;
        for (const [id, node] of this.nodes) {
            if (node.type === 'output') {
                outputNodeId = id;
                break;
            }
        }

        if (!outputNodeId) return true;

        // Process each sample
        for (let i = 0; i < frameSize; ++i) {
            // Reset node outputs
            for (const node of this.nodes.values()) {
                node.output = 0;
            }

            // 1. Update Physics
            for (const [id, node] of this.nodes) {
                if (node.type === 'physics') {
                    const gravity = node.params.gravity || 9.8;
                    const restitution = node.params.restitution || 0.7;
                    const dt = 1 / sampleRate;

                    node.physics.vy -= gravity * dt;
                    node.physics.y += node.physics.vy * dt;

                    if (node.physics.y <= 0) {
                        node.physics.y = 0;
                        node.physics.vy *= -restitution;
                    }

                    node.output = node.physics.y;
                }
            }

            // 2. Process Oscillators
            for (const [id, node] of this.nodes) {
                if (node.type === 'oscillator') {
                    const freq = node.params.freq || 440;
                    node.output = Math.sin(node.phase);
                    node.phase += (freq * 2 * Math.PI) / sampleRate;
                    if (node.phase > 2 * Math.PI) node.phase -= 2 * Math.PI;
                }
            }

            // 3. Process Karplus-Strong
            for (const [id, node] of this.nodes) {
                if (node.type === 'karplus') {
                    if (!node.delayLine) {
                        node.delayLine = new Float32Array(2048);
                        node.ptr = 0;
                        node.val = 0;
                    }

                    // Random excitation (drone mode for testing)
                    if (Math.random() < 0.001) {
                        for (let k = 0; k < node.delayLine.length; k++) node.delayLine[k] = Math.random() * 2 - 1;
                    }

                    const freq = node.params.frequency || 220;
                    const delayLen = Math.floor(sampleRate / freq);
                    const damping = node.params.damping || 0.5;

                    const readPtr = (node.ptr - delayLen + node.delayLine.length) % node.delayLine.length;
                    const delayedSample = node.delayLine[readPtr];

                    const nextVal = (delayedSample + node.val) * 0.5 * (1 - damping * 0.001);
                    node.val = delayedSample;

                    node.delayLine[node.ptr] = nextVal;
                    node.output = nextVal;

                    node.ptr = (node.ptr + 1) % node.delayLine.length;
                }
            }

            // 4. Process Filters
            for (const conn of this.connections) {
                const sourceNode = this.nodes.get(conn.source);
                const targetNode = this.nodes.get(conn.target);

                if (targetNode && targetNode.type === 'filter' && sourceNode) {
                    // Simple lowpass placeholder
                    targetNode.output = sourceNode.output * 0.9;
                }
            }

            // Sum to output
            for (const conn of this.connections) {
                if (conn.target === outputNodeId) {
                    const sourceNode = this.nodes.get(conn.source);
                    if (sourceNode) {
                        outputChannel[i] += sourceNode.output * 0.5;
                    }
                }
            }

            // Hard clip
            outputChannel[i] = Math.max(-1, Math.min(1, outputChannel[i]));
        }

        // Copy to other channels
        for (let channel = 1; channel < output.length; ++channel) {
            output[channel].set(outputChannel);
        }

        return true;
    }
}

registerProcessor('main-processor', MainProcessor);
