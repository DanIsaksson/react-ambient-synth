# Project Status & Feedback Log

**Date**: November 25, 2025
**Version**: 0.6 (Pre-Alpha)
**Repository**: https://github.com/DanIsaksson/react-ambient-synth

## 1. Project Overview
**Ambient Flow** is a web-based generative audio workstation. It aims to combine the ease of use of an "ambient noise generator" with the depth and flexibility of a modular synthesizer.

### Current Architecture
-   **Frontend**: React + TypeScript + Vite.
-   **State Management**: Zustand (`nodeGraphStore`, `modulationStore`).
-   **Audio Engine**: Web Audio API + AudioWorklet (`main-processor.js`).
-   **Visuals**: Three.js (React Three Fiber) for background visualizations.
-   **UI Library**: Tailwind CSS + React Flow (for the graph).

## 2. Work Completed Thus Far
-   **Core Audio Engine**: Implemented a singleton `AudioEngine` class managing Context and Worklet.
-   **Modular DSP**: Created a `main-processor` capable of handling dynamic node graphs.
-   **Scenes**: Implemented "Classic Mode" scenes (Gravity Phasing, Euclidean Groove) with hardcoded logic.
-   **Node Editor**: Integrated React Flow for a visual patch editor.
-   **Custom Nodes**: Added Oscillator, Filter, Envelope, Sequencer, Karplus-Strong, and Physics nodes.
-   **Modulation**: Basic infrastructure for Global LFOs and Macro Knobs.

## 3. User Feedback & "The Big Issues"

### 🚨 Critical Issues
1.  **Graph Mode Audio Bleed**:
    -   *Issue*: When switching to Graph Mode, the "Classic Mode" background noise/scenes continue to play.
    -   *Diagnosis*: The `AudioEngine` does not silence or unmount the active `Scene` when the view changes. The Graph engine is running *on top* of the existing scene.
2.  **Graph Interaction Deadlock**:
    -   *Issue*: Nodes in the graph cannot be manipulated, moved, or interacted with.
    -   *Diagnosis*: Likely a CSS Z-Index issue (overlay blocking clicks) or React Flow configuration error (`nodesDraggable`, `elementsSelectable`).
3.  **Sonic Flatness**:
    -   *Issue*: "Classic Mode" sounds (e.g., Cafe) lack depth and distinction. They sound like generic filtered noise rather than distinct environments.
    -   *Feedback*: "Not playful / inventive enough."

### 🎨 Visual & UX Feedback
1.  **UI Aesthetics**:
    -   *Current*: "Ugly buttons", rudimentary look.
    -   *Desired*: "Clean, musically inspired curves", "neon lighting", "physical interface" feel. Short-gradient lines that light up.
2.  **Rudimentary Graph**:
    -   *Current*: Looks like a basic dev tool.
    -   *Desired*: A fully implemented, powerful expansion of the app.

### 🏗️ Architectural Feedback
1.  **Engine Split**:
    -   *Requirement*: Separation of concerns. "Pure Noise" (Brownian, Environmental) needs to be distinct from "Melodic/Rhythmic" (8-bit, Notes).
    -   *Proposal*: Potentially separate Audio Engines or a strict Scene Manager that completely swaps DSP graphs.

## 4. Recent Development Progress (November 24-25, 2025)

### ✅ Phase 1: The Schism (Engine Re-Architecture) - COMPLETED

**Goal**: Split the monolithic `AudioEngine` into a dual-engine architecture to separate concerns and improve maintainability.

#### Changes Implemented:
1. **Directory Restructuring**:
   - Reorganized `src/audio/` into logical subdirectories:
     - `src/audio/engine/`: Core coordinators (`AudioCore`, `AtmosphereEngine`, `SynthEngine`, `MasterBus`, `GraphManager`)
     - `src/audio/nodes/`: DSP modules organized by type (`sources/`, `effects/`, `core/`)
     - `src/audio/worklets/`: AudioWorklet processor
   - Moved `AudioModule`, `RingBuffer`, `SharedMemoryBridge` to `nodes/core/`

2. **Dual-Engine Architecture**:
   - **`AudioCore`**: Top-level coordinator managing lifecycle and composition
   - **`AtmosphereEngine`**: Manages "Classic Mode" textures and continuous audio
     - Internally owns and chains: `DeepEndModule` → `PulseModule` → `XYDriftModule` → `LorenzChaosModule` → `AtmosphereModule`
     - Handles scene management and parameter routing
   - **`SynthEngine`**: Manages "Graph Mode" via AudioWorklet communication
   - **`MasterBus`**: Final mixing stage with dynamics compression/limiting

3. **Command Pattern for Audio Communication**:
   - Defined `AudioMessage` interface: `{ target, action, payload }`
   - Updated `main-processor.js` to handle new message format
   - All UI-to-Worklet communication now uses strict message protocol

4. **State Management with Zustand**:
   - Created `useAudioStore` for centralized audio state
   - Actions: `init()`, `togglePlay()`, `setVolume()`, `setScene()`, `setAtmosphereParam()`, `sendMessage()`
   - Replaced imperative `audioEngine` calls throughout the codebase

5. **Component Migration**:
   - Refactored `App.tsx` to use `useAudioStore` (removed all direct `audioEngine` references)
   - Updated `VisualizerContainer.tsx` to access state via `audioCore.getAtmosphere()`
   - Updated `GravityScene3D.tsx` to use new architecture
   - Migrated module instantiation from `App.tsx` into `AtmosphereEngine`

6. **Cleanup**:
   - Deleted obsolete `AudioEngine.ts`
   - Fixed all import paths and type-only imports

**Status**: Build verified, all core components migrated ✓

---

### ✅ Phase 2: The Tactile Graph (Graph Mode 2.0) - COMPLETED

**Goal**: Transform the static graph editor into a "physical, bioluminescent workspace" with proper layering, custom styling, and visual feedback.

#### Changes Implemented:

**1. Z-Index & Layer Separation** ✓:
   - Restructured `App.tsx` into distinct, mutually exclusive layers:
     - Layer 0 (z-0): `Scene3D` background (always present)
     - Layer 1 (z-10): `NodeEditor` full-screen workspace (Graph Mode only, **fully opaque**)
     - Layer 2 (z-20): HUD overlay (**hidden in Graph Mode**)
   - Fixed critical bug: HUD overlay was always visible and covering the React Flow canvas
   - Added `onExitGraphMode` prop to NodeEditor for clean mode switching

**2. NodeEditor Layout Fixes** ✓:
   - Fixed React Flow canvas not rendering due to flexbox issues:
     - Added `flex: '1 1 0%'` and `minHeight: 0` (crucial for flex children to shrink)
     - ReactFlow component now uses absolute positioning within its container
     - Canvas wrapper has explicit `background: '#0a0a0f'` for visibility
   - Converted from Tailwind classes to inline styles for reliability
   - Structure: HeaderBar (48px) → Canvas (flex: 1) → ModuleDock (auto)

**3. ModuleDock (Horizontal Node Toolbar)** ✓:
   - Replaced vertical sidebar with compact horizontal dock at bottom
   - 7 module tiles: OSC, STR (Karplus), FLT, ENV, SEQ, PHY, OUT
   - Each tile: 52x52px with inline SVG icons (fixed sizing to prevent explosion)
   - Hover effects: glow, scale, color change based on module type
   - Drag-and-drop with visual feedback (opacity change, scale down)

**4. Drag & Drop to Canvas** ✓:
   - Fixed drop not registering: moved `onDragOver`/`onDrop` to wrapper div (required by React Flow)
   - Data transfer: `application/reactflow` MIME type with node type as payload
   - Debug logging added for troubleshooting
   - Position calculation via `screenToFlowPosition()`

**5. Custom Node Architecture** ✓:
   - `BaseNode.tsx`: Glassmorphism wrapper with type-based colors, selection glow, flexible handles
   - All nodes ported: `OscillatorNode`, `FilterNode`, `EnvelopeNode`, `SequencerNode`, `KarplusNode`, `PhysicsNode`, `OutputNode`
   - `HANDLE_PRESETS` for consistent handle configurations

**6. Living Cables (SignalEdge)** ✓:
   - Multi-layer cable rendering with SVG gradients and glow filters
   - Animated signal packets traveling along bezier path
   - Support for different signal types (audio/control/gate) with varying colors

**7. Button Styling Upgrades** ✓:
   - OscillatorNode: Waveform selector buttons (sin/squ/saw/tri) with glow effects
   - FilterNode: Filter type buttons (LP/HP/BP) with purple accent
   - KarplusNode: Pluck button with gradient background and scale animation
   - Pattern: Active state uses `boxShadow` with inset glow + border color change

**8. HeaderBar** ✓:
   - Minimal top bar with "AMBIENT FLOW" logo (pulsing cyan dot)
   - "Graph Mode" status indicator
   - "← Classic Mode" button to exit graph mode
   - Clean gradient background

**9. Canvas Visibility Fix (Critical Bug)** ✓:
   - **Root Cause**: Flexbox height conflict - canvas container had both `flex: '1 1 0%'` AND `height: '100%'`
   - **Investigation**: Created detailed markdown docs in `long-term-plan/investigation/`
   - **Solution Applied**:
     - Main container: Changed to `100vw`/`100vh` with `position: absolute`
     - Canvas container: Simplified to `flex: 1`, removed conflicting `height: 100%`
     - ReactFlow: Added explicit `style={{ width: '100%', height: '100%' }}`
   - **Result**: Canvas now visible, interactive, and properly fills viewport

#### Technical Learnings:
- **Flexbox gotcha**: Children with `flex: 1` won't expand unless `minHeight: 0` is set (overrides `min-height: auto`)
- **Height conflict**: Never combine `flex-basis: 0%` with `height: 100%` on the same element
- **Viewport units**: Use `100vw`/`100vh` instead of `100%` when parent height is uncertain
- **React Flow requirement**: Drop handlers must be on the ReactFlow component itself (not wrapper) for proper event handling
- **SVG icon sizing**: Inline `width`/`height` attributes are more reliable than CSS classes
- **Layer management**: Conditional rendering (`viewMode === 'classic' && ...`) is cleaner than z-index battles

#### Deferred to Later Phases:
- [ ] Implement real-time signal level visualization in nodes (Phase 6)
- [ ] Add AudioWorklet metering for visual feedback (Phase 6)
- [ ] Wire audio routing through graph connections (Phase 6: The Nervous System)
- [ ] Add more sophisticated edge animations based on signal type

---

## 5. Next Steps

### 🚀 NEXT: Phase 3 - Neon-Organic UI (Visual Overhaul)

**Concept**: "Bioluminescent Hardware" - Moving from web app aesthetics to sci-fi hardware.

**Key Deliverables**:
1. **Design System**:
   - Obsidian backgrounds (`#050505` to `#121212`)
   - Glass panels with `backdrop-filter: blur(12px)`
   - Neon accents: Signal Green `#00ff88`, Control Cyan `#00ccff`, Warning Red `#ff0055`
   - Typography: Orbitron/Syncopate for headers, Share Tech Mono for labels

2. **Component Library**:
   - `NeonKnob`: SVG potentiometer with inertia/throw physics (Framer Motion)
   - `PlasmaSlider`: Glowing thumb on dark track with liquid fill
   - `HolographicButton`: Ghostly idle → glitch hover → solid neon active

3. **Interaction Design**:
   - Reactive lighting (borders pulse with master output)
   - Micro-interactions (hover lift, click press, connection sparks)
   - Ghost-turn knobs showing modulation sources

4. **Performance**:
   - `will-change: transform` on active controls
   - Canvas fallback for glow effects if box-shadows too expensive

**Reference**: See `long-term-plan/step-by-step-phases/3-Neon-Organic-UI.md`

---

### Future Phases (from `new-plan.md`):
| Phase | Name | Focus |
|-------|------|-------|
| 4 | Deep Synthesis | Granular, physical modeling, field recordings |
| 5 | Rhythmic Intelligence | Euclidean sequencers, polyrhythms, probability |
| 6 | The Nervous System | **Audio wiring**, LFOs, macro mapping |
| 7 | Spatial Audio | Binaural panning, distance, doppler |
| 8 | The Library | Presets, serialization, sharing |
| 9 | The Stage | XY pads, mute groups, MIDI |
| 10 | The Polish | WASM optimization, mobile, onboarding |

## 6. Current State Summary

**Date Updated**: November 25, 2025

| Component | Status | Notes |
|-----------|--------|-------|
| Audio Engine Architecture | ✅ Complete | Dual-engine (Atmosphere + Synth) |
| Graph Mode Layout | ✅ Complete | Full-screen, opaque, viewport units |
| React Flow Canvas | ✅ Complete | Visible, interactive, zoomable |
| ModuleDock | ✅ Complete | Horizontal toolbar with 7 modules |
| Drag & Drop | ✅ Verified | Nodes drop onto canvas correctly |
| Node Connections | ✅ Working | Edges can be drawn between handles |
| Custom Nodes | ✅ Complete | All nodes ported to BaseNode wrapper |
| SignalEdge | ✅ Complete | Animated cables with glow effects |
| Classic Mode | ✅ Working | Separate from Graph Mode cleanly |
| Audio Routing | 🚧 Phase 6 | GraphManager exists but DSP not connected |

## 7. Key Files Modified This Session

```
src/App.tsx                          - Layer separation, mode switching
src/components/nodegraph/
  ├── NodeEditor.tsx                 - Flexbox layout, exit button, drop handlers
  ├── NodeSidebar.tsx                - ModuleDock with inline SVG icons
  ├── nodes/
  │   ├── BaseNode.tsx               - Glassmorphism wrapper
  │   ├── OscillatorNode.tsx         - Button styling
  │   ├── FilterNode.tsx             - Button styling
  │   └── KarplusNode.tsx            - Pluck button styling
  └── edges/
      └── SignalEdge.tsx             - Animated cable rendering
```

## 8. Conclusion

**Phase 1 (The Schism)** ✅, **Phase 2 (The Tactile Graph)** ✅, and **Phase 3 (Neon-Organic UI)** ✅ are now **complete**.

The Graph Mode has been transformed from a broken, unusable debug tool into a clean, interactive workspace:
- ✅ Full-screen layout with proper viewport coverage
- ✅ Compact horizontal module dock with drag-and-drop
- ✅ Glassmorphism node cards with type-based colors
- ✅ Animated signal cables (SignalEdge)
- ✅ Clean mode switching between Classic and Graph modes
- ✅ Canvas visibility bug resolved (flexbox height conflict)

**User Verified**: Canvas is visible, interactive, and nodes can be dragged/dropped.

---

## 9. Phase 3: Neon-Organic UI - COMPLETED

**Date**: November 25, 2025

### Changes Implemented:

**1. Design System Foundation** ✓:
- Installed Tailwind CSS v4 with `@tailwindcss/postcss`
- Installed Framer Motion for physics-based animations
- Added Google Fonts: Orbitron (display), Share Tech Mono (labels), Inter (body), Rajdhani (alt)
- Created comprehensive `@theme` configuration in `index.css`:
  - Obsidian color palette (`#050505` - `#252530`)
  - Neon accent colors (green `#00ff88`, cyan `#00ccff`, red `#ff0055`, purple `#a855f7`, orange `#ff8800`)
  - Custom box shadows (`shadow-neon-green`, `shadow-neon-cyan-lg`, etc.)
  - Keyframe animations (`pulse-glow`, `glow-breathe`, `flicker`, `signal-flow`)

**2. Component Library Created** ✓:
- **`NeonKnob`**: SVG potentiometer with drag-to-rotate, velocity-based glow intensity, modulation ghost-turn visualization
- **`PlasmaSlider`**: Horizontal/vertical slider with liquid plasma fill, glowing thumb, spring physics
- **`HolographicButton`**: Multi-state button with holographic shimmer, glitch hover effect, ripple on click, scan-line active state
- **`GlassPanel`**: Glassmorphism container with backdrop blur, collapsible headers, accent border colors

**3. ControlPanel Refactored** ✓:
- Replaced all standard HTML controls with Neon-Organic components
- Module cards now use `GlassPanel` with accent colors per module type
- Sliders replaced with `PlasmaSlider`
- Knobs replaced with `NeonKnob`
- Buttons replaced with `HolographicButton`

**4. App Header/Footer Updated** ✓:
- Title uses Orbitron font with neon cyan glow
- Header buttons are `HolographicButton` components
- Footer status uses monospace font with neon accents

**5. Legacy Compatibility** ✓:
- `MacroKnob` refactored as thin wrapper around `NeonKnob`
- CSS variables preserved for existing code compatibility

### New Files Created:
```
src/components/controls/
├── index.ts                 - Export barrel for component library
├── NeonKnob.tsx            - SVG potentiometer with physics
├── PlasmaSlider.tsx        - Liquid-fill slider
├── HolographicButton.tsx   - Multi-state holographic button
└── GlassPanel.tsx          - Glassmorphism container

tailwind.config.js          - Tailwind v4 theme (kept for reference)
postcss.config.js           - PostCSS with @tailwindcss/postcss
```

### Technical Highlights:
- **Tailwind v4 Migration**: Uses `@import "tailwindcss"` and `@theme` CSS-based configuration
- **Framer Motion Integration**: Spring physics for knob/slider interactions, layout animations for panels
- **Performance**: Components use refs for high-frequency updates (>5/sec) to avoid React re-renders
- **Accessibility**: All controls support keyboard interaction via pointer events

---

## 10. Phase 4: Deep Synthesis - COMPLETED

**Date**: November 25, 2025

### Changes Implemented:

**1. Sample Management System** ✓:
- Created `SampleManager` class for loading/caching AudioBuffers
- Built-in sample library with textures, impulse responses, and oneshots
- Support for streaming large field recordings
- Test sample generation (pink noise) for development

**2. Granular Synthesis Engine** ✓:
- Created `GranularProcessor` AudioWorklet with:
  - Hanning windowed grains (10-500ms)
  - Position, spray, density, size, pitch controls
  - Reverse probability for texture variation
  - Up to 50 concurrent grains (performance budget)
- Created `GranularNode` main-thread wrapper with full API

**3. Enhanced Karplus-Strong** ✓:
- Added **Stiffness allpass filter** for metallic string simulation
- Improved damping with brightness control
- Added DC blocker to prevent offset accumulation
- Fractional delay interpolation for pitch accuracy
- Trigger-based excitation system

**4. Modal Synthesis (Physical Modeling)** ✓:
- Added `modal` node type to main processor
- Material presets: **Glass** (inharmonic, long ring), **Wood** (harmonic, short decay), **Metal** (clustered partials)
- 8 resonant modes per resonator (performance budget)
- Biquad bandpass filter bank with Q-factor control
- Strike/ping excitation with envelope

**5. Convolution Reverb** ✓:
- Created `ConvolutionReverbNode` using native ConvolverNode
- Wet/dry mix with equal-power crossfade
- Pre-delay up to 500ms
- High/low frequency damping shelves
- Built-in IR presets: Cathedral, Small Room, Cave, Plate
- Synthetic IR generation for testing

**6. Graph UI Nodes** ✓:
- Created `TextureNode` (granular) with cloud visualization
- Created `ResonatorNode` (modal) with mode spectrum display
- Added to module dock: TXT (cyan), RES (purple)
- Material selector buttons for resonator

### New Files Created:
```
src/audio/engine/
├── SampleManager.ts           - Audio buffer management

src/audio/worklets/
├── granular-processor.js      - Granular synthesis DSP

src/audio/nodes/sources/
├── GranularNode.ts            - Granular synth wrapper

src/audio/nodes/effects/
├── ConvolutionReverbNode.ts   - Convolution reverb

src/components/nodegraph/nodes/
├── TextureNode.tsx            - Granular UI node
├── ResonatorNode.tsx          - Modal synthesis UI node
```

### Modified Files:
```
src/audio/worklets/main-processor.js  - Enhanced Karplus-Strong, added Modal
src/components/nodegraph/NodeEditor.tsx - Registered new nodes
src/components/nodegraph/NodeSidebar.tsx - Added TXT/RES to dock
```

### Technical Highlights:
- **Performance budgets enforced**: Max 50 grains, 8 modes per resonator
- **All DSP in AudioWorklet**: No main-thread signal processing
- **Hanning windows**: Click-free grain boundaries
- **Biquad filters**: CPU-efficient modal synthesis

### Integration Notes:
- Granular engine requires sample files in `/public/samples/`
- Convolution reverb requires IR files in `/public/samples/impulses/`
- For testing without files, use `generateTestSample()` and `generateSyntheticIR()`

---

## 11. Phase 5: Rhythmic Intelligence - COMPLETED

**Date**: November 25, 2025

### Changes Implemented:

**1. Euclidean Rhythm Algorithm** ✓:
- Bjorklund's algorithm for distributing pulses evenly over steps
- Pattern rotation for groove variations
- Preset patterns: Tresillo (3,8), Cinquillo (5,8), Bossa Nova (5,16), etc.
- Pattern analysis utilities (density, intervals, pulse indices)

**2. TriggerEvent System** ✓:
- `TriggerEvent` interface for `note_on`/`note_off`/`trigger` events
- `SequenceStep` with per-step probability and velocity
- `StepCondition` for conditional logic (first, every_n, fill)
- Type definitions for polyrhythmic configurations

**3. Lookahead Scheduler** ✓:
- 25ms interval checking 100ms into the future
- Sample-accurate scheduling using `AudioContext.currentTime`
- Multi-track support with independent clocks (polyrhythms)
- Swing control for groove feel
- Beat/bar clock events for visualization sync

**4. EuclideanSequencerNode UI** ✓:
- Circular polar visualization with rotating playhead
- Steps/Pulses/Rotation controls
- Preset buttons (Tresillo, Cinquillo, Bossa Nova)
- Per-step probability slider
- BPM tempo control

**5. Polyrhythmic Support** ✓:
- Each track has independent `stepsPerBeat` setting
- LCM calculation for cycle length
- Phase relationship evolution (Steve Reich style)

### New Files Created:
```
src/audio/rhythm/
├── index.ts           - Module exports
├── euclidean.ts       - Bjorklund's algorithm + presets
├── types.ts           - TriggerEvent, SequenceStep, etc.
└── Scheduler.ts       - Lookahead scheduler class

src/components/nodegraph/nodes/
└── EuclideanNode.tsx  - Circular sequencer UI
```

### Technical Highlights:
- **Bjorklund's algorithm**: O(n) distribution using Bresenham approach
- **Lookahead scheduling**: Prevents main-thread lag from affecting timing
- **Probability per step**: Humanizes patterns with ghost notes
- **Polyrhythm math**: `calculatePolyCycle()` for LCM of time signatures

### Module Dock Addition:
- **EUC** (orange) - Euclidean rhythm sequencer

---

## 12. Phase 6: The Nervous System - COMPLETED

**Date**: November 25, 2025

### Changes Implemented:

**1. ModulationSystem Class** ✓:
- Central routing system: Source -> GainNode (Amount) -> Target AudioParam
- Source and target registration/management
- Connection management with amount control
- Transfer curves: linear, exponential, logarithmic, S-curve
- Visualization state export for UI

**2. LFO Node (Audio)** ✓:
- Multiple waveforms: sine, triangle, square, sawtooth, random (S&H)
- Frequency range: 0.01 Hz to 100 Hz
- Bipolar (-1 to +1) or unipolar (0 to 1) output
- Depth control
- Real-time value getter for visualization

**3. Noise Node (Perlin/Simplex)** ✓:
- Custom 1D Simplex noise implementation
- Fractal/octave noise for organic movement
- Speed, depth, smoothness controls
- "Wind-like" drift modulation source
- Reseed capability for varied patterns

**4. LFO UI Node** ✓:
- Real-time canvas waveform visualization
- Animated playhead
- Waveform selector buttons (∿ △ ⊓ ⩘ ⁂)
- Rate and depth sliders

**5. Transfer Curves** ✓:
- `applyTransferCurve()` utility function
- `mapRange()` for value mapping with curves
- Supports: linear, exponential, logarithmic, S-curve

### New Files Created:
```
src/audio/modulation/
├── index.ts              - Module exports
├── ModulationSystem.ts   - Central routing system
├── LFONode.ts            - LFO audio source
└── NoiseNode.ts          - Perlin noise source

src/components/nodegraph/nodes/
└── LFONode.tsx           - LFO UI component
```

### Module Dock Addition:
- **LFO** (violet) - Low frequency oscillator

### Technical Highlights:
- **GainNode routing**: Amount control via Web Audio API native nodes
- **1D Simplex noise**: Smooth gradient noise for organic modulation
- **Canvas visualization**: 60fps waveform animation
- **Transfer curves**: Musical parameter mapping

### Pending (deferred to polish phase):
- Modulation ring visualization on knobs
- Matrix view UI for power users

---

## 13. Phase 7: Spatial Audio - COMPLETED

**Date**: November 25, 2025

### Changes Implemented:

**1. SpatialNode Wrapper Class** ✓:
- HRTF binaural panning (Head-Related Transfer Function)
- Distance model selection: linear, inverse, exponential
- Reference distance and rolloff factor controls
- Cone directivity for spotlighting sounds
- Velocity tracking for Doppler effect

**2. Air Absorption Filter** ✓:
- Distance-based lowpass filtering
- Simulates high-frequency absorption by air
- Configurable absorption coefficient
- Exponential frequency rolloff: `20kHz * exp(-dist * coef)`

**3. Manual Doppler Effect** ✓:
- Velocity calculation from position deltas
- Relative velocity projection onto source-listener axis
- Pitch shifting via `playbackRate` modulation
- Classic Doppler formula: `f' = c / (c - v_s)`

**4. AudioListenerManager** ✓:
- Syncs Web Audio `AudioListener` with Three.js camera
- Position and orientation tracking
- Velocity calculation for Doppler
- Auto-update loop option
- Manages registered SpatialNodes

**5. Spatial3DNode UI Component** ✓:
- Interactive XY pad for horizontal positioning
- Height (Y) slider for vertical placement
- Distance model selector (LIN/INV/EXP)
- Rolloff and air absorption controls
- Real-time distance display
- Visual listener/source indicators

### New Files Created:
```
src/audio/spatial/
├── index.ts              - Module exports
├── SpatialNode.ts        - 3D panner wrapper
└── AudioListenerManager.ts - Camera sync

src/components/nodegraph/nodes/
└── Spatial3DNode.tsx     - 3D positioning UI
```

### Module Dock Addition:
- **3D** (sky blue) - Spatial audio positioning

### Technical Highlights:
- **HRTF Panning**: Enables above/behind/front localization
- **Air Absorption**: High-frequency rolloff for realistic distance
- **Doppler Effect**: Manual implementation (native deprecated)
- **Listener Sync**: Camera movement affects audio spatialization

---

## 14. Phase 8: The Library - COMPLETED

**Date**: November 25, 2025

### Changes Implemented:

**1. PatchData Types** ✓:
- `PatchMeta`: name, author, version, category, tags, timestamps
- `GraphData`: React Flow nodes and edges
- `AudioData`: per-node parameter values
- `GlobalState`: master volume, BPM
- `ModulationData`: LFO and macro configurations
- Version compatibility with semantic versioning

**2. PresetManager Class** ✓:
- `createPatch()`: Serialize current state to PatchData
- `compressToURL()` / `decompressFromURL()`: LZ-String compression
- `generateShareURL()`: Create shareable links
- `saveToLocalStorage()` / `loadFromLocalStorage()`: Persistence
- `getUserPresets()` / `saveUserPreset()` / `deleteUserPreset()`: User management
- `exportToFile()` / `importFromFile()`: JSON file I/O
- `migrate()`: Version migration for backwards compatibility
- `validate()`: PatchData structure validation

**3. Factory Presets** ✓:
- **Deep Slumber** (sleep): Brown noise + lowpass drone
- **Pulse Focus** (focus): Euclidean rhythms + filtered pulses
- **Space Drift** (scifi): Chaos oscillators + spatial movement
- **Forest Morning** (nature): Granular textures + wind drift
- **Resonant Strings** (ambient): Karplus-Strong + modal synthesis
- **Chaos Engine** (experimental): Multiple LFOs interference

**4. Preset Browser UI** ✓:
- Category filtering (All, Sleep, Focus, Ambient, Sci-Fi, Nature, Experimental, User)
- Preset cards with metadata display
- Load, Share, Delete actions
- Save current patch dialog
- Import from file
- Animated modal with Framer Motion

### New Files Created:
```
src/presets/
├── index.ts           - Module exports
├── types.ts           - PatchData interfaces
├── PresetManager.ts   - Core serialization class
└── factory/
    └── index.ts       - 6 factory presets

src/components/
└── PresetBrowser.tsx  - UI component
```

### Dependencies Added:
- `lz-string` + `@types/lz-string` for URL compression

### Technical Highlights:
- **LZ-String compression**: ~10KB JSON → ~2KB URL-safe string
- **Version migration**: Future-proof with semantic versioning
- **Local storage**: Autosave and user preset persistence
- **File export**: `.ambientflow.json` format

---

## 15. Pre-Phase 9 Debugging Session

**Date**: November 25, 2025

Before moving to Phase 9, a debugging session was conducted to address reported issues.

### Confirmed Fixed ✅
- **8-bit Dungeon Scene**: Case label mismatch fixed in `App.tsx`
- **Handle Direction Arrows**: Arrow indicators now show input/output direction on node handles

### Implemented Improvements ✅
- **Gravity Phasing Visualizer**: Created `FloatingVisualizer.tsx` - draggable, fullscreen-capable window
- **Play/Stop in Graph Mode**: Added button to `NodeEditor.tsx` header

### Critical Bug Identified 🐛

**Graph Mode produces no audio** due to a race condition:

| Step | What Happens | Problem |
|------|--------------|---------|
| 1 | `NodeEditor` mounts | `init()` called (async) |
| 2 | Second `useEffect` runs immediately | `GraphManager.syncGraph()` called |
| 3 | Worklet still loading | `sendMessage()` → workletNode is NULL |
| 4 | Graph data lost | Worklet never receives node/edge data |

**Root Cause**: `init()` is async but not awaited. Graph sync fires before AudioWorklet is loaded.

**Fix Required** (2 files):
1. `NodeEditor.tsx`: Add `isAudioReady` state gate
2. `SynthEngine.ts`: Add message queue + flush mechanism

**Investigation Documents**:
```
long-term-plan/investigation-graph-audio/
├── 00-summary.md          # Root cause analysis
├── 01-fix-plan.md         # Proposed solutions
├── 02-audio-chain-trace.md # Signal flow diagram
└── 03-code-changes.md     # Exact code modifications
```

### Deferred Items
- Connection helper tooltip (shows compatible handles while dragging)
- Background visualizer pause when floating window shown

---

## 16. Graph Mode Critical Bug Fixes - COMPLETED

**Date**: November 25, 2025

### Issues Addressed

This session focused on making Graph Mode fully functional by fixing multiple critical bugs.

---

### ✅ Issue #1: Graph Mode Audio Race Condition - FIXED

**Problem**: Graph produced no audio because `GraphManager.syncGraph()` was called before AudioWorklet finished loading.

**Solution Implemented**:
1. **`NodeEditor.tsx`**: Added `isAudioReady` state gate that waits for audio initialization
2. **`SynthEngine.ts`**: Added message queue that buffers messages until worklet is ready, then flushes
3. **`useAudioStore.ts`**: Added separate `toggleGraph()` and `toggleClassic()` actions for independent engine control

**Key Code Pattern**:
```typescript
// NodeEditor.tsx
const [isAudioReady, setIsAudioReady] = useState(false);

useEffect(() => {
    init().then(() => setIsAudioReady(true));
}, []);

useEffect(() => {
    if (isAudioReady) {
        GraphManager.syncGraph(nodes, edges);
    }
}, [nodes, edges, isAudioReady]);
```

---

### ✅ Issue #2: Multiple Output Nodes Not Working - FIXED

**Problem**: Only the first output node received audio; additional outputs were silent.

**Root Cause**: `main-processor.js` searched for a single `outputNodeId` and used `break` after finding the first.

**Solution**: Changed to collect ALL output node IDs and sum audio to each:
```javascript
// Before: Single output
const outputNodeId = this.nodes.find(n => n.type === 'output')?.id;

// After: Multiple outputs
const outputNodeIds = [];
for (const [id, node] of this.nodes.entries()) {
    if (node.type === 'output') outputNodeIds.push(id);
}
// Sum audio to all output nodes
```

---

### ✅ Issue #3: Node Delete Button - IMPLEMENTED

**Problem**: No way to remove nodes from the graph.

**Solution**:
1. **`nodeGraphStore.ts`**: Added `deleteNode(nodeId)` action that removes node AND connected edges
2. **`BaseNode.tsx`**: Added `nodeId` prop and delete button (X icon) in header
3. **All node components**: Updated to pass `nodeId={id}` to BaseNode

**Delete button styling**: Red hover state, positioned in node header, stops event propagation to prevent node selection.

---

### 🔧 Issue #4: Slider Values Reset After Change - DEEP INVESTIGATION

**Problem**: When user moved a slider, the value updated briefly then immediately reset to the original value.

#### Investigation Process

Created detailed investigation documents in `long-term-plan/investigation/`:
- `00-overview-slider-persistency.md` - Problem statement and hypothesis tree
- `01-root-cause-analysis.md` - Deep dive into the feedback loop
- `02-attempted-fixes.md` - Log of solutions tried
- `03-final-solution.md` - Working fix documentation

#### Root Cause Analysis

**The Smoking Gun** (from console logs):
```
updateNodeData called → freq: 656 ✓
After update, node data: freq: 656 ✓
OscillatorNode Render: freq: 656 ✓
...
updateNodeData called → freq: 220 ← SECOND CALL WITH OLD VALUE
```

Both calls had identical stack traces pointing to `handleFreqChange`. The slider's `onChange` was firing TWICE.

#### Why This Happened

**Controlled Input Feedback Loop**:
1. User drags slider to 656
2. `onChange` fires → `updateNodeData({freq: 656})`
3. Store updates → component re-renders
4. React updates DOM: `input.value = 656`
5. Browser detects programmatic value change
6. Browser fires another `onChange` with stale DOM value
7. `updateNodeData({freq: 220})` → value resets

#### Attempted Fixes (All Failed)

| Fix | Theory | Result |
|-----|--------|--------|
| Protect `onNodesChange` from replace | ReactFlow overwriting | ❌ Still reset |
| Use callback form of `set()` | Zustand stale state | ❌ Still reset |
| Direct store subscription | ReactFlow stale props | ❌ Still reset |
| Local state + drag tracking | Controlled input loop | ❌ Still reset |

#### Final Solution: `nodrag` CSS Class

The user discovered that adding `nodrag` class to the slider input prevents ReactFlow from intercepting mouse events, which was the actual root cause:

```tsx
<input
    type="range"
    className="nodrag nopan w-full h-1.5 ..."
    value={freq}
    onChange={handleFreqChange}
/>
```

**Also added** `nodrag` to `BaseNode.tsx` content area to prevent all interactive elements from being affected:
```tsx
<div className={`nodrag cursor-default ${compact ? 'p-2' : 'p-3'}`}>
    {children}
</div>
```

#### Store Subscription Pattern

All node components were updated to read directly from Zustand store instead of ReactFlow props:

```tsx
// Before (stale props from ReactFlow)
const freq = data.freq ?? 440;

// After (direct store subscription)
const freq = useNodeGraphStore(state => 
    state.nodes.find(n => n.id === id)?.data?.freq ?? 440
);
```

**Nodes updated**: OscillatorNode, FilterNode, EnvelopeNode, LFONode, NoiseNode, PhysicsNode, ResonatorNode, TextureNode, EuclideanNode, SequencerNode, KarplusNode, Spatial3DNode

---

### ✅ Issue #5: Cursor Icon Shows Grab Across Entire Node - FIXED

**Problem**: The cursor showed a "grab" hand icon across the entire node, not just the draggable header.

**Solution**: Applied cursor styling in `BaseNode.tsx`:

```tsx
{/* Header - drag handle */}
<div className={`... cursor-grab active:cursor-grabbing`}>

{/* Content area */}
<div className={`nodrag cursor-default ...`}>
```

| Area | Cursor Style |
|------|--------------|
| Header (title bar) | `cursor-grab` → `cursor-grabbing` when dragging |
| Content (controls) | `cursor-default` (normal pointer) |

This applies to all nodes since they all extend `BaseNode`.

---

### Technical Learnings

1. **ReactFlow `nodrag` class**: Critical for interactive elements inside nodes. Without it, ReactFlow intercepts mouse events for drag handling.

2. **`nopan` class**: Prevents canvas panning when interacting with elements.

3. **Direct store subscription**: Bypasses ReactFlow's prop passing which can have stale data during rapid updates.

4. **Zustand `set()` callback form**: Always use `set((state) => ...)` instead of `set({ nodes: get().nodes... })` to avoid stale state during rapid updates.

5. **BaseNode content area**: Wrapping children in `nodrag` container is cleaner than adding class to every interactive element.

---

### Files Modified This Session

```
src/store/nodeGraphStore.ts           - deleteNode action, callback form of set()
src/audio/engine/SynthEngine.ts       - Message queue + flush mechanism
src/audio/worklets/main-processor.js  - Multiple output node support
src/components/nodegraph/NodeEditor.tsx - isAudioReady gate, play/stop button
src/components/nodegraph/nodes/BaseNode.tsx - Delete button, nodrag content area
src/components/nodegraph/nodes/*.tsx  - All nodes: direct store subscription, nodeId prop
```

### Investigation Documents Created

```
long-term-plan/investigation/
├── 00-overview-slider-persistency.md
├── 01-root-cause-analysis.md
├── 02-attempted-fixes.md
└── 03-final-solution.md
```

---

## 17. Current Status Summary

**Date Updated**: November 25, 2025

| Component | Status | Notes |
|-----------|--------|-------|
| Graph Mode Audio | ✅ Fixed | isAudioReady gate + message queue |
| Multiple Output Nodes | ✅ Fixed | Sums to all outputs |
| Node Delete Button | ✅ Implemented | X button in node header |
| Slider Persistence | ✅ Fixed | `nodrag` class + direct store subscription |
| Play/Stop in Graph Mode | ✅ Working | Header button toggles graph audio |
| Cursor Styling | ✅ Fixed | Grab only on header, default on content |
| Real Audio Meters | 🔜 Deferred | Placeholder animation for now |

---

## 18. Next Session: Phase 9 - The Stage

**Phase 9: The Stage** is ready to begin. Graph Mode is now fully functional.

### Phase 9 Deliverables:
1. **Performance Mode UI** - Full-screen performance view
2. **XY Pad Macro Controls** - 2D parameter control surfaces
3. **Mute Groups** - Group nodes for quick muting/unmuting
4. **Quantized Launching** - Sync mute toggles to beat/bar
5. **MIDI Integration** - Web MIDI API for hardware controllers
6. **Transport Controls** - Play/Stop/BPM/Tap Tempo

### Remaining from earlier phases:
- [ ] Real audio metering (OutputNode, BaseNode)
- [ ] Modulation ring visualization on knobs
- [ ] Matrix view for modulation routing

---
*Document maintained for context continuity across sessions.*

