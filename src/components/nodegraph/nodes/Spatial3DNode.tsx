/**
 * Spatial3DNode - UI component for 3D audio positioning in the node graph.
 * 
 * Features:
 * - XY pad for horizontal positioning (top-down view)
 * - Z slider for height/depth
 * - Distance model selection
 * - Rolloff and air absorption controls
 * - Visual indicator showing position relative to listener
 * 
 * @module components/nodegraph/nodes/Spatial3DNode
 */

import { memo, useRef, useCallback, useEffect, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';
import { audioCore } from '../../../audio/engine/AudioCore';
import { ModulatableSlider } from '../shared/ModulatableSlider';

// ===========================================
// TYPES
// ===========================================

type DistanceModel = 'linear' | 'inverse' | 'exponential';

interface Position3D {
  x: number;
  y: number;
  z: number;
}

interface Spatial3DNodeProps {
  id: string;
  data: {
    position?: Position3D;
    distanceModel?: DistanceModel;
    rolloff?: number;
    airAbsorption?: boolean;
    [key: string]: any;
  };
  selected?: boolean;
}

// ===========================================
// DEFAULTS (defined outside component to prevent infinite loop)
// Zustand compares by reference - new object = re-render = infinite loop
// ===========================================

const DEFAULT_POSITION: Position3D = { x: 0, y: 0, z: 0 };

// ===========================================
// COMPONENT
// ===========================================

export const Spatial3DNodeComponent = memo(({ id, data, selected }: Spatial3DNodeProps) => {
  const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
  
  // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
  // Use separate selector + fallback to avoid new object creation in selector
  const positionFromStore = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.position);
  const position: Position3D = positionFromStore ?? DEFAULT_POSITION;
  const distanceModel: DistanceModel = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.distanceModel ?? 'inverse');
  const rolloff = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.rolloff ?? 1);
  const airAbsorption = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.airAbsorption ?? true);

  // Handlers - update both nested position AND flat x/y/z for modulation support
  const handlePositionChange = useCallback((newPos: Partial<Position3D>) => {
    const updatedPos = { ...position, ...newPos };
    updateNodeData(id, { 
      position: updatedPos,
      // Also store flat x, y, z for modulation routing
      x: updatedPos.x,
      y: updatedPos.y,
      z: updatedPos.z,
    });
  }, [id, position, updateNodeData]);

  // Individual axis handlers for ModulatableSlider
  const handleYChange = useCallback((value: number) => {
    handlePositionChange({ y: value });
  }, [handlePositionChange]);

  const handleDistanceModelChange = useCallback((model: DistanceModel) => {
    updateNodeData(id, { distanceModel: model });
  }, [id, updateNodeData]);

  const handleRolloffChange = useCallback((value: number) => {
    updateNodeData(id, { rolloff: value });
  }, [id, updateNodeData]);

  const handleAirAbsorptionToggle = useCallback(() => {
    updateNodeData(id, { airAbsorption: !airAbsorption });
  }, [id, airAbsorption, updateNodeData]);

  // Refs and state
  const padRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate distance for display
  const distance = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);

  // Handle XY pad interaction
  const handlePadInteraction = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!padRef.current) return;

    const rect = padRef.current.getBoundingClientRect();
    const padSize = rect.width;
    const range = 10; // -10 to +10 units

    // Normalize to -1 to 1
    const normalizedX = ((e.clientX - rect.left) / padSize) * 2 - 1;
    const normalizedZ = ((e.clientY - rect.top) / padSize) * 2 - 1;

    // Scale to range
    const x = normalizedX * range;
    const z = -normalizedZ * range; // Invert Z so up is forward

    handlePositionChange({ x, z });
  }, [handlePositionChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    handlePadInteraction(e);
  }, [handlePadInteraction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handlePadInteraction(e);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handlePadInteraction]);

  // Sync position to SpatialEngine
  useEffect(() => {
    const spatialEngine = audioCore.getSpatial();
    if (spatialEngine) {
      // Ensure node exists
      spatialEngine.getOrCreateNode(id);
      // Update position
      spatialEngine.setPosition(id, position.x, position.y, position.z);
      // Update distance model params
      spatialEngine.setParams(id, {
        distanceModel,
        rolloffFactor: rolloff,
      });
    }
  }, [id, position, distanceModel, rolloff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const spatialEngine = audioCore.getSpatial();
      if (spatialEngine) {
        spatialEngine.removeNode(id);
      }
    };
  }, [id]);

  // Convert position to pad coordinates
  const padX = ((position.x / 10) + 1) * 50; // 0-100%
  const padZ = ((-position.z / 10) + 1) * 50; // 0-100% (inverted)

  return (
    <BaseNode
      title="SPATIAL"
      type="effect"
      selected={selected}
      nodeId={id}
      nodeType="spatial"
      handles={[
        { id: 'in', type: 'target' as const, position: 'left' as const, color: 'cyan', offset: 50 },
        { id: 'out', type: 'source' as const, position: 'right' as const, color: 'cyan', offset: 50 },
      ]}
      icon="🌐"
    >
      <div className="flex flex-col gap-3">
        {/* XY Position Pad (Top-Down View) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Position XZ</label>
            <span className="text-[10px] text-cyan-400 font-mono">
              {position.x.toFixed(1)}, {position.z.toFixed(1)}
            </span>
          </div>
          <div
            ref={padRef}
            onMouseDown={handleMouseDown}
            className="relative w-full aspect-square bg-black/60 rounded-lg border border-cyan-500/30 cursor-crosshair overflow-hidden"
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-500/20" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-500/20" />
              {/* Diagonal lines for depth perception */}
              <div className="absolute inset-0 border border-cyan-500/10" style={{ borderRadius: '50%', margin: '25%' }} />
              <div className="absolute inset-0 border border-cyan-500/10" style={{ borderRadius: '50%', margin: '10%' }} />
            </div>

            {/* Listener indicator (center) */}
            <div 
              className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            />

            {/* Source indicator - disable transition during drag to prevent GPU thrashing */}
            <div
              className={`absolute w-4 h-4 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)]
                ${isDragging ? '' : 'transition-all duration-75'}`}
              style={{ 
                left: `${padX}%`, 
                top: `${padZ}%`, 
                transform: 'translate(-50%, -50%)',
                willChange: isDragging ? 'left, top' : 'auto',
              }}
            >
              {/* Direction indicator */}
              <div className="absolute w-1 h-3 bg-cyan-300 rounded-full left-1/2 -translate-x-1/2 -top-3" />
            </div>

            {/* Distance arc */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line
                x1="50%"
                y1="50%"
                x2={`${padX}%`}
                y2={`${padZ}%`}
                stroke="rgba(6,182,212,0.4)"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
            </svg>

            {/* Labels */}
            <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-cyan-500/50">+Z</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-cyan-500/50">-Z</span>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-cyan-500/50">-X</span>
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-cyan-500/50">+X</span>
          </div>
        </div>

        {/* Y (Height) Slider with Modulation Target */}
        <ModulatableSlider
          nodeId={id}
          paramName="y"
          label="Height"
          value={position.y}
          min={-10}
          max={10}
          step={0.1}
          onChange={handleYChange}
          accentColor="cyan"
          formatValue={(v) => v.toFixed(1)}
        />

        {/* Distance Display */}
        <div className="flex items-center justify-between px-2 py-1 bg-black/40 rounded border border-white/5">
          <span className="text-[10px] text-gray-400">Distance</span>
          <span className="text-xs text-cyan-400 font-mono">{distance.toFixed(2)} units</span>
        </div>

        {/* Distance Model */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Distance Model</label>
          <div className="flex gap-1">
            {(['linear', 'inverse', 'exponential'] as DistanceModel[]).map(model => (
              <button
                key={model}
                onClick={() => handleDistanceModelChange(model)}
                className={`flex-1 py-1 rounded text-[10px] font-mono transition-all ${
                  distanceModel === model
                    ? 'bg-cyan-500/30 border border-cyan-500 text-white'
                    : 'bg-transparent border border-white/10 text-gray-500 hover:border-cyan-500/50'
                }`}
              >
                {model.slice(0, 3).toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Rolloff with Modulation Target */}
        <ModulatableSlider
          nodeId={id}
          paramName="rolloff"
          label="Roll"
          value={rolloff}
          min={0}
          max={5}
          step={0.1}
          onChange={handleRolloffChange}
          accentColor="cyan"
          formatValue={(v) => v.toFixed(2)}
        />

        {/* Air Absorption Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Air Absorption</label>
          <button
            onClick={handleAirAbsorptionToggle}
            className={`w-10 h-5 rounded-full transition-all ${
              airAbsorption 
                ? 'bg-cyan-500/50 border border-cyan-500' 
                : 'bg-gray-700 border border-gray-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                airAbsorption ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </BaseNode>
  );
});

// Export with expected name
export const Spatial3DNode = Spatial3DNodeComponent;

export default Spatial3DNode;
