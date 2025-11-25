# Phase 3: Neon-Organic UI (Visual Overhaul)

> "The interface is the instrument. It must feel alive."

## 1. The Design System: "Bioluminescent Hardware"

We are moving away from "Web App" aesthetics (flat colors, standard shadows) to "Sci-Fi Hardware" aesthetics.

### A. Color Palette
*   **Obsidian (Backgrounds)**: `#050505` to `#121212`. Deep, rich blacks to make light pop.
*   **Glass (Panels)**: `rgba(20, 20, 20, 0.6)` with `backdrop-filter: blur(12px)`.
*   **Neon Accents**:
    *   *Signal*: `#00ff88` (Spring Green) - For active audio.
    *   *Control*: `#00ccff` (Cyan) - For modulation.
    *   *Warning/Clip*: `#ff0055` (Neon Red).
    *   *Idle*: `#444444` (Dim Grey).

### B. Typography
*   **Headers**: `Orbitron` or `Syncopate` (Google Fonts) - Tech/Futuristic.
*   **Labels**: `Rajdhani` or `Share Tech Mono` - Technical, legible at small sizes.
*   **Body**: `Inter` - For readability in modals/help text.

### C. Spacing & Layout
*   **Organic Containers**: No sharp corners. `border-radius: 16px` minimum.
*   **Fluid Layouts**: Use `Framer Motion` layout animations so panels expand/contract organically when content changes, rather than snapping.

## 2. Component Library: "Tactile Controls"

### A. The `NeonKnob`
A custom SVG component that behaves like a physical potentiometer.
*   **Interaction**:
    *   Drag up/down to change value.
    *   **Inertia**: When released, the knob continues to spin slightly based on throw velocity (using Framer Motion `dragTransition`).
    *   **Haptic Visuals**: The glow intensity increases as you turn it faster.
*   **Visuals**:
    *   SVG Circle with a "cutout" arc.
    *   Inner glow `drop-shadow`.
    *   A small "notch" that emits light.

### B. The `PlasmaSlider`
*   **Track**: A dark groove in the "metal".
*   **Thumb**: A glowing capsule of plasma.
*   **Fill**: The track fills with liquid light as you drag.

### C. The `HolographicButton`
*   **State: Idle**: Ghostly, semi-transparent border.
*   **State: Hover**: Glitches slightly, border brightens.
*   **State: Active**: Solid neon fill, ripples outward.

## 3. Interaction Design: "Feedback Loops"

Every action must have an equal and opposite reaction.

### A. Reactive Lighting
*   **Audio Metering**: The borders of the main container should pulse with the Master Output level.
*   **Modulation Visualization**: If an LFO is modulating a Filter Cutoff knob, the knob's ring should visually move *on its own* (ghost turning) to show the modulation source.

### B. Micro-Interactions
*   **Hover**: Elements lift up (scale: 1.02) and cast a stronger colored shadow.
*   **Click**: Elements press down (scale: 0.98) and flash white.
*   **Connection**: When a cable is connected, a "spark" particle effect explodes at the jack.

## 4. Technical Implementation

### A. CSS Architecture
We will use **Tailwind CSS** extended with custom utilities for neon effects.
```css
/* tailwind.config.js extension */
theme: {
  extend: {
    boxShadow: {
      'neon-green': '0 0 5px #00ff88, 0 0 20px rgba(0, 255, 136, 0.5)',
      'neon-blue': '0 0 5px #00ccff, 0 0 20px rgba(0, 204, 255, 0.5)',
    }
  }
}
```

### B. Animation Stack
*   **Framer Motion**: For all layout changes, modal entries, and the physics of the knobs.
*   **React Spring** (Optional): If Framer Motion is too heavy for 60fps knob modulation, we might use `react-spring` for the specific high-frequency value updates.

### C. Performance Strategy
*   **Will-Change**: Use `will-change: transform` on active knobs to promote them to their own compositor layer.
*   **Canvas Fallback**: If CSS box-shadows prove too expensive for 100+ nodes, we will switch to rendering the glow on a shared WebGL canvas (R3F) behind the DOM elements.

---
**Next Step**: Proceed to [Phase 4: Deep Synthesis](./4-Deep-Synthesis.md) to plan the audio engine upgrades that these beautiful knobs will control.
