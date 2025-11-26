/**
 * Sample System Exports
 * @module audio/samples
 */

export { SampleLibrary, SAMPLE_CATALOG } from './SampleLibrary';
export { SamplePlayer } from './SamplePlayer';
export { LRUAudioCache } from './LRUCache';
export { UserSampleImporter } from './UserSampleImporter';
export { PerformanceMonitor, performanceMonitor } from './PerformanceMonitor';

export type {
  SampleCategory,
  SampleMetadata,
  LoadedSample,
  SamplePlayerConfig,
  SampleNodeData,
  MemoryBudget,
} from './types';

export type { ImportOptions, ImportResult } from './UserSampleImporter';

export {
  DEFAULT_MEMORY_BUDGET,
  getBufferMemorySize,
  pitchToPlaybackRate,
  playbackRateToPitch,
  formatSampleDuration,
  formatFileSize,
} from './types';
