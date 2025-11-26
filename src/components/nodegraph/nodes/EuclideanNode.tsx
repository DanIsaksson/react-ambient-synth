/**
 * EuclideanNode - Euclidean Rhythm Sequencer with circular visualization.
 * 
 * Features:
 * - Bjorklund's algorithm for rhythm generation
 * - Circular polar coordinate display
 * - Rotating playhead
 * - Rotation control for pattern variations
 * - Per-step probability
 * - Preset patterns (Tresillo, Cinquillo, etc.)
 * 
 * @module components/nodegraph/nodes/EuclideanNode
 */

import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { euclidean, EUCLIDEAN_PRESETS, type EuclideanPresetName } from '../../../audio/rhythm/euclidean';

// ===========================================
// TYPES
// ===========================================

interface EuclideanNodeProps {
  id: string;
  data: {
    steps?: number;
    pulses?: number;
    rotation?: number;
    bpm?: number;
    probability?: number;
    playing?: boolean;
    [key: string]: any;
  };
  selected?: boolean;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Calculate polar coordinates for step visualization.
 */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

/**
 * Create SVG arc path.
 */
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

// ===========================================
// COMPONENT
// ===========================================

export const EuclideanNode = memo(({ id, data, selected }: EuclideanNodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
  const steps = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.steps ?? 8);
  const pulses = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.pulses ?? 3);
  const rotation = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.rotation ?? 0);
  const bpm = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.bpm ?? 120);
  const probability = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.probability ?? 1.0);
  const isPlaying = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.playing ?? false);
  
  // Local visual state
  const [currentStep, setCurrentStep] = useState(0);
  
  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handlers
  const handleStepsChange = useCallback((newSteps: number) => {
    updateNodeData(id, { 
      steps: newSteps, 
      pulses: Math.min(pulses, newSteps),
      rotation: Math.min(rotation, newSteps - 1)
    });
    setCurrentStep(0);
  }, [id, pulses, rotation, updateNodeData]);

  const handlePulsesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { pulses: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleRotationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { rotation: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleBpmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { bpm: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleProbabilityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { probability: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleTogglePlay = useCallback(() => {
    updateNodeData(id, { playing: !isPlaying });
    if (!isPlaying) setCurrentStep(0);
  }, [id, isPlaying, updateNodeData]);
  
  // Generate pattern using Euclidean algorithm
  const pattern = useMemo(() => {
    return euclidean(steps, pulses, rotation);
  }, [steps, pulses, rotation]);
  
  // Animation interval
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = (60 / bpm) * 1000 / (steps / 4); // Scale with steps
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % steps);
      }, intervalMs);
    }
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [isPlaying, bpm, steps]);

  // Apply preset
  const applyPreset = useCallback((presetName: EuclideanPresetName) => {
    const preset = EUCLIDEAN_PRESETS[presetName];
    updateNodeData(id, { 
      steps: preset.steps, 
      pulses: preset.pulses, 
      rotation: 0 
    });
    setCurrentStep(0);
  }, [id, updateNodeData]);

  // Toggle step (for manual override)
  const toggleStep = useCallback((index: number) => {
    // In a real implementation, this would toggle a manual override
    // For now, we just rotate to put this step first
    updateNodeData(id, { rotation: index });
  }, [id, updateNodeData]);

  // Calculate visualization parameters
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 10;
  const innerRadius = outerRadius - 20;
  const stepAngle = 360 / steps;

  // Color theme
  const accentColor = '#f97316'; // Orange
  const dimColor = 'rgba(249, 115, 22, 0.3)';

  return (
    <BaseNode
      title="Euclidean"
      type="control"
      selected={selected}
      nodeId={id}
      nodeType="euclidean"
      handles={HANDLE_PRESETS.sequencer}
      icon="◐"
    >
      <div className="flex flex-col gap-3">
        {/* Circular Visualization */}
        <div className="flex justify-center">
          <svg width={size} height={size} className="drop-shadow-lg">
            <defs>
              {/* Glow filter */}
              <filter id="euclidGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              
              {/* Radial gradient for background */}
              <radialGradient id="ringBg">
                <stop offset="60%" stopColor="transparent" />
                <stop offset="100%" stopColor="rgba(249, 115, 22, 0.05)" />
              </radialGradient>
            </defs>
            
            {/* Background ring */}
            <circle
              cx={cx}
              cy={cy}
              r={outerRadius}
              fill="url(#ringBg)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
            
            {/* Inner circle */}
            <circle
              cx={cx}
              cy={cy}
              r={innerRadius - 10}
              fill="rgba(0,0,0,0.4)"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
            
            {/* Step segments */}
            {pattern.pattern.map((active, i) => {
              const startAngle = i * stepAngle;
              const endAngle = (i + 1) * stepAngle - 2;
              const midAngle = startAngle + stepAngle / 2;
              const dotPos = polarToCartesian(cx, cy, (innerRadius + outerRadius) / 2, midAngle);
              const isCurrentStep = i === currentStep && isPlaying;
              
              return (
                <g key={i} onClick={() => toggleStep(i)} style={{ cursor: 'pointer' }}>
                  {/* Step arc */}
                  <path
                    d={describeArc(cx, cy, (innerRadius + outerRadius) / 2, startAngle, endAngle)}
                    fill="none"
                    stroke={active ? (isCurrentStep ? '#fff' : accentColor) : dimColor}
                    strokeWidth={isCurrentStep ? 10 : 8}
                    strokeLinecap="round"
                    opacity={active ? 1 : 0.3}
                    filter={isCurrentStep && active ? 'url(#euclidGlow)' : undefined}
                    style={{ transition: 'all 75ms ease' }}
                  />
                  
                  {/* Pulse dot */}
                  {active && (
                    <circle
                      cx={dotPos.x}
                      cy={dotPos.y}
                      r={isCurrentStep ? 5 : 3}
                      fill={isCurrentStep ? '#fff' : accentColor}
                      filter={isCurrentStep ? 'url(#euclidGlow)' : undefined}
                      style={{ transition: 'all 75ms ease' }}
                    />
                  )}
                </g>
              );
            })}
            
            {/* Playhead (rotating line) */}
            {isPlaying && (
              <line
                x1={cx}
                y1={cy}
                x2={polarToCartesian(cx, cy, outerRadius + 5, currentStep * stepAngle + stepAngle / 2).x}
                y2={polarToCartesian(cx, cy, outerRadius + 5, currentStep * stepAngle + stepAngle / 2).y}
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
                filter="url(#euclidGlow)"
              />
            )}
            
            {/* Center info */}
            <text
              x={cx}
              y={cy - 5}
              textAnchor="middle"
              fill={accentColor}
              fontSize="16"
              fontWeight="bold"
              fontFamily="Share Tech Mono, monospace"
            >
              {pulses}/{steps}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              fontSize="8"
              fontFamily="Share Tech Mono, monospace"
            >
              R:{rotation}
            </text>
          </svg>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-1 justify-center">
          {(['tresillo', 'cinquillo', 'bossaNova'] as EuclideanPresetName[]).map(preset => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className="px-2 py-0.5 text-[8px] font-mono uppercase rounded
                        border border-orange-500/30 text-orange-400/70
                        hover:bg-orange-500/20 hover:border-orange-500/50 hover:text-orange-300
                        transition-all"
            >
              {EUCLIDEAN_PRESETS[preset].name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Steps / Pulses Controls */}
        <div className="grid grid-cols-2 gap-2">
          {/* Steps */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-gray-400 uppercase">Steps</label>
              <span className="text-[9px] text-orange-400 font-mono">{steps}</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              value={steps}
              onChange={(e) => handleStepsChange(Number(e.target.value))}
              className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.5)]"
            />
          </div>
          
          {/* Pulses */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-gray-400 uppercase">Pulses</label>
              <span className="text-[9px] text-orange-400 font-mono">{pulses}</span>
            </div>
            <input
              type="range"
              min="0"
              max={steps}
              value={pulses}
              onChange={handlePulsesChange}
              className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.5)]"
            />
          </div>
        </div>

        {/* Rotation / Probability Controls */}
        <div className="grid grid-cols-2 gap-2">
          {/* Rotation */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-gray-400 uppercase">Rotate</label>
              <span className="text-[9px] text-orange-400 font-mono">{rotation}</span>
            </div>
            <input
              type="range"
              min="0"
              max={steps - 1}
              value={rotation}
              onChange={handleRotationChange}
              className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.5)]"
            />
          </div>
          
          {/* Probability */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-gray-400 uppercase">Prob</label>
              <span className="text-[9px] text-orange-400 font-mono">{(probability * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={probability}
              onChange={handleProbabilityChange}
              className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.5)]"
            />
          </div>
        </div>

        {/* BPM */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[9px] text-gray-400 uppercase">Tempo</label>
            <span className="text-[9px] text-orange-400 font-mono">{bpm} BPM</span>
          </div>
          <input
            type="range"
            min="40"
            max="200"
            value={bpm}
            onChange={handleBpmChange}
            className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.5)]"
          />
        </div>

        {/* Play/Stop Button */}
        <button
          onClick={handleTogglePlay}
          className={`
            w-full py-2 rounded-lg border font-bold text-xs uppercase tracking-wider
            transition-all duration-150 active:scale-95
            ${isPlaying
              ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)]'
              : 'bg-orange-500/10 border-orange-500/50 text-orange-400 hover:bg-orange-500/20'
            }
          `}
        >
          {isPlaying ? '⏹ Stop' : '▶ Play'}
        </button>
      </div>
    </BaseNode>
  );
});

export default EuclideanNode;
