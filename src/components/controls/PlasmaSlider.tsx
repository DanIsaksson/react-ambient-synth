/**
 * PlasmaSlider - A premium horizontal slider with liquid plasma fill effect.
 * 
 * Features:
 * - Glowing thumb on dark metallic track
 * - Liquid fill animation that follows the thumb
 * - Neon glow effects with customizable colors
 * - Touch-friendly with proper pointer events
 * - Support for vertical orientation
 * 
 * DSP Note: Uses refs for high-frequency drag updates to prevent
 * React re-renders during interaction.
 */

import React, { useRef, useCallback, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface PlasmaSliderProps {
  /** Current value (0-1 normalized) */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Label displayed above/beside slider */
  label?: string;
  /** Accent color theme */
  color?: 'green' | 'cyan' | 'purple' | 'orange' | 'red';
  /** Slider orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Length in pixels (width for horizontal, height for vertical) */
  length?: number;
  /** Track thickness in pixels */
  thickness?: number;
  /** Minimum value for display */
  min?: number;
  /** Maximum value for display */
  max?: number;
  /** Unit suffix */
  unit?: string;
  /** Show value tooltip on hover/drag */
  showValue?: boolean;
  /** Disable interaction */
  disabled?: boolean;
}

// ===========================================
// COLOR MAPPING
// ===========================================

const COLOR_MAP = {
  green: {
    primary: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.6)',
    dim: 'rgba(0, 255, 136, 0.15)',
    track: '#1a2a1f',
  },
  cyan: {
    primary: '#00ccff',
    glow: 'rgba(0, 204, 255, 0.6)',
    dim: 'rgba(0, 204, 255, 0.15)',
    track: '#1a2a2f',
  },
  purple: {
    primary: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.6)',
    dim: 'rgba(168, 85, 247, 0.15)',
    track: '#2a1a2f',
  },
  orange: {
    primary: '#ff8800',
    glow: 'rgba(255, 136, 0, 0.6)',
    dim: 'rgba(255, 136, 0, 0.15)',
    track: '#2f2a1a',
  },
  red: {
    primary: '#ff0055',
    glow: 'rgba(255, 0, 85, 0.6)',
    dim: 'rgba(255, 0, 85, 0.15)',
    track: '#2f1a1f',
  },
};

// ===========================================
// SLIDER COMPONENT
// ===========================================

export const PlasmaSlider: React.FC<PlasmaSliderProps> = ({
  value,
  onChange,
  label,
  color = 'cyan',
  orientation = 'horizontal',
  length = 160,
  thickness = 8,
  min = 0,
  max = 100,
  unit = '',
  showValue = true,
  disabled = false,
}) => {
  const colors = COLOR_MAP[color];
  const isHorizontal = orientation === 'horizontal';
  
  // Thumb size
  const thumbSize = thickness * 2.5;

  // ===========================================
  // MOTION VALUES FOR SMOOTH INTERACTION
  // ===========================================
  
  const glowIntensity = useMotionValue(0);
  const springGlow = useSpring(glowIntensity, { stiffness: 400, damping: 40 });
  
  // Transform glow to box-shadow
  const thumbShadow = useTransform(
    springGlow,
    [0, 1],
    [
      `0 0 4px ${colors.glow}, 0 0 8px ${colors.dim}`,
      `0 0 8px ${colors.primary}, 0 0 20px ${colors.glow}, 0 0 40px ${colors.dim}`,
    ]
  );

  // ===========================================
  // DRAG STATE
  // ===========================================
  
  const isDragging = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // ===========================================
  // EVENT HANDLERS
  // ===========================================

  const calculateValue = useCallback((clientX: number, clientY: number): number => {
    if (!trackRef.current) return value;
    
    const rect = trackRef.current.getBoundingClientRect();
    
    if (isHorizontal) {
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      return ratio;
    } else {
      // Vertical: bottom = 0, top = 1
      const y = clientY - rect.top;
      const ratio = Math.max(0, Math.min(1, 1 - y / rect.height));
      return ratio;
    }
  }, [isHorizontal, value]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    isDragging.current = true;
    setIsDraggingState(true);
    glowIntensity.set(0.8);
    
    // Update value immediately on click
    const newValue = calculateValue(e.clientX, e.clientY);
    onChange(newValue);
  }, [disabled, calculateValue, onChange, glowIntensity]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    const newValue = calculateValue(e.clientX, e.clientY);
    onChange(newValue);
  }, [calculateValue, onChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDragging.current = false;
    setIsDraggingState(false);
    glowIntensity.set(0);
  }, [glowIntensity]);

  // ===========================================
  // COMPUTED STYLES
  // ===========================================

  // Track dimensions
  const trackStyle: React.CSSProperties = isHorizontal
    ? { width: length, height: thickness }
    : { width: thickness, height: length };

  // Fill dimensions (percentage-based)
  const fillStyle: React.CSSProperties = isHorizontal
    ? { width: `${value * 100}%`, height: '100%' }
    : { width: '100%', height: `${value * 100}%`, bottom: 0 };

  // Thumb position
  const thumbStyle: React.CSSProperties = isHorizontal
    ? { left: `${value * 100}%`, top: '50%', transform: 'translate(-50%, -50%)' }
    : { left: '50%', bottom: `${value * 100}%`, transform: 'translate(-50%, 50%)' };

  // Display value
  const displayValue = (min + value * (max - min)).toFixed(max >= 100 ? 0 : 1);

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div 
      className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center gap-2`}
      style={{ touchAction: 'none' }}
    >
      {/* Label */}
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-light">
          {label}
        </span>
      )}

      {/* Track Container */}
      <div
        ref={trackRef}
        className={`relative rounded-full cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
          ...trackStyle,
          background: `linear-gradient(${isHorizontal ? '90deg' : '0deg'}, ${colors.track}, #0a0a0f)`,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.05)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => {
          setIsHovering(true);
          if (!disabled) glowIntensity.set(0.3);
        }}
        onMouseLeave={() => {
          setIsHovering(false);
          if (!isDragging.current) glowIntensity.set(0);
        }}
      >
        {/* Fill (Plasma) */}
        <motion.div
          className={`absolute rounded-full ${isHorizontal ? 'left-0' : 'left-0'}`}
          style={{
            ...fillStyle,
            background: `linear-gradient(${isHorizontal ? '90deg' : '0deg'}, ${colors.dim}, ${colors.primary})`,
            boxShadow: isDraggingState ? `0 0 10px ${colors.glow}` : `0 0 4px ${colors.dim}`,
          }}
          animate={{
            opacity: isDraggingState ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        />

        {/* Thumb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            ...thumbStyle,
            width: thumbSize,
            height: thumbSize,
            background: `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.glow})`,
            boxShadow: thumbShadow,
            border: `2px solid ${colors.primary}`,
          }}
          animate={{
            scale: isDraggingState ? 1.2 : isHovering ? 1.1 : 1,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />

        {/* Value Tooltip */}
        {showValue && (isDraggingState || isHovering) && (
          <motion.div
            className="absolute pointer-events-none font-mono text-xs whitespace-nowrap"
            style={{
              ...(isHorizontal
                ? { left: `${value * 100}%`, bottom: '100%', transform: 'translateX(-50%)' }
                : { left: '100%', bottom: `${value * 100}%`, transform: 'translateY(50%)' }),
              marginBottom: isHorizontal ? 8 : 0,
              marginLeft: isHorizontal ? 0 : 8,
              color: colors.primary,
              textShadow: `0 0 8px ${colors.glow}`,
            }}
            initial={{ opacity: 0, y: isHorizontal ? 5 : 0, x: isHorizontal ? 0 : -5 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
          >
            {displayValue}{unit}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PlasmaSlider;
