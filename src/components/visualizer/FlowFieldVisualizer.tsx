/**
 * FlowFieldVisualizer - Ethereal particle flow field using simplex noise.
 * 
 * Particles drift through a noise-based vector field, leaving glowing trails.
 * Creates an organic, spacey aesthetic with neon colors.
 * 
 * @module components/visualizer/FlowFieldVisualizer
 */

import { useRef, useEffect, useCallback } from 'react';
import { noise3D, seed } from './noise';

// ===========================================
// TYPES
// ===========================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
}

interface FlowFieldProps {
  width: number;
  height: number;
  particleCount?: number;
  colorScheme?: 'ethereal' | 'aurora' | 'nebula';
}

// ===========================================
// CONSTANTS
// ===========================================

const FREQUENCY = 0.003;      // Noise frequency (lower = smoother)
const TIME_SCALE = 0.0003;    // Animation speed
const FORCE = 0.15;           // Particle acceleration
const DAMPING = 0.98;         // Velocity damping (friction)
const MAX_SPEED = 3;          // Maximum particle velocity
const TRAIL_ALPHA = 0.03;     // Trail fade rate (lower = longer trails)
const PARTICLE_ALPHA = 0.6;   // Particle brightness

// Color schemes
const COLOR_SCHEMES = {
  ethereal: { hueStart: 170, hueRange: 60 },   // Cyan to purple
  aurora: { hueStart: 100, hueRange: 80 },     // Green to cyan
  nebula: { hueStart: 260, hueRange: 60 },     // Purple to pink
};

// ===========================================
// COMPONENT
// ===========================================

export const FlowFieldVisualizer: React.FC<FlowFieldProps> = ({
  width,
  height,
  particleCount = 800,
  colorScheme = 'ethereal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Initialize a particle
  const createParticle = useCallback((x?: number, y?: number): Particle => {
    const colors = COLOR_SCHEMES[colorScheme];
    return {
      x: x ?? Math.random() * width,
      y: y ?? Math.random() * height,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 200 + Math.random() * 300,
      hue: colors.hueStart + Math.random() * colors.hueRange,
    };
  }, [width, height, colorScheme]);

  // Reset particle when it dies or goes off screen
  const resetParticle = useCallback((p: Particle): void => {
    const colors = COLOR_SCHEMES[colorScheme];
    p.x = Math.random() * width;
    p.y = Math.random() * height;
    p.vx = 0;
    p.vy = 0;
    p.life = 0;
    p.maxLife = 200 + Math.random() * 300;
    p.hue = colors.hueStart + Math.random() * colors.hueRange;
  }, [width, height, colorScheme]);

  // Update particle position based on flow field
  const updateParticle = useCallback((p: Particle, time: number): void => {
    // Get flow direction from noise
    const angle = noise3D(
      p.x * FREQUENCY,
      p.y * FREQUENCY,
      time * TIME_SCALE
    ) * Math.PI * 2;

    // Apply force in noise direction
    p.vx += Math.cos(angle) * FORCE;
    p.vy += Math.sin(angle) * FORCE;

    // Apply damping
    p.vx *= DAMPING;
    p.vy *= DAMPING;

    // Clamp speed
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > MAX_SPEED) {
      p.vx = (p.vx / speed) * MAX_SPEED;
      p.vy = (p.vy / speed) * MAX_SPEED;
    }

    // Move particle
    p.x += p.vx;
    p.y += p.vy;
    p.life++;

    // Wrap around edges
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    // Reset if too old
    if (p.life > p.maxLife) {
      resetParticle(p);
    }
  }, [width, height, resetParticle]);

  // Draw a particle
  const drawParticle = useCallback((ctx: CanvasRenderingContext2D, p: Particle): void => {
    // Calculate alpha based on life (fade in and out)
    const lifeRatio = p.life / p.maxLife;
    const fadeIn = Math.min(p.life / 30, 1);
    const fadeOut = 1 - Math.pow(lifeRatio, 3);
    const alpha = fadeIn * fadeOut * PARTICLE_ALPHA;

    // Calculate size based on velocity
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const size = 1 + speed * 0.5;

    // Draw glowing particle
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
    ctx.fill();

    // Add glow effect
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha * 0.3})`;
    ctx.fill();
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Fade previous frame (creates trails)
    ctx.fillStyle = `rgba(5, 5, 10, ${TRAIL_ALPHA})`;
    ctx.fillRect(0, 0, width, height);

    // Update and draw particles
    const particles = particlesRef.current;
    const time = timeRef.current++;

    for (let i = 0; i < particles.length; i++) {
      updateParticle(particles[i], time);
      drawParticle(ctx, particles[i]);
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [width, height, updateParticle, drawParticle]);

  // Initialize
  useEffect(() => {
    seed(Date.now());

    // Create particles
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle());
    }

    // Initialize canvas
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = 'rgb(5, 5, 10)';
      ctx.fillRect(0, 0, width, height);
    }

    // Start animation
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, particleCount, createParticle, animate]);

  // Handle resize
  useEffect(() => {
    // Reposition particles when size changes
    particlesRef.current.forEach(p => {
      if (p.x > width) p.x = Math.random() * width;
      if (p.y > height) p.y = Math.random() * height;
    });
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
      style={{
        background: 'rgb(5, 5, 10)',
        borderRadius: '8px',
      }}
    />
  );
};

export default FlowFieldVisualizer;
