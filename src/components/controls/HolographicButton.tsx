/**
 * HolographicButton - A premium button with holographic state transitions.
 * 
 * States:
 * - Idle: Ghostly, semi-transparent border with subtle pulse
 * - Hover: Glitches slightly, border brightens with scan-line effect
 * - Active: Solid neon fill, ripple explosion outward
 * - Pressed: Scale down with flash
 * 
 * Features:
 * - Holographic shimmer on hover
 * - Ripple effect on click
 * - Support for toggle (on/off) mode
 * - Icon + label support
 * - Multiple size variants
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface HolographicButtonProps {
  /** Button label text */
  children: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Button color theme */
  color?: 'green' | 'cyan' | 'purple' | 'orange' | 'red';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Toggle mode - button stays active until clicked again */
  toggle?: boolean;
  /** External control for toggle state */
  isActive?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Icon element to display before label */
  icon?: React.ReactNode;
  /** Full width mode */
  fullWidth?: boolean;
  /** Custom className for additional styling */
  className?: string;
  /** Pill shape (fully rounded) */
  pill?: boolean;
}

// ===========================================
// COLOR MAPPING
// ===========================================

const COLOR_MAP = {
  green: {
    primary: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.6)',
    dim: 'rgba(0, 255, 136, 0.2)',
    bg: 'rgba(0, 255, 136, 0.1)',
  },
  cyan: {
    primary: '#00ccff',
    glow: 'rgba(0, 204, 255, 0.6)',
    dim: 'rgba(0, 204, 255, 0.2)',
    bg: 'rgba(0, 204, 255, 0.1)',
  },
  purple: {
    primary: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.6)',
    dim: 'rgba(168, 85, 247, 0.2)',
    bg: 'rgba(168, 85, 247, 0.1)',
  },
  orange: {
    primary: '#ff8800',
    glow: 'rgba(255, 136, 0, 0.6)',
    dim: 'rgba(255, 136, 0, 0.2)',
    bg: 'rgba(255, 136, 0, 0.1)',
  },
  red: {
    primary: '#ff0055',
    glow: 'rgba(255, 0, 85, 0.6)',
    dim: 'rgba(255, 0, 85, 0.2)',
    bg: 'rgba(255, 0, 85, 0.1)',
  },
};

// ===========================================
// SIZE MAPPING
// ===========================================

const SIZE_MAP = {
  sm: {
    padding: '6px 12px',
    fontSize: '11px',
    iconSize: 14,
    borderRadius: 6,
  },
  md: {
    padding: '10px 20px',
    fontSize: '13px',
    iconSize: 18,
    borderRadius: 8,
  },
  lg: {
    padding: '14px 28px',
    fontSize: '15px',
    iconSize: 22,
    borderRadius: 10,
  },
};

// ===========================================
// ANIMATION VARIANTS
// ===========================================

const buttonVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 1,
  },
  hover: {
    scale: 1.02,
    transition: { duration: 0.2 },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

const glitchVariants: Variants = {
  idle: {
    x: 0,
    opacity: 0,
  },
  hover: {
    x: [0, -2, 2, -1, 1, 0],
    opacity: [0, 0.3, 0.3, 0.3, 0.3, 0],
    transition: {
      duration: 0.3,
      times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
};

// ===========================================
// RIPPLE COMPONENT
// ===========================================

interface RippleProps {
  x: number;
  y: number;
  color: string;
  onComplete: () => void;
}

const Ripple: React.FC<RippleProps> = ({ x, y, color, onComplete }) => (
  <motion.span
    className="absolute rounded-full pointer-events-none"
    style={{
      left: x,
      top: y,
      width: 10,
      height: 10,
      marginLeft: -5,
      marginTop: -5,
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    }}
    initial={{ scale: 0, opacity: 0.8 }}
    animate={{ scale: 8, opacity: 0 }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
    onAnimationComplete={onComplete}
  />
);

// ===========================================
// BUTTON COMPONENT
// ===========================================

export const HolographicButton: React.FC<HolographicButtonProps> = ({
  children,
  onClick,
  color = 'cyan',
  size = 'md',
  toggle = false,
  isActive: externalActive,
  disabled = false,
  icon,
  fullWidth = false,
  className = '',
  pill = false,
}) => {
  const colors = COLOR_MAP[color];
  const sizeConfig = SIZE_MAP[size];

  // ===========================================
  // STATE
  // ===========================================
  
  const [internalActive, setInternalActive] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleIdRef = useRef(0);

  // Use external active state if provided, otherwise internal
  const isActive = externalActive !== undefined ? externalActive : internalActive;

  // ===========================================
  // EVENT HANDLERS
  // ===========================================

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Calculate ripple position relative to button
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++rippleIdRef.current;
      setRipples(prev => [...prev, { id, x, y }]);
    }

    // Toggle internal state if in toggle mode and not externally controlled
    if (toggle && externalActive === undefined) {
      setInternalActive(prev => !prev);
    }

    onClick?.();
  }, [disabled, onClick, toggle, externalActive]);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  // ===========================================
  // COMPUTED STYLES
  // ===========================================

  const borderRadius = pill ? 9999 : sizeConfig.borderRadius;

  const baseStyle: React.CSSProperties = {
    padding: sizeConfig.padding,
    fontSize: sizeConfig.fontSize,
    borderRadius,
    fontFamily: 'Share Tech Mono, monospace',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : 'auto',
    position: 'relative',
    overflow: 'hidden',
  };

  // Dynamic styles based on state
  const getBackgroundStyle = () => {
    if (disabled) return 'rgba(40, 40, 40, 0.3)';
    if (isActive) return colors.bg;
    if (isHovering) return 'rgba(255, 255, 255, 0.03)';
    return 'transparent';
  };

  const getBorderStyle = () => {
    if (disabled) return '1px solid rgba(100, 100, 100, 0.3)';
    if (isActive) return `1px solid ${colors.primary}`;
    if (isHovering) return `1px solid ${colors.dim}`;
    return '1px solid rgba(255, 255, 255, 0.1)';
  };

  const getBoxShadow = () => {
    if (disabled) return 'none';
    if (isActive) return `0 0 20px ${colors.glow}, inset 0 0 20px ${colors.dim}`;
    if (isHovering) return `0 0 10px ${colors.dim}`;
    return 'none';
  };

  const getTextColor = () => {
    if (disabled) return 'rgba(150, 150, 150, 0.5)';
    if (isActive) return colors.primary;
    if (isHovering) return 'rgba(255, 255, 255, 0.9)';
    return 'rgba(255, 255, 255, 0.6)';
  };

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <motion.button
      ref={buttonRef}
      className={`relative flex items-center justify-center gap-2 select-none transition-colors ${className}`}
      style={{
        ...baseStyle,
        background: getBackgroundStyle(),
        border: getBorderStyle(),
        boxShadow: getBoxShadow(),
        color: getTextColor(),
        backdropFilter: 'blur(8px)',
      }}
      variants={buttonVariants}
      initial="idle"
      whileHover={disabled ? undefined : 'hover'}
      whileTap={disabled ? undefined : 'tap'}
      onClick={handleClick}
      onMouseEnter={() => !disabled && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      disabled={disabled}
    >
      {/* Holographic shimmer overlay (hover effect) */}
      <AnimatePresence>
        {isHovering && !disabled && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(105deg, transparent 40%, ${colors.dim} 50%, transparent 60%)`,
              borderRadius,
            }}
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: '100%', opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Glitch effect (hover) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: colors.dim,
          borderRadius,
          mixBlendMode: 'screen',
        }}
        variants={glitchVariants}
        animate={isHovering && !disabled ? 'hover' : 'idle'}
      />

      {/* Scan line effect for active state */}
      {isActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ borderRadius }}
        >
          <motion.div
            className="absolute w-full h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
              opacity: 0.5,
            }}
            animate={{
              top: ['0%', '100%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>
      )}

      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map(({ id, x, y }) => (
          <Ripple
            key={id}
            x={x}
            y={y}
            color={colors.primary}
            onComplete={() => removeRipple(id)}
          />
        ))}
      </AnimatePresence>

      {/* Icon */}
      {icon && (
        <span 
          className="flex items-center justify-center"
          style={{ width: sizeConfig.iconSize, height: sizeConfig.iconSize }}
        >
          {icon}
        </span>
      )}

      {/* Label */}
      <span className="relative z-10">{children}</span>

      {/* Active indicator dot */}
      {isActive && (
        <motion.span
          className="absolute top-1 right-1 w-2 h-2 rounded-full"
          style={{
            background: colors.primary,
            boxShadow: `0 0 8px ${colors.primary}`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          layoutId="activeIndicator"
        />
      )}
    </motion.button>
  );
};

export default HolographicButton;
