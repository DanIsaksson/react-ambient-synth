/**
 * SampleNode - Audio sample player node for the graph editor.
 * 
 * Features:
 * - Sample selection from library
 * - Waveform visualization
 * - Pitch control (semitones + fine tune)
 * - Loop mode with start/end points
 * - Attack/release envelope
 * - Play/stop controls
 * 
 * @module components/nodegraph/nodes/SampleNode
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { SAMPLE_CATALOG } from '../../../audio/samples';
import type { SampleCategory } from '../../../audio/samples';
import { audioCore } from '../../../audio/engine/AudioCore';

// ===========================================
// TYPES
// ===========================================

interface SampleNodeProps {
  id: string;
  data: {
    sample?: string;
    pitch?: number;
    fineTune?: number;
    gain?: number;
    loopEnabled?: boolean;
    loopStart?: number;
    loopEnd?: number;
    attack?: number;
    release?: number;
    reverse?: boolean;
    playing?: boolean;
    [key: string]: unknown;
  };
  selected?: boolean;
}

// ===========================================
// CONSTANTS
// ===========================================

const HANDLE_CONFIG = [
  { id: 'trigger', type: 'target' as const, position: 'left' as const, label: 'Trig', color: 'red', offset: 50 },
  { id: 'out', type: 'source' as const, position: 'right' as const, color: 'cyan', offset: 50 },
];

// Default values (outside component to prevent infinite loops)
const DEFAULT_SAMPLE = SAMPLE_CATALOG[0]?.id ?? '';

// Category icons
const CATEGORY_ICONS: Record<SampleCategory, string> = {
  ambient: '🌧️',
  texture: '📻',
  tonal: '🎹',
  percussion: '🥁',
  vocal: '🎤',
  sfx: '✨',
  impulse: '📍',
  user: '📁',
};

// ===========================================
// COMPONENT
// ===========================================

export const SampleNode = memo(({ id, data, selected }: SampleNodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read from Zustand store to avoid stale props
  const sampleFromStore = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.sample);
  const sample = sampleFromStore ?? DEFAULT_SAMPLE;
  
  const pitch = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.pitch ?? 0);
  const fineTune = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.fineTune ?? 0);
  const gain = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.gain ?? 0.8);
  const loopEnabled = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.loopEnabled ?? false);
  const reverse = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.reverse ?? false);
  const isPlaying = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.playing ?? false);
  const isMuted = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.muted ?? false);
  
  // Local state for UI
  const [selectedCategory, setSelectedCategory] = useState<SampleCategory | 'all'>('all');
  const waveformRef = useRef<HTMLCanvasElement>(null);
  
  // Get current sample metadata
  const sampleMeta = SAMPLE_CATALOG.find(s => s.id === sample);
  
  // Filter samples by category
  const filteredSamples = selectedCategory === 'all' 
    ? SAMPLE_CATALOG 
    : SAMPLE_CATALOG.filter(s => s.category === selectedCategory);
  
  // Get unique categories
  const categories = Array.from(new Set(SAMPLE_CATALOG.map(s => s.category)));

  // Draw waveform placeholder
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw center line
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Draw placeholder waveform (sine-like for visual)
    ctx.strokeStyle = isPlaying ? '#06b6d4' : '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const t = x / width;
      // Generate a pseudo-waveform shape
      const y = height / 2 + 
        Math.sin(t * Math.PI * 8) * (height * 0.3) * (1 - Math.abs(t - 0.5) * 1.5) +
        Math.sin(t * Math.PI * 16) * (height * 0.1) * Math.random();
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Playing indicator
    if (isPlaying) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#06b6d4';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [sample, isPlaying]);

  // Handlers
  const handleSampleChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSampleId = e.target.value;
    updateNodeData(id, { sample: newSampleId });
    
    // Auto-switch if currently playing
    const sampleEngine = audioCore.getSamples();
    if (sampleEngine && isPlaying) {
      await sampleEngine.switchSample(id, newSampleId);
    }
  }, [id, isPlaying, updateNodeData]);

  const handlePitchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { pitch: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleFineTuneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { fineTune: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { gain: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleLoopToggle = useCallback(() => {
    updateNodeData(id, { loopEnabled: !loopEnabled });
  }, [id, loopEnabled, updateNodeData]);

  const handleReverseToggle = useCallback(() => {
    updateNodeData(id, { reverse: !reverse });
  }, [id, reverse, updateNodeData]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted;
    updateNodeData(id, { muted: newMuted });
    
    // Update engine gain
    const sampleEngine = audioCore.getSamples();
    if (sampleEngine) {
      sampleEngine.setGain(id, newMuted ? 0 : gain);
    }
  }, [id, isMuted, gain, updateNodeData]);

  const handlePlayToggle = useCallback(async () => {
    const sampleEngine = audioCore.getSamples();
    if (!sampleEngine) {
      console.warn('[SampleNode] SampleEngine not initialized');
      return;
    }

    if (!isPlaying) {
      // Start playback
      try {
        await audioCore.resume(); // Ensure context is running
        await sampleEngine.trigger(id, sample);
        updateNodeData(id, { playing: true });
      } catch (error) {
        console.error('[SampleNode] Playback failed:', error);
      }
    } else {
      // Stop playback
      sampleEngine.stop(id);
      updateNodeData(id, { playing: false });
    }
  }, [id, isPlaying, sample, updateNodeData]);

  // Sync parameters to SampleEngine when they change
  useEffect(() => {
    const sampleEngine = audioCore.getSamples();
    if (!sampleEngine) return;

    sampleEngine.setNodeParams(id, {
      pitch,
      fineTune,
      gain,
      loopEnabled,
      reverse,
    });
  }, [id, pitch, fineTune, gain, loopEnabled, reverse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const sampleEngine = audioCore.getSamples();
      if (sampleEngine) {
        sampleEngine.removeNode(id);
      }
    };
  }, [id]);

  // Slider styling
  const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500
    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.5)]
    [&::-webkit-slider-thumb]:cursor-pointer`;

  return (
    <BaseNode
      title="SAMPLE"
      type="source"
      selected={selected}
      nodeId={id}
      handles={HANDLE_CONFIG}
      icon="🎵"
      isMuted={isMuted}
      onMuteToggle={handleMuteToggle}
    >
      <div className="flex flex-col gap-3 w-56">
        {/* Waveform Display */}
        <div className="relative">
          <canvas
            ref={waveformRef}
            width={224}
            height={48}
            className="w-full rounded-lg border border-white/10"
          />
          {sampleMeta && (
            <div className="absolute bottom-1 left-2 text-[9px] text-white/50 font-mono">
              {sampleMeta.duration?.toFixed(1)}s
            </div>
          )}
          {isPlaying && (
            <div className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2 py-0.5 rounded text-[9px] font-mono transition ${
              selectedCategory === 'all' 
                ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50' 
                : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
            }`}
          >
            ALL
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded text-[9px] transition ${
                selectedCategory === cat 
                  ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50' 
                  : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
              }`}
              title={cat}
            >
              {CATEGORY_ICONS[cat]}
            </button>
          ))}
        </div>

        {/* Sample Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Sample</label>
          <select
            value={sample}
            onChange={handleSampleChange}
            className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5
                       text-xs text-white focus:outline-none focus:border-cyan-500/50
                       cursor-pointer"
          >
            {filteredSamples.map(s => (
              <option key={s.id} value={s.id}>
                {CATEGORY_ICONS[s.category]} {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Pitch Control */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Pitch</label>
              <span className="text-[10px] text-cyan-400 font-mono">
                {pitch > 0 ? '+' : ''}{pitch}st
              </span>
            </div>
            <input
              type="range"
              min="-24"
              max="24"
              step="1"
              value={pitch}
              onChange={handlePitchChange}
              className={sliderClass}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Fine</label>
              <span className="text-[10px] text-cyan-400 font-mono">{fineTune}¢</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={fineTune}
              onChange={handleFineTuneChange}
              className={sliderClass}
            />
          </div>
        </div>

        {/* Gain */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Gain</label>
            <span className="text-[10px] text-cyan-400 font-mono">{(gain * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={gain}
            onChange={handleGainChange}
            className={sliderClass}
          />
        </div>

        {/* Options Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Loop Toggle */}
          <button
            onClick={handleLoopToggle}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              loopEnabled 
                ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50' 
                : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
            }`}
          >
            🔁 Loop
          </button>

          {/* Reverse Toggle */}
          <button
            onClick={handleReverseToggle}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              reverse 
                ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50' 
                : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
            }`}
          >
            ◀ Rev
          </button>

          {/* Play/Stop Button */}
          <button
            onClick={handlePlayToggle}
            className={`flex-1 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
              isPlaying
                ? 'bg-red-500/30 border border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                : 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30'
            }`}
          >
            {isPlaying ? '⏹ Stop' : '▶ Play'}
          </button>
        </div>

        {/* Sample Info */}
        {sampleMeta && (
          <div className="flex items-center gap-2 text-[9px] text-white/30 font-mono">
            <span className="px-1.5 py-0.5 bg-white/5 rounded">{sampleMeta.category}</span>
            {sampleMeta.key && <span>{sampleMeta.key}</span>}
            {sampleMeta.bpm && <span>{sampleMeta.bpm} BPM</span>}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

export default SampleNode;
