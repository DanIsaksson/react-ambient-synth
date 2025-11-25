/**
 * ModulationSystem - Central routing system for modulation connections.
 * 
 * Handles Source -> Amount (GainNode) -> Target AudioParam routing.
 * Supports audio-rate and control-rate modulation.
 * 
 * @module audio/modulation/ModulationSystem
 */

// ===========================================
// TYPES
// ===========================================

export interface ModulationConnection {
  /** Unique ID for this connection */
  id: string;
  /** Source node ID */
  sourceId: string;
  /** Source output name (e.g., 'out', 'x', 'y', 'z') */
  sourceOutput: string;
  /** Target node ID */
  targetId: string;
  /** Target parameter name (e.g., 'frequency', 'gain', 'Q') */
  targetParam: string;
  /** Modulation amount (-1 to 1, scaled by target range) */
  amount: number;
  /** The GainNode used for amount control */
  gainNode: GainNode;
  /** Is this connection active? */
  active: boolean;
}

export interface ModulationSource {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** Type of source */
  type: 'lfo' | 'envelope' | 'chaos' | 'sequencer' | 'macro' | 'noise';
  /** Output AudioNode or ConstantSourceNode */
  outputNode: AudioNode;
  /** Get current value for visualization (0-1 normalized) */
  getValue?: () => number;
}

export interface ModulationTarget {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** The AudioParam to modulate */
  param: AudioParam;
  /** Minimum value for this parameter */
  min: number;
  /** Maximum value for this parameter */
  max: number;
  /** Base value (when no modulation) */
  baseValue: number;
}

export type TransferCurve = 'linear' | 'exponential' | 'logarithmic' | 's-curve';

// ===========================================
// TRANSFER CURVE FUNCTIONS
// ===========================================

/**
 * Apply a transfer curve to a normalized value (0-1).
 */
export function applyTransferCurve(value: number, curve: TransferCurve): number {
  const v = Math.max(0, Math.min(1, value));
  
  switch (curve) {
    case 'exponential':
      // Good for frequency/volume perception
      return v * v;
    
    case 'logarithmic':
      // Inverse of exponential
      return Math.sqrt(v);
    
    case 's-curve':
      // Smooth start and end, fast middle (sigmoid-like)
      return v * v * (3 - 2 * v);
    
    case 'linear':
    default:
      return v;
  }
}

/**
 * Map a value from one range to another with optional curve.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  curve: TransferCurve = 'linear'
): number {
  // Normalize to 0-1
  const normalized = (value - inMin) / (inMax - inMin);
  // Apply curve
  const curved = applyTransferCurve(normalized, curve);
  // Map to output range
  return outMin + curved * (outMax - outMin);
}

// ===========================================
// MODULATION SYSTEM CLASS
// ===========================================

export class ModulationSystem {
  private audioContext: AudioContext;
  private connections: Map<string, ModulationConnection> = new Map();
  private sources: Map<string, ModulationSource> = new Map();
  private targets: Map<string, ModulationTarget> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  // ===========================================
  // SOURCE MANAGEMENT
  // ===========================================

  /**
   * Register a modulation source.
   */
  registerSource(source: ModulationSource): void {
    this.sources.set(source.id, source);
    console.log(`[ModulationSystem] Registered source: ${source.name} (${source.id})`);
  }

  /**
   * Unregister a modulation source and disconnect all its connections.
   */
  unregisterSource(sourceId: string): void {
    // Disconnect all connections from this source
    for (const [connId, conn] of this.connections) {
      if (conn.sourceId === sourceId) {
        this.disconnect(connId);
      }
    }
    this.sources.delete(sourceId);
  }

  /**
   * Get a registered source by ID.
   */
  getSource(sourceId: string): ModulationSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Get all registered sources.
   */
  getAllSources(): ModulationSource[] {
    return Array.from(this.sources.values());
  }

  // ===========================================
  // TARGET MANAGEMENT
  // ===========================================

  /**
   * Register a modulation target (an AudioParam).
   */
  registerTarget(target: ModulationTarget): void {
    this.targets.set(target.id, target);
    console.log(`[ModulationSystem] Registered target: ${target.name} (${target.id})`);
  }

  /**
   * Unregister a target and disconnect all connections to it.
   */
  unregisterTarget(targetId: string): void {
    for (const [connId, conn] of this.connections) {
      if (conn.targetId === targetId) {
        this.disconnect(connId);
      }
    }
    this.targets.delete(targetId);
  }

  /**
   * Get a registered target by ID.
   */
  getTarget(targetId: string): ModulationTarget | undefined {
    return this.targets.get(targetId);
  }

  /**
   * Get all registered targets.
   */
  getAllTargets(): ModulationTarget[] {
    return Array.from(this.targets.values());
  }

  // ===========================================
  // CONNECTION MANAGEMENT
  // ===========================================

  /**
   * Create a modulation connection.
   * Source -> GainNode (Amount) -> Target AudioParam
   */
  connect(
    sourceId: string,
    sourceOutput: string,
    targetId: string,
    targetParam: string,
    amount: number = 1
  ): string | null {
    const source = this.sources.get(sourceId);
    const target = this.targets.get(targetId);

    if (!source) {
      console.warn(`[ModulationSystem] Source not found: ${sourceId}`);
      return null;
    }

    if (!target) {
      console.warn(`[ModulationSystem] Target not found: ${targetId}`);
      return null;
    }

    // Create the amount GainNode
    const gainNode = this.audioContext.createGain();
    
    // Calculate the modulation depth based on target range and amount
    const range = target.max - target.min;
    gainNode.gain.value = amount * range;

    // Connect: Source -> Gain -> Target Param
    source.outputNode.connect(gainNode);
    gainNode.connect(target.param);

    // Create connection record
    const connId = `${sourceId}->${targetId}.${targetParam}`;
    const connection: ModulationConnection = {
      id: connId,
      sourceId,
      sourceOutput,
      targetId,
      targetParam,
      amount,
      gainNode,
      active: true,
    };

    this.connections.set(connId, connection);
    console.log(`[ModulationSystem] Connected: ${source.name} -> ${target.name} (${amount})`);

    return connId;
  }

  /**
   * Disconnect a modulation connection.
   */
  disconnect(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) return false;

    // Disconnect the gain node
    conn.gainNode.disconnect();
    
    // Try to disconnect source from gain
    const source = this.sources.get(conn.sourceId);
    if (source) {
      try {
        source.outputNode.disconnect(conn.gainNode);
      } catch {
        // Already disconnected
      }
    }

    this.connections.delete(connectionId);
    console.log(`[ModulationSystem] Disconnected: ${connectionId}`);
    return true;
  }

  /**
   * Update the amount of a connection.
   */
  setAmount(connectionId: string, amount: number): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const target = this.targets.get(conn.targetId);
    if (!target) return;

    conn.amount = amount;
    const range = target.max - target.min;
    conn.gainNode.gain.setTargetAtTime(
      amount * range,
      this.audioContext.currentTime,
      0.01
    );
  }

  /**
   * Enable/disable a connection.
   */
  setActive(connectionId: string, active: boolean): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.active = active;
    
    if (active) {
      const target = this.targets.get(conn.targetId);
      if (target) {
        const range = target.max - target.min;
        conn.gainNode.gain.setTargetAtTime(
          conn.amount * range,
          this.audioContext.currentTime,
          0.01
        );
      }
    } else {
      conn.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    }
  }

  /**
   * Get all active connections.
   */
  getConnections(): ModulationConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections for a specific source.
   */
  getConnectionsFromSource(sourceId: string): ModulationConnection[] {
    return Array.from(this.connections.values()).filter(c => c.sourceId === sourceId);
  }

  /**
   * Get connections for a specific target.
   */
  getConnectionsToTarget(targetId: string): ModulationConnection[] {
    return Array.from(this.connections.values()).filter(c => c.targetId === targetId);
  }

  // ===========================================
  // VISUALIZATION
  // ===========================================

  /**
   * Get current modulation state for UI visualization.
   */
  getVisualizationState(): {
    sources: { id: string; name: string; value: number }[];
    connections: { id: string; sourceId: string; targetId: string; amount: number }[];
  } {
    const sources = Array.from(this.sources.values()).map(s => ({
      id: s.id,
      name: s.name,
      value: s.getValue ? s.getValue() : 0,
    }));

    const connections = Array.from(this.connections.values()).map(c => ({
      id: c.id,
      sourceId: c.sourceId,
      targetId: c.targetId,
      amount: c.amount,
    }));

    return { sources, connections };
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Disconnect all and clear.
   */
  dispose(): void {
    for (const connId of this.connections.keys()) {
      this.disconnect(connId);
    }
    this.sources.clear();
    this.targets.clear();
    console.log('[ModulationSystem] Disposed');
  }
}

export default ModulationSystem;
