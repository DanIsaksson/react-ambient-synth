import React, { useEffect, useCallback, useState } from 'react';
import { 
  Circle, 
  Square, 
  Pause, 
  Play, 
  Download, 
  Trash2, 
  Settings,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { useRecordingStore, RECORDING_QUALITIES } from '../../store/useRecordingStore';
import type { RecordedSession } from '../../store/useRecordingStore';
import { WaveformDisplay } from './WaveformDisplay';
import { audioCore } from '../../audio/engine/AudioCore';

interface RecordingPanelProps {
  /** Whether the panel is expanded */
  isExpanded?: boolean;
  /** Callback when expand state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** CSS class name */
  className?: string;
}

/**
 * Format duration as MM:SS or HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * RecordingPanel - Main UI for recording controls and session management.
 * 
 * Features:
 * - Transport controls (Record, Pause, Stop)
 * - Real-time waveform display
 * - Quality settings
 * - Recordings list with playback and download
 */
export const RecordingPanel: React.FC<RecordingPanelProps> = ({
  isExpanded = true,
  onExpandChange,
  className = '',
}) => {
  const {
    isRecording,
    isPaused,
    duration,
    quality,
    recordings,
    waveformData,
    audioLevel,
    playingRecordingId,
    initialize,
    setQuality,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    deleteRecording,
    renameRecording,
    downloadRecording,
    playRecording,
    stopPlayback,
  } = useRecordingStore();

  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize recording manager when AudioCore is ready
  useEffect(() => {
    const initRecording = async () => {
      const context = audioCore.getContext();
      const masterBus = audioCore.getMasterBus();
      
      if (context && masterBus && !isInitialized) {
        const recordingManager = initialize(context);
        // Connect to master bus
        masterBus.connectRecordingDestination(recordingManager.getInputNode());
        setIsInitialized(true);
        console.log('[RecordingPanel] Recording system connected to master bus');
      }
    };

    // Try to init, retry if audio core not ready
    initRecording();
    const interval = setInterval(() => {
      if (!isInitialized) initRecording();
    }, 500);

    return () => clearInterval(interval);
  }, [initialize, isInitialized]);

  // Handle record button
  const handleRecord = useCallback(() => {
    if (isRecording) {
      if (isPaused) {
        resumeRecording();
      } else {
        pauseRecording();
      }
    } else {
      startRecording();
    }
  }, [isRecording, isPaused, startRecording, pauseRecording, resumeRecording]);

  // Handle stop button
  const handleStop = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }
  }, [isRecording, stopRecording]);

  // Handle quality change
  const handleQualityChange = (key: string) => {
    const newQuality = RECORDING_QUALITIES[key as keyof typeof RECORDING_QUALITIES];
    if (newQuality) {
      setQuality(newQuality);
      setShowSettings(false);
    }
  };

  // Start editing a recording name
  const startEdit = (recording: RecordedSession) => {
    setEditingId(recording.id);
    setEditName(recording.name);
  };

  // Save edited name
  const saveEdit = () => {
    if (editingId && editName.trim()) {
      renameRecording(editingId, editName.trim());
    }
    setEditingId(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  // Toggle expand
  const toggleExpand = () => {
    onExpandChange?.(!isExpanded);
  };

  return (
    <div className={`bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-pointer hover:bg-white/5 transition"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-sm font-medium text-white/90">Recording</span>
          {isRecording && (
            <span className="text-xs text-red-400 font-mono">
              {formatDuration(duration)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {recordings.length > 0 && (
            <span className="text-xs text-white/50 px-2 py-0.5 bg-white/10 rounded">
              {recordings.length}
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Content (collapsible) */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Waveform Display */}
          <WaveformDisplay
            waveformData={waveformData}
            peaks={null}
            isRecording={isRecording}
            audioLevel={audioLevel}
            height={60}
            className="border border-white/10"
          />

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-4">
            {/* Record/Pause Button */}
            <button
              onClick={handleRecord}
              disabled={!isInitialized}
              className={`
                p-3 rounded-full transition-all
                ${isRecording 
                  ? isPaused 
                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={isRecording ? (isPaused ? 'Resume' : 'Pause') : 'Record'}
            >
              {isRecording && !isPaused ? (
                <Pause size={20} />
              ) : (
                <Circle size={20} fill="currentColor" />
              )}
            </button>

            {/* Stop Button */}
            <button
              onClick={handleStop}
              disabled={!isRecording}
              className={`
                p-3 rounded-full transition-all
                ${isRecording 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
                }
              `}
              title="Stop"
            >
              <Square size={20} fill={isRecording ? 'currentColor' : 'none'} />
            </button>

            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-3 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition"
                title="Quality Settings"
              >
                <Settings size={18} />
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-black/95 border border-white/20 rounded-lg shadow-xl z-10">
                  <div className="p-2 text-xs text-white/50 border-b border-white/10">
                    Recording Quality
                  </div>
                  {Object.entries(RECORDING_QUALITIES).map(([key, q]) => (
                    <button
                      key={key}
                      onClick={() => handleQualityChange(key)}
                      className={`
                        w-full px-3 py-2 text-left text-sm transition
                        ${quality.label === q.label 
                          ? 'bg-neon-green/20 text-neon-green' 
                          : 'text-white/70 hover:bg-white/10'
                        }
                      `}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recording Duration & Status */}
          {isRecording && (
            <div className="text-center">
              <span className="text-2xl font-mono text-white/90">
                {formatDuration(duration)}
              </span>
              <p className="text-xs text-white/50 mt-1">
                {quality.label} • {isPaused ? 'Paused' : 'Recording'}
              </p>
            </div>
          )}

          {/* Recordings List */}
          {recordings.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Recordings ({recordings.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {recordings.map((recording) => (
                  <div
                    key={recording.id}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg transition
                      ${playingRecordingId === recording.id 
                        ? 'bg-neon-green/10 border border-neon-green/30' 
                        : 'bg-white/5 hover:bg-white/10'
                      }
                    `}
                  >
                    {/* Play/Stop Button */}
                    <button
                      onClick={() => 
                        playingRecordingId === recording.id 
                          ? stopPlayback() 
                          : playRecording(recording.id)
                      }
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
                    >
                      {playingRecordingId === recording.id ? (
                        <Square size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                    </button>

                    {/* Name (editable) */}
                    <div className="flex-1 min-w-0">
                      {editingId === recording.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-neon-green/50"
                            autoFocus
                          />
                          <button onClick={saveEdit} className="p-1 text-neon-green hover:bg-white/10 rounded">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} className="p-1 text-red-400 hover:bg-white/10 rounded">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="text-sm text-white/80 truncate cursor-pointer hover:text-white"
                          onClick={() => startEdit(recording)}
                          title="Click to rename"
                        >
                          {recording.name}
                        </div>
                      )}
                      <div className="text-xs text-white/40">
                        {formatDuration(recording.duration)} • {formatSize(recording.blob.size)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(recording)}
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition"
                        title="Rename"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => downloadRecording(recording.id)}
                        className="p-1.5 text-white/40 hover:text-neon-green hover:bg-white/10 rounded transition"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/10 rounded transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {recordings.length === 0 && !isRecording && (
            <div className="text-center py-4">
              <p className="text-sm text-white/50">
                Press the record button to capture your soundscape
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
