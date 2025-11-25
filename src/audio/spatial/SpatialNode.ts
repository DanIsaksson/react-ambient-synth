/**
 * SpatialNode - 3D audio positioning wrapper.
 * 
 * Provides HRTF binaural panning with:
 * - Distance-based attenuation
 * - Air absorption (high-frequency rolloff)
 * - Manual Doppler effect
 * - Position/velocity tracking
 * 
 * Signal chain: Source -> AirAbsorption Filter -> PannerNode -> Output
 * 
 * @module audio/spatial/SpatialNode
 */

// ===========================================
// TYPES
// ===========================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type DistanceModel = 'linear' | 'inverse' | 'exponential';
export type PanningModel = 'HRTF' | 'equalpower';

export interface SpatialNodeParams {
  /** Position in 3D space */
  position: Vector3;
  /** Distance model for attenuation */
  distanceModel: DistanceModel;
  /** Panning model (HRTF for binaural, equalpower for stereo) */
  panningModel: PanningModel;
  /** Reference distance (where gain = 1) */
  refDistance: number;
  /** Maximum distance (for linear model) */
  maxDistance: number;
  /** Rolloff factor (higher = faster volume drop) */
  rolloffFactor: number;
  /** Enable air absorption simulation */
  airAbsorption: boolean;
  /** Air absorption coefficient (higher = more HF loss) */
  airAbsorptionCoef: number;
  /** Enable Doppler effect */
  dopplerEnabled: boolean;
  /** Speed of sound in units/second */
  speedOfSound: number;
  /** Cone inner angle (degrees, for directional sources) */
  coneInnerAngle: number;
  /** Cone outer angle (degrees) */
  coneOuterAngle: number;
  /** Cone outer gain (0-1) */
  coneOuterGain: number;
}

// ===========================================
// DEFAULT PARAMETERS
// ===========================================

const DEFAULT_PARAMS: SpatialNodeParams = {
  position: { x: 0, y: 0, z: 0 },
  distanceModel: 'inverse',
  panningModel: 'HRTF',
  refDistance: 1,
  maxDistance: 10000,
  rolloffFactor: 1,
  airAbsorption: true,
  airAbsorptionCoef: 0.002,
  dopplerEnabled: false,
  speedOfSound: 343, // m/s at sea level
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Calculate distance between two 3D points.
 */
function distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Subtract vectors: a - b.
 */
function subtract(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Dot product of two vectors.
 */
function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Magnitude of a vector.
 */
function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize a vector.
 */
function normalize(v: Vector3): Vector3 {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/**
 * Calculate air absorption cutoff frequency based on distance.
 * High frequencies are absorbed more by air.
 */
function calculateAirAbsorption(dist: number, coef: number): number {
  // Exponential decay from 20kHz to 200Hz
  const maxFreq = 20000;
  const minFreq = 200;
  const cutoff = maxFreq * Math.exp(-dist * coef);
  return Math.max(minFreq, Math.min(maxFreq, cutoff));
}

// ===========================================
// SPATIAL NODE CLASS
// ===========================================

export class SpatialNode {
  private audioContext: AudioContext;
  private params: SpatialNodeParams;

  // Audio nodes
  private panner: PannerNode;
  private airFilter: BiquadFilterNode;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Doppler effect
  private lastPosition: Vector3;
  private lastTime: number;
  private velocity: Vector3 = { x: 0, y: 0, z: 0 };
  private playbackRateTarget: AudioParam | null = null;

  // Listener reference (set externally)
  private listenerPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private listenerVelocity: Vector3 = { x: 0, y: 0, z: 0 };

  constructor(audioContext: AudioContext, params: Partial<SpatialNodeParams> = {}) {
    this.audioContext = audioContext;
    this.params = { ...DEFAULT_PARAMS, ...params };

    // Create audio nodes
    this.inputGain = audioContext.createGain();
    this.inputGain.gain.value = 1;

    this.airFilter = audioContext.createBiquadFilter();
    this.airFilter.type = 'lowpass';
    this.airFilter.frequency.value = 20000;
    this.airFilter.Q.value = 0.7; // Butterworth

    this.panner = audioContext.createPanner();
    this.configurePanner();

    this.outputGain = audioContext.createGain();
    this.outputGain.gain.value = 1;

    // Connect: Input -> Filter -> Panner -> Output
    this.inputGain.connect(this.airFilter);
    this.airFilter.connect(this.panner);
    this.panner.connect(this.outputGain);

    // Initialize position tracking
    this.lastPosition = { ...this.params.position };
    this.lastTime = audioContext.currentTime;

    // Apply initial position
    this.setPosition(this.params.position);
  }

  // ===========================================
  // CONFIGURATION
  // ===========================================

  private configurePanner(): void {
    const { 
      distanceModel, 
      panningModel, 
      refDistance, 
      maxDistance, 
      rolloffFactor,
      coneInnerAngle,
      coneOuterAngle,
      coneOuterGain
    } = this.params;

    this.panner.panningModel = panningModel;
    this.panner.distanceModel = distanceModel;
    this.panner.refDistance = refDistance;
    this.panner.maxDistance = maxDistance;
    this.panner.rolloffFactor = rolloffFactor;
    this.panner.coneInnerAngle = coneInnerAngle;
    this.panner.coneOuterAngle = coneOuterAngle;
    this.panner.coneOuterGain = coneOuterGain;
  }

  // ===========================================
  // POSITION & VELOCITY
  // ===========================================

  /**
   * Set the 3D position of this audio source.
   */
  setPosition(pos: Vector3): void {
    const now = this.audioContext.currentTime;
    const dt = now - this.lastTime;

    // Calculate velocity if time has passed
    if (dt > 0 && this.params.dopplerEnabled) {
      this.velocity = {
        x: (pos.x - this.lastPosition.x) / dt,
        y: (pos.y - this.lastPosition.y) / dt,
        z: (pos.z - this.lastPosition.z) / dt,
      };
    }

    // Update panner position
    this.panner.positionX.setTargetAtTime(pos.x, now, 0.02);
    this.panner.positionY.setTargetAtTime(pos.y, now, 0.02);
    this.panner.positionZ.setTargetAtTime(pos.z, now, 0.02);

    // Update air absorption if enabled
    if (this.params.airAbsorption) {
      const dist = distance(pos, this.listenerPosition);
      const cutoff = calculateAirAbsorption(dist, this.params.airAbsorptionCoef);
      this.airFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    }

    // Update Doppler if enabled
    if (this.params.dopplerEnabled) {
      this.updateDoppler();
    }

    // Store for velocity calculation
    this.lastPosition = { ...pos };
    this.lastTime = now;
    this.params.position = pos;
  }

  /**
   * Get current position.
   */
  getPosition(): Vector3 {
    return { ...this.params.position };
  }

  /**
   * Set orientation for directional sources (spot light effect).
   */
  setOrientation(forward: Vector3): void {
    const norm = normalize(forward);
    const now = this.audioContext.currentTime;
    this.panner.orientationX.setTargetAtTime(norm.x, now, 0.02);
    this.panner.orientationY.setTargetAtTime(norm.y, now, 0.02);
    this.panner.orientationZ.setTargetAtTime(norm.z, now, 0.02);
  }

  // ===========================================
  // LISTENER SYNC
  // ===========================================

  /**
   * Update listener position (call from AudioListenerManager).
   */
  updateListener(position: Vector3, velocity: Vector3 = { x: 0, y: 0, z: 0 }): void {
    this.listenerPosition = position;
    this.listenerVelocity = velocity;

    // Update air absorption with new listener position
    if (this.params.airAbsorption) {
      const dist = distance(this.params.position, position);
      const cutoff = calculateAirAbsorption(dist, this.params.airAbsorptionCoef);
      this.airFilter.frequency.setTargetAtTime(cutoff, this.audioContext.currentTime, 0.05);
    }

    // Update Doppler
    if (this.params.dopplerEnabled) {
      this.updateDoppler();
    }
  }

  // ===========================================
  // DOPPLER EFFECT
  // ===========================================

  /**
   * Set the playback rate parameter to modulate for Doppler.
   * This should be a BufferSourceNode.playbackRate or similar.
   */
  setDopplerTarget(playbackRateParam: AudioParam): void {
    this.playbackRateTarget = playbackRateParam;
  }

  private updateDoppler(): void {
    if (!this.playbackRateTarget) return;

    const { speedOfSound } = this.params;

    // Vector from source to listener
    const toListener = subtract(this.listenerPosition, this.params.position);
    const dist = magnitude(toListener);

    if (dist < 0.001) {
      // Too close, no Doppler
      this.playbackRateTarget.setTargetAtTime(1, this.audioContext.currentTime, 0.05);
      return;
    }

    // Normalized direction
    const direction = normalize(toListener);

    // Relative velocity along the source-listener axis
    // Positive = approaching, Negative = receding
    const sourceApproach = dot(this.velocity, direction);
    const listenerApproach = dot(this.listenerVelocity, direction);
    const relativeVelocity = sourceApproach - listenerApproach;

    // Doppler formula: f' = f * (c / (c - vs))
    // where vs is source velocity towards listener
    // Clamp to prevent extreme values
    const clampedVelocity = Math.max(-speedOfSound * 0.9, Math.min(speedOfSound * 0.9, relativeVelocity));
    const dopplerShift = speedOfSound / (speedOfSound - clampedVelocity);

    // Apply smoothly
    this.playbackRateTarget.setTargetAtTime(
      dopplerShift,
      this.audioContext.currentTime,
      0.02
    );
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  /**
   * Set distance model.
   */
  setDistanceModel(model: DistanceModel): void {
    this.params.distanceModel = model;
    this.panner.distanceModel = model;
  }

  /**
   * Set panning model.
   */
  setPanningModel(model: PanningModel): void {
    this.params.panningModel = model;
    this.panner.panningModel = model;
  }

  /**
   * Set rolloff factor (higher = faster volume drop).
   */
  setRolloff(factor: number): void {
    this.params.rolloffFactor = Math.max(0, factor);
    this.panner.rolloffFactor = this.params.rolloffFactor;
  }

  /**
   * Set reference distance.
   */
  setRefDistance(dist: number): void {
    this.params.refDistance = Math.max(0.01, dist);
    this.panner.refDistance = this.params.refDistance;
  }

  /**
   * Enable/disable air absorption.
   */
  setAirAbsorption(enabled: boolean): void {
    this.params.airAbsorption = enabled;
    if (!enabled) {
      this.airFilter.frequency.setTargetAtTime(20000, this.audioContext.currentTime, 0.1);
    }
  }

  /**
   * Set air absorption coefficient.
   */
  setAirAbsorptionCoef(coef: number): void {
    this.params.airAbsorptionCoef = Math.max(0, coef);
  }

  /**
   * Enable/disable Doppler effect.
   */
  setDopplerEnabled(enabled: boolean): void {
    this.params.dopplerEnabled = enabled;
    if (!enabled && this.playbackRateTarget) {
      this.playbackRateTarget.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
    }
  }

  /**
   * Set multiple parameters at once.
   */
  setParams(params: Partial<SpatialNodeParams>): void {
    Object.assign(this.params, params);
    this.configurePanner();
  }

  // ===========================================
  // CONNECTIONS
  // ===========================================

  /**
   * Get input node for connecting sources.
   */
  get input(): GainNode {
    return this.inputGain;
  }

  /**
   * Get output node for connecting to destination.
   */
  get output(): GainNode {
    return this.outputGain;
  }

  /**
   * Connect a source to this spatial node.
   */
  connectSource(source: AudioNode): void {
    source.connect(this.inputGain);
  }

  /**
   * Connect output to a destination.
   */
  connect(destination: AudioNode | AudioParam): void {
    if (destination instanceof AudioParam) {
      this.outputGain.connect(destination);
    } else {
      this.outputGain.connect(destination);
    }
  }

  /**
   * Disconnect output.
   */
  disconnect(destination?: AudioNode | AudioParam): void {
    if (destination) {
      if (destination instanceof AudioParam) {
        this.outputGain.disconnect(destination);
      } else {
        this.outputGain.disconnect(destination);
      }
    } else {
      this.outputGain.disconnect();
    }
  }

  // ===========================================
  // GETTERS
  // ===========================================

  get currentParams(): SpatialNodeParams {
    return { ...this.params };
  }

  /**
   * Get current distance to listener.
   */
  getDistanceToListener(): number {
    return distance(this.params.position, this.listenerPosition);
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose and free resources.
   */
  dispose(): void {
    this.inputGain.disconnect();
    this.airFilter.disconnect();
    this.panner.disconnect();
    this.outputGain.disconnect();
    console.log('[SpatialNode] Disposed');
  }
}

export default SpatialNode;
