/**
 * SampleManager - Handles loading, decoding, and caching of audio samples.
 * 
 * Responsibilities:
 * - Fetch and decode audio files into AudioBuffers
 * - Cache buffers for reuse
 * - Provide buffer data to AudioWorklets via message passing
 * - Support both one-shot samples and long field recordings
 * 
 * @module audio/engine/SampleManager
 */

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface SampleMetadata {
  /** Unique identifier for the sample */
  id: string;
  /** Display name */
  name: string;
  /** URL or path to the audio file */
  url: string;
  /** Sample category */
  category: 'texture' | 'impulse' | 'oneshot' | 'field';
  /** Duration in seconds (populated after loading) */
  duration?: number;
  /** Sample rate (populated after loading) */
  sampleRate?: number;
  /** Number of channels (populated after loading) */
  channels?: number;
}

export interface LoadedSample extends SampleMetadata {
  /** The decoded audio buffer */
  buffer: AudioBuffer;
  /** Float32Array for each channel (for worklet transfer) */
  channelData: Float32Array[];
}

// ===========================================
// BUILT-IN SAMPLE LIBRARY
// ===========================================

/**
 * Default sample library with URLs to free/CC0 sounds.
 * These can be replaced or extended with custom samples.
 */
export const SAMPLE_LIBRARY: SampleMetadata[] = [
  // Textures (for granular synthesis)
  {
    id: 'texture-rain-roof',
    name: 'Rain on Roof',
    url: '/samples/textures/rain-roof.wav',
    category: 'texture',
  },
  {
    id: 'texture-forest-wind',
    name: 'Forest Wind',
    url: '/samples/textures/forest-wind.wav',
    category: 'texture',
  },
  {
    id: 'texture-ocean-waves',
    name: 'Ocean Waves',
    url: '/samples/textures/ocean-waves.wav',
    category: 'texture',
  },
  {
    id: 'texture-vinyl-crackle',
    name: 'Vinyl Crackle',
    url: '/samples/textures/vinyl-crackle.wav',
    category: 'texture',
  },
  
  // Impulse Responses (for convolution reverb)
  {
    id: 'ir-cathedral',
    name: 'Cathedral',
    url: '/samples/impulses/cathedral.wav',
    category: 'impulse',
  },
  {
    id: 'ir-small-room',
    name: 'Small Room',
    url: '/samples/impulses/small-room.wav',
    category: 'impulse',
  },
  {
    id: 'ir-cave',
    name: 'Cave',
    url: '/samples/impulses/cave.wav',
    category: 'impulse',
  },
  {
    id: 'ir-plate',
    name: 'Plate Reverb',
    url: '/samples/impulses/plate.wav',
    category: 'impulse',
  },
  
  // One-shots (for physical modeling exciters)
  {
    id: 'oneshot-click',
    name: 'Click',
    url: '/samples/oneshots/click.wav',
    category: 'oneshot',
  },
  {
    id: 'oneshot-thud',
    name: 'Thud',
    url: '/samples/oneshots/thud.wav',
    category: 'oneshot',
  },
  {
    id: 'oneshot-pluck',
    name: 'Pluck',
    url: '/samples/oneshots/pluck.wav',
    category: 'oneshot',
  },
];

// ===========================================
// SAMPLE MANAGER CLASS
// ===========================================

export class SampleManager {
  private audioContext: AudioContext;
  private cache: Map<string, LoadedSample> = new Map();
  private loadingPromises: Map<string, Promise<LoadedSample>> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  // ===========================================
  // PUBLIC METHODS
  // ===========================================

  /**
   * Load a sample by ID from the built-in library.
   * Returns cached version if already loaded.
   */
  async loadSample(id: string): Promise<LoadedSample> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached) return cached;

    // Check if already loading
    const loading = this.loadingPromises.get(id);
    if (loading) return loading;

    // Find sample metadata
    const metadata = SAMPLE_LIBRARY.find(s => s.id === id);
    if (!metadata) {
      throw new Error(`Sample not found: ${id}`);
    }

    return this.loadFromUrl(metadata);
  }

  /**
   * Load a sample from a custom URL.
   */
  async loadFromUrl(metadata: SampleMetadata): Promise<LoadedSample> {
    const { id } = metadata;

    // Create loading promise
    const loadPromise = this.fetchAndDecode(metadata);
    this.loadingPromises.set(id, loadPromise);

    try {
      const sample = await loadPromise;
      this.cache.set(id, sample);
      return sample;
    } finally {
      this.loadingPromises.delete(id);
    }
  }

  /**
   * Load multiple samples in parallel.
   */
  async loadSamples(ids: string[]): Promise<LoadedSample[]> {
    return Promise.all(ids.map(id => this.loadSample(id)));
  }

  /**
   * Load all samples in a category.
   */
  async loadCategory(category: SampleMetadata['category']): Promise<LoadedSample[]> {
    const samples = SAMPLE_LIBRARY.filter(s => s.category === category);
    return Promise.all(samples.map(s => this.loadFromUrl(s)));
  }

  /**
   * Get a loaded sample from cache.
   * Returns undefined if not loaded.
   */
  getSample(id: string): LoadedSample | undefined {
    return this.cache.get(id);
  }

  /**
   * Check if a sample is loaded.
   */
  isLoaded(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Get channel data for transfer to AudioWorklet.
   * Returns a transferable Float32Array for each channel.
   */
  getChannelData(id: string): Float32Array[] | undefined {
    const sample = this.cache.get(id);
    return sample?.channelData;
  }

  /**
   * Preload all samples in the library.
   * Useful for ensuring no loading delays during playback.
   */
  async preloadAll(): Promise<void> {
    await Promise.all(SAMPLE_LIBRARY.map(s => this.loadFromUrl(s)));
  }

  /**
   * Clear the cache to free memory.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get list of all available samples.
   */
  getLibrary(): SampleMetadata[] {
    return [...SAMPLE_LIBRARY];
  }

  /**
   * Get list of loaded samples.
   */
  getLoadedSamples(): LoadedSample[] {
    return Array.from(this.cache.values());
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  /**
   * Fetch audio file and decode to AudioBuffer.
   */
  private async fetchAndDecode(metadata: SampleMetadata): Promise<LoadedSample> {
    const { id, url, name, category } = metadata;

    try {
      // Fetch the audio file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Get ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();

      // Decode to AudioBuffer
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Extract channel data for worklet transfer
      const channelData: Float32Array[] = [];
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        // Create a copy (original is detached on transfer)
        channelData.push(new Float32Array(buffer.getChannelData(i)));
      }

      const loadedSample: LoadedSample = {
        id,
        name,
        url,
        category,
        buffer,
        channelData,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
      };

      console.log(`[SampleManager] Loaded: ${name} (${buffer.duration.toFixed(2)}s, ${buffer.numberOfChannels}ch)`);

      return loadedSample;
    } catch (error) {
      console.error(`[SampleManager] Failed to load ${name}:`, error);
      throw error;
    }
  }

  /**
   * Generate a synthetic sample (for testing without audio files).
   */
  generateTestSample(id: string, duration: number = 2): LoadedSample {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);

    // Fill with pink noise
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
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

    const channelData = [
      new Float32Array(buffer.getChannelData(0)),
      new Float32Array(buffer.getChannelData(1)),
    ];

    const sample: LoadedSample = {
      id,
      name: `Test Sample (${duration}s)`,
      url: '',
      category: 'texture',
      buffer,
      channelData,
      duration,
      sampleRate,
      channels: 2,
    };

    this.cache.set(id, sample);
    console.log(`[SampleManager] Generated test sample: ${id}`);

    return sample;
  }
}

export default SampleManager;
