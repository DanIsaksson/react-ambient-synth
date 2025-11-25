class MainProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.nodes = new Map(); // id -> { type, params, state }
        this.connections = []; // { source, target, sourceHandle, targetHandle }
        this.macros = new Map(); // id -> value
        this.processCallCount = 0; // DIAGNOSTIC: Track process calls
        
        // DIAGNOSTIC: Test tone bypass mode
        this.testToneMode = false;
        this.testPhase = 0;
        this.simpleGraphMode = false;
        this.forceSimpleInNormalPath = false;

        this.port.onmessage = (event) => {
            const { target, action, payload } = event.data;

            if (target === 'system') {
                if (action === 'UPDATE_GRAPH') {
                    this.updateGraph(payload);
                } else if (action === 'UPDATE_MACROS') {
                    this.updateMacros(payload);
                } else if (action === 'TEST_TONE_MODE') {
                    this.testToneMode = payload;
                    console.log('[MainProcessor] Test tone mode:', this.testToneMode);
                } else if (action === 'SIMPLE_GRAPH_MODE') {
                    this.simpleGraphMode = payload;
                    console.log('[MainProcessor] Simple graph mode:', this.simpleGraphMode);
                } else if (action === 'FORCE_SIMPLE_NORMAL') {
                    this.forceSimpleInNormalPath = payload;
                    console.log('[MainProcessor] Force simple in normal path:', this.forceSimpleInNormalPath);
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
        // ========================================
        // DIAGNOSTIC: Log incoming graph data
        // ========================================
        console.log('[AudioWorklet] updateGraph called with:', {
            nodeCount: patch.nodes?.length ?? 0,
            connectionCount: patch.connections?.length ?? 0,
            nodes: patch.nodes?.map(n => ({ id: n.id, type: n.type, params: n.params })),
            connections: patch.connections,
        });

        // Update nodes - preserve state for existing nodes (prevents audio glitches)
        const existingNodes = new Map(this.nodes);
        this.nodes.clear();
        
        patch.nodes.forEach(node => {
            const existing = existingNodes.get(node.id);
            if (existing && existing.type === node.type) {
                // Preserve state, only update params
                existing.params = node.params;
                this.nodes.set(node.id, existing);
            } else {
                // New node - initialize fresh state
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
            }
        });
        this.connections = patch.connections;
        
        console.log('[AudioWorklet] Graph updated. Nodes in map:', this.nodes.size, 'Connections:', this.connections.length);
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outputChannel = output[0]; // Mono for now
        const frameSize = outputChannel.length;

        // ========================================
        // DIAGNOSTIC: Test tone bypass mode
        // ========================================
        if (this.testToneMode) {
            // Find first oscillator in graph and use its frequency
            let freq = 440;
            for (const [id, node] of this.nodes) {
                if (node.type === 'oscillator') {
                    freq = node.params?.freq || 440;
                    break;
                }
            }
            
            // Generate sine wave using same pattern that WORKS
            for (let i = 0; i < frameSize; i++) {
                outputChannel[i] = Math.sin(this.testPhase) * 0.3;
                this.testPhase += (freq * 2 * Math.PI) / sampleRate;
            }
            if (this.testPhase > 2 * Math.PI) this.testPhase -= 2 * Math.PI;
            
            // Copy to other channels
            for (let ch = 1; ch < output.length; ch++) {
                output[ch].set(outputChannel);
            }
            return true;
        }
        
        // ========================================
        // DIAGNOSTIC: Simple graph mode (minimal processing)
        // Uses graph oscillator but simplified output
        // ========================================
        if (this.simpleGraphMode) {
            // Find first oscillator
            let oscNode = null;
            for (const [id, node] of this.nodes) {
                if (node.type === 'oscillator') {
                    oscNode = node;
                    break;
                }
            }
            
            if (oscNode) {
                const freq = oscNode.params?.freq || 440;
                for (let i = 0; i < frameSize; i++) {
                    // Use the oscillator's stored phase (like normal processing does)
                    outputChannel[i] = Math.sin(oscNode.phase) * 0.3;
                    oscNode.phase += (freq * 2 * Math.PI) / sampleRate;
                    if (oscNode.phase > 2 * Math.PI) oscNode.phase -= 2 * Math.PI;
                }
            } else {
                outputChannel.fill(0);
            }
            
            // Copy to other channels
            for (let ch = 1; ch < output.length; ch++) {
                output[ch].set(outputChannel);
            }
            return true;
        }

        // ========================================
        // DIAGNOSTIC: Force simple sine in normal path
        // This tests if the buffer reference works correctly
        // ========================================
        if (this.forceSimpleInNormalPath) {
            // Same code as simpleGraphMode but in normal path
            let oscNode = null;
            for (const [id, node] of this.nodes) {
                if (node.type === 'oscillator') {
                    oscNode = node;
                    break;
                }
            }
            
            if (oscNode) {
                const freq = oscNode.params?.freq || 440;
                for (let i = 0; i < frameSize; i++) {
                    outputChannel[i] = Math.sin(oscNode.phase) * 0.3;
                    oscNode.phase += (freq * 2 * Math.PI) / sampleRate;
                    if (oscNode.phase > 2 * Math.PI) oscNode.phase -= 2 * Math.PI;
                }
            }
            
            // Copy and return - IDENTICAL to simpleGraphMode
            for (let ch = 1; ch < output.length; ch++) {
                output[ch].set(outputChannel);
            }
            return true;
        }

        // ========================================
        // DIAGNOSTIC: Log first few process calls
        // ========================================
        this.processCallCount++;
        if (this.processCallCount <= 3 || this.processCallCount % 1000 === 0) {
            console.log('[AudioWorklet] process() call #' + this.processCallCount, {
                nodesInMap: this.nodes.size,
                connectionsCount: this.connections.length,
                frameSize: frameSize,
                hasOutputBuffer: !!outputChannel,
            });
        }

        // Zero out buffer
        outputChannel.fill(0);

        // Find ALL Output Nodes (Issue #1 fix: support multiple outputs)
        const outputNodeIds = new Set();
        for (const [id, node] of this.nodes) {
            if (node.type === 'output') {
                outputNodeIds.add(id);
            }
        }

        // ========================================
        // DIAGNOSTIC: Log routing details on first frame
        // ========================================
        if (this.processCallCount === 1) {
            console.log('[AudioWorklet] ROUTING DEBUG:', {
                outputNodeIds: Array.from(outputNodeIds),
                allNodeTypes: Array.from(this.nodes.entries()).map(([id, n]) => ({ id, type: n.type })),
                connections: this.connections,
            });
        }

        if (outputNodeIds.size === 0) {
            // DIAGNOSTIC: Log when no output node found
            if (this.processCallCount <= 5) {
                console.log('[AudioWorklet] No output node found in graph!');
            }
            return true;
        }

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
                    const waveform = node.params.waveform || 'sine';
                    
                    // Generate waveform based on type
                    const normalizedPhase = node.phase / (2 * Math.PI); // 0-1
                    switch (waveform) {
                        case 'sine':
                            node.output = Math.sin(node.phase);
                            break;
                        case 'square':
                            node.output = normalizedPhase < 0.5 ? 1 : -1;
                            break;
                        case 'sawtooth':
                            node.output = 2 * normalizedPhase - 1;
                            break;
                        case 'triangle':
                            node.output = 4 * Math.abs(normalizedPhase - 0.5) - 1;
                            break;
                        default:
                            node.output = Math.sin(node.phase);
                    }
                    
                    // Advance phase
                    node.phase += (freq * 2 * Math.PI) / sampleRate;
                    if (node.phase > 2 * Math.PI) node.phase -= 2 * Math.PI;
                }
            }

            // 3. Process Karplus-Strong (Enhanced with Stiffness)
            for (const [id, node] of this.nodes) {
                if (node.type === 'karplus') {
                    // Initialize state if needed
                    if (!node.delayLine) {
                        node.delayLine = new Float32Array(4096);
                        node.ptr = 0;
                        node.prevSample = 0;
                        node.allpassState = 0; // For stiffness filter
                        node.dcBlocker = { x1: 0, y1: 0 }; // DC blocking filter state
                    }

                    // Parameters
                    const freq = node.params.frequency || 220;
                    const damping = node.params.damping ?? 0.5;       // 0-1, higher = duller
                    const stiffness = node.params.stiffness ?? 0;    // 0-1, higher = more metallic
                    const brightness = node.params.brightness ?? 0.5; // 0-1, affects filter cutoff

                    // Calculate delay length (in samples)
                    const delayLen = Math.max(1, Math.floor(sampleRate / freq));

                    // Excitation handling
                    // Check for trigger from main thread or random drone mode
                    if (node.params.trigger) {
                        // Excite with noise burst
                        const exciteLen = Math.min(delayLen, 256);
                        for (let k = 0; k < exciteLen; k++) {
                            // Bandlimited noise (softer attack)
                            node.delayLine[k] = (Math.random() * 2 - 1) * (1 - k / exciteLen);
                        }
                        node.params.trigger = false;
                    } else if (Math.random() < 0.0005) {
                        // Rare random pluck for ambient drone
                        const exciteLen = Math.min(delayLen, 128);
                        for (let k = 0; k < exciteLen; k++) {
                            node.delayLine[k] = (Math.random() * 2 - 1) * 0.3;
                        }
                    }

                    // Read from delay line with fractional interpolation
                    const readPos = node.ptr - delayLen;
                    const readIdx = ((readPos % node.delayLine.length) + node.delayLine.length) % node.delayLine.length;
                    const readIdx2 = (readIdx + 1) % node.delayLine.length;
                    const frac = (node.ptr - delayLen) - Math.floor(node.ptr - delayLen);
                    
                    // Linear interpolation for pitch accuracy
                    const delayedSample = node.delayLine[readIdx] * (1 - frac) + node.delayLine[readIdx2] * frac;

                    // ==========================================
                    // LOWPASS FILTER (Damping/Brightness)
                    // ==========================================
                    // One-pole lowpass: y[n] = (1-a) * x[n] + a * y[n-1]
                    const lpCoeff = 0.2 + brightness * 0.75 - damping * 0.4;
                    const lpFiltered = (1 - lpCoeff) * delayedSample + lpCoeff * node.prevSample;
                    node.prevSample = lpFiltered;

                    // ==========================================
                    // ALLPASS FILTER (Stiffness)
                    // ==========================================
                    // Simulates inharmonic partials (metallic strings)
                    // y[n] = -coeff * x[n] + x[n-1] + coeff * y[n-1]
                    let filtered = lpFiltered;
                    if (stiffness > 0.01) {
                        const apCoeff = stiffness * 0.5;
                        const apOut = -apCoeff * lpFiltered + node.allpassState + apCoeff * (node.allpassOut || 0);
                        node.allpassState = lpFiltered;
                        node.allpassOut = apOut;
                        filtered = apOut;
                    }

                    // ==========================================
                    // FEEDBACK & DECAY
                    // ==========================================
                    // Apply decay factor (energy loss per cycle)
                    const decayFactor = 0.995 - damping * 0.008;
                    const feedback = filtered * decayFactor;

                    // ==========================================
                    // DC BLOCKER
                    // ==========================================
                    // Removes DC offset that can accumulate
                    const dcCoeff = 0.995;
                    const dcOut = feedback - node.dcBlocker.x1 + dcCoeff * node.dcBlocker.y1;
                    node.dcBlocker.x1 = feedback;
                    node.dcBlocker.y1 = dcOut;

                    // Write back to delay line
                    node.delayLine[node.ptr] = dcOut;
                    node.output = dcOut;

                    // Advance pointer
                    node.ptr = (node.ptr + 1) % node.delayLine.length;
                }
            }

            // 4. Process Resonators (Physical Modeling - Modal Synthesis)
            for (const [id, node] of this.nodes) {
                if (node.type === 'resonator') {
                    // Initialize resonator bank if needed
                    if (!node.modes) {
                        // Create 8 resonant modes (bandpass filters)
                        node.modes = [];
                        for (let m = 0; m < 8; m++) {
                            node.modes.push({
                                z1: 0, z2: 0,  // Filter state
                                freq: 0,       // Will be set based on material
                                amp: 0,        // Amplitude of this mode
                            });
                        }
                        node.exciteEnergy = 0;
                        node.lastMaterial = null;
                    }

                    // Parameters
                    const material = node.params.material || 'wood'; // 'glass', 'wood', 'metal'
                    const baseFreq = node.params.frequency || 440;
                    const decay = node.params.decay ?? 0.5;    // 0-1, resonance time
                    const brightness = node.params.brightness ?? 0.5;

                    // Recalculate mode frequencies if material changed
                    if (node.lastMaterial !== material) {
                        node.lastMaterial = material;
                        
                        // Material presets define harmonic ratios and Q factors
                        let ratios, qBase;
                        switch (material) {
                            case 'glass':
                                // Non-integer ratios, high Q (long ring)
                                ratios = [1, 2.32, 3.85, 5.17, 6.71, 8.12, 9.88, 11.21];
                                qBase = 800;
                                break;
                            case 'metal':
                                // Clustered inharmonic partials
                                ratios = [1, 1.58, 2.0, 2.51, 2.92, 3.46, 4.0, 4.58];
                                qBase = 500;
                                break;
                            case 'wood':
                            default:
                                // Near-integer ratios, low Q (short decay)
                                ratios = [1, 2.0, 3.0, 4.02, 5.0, 6.01, 7.0, 8.02];
                                qBase = 150;
                                break;
                        }

                        // Configure each mode
                        for (let m = 0; m < 8; m++) {
                            const modeFreq = baseFreq * ratios[m];
                            const modeQ = qBase * (1 + decay) * (1 - m * 0.08);
                            const modeAmp = Math.pow(0.7, m) * (0.5 + brightness * 0.5);

                            // Calculate biquad coefficients for bandpass
                            const omega = 2 * Math.PI * modeFreq / sampleRate;
                            const sinOmega = Math.sin(omega);
                            const cosOmega = Math.cos(omega);
                            const alpha = sinOmega / (2 * modeQ);

                            node.modes[m].b0 = alpha;
                            node.modes[m].b1 = 0;
                            node.modes[m].b2 = -alpha;
                            node.modes[m].a1 = -2 * cosOmega;
                            node.modes[m].a2 = 1 - alpha;
                            node.modes[m].a0inv = 1 / (1 + alpha);
                            node.modes[m].amp = modeAmp;
                            node.modes[m].freq = modeFreq;
                        }
                    }

                    // Handle excitation (strike/ping)
                    if (node.params.trigger) {
                        node.exciteEnergy = 1.0;
                        node.params.trigger = false;
                    }

                    // Generate excitation impulse
                    let excitation = 0;
                    if (node.exciteEnergy > 0.001) {
                        // Short noise burst with envelope
                        excitation = (Math.random() * 2 - 1) * node.exciteEnergy;
                        node.exciteEnergy *= 0.95; // Quick decay of excitation
                    }

                    // Sum output from all modes
                    let output = 0;
                    for (const mode of node.modes) {
                        // Biquad bandpass filter
                        const input = excitation;
                        const y = (mode.b0 * input + mode.b1 * mode.z1 + mode.b2 * mode.z2
                                   - mode.a1 * mode.z1 - mode.a2 * mode.z2) * mode.a0inv;
                        
                        mode.z2 = mode.z1;
                        mode.z1 = y;
                        
                        output += y * mode.amp;
                    }

                    node.output = output * 0.3; // Scale down to prevent clipping
                }
            }

            // 5. Process Filters
            for (const conn of this.connections) {
                const sourceNode = this.nodes.get(conn.source);
                const targetNode = this.nodes.get(conn.target);

                if (targetNode && targetNode.type === 'filter' && sourceNode) {
                    // Simple lowpass placeholder
                    targetNode.output = sourceNode.output * 0.9;
                }
            }

            // Sum to ALL output nodes (Issue #1 fix: support multiple outputs)
            let summedAnything = false;
            for (const conn of this.connections) {
                if (outputNodeIds.has(conn.target)) {
                    const sourceNode = this.nodes.get(conn.source);
                    if (sourceNode) {
                        outputChannel[i] += sourceNode.output * 0.5;
                        summedAnything = true;
                        
                        // DIAGNOSTIC: Log first sample of first frame
                        if (this.processCallCount === 1 && i === 0) {
                            console.log('[AudioWorklet] SUMMING:', {
                                connSource: conn.source,
                                connTarget: conn.target,
                                sourceNodeOutput: sourceNode.output,
                                addedValue: sourceNode.output * 0.5,
                                bufferValueNow: outputChannel[i],
                            });
                        }
                    }
                }
            }
            
            // DIAGNOSTIC: Log if nothing was summed on first sample
            if (this.processCallCount === 1 && i === 0 && !summedAnything) {
                console.log('[AudioWorklet] WARNING: No connections summed to output!');
            }

            // Hard clip
            outputChannel[i] = Math.max(-1, Math.min(1, outputChannel[i]));
        }

        // ========================================
        // DIAGNOSTIC: Log first non-zero audio output
        // ========================================
        if (this.processCallCount <= 5) {
            const maxSample = Math.max(...outputChannel.map(Math.abs));
            console.log('[AudioWorklet] Frame output - max sample amplitude:', maxSample.toFixed(4), 
                maxSample > 0 ? '✓ AUDIO GENERATED' : '✗ SILENT');
        }

        // Copy to other channels
        for (let channel = 1; channel < output.length; ++channel) {
            output[channel].set(outputChannel);
        }

        return true;
    }
}

registerProcessor('main-processor', MainProcessor);
