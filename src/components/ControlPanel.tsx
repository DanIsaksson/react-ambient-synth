import React from 'react';
import { Play, Pause, Volume2, Activity, Wind, Zap, Move } from 'lucide-react';
import { XYPad } from './XYPad';
import { PlasmaSlider, GlassPanel, HolographicButton, NeonKnob } from './controls';

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
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            {/* Header / Global Controls */}
            <GlassPanel accent="cyan" padding="lg" className="flex flex-wrap items-center justify-center gap-8">
                {/* Play Button */}
                <HolographicButton
                    onClick={onTogglePlay}
                    color={isPlaying ? 'green' : 'cyan'}
                    size="lg"
                    pill
                    isActive={isPlaying}
                    icon={isPlaying ? <Pause size={24} /> : <Play size={24} />}
                >
                    {isPlaying ? 'Stop' : 'Play'}
                </HolographicButton>

                {/* Scene Selector */}
                <div className="flex flex-col gap-2">
                    <label className="font-mono text-xs uppercase tracking-wider text-muted-light">
                        Sound Scene
                    </label>
                    <select
                        value={currentScene}
                        onChange={(e) => onSceneChange(e.target.value)}
                        className="bg-obsidian-100 text-white border border-white/10 px-4 py-2 rounded-lg 
                                   font-mono text-sm focus:border-neon-cyan focus:outline-none
                                   hover:border-white/20 transition-colors cursor-pointer"
                        style={{ minWidth: 180 }}
                    >
                        {scenes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* Master Volume */}
                <div className="flex items-center gap-4">
                    <Volume2 size={20} className="text-neon-cyan" />
                    <PlasmaSlider
                        value={volume}
                        onChange={onVolumeChange}
                        label="Volume"
                        color="green"
                        length={140}
                        min={0}
                        max={100}
                        unit="%"
                    />
                </div>
            </GlassPanel>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* RHYTHM GROUP */}
                <GlassPanel title="Rhythm" accent="purple" padding="md">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-neon-purple mb-2">
                            <Activity size={16} />
                            <span className="font-mono text-xs uppercase">Physics</span>
                        </div>
                        <PlasmaSlider
                            value={pulseSpeed}
                            onChange={(val) => onPulseChange('speed', val)}
                            label="Speed"
                            color="purple"
                            length={120}
                        />
                        <PlasmaSlider
                            value={pulseDepth}
                            onChange={(val) => onPulseChange('depth', val)}
                            label="Depth"
                            color="purple"
                            length={120}
                        />
                        {/* Euclidean Specific */}
                        {currentScene === "Euclidean Groove" && (
                            <>
                                <PlasmaSlider
                                    value={density}
                                    onChange={onDensityChange}
                                    label="Density"
                                    color="orange"
                                    length={120}
                                />
                                <PlasmaSlider
                                    value={tension}
                                    onChange={onTensionChange}
                                    label="Tension"
                                    color="orange"
                                    length={120}
                                />
                            </>
                        )}
                    </div>
                </GlassPanel>

                {/* ATMOSPHERE GROUP */}
                <GlassPanel title="Atmosphere" accent="cyan" padding="md">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-neon-cyan mb-2">
                            <Wind size={16} />
                            <span className="font-mono text-xs uppercase">Space</span>
                        </div>
                        <div className="flex justify-center gap-4">
                            <NeonKnob
                                value={atmosphereMix}
                                onChange={onAtmosphereChange}
                                label="Reverb"
                                color="cyan"
                                size={56}
                            />
                            <NeonKnob
                                value={rumble}
                                onChange={onRumbleChange}
                                label="Rumble"
                                color="cyan"
                                size={56}
                            />
                        </div>
                    </div>
                </GlassPanel>

                {/* MODULATION GROUP */}
                <GlassPanel title="Modulation" accent="orange" padding="md">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-neon-orange mb-2">
                            <Zap size={16} />
                            <span className="font-mono text-xs uppercase">Chaos</span>
                        </div>
                        <div className="flex justify-center">
                            <NeonKnob
                                value={chaosSpeed}
                                onChange={onChaosChange}
                                label="Lorenz"
                                color="orange"
                                size={72}
                            />
                        </div>
                    </div>
                </GlassPanel>

                {/* SPATIAL GROUP */}
                <GlassPanel title="Spatial" accent="green" padding="md">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-neon-green mb-1">
                            <div className="flex items-center gap-2">
                                <Move size={16} />
                                <span className="font-mono text-xs uppercase">Drift</span>
                            </div>
                            <HolographicButton
                                onClick={onToggleDrift}
                                color="green"
                                size="sm"
                                toggle
                                isActive={isDriftAuto}
                            >
                                Auto
                            </HolographicButton>
                        </div>
                        <div className="xy-container" style={{ aspectRatio: '1', minHeight: 120 }}>
                            <XYPad x={xy.x} y={xy.y} onChange={onXYChange} isAuto={isDriftAuto} />
                        </div>
                    </div>
                </GlassPanel>

            </div>
        </div>
    );
};
