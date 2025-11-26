import { create } from 'zustand';
import { RecordingManager, RECORDING_QUALITIES } from '../audio/recording/RecordingManager';
import type { RecordingState, RecordedSession, RecordingQuality } from '../audio/recording/RecordingManager';

interface RecordingStoreState {
  // Recording Manager instance
  manager: RecordingManager | null;
  
  // Current recording state
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  
  // Recording settings
  quality: RecordingQuality;
  
  // Saved recordings (in memory - IndexedDB integration later)
  recordings: RecordedSession[];
  
  // Currently playing recording
  playingRecordingId: string | null;
  playbackPosition: number;
  
  // Real-time waveform data for visualization
  waveformData: Float32Array | null;
  audioLevel: number;
  
  // Actions
  initialize: (audioContext: AudioContext) => RecordingManager;
  setQuality: (quality: RecordingQuality) => void;
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<RecordedSession | null>;
  cancelRecording: () => void;
  deleteRecording: (id: string) => void;
  renameRecording: (id: string, name: string) => void;
  downloadRecording: (id: string) => void;
  playRecording: (id: string) => void;
  stopPlayback: () => void;
  
  // Internal state updates
  _updateState: (state: RecordingState) => void;
  _updateWaveform: (data: Float32Array) => void;
}

export const useRecordingStore = create<RecordingStoreState>((set, get) => ({
  // Initial state
  manager: null,
  isRecording: false,
  isPaused: false,
  duration: 0,
  quality: RECORDING_QUALITIES.standard,
  recordings: [],
  playingRecordingId: null,
  playbackPosition: 0,
  waveformData: null,
  audioLevel: 0,

  /**
   * Initialize the recording manager with an AudioContext.
   * Returns the manager's input node for connection to the master bus.
   */
  initialize: (audioContext: AudioContext) => {
    const existing = get().manager;
    if (existing) {
      console.log('[RecordingStore] Already initialized');
      return existing;
    }

    const manager = new RecordingManager(audioContext);
    
    // Set up callbacks
    manager.setOnStateChange((state) => {
      get()._updateState(state);
    });
    
    manager.setOnWaveformData((data) => {
      get()._updateWaveform(data);
    });

    // Connect internal routing
    manager.connect();

    set({ manager });
    console.log('[RecordingStore] Initialized');
    
    return manager;
  },

  setQuality: (quality: RecordingQuality) => {
    set({ quality });
  },

  startRecording: () => {
    const { manager, quality } = get();
    if (!manager) {
      console.error('[RecordingStore] Not initialized');
      return;
    }
    manager.start(quality);
  },

  pauseRecording: () => {
    const { manager } = get();
    manager?.pause();
  },

  resumeRecording: () => {
    const { manager } = get();
    manager?.resume();
  },

  stopRecording: async () => {
    const { manager } = get();
    if (!manager) return null;

    const session = await manager.stop();
    if (session) {
      set((state) => ({
        recordings: [session, ...state.recordings],
      }));
      console.log('[RecordingStore] Recording saved:', session.name);
    }
    return session;
  },

  cancelRecording: () => {
    const { manager } = get();
    manager?.cancel();
  },

  deleteRecording: (id: string) => {
    set((state) => {
      const recording = state.recordings.find((r) => r.id === id);
      if (recording) {
        // Revoke blob URL to free memory
        URL.revokeObjectURL(recording.blobUrl);
      }
      return {
        recordings: state.recordings.filter((r) => r.id !== id),
        // Stop playback if deleting the currently playing recording
        playingRecordingId: state.playingRecordingId === id ? null : state.playingRecordingId,
      };
    });
  },

  renameRecording: (id: string, name: string) => {
    set((state) => ({
      recordings: state.recordings.map((r) =>
        r.id === id ? { ...r, name } : r
      ),
    }));
  },

  downloadRecording: (id: string) => {
    const recording = get().recordings.find((r) => r.id === id);
    if (!recording) return;

    // Determine file extension
    const ext = recording.format === 'webm' ? 'webm' : 
                recording.format === 'ogg' ? 'ogg' : 'wav';

    // Create download link
    const a = document.createElement('a');
    a.href = recording.blobUrl;
    a.download = `${recording.name}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log('[RecordingStore] Downloaded:', recording.name);
  },

  playRecording: (id: string) => {
    // Implementation would use an audio element or AudioBufferSourceNode
    // For now, just track state
    set({ playingRecordingId: id, playbackPosition: 0 });
    console.log('[RecordingStore] Playing recording:', id);
  },

  stopPlayback: () => {
    set({ playingRecordingId: null, playbackPosition: 0 });
  },

  // Internal state update from RecordingManager callback
  _updateState: (state: RecordingState) => {
    set({
      isRecording: state.isRecording,
      isPaused: state.isPaused,
      duration: state.duration,
    });
  },

  // Internal waveform update from RecordingManager callback
  _updateWaveform: (data: Float32Array) => {
    // Calculate audio level from waveform
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    const level = Math.min(1, rms * 2);

    set({
      waveformData: data,
      audioLevel: level,
    });
  },
}));

// Export quality presets for UI
export { RECORDING_QUALITIES };
export type { RecordingQuality, RecordedSession };
