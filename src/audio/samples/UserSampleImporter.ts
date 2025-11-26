/**
 * UserSampleImporter - Handles user-uploaded audio files.
 * 
 * Features:
 * - File type validation
 * - Size limits
 * - Audio decoding
 * - Optional normalization
 * - Optional silence trimming
 * - Waveform peak generation
 * - IndexedDB storage (future)
 * 
 * @module audio/samples/UserSampleImporter
 */

import type { SampleMetadata, LoadedSample } from './types';
import { getBufferMemorySize } from './types';

// ===========================================
// TYPES
// ===========================================

export interface ImportOptions {
  /** Normalize audio to peak at -1dB */
  normalize?: boolean;
  /** Trim silence from start and end */
  trimSilence?: boolean;
  /** Silence threshold in dB (default: -60) */
  silenceThreshold?: number;
  /** Generate waveform peaks for visualization */
  generateWaveform?: boolean;
  /** Number of waveform points to generate */
  waveformPoints?: number;
}

export interface ImportResult {
  sample: LoadedSample;
  originalSize: number;
  processedSize: number;
  peakLevel: number;
  wasNormalized: boolean;
  trimmedStart: number;
  trimmedEnd: number;
}

// ===========================================
// CONSTANTS
// ===========================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const VALID_MIME_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/webm',
];
const VALID_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.webm'];

const DEFAULT_OPTIONS: ImportOptions = {
  normalize: false,
  trimSilence: false,
  silenceThreshold: -60,
  generateWaveform: true,
  waveformPoints: 200,
};

// ===========================================
// USER SAMPLE IMPORTER CLASS
// ===========================================

export class UserSampleImporter {
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  // ===========================================
  // PUBLIC METHODS
  // ===========================================

  /**
   * Import a user-uploaded audio file.
   */
  async import(file: File, options: ImportOptions = {}): Promise<ImportResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 1. Validate file
    this.validateFile(file);

    // 2. Decode audio
    const arrayBuffer = await file.arrayBuffer();
    let buffer = await this.audioContext.decodeAudioData(arrayBuffer);
    const originalSize = getBufferMemorySize(buffer);

    // Track processing
    let peakLevel = this.getPeakLevel(buffer);
    let wasNormalized = false;
    let trimmedStart = 0;
    let trimmedEnd = 0;

    // 3. Optional: Trim silence
    if (opts.trimSilence) {
      const trimResult = this.trimSilence(buffer, opts.silenceThreshold!);
      buffer = trimResult.buffer;
      trimmedStart = trimResult.trimmedStart;
      trimmedEnd = trimResult.trimmedEnd;
    }

    // 4. Optional: Normalize
    if (opts.normalize && peakLevel < 0.89) { // Only if not already near 0dB
      buffer = this.normalize(buffer);
      wasNormalized = true;
      peakLevel = this.getPeakLevel(buffer);
    }

    // 5. Generate waveform peaks
    let waveformPeaks: number[] | undefined;
    if (opts.generateWaveform) {
      waveformPeaks = this.generateWaveformPeaks(buffer, opts.waveformPoints!);
    }

    // 6. Create metadata
    const id = `user-${crypto.randomUUID()}`;
    const name = this.cleanFilename(file.name);
    const format = this.getFormat(file.name);

    const metadata: SampleMetadata = {
      id,
      name,
      category: 'user',
      tags: ['user', 'imported'],
      url: URL.createObjectURL(file),
      format,
      fileSize: file.size,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      waveformPeaks,
    };

    // 7. Extract channel data for worklet
    const channelData: Float32Array[] = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channelData.push(new Float32Array(buffer.getChannelData(i)));
    }

    const loadedSample: LoadedSample = {
      ...metadata,
      buffer,
      channelData,
      lastAccessed: Date.now(),
      memorySize: getBufferMemorySize(buffer),
    };

    console.log(`[UserSampleImporter] Imported "${name}" (${(buffer.duration).toFixed(1)}s, ` +
                `${buffer.numberOfChannels}ch, ${(loadedSample.memorySize / 1024).toFixed(0)}KB)`);

    return {
      sample: loadedSample,
      originalSize,
      processedSize: loadedSample.memorySize,
      peakLevel,
      wasNormalized,
      trimmedStart,
      trimmedEnd,
    };
  }

  /**
   * Validate file before processing.
   */
  validateFile(file: File): void {
    // Check size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB (max: 50MB)`);
    }

    // Check MIME type
    const mimeValid = VALID_MIME_TYPES.some(type => 
      file.type === type || file.type.startsWith(type.split('/')[0])
    );

    // Check extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const extValid = VALID_EXTENSIONS.includes(ext);

    if (!mimeValid && !extValid) {
      throw new Error(`Unsupported audio format: ${file.type || ext}`);
    }
  }

  /**
   * Check if a file is a valid audio file.
   */
  isValidAudioFile(file: File): boolean {
    try {
      this.validateFile(file);
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================
  // AUDIO PROCESSING
  // ===========================================

  /**
   * Get peak level of buffer (0-1).
   */
  private getPeakLevel(buffer: AudioBuffer): number {
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    return peak;
  }

  /**
   * Normalize buffer to peak at target level.
   */
  private normalize(buffer: AudioBuffer, targetDb: number = -1): AudioBuffer {
    const peak = this.getPeakLevel(buffer);
    if (peak === 0) return buffer;

    const targetLinear = Math.pow(10, targetDb / 20);
    const gain = targetLinear / peak;

    // Create new buffer with normalized audio
    const normalized = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = normalized.getChannelData(ch);
      for (let i = 0; i < source.length; i++) {
        dest[i] = source[i] * gain;
      }
    }

    return normalized;
  }

  /**
   * Trim silence from start and end of buffer.
   */
  private trimSilence(
    buffer: AudioBuffer, 
    thresholdDb: number = -60
  ): { buffer: AudioBuffer; trimmedStart: number; trimmedEnd: number } {
    const threshold = Math.pow(10, thresholdDb / 20);
    const sampleRate = buffer.sampleRate;

    // Find first non-silent sample
    let startSample = 0;
    outer: for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) {
          startSample = Math.max(0, i - Math.floor(sampleRate * 0.01)); // 10ms margin
          break outer;
        }
      }
    }

    // Find last non-silent sample
    let endSample = buffer.length;
    outer: for (let i = buffer.length - 1; i >= startSample; i--) {
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) {
          endSample = Math.min(buffer.length, i + Math.floor(sampleRate * 0.01)); // 10ms margin
          break outer;
        }
      }
    }

    // If no trimming needed
    if (startSample === 0 && endSample === buffer.length) {
      return { buffer, trimmedStart: 0, trimmedEnd: 0 };
    }

    // Create trimmed buffer
    const newLength = endSample - startSample;
    const trimmed = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      newLength,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = trimmed.getChannelData(ch);
      for (let i = 0; i < newLength; i++) {
        dest[i] = source[startSample + i];
      }
    }

    return {
      buffer: trimmed,
      trimmedStart: startSample / sampleRate,
      trimmedEnd: (buffer.length - endSample) / sampleRate,
    };
  }

  /**
   * Generate waveform peaks for visualization.
   */
  private generateWaveformPeaks(buffer: AudioBuffer, numPoints: number): number[] {
    const channelData = buffer.getChannelData(0); // Use first channel
    const blockSize = Math.floor(channelData.length / numPoints);
    const peaks: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      
      let peak = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > peak) peak = abs;
      }
      peaks.push(peak);
    }

    return peaks;
  }

  // ===========================================
  // UTILITIES
  // ===========================================

  /**
   * Clean filename for display.
   */
  private cleanFilename(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[_-]/g, ' ')   // Replace separators with spaces
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  }

  /**
   * Get format from filename.
   */
  private getFormat(filename: string): 'wav' | 'flac' | 'ogg' | 'mp3' {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'flac': return 'flac';
      case 'ogg': return 'ogg';
      case 'mp3': return 'mp3';
      case 'webm': return 'ogg'; // Treat WebM audio as OGG
      default: return 'wav';
    }
  }
}

export default UserSampleImporter;
