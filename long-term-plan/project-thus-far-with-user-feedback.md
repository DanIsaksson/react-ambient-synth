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

## 10. Next Session: Phase 4

**Phase 4: Deep Synthesis** is ready to begin.

Focus areas:
1. Granular synthesis engine
2. Physical modeling (Karplus-Strong refinement, modal synthesis)
3. High-quality field recordings for Atmosphere Engine
4. Sample-based texture generation

Audio routing will be addressed in **Phase 6: The Nervous System**.

---
*Document maintained for context continuity across sessions.*

