/**
 * PresetManager - Handles patch serialization, compression, and loading.
 * 
 * Provides:
 * - Save current state to PatchData
 * - Load PatchData into app state
 * - URL encoding/decoding with LZ-String compression
 * - Local storage persistence
 * - Version migration for backwards compatibility
 * 
 * @module presets/PresetManager
 */

import LZString from 'lz-string';
import type { Node, Edge } from '@xyflow/react';
import {
  type PatchData,
  type PatchMeta,
  type GlobalState,
  type ModulationData,
  type VersionMigrations,
  DEFAULT_PATCH_META,
  DEFAULT_GLOBAL_STATE,
  CURRENT_PATCH_VERSION,
} from './types';

// ===========================================
// LOCAL STORAGE KEYS
// ===========================================

const STORAGE_KEYS = {
  AUTOSAVE: 'ambientflow_autosave',
  USER_PRESETS: 'ambientflow_user_presets',
  LAST_LOADED: 'ambientflow_last_loaded',
};

// ===========================================
// VERSION MIGRATIONS
// ===========================================

/**
 * Migration functions for updating old patch formats.
 * Key is the version to migrate FROM.
 */
const migrations: VersionMigrations = {
  // Example: '0.9.0': (old) => ({ ...old, meta: { ...old.meta, version: '1.0.0' } }),
};

// ===========================================
// PRESET MANAGER CLASS
// ===========================================

export class PresetManager {
  private static instance: PresetManager;

  private constructor() {}

  /**
   * Get singleton instance.
   */
  static getInstance(): PresetManager {
    if (!PresetManager.instance) {
      PresetManager.instance = new PresetManager();
    }
    return PresetManager.instance;
  }

  // ===========================================
  // SERIALIZATION
  // ===========================================

  /**
   * Create a PatchData object from current app state.
   */
  createPatch(
    nodes: Node[],
    edges: Edge[],
    audioParams: { [nodeId: string]: { [param: string]: any } },
    globalState: Partial<GlobalState> = {},
    modulation?: ModulationData,
    meta: Partial<PatchMeta> = {}
  ): PatchData {
    const now = Date.now();

    return {
      meta: {
        ...DEFAULT_PATCH_META,
        ...meta,
        version: CURRENT_PATCH_VERSION,
        createdAt: meta.createdAt || now,
        updatedAt: now,
      },
      graph: {
        nodes: this.cleanNodes(nodes),
        edges: this.cleanEdges(edges),
      },
      audio: {
        nodes: audioParams,
      },
      global: {
        ...DEFAULT_GLOBAL_STATE,
        ...globalState,
      },
      modulation,
    };
  }

  /**
   * Clean node data for serialization (remove runtime state).
   */
  private cleanNodes(nodes: Node[]): Node[] {
    return nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      data: { ...node.data },
      // Exclude: selected, dragging, measured, etc.
    }));
  }

  /**
   * Clean edge data for serialization.
   */
  private cleanEdges(edges: Edge[]): Edge[] {
    return edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      // Exclude: selected, animated, style, etc.
    }));
  }

  // ===========================================
  // COMPRESSION (URL Sharing)
  // ===========================================

  /**
   * Compress patch to URL-safe string.
   */
  compressToURL(patch: PatchData): string {
    const json = JSON.stringify(patch);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return compressed;
  }

  /**
   * Decompress URL string to PatchData.
   */
  decompressFromURL(compressed: string): PatchData | null {
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) {
        console.error('[PresetManager] Failed to decompress URL data');
        return null;
      }

      const patch = JSON.parse(json) as PatchData;
      return this.migrate(patch);
    } catch (error) {
      console.error('[PresetManager] Failed to parse URL data:', error);
      return null;
    }
  }

  /**
   * Generate a shareable URL for the current patch.
   */
  generateShareURL(patch: PatchData, baseURL: string = window.location.origin): string {
    const compressed = this.compressToURL(patch);
    return `${baseURL}?patch=${compressed}`;
  }

  /**
   * Check if URL contains a patch parameter.
   */
  hasURLPatch(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('patch');
  }

  /**
   * Load patch from current URL if present.
   */
  loadFromURL(): PatchData | null {
    const params = new URLSearchParams(window.location.search);
    const compressed = params.get('patch');

    if (!compressed) {
      return null;
    }

    return this.decompressFromURL(compressed);
  }

  /**
   * Clear patch parameter from URL (after loading).
   */
  clearURLPatch(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('patch');
    window.history.replaceState({}, '', url.toString());
  }

  // ===========================================
  // LOCAL STORAGE
  // ===========================================

  /**
   * Save patch to local storage.
   */
  saveToLocalStorage(patch: PatchData, key: string = STORAGE_KEYS.AUTOSAVE): boolean {
    try {
      const json = JSON.stringify(patch);
      localStorage.setItem(key, json);
      console.log(`[PresetManager] Saved to localStorage: ${key}`);
      return true;
    } catch (error) {
      console.error('[PresetManager] Failed to save to localStorage:', error);
      return false;
    }
  }

  /**
   * Load patch from local storage.
   */
  loadFromLocalStorage(key: string = STORAGE_KEYS.AUTOSAVE): PatchData | null {
    try {
      const json = localStorage.getItem(key);
      if (!json) {
        return null;
      }

      const patch = JSON.parse(json) as PatchData;
      return this.migrate(patch);
    } catch (error) {
      console.error('[PresetManager] Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Get autosaved patch if available.
   */
  getAutosave(): PatchData | null {
    return this.loadFromLocalStorage(STORAGE_KEYS.AUTOSAVE);
  }

  /**
   * Autosave current patch.
   */
  autosave(patch: PatchData): boolean {
    return this.saveToLocalStorage(patch, STORAGE_KEYS.AUTOSAVE);
  }

  /**
   * Clear autosave.
   */
  clearAutosave(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTOSAVE);
  }

  // ===========================================
  // USER PRESETS
  // ===========================================

  /**
   * Get all saved user presets.
   */
  getUserPresets(): PatchData[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.USER_PRESETS);
      if (!json) {
        return [];
      }

      const presets = JSON.parse(json) as PatchData[];
      return presets.map(p => this.migrate(p));
    } catch (error) {
      console.error('[PresetManager] Failed to load user presets:', error);
      return [];
    }
  }

  /**
   * Save a user preset.
   */
  saveUserPreset(patch: PatchData): boolean {
    try {
      const presets = this.getUserPresets();
      
      // Check for existing preset with same name
      const existingIndex = presets.findIndex(p => p.meta.name === patch.meta.name);
      if (existingIndex >= 0) {
        presets[existingIndex] = patch;
      } else {
        presets.push(patch);
      }

      localStorage.setItem(STORAGE_KEYS.USER_PRESETS, JSON.stringify(presets));
      console.log(`[PresetManager] Saved user preset: ${patch.meta.name}`);
      return true;
    } catch (error) {
      console.error('[PresetManager] Failed to save user preset:', error);
      return false;
    }
  }

  /**
   * Delete a user preset by name.
   */
  deleteUserPreset(name: string): boolean {
    try {
      const presets = this.getUserPresets();
      const filtered = presets.filter(p => p.meta.name !== name);

      if (filtered.length === presets.length) {
        console.warn(`[PresetManager] Preset not found: ${name}`);
        return false;
      }

      localStorage.setItem(STORAGE_KEYS.USER_PRESETS, JSON.stringify(filtered));
      console.log(`[PresetManager] Deleted user preset: ${name}`);
      return true;
    } catch (error) {
      console.error('[PresetManager] Failed to delete user preset:', error);
      return false;
    }
  }

  // ===========================================
  // VERSION MIGRATION
  // ===========================================

  /**
   * Migrate patch to current version if needed.
   */
  private migrate(patch: PatchData): PatchData {
    const patchVersion = patch.meta?.version || '0.0.0';

    if (patchVersion === CURRENT_PATCH_VERSION) {
      return patch;
    }

    console.log(`[PresetManager] Migrating patch from ${patchVersion} to ${CURRENT_PATCH_VERSION}`);

    let migrated = patch;
    const sortedVersions = Object.keys(migrations).sort();

    for (const fromVersion of sortedVersions) {
      if (this.compareVersions(patchVersion, fromVersion) <= 0) {
        migrated = migrations[fromVersion](migrated);
      }
    }

    // Update version
    migrated.meta = { ...migrated.meta, version: CURRENT_PATCH_VERSION };

    return migrated;
  }

  /**
   * Compare semantic versions.
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }

    return 0;
  }

  // ===========================================
  // VALIDATION
  // ===========================================

  /**
   * Validate patch data structure.
   */
  validate(patch: any): patch is PatchData {
    if (!patch || typeof patch !== 'object') {
      return false;
    }

    if (!patch.meta || typeof patch.meta !== 'object') {
      return false;
    }

    if (!patch.graph || !Array.isArray(patch.graph.nodes) || !Array.isArray(patch.graph.edges)) {
      return false;
    }

    if (!patch.audio || typeof patch.audio.nodes !== 'object') {
      return false;
    }

    if (!patch.global || typeof patch.global !== 'object') {
      return false;
    }

    return true;
  }

  // ===========================================
  // EXPORT / IMPORT (File)
  // ===========================================

  /**
   * Export patch to downloadable JSON file.
   */
  exportToFile(patch: PatchData): void {
    const json = JSON.stringify(patch, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${patch.meta.name.replace(/\s+/g, '-').toLowerCase()}.ambientflow.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  /**
   * Import patch from file.
   */
  async importFromFile(file: File): Promise<PatchData | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const patch = JSON.parse(json) as PatchData;

          if (!this.validate(patch)) {
            console.error('[PresetManager] Invalid patch file');
            resolve(null);
            return;
          }

          resolve(this.migrate(patch));
        } catch (error) {
          console.error('[PresetManager] Failed to parse file:', error);
          resolve(null);
        }
      };

      reader.onerror = () => {
        console.error('[PresetManager] Failed to read file');
        resolve(null);
      };

      reader.readAsText(file);
    });
  }
}

// Export singleton instance
export const presetManager = PresetManager.getInstance();

export default presetManager;
