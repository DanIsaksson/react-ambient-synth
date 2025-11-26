/**
 * useSampleStore - Zustand store for sample library management.
 * 
 * Provides:
 * - Sample library initialization
 * - Sample loading and caching
 * - User sample import
 * - Memory usage tracking
 * 
 * @module store/useSampleStore
 */

import { create } from 'zustand';
import { SampleLibrary, UserSampleImporter } from '../audio/samples';
import type { SampleMetadata, LoadedSample, SampleCategory, ImportOptions } from '../audio/samples';
import { audioCore } from '../audio/engine/AudioCore';

interface SampleStoreState {
  // Library instance
  library: SampleLibrary | null;
  importer: UserSampleImporter | null;
  
  // State
  isInitialized: boolean;
  isLoading: boolean;
  loadingId: string | null;
  
  // Catalog
  catalog: SampleMetadata[];
  categories: { category: SampleCategory; count: number }[];
  
  // Memory
  memoryUsed: number;
  memoryBudget: number;
  
  // User samples
  userSamples: SampleMetadata[];
  
  // Actions
  initialize: () => Promise<void>;
  loadSample: (id: string) => Promise<LoadedSample | null>;
  getSample: (id: string) => LoadedSample | undefined;
  preloadCategory: (category: SampleCategory) => Promise<void>;
  importUserSample: (file: File, options?: ImportOptions) => Promise<LoadedSample | null>;
  deleteUserSample: (id: string) => void;
  refreshMemoryStats: () => void;
  searchSamples: (query: string) => SampleMetadata[];
}

export const useSampleStore = create<SampleStoreState>((set, get) => ({
  // Initial state
  library: null,
  importer: null,
  isInitialized: false,
  isLoading: false,
  loadingId: null,
  catalog: [],
  categories: [],
  memoryUsed: 0,
  memoryBudget: 200 * 1024 * 1024, // 200MB
  userSamples: [],

  /**
   * Initialize the sample library.
   * Should be called after AudioCore is initialized.
   */
  initialize: async () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    const context = audioCore.getContext();
    if (!context) {
      console.warn('[SampleStore] AudioContext not available, retrying...');
      return;
    }

    const library = new SampleLibrary(context);
    const importer = new UserSampleImporter(context);

    // Get initial catalog
    const catalogArray = Array.from(library['catalog'].values());
    const categories = library.getCategories();

    set({
      library,
      importer,
      isInitialized: true,
      catalog: catalogArray,
      categories,
    });

    console.log('[SampleStore] Initialized with', catalogArray.length, 'samples');
  },

  /**
   * Load a sample by ID.
   */
  loadSample: async (id: string) => {
    const { library, isInitialized } = get();
    
    if (!isInitialized || !library) {
      console.warn('[SampleStore] Not initialized');
      return null;
    }

    set({ isLoading: true, loadingId: id });

    try {
      const sample = await library.getSample(id);
      get().refreshMemoryStats();
      return sample;
    } catch (error) {
      console.error('[SampleStore] Failed to load sample:', id, error);
      return null;
    } finally {
      set({ isLoading: false, loadingId: null });
    }
  },

  /**
   * Get a cached sample (synchronous).
   */
  getSample: (id: string) => {
    const { library } = get();
    if (!library) return undefined;
    
    // Access cache directly via internal method
    return library['cache'].get(id);
  },

  /**
   * Preload all samples in a category.
   */
  preloadCategory: async (category: SampleCategory) => {
    const { library, isInitialized } = get();
    
    if (!isInitialized || !library) return;

    set({ isLoading: true });

    try {
      await library.preloadCategory(category);
      get().refreshMemoryStats();
    } catch (error) {
      console.error('[SampleStore] Failed to preload category:', category, error);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Import a user-uploaded sample.
   */
  importUserSample: async (file: File, options?: ImportOptions) => {
    const { library, importer, isInitialized } = get();
    
    if (!isInitialized || !library || !importer) {
      console.warn('[SampleStore] Not initialized');
      return null;
    }

    set({ isLoading: true });

    try {
      const result = await importer.import(file, options);
      const { sample } = result;
      
      // Add to library cache
      library['cache'].set(sample.id, sample);
      
      // Add to user samples list
      set(state => ({
        userSamples: [...state.userSamples, sample],
        catalog: [...state.catalog, sample],
      }));
      
      get().refreshMemoryStats();
      
      console.log('[SampleStore] Imported user sample:', sample.name);
      return sample;
    } catch (error) {
      console.error('[SampleStore] Failed to import sample:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Delete a user sample.
   */
  deleteUserSample: (id: string) => {
    const { library } = get();
    
    if (library) {
      library['cache'].remove(id);
    }

    set(state => ({
      userSamples: state.userSamples.filter(s => s.id !== id),
      catalog: state.catalog.filter(s => s.id !== id),
    }));

    get().refreshMemoryStats();
  },

  /**
   * Refresh memory usage stats.
   */
  refreshMemoryStats: () => {
    const { library } = get();
    
    if (!library) return;

    const stats = library.getMemoryStats();
    set({
      memoryUsed: stats.memoryUsed,
      memoryBudget: stats.memoryBudget,
    });
  },

  /**
   * Search samples by query.
   */
  searchSamples: (query: string) => {
    const { library } = get();
    
    if (!library) return [];

    return library.search(query);
  },
}));

export default useSampleStore;
