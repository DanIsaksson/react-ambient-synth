/**
 * LFONode - UI component for LFO modulation source in the node graph.
 * 
 * Features:
 * - Waveform visualization with real-time animation
 * - Frequency, depth, waveform controls
 * - Multiple waveforms: sine, triangle, square, saw, random
 * 
 * @module components/nodegraph/nodes/LFONode
 */

import { memo, useEffect, useRef, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import type { LFOWaveform } from '../../../audio/modulation/LFONode';

// ===========================================
// WAVEFORM OPTIONS
// ===========================================

const WAVEFORMS: { id: LFOWaveform; label: string; icon: string }[] = [
  { id: 'sine', label: 'Sine', icon: '∿' },
  { id: 'triangle', label: 'Tri', icon: '△' },
  { id: 'square', label: 'Sq', icon: '⊓' },
  { id: 'sawtooth', label: 'Saw', icon: '⩘' },
  { id: 'random', label: 'S&H', icon: '⁂' },
];

// ===========================================
// TYPES
// ===========================================

interface LFONodeProps {
  id: string;
  data: {
    waveform?: LFOWaveform;
    frequency?: number;
    depth?: number;
    [key: string]: any;
  };
  selected?: boolean;
}

// ===========================================
// COMPONENT
// ===========================================

export const LFONodeComponent = memo(({ id, data, selected }: LFONodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
  const waveform = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.waveform ?? 'sine') as LFOWaveform;
  const frequency = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.frequency ?? 1);
  const depth = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.depth ?? 1);

  // Handlers
  const handleWaveformChange = useCallback((wf: LFOWaveform) => {
    updateNodeData(id, { waveform: wf });
  }, [id, updateNodeData]);

  const handleFrequencyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { frequency: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { depth: Number(e.target.value) });
  }, [id, updateNodeData]);
  
  // Animation refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef(0);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const amplitude = (height / 2 - 4) * depth;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw center line
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw waveform
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const t = (x / width) * 2 * Math.PI + phaseRef.current;
      let y: number;

      switch (waveform) {
        case 'sine':
          y = Math.sin(t);
          break;
        case 'triangle':
          y = 2 * Math.abs(2 * ((t / (2 * Math.PI)) % 1) - 1) - 1;
          break;
        case 'square':
          y = Math.sin(t) >= 0 ? 1 : -1;
          break;
        case 'sawtooth':
          y = 2 * ((t / (2 * Math.PI)) % 1) - 1;
          break;
        case 'random':
          // Stepped random visualization
          y = Math.sin(Math.floor(t / 0.5) * 0.5) >= 0 ? 0.7 : -0.7;
          break;
        default:
          y = 0;
      }

      const px = x;
      const py = centerY - y * amplitude;

      if (x === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Glow effect
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw playhead
    const playheadX = ((phaseRef.current / (2 * Math.PI)) % 1) * width;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX, 2);
    ctx.lineTo(playheadX, height - 2);
    ctx.stroke();
  }, [waveform, depth]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      phaseRef.current += frequency * 0.05;
      if (phaseRef.current > 2 * Math.PI) {
        phaseRef.current -= 2 * Math.PI;
      }
      drawWaveform();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [frequency, drawWaveform]);

  // Slider styling
  const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500
    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.5)]
    [&::-webkit-slider-thumb]:cursor-pointer`;

  return (
    <BaseNode
      title="LFO"
      type="control"
      selected={selected}
      nodeId={id}
      handles={[
        { id: 'out', type: 'source' as const, position: 'right' as const, color: 'purple', offset: 50 },
      ]}
      icon="〰️"
    >
      <div className="flex flex-col gap-3">
        {/* Waveform Visualization */}
        <div className="bg-black/40 rounded-lg p-2 border border-white/5">
          <canvas
            ref={canvasRef}
            width={160}
            height={50}
            className="w-full rounded"
          />
        </div>

        {/* Waveform Selector */}
        <div className="flex gap-1">
          {WAVEFORMS.map(wf => (
            <button
              key={wf.id}
              onClick={() => handleWaveformChange(wf.id)}
              className={`flex-1 py-1 rounded text-xs font-mono transition-all ${
                waveform === wf.id
                  ? 'bg-violet-500/30 border border-violet-500 text-white'
                  : 'bg-transparent border border-white/10 text-gray-500 hover:border-violet-500/50'
              }`}
              title={wf.label}
            >
              {wf.icon}
            </button>
          ))}
        </div>

        {/* Frequency Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Rate</label>
            <span className="text-[10px] text-violet-400 font-mono">
              {frequency < 1 ? `${(frequency * 1000).toFixed(0)}ms` : `${frequency.toFixed(2)} Hz`}
            </span>
          </div>
          <input
            type="range"
            min="0.01"
            max="20"
            step="0.01"
            value={frequency}
            onChange={handleFrequencyChange}
            className={sliderClass}
          />
        </div>

        {/* Depth Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Depth</label>
            <span className="text-[10px] text-violet-400 font-mono">{(depth * 100).toFixed(0)}%</span>
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
      </div>
    </BaseNode>
  );
});

// Export with name expected by nodeTypes
export const LFONode = LFONodeComponent;

export default LFONode;
