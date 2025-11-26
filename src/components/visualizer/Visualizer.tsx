/**
 * Visualizer - Main container for audio visualizers with fullscreen support.
 * 
 * Features:
 * - Modal overlay with glassmorphism
 * - Fullscreen toggle
 * - Visualizer type selector (extensible)
 * - Smooth open/close animations
 * 
 * @module components/visualizer/Visualizer
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { FlowFieldVisualizer } from './FlowFieldVisualizer';

// ===========================================
// TYPES
// ===========================================

interface VisualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

type VisualizerType = 'flow-field' | 'aurora' | 'nebula';

interface VisualizerOption {
  id: VisualizerType;
  name: string;
  icon: string;
  colorScheme: 'ethereal' | 'aurora' | 'nebula';
}

// ===========================================
// CONSTANTS
// ===========================================

const VISUALIZERS: VisualizerOption[] = [
  { id: 'flow-field', name: 'Flow Field', icon: '🌊', colorScheme: 'ethereal' },
  { id: 'aurora', name: 'Aurora', icon: '🌌', colorScheme: 'aurora' },
  { id: 'nebula', name: 'Nebula', icon: '✨', colorScheme: 'nebula' },
];

// ===========================================
// COMPONENT
// ===========================================

export const Visualizer: React.FC<VisualizerProps> = ({ isOpen, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedVisualizer, setSelectedVisualizer] = useState<VisualizerType>('flow-field');
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get current visualizer config
  const currentVisualizer = VISUALIZERS.find(v => v.id === selectedVisualizer) || VISUALIZERS[0];

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!contentRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await contentRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('[Visualizer] Fullscreen error:', error);
    }
  }, []);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update dimensions based on container size
  useEffect(() => {
    if (!isOpen) return;

    const updateDimensions = () => {
      if (isFullscreen) {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      } else {
        setDimensions({
          width: Math.min(900, window.innerWidth - 80),
          height: Math.min(560, window.innerHeight - 200),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isOpen, isFullscreen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isFullscreen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
    >
      {/* Visualizer Window */}
      <div
        ref={contentRef}
        className={`
          relative flex flex-col
          ${isFullscreen ? '' : 'rounded-2xl overflow-hidden'}
        `}
        style={{
          width: isFullscreen ? '100vw' : dimensions.width + 40,
          height: isFullscreen ? '100vh' : dimensions.height + 100,
          background: isFullscreen 
            ? 'rgb(5, 5, 10)' 
            : 'linear-gradient(135deg, rgba(15, 15, 25, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%)',
          border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isFullscreen ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div 
          className={`
            flex items-center justify-between px-4 py-3
            ${isFullscreen ? 'absolute top-0 left-0 right-0 z-10 bg-black/50' : 'border-b border-white/10'}
          `}
        >
          {/* Visualizer Selector */}
          <div className="flex items-center gap-2">
            {VISUALIZERS.map((viz) => (
              <button
                key={viz.id}
                onClick={() => setSelectedVisualizer(viz.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider
                  transition-all duration-200
                  ${selectedVisualizer === viz.id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70'
                  }
                `}
              >
                <span className="mr-1.5">{viz.icon}</span>
                {viz.name}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                         bg-white/5 text-white/50 hover:bg-white/10 hover:text-white
                         transition-all duration-200 border border-white/10"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close Button */}
            {!isFullscreen && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                           bg-white/5 text-white/50 hover:bg-red-500/20 hover:text-red-400
                           transition-all duration-200 border border-white/10"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Visualizer Content */}
        <div 
          className={`flex-1 flex items-center justify-center ${isFullscreen ? '' : 'p-4'}`}
          style={{ background: 'rgb(5, 5, 10)' }}
        >
          <FlowFieldVisualizer
            width={dimensions.width}
            height={dimensions.height}
            particleCount={isFullscreen ? 1200 : 800}
            colorScheme={currentVisualizer.colorScheme}
          />
        </div>

        {/* Footer (non-fullscreen only) */}
        {!isFullscreen && (
          <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
              Simplex Noise Flow Field
            </span>
            <span className="text-[10px] text-white/30 font-mono">
              {dimensions.width} × {dimensions.height}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Visualizer;
