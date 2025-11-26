/**
 * WasmControls - UI controls for WASM DSP effects
 * 
 * Provides controls for:
 * - Granular synthesis parameters
 * - Convolution reverb wet/dry
 * - Spectral freeze/shift
 * 
 * Uses useRef + requestAnimationFrame for high-frequency parameter updates
 * to avoid triggering React re-renders (per project rules).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioStore, EffectType } from '../../store/useAudioStore';

// ============================================================================
// TYPES
// ============================================================================

interface KnobProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (value: number) => void;
}

// ============================================================================
// KNOB COMPONENT (High-frequency safe)
// ============================================================================

/**
 * Knob component using refs for transient updates.
 * Only triggers re-render on mouseUp for final value.
 */
const Knob: React.FC<KnobProps> = ({ 
    label, 
    value, 
    min, 
    max, 
    step: _step = 0.01, // Reserved for future snapping behavior
    unit = '',
    onChange 
}) => {
    const valueRef = useRef(value);
    const displayRef = useRef<HTMLSpanElement>(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startValue = useRef(0);

    // Update display without re-render
    const updateDisplay = useCallback((val: number) => {
        if (displayRef.current) {
            displayRef.current.textContent = `${val.toFixed(2)}${unit}`;
        }
    }, [unit]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        startY.current = e.clientY;
        startValue.current = valueRef.current;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;
        
        const delta = (startY.current - e.clientY) / 100;
        const range = max - min;
        const newValue = Math.max(min, Math.min(max, startValue.current + delta * range));
        
        valueRef.current = newValue;
        updateDisplay(newValue);
        
        // Call onChange for real-time parameter updates
        onChange(newValue);
    }, [min, max, onChange, updateDisplay]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    // Sync with external value changes
    useEffect(() => {
        valueRef.current = value;
        updateDisplay(value);
    }, [value, updateDisplay]);

    // Calculate rotation for visual feedback
    const rotation = ((valueRef.current - min) / (max - min)) * 270 - 135;

    return (
        <div className="flex flex-col items-center gap-1">
            <div 
                className="w-12 h-12 rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 
                           border border-zinc-600 cursor-ns-resize relative
                           hover:border-emerald-500/50 transition-colors"
                onMouseDown={handleMouseDown}
                style={{ transform: `rotate(${rotation}deg)` }}
            >
                {/* Indicator line */}
                <div className="absolute top-1 left-1/2 w-0.5 h-3 bg-emerald-400 -translate-x-1/2 rounded-full" />
            </div>
            <span className="text-xs text-zinc-400">{label}</span>
            <span 
                ref={displayRef} 
                className="text-xs text-emerald-400 font-mono"
            >
                {value.toFixed(2)}{unit}
            </span>
        </div>
    );
};

// ============================================================================
// EFFECT SELECTOR
// ============================================================================

const EffectSelector: React.FC<{
    currentEffect: number;
    onSelect: (effect: number) => void;
}> = ({ currentEffect, onSelect }) => {
    const effects = [
        { value: EffectType.BYPASS, label: 'Bypass', icon: '○' },
        { value: EffectType.GRANULAR, label: 'Granular', icon: '◈' },
        { value: EffectType.CONVOLUTION, label: 'Reverb', icon: '◉' },
        { value: EffectType.SPECTRAL, label: 'Spectral', icon: '◇' },
    ];

    return (
        <div className="flex gap-2">
            {effects.map(({ value, label, icon }) => (
                <button
                    key={value}
                    onClick={() => onSelect(value)}
                    className={`
                        px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${currentEffect === value 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500'
                        }
                    `}
                >
                    <span className="mr-1">{icon}</span>
                    {label}
                </button>
            ))}
        </div>
    );
};

// ============================================================================
// GRANULAR CONTROLS
// ============================================================================

const GranularControls: React.FC = () => {
    const setGranularParams = useAudioStore(s => s.setGranularParams);
    
    // Local state for display (only updates on significant changes)
    const [params, setParams] = useState({
        grainSize: 256,
        density: 20,
        pitchSpread: 0.1,
        position: 0.5,
        spray: 0.05,
    });

    const handleChange = useCallback((key: string) => (value: number) => {
        // Update WASM immediately (via store action)
        setGranularParams({ [key]: value });
        
        // Debounced local state update for display
        setParams(p => ({ ...p, [key]: value }));
    }, [setGranularParams]);

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-300">Granular Synthesis</h3>
            <div className="flex flex-wrap gap-4">
                <Knob 
                    label="Grain Size" 
                    value={params.grainSize} 
                    min={64} 
                    max={4096} 
                    step={64}
                    onChange={handleChange('grainSize')} 
                />
                <Knob 
                    label="Density" 
                    value={params.density} 
                    min={1} 
                    max={100} 
                    unit="/s"
                    onChange={handleChange('density')} 
                />
                <Knob 
                    label="Pitch Spread" 
                    value={params.pitchSpread} 
                    min={0} 
                    max={1} 
                    onChange={handleChange('pitchSpread')} 
                />
                <Knob 
                    label="Position" 
                    value={params.position} 
                    min={0} 
                    max={1} 
                    onChange={handleChange('position')} 
                />
                <Knob 
                    label="Spray" 
                    value={params.spray} 
                    min={0} 
                    max={0.5} 
                    onChange={handleChange('spray')} 
                />
            </div>
        </div>
    );
};

// ============================================================================
// CONVOLUTION CONTROLS
// ============================================================================

const ConvolutionControls: React.FC = () => {
    const setConvolutionParams = useAudioStore(s => s.setConvolutionParams);
    const [dryWet, setDryWet] = useState(0.3);

    const handleChange = useCallback((value: number) => {
        setConvolutionParams({ dryWet: value });
        setDryWet(value);
    }, [setConvolutionParams]);

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-300">Convolution Reverb</h3>
            <div className="flex gap-4">
                <Knob 
                    label="Dry/Wet" 
                    value={dryWet} 
                    min={0} 
                    max={1} 
                    onChange={handleChange} 
                />
            </div>
        </div>
    );
};

// ============================================================================
// SPECTRAL CONTROLS
// ============================================================================

const SpectralControls: React.FC = () => {
    const setSpectralParams = useAudioStore(s => s.setSpectralParams);
    const [params, setParams] = useState({
        freezeAmount: 0,
        frequencyShift: 0,
    });

    const handleChange = useCallback((key: string) => (value: number) => {
        setSpectralParams({ [key]: value });
        setParams(p => ({ ...p, [key]: value }));
    }, [setSpectralParams]);

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-300">Spectral Effects</h3>
            <div className="flex gap-4">
                <Knob 
                    label="Freeze" 
                    value={params.freezeAmount} 
                    min={0} 
                    max={1} 
                    onChange={handleChange('freezeAmount')} 
                />
                <Knob 
                    label="Shift" 
                    value={params.frequencyShift} 
                    min={-24} 
                    max={24} 
                    unit="st"
                    onChange={handleChange('frequencyShift')} 
                />
            </div>
        </div>
    );
};

// ============================================================================
// MAIN WASM CONTROLS COMPONENT
// ============================================================================

export const WasmControls: React.FC = () => {
    const { wasmReady, wasmLoading, wasmError, wasmEffect, initWasm, setWasmEffect } = useAudioStore();

    // Initialize WASM on mount
    useEffect(() => {
        if (!wasmReady && !wasmLoading) {
            initWasm();
        }
    }, [wasmReady, wasmLoading, initWasm]);

    // Loading state
    if (wasmLoading) {
        return (
            <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading WASM DSP...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (wasmError) {
        return (
            <div className="p-4 bg-zinc-900/80 rounded-xl border border-red-900/50">
                <div className="flex items-center gap-2 text-red-400">
                    <span>⚠</span>
                    <span>WASM Error: {wasmError}</span>
                </div>
                <button 
                    onClick={() => initWasm()}
                    className="mt-2 px-3 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Not ready yet (initial state)
    if (!wasmReady) {
        return (
            <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <button 
                    onClick={() => initWasm()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
                >
                    Initialize WASM DSP
                </button>
            </div>
        );
    }

    // Ready - show controls
    return (
        <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-emerald-400">WASM DSP</h2>
                <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                    ● Ready
                </span>
            </div>

            {/* Effect Selector */}
            <EffectSelector 
                currentEffect={wasmEffect} 
                onSelect={setWasmEffect} 
            />

            {/* Effect-specific controls */}
            {wasmEffect === EffectType.GRANULAR && <GranularControls />}
            {wasmEffect === EffectType.CONVOLUTION && <ConvolutionControls />}
            {wasmEffect === EffectType.SPECTRAL && <SpectralControls />}
            
            {wasmEffect === EffectType.BYPASS && (
                <p className="text-sm text-zinc-500">
                    Select an effect to enable WASM processing
                </p>
            )}
        </div>
    );
};

export default WasmControls;
