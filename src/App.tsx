import { useState, useEffect, useCallback, useRef } from 'react';
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
import { FloatingVisualizer } from './components/visualizers/FloatingVisualizer';
import { UnifiedHeader } from './components/controls/UnifiedHeader';
import { RecordingPanel } from './components/recording';
import { Visualizer } from './components/visualizer';
import { Eye } from 'lucide-react';
import { InstallBanner } from './components/pwa/InstallBanner';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useOnboarding } from './hooks/useOnboarding';
import { WelcomeModal, OnboardingTour, OnboardingStyles } from './components/onboarding';
import './App.css';

function App() {
  const {
    volume,
    currentScene,
    init,
    setVolume,
    setScene,
    setAtmosphereParam
  } = useAudioStore();

  const [viewMode, setViewMode] = useState<'classic' | 'graph'>('classic');
  const [showGravityVisualizer, setShowGravityVisualizer] = useState(false);
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const gravitySceneRef = useRef<GravityPhasingScene | null>(null);

  // Onboarding state
  const {
    isFirstVisit,
    shouldShowClassicTour,
    shouldShowGraphTour,
    completeWelcome,
    completeClassicTour,
    completeGraphTour,
    skipOnboarding,
  } = useOnboarding();
  const [showWelcome, setShowWelcome] = useState(false);
  const [runClassicTour, setRunClassicTour] = useState(false);
  const [runGraphTour, setRunGraphTour] = useState(false);

  // Show welcome modal on first visit
  useEffect(() => {
    if (isFirstVisit) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setShowWelcome(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isFirstVisit]);

  // Trigger tour when switching modes (if not seen)
  useEffect(() => {
    if (viewMode === 'classic' && shouldShowClassicTour) {
      setRunClassicTour(true);
    } else if (viewMode === 'graph' && shouldShowGraphTour) {
      setRunGraphTour(true);
    }
  }, [viewMode, shouldShowClassicTour, shouldShowGraphTour]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    viewMode,
    onToggleVisualizer: () => setShowVisualizer(v => !v),
    onShowHelp: () => setShowKeyboardHelp(true),
  });

  // Welcome modal handlers
  const handleStartClassic = () => {
    setShowWelcome(false);
    completeWelcome();
    setViewMode('classic');
    setRunClassicTour(true);
  };

  const handleStartGraph = () => {
    setShowWelcome(false);
    completeWelcome();
    setViewMode('graph');
    setRunGraphTour(true);
  };

  const handleSkipOnboarding = () => {
    setShowWelcome(false);
    skipOnboarding();
  };

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

  // Gravity visualizer state getter
  const getGravityVisualState = useCallback(() => {
    if (gravitySceneRef.current) {
      return gravitySceneRef.current.getVisualState();
    }
    return null;
  }, []);

  const handleSceneChange = (sceneName: string) => {
    // Reset gravity visualizer if switching away
    if (sceneName !== "Gravity Phasing") {
      setShowGravityVisualizer(false);
      gravitySceneRef.current = null;
    }
    switch (sceneName) {
      case "Brown Noise":
        setScene(new BrownNoiseScene(), sceneName);
        break;
      case "Rain & Thunder":
        setScene(new RainThunderScene(), sceneName);
        break;
      case "8-bit Dungeon":
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
        const gravityScene = new GravityPhasingScene();
        gravitySceneRef.current = gravityScene;
        setScene(gravityScene, sceneName);
        setShowGravityVisualizer(true); // Auto-show visualizer
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
      {/* PERF: Pause R3F render loop when Graph Mode is active (hidden behind opaque UI) */}
      <div className="absolute inset-0 z-0">
        <Scene3D paused={viewMode === 'graph'} />
      </div>

      {/* Layer 1: Graph Mode (Full Screen Workspace) - Fully opaque */}
      {viewMode === 'graph' && (
        <div className="absolute inset-0 z-10 animate-fade-in">
          <NodeEditor />
        </div>
      )}

      {/* Layer 2: HUD & Classic Controls (Overlay) - HIDDEN in graph mode */}
      {viewMode === 'classic' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 pt-16">
          {/* Spacer for unified header */}
          <div />

          {/* Main Controls */}
          <main className="flex-1 flex items-center justify-center pointer-events-auto">
            <ControlPanel
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
            <div className="flex items-center gap-4">
              {/* Show Visualizer Button (only for Gravity Phasing) */}
              {currentScene === "Gravity Phasing" && !showGravityVisualizer && (
                <button
                  onClick={() => setShowGravityVisualizer(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 
                             hover:bg-purple-500/30 transition text-xs font-mono uppercase tracking-wider"
                >
                  <Eye size={14} />
                  Show Visualizer
                </button>
              )}
              <div className="text-right text-muted">
                <p>System Status: <span className="text-neon-green" style={{ textShadow: '0 0 8px rgba(0, 255, 136, 0.5)' }}>● Active</span></p>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Floating Gravity Visualizer */}
      <FloatingVisualizer
        isVisible={showGravityVisualizer && viewMode === 'classic'}
        onClose={() => setShowGravityVisualizer(false)}
        getVisualState={getGravityVisualState}
      />

      {/* Unified Header - Always visible at top */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <UnifiedHeader 
          viewMode={viewMode} 
          onSwitchMode={() => setViewMode(viewMode === 'classic' ? 'graph' : 'classic')}
          onToggleRecording={() => setShowRecordingPanel(!showRecordingPanel)}
          showRecordingPanel={showRecordingPanel}
          onToggleVisualizer={() => setShowVisualizer(!showVisualizer)}
          showVisualizer={showVisualizer}
        />
      </div>

      {/* Floating Recording Panel */}
      {showRecordingPanel && (
        <div className="fixed top-14 right-4 z-40 w-80 animate-fade-in">
          <RecordingPanel 
            isExpanded={true}
            onExpandChange={(expanded) => !expanded && setShowRecordingPanel(false)}
          />
        </div>
      )}

      {/* Global Visualizer */}
      <Visualizer 
        isOpen={showVisualizer}
        onClose={() => setShowVisualizer(false)}
      />

      {/* PWA Install Banner */}
      <InstallBanner />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

      {/* Onboarding */}
      <OnboardingStyles />
      <WelcomeModal
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
        onStartClassic={handleStartClassic}
        onStartGraph={handleStartGraph}
        onSkip={handleSkipOnboarding}
      />
      <OnboardingTour
        tourType="classic"
        isActive={runClassicTour}
        onComplete={() => {
          setRunClassicTour(false);
          completeClassicTour();
        }}
        onSkip={() => setRunClassicTour(false)}
      />
      <OnboardingTour
        tourType="graph"
        isActive={runGraphTour}
        onComplete={() => {
          setRunGraphTour(false);
          completeGraphTour();
        }}
        onSkip={() => setRunGraphTour(false)}
      />
    </div>
  );
}

export default App;
