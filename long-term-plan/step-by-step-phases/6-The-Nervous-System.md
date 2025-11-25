# Phase 6: The Nervous System (Modulation)

> "A static patch is dead. A living patch breathes."

## 1. The Core Concept
In a modular synthesizer, "Modulation" is what makes sound move. It's the difference between a steady beep and a police siren. We will build a central "Nervous System" that allows any signal to control any parameter.

### Key Components
1.  **The Matrix**: A routing system connecting Sources (LFO, Chaos) to Destinations (Filter Cutoff, Pitch).
2.  **Chaos Generators**: Mathematical systems that produce unpredictable but natural motion.
3.  **Macro Controls**: High-level knobs that control dozens of low-level parameters simultaneously.

## 2. The Modulation Matrix
**Goal**: Allow `Source A` to modulate `Target B` with `Amount X`.

### A. Architecture
*   **Sources**: LFOs, Envelopes, Sequencers, Chaos Nodes, Macro Knobs.
*   **Destinations**: Any `AudioParam` (Frequency, Gain, Q, Detune).
*   **The Connection**: We use a `GainNode` as the "Amount" control.
    *   `Source` -> `GainNode (Amount)` -> `Target AudioParam`.

### B. UI Representation
*   **Patch Cables**: In Graph Mode, you physically drag a cable from an LFO output to a Filter input.
*   **Modulation Rings**: In the UI, the target knob has a colored ring indicating the modulation range.
*   **The Matrix View**: A spreadsheet-style view for power users to see all active modulations.

## 3. Chaos Generators
**Goal**: "Unpredictable but Natural."

### A. Lorenz Attractor Node
*   **Math**: A system of 3 differential equations (`dx/dt`, `dy/dt`, `dz/dt`) that orbits two points.
*   **Output**: 3 control signals (X, Y, Z) that drift in a "butterfly" pattern.
*   **Use Case**: Slowly morphing the timbre of a drone over minutes.
*   **Implementation**: A custom `AudioWorklet` that solves the equations per-sample or per-block.

### B. Perlin/Simplex Noise
*   **Math**: Gradient noise that is smooth and continuous (unlike white noise).
*   **Output**: A wandering signal that feels like "wind" or "drift."
*   **Use Case**: Adding subtle humanization to pitch or filter cutoff.

## 4. Macro Controls
**Goal**: "One knob to rule them all."

### A. The Mapping System
A Macro Knob (e.g., "Intensity") doesn't just turn one thing up. It might:
*   Increase Distortion Drive (0% -> 100%)
*   Decrease Reverb Wet (50% -> 20%)
*   Open Filter Cutoff (100Hz -> 5000Hz)

### B. Transfer Curves
To make it feel musical, we need non-linear mapping:
*   **Linear**: 1:1 mapping.
*   **Exponential**: Good for frequency/volume.
*   **S-Curve**: Smooth start/end, fast middle.
*   **Custom**: A user-drawable curve (future).

## 5. Technical Implementation

### A. `ModulationSystem` Class
A singleton that manages the graph connections.
```typescript
class ModulationSystem {
  connect(sourceId: string, targetId: string, param: string, amount: number) {
    // 1. Get Source Node
    // 2. Get Target Node & AudioParam
    // 3. Create GainNode (Amount)
    // 4. Connect Source -> Gain -> Param
  }
}
```

### B. Audio-Rate vs. Control-Rate
*   **Audio-Rate**: Modulation happens at 44.1kHz (e.g., FM Synthesis). Must use `AudioNode` connections.
*   **Control-Rate**: Modulation happens at ~100Hz (e.g., UI sliders). Can be done in JS, but we prefer Audio-Rate for smoothness.

### C. Visual Feedback
*   **Problem**: `AudioParam.value` doesn't update when modulated by another node.
*   **Solution**: We need an `AnalyserNode` or a custom `MeterNode` at the modulation source to send values back to the UI for visualization (at 60fps).

---
**Next Step**: Proceed to [Phase 7: Spatial Audio](./7-Spatial-Audio.md) to place these living sounds in a 3D world.
