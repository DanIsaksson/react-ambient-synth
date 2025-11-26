/**
 * SpatialEngine - Native Web Audio 3D spatial audio processing.
 * 
 * Uses the browser's built-in PannerNode with HRTF for realistic 3D positioning.
 * This runs on the main thread (not AudioWorklet) because:
 * 1. PannerNode is already heavily optimized in browsers
 * 2. HRTF convolution would be complex to reimplement in worklet
 * 3. Matches our hybrid architecture (similar to SampleEngine)
 * 
 * @module audio/engine/SpatialEngine
 */

// ===========================================
// TYPES
// ===========================================

export interface SpatialNodeParams {
  x: number;
  y: number;
  z: number;
  distanceModel: 'linear' | 'inverse' | 'exponential';
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
}

interface SpatialNodeInstance {
  input: GainNode;
  panner: PannerNode;
  output: GainNode;
  params: SpatialNodeParams;
}

const DEFAULT_PARAMS: SpatialNodeParams = {
  x: 0,
  y: 0,
  z: 0,
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 100,
  rolloffFactor: 1,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
};

// ===========================================
// SPATIAL ENGINE CLASS
// ===========================================

export class SpatialEngine {
  private audioContext: AudioContext;
  private nodes: Map<string, SpatialNodeInstance> = new Map();
  private masterOutput: GainNode | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.setupListener();
    console.log('[SpatialEngine] Initialized');
  }

  /**
   * Configure the audio listener (camera/player position).
   */
  private setupListener(): void {
    const listener = this.audioContext.listener;
    
    // Position at origin
    if (listener.positionX) {
      listener.positionX.setValueAtTime(0, this.audioContext.currentTime);
      listener.positionY.setValueAtTime(0, this.audioContext.currentTime);
      listener.positionZ.setValueAtTime(0, this.audioContext.currentTime);
    }
    
    // Forward direction: -Z
    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(0, this.audioContext.currentTime);
      listener.forwardY.setValueAtTime(0, this.audioContext.currentTime);
      listener.forwardZ.setValueAtTime(-1, this.audioContext.currentTime);
    }
    
    // Up direction: +Y
    if (listener.upX) {
      listener.upX.setValueAtTime(0, this.audioContext.currentTime);
      listener.upY.setValueAtTime(1, this.audioContext.currentTime);
      listener.upZ.setValueAtTime(0, this.audioContext.currentTime);
    }
  }

  /**
   * Connect the engine's output to a destination node.
   */
  connect(destination: AudioNode): void {
    this.masterOutput = this.audioContext.createGain();
    this.masterOutput.connect(destination);
    
    // Reconnect all existing nodes
    for (const [, node] of this.nodes) {
      node.output.connect(this.masterOutput);
    }
    
    console.log('[SpatialEngine] Connected to destination');
  }

  /**
   * Create or get a spatial processing node for a graph node ID.
   * Returns the input GainNode that sources should connect to.
   */
  getOrCreateNode(nodeId: string, params?: Partial<SpatialNodeParams>): GainNode {
    let node = this.nodes.get(nodeId);
    
    if (!node) {
      // Create new spatial node chain: input → panner → output
      const input = this.audioContext.createGain();
      const panner = this.audioContext.createPanner();
      const output = this.audioContext.createGain();
      
      // Configure panner with HRTF for realistic 3D
      panner.panningModel = 'HRTF';
      panner.distanceModel = DEFAULT_PARAMS.distanceModel;
      panner.refDistance = DEFAULT_PARAMS.refDistance;
      panner.maxDistance = DEFAULT_PARAMS.maxDistance;
      panner.rolloffFactor = DEFAULT_PARAMS.rolloffFactor;
      panner.coneInnerAngle = DEFAULT_PARAMS.coneInnerAngle;
      panner.coneOuterAngle = DEFAULT_PARAMS.coneOuterAngle;
      panner.coneOuterGain = DEFAULT_PARAMS.coneOuterGain;
      
      // Chain nodes
      input.connect(panner);
      panner.connect(output);
      
      // Connect to master if available
      if (this.masterOutput) {
        output.connect(this.masterOutput);
      }
      
      node = {
        input,
        panner,
        output,
        params: { ...DEFAULT_PARAMS, ...params },
      };
      
      this.nodes.set(nodeId, node);
      console.log('[SpatialEngine] Created node:', nodeId);
    }
    
    // Apply any new params
    if (params) {
      this.setParams(nodeId, params);
    }
    
    return node.input;
  }

  /**
   * Get the input node for connecting audio sources.
   */
  getInput(nodeId: string): GainNode | null {
    return this.nodes.get(nodeId)?.input ?? null;
  }

  /**
   * Get the output node for routing to other processors.
   */
  getOutput(nodeId: string): GainNode | null {
    return this.nodes.get(nodeId)?.output ?? null;
  }

  /**
   * Set the 3D position of a spatial node.
   */
  setPosition(nodeId: string, x: number, y: number, z: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      console.warn('[SpatialEngine] Node not found:', nodeId);
      return;
    }
    
    const now = this.audioContext.currentTime;
    const panner = node.panner;
    
    // Smooth transition to new position
    panner.positionX.setTargetAtTime(x, now, 0.02);
    panner.positionY.setTargetAtTime(y, now, 0.02);
    panner.positionZ.setTargetAtTime(z, now, 0.02);
    
    // Update stored params
    node.params.x = x;
    node.params.y = y;
    node.params.z = z;
  }

  /**
   * Set spatial parameters for a node.
   */
  setParams(nodeId: string, params: Partial<SpatialNodeParams>): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const panner = node.panner;
    
    // Update position
    if (params.x !== undefined || params.y !== undefined || params.z !== undefined) {
      this.setPosition(
        nodeId,
        params.x ?? node.params.x,
        params.y ?? node.params.y,
        params.z ?? node.params.z
      );
    }
    
    // Update distance model
    if (params.distanceModel !== undefined) {
      panner.distanceModel = params.distanceModel;
      node.params.distanceModel = params.distanceModel;
    }
    
    if (params.refDistance !== undefined) {
      panner.refDistance = params.refDistance;
      node.params.refDistance = params.refDistance;
    }
    
    if (params.maxDistance !== undefined) {
      panner.maxDistance = params.maxDistance;
      node.params.maxDistance = params.maxDistance;
    }
    
    if (params.rolloffFactor !== undefined) {
      panner.rolloffFactor = params.rolloffFactor;
      node.params.rolloffFactor = params.rolloffFactor;
    }
    
    // Update cone settings
    if (params.coneInnerAngle !== undefined) {
      panner.coneInnerAngle = params.coneInnerAngle;
      node.params.coneInnerAngle = params.coneInnerAngle;
    }
    
    if (params.coneOuterAngle !== undefined) {
      panner.coneOuterAngle = params.coneOuterAngle;
      node.params.coneOuterAngle = params.coneOuterAngle;
    }
    
    if (params.coneOuterGain !== undefined) {
      panner.coneOuterGain = params.coneOuterGain;
      node.params.coneOuterGain = params.coneOuterGain;
    }
  }

  /**
   * Remove a spatial node.
   */
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    node.input.disconnect();
    node.panner.disconnect();
    node.output.disconnect();
    
    this.nodes.delete(nodeId);
    console.log('[SpatialEngine] Removed node:', nodeId);
  }

  /**
   * Clean up all nodes.
   */
  dispose(): void {
    for (const [nodeId] of this.nodes) {
      this.removeNode(nodeId);
    }
    
    if (this.masterOutput) {
      this.masterOutput.disconnect();
      this.masterOutput = null;
    }
    
    console.log('[SpatialEngine] Disposed');
  }
}
