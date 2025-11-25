/**
 * ResonatorNode - UI component for Modal Synthesis in the node graph.
 * 
 * Provides material-based physical modeling (Glass, Wood, Metal).
 * 
 * @module components/nodegraph/nodes/ResonatorNode
 */

import { memo, useState, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

// ===========================================
// MATERIAL PRESETS
// ===========================================

const MATERIALS = [
  { id: 'glass', name: 'Glass', icon: '🔮', color: '#a78bfa', description: 'Long ring, inharmonic' },
  { id: 'wood', name: 'Wood', icon: '🪵', color: '#f59e0b', description: 'Short decay, harmonic' },
  { id: 'metal', name: 'Metal', icon: '⚙️', color: '#6b7280', description: 'Clustered partials' },
];

// ===========================================
// TYPES
// ===========================================

interface ResonatorNodeProps {
  id: string;
  data: {
    material?: string;
    frequency?: number;
    decay?: number;
    brightness?: number;
    trigger?: boolean;
    [key: string]: any;
  };
  selected?: boolean;
}

// ===========================================
// RESONATOR NODE COMPONENT
// ===========================================

export const ResonatorNode = memo(({ id, data, selected }: ResonatorNodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
  const material = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.material ?? 'wood');
  const frequency = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.frequency ?? 440);
  const decay = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.decay ?? 0.5);
  const brightness = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.brightness ?? 0.5);
  
  // Local visual state
  const [isRinging, setIsRinging] = useState(false);

  // Get current material info
  const currentMaterial = MATERIALS.find(m => m.id === material) || MATERIALS[1];

  // Handlers
  const handleMaterialChange = useCallback((mat: string) => {
    updateNodeData(id, { material: mat });
  }, [id, updateNodeData]);

  const handleFrequencyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { frequency: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleDecayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { decay: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleBrightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { brightness: Number(e.target.value) });
  }, [id, updateNodeData]);

  const handleStrike = useCallback(() => {
    setIsRinging(true);
    // Visual feedback - decay based on material
    const decayTime = material === 'glass' ? 2000 : material === 'metal' ? 1500 : 500;
    setTimeout(() => setIsRinging(false), decayTime * (0.3 + decay * 0.7));
    // Send trigger to worklet
    updateNodeData(id, { trigger: true });
    setTimeout(() => updateNodeData(id, { trigger: false }), 50);
  }, [id, material, decay, updateNodeData]);

  // Slider styling with dynamic color
  const getSliderClass = (_color: string) => `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer`;

  return (
    <BaseNode
      title="Resonator"
      type="source"
      selected={selected}
      nodeId={id}
      handles={HANDLE_PRESETS.stringSynth}
      icon="🔔"
    >
      <div className="flex flex-col gap-3">
        {/* Resonator Visualization */}
        <div 
          className="bg-black/40 rounded-lg p-3 border border-white/5 relative overflow-hidden h-16"
          style={{
            boxShadow: isRinging ? `inset 0 0 30px ${currentMaterial.color}40` : 'none',
            transition: 'box-shadow 0.3s ease-out',
          }}
        >
          <svg width="100%" height="100%" className="absolute inset-0">
            {/* Resonant modes visualization */}
            {[1, 2, 3, 4, 5].map((mode, i) => {
              const ratio = material === 'glass' 
                ? [1, 2.32, 3.85, 5.17, 6.71][i]
                : material === 'metal'
                  ? [1, 1.58, 2.0, 2.51, 2.92][i]
                  : [1, 2, 3, 4, 5][i];
              
              const amplitude = isRinging ? Math.pow(0.7, i) : 0;
              
              return (
                <g key={mode}>
                  {/* Mode line */}
                  <line
                    x1={`${15 + i * 18}%`}
                    y1="85%"
                    x2={`${15 + i * 18}%`}
                    y2={`${85 - amplitude * 60}%`}
                    stroke={currentMaterial.color}
                    strokeWidth={3}
                    opacity={0.3 + amplitude * 0.7}
                    style={{
                      transition: `y2 ${0.5 + i * 0.2}s ease-out, opacity ${0.3 + i * 0.1}s ease-out`,
                    }}
                  />
                  {/* Ratio label */}
                  <text
                    x={`${15 + i * 18}%`}
                    y="95%"
                    fill={currentMaterial.color}
                    fontSize="7"
                    textAnchor="middle"
                    opacity="0.5"
                  >
                    {ratio.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </svg>
          {/* Material label */}
          <div 
            className="absolute top-1 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ 
              backgroundColor: `${currentMaterial.color}20`,
              color: currentMaterial.color,
            }}
          >
            {currentMaterial.icon} {currentMaterial.name}
          </div>
        </div>

        {/* Material Selector */}
        <div className="flex gap-1">
          {MATERIALS.map(mat => (
            <button
              key={mat.id}
              onClick={() => handleMaterialChange(mat.id)}
              className="flex-1 py-1.5 rounded text-[10px] font-mono transition-all"
              style={{
                backgroundColor: material === mat.id ? `${mat.color}30` : 'transparent',
                border: `1px solid ${material === mat.id ? mat.color : 'rgba(255,255,255,0.1)'}`,
                color: material === mat.id ? mat.color : 'rgba(255,255,255,0.5)',
              }}
            >
              {mat.icon}
            </button>
          ))}
        </div>

        {/* Frequency Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Pitch</label>
            <span className="text-[10px] font-mono" style={{ color: currentMaterial.color }}>
              {frequency} Hz
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="2000"
            value={frequency}
            onChange={handleFrequencyChange}
            className={getSliderClass(currentMaterial.color)}
            style={{
              // @ts-ignore - webkit vendor prefix
              '--thumb-color': currentMaterial.color,
            }}
          />
        </div>

        {/* Decay Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Decay</label>
            <span className="text-[10px] font-mono" style={{ color: currentMaterial.color }}>
              {(decay * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={decay}
            onChange={handleDecayChange}
            className={getSliderClass(currentMaterial.color)}
          />
        </div>

        {/* Brightness Control */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Brightness</label>
            <span className="text-[10px] font-mono" style={{ color: currentMaterial.color }}>
              {(brightness * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={brightness}
            onChange={handleBrightnessChange}
            className={getSliderClass(currentMaterial.color)}
          />
        </div>

        {/* Strike Button */}
        <button
          onClick={handleStrike}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: isRinging ? `1px solid ${currentMaterial.color}` : `1px solid ${currentMaterial.color}60`,
            background: isRinging
              ? `linear-gradient(135deg, ${currentMaterial.color}40 0%, ${currentMaterial.color}20 100%)`
              : `linear-gradient(135deg, ${currentMaterial.color}15 0%, ${currentMaterial.color}08 100%)`,
            color: isRinging ? '#fff' : currentMaterial.color,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            boxShadow: isRinging
              ? `0 0 25px ${currentMaterial.color}50, inset 0 0 15px ${currentMaterial.color}20`
              : `0 0 0 ${currentMaterial.color}00`,
            transition: 'all 150ms ease',
            cursor: 'pointer',
            transform: isRinging ? 'scale(0.97)' : 'scale(1)',
          }}
        >
          🔨 Strike
        </button>
      </div>
    </BaseNode>
  );
});

export default ResonatorNode;
