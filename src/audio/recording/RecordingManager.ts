/**
 * RecordingManager - Captures audio from the master bus using MediaRecorder API.
 * 
 * Architecture:
 * [Audio Graph] → [MediaStreamDestinationNode] → [MediaRecorder] → [Blob] → [Export/Save]
 * 
 * The MediaStreamDestinationNode is connected in parallel to the main output,
 * so recording captures the same audio that goes to speakers.
 */

export type RecordingFormat = 'webm' | 'ogg' | 'wav';

export interface RecordingQuality {
  format: RecordingFormat;
  mimeType: string;
  audioBitsPerSecond: number;
  label: string;
}

export const RECORDING_QUALITIES: Record<string, RecordingQuality> = {
  draft: {
    format: 'webm',
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000,
    label: 'Draft (128kbps WebM)',
  },
  standard: {
    format: 'webm',
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 320000,
    label: 'Standard (320kbps WebM)',
  },
  high: {
    format: 'webm',
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 510000,
    label: 'High Quality (510kbps WebM)',
  },
};

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  startTime: number | null;
}

export interface RecordedSession {
  id: string;
  name: string;
  createdAt: Date;
  duration: number;
  format: RecordingFormat;
  mimeType: string;
  blob: Blob;
  blobUrl: string;
  waveformPeaks: Float32Array | null;
}

/**
 * Detects the best supported MIME type for audio recording.
 * Falls back through formats in order of preference.
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('[RecordingManager] Using MIME type:', type);
      return type;
    }
  }

  console.warn('[RecordingManager] No preferred MIME type supported, using default');
  return '';
}

export class RecordingManager {
  private audioContext: AudioContext;
  private destinationNode: MediaStreamAudioDestinationNode;
  private analyserNode: AnalyserNode;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    startTime: null,
  };
  private durationInterval: number | null = null;
  private onStateChange: ((state: RecordingState) => void) | null = null;
  private onWaveformData: ((data: Float32Array) => void) | null = null;
  private waveformAnimationId: number | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;

    // Create the MediaStream destination for recording
    this.destinationNode = audioContext.createMediaStreamDestination();

    // Create analyser for real-time waveform visualization
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.3;

    console.log('[RecordingManager] Initialized with sample rate:', audioContext.sampleRate);
  }

  /**
   * Get the audio node that should be connected to the master bus output.
   * Connect your master output to this node to enable recording.
   */
  public getInputNode(): AudioNode {
    return this.analyserNode;
  }

  /**
   * Connect internal routing (analyser → destination).
   * Call after connecting input.
   */
  public connect(): void {
    this.analyserNode.connect(this.destinationNode);
    console.log('[RecordingManager] Recording chain connected');
  }

  /**
   * Disconnect the recording chain.
   */
  public disconnect(): void {
    try {
      this.analyserNode.disconnect(this.destinationNode);
    } catch (e) {
      // Already disconnected
    }
  }

  /**
   * Set callback for state changes.
   */
  public setOnStateChange(callback: (state: RecordingState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Set callback for real-time waveform data (for visualization).
   */
  public setOnWaveformData(callback: (data: Float32Array) => void): void {
    this.onWaveformData = callback;
  }

  /**
   * Start recording with specified quality settings.
   */
  public start(quality: RecordingQuality = RECORDING_QUALITIES.standard): void {
    if (this.state.isRecording) {
      console.warn('[RecordingManager] Already recording');
      return;
    }

    // Determine MIME type (use quality setting or fall back to supported)
    let mimeType = quality.mimeType;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn(`[RecordingManager] MIME type ${mimeType} not supported, falling back`);
      mimeType = getSupportedMimeType();
    }

    try {
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: quality.audioBitsPerSecond,
      };

      if (mimeType) {
        options.mimeType = mimeType;
      }

      this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, options);
      this.chunks = [];

      // Collect data chunks as they become available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('[RecordingManager] MediaRecorder stopped, chunks:', this.chunks.length);
      };

      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        console.error('[RecordingManager] MediaRecorder error:', event);
        this.stop();
      };

      // Start recording with timeslice for periodic data availability
      this.mediaRecorder.start(1000); // Get data every second

      // Update state
      this.state = {
        isRecording: true,
        isPaused: false,
        duration: 0,
        startTime: Date.now(),
      };

      // Start duration timer
      this.startDurationTimer();

      // Start waveform updates
      this.startWaveformUpdates();

      this.notifyStateChange();
      console.log('[RecordingManager] Recording started with quality:', quality.label);
    } catch (error) {
      console.error('[RecordingManager] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Pause recording.
   */
  public pause(): void {
    if (!this.state.isRecording || this.state.isPaused) return;

    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      this.state.isPaused = true;
      this.stopDurationTimer();
      this.notifyStateChange();
      console.log('[RecordingManager] Recording paused');
    }
  }

  /**
   * Resume recording after pause.
   */
  public resume(): void {
    if (!this.state.isRecording || !this.state.isPaused) return;

    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
      this.state.isPaused = false;
      this.startDurationTimer();
      this.notifyStateChange();
      console.log('[RecordingManager] Recording resumed');
    }
  }

  /**
   * Stop recording and return the recorded session.
   */
  public async stop(): Promise<RecordedSession | null> {
    if (!this.state.isRecording) {
      console.warn('[RecordingManager] Not recording');
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
      const duration = this.state.duration;

      this.mediaRecorder.onstop = async () => {
        // Create the final blob from all chunks
        const blob = new Blob(this.chunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        // Generate waveform peaks (simplified - just get a preview)
        const waveformPeaks = await this.generateWaveformPeaks(blob);

        // Determine format from MIME type
        let format: RecordingFormat = 'webm';
        if (mimeType.includes('ogg')) format = 'ogg';
        else if (mimeType.includes('wav')) format = 'wav';

        const session: RecordedSession = {
          id: crypto.randomUUID(),
          name: this.generateSessionName(),
          createdAt: new Date(),
          duration,
          format,
          mimeType,
          blob,
          blobUrl,
          waveformPeaks,
        };

        // Reset state
        this.chunks = [];
        this.state = {
          isRecording: false,
          isPaused: false,
          duration: 0,
          startTime: null,
        };
        this.stopDurationTimer();
        this.stopWaveformUpdates();
        this.notifyStateChange();

        console.log('[RecordingManager] Recording stopped. Duration:', duration.toFixed(1), 's');
        resolve(session);
      };

      // Request final data and stop
      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording without saving.
   */
  public cancel(): void {
    if (!this.state.isRecording) return;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.chunks = [];
    this.state = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      startTime: null,
    };
    this.stopDurationTimer();
    this.stopWaveformUpdates();
    this.notifyStateChange();
    console.log('[RecordingManager] Recording cancelled');
  }

  /**
   * Get current recording state.
   */
  public getState(): RecordingState {
    return { ...this.state };
  }

  /**
   * Get real-time audio level (for meters).
   * Returns RMS value 0-1.
   */
  public getLevel(): number {
    const dataArray = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(dataArray);

    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Convert to 0-1 range (with some headroom)
    return Math.min(1, rms * 2);
  }

  /**
   * Get time domain data for waveform visualization.
   */
  public getTimeDomainData(): Float32Array {
    const dataArray = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  // --- Private Methods ---

  private startDurationTimer(): void {
    this.stopDurationTimer();
    const startTime = Date.now() - this.state.duration * 1000;

    this.durationInterval = window.setInterval(() => {
      this.state.duration = (Date.now() - startTime) / 1000;
      this.notifyStateChange();
    }, 100);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval !== null) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private startWaveformUpdates(): void {
    this.stopWaveformUpdates();

    const update = () => {
      if (this.onWaveformData && this.state.isRecording && !this.state.isPaused) {
        this.onWaveformData(this.getTimeDomainData());
      }
      this.waveformAnimationId = requestAnimationFrame(update);
    };

    this.waveformAnimationId = requestAnimationFrame(update);
  }

  private stopWaveformUpdates(): void {
    if (this.waveformAnimationId !== null) {
      cancelAnimationFrame(this.waveformAnimationId);
      this.waveformAnimationId = null;
    }
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  private generateSessionName(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-').slice(0, 5);
    return `ambientflow_${date}_${time}`;
  }

  /**
   * Generate waveform peaks for visualization.
   * This is a simplified version - full implementation would use OfflineAudioContext.
   */
  private async generateWaveformPeaks(blob: Blob): Promise<Float32Array | null> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Downsample to ~1000 points for visualization
      const channelData = audioBuffer.getChannelData(0);
      const targetPoints = 1000;
      const blockSize = Math.floor(channelData.length / targetPoints);
      const peaks = new Float32Array(targetPoints);

      for (let i = 0; i < targetPoints; i++) {
        const start = i * blockSize;
        const end = Math.min(start + blockSize, channelData.length);
        
        let max = 0;
        for (let j = start; j < end; j++) {
          const abs = Math.abs(channelData[j]);
          if (abs > max) max = abs;
        }
        peaks[i] = max;
      }

      return peaks;
    } catch (error) {
      console.warn('[RecordingManager] Failed to generate waveform peaks:', error);
      return null;
    }
  }

  /**
   * Cleanup resources.
   */
  public dispose(): void {
    this.cancel();
    this.disconnect();
    this.onStateChange = null;
    this.onWaveformData = null;
  }
}
