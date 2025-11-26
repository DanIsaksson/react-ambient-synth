/**
 * SampleEngine - Manages sample playback for graph nodes.
 * 
 * Uses hybrid architecture:
 * - Native Web Audio API for playback (AudioBufferSourceNode)
 * - Direct connection to MasterBus (bypasses worklet routing issues)
 * - Per-node SamplePlayer instances for independent control
 * 
 * This approach provides:
 * - Reliable audio output
 * - Low latency triggering
 * - Independent pitch/gain/loop per node
 * 
 * @module audio/engine/SampleEngine
 */

import { SampleLibrary, SamplePlayer } from '../samples';
import type { LoadedSample, SamplePlayerConfig } from '../samples';

// ===========================================
// TYPES
// ===========================================

interface NodePlayer {
  player: SamplePlayer;
  sampleId: string | null;
  isPlaying: boolean;
}

// ===========================================
// SAMPLE ENGINE CLASS
// ===========================================

export class SampleEngine {
  private context: AudioContext;
  private library: SampleLibrary;
  private output: GainNode;
  private nodePlayers: Map<string, NodePlayer> = new Map();
  private isInitialized: boolean = false;

  constructor(context: AudioContext) {
    this.context = context;
    this.library = new SampleLibrary(context);
    this.output = context.createGain();
    this.output.gain.value = 1.0;
  }

  // ===========================================
  // INITIALIZATION
  // ===========================================

  /**
   * Initialize the sample engine.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    // Preload commonly used samples in background
    this.library.preload('vinyl-crackle');
    this.library.preload('rain-soft');
    
    this.isInitialized = true;
    console.log('[SampleEngine] Initialized');
  }

  /**
   * Connect output to destination (typically MasterBus input).
   */
  connect(destination: AudioNode): void {
    this.output.connect(destination);
    console.log('[SampleEngine] Connected to destination');
  }

  /**
   * Disconnect from all destinations.
   */
  disconnect(): void {
    this.output.disconnect();
  }

  // ===========================================
  // NODE MANAGEMENT
  // ===========================================

  /**
   * Create or get a player for a graph node.
   */
  private getOrCreatePlayer(nodeId: string): NodePlayer {
    let nodePlayer = this.nodePlayers.get(nodeId);
    
    if (!nodePlayer) {
      const player = new SamplePlayer(this.context);
      player.connect(this.output);
      
      nodePlayer = {
        player,
        sampleId: null,
        isPlaying: false,
      };
      
      this.nodePlayers.set(nodeId, nodePlayer);
      console.log(`[SampleEngine] Created player for node: ${nodeId}`);
    }
    
    return nodePlayer;
  }

  /**
   * Remove a node's player (called when node is deleted).
   */
  removeNode(nodeId: string): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.stop(0);
      nodePlayer.player.dispose();
      this.nodePlayers.delete(nodeId);
      console.log(`[SampleEngine] Removed player for node: ${nodeId}`);
    }
  }

  // ===========================================
  // SAMPLE LOADING
  // ===========================================

  /**
   * Load a sample for a node.
   */
  async loadSampleForNode(nodeId: string, sampleId: string): Promise<boolean> {
    try {
      const sample = await this.library.getSample(sampleId);
      const nodePlayer = this.getOrCreatePlayer(nodeId);
      
      nodePlayer.player.setSample(sample);
      nodePlayer.sampleId = sampleId;
      
      console.log(`[SampleEngine] Loaded "${sample.name}" for node ${nodeId}`);
      return true;
    } catch (error) {
      console.error(`[SampleEngine] Failed to load sample ${sampleId} for node ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Get the loaded sample for a node.
   */
  getLoadedSample(nodeId: string): LoadedSample | null {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (!nodePlayer?.sampleId) return null;
    
    return this.library['cache'].get(nodePlayer.sampleId) ?? null;
  }

  // ===========================================
  // PLAYBACK CONTROL
  // ===========================================

  /**
   * Trigger sample playback for a node.
   */
  async trigger(nodeId: string, sampleId?: string): Promise<void> {
    const nodePlayer = this.getOrCreatePlayer(nodeId);
    
    // Load sample if different or not loaded
    if (sampleId && sampleId !== nodePlayer.sampleId) {
      await this.loadSampleForNode(nodeId, sampleId);
    }
    
    if (!nodePlayer.sampleId) {
      console.warn(`[SampleEngine] No sample loaded for node ${nodeId}`);
      return;
    }
    
    nodePlayer.player.trigger();
    nodePlayer.isPlaying = true;
    
    // Handle end of playback
    nodePlayer.player.onEnded(() => {
      nodePlayer.isPlaying = false;
    });
  }

  /**
   * Stop playback for a node.
   */
  stop(nodeId: string): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.stop();
      nodePlayer.isPlaying = false;
    }
  }

  /**
   * Retrigger (stop and play from start).
   */
  retrigger(nodeId: string): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.retrigger();
      nodePlayer.isPlaying = true;
    }
  }

  /**
   * Switch to a new sample while playing (seamless transition).
   * If not playing, just loads the sample.
   */
  async switchSample(nodeId: string, newSampleId: string): Promise<void> {
    const nodePlayer = this.nodePlayers.get(nodeId);
    const wasPlaying = nodePlayer?.isPlaying ?? false;
    
    // Load the new sample
    await this.loadSampleForNode(nodeId, newSampleId);
    
    // If was playing, retrigger with new sample
    if (wasPlaying) {
      this.retrigger(nodeId);
    }
  }

  /**
   * Check if a node is playing.
   */
  isPlaying(nodeId: string): boolean {
    return this.nodePlayers.get(nodeId)?.isPlaying ?? false;
  }

  // ===========================================
  // PARAMETER CONTROL
  // ===========================================

  /**
   * Update parameters for a node's player.
   */
  setNodeParams(nodeId: string, params: Partial<SamplePlayerConfig>): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.setConfig(params);
    }
  }

  /**
   * Set pitch for a node.
   */
  setPitch(nodeId: string, semitones: number, fineTune: number = 0): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.setPitch(semitones, fineTune);
    }
  }

  /**
   * Set gain for a node.
   */
  setGain(nodeId: string, gain: number): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.setGain(gain);
    }
  }

  /**
   * Set loop mode for a node.
   */
  setLoop(nodeId: string, enabled: boolean, start?: number, end?: number): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.setLoop(enabled, start, end);
    }
  }

  /**
   * Set reverse mode for a node (requires retrigger to take effect).
   */
  setReverse(nodeId: string, enabled: boolean): void {
    const nodePlayer = this.nodePlayers.get(nodeId);
    if (nodePlayer) {
      nodePlayer.player.setReverse(enabled);
    }
  }

  // ===========================================
  // LIBRARY ACCESS
  // ===========================================

  /**
   * Get the sample library instance.
   */
  getLibrary(): SampleLibrary {
    return this.library;
  }

  /**
   * Get all available sample IDs.
   */
  getCatalog() {
    return this.library['catalog'];
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    for (const [nodeId] of this.nodePlayers) {
      this.removeNode(nodeId);
    }
    this.library.clearCache();
    this.disconnect();
    console.log('[SampleEngine] Disposed');
  }
}

export default SampleEngine;
