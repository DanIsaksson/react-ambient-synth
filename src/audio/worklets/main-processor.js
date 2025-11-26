/**
 * MainProcessor V2 - Block-Based Architecture
 * 
 * PERFORMANCE FIX: Process entire 128-sample blocks per node
 * instead of iterating all nodes for each sample.
 * 
 * Old: O(samples × nodes × passes) = 3,082,240 iterations/sec @ 7 nodes
 * New: O(nodes) = 2,408 iterations/sec @ 7 nodes
 * 
 * Reference: Glicol, Elementary Audio, Web Synth architectures
 */

const BUFFER_SIZE = 128;

// Pre-compute constants
const TWO_PI = 2 * Math.PI;

// Node type flags (avoid string comparison in hot path)
const TYPE_OSCILLATOR = 1;
const TYPE_LFO = 2;
const TYPE_ENVELOPE = 3;
const TYPE_FILTER = 4;
const TYPE_OUTPUT = 5;
const TYPE_NOISE = 6;
const TYPE_RESONATOR = 7;
const TYPE_KARPLUS = 8;
const TYPE_SEQUENCER = 9;
const TYPE_EUCLIDEAN = 10;
const TYPE_TEXTURE = 11;
const TYPE_SPATIAL = 12;
const TYPE_PHYSICS = 13;

const TYPE_MAP = {
    'oscillator': TYPE_OSCILLATOR,
    'lfo': TYPE_LFO,
    'envelope': TYPE_ENVELOPE,
    'filter': TYPE_FILTER,
    'output': TYPE_OUTPUT,
    'noise': TYPE_NOISE,
    'resonator': TYPE_RESONATOR,
    'karplus': TYPE_KARPLUS,
    'sequencer': TYPE_SEQUENCER,
    'euclidean': TYPE_EUCLIDEAN,
    'texture': TYPE_TEXTURE,
    'spatial': TYPE_SPATIAL,
    'physics': TYPE_PHYSICS,
};

// Control node types (generate modulation signals, process first)
const CONTROL_TYPES = new Set([TYPE_LFO, TYPE_ENVELOPE, TYPE_NOISE, TYPE_SEQUENCER, TYPE_EUCLIDEAN]);

// Source node types (generate audio)
const SOURCE_TYPES = new Set([TYPE_OSCILLATOR, TYPE_RESONATOR, TYPE_TEXTURE, TYPE_PHYSICS]);

class MainProcessorV2 extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // Node storage: id -> NodeState
        this.nodes = new Map();
        
        // Connection storage
        this.connections = [];
        this.modulations = [];
        
        // Pre-allocated processing order (updated on graph change)
        this.processingOrder = [];
        this.outputNodeIds = [];
        
        // Macro values
        this.macros = new Map();
        
        // Health monitoring
        this._frameCount = 0;
        this._lastHeartbeatFrame = 0;
        this._heartbeatIntervalFrames = Math.floor(sampleRate / BUFFER_SIZE);
        
        // Diagnostic
        this._loggedFirstFrame = false;
        
        // Message handler
        this.port.onmessage = (event) => this.handleMessage(event.data);
    }
    
    handleMessage(data) {
        const { target, action, payload } = data;
        
        if (target === 'system') {
            switch (action) {
                case 'UPDATE_GRAPH':
                    this.updateGraph(payload);
                    break;
                case 'UPDATE_MACROS':
                    payload.forEach(m => this.macros.set(m.id, m.value));
                    break;
                case 'LOAD_SAMPLE_BUFFER':
                    this.loadSampleBuffer(payload);
                    break;
            }
        }
    }
    
    /**
     * Create a new node state with pre-allocated buffers
     */
    createNodeState(id, type, params) {
        const typeFlag = TYPE_MAP[type] || 0;
        
        return {
            id,
            type,
            typeFlag,
            params: params || {},
            
            // Pre-allocated output buffer (128 samples)
            buffer: new Float32Array(BUFFER_SIZE),
            
            // Modulation output (for control nodes)
            modBuffer: new Float32Array(BUFFER_SIZE),
            
            // Per-node state
            phase: 0,
            lfoPhase: 0,
            envState: 'idle',
            envValue: 0,
            envTime: 0,
            releaseStartLevel: 0,
            
            // Filter state
            filterState: { x1: 0, x2: 0, y1: 0, y2: 0 },
            filterCoeffs: null,
            
            // Resonator modes
            modes: null,
            exciteEnergy: 0,
            lastMaterial: null,
            
            // Karplus-Strong
            delayLine: null,
            ptr: 0,
            prevSample: 0,
            allpassState: 0,
            allpassOut: 0,
            dcBlocker: { x1: 0, y1: 0 },
            
            // Texture/Granular
            sampleBuffer: null,
            grainState: null,
            
            // Sequencer
            step: 0,
            stepTimer: 0,
            
            // S&H for random LFO
            lastRandom: 0,
            randomHoldCounter: 0,
            
            // Spatial
            pan: 0,
            
            // Physics
            physics: { y: 1, vy: 0 },
            
            // Per-node gain (for output nodes)
            gain: 1.0,
            isMuted: false,
        };
    }
    
    /**
     * Update graph - rebuild processing order
     */
    updateGraph(patch) {
        // Preserve existing node state where possible
        const oldNodes = new Map(this.nodes);
        this.nodes.clear();
        
        // Create/update nodes
        for (const node of patch.nodes) {
            const existing = oldNodes.get(node.id);
            if (existing && existing.type === node.type) {
                // Preserve state, update params
                existing.params = node.params;
                this.nodes.set(node.id, existing);
            } else {
                // New node
                this.nodes.set(node.id, this.createNodeState(node.id, node.type, node.params));
            }
        }
        
        this.connections = patch.connections || [];
        this.modulations = patch.modulations || [];
        
        // Rebuild processing order
        this.rebuildProcessingOrder();
        
        console.log('[MainProcessorV2] Graph updated:', {
            nodes: this.nodes.size,
            connections: this.connections.length,
            processingOrder: this.processingOrder.length,
        });
    }
    
    /**
     * Topological sort for correct processing order
     * Control nodes → Source nodes → Effect nodes → Output nodes
     */
    rebuildProcessingOrder() {
        this.processingOrder = [];
        this.outputNodeIds = [];
        
        const controlNodes = [];
        const sourceNodes = [];
        const effectNodes = [];
        const outputNodes = [];
        
        for (const [id, node] of this.nodes) {
            if (node.typeFlag === TYPE_OUTPUT) {
                outputNodes.push(node);
                this.outputNodeIds.push(id);
            } else if (CONTROL_TYPES.has(node.typeFlag)) {
                controlNodes.push(node);
            } else if (SOURCE_TYPES.has(node.typeFlag)) {
                sourceNodes.push(node);
            } else {
                effectNodes.push(node);
            }
        }
        
        // Processing order: Control → Source → Effects → Output
        this.processingOrder = [...controlNodes, ...sourceNodes, ...effectNodes, ...outputNodes];
    }
    
    loadSampleBuffer(payload) {
        const { nodeId, buffer, sampleRate: bufferSampleRate } = payload;
        const node = this.nodes.get(nodeId);
        if (node) {
            node.sampleBuffer = new Float32Array(buffer);
            node.bufferSampleRate = bufferSampleRate;
        }
    }
    
    /**
     * Main process function - BLOCK-BASED
     */
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const leftChannel = output[0];
        const rightChannel = output.length > 1 ? output[1] : output[0];
        const frameSize = leftChannel.length;
        
        // Health monitoring
        this._frameCount++;
        if (this._frameCount - this._lastHeartbeatFrame >= this._heartbeatIntervalFrames) {
            this._lastHeartbeatFrame = this._frameCount;
            this.port.postMessage({ type: 'HEARTBEAT', frameCount: this._frameCount });
        }
        
        // Zero output buffers
        leftChannel.fill(0);
        if (rightChannel !== leftChannel) rightChannel.fill(0);
        
        // Early exit if no nodes
        if (this.processingOrder.length === 0) return true;
        
        // ============================================
        // BLOCK-BASED PROCESSING
        // Process each node ONCE for the entire block
        // ============================================
        
        for (const node of this.processingOrder) {
            // Clear node's output buffer
            node.buffer.fill(0);
            
            switch (node.typeFlag) {
                case TYPE_LFO:
                    this.processLFOBlock(node, frameSize);
                    break;
                case TYPE_ENVELOPE:
                    this.processEnvelopeBlock(node, frameSize);
                    break;
                case TYPE_NOISE:
                    this.processNoiseBlock(node, frameSize);
                    break;
                case TYPE_OSCILLATOR:
                    this.processOscillatorBlock(node, frameSize);
                    break;
                case TYPE_RESONATOR:
                    this.processResonatorBlock(node, frameSize);
                    break;
                case TYPE_TEXTURE:
                    this.processTextureBlock(node, frameSize);
                    break;
                case TYPE_FILTER:
                    this.processFilterBlock(node, frameSize);
                    break;
                case TYPE_KARPLUS:
                    this.processKarplusBlock(node, frameSize);
                    break;
                case TYPE_SPATIAL:
                    this.processSpatialBlock(node, frameSize);
                    break;
                case TYPE_OUTPUT:
                    this.processOutputBlock(node, frameSize, leftChannel, rightChannel);
                    break;
            }
        }
        
        // Hard clip output
        for (let i = 0; i < frameSize; i++) {
            leftChannel[i] = Math.max(-1, Math.min(1, leftChannel[i]));
            rightChannel[i] = Math.max(-1, Math.min(1, rightChannel[i]));
        }
        
        // Diagnostic: log first frame
        if (!this._loggedFirstFrame && this._frameCount === 1) {
            this._loggedFirstFrame = true;
            let maxSample = 0;
            for (let i = 0; i < frameSize; i++) {
                const abs = Math.abs(leftChannel[i]);
                if (abs > maxSample) maxSample = abs;
            }
            console.log('[MainProcessorV2] First frame max amplitude:', maxSample.toFixed(4));
        }
        
        return true;
    }
    
    // ========================================
    // BLOCK PROCESSORS
    // Each processes entire 128-sample buffer at once
    // ========================================
    
    processLFOBlock(node, frameSize) {
        const freq = node.params.frequency ?? 1;
        const depth = node.params.depth ?? 1;
        const waveform = node.params.waveform || 'sine';
        const phaseInc = (freq * TWO_PI) / sampleRate;
        
        for (let i = 0; i < frameSize; i++) {
            const normalizedPhase = node.lfoPhase / TWO_PI;
            let signal;
            
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
                case 'random':
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
            
            node.modBuffer[i] = signal * depth;
            node.lfoPhase += phaseInc;
            if (node.lfoPhase >= TWO_PI) node.lfoPhase -= TWO_PI;
        }
    }
    
    processEnvelopeBlock(node, frameSize) {
        const attack = (node.params.attack ?? 10) / 1000;
        const decay = (node.params.decay ?? 100) / 1000;
        const sustain = (node.params.sustain ?? 70) / 100;
        const release = (node.params.release ?? 300) / 1000;
        const dt = 1 / sampleRate;
        
        // Check triggers
        if (node.params.trigger) {
            node.envState = 'attack';
            node.envTime = 0;
            node.params.trigger = false;
        }
        if (node.params.gateOff && node.envState !== 'idle' && node.envState !== 'release') {
            node.envState = 'release';
            node.envTime = 0;
            node.releaseStartLevel = node.envValue;
            node.params.gateOff = false;
        }
        
        for (let i = 0; i < frameSize; i++) {
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
                    node.envValue = 1 - (1 - sustain) * (decay > 0 ? node.envTime / decay : 1);
                    if (node.envTime >= decay) {
                        node.envState = 'sustain';
                    }
                    break;
                case 'sustain':
                    node.envValue = sustain;
                    break;
                case 'release':
                    node.envValue = node.releaseStartLevel * (1 - (release > 0 ? node.envTime / release : 1));
                    if (node.envValue <= 0 || node.envTime >= release) {
                        node.envValue = 0;
                        node.envState = 'idle';
                    }
                    break;
                default:
                    node.envValue = 0;
            }
            
            node.modBuffer[i] = node.envValue;
            node.envTime += dt;
        }
    }
    
    processNoiseBlock(node, frameSize) {
        const type = node.params.type || 'white';
        let lastValue = node.lastNoiseValue || 0;
        
        for (let i = 0; i < frameSize; i++) {
            let sample;
            switch (type) {
                case 'pink':
                    // Simplified pink noise approximation
                    const white = Math.random() * 2 - 1;
                    lastValue = lastValue * 0.99 + white * 0.01;
                    sample = lastValue * 10;
                    break;
                case 'brown':
                    lastValue += (Math.random() * 2 - 1) * 0.02;
                    lastValue = Math.max(-1, Math.min(1, lastValue));
                    sample = lastValue;
                    break;
                default: // white
                    sample = Math.random() * 2 - 1;
            }
            node.modBuffer[i] = sample * (node.params.depth ?? 1);
        }
        node.lastNoiseValue = lastValue;
    }
    
    processOscillatorBlock(node, frameSize) {
        if (node.params.isMuted) {
            // Still advance phase for continuity
            const freq = node.params.freq ?? 440;
            node.phase += (freq * TWO_PI * frameSize) / sampleRate;
            while (node.phase >= TWO_PI) node.phase -= TWO_PI;
            return;
        }
        
        // Apply modulation to frequency
        let baseFreq = node.params.freq ?? 440;
        const freqMod = this.getModulationValue(node.id, 'freq');
        
        const waveform = node.params.waveform ?? 'sine';
        
        for (let i = 0; i < frameSize; i++) {
            // Per-sample frequency modulation
            const freq = baseFreq + (freqMod ? freqMod[i] * 100 : 0);
            const phaseInc = (freq * TWO_PI) / sampleRate;
            
            const normalizedPhase = node.phase / TWO_PI;
            let sample;
            
            switch (waveform) {
                case 'sine':
                    sample = Math.sin(node.phase);
                    break;
                case 'square':
                    sample = normalizedPhase < 0.5 ? 1 : -1;
                    break;
                case 'sawtooth':
                    sample = 2 * normalizedPhase - 1;
                    break;
                case 'triangle':
                    sample = 4 * Math.abs(normalizedPhase - 0.5) - 1;
                    break;
                default:
                    sample = Math.sin(node.phase);
            }
            
            node.buffer[i] = sample;
            node.phase += phaseInc;
            if (node.phase >= TWO_PI) node.phase -= TWO_PI;
        }
    }
    
    processResonatorBlock(node, frameSize) {
        if (node.params.isMuted) return;
        
        // Initialize modes if needed
        if (!node.modes) {
            node.modes = [];
            for (let m = 0; m < 8; m++) {
                node.modes.push({ z1: 0, z2: 0, freq: 0, amp: 0 });
            }
        }
        
        const material = node.params.material ?? 'wood';
        const baseFreq = node.params.frequency ?? 440;
        const decay = node.params.decay ?? 0.5;
        const brightness = node.params.brightness ?? 0.5;
        
        // Recalculate coefficients if material changed
        if (node.lastMaterial !== material) {
            node.lastMaterial = material;
            let ratios, qBase;
            
            switch (material) {
                case 'glass':
                    ratios = [1, 2.32, 3.85, 5.17, 6.71, 8.12, 9.88, 11.21];
                    qBase = 800;
                    break;
                case 'metal':
                    ratios = [1, 1.58, 2.0, 2.51, 2.92, 3.46, 4.0, 4.58];
                    qBase = 500;
                    break;
                default: // wood
                    ratios = [1, 2.0, 3.0, 4.02, 5.0, 6.01, 7.0, 8.02];
                    qBase = 150;
            }
            
            for (let m = 0; m < 8; m++) {
                const modeFreq = baseFreq * ratios[m];
                const modeQ = qBase * (1 + decay) * (1 - m * 0.08);
                const modeAmp = Math.pow(0.7, m) * (0.5 + brightness * 0.5);
                
                const omega = TWO_PI * modeFreq / sampleRate;
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
            }
        }
        
        // Handle trigger
        if (node.params.trigger) {
            node.exciteEnergy = 1.0;
            node.params.trigger = false;
        }
        
        for (let i = 0; i < frameSize; i++) {
            let excitation = 0;
            if (node.exciteEnergy > 0.001) {
                excitation = (Math.random() * 2 - 1) * node.exciteEnergy;
                node.exciteEnergy *= 0.95;
            }
            
            let output = 0;
            for (const mode of node.modes) {
                const y = (mode.b0 * excitation + mode.b1 * mode.z1 + mode.b2 * mode.z2
                           - mode.a1 * mode.z1 - mode.a2 * mode.z2) * mode.a0inv;
                mode.z2 = mode.z1;
                mode.z1 = y;
                output += y * mode.amp;
            }
            
            node.buffer[i] = output * 0.3;
        }
    }
    
    processTextureBlock(node, frameSize) {
        // Simplified texture/granular - full implementation would use WASM
        if (!node.sampleBuffer || node.sampleBuffer.length === 0) return;
        
        const position = node.params.position ?? 0.5;
        const grainSize = node.params.grainSize ?? 0.1;
        
        // Simple playback for now
        const startSample = Math.floor(position * node.sampleBuffer.length);
        for (let i = 0; i < frameSize; i++) {
            const idx = (startSample + i) % node.sampleBuffer.length;
            node.buffer[i] = node.sampleBuffer[idx] * 0.5;
        }
    }
    
    processFilterBlock(node, frameSize) {
        // Get input from connected source
        const inputBuffer = this.getInputBuffer(node.id);
        if (!inputBuffer) return;
        
        const cutoff = Math.max(20, Math.min(20000, node.params.cutoff ?? 1000));
        const resonance = Math.max(0.1, Math.min(30, node.params.resonance ?? 1));
        const filterType = node.params.filterType ?? 'lowpass';
        
        // Calculate coefficients
        const omega = TWO_PI * cutoff / sampleRate;
        const sinOmega = Math.sin(omega);
        const cosOmega = Math.cos(omega);
        const alpha = sinOmega / (2 * resonance);
        
        let b0, b1, b2, a0, a1, a2;
        
        switch (filterType) {
            case 'highpass':
                b0 = (1 + cosOmega) / 2;
                b1 = -(1 + cosOmega);
                b2 = (1 + cosOmega) / 2;
                break;
            case 'bandpass':
                b0 = alpha;
                b1 = 0;
                b2 = -alpha;
                break;
            default: // lowpass
                b0 = (1 - cosOmega) / 2;
                b1 = 1 - cosOmega;
                b2 = (1 - cosOmega) / 2;
        }
        a0 = 1 + alpha;
        a1 = -2 * cosOmega;
        a2 = 1 - alpha;
        
        // Normalize
        b0 /= a0; b1 /= a0; b2 /= a0;
        a1 /= a0; a2 /= a0;
        
        const st = node.filterState;
        
        for (let i = 0; i < frameSize; i++) {
            const x = inputBuffer[i];
            const y = b0 * x + b1 * st.x1 + b2 * st.x2 - a1 * st.y1 - a2 * st.y2;
            
            st.x2 = st.x1;
            st.x1 = x;
            st.y2 = st.y1;
            st.y1 = y;
            
            node.buffer[i] = y;
        }
    }
    
    processKarplusBlock(node, frameSize) {
        // Get input from connected source
        const inputBuffer = this.getInputBuffer(node.id);
        
        const freq = node.params.frequency ?? 220;
        const damping = node.params.damping ?? 0.5;
        const brightness = node.params.brightness ?? 0.5;
        
        const delayLen = Math.floor(sampleRate / freq);
        
        // Initialize delay line
        if (!node.delayLine || node.delayLine.length !== delayLen + 1) {
            node.delayLine = new Float32Array(delayLen + 1);
            node.ptr = 0;
        }
        
        // Handle trigger
        if (node.params.trigger) {
            node.exciteEnergy = 1.0;
            node.params.trigger = false;
        }
        
        for (let i = 0; i < frameSize; i++) {
            // Excitation
            if (node.exciteEnergy > 0.001) {
                node.delayLine[node.ptr] += (Math.random() * 2 - 1) * node.exciteEnergy * 0.5;
                node.exciteEnergy *= 0.85;
            }
            
            // External input
            if (inputBuffer) {
                node.delayLine[node.ptr] += inputBuffer[i] * 0.3;
            }
            
            // Read with interpolation
            const readIdx = (node.ptr - delayLen + node.delayLine.length) % node.delayLine.length;
            const readIdx2 = (readIdx + 1) % node.delayLine.length;
            const delayedSample = (node.delayLine[readIdx] + node.delayLine[readIdx2]) * 0.5;
            
            // Lowpass (damping)
            const lpCoeff = 0.3 + brightness * 0.6 - damping * 0.3;
            const filtered = (1 - lpCoeff) * delayedSample + lpCoeff * node.prevSample;
            node.prevSample = filtered;
            
            // Feedback
            const decayFactor = 0.998 - damping * 0.01;
            node.delayLine[node.ptr] = filtered * decayFactor;
            
            node.buffer[i] = filtered;
            node.ptr = (node.ptr + 1) % node.delayLine.length;
        }
    }
    
    processSpatialBlock(node, frameSize) {
        const inputBuffer = this.getInputBuffer(node.id);
        if (!inputBuffer) return;
        
        const x = node.params.x ?? 0;
        const y = node.params.y ?? 0;
        const z = node.params.z ?? 0;
        
        const distance = Math.sqrt(x * x + y * y + z * z);
        const attenuation = 1 / (1 + distance * 0.1);
        const pan = Math.max(-1, Math.min(1, x / 10));
        
        node.pan = pan;
        
        for (let i = 0; i < frameSize; i++) {
            node.buffer[i] = inputBuffer[i] * attenuation;
        }
    }
    
    processOutputBlock(node, frameSize, leftChannel, rightChannel) {
        // Get per-node gain from params (synced from OutputNode UI)
        const isMuted = node.params.isMuted ?? false;
        const gain = isMuted ? 0 : (node.params.gain ?? 0.7);
        
        // Sum all connections to this output
        for (const conn of this.connections) {
            if (conn.target === node.id) {
                const sourceNode = this.nodes.get(conn.source);
                if (sourceNode) {
                    const pan = sourceNode.pan ?? 0;
                    const leftGain = Math.cos((pan + 1) * Math.PI / 4) * gain * 0.5;
                    const rightGain = Math.sin((pan + 1) * Math.PI / 4) * gain * 0.5;
                    
                    for (let i = 0; i < frameSize; i++) {
                        leftChannel[i] += sourceNode.buffer[i] * leftGain;
                        rightChannel[i] += sourceNode.buffer[i] * rightGain;
                    }
                }
            }
        }
    }
    
    /**
     * Get input buffer from first connected source
     */
    getInputBuffer(nodeId) {
        for (const conn of this.connections) {
            if (conn.target === nodeId) {
                const sourceNode = this.nodes.get(conn.source);
                if (sourceNode) return sourceNode.buffer;
            }
        }
        return null;
    }
    
    /**
     * Get modulation buffer for a target parameter
     */
    getModulationValue(nodeId, param) {
        for (const mod of this.modulations) {
            if (mod.targetId === nodeId && mod.targetParam === param) {
                const sourceNode = this.nodes.get(mod.sourceId);
                if (sourceNode) {
                    return sourceNode.modBuffer;
                }
            }
        }
        return null;
    }
}

registerProcessor('main-processor', MainProcessorV2);
