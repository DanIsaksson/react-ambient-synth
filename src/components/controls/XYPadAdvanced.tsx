import React, { useRef, useEffect, useState, useCallback } from 'react';
import { triggerHaptic } from '../../hooks/usePlatform';

export type PhysicsMode = 'spring' | 'friction' | 'sticky';

interface XYPadAdvancedProps {
  /** X position (-1 to 1) */
  x: number;
  /** Y position (0 to 1) */
  y: number;
  /** Callback when position changes */
  onChange: (x: number, y: number) => void;
  /** Physics mode for puck behavior on release */
  physicsMode?: PhysicsMode;
  /** Spring tension (0-1) - how fast it snaps back */
  springTension?: number;
  /** Friction coefficient (0-1) - how fast it decelerates */
  frictionCoeff?: number;
  /** Whether auto-modulation is active (shows different visual) */
  isAuto?: boolean;
  /** Label for X axis */
  labelX?: string;
  /** Label for Y axis */
  labelY?: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Enable haptic feedback on interaction */
  hapticFeedback?: boolean;
  /** Show trail effect */
  showTrail?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** CSS class name */
  className?: string;
}

interface Point {
  x: number;
  y: number;
  time: number;
}

/**
 * XYPadAdvanced - A 2D control surface with physics-based interaction.
 * 
 * Physics Modes:
 * - **Spring**: Puck snaps back to center on release (like pitch wheel)
 * - **Friction**: Puck decelerates gradually after release (throw gesture)
 * - **Sticky**: Puck stays exactly where released (default knob behavior)
 * 
 * Visual Features:
 * - Real-time trail rendering
 * - Glow effects
 * - Grid overlay
 * - Axis labels
 */
export const XYPadAdvanced: React.FC<XYPadAdvancedProps> = ({
  x,
  y,
  onChange,
  physicsMode = 'sticky',
  springTension = 0.15,
  frictionCoeff = 0.95,
  isAuto = false,
  labelX,
  labelY,
  width = 200,
  height = 200,
  hapticFeedback = true,
  showTrail = true,
  disabled = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef<Point[]>([]);
  
  // Store current values in refs for animation loop
  const valuesRef = useRef({ x, y, isAuto, isDragging: false });
  valuesRef.current = { x, y, isAuto, isDragging };

  /**
   * Convert canvas coordinates to normalized values.
   */
  const canvasToNormalized = useCallback((canvasX: number, canvasY: number) => {
    // X: 0 to width → -1 to 1
    // Y: 0 to height → 1 to 0 (inverted)
    const normalizedX = (canvasX / width) * 2 - 1;
    const normalizedY = 1 - (canvasY / height);
    return {
      x: Math.max(-1, Math.min(1, normalizedX)),
      y: Math.max(0, Math.min(1, normalizedY)),
    };
  }, [width, height]);

  /**
   * Convert normalized values to canvas coordinates.
   */
  const normalizedToCanvas = useCallback((normX: number, normY: number) => {
    // X: -1 to 1 → 0 to width
    // Y: 0 to 1 → height to 0
    return {
      x: ((normX + 1) / 2) * width,
      y: (1 - normY) * height,
    };
  }, [width, height]);

  /**
   * Physics simulation step.
   */
  const physicsStep = useCallback(() => {
    if (valuesRef.current.isDragging || disabled || isAuto) return;

    const vel = velocityRef.current;
    let { x: currentX, y: currentY } = valuesRef.current;
    let changed = false;

    if (physicsMode === 'spring') {
      // Spring back to center (0, 0.5)
      const targetX = 0;
      const targetY = 0.5;
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      
      // Apply spring force
      vel.x += dx * springTension;
      vel.y += dy * springTension;
      
      // Apply damping
      vel.x *= 0.85;
      vel.y *= 0.85;
      
      // Update position
      currentX += vel.x;
      currentY += vel.y;
      
      // Check if settled
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || 
          Math.abs(vel.x) > 0.001 || Math.abs(vel.y) > 0.001) {
        changed = true;
      }
    } else if (physicsMode === 'friction') {
      // Apply friction to velocity
      vel.x *= frictionCoeff;
      vel.y *= frictionCoeff;
      
      // Update position
      currentX += vel.x * 0.1;
      currentY += vel.y * 0.1;
      
      // Clamp to bounds
      currentX = Math.max(-1, Math.min(1, currentX));
      currentY = Math.max(0, Math.min(1, currentY));
      
      // Check if still moving
      if (Math.abs(vel.x) > 0.001 || Math.abs(vel.y) > 0.001) {
        changed = true;
      }
    }
    // 'sticky' mode: no physics, puck stays in place

    if (changed) {
      onChange(currentX, currentY);
    }
  }, [physicsMode, springTension, frictionCoeff, disabled, isAuto, onChange]);

  /**
   * Main render loop.
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const { x: currentX, y: currentY, isAuto: auto, isDragging: dragging } = valuesRef.current;

    // Clear
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Quarter lines (fainter)
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(w / 4, 0);
    ctx.lineTo(w / 4, h);
    ctx.moveTo(w * 3/4, 0);
    ctx.lineTo(w * 3/4, h);
    ctx.moveTo(0, h / 4);
    ctx.lineTo(w, h / 4);
    ctx.moveTo(0, h * 3/4);
    ctx.lineTo(w, h * 3/4);
    ctx.stroke();

    // Trail
    if (showTrail && trailRef.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = auto ? 'rgba(3, 218, 198, 0.3)' : 'rgba(0, 255, 136, 0.3)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const trail = trailRef.current;
      const now = Date.now();
      
      for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const age = now - point.time;
        const alpha = Math.max(0, 1 - age / 1000); // Fade over 1 second
        
        if (alpha > 0) {
          const pos = normalizedToCanvas(point.x, point.y);
          if (i === 0) {
            ctx.moveTo(pos.x, pos.y);
          } else {
            ctx.lineTo(pos.x, pos.y);
          }
        }
      }
      ctx.stroke();

      // Clean old trail points
      trailRef.current = trail.filter(p => now - p.time < 1000);
    }

    // Puck position
    const puckPos = normalizedToCanvas(currentX, currentY);

    // Glow
    const glowColor = auto ? '#03dac6' : dragging ? '#00ff88' : '#00ccff';
    ctx.shadowBlur = dragging ? 25 : 15;
    ctx.shadowColor = glowColor;

    // Puck
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(puckPos.x, puckPos.y, dragging ? 12 : 10, 0, Math.PI * 2);
    ctx.fill();

    // Puck inner
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(puckPos.x, puckPos.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Auto-mode pulsing ring
    if (auto) {
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(3, 218, 198, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(puckPos.x, puckPos.y, 16 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Physics mode indicator
    if (physicsMode !== 'sticky') {
      ctx.fillStyle = '#333';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(physicsMode.toUpperCase(), w - 6, h - 6);
    }

    // Run physics
    physicsStep();

    // Continue animation
    animationRef.current = requestAnimationFrame(render);
  }, [normalizedToCanvas, showTrail, physicsStep, physicsMode]);

  // Start render loop
  useEffect(() => {
    render();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  /**
   * Handle pointer events.
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDragging(true);
    valuesRef.current.isDragging = true;

    // Reset velocity
    velocityRef.current = { x: 0, y: 0 };

    // Get position
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const pos = canvasToNormalized(canvasX, canvasY);

    lastPosRef.current = pos;
    
    // Add to trail
    if (showTrail) {
      trailRef.current.push({ ...pos, time: Date.now() });
    }

    onChange(pos.x, pos.y);

    // Haptic feedback
    if (hapticFeedback) {
      triggerHaptic(5);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const pos = canvasToNormalized(canvasX, canvasY);

    // Calculate velocity for friction mode
    const dt = 1 / 60; // Assume 60fps
    velocityRef.current = {
      x: (pos.x - lastPosRef.current.x) / dt,
      y: (pos.y - lastPosRef.current.y) / dt,
    };
    lastPosRef.current = pos;

    // Add to trail
    if (showTrail) {
      trailRef.current.push({ ...pos, time: Date.now() });
      // Limit trail length
      if (trailRef.current.length > 100) {
        trailRef.current = trailRef.current.slice(-50);
      }
    }

    onChange(pos.x, pos.y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    
    setIsDragging(false);
    valuesRef.current.isDragging = false;

    // Haptic feedback on release
    if (hapticFeedback && physicsMode === 'spring') {
      triggerHaptic([5, 50, 5]); // Pattern for spring release
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-block ${className}`}
      style={{ width, height }}
    >
      {/* Axis Labels */}
      {labelY && (
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 text-xs text-white/40 font-mono"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateX(100%)' }}
        >
          {labelY}
        </div>
      )}
      {labelX && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-1 text-xs text-white/40 font-mono">
          {labelX}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`
          rounded-xl border border-white/10 
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'}
          ${isAuto ? 'border-cyan-500/30' : ''}
        `}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Disabled Overlay */}
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
          <span className="text-xs text-white/50">Disabled</span>
        </div>
      )}
    </div>
  );
};

export default XYPadAdvanced;
