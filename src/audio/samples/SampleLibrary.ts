/**
 * SampleLibrary - Manages sample catalog, loading, and caching.
 * 
 * Features:
 * - Lazy loading of sample catalog from JSON manifest
 * - On-demand audio buffer loading with deduplication
 * - LRU cache for memory management
 * - Preloading strategies (eager, predictive, background)
 * - User sample import support
 * 
 * @module audio/samples/SampleLibrary
 */

import type { SampleMetadata, LoadedSample, SampleCategory } from './types';
import { getBufferMemorySize } from './types';
import { LRUAudioCache } from './LRUCache';

// ===========================================
// SAMPLE CATALOG (Built-in samples)
// ===========================================

/**
 * Default sample catalog - matches /samples/catalog.json
 */
export const SAMPLE_CATALOG: SampleMetadata[] = [
  // Ambient
  { id: 'squeaky-chair', name: 'Squeaky Chair', category: 'ambient', tags: ['chair', 'ambient', 'background'], url: '/samples/ambient/0 Later - unknown album/00 - 0 Later - ago-squeaky-chair-sfxbackground-noiseambient-noise-149099.ogg', format: 'ogg', fileSize: 200000 },
  { id: 'car-pass', name: 'Car Pass By', category: 'ambient', tags: ['car', 'traffic', 'urban'], url: '/samples/ambient/0 Later - unknown album/00 - 0 Later - car-pass-by-337871.ogg', format: 'ogg', fileSize: 150000 },
  { id: 'computer-hum', name: 'Computer Hum', category: 'ambient', tags: ['computer', 'hum', 'drone'], url: '/samples/ambient/0 Later - unknown album/00 - 0 Later - computer-hum-102466.ogg', format: 'ogg', fileSize: 180000 },
  { id: 'underwater-noise', name: 'Underwater Noise', category: 'ambient', tags: ['underwater', 'water', 'noise'], url: '/samples/ambient/0 Later - unknown album/00 - 0 Later - underwater-white-noise-46423.ogg', format: 'ogg', fileSize: 250000 },
  
  // Percussion
  { id: 'bullet-glass', name: 'Bullet on Glass', category: 'percussion', tags: ['bullet', 'glass', 'impact'], url: '/samples/percussion/Bullet on glass.ogg', format: 'ogg', fileSize: 50000 },
  { id: 'bullet-metal', name: 'Bullet on Metal', category: 'percussion', tags: ['bullet', 'metal', 'impact'], url: '/samples/percussion/Bullet on metal.ogg', format: 'ogg', fileSize: 45000 },
  { id: 'glass-break', name: 'Glass Break', category: 'percussion', tags: ['glass', 'break', 'shatter'], url: '/samples/percussion/Glass break.ogg', format: 'ogg', fileSize: 80000 },
  { id: 'gunshot', name: 'Gunshot', category: 'percussion', tags: ['gun', 'shot', 'loud'], url: '/samples/percussion/Gunshot.ogg', format: 'ogg', fileSize: 60000 },
  
  // Textures
  { id: 'footstep-wood', name: 'Footstep on Wood', category: 'texture', tags: ['footstep', 'wood', 'walk'], url: '/samples/textures/Footstep on wood 3.ogg', format: 'ogg', fileSize: 40000 },
  { id: 'helicopter-loop', name: 'Helicopter Loop', category: 'texture', tags: ['helicopter', 'loop', 'drone'], url: '/samples/textures/Helicopter loop.ogg', format: 'ogg', fileSize: 300000 },
  { id: 'metal-knocking', name: 'Metal Knocking', category: 'texture', tags: ['metal', 'knock', 'rhythm'], url: '/samples/textures/Knocking fast on metal.ogg', format: 'ogg', fileSize: 120000 },
  { id: 'metallic-footsteps', name: 'Metallic Footsteps Loop', category: 'texture', tags: ['footsteps', 'metal', 'loop'], url: '/samples/textures/Light metallic footsteps loop.ogg', format: 'ogg', fileSize: 200000 },
  { id: 'sink-water', name: 'Sink Water Loop', category: 'texture', tags: ['sink', 'water', 'loop'], url: '/samples/textures/Sink water loop.ogg', format: 'ogg', fileSize: 280000 },
  { id: 'sink-water-soft', name: 'Sink Water Soft Loop', category: 'texture', tags: ['sink', 'water', 'soft'], url: '/samples/textures/Sink water soft loop.ogg', format: 'ogg', fileSize: 250000 },
  { id: 'sliding-footsteps', name: 'Sliding Footsteps Loop', category: 'texture', tags: ['footsteps', 'sliding', 'metal'], url: '/samples/textures/Sliding metallic footsteps loop.ogg', format: 'ogg', fileSize: 220000 },
  { id: 'underwater-loop', name: 'Underwater Loop', category: 'texture', tags: ['underwater', 'loop', 'ambient'], url: '/samples/textures/Underwater loop.ogg', format: 'ogg', fileSize: 350000 },
  { id: 'weapon-trigger', name: 'Weapon Trigger (No Ammo)', category: 'texture', tags: ['weapon', 'trigger', 'click'], url: '/samples/textures/Weapon trigger no ammo.ogg', format: 'ogg', fileSize: 15000 },
  
  // Tonal
  { id: 'ghost-whistle', name: 'Ghost Whistle Solo', category: 'tonal', tags: ['whistle', 'ghost', 'eerie'], url: '/samples/tonal/AudioLab - unknown album/00 - AudioLab - Ghost Whistle Solo .ogg', format: 'ogg', fileSize: 180000 },
  { id: 'space-voice', name: 'Space Voice 2', category: 'tonal', tags: ['space', 'voice', 'ethereal'], url: '/samples/tonal/AudioLab - unknown album/00 - AudioLab - Space Voice 2 .ogg', format: 'ogg', fileSize: 200000 },
  { id: 'choir-1', name: 'Choir 1', category: 'tonal', tags: ['choir', 'voice', 'choral'], url: '/samples/tonal/Other/00 - 0 Later - Chior(1).ogg', format: 'ogg', fileSize: 250000 },
  { id: 'choir-2', name: 'Choir 2', category: 'tonal', tags: ['choir', 'voice', 'choral'], url: '/samples/tonal/Other/00 - 0 Later - Chior.ogg', format: 'ogg', fileSize: 240000 },
  { id: 'ohh-e3', name: 'Ohh E3', category: 'tonal', tags: ['voice', 'ohh', 'vocal'], url: '/samples/tonal/Other/00 - 0 Later - Ohh E3.ogg', format: 'ogg', fileSize: 90000, rootNote: 52 },
  { id: 'voice-house', name: 'Voice House', category: 'tonal', tags: ['voice', 'house', 'electronic'], url: '/samples/tonal/Other/00 - 0 Later - Voice House.ogg', format: 'ogg', fileSize: 180000 },
  { id: 'boomp', name: 'Boomp', category: 'tonal', tags: ['bass', 'boom', 'impact'], url: '/samples/tonal/Other/00 - 0 Later - boomp.ogg', format: 'ogg', fileSize: 70000 },
  { id: 'vowels', name: 'Vowels', category: 'tonal', tags: ['voice', 'vowels', 'texture'], url: '/samples/tonal/Other/00 - 0 Later - vowels.ogg', format: 'ogg', fileSize: 150000 },
];

// ===========================================
// SAMPLE LIBRARY CLASS
// ===========================================

export class SampleLibrary {
  private audioContext: AudioContext;
  private catalog: Map<string, SampleMetadata> = new Map();
  private cache: LRUAudioCache;
  private loadingPromises: Map<string, Promise<LoadedSample>> = new Map();
  private preloadQueue: Set<string> = new Set();
  private isPreloading: boolean = false;

  constructor(audioContext: AudioContext, maxCacheBytes?: number) {
    this.audioContext = audioContext;
    this.cache = new LRUAudioCache(
      maxCacheBytes 
        ? { maxBytes: maxCacheBytes, warningThreshold: 0.8, criticalThreshold: 0.95 }
        : undefined
    );

    // Initialize catalog with built-in samples
    this.loadBuiltInCatalog();
  }

  // ===========================================
  // CATALOG MANAGEMENT
  // ===========================================

  /**
   * Load built-in sample catalog.
   */
  private loadBuiltInCatalog(): void {
    SAMPLE_CATALOG.forEach(sample => {
      this.catalog.set(sample.id, sample);
    });
    console.log(`[SampleLibrary] Loaded ${this.catalog.size} samples in catalog`);
  }

  /**
   * Load sample catalog from remote JSON.
   * Merges with existing catalog.
   */
  async loadRemoteCatalog(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const samples: SampleMetadata[] = await response.json();
      samples.forEach(sample => {
        this.catalog.set(sample.id, sample);
      });
      
      console.log(`[SampleLibrary] Loaded ${samples.length} samples from ${url}`);
    } catch (error) {
      console.error(`[SampleLibrary] Failed to load catalog from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get sample metadata by ID.
   */
  getMetadata(id: string): SampleMetadata | undefined {
    return this.catalog.get(id);
  }

  /**
   * Get all samples in a category.
   */
  getByCategory(category: SampleCategory): SampleMetadata[] {
    return Array.from(this.catalog.values()).filter(s => s.category === category);
  }

  /**
   * Search samples by name or tags.
   */
  search(query: string): SampleMetadata[] {
    const q = query.toLowerCase();
    return Array.from(this.catalog.values()).filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }

  /**
   * Get all categories with sample counts.
   */
  getCategories(): { category: SampleCategory; count: number }[] {
    const counts = new Map<SampleCategory, number>();
    
    for (const sample of this.catalog.values()) {
      counts.set(sample.category, (counts.get(sample.category) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
  }

  // ===========================================
  // SAMPLE LOADING
  // ===========================================

  /**
   * Load a sample by ID.
   * Returns cached version if available.
   */
  async getSample(id: string): Promise<LoadedSample> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached) return cached;

    // Check if already loading (dedupe concurrent requests)
    const loading = this.loadingPromises.get(id);
    if (loading) return loading;

    // Get metadata
    const metadata = this.catalog.get(id);
    if (!metadata) {
      throw new Error(`Sample not found in catalog: ${id}`);
    }

    // Start loading
    const promise = this.loadSample(metadata);
    this.loadingPromises.set(id, promise);

    try {
      const sample = await promise;
      this.cache.set(id, sample);
      return sample;
    } finally {
      this.loadingPromises.delete(id);
    }
  }

  /**
   * Check if a sample is loaded in cache.
   */
  isLoaded(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Check if a sample is currently loading.
   */
  isLoading(id: string): boolean {
    return this.loadingPromises.has(id);
  }

  /**
   * Load sample from URL with decoding.
   */
  private async loadSample(metadata: SampleMetadata): Promise<LoadedSample> {
    const startTime = performance.now();

    try {
      // Fetch audio file
      const response = await fetch(metadata.url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Decode audio data
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Extract channel data for worklet transfer
      const channelData: Float32Array[] = [];
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        channelData.push(new Float32Array(buffer.getChannelData(i)));
      }

      const loadedSample: LoadedSample = {
        ...metadata,
        buffer,
        channelData,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        lastAccessed: Date.now(),
        memorySize: getBufferMemorySize(buffer),
      };

      const loadTime = performance.now() - startTime;
      console.log(`[SampleLibrary] Loaded "${metadata.name}" in ${loadTime.toFixed(0)}ms ` +
                  `(${(loadedSample.memorySize / 1024).toFixed(0)}KB)`);

      return loadedSample;
    } catch (error) {
      console.error(`[SampleLibrary] Failed to load "${metadata.name}":`, error);
      throw error;
    }
  }

  // ===========================================
  // PRELOADING
  // ===========================================

  /**
   * Preload a sample (low priority, cancelable).
   */
  preload(id: string): void {
    if (this.cache.has(id) || this.loadingPromises.has(id)) return;
    
    this.preloadQueue.add(id);
    this.processPreloadQueue();
  }

  /**
   * Cancel preloading for a sample.
   */
  cancelPreload(id: string): void {
    this.preloadQueue.delete(id);
  }

  /**
   * Preload all samples in a category.
   */
  async preloadCategory(category: SampleCategory): Promise<void> {
    const samples = this.getByCategory(category);
    await Promise.all(samples.map(s => this.getSample(s.id)));
  }

  /**
   * Process preload queue in background.
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.size === 0) return;

    this.isPreloading = true;

    try {
      // Use requestIdleCallback if available for true background loading
      const loadNext = async () => {
        const id = this.preloadQueue.values().next().value;
        if (!id) {
          this.isPreloading = false;
          return;
        }

        this.preloadQueue.delete(id);

        try {
          await this.getSample(id);
        } catch (e) {
          // Preload failures are non-critical
          console.warn(`[SampleLibrary] Preload failed for ${id}:`, e);
        }

        // Continue with next if queue not empty
        if (this.preloadQueue.size > 0) {
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => loadNext());
          } else {
            setTimeout(loadNext, 100);
          }
        } else {
          this.isPreloading = false;
        }
      };

      loadNext();
    } catch (e) {
      this.isPreloading = false;
    }
  }

  // ===========================================
  // USER SAMPLES
  // ===========================================

  /**
   * Import a user-uploaded audio file.
   */
  async importUserSample(file: File): Promise<LoadedSample> {
    // Validate file type
    const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/flac'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|flac)$/i)) {
      throw new Error(`Unsupported audio format: ${file.type || file.name}`);
    }

    // Size limit (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File too large (max 50MB): ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
    }

    // Generate ID
    const id = `user-${crypto.randomUUID()}`;

    // Create metadata
    const metadata: SampleMetadata = {
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      category: 'user',
      tags: ['user', 'imported'],
      url: URL.createObjectURL(file),
      format: this.getFormatFromFilename(file.name),
      fileSize: file.size,
    };

    // Add to catalog
    this.catalog.set(id, metadata);

    // Load and cache
    return this.getSample(id);
  }

  /**
   * Get format from filename extension.
   */
  private getFormatFromFilename(filename: string): 'wav' | 'flac' | 'ogg' | 'mp3' {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'flac': return 'flac';
      case 'ogg': return 'ogg';
      case 'mp3': return 'mp3';
      default: return 'wav';
    }
  }

  // ===========================================
  // MEMORY MANAGEMENT
  // ===========================================

  /**
   * Get memory usage statistics.
   */
  getMemoryStats() {
    return this.cache.getStats();
  }

  /**
   * Force cache eviction to target size.
   */
  evictTo(targetBytes: number): number {
    return this.cache.evictTo(targetBytes);
  }

  /**
   * Clear all cached samples.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ===========================================
  // SYNTHETIC SAMPLES (for testing)
  // ===========================================

  /**
   * Generate a synthetic test sample (pink noise).
   */
  generateTestSample(duration: number = 2): LoadedSample {
    const id = `test-${Date.now()}`;
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);

    // Generate pink noise
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    const sample: LoadedSample = {
      id,
      name: `Test Sample (${duration}s)`,
      category: 'texture',
      tags: ['test', 'generated'],
      url: '',
      format: 'wav',
      fileSize: 0,
      buffer,
      channelData: [
        new Float32Array(buffer.getChannelData(0)),
        new Float32Array(buffer.getChannelData(1)),
      ],
      duration,
      sampleRate,
      channels: 2,
      lastAccessed: Date.now(),
      memorySize: getBufferMemorySize(buffer),
    };

    this.cache.set(id, sample);
    return sample;
  }
}

export default SampleLibrary;
