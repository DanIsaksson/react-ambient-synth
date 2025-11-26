/**
 * TextureNode - UI component for Granular Synthesis in the node graph.
 * 
 * Provides cloud/density controls for lush, evolving textures.
 * Audio processing happens in the AudioWorklet (processTextures).
 * 
 * @module components/nodegraph/nodes/TextureNode
 */

import { memo, useCallback, useEffect, useRef } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { audioCore } from '../../../audio/engine/AudioCore';

// ===========================================
// SAMPLE PRESETS
// ===========================================

const SAMPLE_PRESETS = [
  { id: 'texture-rain-roof', name: 'Rain on Roof', icon: '🌧️' },
  { id: 'texture-forest-wind', name: 'Forest Wind', icon: '🌲' },
  { id: 'texture-ocean-waves', name: 'Ocean Waves', icon: '🌊' },
  { id: 'texture-vinyl-crackle', name: 'Vinyl Crackle', icon: '📀' },
];

// ===========================================
// TYPES
// ===========================================

interface TextureNodeProps {
  id: string;
  data: {
    sample?: string;
    position?: number;
    spray?: number;
    density?: number;
    size?: number;
    pitch?: number;
    playing?: boolean;
    [key: string]: any;
  };
  selected?: boolean;
}

// ===========================================
// TEXTURE NODE COMPONENT
// ===========================================

export const TextureNode = memo(({ id, data, selected }: TextureNodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
  const selectedSample = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.sample ?? SAMPLE_PRESETS[0].id);
  const position = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.position ?? 0.5);
  const spray = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.spray ?? 0.2);
  const density = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.density ?? 30);
  const size = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.size ?? 0.1);
  const pitch = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.pitch ?? 1.0);
  const isPlaying = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.playing ?? false);

  // Handlers
  const handleSampleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { sample: e.target.value });
  }, [id, updateNodeData]);

  const handlePositionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { position: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleSprayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { spray: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleDensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { density: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { size: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handlePitchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { pitch: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleTogglePlay = useCallback(() => {
    updateNodeData(id, { playing: !isPlaying });
  }, [id, isPlaying, updateNodeData]);

  // Track loaded sample to avoid redundant loads
  const loadedSampleRef = useRef<string | null>(null);

  // Load sample buffer and send to worklet when sample changes or playback starts
  useEffect(() => {
    // Only load if we have a sample and either playing or sample changed
    if (!selectedSample) return;
    
    // Skip if already loaded this sample
    if (loadedSampleRef.current === selectedSample) return;

    const loadSampleBuffer = async () => {
      try {
        // Fetch the texture sample file
        const samplePath = `/samples/textures/${selectedSample}.mp3`;
        const response = await fetch(samplePath);
        if (!response.ok) {
          console.warn(`[TextureNode] Sample not found: ${samplePath}`);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const context = audioCore.getContext();
        if (!context) return;

        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0); // Use first channel

        // Send to worklet
        const synth = audioCore.getSynth();
        if (synth) {
          synth.loadSampleBuffer(id, channelData, audioBuffer.sampleRate);
          loadedSampleRef.current = selectedSample;
          console.log(`[TextureNode] Loaded sample: ${selectedSample} for node ${id}`);
        }
      } catch (err) {
        console.error(`[TextureNode] Failed to load sample: ${selectedSample}`, err);
      }
    };

    loadSampleBuffer();
  }, [id, selectedSample]);

  // Slider styling
  const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400
    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.5)]
    [&::-webkit-slider-thumb]:cursor-pointer`;

  // Get current sample info
  const currentSample = SAMPLE_PRESETS.find(s => s.id === selectedSample) || SAMPLE_PRESETS[0];

  return (
    <BaseNode
      title="Texture Cloud"
      type="source"
      selected={selected}
      nodeId={id}
      nodeType="texture"
      handles={HANDLE_PRESETS.sourceOnly}
      icon="☁️"
    >
      <div className="flex flex-col gap-3">
        {/* Cloud Visualization */}
        <div className="bg-black/40 rounded-lg p-3 border border-white/5 relative overflow-hidden h-16">
          {/* Animated grain particles */}
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <radialGradient id="grainGrad">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Position indicator line */}
            <line
              x1={`${position * 100}%`}
              y1="0"
              x2={`${position * 100}%`}
              y2="100%"
              stroke="#22d3ee"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.5"
            />
            {/* Spray region */}
            <rect
              x={`${Math.max(0, (position - spray / 2) * 100)}%`}
              y="20%"
              width={`${spray * 100}%`}
              height="60%"
              fill="#22d3ee"
              opacity="0.1"
              rx="4"
            />
            {/* Grain dots (animated via CSS) */}
            {isPlaying && Array.from({ length: Math.floor(density / 5) }).map((_, i) => (
              <circle
                key={i}
                cx={`${(position + (Math.random() - 0.5) * spray) * 100}%`}
                cy={`${30 + Math.random() * 40}%`}
                r={2 + Math.random() * 2}
                fill="url(#grainGrad)"
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </svg>
          {/* Sample label */}
          <div className="absolute bottom-1 left-2 text-[9px] text-cyan-400/60 font-mono">
            {currentSample.icon} {currentSample.name}
          </div>
        </div>

        {/* Sample Selector */}
        <select
          value={selectedSample}
          onChange={handleSampleChange}
          className="w-full bg-black/40 border border-cyan-500/30 rounded px-2 py-1.5
                     text-[10px] text-cyan-300 font-mono cursor-pointer
                     focus:outline-none focus:border-cyan-400"
        >
          {SAMPLE_PRESETS.map(sample => (
            <option key={sample.id} value={sample.id}>
              {sample.icon} {sample.name}
            </option>
          ))}
        </select>

        {/* Position Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Position</label>
            <span className="text-[10px] text-cyan-400 font-mono">{(position * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={position}
            onChange={handlePositionChange}
            className={sliderClass}
          />
        </div>

        {/* Spray/Jitter Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Spray</label>
            <span className="text-[10px] text-cyan-400 font-mono">{(spray * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={spray}
            onChange={handleSprayChange}
            className={sliderClass}
          />
        </div>

        {/* Density Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Density</label>
            <span className="text-[10px] text-cyan-400 font-mono">{density} Hz</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={density}
            onChange={handleDensityChange}
            className={sliderClass}
          />
        </div>

        {/* Size & Pitch Row */}
        <div className="flex gap-2">
          {/* Size */}
          <div className="flex-1 space-y-1">
            <label className="text-[9px] text-gray-400 uppercase tracking-wider">Size</label>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={size}
              onChange={handleSizeChange}
              className={sliderClass}
            />
            <span className="text-[9px] text-cyan-400/60 font-mono">{(size * 1000).toFixed(0)}ms</span>
          </div>
          {/* Pitch */}
          <div className="flex-1 space-y-1">
            <label className="text-[9px] text-gray-400 uppercase tracking-wider">Pitch</label>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.01"
              value={pitch}
              onChange={handlePitchChange}
              className={sliderClass}
            />
            <span className="text-[9px] text-cyan-400/60 font-mono">{pitch.toFixed(2)}x</span>
          </div>
        </div>

        {/* Play/Stop Button */}
        <button
          onClick={handleTogglePlay}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: isPlaying ? '1px solid #22d3ee' : '1px solid rgba(34,211,238,0.4)',
            background: isPlaying
              ? 'linear-gradient(135deg, rgba(34,211,238,0.4) 0%, rgba(34,211,238,0.2) 100%)'
              : 'linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(34,211,238,0.05) 100%)',
            color: isPlaying ? '#fff' : '#22d3ee',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            boxShadow: isPlaying
              ? '0 0 25px rgba(34,211,238,0.5), inset 0 0 15px rgba(34,211,238,0.2)'
              : '0 0 0 rgba(34,211,238,0)',
            transition: 'all 150ms ease',
            cursor: 'pointer',
          }}
        >
          {isPlaying ? '⏹ Stop' : '▶ Play'}
        </button>
      </div>
    </BaseNode>
  );
});

export default TextureNode;
