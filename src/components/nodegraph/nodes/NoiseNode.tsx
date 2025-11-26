/**
 * NoiseNode - UI component for Perlin/Simplex noise modulation source.
 * 
 * Provides smooth, organic modulation signals that drift
 * naturally like wind or ocean currents.
 * 
 * @module components/nodegraph/nodes/NoiseNode
 */

import { memo, useRef, useEffect, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

// ===========================================
// TYPES
// ===========================================

interface NoiseNodeProps {
  id: string;
  data: {
    speed?: number;
    depth?: number;
    smoothness?: number;
    bipolar?: boolean;
    [key: string]: any;
  };
  selected?: boolean;
}

// ===========================================
// COMPONENT
// ===========================================

export const NoiseNodeComponent = memo(({ id, data, selected }: NoiseNodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
  const speed = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.speed ?? 0.5);
  const depth = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.depth ?? 1);
  const smoothness = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.smoothness ?? 0.5);
  const bipolar = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.bipolar ?? true);

  // Handlers
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { speed: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { depth: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleSmoothnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { smoothness: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleBipolarToggle = useCallback(() => {
    updateNodeData(id, { bipolar: !bipolar });
  }, [id, bipolar, updateNodeData]);

  // Canvas ref for visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  // Simple noise function for visualization
  const noise = useCallback((x: number, octaves: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      // Simplified noise using sine combination
      value += amplitude * Math.sin(x * frequency + i * 1.618);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }, []);

  // Draw noise visualization
  const drawNoise = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // Draw noise waveform
    ctx.beginPath();
    ctx.strokeStyle = '#10b981'; // Emerald green
    ctx.lineWidth = 2;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;

    const octaves = Math.round(1 + smoothness * 4); // 1-5 octaves

    for (let x = 0; x < width; x++) {
      const t = timeRef.current + (x / width) * 4;
      let y = noise(t * (0.5 + speed * 2), octaves);

      // Apply depth
      y *= depth;

      // Convert to canvas coordinates
      if (bipolar) {
        y = height / 2 + y * (height / 2 - 4);
      } else {
        y = height - 4 - ((y + 1) / 2) * (height - 8);
      }

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw center line
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [speed, depth, smoothness, bipolar, noise]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      timeRef.current += 0.02 * speed;
      drawNoise();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [speed, drawNoise]);

  // Slider style
  const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)]
    [&::-webkit-slider-thumb]:cursor-pointer`;

  return (
    <BaseNode
      title="Noise"
      type="control"
      selected={selected}
      nodeId={id}
      nodeType="noise"
      handles={[
        { id: 'out', type: 'source' as const, position: 'right' as const, color: 'emerald', offset: 50 },
      ]}
      icon="🌊"
    >
      <div className="flex flex-col gap-3">
        {/* Noise Visualization */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={160}
            height={60}
            className="w-full rounded-lg bg-black/60 border border-emerald-500/30"
          />
          {/* Bipolar indicator */}
          <div className="absolute top-1 right-1 text-[8px] text-emerald-400/50 font-mono">
            {bipolar ? '±' : '+'}
          </div>
        </div>

        {/* Speed Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Speed</label>
            <span className="text-[10px] text-emerald-400 font-mono">{speed.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.01"
            max="2"
            step="0.01"
            value={speed}
            onChange={handleSpeedChange}
            className={sliderClass}
          />
        </div>

        {/* Depth Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Depth</label>
            <span className="text-[10px] text-emerald-400 font-mono">{(depth * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={depth}
            onChange={handleDepthChange}
            className={sliderClass}
          />
        </div>

        {/* Smoothness Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Smooth</label>
            <span className="text-[10px] text-emerald-400 font-mono">{(smoothness * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={smoothness}
            onChange={handleSmoothnessChange}
            className={sliderClass}
          />
        </div>

        {/* Bipolar Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Bipolar</label>
          <button
            onClick={handleBipolarToggle}
            className={`w-10 h-5 rounded-full transition-all ${
              bipolar
                ? 'bg-emerald-500/50 border border-emerald-500'
                : 'bg-gray-700 border border-gray-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                bipolar ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </BaseNode>
  );
});

// Export with expected name
export const NoiseNode = NoiseNodeComponent;

export default NoiseNode;
