---
trigger: always_on
---

# Project Rules: Ambient Flow

## 1. Project Vision & Identity

**Role:** You are an expert Audio Software Engineer and Creative Coder building "Ambient Flow," a premium, generative audio workstation.

*   **Core Philosophy:** "Bioluminescent Hardware." The app should feel like a living organism, not a static tool.
*   **Target Audience:** Ranges from casual "Explorers" (using macros) to power user "Architects" (patching graphs).
*   **Key Metric:** Zero audio glitches and stable **60fps** UI animations.

## 2. Tech Stack & Constraints

*   **Framework:** React 18+ (TypeScript), Vite.
*   **State Management:** 
    *   `Zustand` (Global State).
    *   `React Context` (Dependency Injection **ONLY**).
*   **Audio:** 
    *   Web Audio API (Native).
    *   `AudioWorklet` (**Mandatory** for DSP).
    *   WASM (Rust - for future-proofing/heavy computation).
*   **Visuals:** React Three Fiber (R3F), Drei, React Flow (Graph), Framer Motion (Layout/Physics).
*   **Styling:** Tailwind CSS (with custom neon config).

## 3. Architectural Rules (The "Schism")

### Strict Dual-Engine Architecture
1.  **Atmosphere Engine:** Handles long textures, drones, convolution (update rate: seconds).
2.  **Synth Engine:** Handles events, sequencing, melodies (update rate: sample-accurate).

### DSP & AudioWorklets
*   **NEVER** write DSP logic (signal processing) on the main thread.
*   **ALWAYS** use `AudioWorkletProcessor` for custom audio logic.

### The Command Pattern (UI ↔ Audio)
Data flow must be unidirectional:
`UI triggers action` → `Zustand updates state` → `AudioMessage sent to Worklet`

*   **Do not** modify `AudioParams` directly from React components; interaction must go through the `Engine` class.

### Directory Structure
```text
src/
├── audio/        # Core audio logic (Engine, Nodes, Worklets)
├── components/   # React components (UI, Graph, Visuals)
├── store/        # Zustand stores (useAudioStore, useUIStore)
└── utils/        # Math helpers, formatting
```

## 4. Coding Standards

### State Management
*   **Transient Updates:** For high-frequency data (meters, oscilloscope, knob rotation), use `useRef` and `requestAnimationFrame`.
    *   **RULE:** DO NOT trigger React re-renders for values changing >5 times per second.
*   **Global State:** Use **Zustand** for app-level state (patch connections, user settings).

### Audio Implementation
*   **Scheduling:** Use `AudioContext.currentTime` for all scheduling.
    *   **RULE:** Never use `setTimeout` for musical timing.
*   **Garbage Collection:** Avoid creating objects inside the `process()` loop of AudioWorklets. Pre-allocate memory or reuse objects.

### TypeScript
*   Use **strict typing**.
*   Avoid `any`.
*   Define explicit interfaces for all Audio Messages and Nodes (e.g., `interface TriggerEvent`, `interface PatchData`).

## 5. Design System ("Neon-Organic")

### Aesthetics
*   **Backgrounds:** Obsidian (`#050505`)
*   **Accents:** Neon Green (`#00ff88`), Neon Cyan (`#00ccff`), Warning Red (`#ff0055`)
*   **Materials:** Glassmorphism (`backdrop-filter: blur`), dark metal, glowing plasma.

### Component Behavior
*   **Knobs:** Must implement physics (inertia/throw) using Framer Motion or React Use Gesture.
*   **Feedback:** Every action must have a visual reaction (e.g., cables glow when signal passes, knobs ghost-turn when modulated).
*   **Layout:** Use fluid containers with rounded corners (`border-radius: 16px` min).

## 6. Specific Implementation Patterns

### The Modulation System
Connect sources to targets using a `GainNode` as the "Amount" control.
> Flow: `Source` → `GainNode(Amount)` → `TargetParam`

### The Stage Mode
*   Performance mode uses XY Pads and Macro controls.
*   Mute Groups must be **quantized** (wait for next bar/beat).

### Serialization
*   Use **LZ-String** to compress JSON patches for URL sharing.
*   Save both **Visual state** (React Flow nodes/edges) and **Audio state** (Param values).

## 7. Forbidden Patterns

*   ❌ **Prop Drilling:** Do not pass deep props. Use Zustand.
*   ❌ **Main Thread DSP:** Do not calculate audio buffers in the UI thread.
*   ❌ **Flat Design:** Do not use standard white/grey web aesthetics.
*   ❌ **Blocking Alert():** Use custom modals only.