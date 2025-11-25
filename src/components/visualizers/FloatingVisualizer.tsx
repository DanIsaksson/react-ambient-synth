/**
 * FloatingVisualizer - A floating window that displays the Gravity Phasing visualization.
 * 
 * Features:
 * - Draggable window
 * - Fullscreen toggle
 * - Real-time canvas rendering of physics bodies
 * 
 * @module components/visualizers/FloatingVisualizer
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, X, Move } from 'lucide-react';
import { ParticleSystem } from './ParticleSystem';
import { GravityVisualizer } from './GravityVisualizer';

interface FloatingVisualizerProps {
  isVisible: boolean;
  onClose: () => void;
  getVisualState: () => any;
}

export const FloatingVisualizer: React.FC<FloatingVisualizerProps> = ({
  isVisible,
  onClose,
  getVisualState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const lastImpactTimeRef = useRef<number>(0);
  const animationRef = useRef<number>(0);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize particle system
  useEffect(() => {
    if (!particleSystemRef.current) {
      particleSystemRef.current = new ParticleSystem();
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear with fade effect
      ctx.fillStyle = 'rgba(5, 5, 10, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Get visual state from scene
      const state = getVisualState();
      if (state) {
        GravityVisualizer(ctx, width, height, state, particleSystemRef.current!, lastImpactTimeRef);
      }

      // Update and draw particles
      if (particleSystemRef.current) {
        particleSystemRef.current.update();
        particleSystemRef.current.draw(ctx);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, getVisualState]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isFullscreen]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [isFullscreen, position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`
          fixed z-40
          ${isFullscreen ? 'inset-4' : ''}
        `}
        style={isFullscreen ? {} : {
          left: position.x,
          top: position.y,
          width: 500,
          height: 300,
        }}
      >
        <div
          className="w-full h-full rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(10,10,15,0.95) 0%, rgba(5,5,10,0.98) 100%)',
            border: '1px solid rgba(100,108,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(100,108,255,0.1)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b border-white/10 cursor-move"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <Move size={14} className="text-gray-500" />
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Gravity Phasing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative w-full" style={{ height: 'calc(100% - 40px)' }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ background: '#05050a' }}
            />
            
            {/* Labels */}
            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-gray-500 uppercase">
              Earth (Bass)
            </div>
            <div className="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 uppercase">
              Moon (Ping)
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingVisualizer;
