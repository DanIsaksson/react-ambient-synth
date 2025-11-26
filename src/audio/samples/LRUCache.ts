/**
 * LRUCache - Least Recently Used cache for AudioBuffers.
 * 
 * Implements memory-bounded caching with automatic eviction
 * of least recently accessed samples when limits are reached.
 * 
 * @module audio/samples/LRUCache
 */

import type { LoadedSample, MemoryBudget } from './types';
import { DEFAULT_MEMORY_BUDGET, getBufferMemorySize } from './types';

// ===========================================
// CACHE ENTRY
// ===========================================

interface CacheEntry {
  sample: LoadedSample;
  lastAccessed: number;
  memorySize: number;
}

// ===========================================
// LRU CACHE CLASS
// ===========================================

export class LRUAudioCache {
  private cache: Map<string, CacheEntry> = new Map();
  private budget: MemoryBudget;
  private currentSize: number = 0;
  private onEvict?: (id: string) => void;

  constructor(budget: MemoryBudget = DEFAULT_MEMORY_BUDGET) {
    this.budget = budget;
    console.log(`[LRUCache] Initialized with ${(budget.maxBytes / (1024 * 1024)).toFixed(0)}MB budget`);
  }

  // ===========================================
  // PUBLIC METHODS
  // ===========================================

  /**
   * Store a sample in the cache.
   * Automatically evicts LRU entries if over budget.
   */
  set(id: string, sample: LoadedSample): void {
    const memorySize = getBufferMemorySize(sample.buffer);
    
    // If single sample exceeds budget, don't cache it
    if (memorySize > this.budget.maxBytes) {
      console.warn(`[LRUCache] Sample ${id} (${this.formatBytes(memorySize)}) exceeds budget, not caching`);
      return;
    }

    // Remove existing entry if present (will be re-added with new timestamp)
    if (this.cache.has(id)) {
      this.remove(id);
    }

    // Evict until we have room
    while (this.currentSize + memorySize > this.budget.maxBytes) {
      if (!this.evictOldest()) {
        // No more entries to evict
        console.warn(`[LRUCache] Cannot free enough memory for ${id}`);
        return;
      }
    }

    // Store entry
    const entry: CacheEntry = {
      sample: {
        ...sample,
        lastAccessed: Date.now(),
        memorySize,
      },
      lastAccessed: Date.now(),
      memorySize,
    };

    this.cache.set(id, entry);
    this.currentSize += memorySize;

    // Check thresholds
    this.checkThresholds();

    console.log(`[LRUCache] Cached: ${id} (${this.formatBytes(memorySize)}). ` +
                `Total: ${this.formatBytes(this.currentSize)} / ${this.formatBytes(this.budget.maxBytes)}`);
  }

  /**
   * Get a sample from the cache.
   * Updates last accessed time (LRU touch).
   */
  get(id: string): LoadedSample | undefined {
    const entry = this.cache.get(id);
    if (!entry) return undefined;

    // Touch - update last accessed
    entry.lastAccessed = Date.now();
    entry.sample.lastAccessed = Date.now();

    return entry.sample;
  }

  /**
   * Check if a sample is cached.
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Remove a sample from the cache.
   */
  remove(id: string): boolean {
    const entry = this.cache.get(id);
    if (!entry) return false;

    this.cache.delete(id);
    this.currentSize -= entry.memorySize;

    if (this.onEvict) {
      this.onEvict(id);
    }

    console.log(`[LRUCache] Removed: ${id}. Freed: ${this.formatBytes(entry.memorySize)}`);
    return true;
  }

  /**
   * Clear all cached samples.
   */
  clear(): void {
    const count = this.cache.size;
    const freed = this.currentSize;
    
    this.cache.clear();
    this.currentSize = 0;

    console.log(`[LRUCache] Cleared ${count} samples, freed ${this.formatBytes(freed)}`);
  }

  /**
   * Get current memory usage in bytes.
   */
  getMemoryUsage(): number {
    return this.currentSize;
  }

  /**
   * Get memory usage as fraction of budget (0-1).
   */
  getMemoryUsageRatio(): number {
    return this.currentSize / this.budget.maxBytes;
  }

  /**
   * Get number of cached samples.
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Get all cached sample IDs.
   */
  getIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Set callback for eviction events.
   */
  setOnEvict(callback: (id: string) => void): void {
    this.onEvict = callback;
  }

  /**
   * Force eviction to reach target memory usage.
   */
  evictTo(targetBytes: number): number {
    let evictedCount = 0;
    
    while (this.currentSize > targetBytes && this.cache.size > 0) {
      if (this.evictOldest()) {
        evictedCount++;
      } else {
        break;
      }
    }

    console.log(`[LRUCache] Evicted ${evictedCount} samples to reach ${this.formatBytes(targetBytes)}`);
    return evictedCount;
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    count: number;
    memoryUsed: number;
    memoryBudget: number;
    usageRatio: number;
    oldestId: string | null;
    newestId: string | null;
  } {
    let oldest: { id: string; time: number } | null = null;
    let newest: { id: string; time: number } | null = null;

    for (const [id, entry] of this.cache) {
      if (!oldest || entry.lastAccessed < oldest.time) {
        oldest = { id, time: entry.lastAccessed };
      }
      if (!newest || entry.lastAccessed > newest.time) {
        newest = { id, time: entry.lastAccessed };
      }
    }

    return {
      count: this.cache.size,
      memoryUsed: this.currentSize,
      memoryBudget: this.budget.maxBytes,
      usageRatio: this.getMemoryUsageRatio(),
      oldestId: oldest?.id ?? null,
      newestId: newest?.id ?? null,
    };
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  /**
   * Evict the least recently used entry.
   */
  private evictOldest(): boolean {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestId = id;
        oldestTime = entry.lastAccessed;
      }
    }

    if (oldestId) {
      return this.remove(oldestId);
    }

    return false;
  }

  /**
   * Check memory thresholds and log warnings.
   */
  private checkThresholds(): void {
    const ratio = this.getMemoryUsageRatio();

    if (ratio >= this.budget.criticalThreshold) {
      console.warn(`[LRUCache] CRITICAL: Memory at ${(ratio * 100).toFixed(0)}% - forcing eviction`);
      this.evictTo(this.budget.maxBytes * this.budget.warningThreshold);
    } else if (ratio >= this.budget.warningThreshold) {
      console.warn(`[LRUCache] Warning: Memory at ${(ratio * 100).toFixed(0)}%`);
    }
  }

  /**
   * Format bytes as human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

export default LRUAudioCache;
