/**
 * useAudioMeter - Real-time audio level metering hook.
 * 
 * Connects to the master output and provides accurate RMS levels
 * using Web Audio API's AnalyserNode.
 * 
 * @module hooks/useAudioMeter
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { audioCore } from '../audio/engine/AudioCore';

interface MeterLevels {
  left: number;   // 0-1 RMS level
  right: number;  // 0-1 RMS level
  peak: number;   // 0-1 peak level
}

/**
 * Hook for real-time audio metering.
 * 
 * @param enabled - Whether metering is active (saves CPU when not needed)
 * @returns Current meter levels { left, right, peak }
 */
export function useAudioMeter(enabled: boolean = true): MeterLevels {
  const [levels, setLevels] = useState<MeterLevels>({ left: 0, right: 0, peak: 0 });
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number>(0);
  const connectedRef = useRef<boolean>(false);

  // Setup analyser connection
  const setupAnalyser = useCallback(() => {
    const ctx = audioCore.getContext();
    const masterBus = audioCore.getMasterBus();
    
    if (!ctx || !masterBus || connectedRef.current) return;

    try {
      // Create analyser with fast response
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5; // Responsive but not jittery
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Connect to master output
      const inputNode = masterBus.getInputNode();
      inputNode.connect(analyser);
      connectedRef.current = true;
      
      console.log('[useAudioMeter] Connected to master bus');
    } catch (error) {
      console.error('[useAudioMeter] Setup failed:', error);
    }
  }, []);

  // Animation loop for metering
  useEffect(() => {
    if (!enabled) {
      // Reset levels when disabled
      setLevels({ left: 0, right: 0, peak: 0 });
      return;
    }

    // Try to connect on first run
    setupAnalyser();

    const measure = () => {
      const analyser = analyserRef.current;
      const data = dataRef.current;
      
      if (!analyser || !data) {
        // Try to reconnect
        setupAnalyser();
        rafRef.current = requestAnimationFrame(measure);
        return;
      }

      // Get time domain data
      analyser.getByteTimeDomainData(data);

      // Calculate RMS (Root Mean Square) for accurate level
      let sum = 0;
      let peak = 0;
      
      for (let i = 0; i < data.length; i++) {
        // Convert from 0-255 to -1 to 1
        const val = (data[i] - 128) / 128;
        sum += val * val;
        peak = Math.max(peak, Math.abs(val));
      }
      
      const rms = Math.sqrt(sum / data.length);
      
      // Apply smoothing and scale for better visual response
      // RMS tends to be low, so we boost it for better meter visibility
      const scaledRms = Math.min(1, rms * 3);
      
      setLevels(prev => ({
        // Smooth descent, instant attack
        left: Math.max(scaledRms, prev.left * 0.85),
        right: Math.max(scaledRms, prev.right * 0.85), // Mono for now
        peak: Math.max(peak, prev.peak * 0.95),
      }));

      rafRef.current = requestAnimationFrame(measure);
    };

    measure();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, setupAnalyser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (analyserRef.current && connectedRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {
          // Already disconnected
        }
      }
    };
  }, []);

  return levels;
}

export default useAudioMeter;
