class MainProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.nodes = new Map(); // id -> { type, params, modulatedParams, state }
        this.connections = []; // { source, target, sourceHandle, targetHandle }
        this.modulations = []; // { sourceId, targetId, targetParam, amount, bipolar }
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
            modulationCount: patch.modulations?.length ?? 0,
            nodes: patch.nodes?.map(n => ({ id: n.id, type: n.type, params: n.params })),
            connections: patch.connections,
            modulations: patch.modulations,
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
        
        // Store modulation connections
        this.modulations = patch.modulations || [];
        
        console.log('[AudioWorklet] Graph updated. Nodes:', this.nodes.size, 'Connections:', this.connections.length, 'Modulations:', this.modulations.length);
    }

    // ========================================
    // MODULATION SYSTEM
    // ========================================

    /**
     * Process LFO nodes - generate modulation signals
     */
    processLFOs() {
        for (const [id, node] of this.nodes) {
            if (node.type === 'lfo') {
                // Initialize state
                if (node.lfoPhase === undefined) {
                    node.lfoPhase = 0;
                    node.lastRandom = 0;
                    node.randomHoldCounter = 0;
                }

                const freq = node.params?.frequency ?? 1;
                const depth = node.params?.depth ?? 1;
                const waveform = node.params?.waveform || 'sine';

                // Generate waveform (normalized to -1 to +1)
                let signal;
                const normalizedPhase = node.lfoPhase / (2 * Math.PI);

                switch (waveform) {
                    case 'sine':
                        signal = Math.sin(node.lfoPhase);
                        break;
                    case 'triangle':
                        signal = 4 * Math.abs(normalizedPhase - 0.5) - 1;
                        break;
                    case 'square':
                        signal = normalizedPhase < 0.5 ? 1 : -1;
                        break;
                    case 'sawtooth':
                        signal = 2 * normalizedPhase - 1;
                        break;
                    case 'random': // Sample & Hold
                        const holdSamples = Math.floor(sampleRate / Math.max(0.01, freq));
                        if (node.randomHoldCounter <= 0) {
                            node.lastRandom = Math.random() * 2 - 1;
                            node.randomHoldCounter = holdSamples;
                        }
                        node.randomHoldCounter--;
                        signal = node.lastRandom;
                        break;
                    default:
                        signal = Math.sin(node.lfoPhase);
                }

                // Apply depth and store modulation output
                node.modOutput = signal * depth;

                // Advance phase
                node.lfoPhase += (freq * 2 * Math.PI) / sampleRate;
                if (node.lfoPhase >= 2 * Math.PI) node.lfoPhase -= 2 * Math.PI;
            }
        }
    }

    /**
     * Process Envelope nodes - ADSR modulation signals
     */
    processEnvelopes() {
        for (const [id, node] of this.nodes) {
            if (node.type === 'envelope') {
                // Initialize state
                if (node.envState === undefined) {
                    node.envState = 'idle';  // idle, attack, decay, sustain, release
                    node.envValue = 0;
                    node.envTime = 0;
                    node.releaseStartLevel = 0;
                }

                // ADSR params (times in ms from UI, convert to seconds)
                const attack = (node.params?.attack ?? 10) / 1000;
                const decay = (node.params?.decay ?? 100) / 1000;
                const sustain = (node.params?.sustain ?? 70) / 100;  // 0-100 → 0-1
                const release = (node.params?.release ?? 300) / 1000;

                // Check for trigger (note on)
                if (node.params?.trigger) {
                    node.envState = 'attack';
                    node.envTime = 0;
                    node.params.trigger = false;
                }

                // Check for gate off (note release)
                if (node.params?.gateOff && node.envState !== 'idle' && node.envState !== 'release') {
                    node.envState = 'release';
                    node.envTime = 0;
                    node.releaseStartLevel = node.envValue;
                    node.params.gateOff = false;
                }

                const dt = 1 / sampleRate;

                switch (node.envState) {
                    case 'attack':
                        node.envValue = attack > 0 ? node.envTime / attack : 1;
                        if (node.envValue >= 1) {
                            node.envValue = 1;
                            node.envState = 'decay';
                            node.envTime = 0;
                        }
                        break;

                    case 'decay':
                        node.envValue = decay > 0 
                            ? 1 - (1 - sustain) * (node.envTime / decay)
                            : sustain;
                        if (node.envTime >= decay) {
                            node.envValue = sustain;
                            node.envState = 'sustain';
                        }
                        break;

                    case 'sustain':
                        node.envValue = sustain;
                        break;

                    case 'release':
                        if (release > 0) {
                            const releaseProgress = node.envTime / release;
                            node.envValue = node.releaseStartLevel * (1 - releaseProgress);
                        } else {
                            node.envValue = 0;
                        }
                        if (node.envTime >= release) {
                            node.envValue = 0;
                            node.envState = 'idle';
                        }
                        break;

                    case 'idle':
                    default:
                        node.envValue = 0;
                        break;
                }

                node.envTime += dt;
                node.modOutput = node.envValue;
            }
        }
    }

    /**
     * Process Noise/Drift nodes - Perlin-like modulation signals
     */
    processNoiseModulators() {
        for (const [id, node] of this.nodes) {
            if (node.type === 'noise') {
                // Initialize state
                if (node.noisePhase === undefined) {
                    node.noisePhase = Math.random() * 1000;
                    node.noisePrev = 0;
                }

                const speed = node.params?.speed ?? 0.5;
                const depth = node.params?.depth ?? 1;
                const smoothness = node.params?.smoothness ?? 0.5;
                const bipolar = node.params?.bipolar ?? true;

                // Multi-octave noise approximation using summed sines
                const octaves = Math.round(1 + smoothness * 4);
                let value = 0;
                let amplitude = 1;
                let maxAmplitude = 0;

                for (let oct = 0; oct < octaves; oct++) {
                    const freq = Math.pow(2, oct);
                    value += amplitude * Math.sin(node.noisePhase * freq + oct * 1.618);
                    maxAmplitude += amplitude;
                    amplitude *= 0.5;
                }

                value = value / maxAmplitude; // Normalize to -1 to +1

                // Smooth transitions
                const smoothFactor = 0.001 + (1 - smoothness) * 0.05;
                node.noisePrev = node.noisePrev + (value - node.noisePrev) * smoothFactor;
                value = node.noisePrev;

                // Apply bipolar mode
                if (!bipolar) {
                    value = (value + 1) / 2; // Convert to 0-1
                }

                node.modOutput = value * depth;

                // Advance phase
                node.noisePhase += speed * 0.0001;
            }
        }
    }

    /**
     * Get modulation range for a parameter
     */
    getModRange(nodeType, param, baseValue) {
        const ranges = {
            oscillator: { freq: baseValue * 0.5 },  // ±50% of base frequency
            filter: { cutoff: 5000, resonance: 10 },
            spatial: { x: 5, y: 5, z: 5, rolloff: 2 },
            karplus: { frequency: 100, damping: 0.3, stiffness: 0.3, brightness: 0.3 },
            resonator: { frequency: 200, decay: 0.3, brightness: 0.3 },
        };
        return ranges[nodeType]?.[param] ?? baseValue * 0.5;
    }

    /**
     * Clamp parameters to valid ranges
     */
    clampParams(node) {
        const clamps = {
            oscillator: { freq: [20, 20000] },
            filter: { cutoff: [20, 20000], resonance: [0.1, 30] },
            spatial: { x: [-10, 10], y: [-10, 10], z: [-10, 10], rolloff: [0, 5] },
            karplus: { frequency: [20, 2000], damping: [0, 1], stiffness: [0, 1], brightness: [0, 1] },
            resonator: { frequency: [20, 5000], decay: [0, 1], brightness: [0, 1] },
        };

        const nodeClamps = clamps[node.type];
        if (!nodeClamps || !node.modulatedParams) return;

        for (const [param, [min, max]] of Object.entries(nodeClamps)) {
            if (node.modulatedParams[param] !== undefined) {
                node.modulatedParams[param] = Math.max(min, Math.min(max, node.modulatedParams[param]));
            }
        }
    }

    /**
     * Apply all modulation routings
     * Called AFTER control nodes generate signals, BEFORE audio processing
     */
    applyModulations() {
        // Reset all modulated params to base values
        for (const node of this.nodes.values()) {
            node.modulatedParams = { ...node.params };
        }

        // Apply each modulation connection
        for (const mod of this.modulations) {
            const source = this.nodes.get(mod.sourceId);
            const target = this.nodes.get(mod.targetId);

            if (!source || !target || source.modOutput === undefined) continue;

            const baseValue = target.params?.[mod.targetParam];
            if (baseValue === undefined) continue;

            const range = this.getModRange(target.type, mod.targetParam, baseValue);
            const bipolar = mod.bipolar ?? true;
            
            // Calculate modulation amount
            let modSignal = source.modOutput;
            if (!bipolar) {
                modSignal = (modSignal + 1) / 2; // Convert to 0-1 range
            }
            const modAmount = modSignal * (mod.amount ?? 0.5) * range;

            // Accumulate modulation (multiple sources can modulate same param)
            const current = target.modulatedParams[mod.targetParam] ?? baseValue;
            target.modulatedParams[mod.targetParam] = current + modAmount;
        }

        // Clamp to valid ranges
        for (const node of this.nodes.values()) {
            this.clampParams(node);
        }
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
            // Reset node outputs and modulation outputs
            for (const node of this.nodes.values()) {
                node.output = 0;
                // Only reset modOutput for non-control nodes (control nodes accumulate)
                if (!['lfo', 'envelope', 'noise'].includes(node.type)) {
                    node.modOutput = 0;
                }
            }

            // ========================================
            // 1. Process CONTROL nodes (generate modulation signals)
            // ========================================
            this.processLFOs();
            this.processEnvelopes();
            this.processNoiseModulators();

            // ========================================
            // 2. Apply MODULATION routing
            // ========================================
            this.applyModulations();

            // ========================================
            // 3. Process SOURCE nodes (using modulatedParams)
            // ========================================

            // 3a. Update Physics
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

            // 3b. Process Oscillators
            for (const [id, node] of this.nodes) {
                if (node.type === 'oscillator') {
                    // Skip output if muted (but still advance phase for continuity)
                    const isMuted = node.params?.isMuted ?? false;
                    
                    // Use modulatedParams if available (for modulation), fallback to params
                    const freq = node.modulatedParams?.freq ?? node.params?.freq ?? 440;
                    const waveform = node.modulatedParams?.waveform ?? node.params?.waveform ?? 'sine';
                    
                    // Always advance phase (even when muted) for phase continuity
                    node.phase += (freq * 2 * Math.PI) / sampleRate;
                    if (node.phase > 2 * Math.PI) node.phase -= 2 * Math.PI;
                    
                    // Skip output generation if muted
                    if (isMuted) continue;
                    
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
                }
            }

            // 3c. Process Karplus-Strong (Enhanced with Stiffness)
            for (const [id, node] of this.nodes) {
                if (node.type === 'karplus') {
                    // Skip if muted
                    if (node.params?.isMuted) continue;
                    
                    // Initialize state if needed
                    if (!node.delayLine) {
                        node.delayLine = new Float32Array(4096);
                        node.ptr = 0;
                        node.prevSample = 0;
                        node.allpassState = 0; // For stiffness filter
                        node.dcBlocker = { x1: 0, y1: 0 }; // DC blocking filter state
                    }

                    // Parameters (use modulatedParams for modulation support)
                    const freq = node.modulatedParams?.frequency ?? node.params?.frequency ?? 220;
                    const damping = node.modulatedParams?.damping ?? node.params?.damping ?? 0.5;
                    const stiffness = node.modulatedParams?.stiffness ?? node.params?.stiffness ?? 0;
                    const brightness = node.modulatedParams?.brightness ?? node.params?.brightness ?? 0.5;

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

            // 3d. Process Resonators (Physical Modeling - Modal Synthesis)
            for (const [id, node] of this.nodes) {
                if (node.type === 'resonator') {
                    // Skip if muted
                    if (node.params?.isMuted) continue;
                    
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

                    // Parameters (use modulatedParams for modulation support)
                    const material = node.modulatedParams?.material ?? node.params?.material ?? 'wood';
                    const baseFreq = node.modulatedParams?.frequency ?? node.params?.frequency ?? 440;
                    const decay = node.modulatedParams?.decay ?? node.params?.decay ?? 0.5;
                    const brightness = node.modulatedParams?.brightness ?? node.params?.brightness ?? 0.5;

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

            // ========================================
            // 4. Process EFFECT nodes (using modulatedParams)
            // ========================================
            for (const conn of this.connections) {
                const sourceNode = this.nodes.get(conn.source);
                const targetNode = this.nodes.get(conn.target);

                if (targetNode && targetNode.type === 'filter' && sourceNode) {
                    // Initialize filter state if needed
                    if (!targetNode.filterState) {
                        targetNode.filterState = { x1: 0, x2: 0, y1: 0, y2: 0 };
                        targetNode.lastCutoff = 0;
                        targetNode.lastRes = 0;
                        targetNode.lastType = '';
                    }
                    
                    // Get filter parameters (use modulatedParams for modulation support)
                    const cutoff = Math.max(20, Math.min(20000, 
                        targetNode.modulatedParams?.cutoff ?? targetNode.params?.cutoff ?? 1000));
                    const resonance = Math.max(0.1, Math.min(30, 
                        targetNode.modulatedParams?.resonance ?? targetNode.params?.resonance ?? 1));
                    const filterType = targetNode.modulatedParams?.filterType ?? targetNode.params?.filterType ?? 'lowpass';
                    
                    // Recalculate coefficients if parameters changed
                    if (cutoff !== targetNode.lastCutoff || resonance !== targetNode.lastRes || filterType !== targetNode.lastType) {
                        const omega = 2 * Math.PI * cutoff / sampleRate;
                        const sinOmega = Math.sin(omega);
                        const cosOmega = Math.cos(omega);
                        const alpha = sinOmega / (2 * resonance);
                        
                        let b0, b1, b2, a0, a1, a2;
                        
                        switch (filterType) {
                            case 'highpass':
                                b0 = (1 + cosOmega) / 2;
                                b1 = -(1 + cosOmega);
                                b2 = (1 + cosOmega) / 2;
                                a0 = 1 + alpha;
                                a1 = -2 * cosOmega;
                                a2 = 1 - alpha;
                                break;
                            case 'bandpass':
                                b0 = alpha;
                                b1 = 0;
                                b2 = -alpha;
                                a0 = 1 + alpha;
                                a1 = -2 * cosOmega;
                                a2 = 1 - alpha;
                                break;
                            case 'lowpass':
                            default:
                                b0 = (1 - cosOmega) / 2;
                                b1 = 1 - cosOmega;
                                b2 = (1 - cosOmega) / 2;
                                a0 = 1 + alpha;
                                a1 = -2 * cosOmega;
                                a2 = 1 - alpha;
                                break;
                        }
                        
                        // Normalize coefficients
                        targetNode.b0 = b0 / a0;
                        targetNode.b1 = b1 / a0;
                        targetNode.b2 = b2 / a0;
                        targetNode.a1 = a1 / a0;
                        targetNode.a2 = a2 / a0;
                        
                        targetNode.lastCutoff = cutoff;
                        targetNode.lastRes = resonance;
                        targetNode.lastType = filterType;
                    }
                    
                    // Apply biquad filter
                    const input = sourceNode.output;
                    const fs = targetNode.filterState;
                    const output = targetNode.b0 * input + targetNode.b1 * fs.x1 + targetNode.b2 * fs.x2
                                 - targetNode.a1 * fs.y1 - targetNode.a2 * fs.y2;
                    
                    // Update state
                    fs.x2 = fs.x1;
                    fs.x1 = input;
                    fs.y2 = fs.y1;
                    fs.y1 = output;
                    
                    targetNode.output = output;
                }
                
                // Spatial nodes: simple stereo panning based on X position
                if (targetNode && targetNode.type === 'spatial' && sourceNode) {
                    // Use modulatedParams for modulation support
                    const pos = targetNode.modulatedParams?.position ?? targetNode.params?.position ?? { x: 0, y: 0, z: 0 };
                    const x = targetNode.modulatedParams?.x ?? pos.x ?? 0;
                    const y = targetNode.modulatedParams?.y ?? pos.y ?? 0;
                    const z = targetNode.modulatedParams?.z ?? pos.z ?? 0;
                    
                    // Calculate distance for attenuation
                    const distance = Math.sqrt(x * x + y * y + z * z);
                    const refDist = 1;
                    const maxDist = targetNode.params?.maxDistance || 100;
                    const rolloff = targetNode.params?.rolloff || 1;
                    
                    // Inverse distance attenuation
                    const attenuation = refDist / (refDist + rolloff * Math.max(0, distance - refDist));
                    const clampedAtten = Math.min(1, Math.max(0, attenuation));
                    
                    // Simple stereo pan from X position (-10 to +10 range)
                    const pan = Math.max(-1, Math.min(1, x / 10));
                    
                    // Store for stereo output (will be used in output summing)
                    targetNode.output = sourceNode.output * clampedAtten;
                    targetNode.pan = pan;
                }
            }

            // ========================================
            // 5. Sum to OUTPUT nodes
            // ========================================
            let summedAnything = false;
            const leftChannel = output[0];
            const rightChannel = output.length > 1 ? output[1] : output[0];
            
            for (const conn of this.connections) {
                if (outputNodeIds.has(conn.target)) {
                    const sourceNode = this.nodes.get(conn.source);
                    if (sourceNode) {
                        const signal = sourceNode.output * 0.5;
                        
                        // Apply stereo panning if source has pan value
                        const pan = sourceNode.pan ?? 0; // -1 = left, 0 = center, 1 = right
                        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
                        const rightGain = Math.sin((pan + 1) * Math.PI / 4);
                        
                        leftChannel[i] += signal * leftGain;
                        rightChannel[i] += signal * rightGain;
                        summedAnything = true;
                    }
                }
            }
            
            // DIAGNOSTIC: Log if nothing was summed on first sample
            if (this.processCallCount === 1 && i === 0 && !summedAnything) {
                console.log('[AudioWorklet] WARNING: No connections summed to output!');
            }

            // Hard clip both channels
            leftChannel[i] = Math.max(-1, Math.min(1, leftChannel[i]));
            rightChannel[i] = Math.max(-1, Math.min(1, rightChannel[i]));
        }

        // ========================================
        // DIAGNOSTIC: Log first non-zero audio output
        // ========================================
        if (this.processCallCount <= 5) {
            const maxSample = Math.max(...output[0].map(Math.abs));
            console.log('[AudioWorklet] Frame output - max sample amplitude:', maxSample.toFixed(4), 
                maxSample > 0 ? '✓ AUDIO GENERATED' : '✗ SILENT');
        }

        // Copy stereo to additional channels if they exist
        for (let channel = 2; channel < output.length; ++channel) {
            output[channel].set(output[channel % 2]);
        }

        return true;
    }
}

registerProcessor('main-processor', MainProcessor);
