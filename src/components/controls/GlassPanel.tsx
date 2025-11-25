/**
 * GlassPanel - A glassmorphism container with organic corners and subtle glow.
 * 
 * Features:
 * - Backdrop blur for frosted glass effect
 * - Organic border-radius (16px minimum)
 * - Optional border accent color
 * - Optional header with title
 * - Fluid layout animations with Framer Motion
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface GlassPanelProps {
  /** Panel content */
  children: React.ReactNode;
  /** Optional header title */
  title?: string;
  /** Border accent color */
  accent?: 'green' | 'cyan' | 'purple' | 'orange' | 'red' | 'none';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Enable layout animations */
  animate?: boolean;
  /** Custom className */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
  /** Whether panel is collapsible */
  collapsible?: boolean;
  /** External control for collapsed state */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapse?: (collapsed: boolean) => void;
}

// ===========================================
// COLOR MAPPING
// ===========================================

const ACCENT_MAP = {
  green: {
    border: 'rgba(0, 255, 136, 0.3)',
    glow: 'rgba(0, 255, 136, 0.1)',
    title: '#00ff88',
  },
  cyan: {
    border: 'rgba(0, 204, 255, 0.3)',
    glow: 'rgba(0, 204, 255, 0.1)',
    title: '#00ccff',
  },
  purple: {
    border: 'rgba(168, 85, 247, 0.3)',
    glow: 'rgba(168, 85, 247, 0.1)',
    title: '#a855f7',
  },
  orange: {
    border: 'rgba(255, 136, 0, 0.3)',
    glow: 'rgba(255, 136, 0, 0.1)',
    title: '#ff8800',
  },
  red: {
    border: 'rgba(255, 0, 85, 0.3)',
    glow: 'rgba(255, 0, 85, 0.1)',
    title: '#ff0055',
  },
  none: {
    border: 'rgba(255, 255, 255, 0.08)',
    glow: 'transparent',
    title: 'rgba(255, 255, 255, 0.7)',
  },
};

// ===========================================
// PADDING MAP
// ===========================================

const PADDING_MAP = {
  none: '0',
  sm: '12px',
  md: '20px',
  lg: '28px',
};

// ===========================================
// PANEL COMPONENT
// ===========================================

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  title,
  accent = 'none',
  padding = 'md',
  animate = true,
  className = '',
  style,
  onClick,
  collapsible = false,
  collapsed: externalCollapsed,
  onCollapse,
}) => {
  const colors = ACCENT_MAP[accent];
  const [internalCollapsed, setInternalCollapsed] = React.useState(false);
  
  // Use external collapsed state if provided
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const handleHeaderClick = () => {
    if (!collapsible) return;
    
    const newState = !isCollapsed;
    if (externalCollapsed === undefined) {
      setInternalCollapsed(newState);
    }
    onCollapse?.(newState);
  };

  // ===========================================
  // PANEL STYLES
  // ===========================================

  const panelStyle: React.CSSProperties = {
    background: 'rgba(10, 10, 15, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 16,
    border: `1px solid ${colors.border}`,
    boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 20px ${colors.glow}`,
    overflow: 'hidden',
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: collapsible ? 'pointer' : 'default',
    userSelect: 'none',
  };

  const contentStyle: React.CSSProperties = {
    padding: PADDING_MAP[padding],
  };

  // ===========================================
  // RENDER
  // ===========================================

  const Container = animate ? motion.div : 'div';

  return (
    <Container
      className={`relative ${className}`}
      style={panelStyle}
      onClick={onClick}
      layout={animate}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={animate ? { opacity: 0, y: -10 } : undefined}
      transition={{ duration: 0.3 }}
    >
      {/* Header (optional) */}
      {title && (
        <div style={headerStyle} onClick={handleHeaderClick}>
          <span
            className="font-display text-sm uppercase tracking-wider"
            style={{ color: colors.title }}
          >
            {title}
          </span>
          
          {/* Collapse indicator */}
          {collapsible && (
            <motion.span
              className="text-xs"
              style={{ color: colors.title }}
              animate={{ rotate: isCollapsed ? 0 : 180 }}
              transition={{ duration: 0.2 }}
            >
              ▼
            </motion.span>
          )}
        </div>
      )}

      {/* Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            style={contentStyle}
            initial={false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={animate ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accent glow line at top */}
      {accent !== 'none' && (
        <div
          className="absolute top-0 left-4 right-4 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
          }}
        />
      )}
    </Container>
  );
};

export default GlassPanel;
