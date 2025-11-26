class MainProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.nodes = new Map(); // id -> { type, params, modulatedParams, state }
        this.connections = []; // { source, target, sourceHandle, targetHandle }
        this.modulations = []; // { sourceId, targetId, targetParam, amount, bipolar }
        this.macros = new Map(); // id -> value
        this.processCallCount = 0; // DIAGNOSTIC: Track process calls
        
        // PERF: Pre-allocated Set for output nodes (reused each frame)
        this._outputNodeIds = new Set();
        
        // Health monitoring: send heartbeat to main thread every ~1 second
        this._frameCount = 0;
        this._lastHeartbeatFrame = 0;
        this._heartbeatIntervalFrames = Math.floor(sampleRate / 128); // ~1 second at 128 samples/block
        
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
                } else if (action === 'LOAD_SAMPLE_BUFFER') {
                    // Load sample buffer for granular texture node
                    const { nodeId, buffer, sampleRate: bufferSampleRate } = payload;
                    const node = this.nodes.get(nodeId);
                    if (node) {
                        node.sampleBuffer = buffer;
                        node.bufferSampleRate = bufferSampleRate;
                        console.log(`[MainProcessor] Loaded sample buffer for node ${nodeId}, length: ${buffer.length}`);
                    }
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
     * Process Euclidean rhythm generators - generates gate/trigger signals
     */
    processEuclideans() {
        for (const [id, node] of this.nodes) {
            if (node.type === 'euclidean') {
                // Initialize state
                if (node.eucState === undefined) {
                    node.eucState = {
                        phase: 0,           // Current phase in pattern (0-1)
                        lastStep: -1,       // Last processed step
                        pattern: [],        // Euclidean pattern (boolean array)
                        gateLevel: 0,       // Current gate output level
                        gateDecay: 0,       // Gate decay counter
                    };
                }

                // Get parameters
                const steps = Math.max(1, Math.min(32, Math.round(node.params?.steps ?? 8)));
                const pulses = Math.max(0, Math.min(steps, Math.round(node.params?.pulses ?? 3)));
                const rotation = Math.round(node.params?.rotation ?? 0);
                const tempo = node.params?.tempo ?? 120;
                const isPlaying = node.params?.playing ?? false;

                // Regenerate pattern if parameters changed
                const patternKey = `${steps}-${pulses}-${rotation}`;
                if (node.eucState.patternKey !== patternKey) {
                    node.eucState.pattern = this.generateEuclideanPattern(steps, pulses, rotation);
                    node.eucState.patternKey = patternKey;
                }

                // Advance phase if playing
                if (isPlaying) {
                    // Calculate phase increment based on tempo
                    // One full pattern = 'steps' beats
                    const beatsPerSecond = tempo / 60;
                    const patternDuration = steps / beatsPerSecond;
                    const phaseInc = (1 / sampleRate) / patternDuration;
                    node.eucState.phase = (node.eucState.phase + phaseInc) % 1;

                    // Determine current step
                    const currentStep = Math.floor(node.eucState.phase * steps);

                    // Trigger on new step
                    if (currentStep !== node.eucState.lastStep) {
                        node.eucState.lastStep = currentStep;

                        // Check if this step has a pulse
                        if (node.eucState.pattern[currentStep]) {
                            node.eucState.gateLevel = 1;
                            node.eucState.gateDecay = Math.floor(sampleRate * 0.05); // 50ms gate
                            
                            // Send trigger to connected nodes
                            this.sendTrigger(id);
                        }
                    }
                }

                // Decay gate
                if (node.eucState.gateDecay > 0) {
                    node.eucState.gateDecay--;
                    if (node.eucState.gateDecay === 0) {
                        node.eucState.gateLevel = 0;
                    }
                }

                // Output gate signal (used for routing)
                node.gateOutput = node.eucState.gateLevel;
                node.output = node.eucState.gateLevel; // Also set output for visualization
            }
        }
    }

    /**
     * Generate Euclidean rhythm pattern using Bjorklund's algorithm
     */
    generateEuclideanPattern(steps, pulses, rotation) {
        if (pulses === 0) return new Array(steps).fill(false);
        if (pulses >= steps) return new Array(steps).fill(true);

        // Bjorklund's algorithm
        let pattern = [];
        let counts = [];
        let remainders = [];

        let divisor = steps - pulses;
        remainders.push(pulses);
        let level = 0;

        while (remainders[level] > 1) {
            counts.push(Math.floor(divisor / remainders[level]));
            remainders.push(divisor % remainders[level]);
            divisor = remainders[level];
            level++;
        }

        counts.push(divisor);

        // Build pattern
        const buildPattern = (level) => {
            if (level === -1) {
                pattern.push(false);
            } else if (level === -2) {
                pattern.push(true);
            } else {
                for (let i = 0; i < counts[level]; i++) {
                    buildPattern(level - 1);
                }
                if (remainders[level] !== 0) {
                    buildPattern(level - 2);
                }
            }
        };

        buildPattern(level);

        // Apply rotation
        const rot = ((rotation % steps) + steps) % steps;
        pattern = [...pattern.slice(rot), ...pattern.slice(0, rot)];

        return pattern;
    }

    /**
     * Send trigger signal to connected nodes (e.g., Karplus, Sample)
     * For Sample nodes, posts message to main thread to trigger playback
     */
    sendTrigger(sourceId) {
        for (const conn of this.connections) {
            if (conn.source === sourceId && 
                (conn.sourceHandle === 'gate' || conn.sourceHandle === 'trigger' || conn.sourceHandle === 'out')) {
                const targetNode = this.nodes.get(conn.target);
                if (targetNode) {
                    // Set trigger flag on target node (for worklet-processed nodes)
                    if (!targetNode.params) targetNode.params = {};
                    targetNode.params.trigger = true;
                    
                    // For Sample nodes: post message to main thread
                    // Sample playback uses native Web Audio, not worklet
                    if (targetNode.type === 'sample') {
                        this.port.postMessage({
                            type: 'SAMPLE_TRIGGER',
                            nodeId: conn.target,
                            sampleId: targetNode.params?.sample,
                        });
                    }
                }
            }
        }
    }

    /**
     * Process Texture (Granular) nodes - generates audio output from grain cloud
     * Requires sample buffer to be loaded via LOAD_SAMPLE_BUFFER message
     */
    processTextures() {
        for (const [id, node] of this.nodes) {
            if (node.type === 'texture') {
                // Skip if not playing or no buffer loaded
                if (!node.params?.playing) {
                    node.output = 0;
                    continue;
                }

                // Initialize granular state
                if (!node.granular) {
                    node.granular = {
                        grains: [],           // Active grains
                        nextGrainTime: 0,     // When to spawn next grain (in samples)
                        sampleCounter: 0,     // Sample counter for timing
                    };
                }

                // If no buffer loaded, output silence
                // Buffer is loaded via LOAD_SAMPLE_BUFFER message
                if (!node.sampleBuffer || node.sampleBuffer.length === 0) {
                    node.output = 0;
                    continue;
                }

                // Get parameters
                const position = node.params?.position ?? 0.5;      // 0-1 normalized position
                const spray = node.params?.spray ?? 0.2;            // Position randomization
                const density = node.params?.density ?? 30;         // Grains per second
                const grainSize = node.params?.size ?? 0.1;         // Grain duration in seconds
                const pitch = node.params?.pitch ?? 1.0;            // Playback rate

                const bufferLength = node.sampleBuffer.length;
                const grainSamples = Math.floor(grainSize * sampleRate);
                const grainInterval = Math.floor(sampleRate / Math.max(1, density));

                // Spawn new grain if it's time
                if (node.granular.sampleCounter >= node.granular.nextGrainTime) {
                    // Calculate grain start position with spray randomization
                    const posRandom = (Math.random() - 0.5) * spray;
                    const grainPos = Math.max(0, Math.min(1, position + posRandom));
                    const startSample = Math.floor(grainPos * bufferLength);

                    // Create new grain
                    node.granular.grains.push({
                        position: startSample,              // Current read position
                        startPosition: startSample,         // Original start
                        length: grainSamples,               // Total grain length
                        age: 0,                             // Current sample within grain
                        pitch: pitch * (0.95 + Math.random() * 0.1), // Slight pitch variation
                        amp: 0.6 + Math.random() * 0.4,     // Random amplitude
                    });

                    // Schedule next grain
                    node.granular.nextGrainTime = node.granular.sampleCounter + grainInterval;
                }

                // Process all active grains and sum output
                let output = 0;
                const remainingGrains = [];

                for (const grain of node.granular.grains) {
                    if (grain.age < grain.length) {
                        // Calculate envelope (Hann window for smooth grains)
                        const envelope = 0.5 * (1 - Math.cos(2 * Math.PI * grain.age / grain.length));

                        // Read sample with linear interpolation
                        const readPos = grain.position;
                        const index = Math.floor(readPos);
                        const frac = readPos - index;

                        if (index >= 0 && index < bufferLength - 1) {
                            const sample = node.sampleBuffer[index] * (1 - frac) + 
                                          node.sampleBuffer[index + 1] * frac;
                            output += sample * envelope * grain.amp;
                        }

                        // Advance grain position by pitch rate
                        grain.position += grain.pitch;
                        grain.age++;

                        // Keep grain if still alive
                        remainingGrains.push(grain);
                    }
                }

                // Update active grains list
                node.granular.grains = remainingGrains;
                node.granular.sampleCounter++;

                // Normalize output (prevent clipping with many grains)
                const numGrains = Math.max(1, remainingGrains.length);
                node.output = output / Math.sqrt(numGrains) * 0.7;
            }
        }
    }

    /**
     * Process Step Sequencer nodes - generates gate signals based on step pattern
     * Similar to Euclidean but with user-defined step pattern instead of algorithm
     */
    processSequencers() {
        for (const [id, node] of this.nodes) {
            if (node.type === 'sequencer') {
                // Initialize state
                if (node.seqState === undefined) {
                    node.seqState = {
                        phase: 0,           // Current phase in pattern (0-1)
                        lastStep: -1,       // Last processed step
                        gateLevel: 0,       // Current gate output level
                        gateDecay: 0,       // Gate decay counter
                    };
                }

                // Get parameters from node
                const bpm = node.params?.bpm ?? 120;
                const steps = node.params?.steps ?? [true, false, true, false, true, false, true, false];
                const isPlaying = node.params?.playing ?? false;
                const numSteps = steps.length;

                // Advance phase if playing
                if (isPlaying && numSteps > 0) {
                    // Calculate phase increment based on BPM
                    // 8 steps = 2 bars at 4/4, each step = 8th note
                    const beatsPerSecond = bpm / 60;
                    const stepsPerSecond = beatsPerSecond * 2; // 8th notes
                    const patternDuration = numSteps / stepsPerSecond;
                    const phaseInc = (1 / sampleRate) / patternDuration;
                    node.seqState.phase = (node.seqState.phase + phaseInc) % 1;

                    // Determine current step
                    const currentStep = Math.floor(node.seqState.phase * numSteps);

                    // Trigger on new step
                    if (currentStep !== node.seqState.lastStep) {
                        node.seqState.lastStep = currentStep;

                        // Check if this step is active
                        if (steps[currentStep]) {
                            node.seqState.gateLevel = 1;
                            node.seqState.gateDecay = Math.floor(sampleRate * 0.05); // 50ms gate
                            
                            // Send trigger to connected nodes
                            this.sendTrigger(id);
                        }
                    }
                } else if (!isPlaying) {
                    // Reset when stopped
                    node.seqState.phase = 0;
                    node.seqState.lastStep = -1;
                }

                // Decay gate
                if (node.seqState.gateDecay > 0) {
                    node.seqState.gateDecay--;
                    if (node.seqState.gateDecay === 0) {
                        node.seqState.gateLevel = 0;
                    }
                }

                // Output gate signal (consumed by connected effect nodes)
                node.gateOutput = node.seqState.gateLevel;
                node.output = node.seqState.gateLevel;
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
        // PERF: Reuse modulatedParams object instead of spreading
        for (const node of this.nodes.values()) {
            if (!node.modulatedParams) {
                node.modulatedParams = {};
            }
            // Copy params manually to avoid object spread allocation
            const params = node.params;
            const modParams = node.modulatedParams;
            for (const key in params) {
                modParams[key] = params[key];
            }
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
        // HEALTH MONITORING: Send heartbeat to main thread
        // ========================================
        this._frameCount++;
        if (this._frameCount - this._lastHeartbeatFrame >= this._heartbeatIntervalFrames) {
            this._lastHeartbeatFrame = this._frameCount;
            this.port.postMessage({
                type: 'HEARTBEAT',
                frameCount: this._frameCount,
                timestamp: currentTime,
            });
        }

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
        // PERF: Reuse pre-allocated Set to avoid GC pressure
        this._outputNodeIds.clear();
        for (const [id, node] of this.nodes) {
            if (node.type === 'output') {
                this._outputNodeIds.add(id);
            }
        }
        const outputNodeIds = this._outputNodeIds;

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
            // 1. Process CONTROL nodes (generate modulation/gate signals)
            // ========================================
            this.processLFOs();
            this.processEnvelopes();
            this.processNoiseModulators();
            this.processEuclideans();
            this.processSequencers();

            // ========================================
            // 2. Apply MODULATION routing
            // ========================================
            this.applyModulations();

            // ========================================
            // 3. Process SOURCE nodes (using modulatedParams)
            // ========================================
            
            // 3a. Process Texture (Granular) nodes
            this.processTextures();

            // 3b. Update Physics
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

            // 3c. Karplus-Strong nodes are processed later as effects (they need input)

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
                
                // ==========================================
                // KARPLUS-STRONG: String synthesis with input excitation
                // ==========================================
                // Takes trigger/gate input OR audio input and processes through string model
                if (targetNode && targetNode.type === 'karplus' && sourceNode) {
                    // Skip if muted
                    if (targetNode.params?.isMuted) continue;
                    
                    // Initialize delay line if needed
                    if (!targetNode.delayLine) {
                        targetNode.delayLine = new Float32Array(4096);
                        targetNode.ptr = 0;
                        targetNode.prevSample = 0;
                        targetNode.allpassState = 0;
                        targetNode.allpassOut = 0;
                        targetNode.dcBlocker = { x1: 0, y1: 0 };
                        targetNode.exciteEnergy = 0;
                    }

                    // Parameters (use modulatedParams for modulation support)
                    const freq = targetNode.modulatedParams?.frequency ?? targetNode.params?.frequency ?? 220;
                    const damping = targetNode.modulatedParams?.damping ?? targetNode.params?.damping ?? 0.5;
                    const stiffness = targetNode.modulatedParams?.stiffness ?? targetNode.params?.stiffness ?? 0;
                    const brightness = targetNode.modulatedParams?.brightness ?? targetNode.params?.brightness ?? 0.5;

                    // Calculate delay length based on frequency
                    const delayLen = Math.max(8, Math.min(4000, Math.floor(sampleRate / freq)));

                    // Get input signal from connected source
                    const inputSignal = sourceNode.output || 0;
                    const sourceIsGate = sourceNode.type === 'euclidean' || sourceNode.type === 'sequencer';
                    const sourceIsTrigger = sourceNode.gateOutput !== undefined;
                    
                    // Excitation: Use input signal to excite the string
                    if (sourceIsGate || sourceIsTrigger) {
                        // Gate/Trigger input: Use gate edges to trigger noise burst
                        const gateVal = sourceNode.gateOutput ?? inputSignal;
                        if (gateVal > 0.5 && !targetNode.lastGate) {
                            // Rising edge - trigger excitation
                            targetNode.exciteEnergy = 1.0;
                        }
                        targetNode.lastGate = gateVal > 0.5;
                        
                        // Apply excitation energy as noise burst
                        if (targetNode.exciteEnergy > 0.01) {
                            const noiseAmp = targetNode.exciteEnergy * 0.8;
                            targetNode.delayLine[targetNode.ptr] += (Math.random() * 2 - 1) * noiseAmp;
                            targetNode.exciteEnergy *= 0.85; // Quick decay
                        }
                    } else {
                        // Audio input: Use audio signal directly as excitation
                        // This allows oscillators/noise to excite the string
                        targetNode.delayLine[targetNode.ptr] += inputSignal * 0.5;
                    }

                    // Read from delay line with linear interpolation
                    const readPos = targetNode.ptr - delayLen;
                    const readIdx = ((readPos % targetNode.delayLine.length) + targetNode.delayLine.length) % targetNode.delayLine.length;
                    const readIdx2 = (readIdx + 1) % targetNode.delayLine.length;
                    const frac = readPos - Math.floor(readPos);
                    const delayedSample = targetNode.delayLine[readIdx] * (1 - frac) + targetNode.delayLine[readIdx2] * frac;

                    // Lowpass filter (damping/brightness control)
                    const lpCoeff = Math.max(0, Math.min(0.99, 0.3 + brightness * 0.6 - damping * 0.3));
                    const lpFiltered = (1 - lpCoeff) * delayedSample + lpCoeff * targetNode.prevSample;
                    targetNode.prevSample = lpFiltered;

                    // Allpass filter for stiffness (inharmonic partials)
                    let filtered = lpFiltered;
                    if (stiffness > 0.01) {
                        const apCoeff = stiffness * 0.5;
                        const apOut = -apCoeff * lpFiltered + targetNode.allpassState + apCoeff * targetNode.allpassOut;
                        targetNode.allpassState = lpFiltered;
                        targetNode.allpassOut = apOut;
                        filtered = apOut;
                    }

                    // Feedback with decay
                    const decayFactor = 0.998 - damping * 0.01;
                    const feedback = filtered * decayFactor;

                    // DC blocker
                    const dcCoeff = 0.995;
                    const dcOut = feedback - targetNode.dcBlocker.x1 + dcCoeff * targetNode.dcBlocker.y1;
                    targetNode.dcBlocker.x1 = feedback;
                    targetNode.dcBlocker.y1 = dcOut;

                    // Write back to delay line and output
                    targetNode.delayLine[targetNode.ptr] = dcOut;
                    targetNode.output = dcOut;

                    // Advance pointer
                    targetNode.ptr = (targetNode.ptr + 1) % targetNode.delayLine.length;
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
        // DIAGNOSTIC: Log first non-zero audio output (only first 5 frames)
        // ========================================
        if (this.processCallCount <= 5) {
            // PERF: Manual loop instead of spread+map to avoid allocation
            let maxSample = 0;
            const ch0 = output[0];
            for (let j = 0; j < ch0.length; j++) {
                const abs = ch0[j] < 0 ? -ch0[j] : ch0[j];
                if (abs > maxSample) maxSample = abs;
            }
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
