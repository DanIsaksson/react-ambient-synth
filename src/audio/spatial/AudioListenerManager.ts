/**
 * AudioListenerManager - Synchronizes Web Audio API listener with Three.js camera.
 * 
 * Updates the AudioListener position and orientation to match the camera,
 * enabling proper 3D audio spatialization that tracks with the user's view.
 * 
 * @module audio/spatial/AudioListenerManager
 */

import type { Vector3 } from './SpatialNode';
import type { SpatialNode } from './SpatialNode';

// ===========================================
// TYPES
// ===========================================

export interface ListenerState {
  position: Vector3;
  forward: Vector3;
  up: Vector3;
  velocity: Vector3;
}

export interface AudioListenerConfig {
  /** Update rate in Hz (default 60) */
  updateRate: number;
  /** Smoothing time for position changes */
  smoothingTime: number;
  /** Enable velocity tracking for Doppler */
  trackVelocity: boolean;
}

// ===========================================
// DEFAULT CONFIG
// ===========================================

const DEFAULT_CONFIG: AudioListenerConfig = {
  updateRate: 60,
  smoothingTime: 0.02,
  trackVelocity: true,
};

// ===========================================
// AUDIO LISTENER MANAGER CLASS
// ===========================================

export class AudioListenerManager {
  private audioContext: AudioContext;
  private config: AudioListenerConfig;
  private listener: AudioListener;

  // Current state
  private state: ListenerState = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 }, // Looking into screen
    up: { x: 0, y: 1, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  };

  // Velocity tracking
  private lastPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private lastTime: number = 0;

  // Registered spatial nodes to update
  private spatialNodes: Set<SpatialNode> = new Set();

  // Animation frame
  private updateLoop: ReturnType<typeof setInterval> | null = null;

  constructor(audioContext: AudioContext, config: Partial<AudioListenerConfig> = {}) {
    this.audioContext = audioContext;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.listener = audioContext.listener;

    // Initialize listener position
    this.applyListenerState();

    this.lastTime = audioContext.currentTime;
  }

  // ===========================================
  // STATE MANAGEMENT
  // ===========================================

  /**
   * Apply current state to the AudioListener.
   */
  private applyListenerState(): void {
    const { position, forward, up } = this.state;
    const now = this.audioContext.currentTime;
    const tau = this.config.smoothingTime;

    // Position
    if (this.listener.positionX) {
      // Modern API
      this.listener.positionX.setTargetAtTime(position.x, now, tau);
      this.listener.positionY.setTargetAtTime(position.y, now, tau);
      this.listener.positionZ.setTargetAtTime(position.z, now, tau);
    } else {
      // Legacy API
      this.listener.setPosition(position.x, position.y, position.z);
    }

    // Orientation (forward and up vectors)
    if (this.listener.forwardX) {
      // Modern API
      this.listener.forwardX.setTargetAtTime(forward.x, now, tau);
      this.listener.forwardY.setTargetAtTime(forward.y, now, tau);
      this.listener.forwardZ.setTargetAtTime(forward.z, now, tau);
      this.listener.upX.setTargetAtTime(up.x, now, tau);
      this.listener.upY.setTargetAtTime(up.y, now, tau);
      this.listener.upZ.setTargetAtTime(up.z, now, tau);
    } else {
      // Legacy API
      this.listener.setOrientation(
        forward.x, forward.y, forward.z,
        up.x, up.y, up.z
      );
    }
  }

  /**
   * Calculate velocity from position changes.
   */
  private updateVelocity(newPosition: Vector3): void {
    if (!this.config.trackVelocity) return;

    const now = this.audioContext.currentTime;
    const dt = now - this.lastTime;

    if (dt > 0) {
      this.state.velocity = {
        x: (newPosition.x - this.lastPosition.x) / dt,
        y: (newPosition.y - this.lastPosition.y) / dt,
        z: (newPosition.z - this.lastPosition.z) / dt,
      };
    }

    this.lastPosition = { ...newPosition };
    this.lastTime = now;
  }

  // ===========================================
  // PUBLIC API
  // ===========================================

  /**
   * Set listener position directly.
   */
  setPosition(position: Vector3): void {
    this.updateVelocity(position);
    this.state.position = { ...position };
    this.applyListenerState();
    this.notifySpatialNodes();
  }

  /**
   * Set listener orientation.
   */
  setOrientation(forward: Vector3, up: Vector3): void {
    this.state.forward = { ...forward };
    this.state.up = { ...up };
    this.applyListenerState();
  }

  /**
   * Update from Three.js camera (call in animation loop).
   * 
   * @param cameraPosition - camera.position
   * @param cameraQuaternion - camera.quaternion (or extract forward/up from matrix)
   */
  updateFromCamera(
    cameraPosition: { x: number; y: number; z: number },
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number }
  ): void {
    // Update position with velocity tracking
    this.updateVelocity(cameraPosition);
    this.state.position = { ...cameraPosition };
    
    // Update orientation
    this.state.forward = { ...forward };
    this.state.up = { ...up };

    // Apply to AudioListener
    this.applyListenerState();

    // Notify all registered spatial nodes
    this.notifySpatialNodes();
  }

  /**
   * Simplified update from camera matrix.
   * Extracts forward and up vectors from a 4x4 matrix array.
   */
  updateFromMatrix(position: Vector3, matrixElements: number[]): void {
    // Forward is -Z in camera space (column 2, negated)
    const forward: Vector3 = {
      x: -matrixElements[8],
      y: -matrixElements[9],
      z: -matrixElements[10],
    };

    // Up is Y in camera space (column 1)
    const up: Vector3 = {
      x: matrixElements[4],
      y: matrixElements[5],
      z: matrixElements[6],
    };

    this.updateFromCamera(position, forward, up);
  }

  /**
   * Get current listener state.
   */
  getState(): ListenerState {
    return { ...this.state };
  }

  // ===========================================
  // SPATIAL NODE MANAGEMENT
  // ===========================================

  /**
   * Register a SpatialNode to receive listener updates.
   */
  registerSpatialNode(node: SpatialNode): void {
    this.spatialNodes.add(node);
    // Immediately update with current listener state
    node.updateListener(this.state.position, this.state.velocity);
  }

  /**
   * Unregister a SpatialNode.
   */
  unregisterSpatialNode(node: SpatialNode): void {
    this.spatialNodes.delete(node);
  }

  /**
   * Notify all registered spatial nodes of listener update.
   */
  private notifySpatialNodes(): void {
    for (const node of this.spatialNodes) {
      node.updateListener(this.state.position, this.state.velocity);
    }
  }

  /**
   * Get count of registered spatial nodes.
   */
  getSpatialNodeCount(): number {
    return this.spatialNodes.size;
  }

  // ===========================================
  // AUTO-UPDATE LOOP
  // ===========================================

  /**
   * Start automatic position update from a callback.
   */
  startAutoUpdate(getPosition: () => { position: Vector3; forward: Vector3; up: Vector3 }): void {
    if (this.updateLoop) {
      clearInterval(this.updateLoop);
    }

    const intervalMs = 1000 / this.config.updateRate;

    this.updateLoop = setInterval(() => {
      const { position, forward, up } = getPosition();
      this.updateFromCamera(position, forward, up);
    }, intervalMs);
  }

  /**
   * Stop automatic updates.
   */
  stopAutoUpdate(): void {
    if (this.updateLoop) {
      clearInterval(this.updateLoop);
      this.updateLoop = null;
    }
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose and free resources.
   */
  dispose(): void {
    this.stopAutoUpdate();
    this.spatialNodes.clear();
    console.log('[AudioListenerManager] Disposed');
  }
}

export default AudioListenerManager;
