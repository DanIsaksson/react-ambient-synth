import { useState, useEffect } from 'react';
import { useAudioStore } from './store/useAudioStore';
import { ControlPanel } from './components/ControlPanel';
import { BrownNoiseScene } from './audio/scenes/BrownNoiseScene';
import { RainThunderScene } from './audio/scenes/RainThunderScene';
import { Dungeon8BitScene } from './audio/scenes/Dungeon8BitScene';
import { HangarStormScene } from './audio/scenes/HangarStormScene';
import { CafeScene } from './audio/scenes/CafeScene';
import { EuclideanGrooveScene } from './audio/scenes/EuclideanGrooveScene';
import { GravityPhasingScene } from './audio/scenes/GravityPhasingScene';
import { Scene3D } from './components/visualizers/Scene3D';
import { NodeEditor } from './components/nodegraph/NodeEditor';
import { HolographicButton } from './components/controls';
import { LayoutGrid, Play, Square } from 'lucide-react';
import './App.css';

function App() {
  const {
    isPlaying,
    volume,
    currentScene,
    init,
    togglePlay,
    setVolume,
    setScene,
    setAtmosphereParam
  } = useAudioStore();

  const [viewMode, setViewMode] = useState<'classic' | 'graph'>('classic');

  // Local UI State (mirrors audio state for controlled inputs)
  const [rumble, setRumble] = useState(0.5);
  const [pulseSpeed, setPulseSpeed] = useState(0.5);
  const [pulseDepth, setPulseDepth] = useState(0.2);
  const [xy, setXY] = useState({ x: 0, y: 0.5 });
  const [isDriftAuto, setIsDriftAuto] = useState(false);
  const [atmosphereMix, setAtmosphereMix] = useState(0.3);
  const [chaosSpeed, setChaosSpeed] = useState(0.5);
  const [density, setDensity] = useState(0.5);
  const [tension, setTension] = useState(0.5);

  // Initialize Audio on Mount (or first interaction)
  useEffect(() => {
    // We can init immediately or wait for user. 
    // Browser policy usually requires user gesture for AudioContext.
    // We'll let the "Start" button handle the resume/init if needed, 
    // but we can pre-load the worklet.
    init();
  }, [init]);

  const handleTogglePlay = () => {
    togglePlay();
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
  };

  // Module Handlers
  const handleRumbleChange = (val: number) => {
    setRumble(val);
    setAtmosphereParam('rumble', val);
  };

  const handleXYChange = (x: number, y: number) => {
    setXY({ x, y });
    setAtmosphereParam('x', x);
    setAtmosphereParam('y', y);
  };

  const handleToggleDrift = () => {
    const newVal = !isDriftAuto;
    setIsDriftAuto(newVal);
    setAtmosphereParam('driftAuto', newVal ? 1 : 0);
  };

  const handlePulseChange = (param: 'speed' | 'depth', val: number) => {
    if (param === 'speed') {
      setPulseSpeed(val);
      setAtmosphereParam('pulseSpeed', val);
    } else {
      setPulseDepth(val);
      setAtmosphereParam('pulseDepth', val);
    }
  };

  const handleAtmosphereChange = (val: number) => {
    setAtmosphereMix(val);
    setAtmosphereParam('atmosphereMix', val);
  };

  const handleChaosChange = (val: number) => {
    setChaosSpeed(val);
    setAtmosphereParam('chaosSpeed', val);
  };

  const handleDensityChange = (val: number) => {
    setDensity(val);
    setAtmosphereParam('density', val);
  };

  const handleTensionChange = (val: number) => {
    setTension(val);
    setAtmosphereParam('tension', val);
  };

  const handleSceneChange = (sceneName: string) => {
    switch (sceneName) {
      case "Brown Noise":
        setScene(new BrownNoiseScene(), sceneName);
        break;
      case "Rain & Thunder":
        setScene(new RainThunderScene(), sceneName);
        break;
      case "Dungeon 8-Bit":
        setScene(new Dungeon8BitScene(), sceneName);
        break;
      case "Hangar Storm":
        setScene(new HangarStormScene(), sceneName);
        break;
      case "Cafe":
        setScene(new CafeScene(), sceneName);
        break;
      case "Euclidean Groove":
        setScene(new EuclideanGrooveScene(), sceneName);
        break;
      case "Gravity Phasing":
        setScene(new GravityPhasingScene(), sceneName);
        break;
      default:
        console.warn(`Unknown scene: ${sceneName}`);
        break;
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Background Visualizer (3D) */}
      {/* Layer 0: Background Visualizer (3D) */}
      <div className="absolute inset-0 z-0">
        <Scene3D />
      </div>

      {/* Layer 1: Graph Mode (Full Screen Workspace) - Fully opaque */}
      {viewMode === 'graph' && (
        <div className="absolute inset-0 z-10 animate-fade-in">
          <NodeEditor onExitGraphMode={() => setViewMode('classic')} />
        </div>
      )}

      {/* Layer 2: HUD & Classic Controls (Overlay) - HIDDEN in graph mode */}
      {viewMode === 'classic' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
          {/* Header */}
          <header className="flex justify-between items-start pointer-events-auto">
            <div>
              <h1 className="text-4xl font-display font-bold tracking-widest uppercase text-neon-cyan"
                  style={{ textShadow: '0 0 20px rgba(0, 204, 255, 0.5)' }}>
                Ambient Flow
              </h1>
              <p className="text-xs font-mono text-muted-light mt-1 tracking-wider">
                Generative Audio Workstation // v2.0
              </p>
            </div>
            <div className="flex items-center gap-3">
              <HolographicButton
                onClick={() => setViewMode('graph')}
                color="purple"
                size="md"
                icon={<LayoutGrid size={16} />}
              >
                Graph Mode
              </HolographicButton>
              <HolographicButton
                onClick={handleTogglePlay}
                color={isPlaying ? 'green' : 'cyan'}
                size="lg"
                pill
                isActive={isPlaying}
                icon={isPlaying ? <Square size={18} /> : <Play size={18} />}
              >
                {isPlaying ? 'Stop' : 'Start'}
              </HolographicButton>
            </div>
          </header>

          {/* Main Controls */}
          <main className="flex-1 flex items-center justify-center pointer-events-auto">
            <ControlPanel
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              volume={volume}
              onVolumeChange={handleVolumeChange}

              currentScene={currentScene}
              onSceneChange={handleSceneChange}

              xy={xy}
              onXYChange={handleXYChange}
              isDriftAuto={isDriftAuto}
              onToggleDrift={handleToggleDrift}

              pulseSpeed={pulseSpeed}
              pulseDepth={pulseDepth}
              onPulseChange={handlePulseChange}

              atmosphereMix={atmosphereMix}
              onAtmosphereChange={handleAtmosphereChange}

              rumble={rumble}
              onRumbleChange={handleRumbleChange}

              chaosSpeed={chaosSpeed}
              onChaosChange={handleChaosChange}

              density={density}
              onDensityChange={handleDensityChange}
              tension={tension}
              onTensionChange={handleTensionChange}
            />
          </main>

          {/* Footer Status */}
          <footer className="flex justify-between items-end text-xs font-mono pointer-events-auto">
            <div className="flex gap-4 text-muted">
              <span>CPU: <span className="text-neon-cyan">12%</span></span>
              <span>DSP: <span className="text-neon-cyan">44.1kHz</span></span>
              <span>Voices: <span className="text-neon-cyan">2</span></span>
            </div>
            <div className="text-right text-muted">
              <p>System Status: <span className="text-neon-green" style={{ textShadow: '0 0 8px rgba(0, 255, 136, 0.5)' }}>● Active</span></p>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

export default App;
