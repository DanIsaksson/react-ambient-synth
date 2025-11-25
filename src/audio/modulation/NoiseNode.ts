/**
 * NoiseNode - Smooth noise generator for organic modulation.
 * 
 * Uses Simplex-style noise algorithm for smooth, continuous drift.
 * Unlike white noise, this produces "wind-like" wandering motion.
 * 
 * @module audio/modulation/NoiseNode
 */

// ===========================================
// TYPES
// ===========================================

export interface NoiseParams {
  /** Speed of noise evolution (Hz-like) */
  speed: number;
  /** Output amplitude (0-1) */
  depth: number;
  /** Smoothness/octaves of noise */
  smoothness: number;
  /** Bipolar or unipolar output */
  bipolar: boolean;
}

// ===========================================
// DEFAULT PARAMETERS
// ===========================================

const DEFAULT_PARAMS: NoiseParams = {
  speed: 0.5,
  depth: 1,
  smoothness: 3,
  bipolar: true,
};

// ===========================================
// SIMPLEX NOISE IMPLEMENTATION
// ===========================================

/**
 * Simple 1D gradient noise implementation.
 * Based on improved Perlin noise concepts.
 */
class SimplexNoise1D {
  private permutation: number[];
  
  constructor(seed: number = Math.random() * 65536) {
    // Generate permutation table
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation.push(i);
    }
    
    // Shuffle based on seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    
    // Duplicate for overflow
    this.permutation = [...this.permutation, ...this.permutation];
  }

  private grad(hash: number, x: number): number {
    const h = hash & 15;
    let grad = 1 + (h & 7); // Gradient value 1-8
    if (h & 8) grad = -grad; // Randomly invert
    return grad * x;
  }

  private fade(t: number): number {
    // Improved smoothstep: 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Get noise value at position x.
   * Returns value in range [-1, 1].
   */
  noise(x: number): number {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const u = this.fade(x);
    
    return this.lerp(
      this.grad(this.permutation[X], x),
      this.grad(this.permutation[X + 1], x - 1),
      u
    );
  }

  /**
   * Fractal/octave noise for more interesting motion.
   */
  fractalNoise(x: number, octaves: number = 4, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
}

// ===========================================
// NOISE NODE CLASS
// ===========================================

export class NoiseNode {
  private audioContext: AudioContext;
  private params: NoiseParams;
  
  // Noise generator
  private noise: SimplexNoise1D;
  private position = 0;
  
  // Audio nodes
  private constantSource: ConstantSourceNode;
  private depthGain: GainNode;
  private outputGain: GainNode;
  private dcOffset: ConstantSourceNode;
  
  // Update interval
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;
  
  // Current value for visualization
  private currentValue = 0;

  constructor(audioContext: AudioContext, params: Partial<NoiseParams> = {}) {
    this.audioContext = audioContext;
    this.params = { ...DEFAULT_PARAMS, ...params };
    
    // Create noise generator with random seed
    this.noise = new SimplexNoise1D();
    
    // Create audio nodes
    this.constantSource = audioContext.createConstantSource();
    this.depthGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.outputGain.gain.value = 1;
    
    // DC offset for unipolar mode
    this.dcOffset = audioContext.createConstantSource();
    this.dcOffset.offset.value = 0;
    this.dcOffset.start();
    
    // Connect: ConstantSource -> Depth -> Output
    this.constantSource.connect(this.depthGain);
    this.depthGain.connect(this.outputGain);
    this.dcOffset.connect(this.outputGain);
    
    // Start the constant source
    this.constantSource.start();
    
    // Apply initial params
    this.applyParams();
    
    // Start the update loop
    this.startUpdateLoop();
    
    this.lastTime = audioContext.currentTime;
  }

  // ===========================================
  // UPDATE LOOP
  // ===========================================

  private startUpdateLoop(): void {
    // Update at ~120fps for smooth control rate
    this.updateInterval = setInterval(() => {
      const now = this.audioContext.currentTime;
      const dt = now - this.lastTime;
      this.lastTime = now;
      
      // Advance position based on speed
      this.position += this.params.speed * dt;
      
      // Generate noise value
      let value = this.noise.fractalNoise(
        this.position,
        Math.ceil(this.params.smoothness),
        0.5
      );
      
      // Apply depth
      value *= this.params.depth;
      
      // Store for visualization
      this.currentValue = value;
      
      // Update the constant source
      this.constantSource.offset.setTargetAtTime(
        value,
        now,
        0.008 // Quick response time
      );
    }, 1000 / 120);
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  private applyParams(): void {
    const { depth, bipolar } = this.params;
    
    // Set depth gain
    this.depthGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
    
    // Set DC offset for unipolar mode
    if (bipolar) {
      this.dcOffset.offset.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    } else {
      this.dcOffset.offset.setTargetAtTime(depth, this.audioContext.currentTime, 0.01);
    }
  }

  /**
   * Set noise evolution speed.
   */
  setSpeed(speed: number): void {
    this.params.speed = Math.max(0.01, Math.min(10, speed));
  }

  /**
   * Set output depth (0-1).
   */
  setDepth(depth: number): void {
    this.params.depth = Math.max(0, Math.min(1, depth));
  }

  /**
   * Set smoothness (1-8 octaves).
   */
  setSmoothness(smoothness: number): void {
    this.params.smoothness = Math.max(1, Math.min(8, smoothness));
  }

  /**
   * Set bipolar/unipolar mode.
   */
  setBipolar(bipolar: boolean): void {
    this.params.bipolar = bipolar;
    this.applyParams();
  }

  /**
   * Set multiple parameters at once.
   */
  setParams(params: Partial<NoiseParams>): void {
    Object.assign(this.params, params);
    this.applyParams();
  }

  /**
   * Reseed the noise generator for new patterns.
   */
  reseed(seed?: number): void {
    this.noise = new SimplexNoise1D(seed);
    this.position = 0;
  }

  // ===========================================
  // VISUALIZATION
  // ===========================================

  /**
   * Get current value for visualization (normalized 0-1).
   */
  getValue(): number {
    if (this.params.bipolar) {
      return (this.currentValue + 1) * 0.5;
    }
    return Math.max(0, Math.min(1, this.currentValue));
  }

  /**
   * Get raw noise value.
   */
  getRawValue(): number {
    return this.currentValue;
  }

  // ===========================================
  // CONNECTIONS
  // ===========================================

  /**
   * Get the output node.
   */
  get output(): GainNode {
    return this.outputGain;
  }

  /**
   * Connect to a destination.
   */
  connect(destination: AudioParam | AudioNode): void {
    if (destination instanceof AudioParam) {
      this.outputGain.connect(destination);
    } else {
      this.outputGain.connect(destination);
    }
  }

  /**
   * Disconnect from destinations.
   */
  disconnect(destination?: AudioParam | AudioNode): void {
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

  get currentParams(): NoiseParams {
    return { ...this.params };
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose and free resources.
   */
  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.constantSource.stop();
    this.constantSource.disconnect();
    this.dcOffset.stop();
    this.dcOffset.disconnect();
    this.depthGain.disconnect();
    this.outputGain.disconnect();
    
    console.log('[NoiseNode] Disposed');
  }
}

export default NoiseNode;
