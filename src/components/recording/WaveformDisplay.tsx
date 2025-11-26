import React, { useRef, useEffect, useCallback } from 'react';

interface WaveformDisplayProps {
  /** Real-time waveform data (Float32Array from AnalyserNode) */
  waveformData: Float32Array | null;
  /** Pre-computed peaks for playback display */
  peaks: Float32Array | null;
  /** Current playback position (0-1) for playhead */
  playbackPosition?: number;
  /** Whether currently recording */
  isRecording?: boolean;
  /** Audio level (0-1) for meter */
  audioLevel?: number;
  /** Height in pixels */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Click handler for scrubbing */
  onSeek?: (position: number) => void;
}

/**
 * WaveformDisplay - Renders real-time or static waveform visualization.
 * 
 * Uses Canvas for 60fps rendering without React re-renders.
 * Two modes:
 * 1. Real-time: Shows live audio waveform during recording
 * 2. Static: Shows pre-computed peaks with playhead for playback
 */
export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveformData,
  peaks,
  playbackPosition = 0,
  isRecording = false,
  audioLevel = 0,
  height = 80,
  className = '',
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Store props in refs to avoid re-creating animation loop
  const propsRef = useRef({ waveformData, peaks, playbackPosition, isRecording, audioLevel });
  propsRef.current = { waveformData, peaks, playbackPosition, isRecording, audioLevel };

  /**
   * Draw real-time waveform (oscilloscope style).
   */
  const drawRealTimeWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    width: number,
    height: number
  ) => {
    const sliceWidth = width / data.length;
    const centerY = height / 2;
    
    // Gradient for waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(0.5, '#00ccff');
    gradient.addColorStop(1, '#00ff88');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      const y = centerY + v * centerY * 0.9; // Scale to fit with margin

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff88';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, []);

  /**
   * Draw static waveform from peaks (bar style).
   */
  const drawStaticWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    peaks: Float32Array,
    width: number,
    height: number,
    playbackPos: number
  ) => {
    const barWidth = Math.max(1, width / peaks.length);
    const centerY = height / 2;
    const maxBarHeight = height * 0.45;

    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth;
      const barHeight = peaks[i] * maxBarHeight;
      const progress = i / peaks.length;

      // Color based on playback position
      if (progress < playbackPos) {
        ctx.fillStyle = '#00ff88'; // Played portion
      } else {
        ctx.fillStyle = '#333'; // Unplayed portion
      }

      // Draw symmetrical bar
      ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight * 2);
    }

    // Draw playhead
    if (playbackPos > 0 && playbackPos < 1) {
      const playheadX = playbackPos * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, []);

  /**
   * Draw level meter on the side.
   */
  const drawLevelMeter = useCallback((
    ctx: CanvasRenderingContext2D,
    level: number,
    width: number,
    height: number
  ) => {
    const meterWidth = 4;
    const meterX = width - meterWidth - 4;
    const meterHeight = height - 8;
    const meterY = 4;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    // Level bar (from bottom)
    const levelHeight = level * meterHeight;
    const levelY = meterY + meterHeight - levelHeight;

    // Gradient based on level
    const gradient = ctx.createLinearGradient(0, meterY + meterHeight, 0, meterY);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(0.6, '#00ff88');
    gradient.addColorStop(0.8, '#ffcc00');
    gradient.addColorStop(1, '#ff0055');

    ctx.fillStyle = gradient;
    ctx.fillRect(meterX, levelY, meterWidth, levelHeight);
  }, []);

  /**
   * Main render loop.
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resize
    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== height) {
      canvas.width = rect.width;
      canvas.height = height;
    }

    const { waveformData, peaks, playbackPosition, isRecording, audioLevel } = propsRef.current;
    const width = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, h);

    // Draw center line
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(width, h / 2);
    ctx.stroke();

    // Draw waveform
    if (isRecording && waveformData && waveformData.length > 0) {
      // Real-time mode
      drawRealTimeWaveform(ctx, waveformData, width - 16, h);
      drawLevelMeter(ctx, audioLevel, width, h);
    } else if (peaks && peaks.length > 0) {
      // Static mode with peaks
      drawStaticWaveform(ctx, peaks, width, h, playbackPosition);
    } else {
      // Empty state - draw placeholder
      ctx.fillStyle = '#333';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No audio', width / 2, h / 2 + 4);
    }

    // Recording indicator
    if (isRecording) {
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(12, 12, 6, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing glow
      const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
      ctx.shadowBlur = 10 * pulse;
      ctx.shadowColor = '#ff0055';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Continue animation if recording
    if (isRecording) {
      animationRef.current = requestAnimationFrame(render);
    }
  }, [height, drawRealTimeWaveform, drawStaticWaveform, drawLevelMeter]);

  // Start/stop animation based on recording state
  useEffect(() => {
    if (isRecording) {
      render();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Render once for static display
      render();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, render, peaks, playbackPosition]);

  // Handle click for seeking
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || isRecording) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = x / rect.width;
    onSeek(Math.max(0, Math.min(1, position)));
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
        style={{ display: 'block' }}
      />
    </div>
  );
};
