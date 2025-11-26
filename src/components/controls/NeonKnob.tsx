/**
 * NeonKnob - A premium SVG potentiometer with physics-based interaction.
 * 
 * Features:
 * - Drag up/down interaction with velocity-based inertia
 * - Glowing arc indicator with neon aesthetics
 * - Haptic visual feedback (glow intensifies with speed)
 * - Support for modulation visualization ("ghost turning")
 * - Accessible value display
 * 
 * DSP Note: This component uses refs for high-frequency updates to avoid
 * React re-renders during drag operations (>5 updates/sec rule).
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface NeonKnobProps {
  /** Current value (0-1 normalized) */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Label displayed below knob */
  label?: string;
  /** Accent color theme */
  color?: 'green' | 'cyan' | 'purple' | 'orange' | 'red';
  /** Size in pixels (default: 64) */
  size?: number;
  /** Minimum value for display formatting */
  min?: number;
  /** Maximum value for display formatting */
  max?: number;
  /** Unit suffix for display (e.g., "Hz", "%") */
  unit?: string;
  /** Value formatter function */
  formatValue?: (value: number, min: number, max: number) => string;
  /** Modulation amount (-1 to 1) for ghost-turn visualization */
  modulation?: number;
  /** Disable interaction */
  disabled?: boolean;
  /** Fine control multiplier when Shift is held */
  fineMultiplier?: number;
}

// ===========================================
// COLOR MAPPING
// ===========================================

const COLOR_MAP = {
  green: {
    primary: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.6)',
    dim: 'rgba(0, 255, 136, 0.2)',
  },
  cyan: {
    primary: '#00ccff',
    glow: 'rgba(0, 204, 255, 0.6)',
    dim: 'rgba(0, 204, 255, 0.2)',
  },
  purple: {
    primary: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.6)',
    dim: 'rgba(168, 85, 247, 0.2)',
  },
  orange: {
    primary: '#ff8800',
    glow: 'rgba(255, 136, 0, 0.6)',
    dim: 'rgba(255, 136, 0, 0.2)',
  },
  red: {
    primary: '#ff0055',
    glow: 'rgba(255, 0, 85, 0.6)',
    dim: 'rgba(255, 0, 85, 0.2)',
  },
};

// ===========================================
// DEFAULT VALUE FORMATTER
// ===========================================

const defaultFormatValue = (value: number, min: number, max: number): string => {
  const actual = min + value * (max - min);
  if (max >= 1000) {
    return actual >= 1000 ? `${(actual / 1000).toFixed(1)}k` : actual.toFixed(0);
  }
  if (max <= 1) {
    return (actual * 100).toFixed(0);
  }
  return actual.toFixed(max >= 100 ? 0 : 1);
};

// ===========================================
// KNOB COMPONENT
// ===========================================

export const NeonKnob: React.FC<NeonKnobProps> = ({
  value,
  onChange,
  label,
  color = 'cyan',
  size = 64,
  min = 0,
  max = 100,
  unit = '',
  formatValue = defaultFormatValue,
  modulation = 0,
  disabled = false,
  fineMultiplier = 0.1,
}) => {
  // Color scheme
  const colors = COLOR_MAP[color];

  // SVG geometry constants
  const strokeWidth = size * 0.08;         // Arc thickness
  const radius = (size - strokeWidth) / 2 - 2;  // Arc radius
  const center = size / 2;
  
  // Arc spans from -135° to +135° (270° total sweep)
  const startAngle = -135;
  const endAngle = 135;
  const totalSweep = endAngle - startAngle;

  // ===========================================
  // PHYSICS - Motion Values & Springs
  // ===========================================
  
  // Raw rotation value (in degrees, -135 to 135)
  const rawRotation = useMotionValue(startAngle + value * totalSweep);
  
  // Glow intensity based on drag velocity
  const glowIntensity = useMotionValue(0);
  const springGlow = useSpring(glowIntensity, { stiffness: 400, damping: 40 });

  // Transform glow intensity to filter blur
  const glowFilter = useTransform(
    springGlow,
    [0, 1],
    [`drop-shadow(0 0 2px ${colors.glow})`, `drop-shadow(0 0 12px ${colors.primary})`]
  );

  // ===========================================
  // DRAG STATE - Using refs to avoid re-renders
  // ===========================================
  
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const lastY = useRef(0);
  const velocity = useRef(0);
  const isShiftHeld = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Sync external value changes to motion value
  useEffect(() => {
    if (!isDragging.current) {
      rawRotation.set(startAngle + value * totalSweep);
    }
  }, [value, rawRotation, startAngle, totalSweep]);

  // ===========================================
  // EVENT HANDLERS
  // ===========================================

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    isDragging.current = true;
    setIsDraggingState(true);
    startY.current = e.clientY;
    lastY.current = e.clientY;
    startValue.current = value;
    isShiftHeld.current = e.shiftKey;
    
    glowIntensity.set(0.3);
  }, [disabled, value, glowIntensity]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;

    // Update shift state during drag
    isShiftHeld.current = e.shiftKey;
    
    // Calculate velocity for haptic feedback
    const currentY = e.clientY;
    velocity.current = Math.abs(currentY - lastY.current);
    lastY.current = currentY;

    // Sensitivity: ~200px drag = full range
    // Fine mode (Shift): 10x more precision
    const sensitivity = isShiftHeld.current ? 0.0005 * fineMultiplier : 0.005;
    const deltaY = startY.current - currentY;
    
    // Calculate new value with clamping
    const newValue = Math.max(0, Math.min(1, startValue.current + deltaY * sensitivity));
    
    // Update motion value directly (no React state update)
    rawRotation.set(startAngle + newValue * totalSweep);
    
    // Update glow based on velocity (clamped to 0-1)
    const normalizedVelocity = Math.min(1, velocity.current / 20);
    glowIntensity.set(0.3 + normalizedVelocity * 0.7);
    
    // Fire onChange callback
    onChange(newValue);
  }, [onChange, rawRotation, startAngle, totalSweep, glowIntensity, fineMultiplier]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDragging.current = false;
    setIsDraggingState(false);
    
    // Fade out glow
    glowIntensity.set(0);
  }, [glowIntensity]);

  // ===========================================
  // SVG ARC PATH CALCULATION
  // ===========================================

  /**
   * Converts polar coordinates to Cartesian for SVG path
   * 
   * @param cx - Center X
   * @param cy - Center Y
   * @param r - Radius
   * @param angleDeg - Angle in degrees
   */
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };

  /**
   * Generates an SVG arc path
   * 
   * @param startDeg - Start angle in degrees
   * @param endDeg - End angle in degrees  
   */
  const describeArc = (startDeg: number, endDeg: number): string => {
    const start = polarToCartesian(center, center, radius, endDeg);
    const end = polarToCartesian(center, center, radius, startDeg);
    const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
    
    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    ].join(' ');
  };

  // Background track arc (full sweep)
  const trackPath = describeArc(startAngle, endAngle);
  
  // Value arc (partial sweep based on value)
  const valueEndAngle = startAngle + value * totalSweep;
  const valuePath = value > 0.001 ? describeArc(startAngle, valueEndAngle) : '';

  // Modulation ghost arc (shows where modulation pushes the value)
  const modStart = valueEndAngle;
  const modEnd = Math.max(startAngle, Math.min(endAngle, valueEndAngle + modulation * totalSweep));
  const modPath = Math.abs(modulation) > 0.01 ? describeArc(
    Math.min(modStart, modEnd),
    Math.max(modStart, modEnd)
  ) : '';

  // Notch position (end of value arc)
  const notchPos = polarToCartesian(center, center, radius, valueEndAngle);

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div 
      className="flex flex-col items-center gap-1 select-none"
      style={{ width: size, touchAction: 'none' }}
    >
      {/* SVG Knob */}
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`cursor-ns-resize ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ 
          filter: glowFilter,
          // PERF: Promote to compositor layer for smooth filter animations
          willChange: 'filter',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Definitions for gradients and filters */}
        <defs>
          {/* Radial gradient for knob body */}
          <radialGradient id={`knobGrad-${label}`} cx="30%" cy="30%">
            <stop offset="0%" stopColor="#2a2a35" />
            <stop offset="100%" stopColor="#0a0a0f" />
          </radialGradient>

          {/* Glow filter for active state */}
          <filter id={`glow-${label}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer ring / body */}
        <circle
          cx={center}
          cy={center}
          r={radius + strokeWidth / 2 + 1}
          fill={`url(#knobGrad-${label})`}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
        />

        {/* Background track (dim arc) */}
        <path
          d={trackPath}
          fill="none"
          stroke={colors.dim}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc (lit portion) */}
        {valuePath && (
          <motion.path
            d={valuePath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            filter={isDraggingState ? `url(#glow-${label})` : undefined}
          />
        )}

        {/* Modulation ghost arc */}
        {modPath && (
          <path
            d={modPath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={strokeWidth * 0.5}
            strokeLinecap="round"
            opacity={0.4}
            strokeDasharray="4 4"
            className="animate-signal-flow"
          />
        )}

        {/* Notch indicator (glowing dot at value position) */}
        <motion.circle
          cx={notchPos.x}
          cy={notchPos.y}
          r={strokeWidth * 0.6}
          fill={colors.primary}
          filter={`url(#glow-${label})`}
          style={{
            scale: isDraggingState ? 1.3 : 1,
          }}
        />

        {/* Center cap with value display */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.55}
          fill="#0a0a0f"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {/* Value text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.primary}
          fontSize={size * 0.16}
          fontFamily="Share Tech Mono, monospace"
          fontWeight={500}
        >
          {formatValue(value, min, max)}
        </text>

        {/* Unit text (smaller, below value) */}
        {unit && (
          <text
            x={center}
            y={center + size * 0.12}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.4)"
            fontSize={size * 0.1}
            fontFamily="Share Tech Mono, monospace"
          >
            {unit}
          </text>
        )}
      </motion.svg>

      {/* Label */}
      {label && (
        <span 
          className="font-mono text-[10px] uppercase tracking-wider text-muted-light"
          style={{ color: isDraggingState ? colors.primary : undefined }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default NeonKnob;
