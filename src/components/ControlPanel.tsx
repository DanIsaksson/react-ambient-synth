import React from 'react';
import { Play, Pause, Volume2, Activity, Wind, Zap, Move } from 'lucide-react';
import { XYPad } from './XYPad';

interface ControlPanelProps {
    isPlaying: boolean;
    onTogglePlay: () => void;
    volume: number;
    onVolumeChange: (val: number) => void;

    // Scenes
    currentScene: string;
    onSceneChange: (scene: string) => void;

    // XY Drift
    xy: { x: number, y: number };
    onXYChange: (x: number, y: number) => void;
    isDriftAuto: boolean;
    onToggleDrift: () => void;

    // Pulse
    pulseSpeed: number;
    pulseDepth: number;
    onPulseChange: (param: 'speed' | 'depth', val: number) => void;

    // Atmosphere
    atmosphereMix: number;
    onAtmosphereChange: (val: number) => void;

    // Deep End
    rumble: number;
    onRumbleChange: (val: number) => void;

    // Lorenz Chaos
    chaosSpeed: number;
    onChaosChange: (val: number) => void;

    // Euclidean Rhythm
    density: number;
    onDensityChange: (val: number) => void;
    tension: number;
    onTensionChange: (val: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    isPlaying,
    onTogglePlay,
    volume,
    onVolumeChange,
    currentScene,
    onSceneChange,
    xy,
    onXYChange,
    isDriftAuto,
    onToggleDrift,
    pulseSpeed,
    pulseDepth,
    onPulseChange,
    atmosphereMix,
    onAtmosphereChange,
    rumble,
    onRumbleChange,
    chaosSpeed,
    onChaosChange,
    density,
    onDensityChange,
    tension,
    onTensionChange,
}) => {
    const scenes = ["Brown Noise", "Rain & Thunder", "8-bit Dungeon", "Hangar Storm", "Cafe", "Euclidean Groove", "Gravity Phasing"];

    return (
        <div className="control-panel">
            {/* Header / Global Controls */}
            <div className="main-controls">
                <button
                    className={`play-button ${isPlaying ? 'playing' : ''}`}
                    onClick={onTogglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                </button>

                <div className="center-group">
                    <div className="scene-selector">
                        <label>Sound Scene</label>
                        <select
                            value={currentScene}
                            onChange={(e) => onSceneChange(e.target.value)}
                            className="scene-select"
                        >
                            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="slider-group volume-group">
                        <div className="slider-label">
                            <Volume2 size={20} />
                            <span>Master Volume</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="slider volume-slider"
                        />
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="modules-grid">

                {/* RHYTHM GROUP */}
                <div className="module-card">
                    <div className="module-header">
                        <Activity size={18} />
                        <span>Rhythm / Physics</span>
                    </div>
                    <div className="sliders-stack">
                        <div className="mini-slider">
                            <label>Speed / Gravity</label>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={pulseSpeed}
                                onChange={(e) => onPulseChange('speed', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="mini-slider">
                            <label>Depth / Restitution</label>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={pulseDepth}
                                onChange={(e) => onPulseChange('depth', parseFloat(e.target.value))}
                            />
                        </div>
                        {/* Euclidean Specific */}
                        {currentScene === "Euclidean Groove" && (
                            <>
                                <div className="mini-slider">
                                    <label>Density</label>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={density}
                                        onChange={(e) => onDensityChange(parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="mini-slider">
                                    <label>Tension</label>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={tension}
                                        onChange={(e) => onTensionChange(parseFloat(e.target.value))}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ATMOSPHERE GROUP */}
                <div className="module-card">
                    <div className="module-header">
                        <Wind size={18} />
                        <span>Atmosphere</span>
                    </div>
                    <div className="sliders-stack">
                        <div className="mini-slider">
                            <label>Reverb Mix</label>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={atmosphereMix}
                                onChange={(e) => onAtmosphereChange(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="mini-slider">
                            <label>Deep End Rumble</label>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={rumble}
                                onChange={(e) => onRumbleChange(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* MODULATION GROUP */}
                <div className="module-card">
                    <div className="module-header">
                        <Zap size={18} />
                        <span>Modulation</span>
                    </div>
                    <div className="sliders-stack">
                        <div className="mini-slider">
                            <label>Lorenz Chaos Speed</label>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={chaosSpeed}
                                onChange={(e) => onChaosChange(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* SPATIAL GROUP */}
                <div className="module-card">
                    <div className="module-header">
                        <Move size={18} />
                        <span>Spatial Drift</span>
                        <button
                            className={`toggle-btn ${isDriftAuto ? 'active' : ''}`}
                            onClick={onToggleDrift}
                        >
                            Auto
                        </button>
                    </div>
                    <div className="xy-container">
                        <XYPad x={xy.x} y={xy.y} onChange={onXYChange} isAuto={isDriftAuto} />
                    </div>
                </div>

            </div>
        </div>
    );
};
