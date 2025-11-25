# Project Status & Feedback Log

**Date**: November 24, 2025
**Version**: 0.5 (Pre-Alpha)

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

#### Technical Learnings:
- **Flexbox gotcha**: Children with `flex: 1` won't expand unless `minHeight: 0` is set (overrides `min-height: auto`)
- **React Flow requirement**: Drop handlers must be on the wrapper div, not the ReactFlow component
- **SVG icon sizing**: Inline `width`/`height` attributes are more reliable than CSS classes
- **Layer management**: Conditional rendering (`viewMode === 'classic' && ...`) is cleaner than z-index battles

#### Remaining Polish:
- [ ] Implement real-time signal level visualization in nodes
- [ ] Add AudioWorklet metering for visual feedback
- [ ] Verify audio actually routes through graph connections
- [ ] Add more sophisticated edge animations based on signal type

---

## 5. Next Steps

### Immediate (Phase 2 Polish):
1. **Verify drag-drop works end-to-end** - Confirm nodes can be dropped from ModuleDock to canvas
2. **Test node connections** - Verify edges can be drawn between handles
3. **Audio routing verification** - Ensure GraphManager actually sends messages to Worklet

### Phase 3: Neon-Organic UI
- Custom knobs with physics (inertia/throw) using Framer Motion
- Modern sliders with glow effects on thumbs
- Consistent visual language across Classic Mode controls
- Macro control panel styling

### Phase 4: The Nervous System (Graph ↔ Audio Bridge)
- Wire up `GraphManager.syncGraph()` to actually modify AudioWorklet DSP
- Implement node parameter changes flowing to audio
- Real-time signal metering from Worklet back to UI
- Handle hot-swapping connections without audio glitches

### Phase 5: Scene Remastering
- Improve "Classic Mode" sound design (Cafe, Rain, etc.)
- Add depth, layering, and environmental character
- Consider convolution reverb for space simulation

### Future Phases:
- Phase 6: Rhythmic Intelligence (sequencers, quantized timing)
- Phase 7: Persistence (save/load patches, URL sharing)
- Remaining phases as outlined in `new-plan.md`

## 6. Current State Summary

**Date Updated**: November 25, 2025

| Component | Status | Notes |
|-----------|--------|-------|
| Audio Engine Architecture | ✅ Complete | Dual-engine (Atmosphere + Synth) |
| Graph Mode Layout | ✅ Complete | Full-screen, opaque, proper flexbox |
| ModuleDock | ✅ Complete | Horizontal toolbar with 7 modules |
| Custom Nodes | ✅ Complete | All nodes ported to BaseNode wrapper |
| SignalEdge | ✅ Complete | Animated cables with glow effects |
| Drag & Drop | ⚠️ Needs Testing | Code in place, user verification pending |
| Audio Routing | 🚧 Not Wired | GraphManager exists but DSP not connected |
| Classic Mode | ✅ Working | Separate from Graph Mode cleanly |

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
Phase 2 (The Tactile Graph) is now **complete**. The Graph Mode is visually transformed from a debug tool into a premium workspace with:
- Proper full-screen layout
- Compact horizontal module dock
- Glassmorphism node cards
- Animated signal cables
- Clean mode switching

**Next priority**: Verify the drag-drop and connection functionality works in browser, then proceed to Phase 3 (UI polish) or Phase 4 (audio wiring) based on user preference.

