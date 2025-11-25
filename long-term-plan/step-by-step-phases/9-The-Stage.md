# Phase 9: The Stage (Performance Mode)

> "The studio is for composing. The stage is for living."

## 1. The Core Concept
Ambient Flow has been a "Studio" tool so far—careful tweaking of parameters. "The Stage" is a new mode designed for live performance. It hides the complexity of the graph and exposes big, gestural controls.

### Key Components
1.  **XY Pads**: Multi-dimensional control surfaces.
2.  **Mute Groups**: Scene management for arranging tracks live.
3.  **MIDI Integration**: Physical hardware control.
4.  **Macro Dashboard**: A simplified view of the "Day/Night" knobs.

## 2. XY Pads (Gestural Control)
**Goal**: Control two related parameters with one finger.

### A. Usage Examples
*   **Filter Pad**: X = Cutoff, Y = Resonance.
*   **Space Pad**: X = Reverb Size, Y = Delay Feedback.
*   **Grain Pad**: X = Position, Y = Spray.

### B. Physics & Interaction
*   **Spring Back**: Option for the puck to snap back to center when released (like a pitch wheel).
*   **Friction**: Option for the puck to slide and slow down (inertia).
*   **Multi-Touch**: Support for multiple fingers on different pads.

## 3. Mute Groups (Scene Launching)
**Goal**: "Drop the bass."

### A. The Matrix
*   A grid of buttons representing active nodes.
*   **Groups**: Assign nodes to "Group A" (Drums), "Group B" (Pads).
*   **Solo/Mute Logic**: Standard mixer logic (Solo overrides Mute).

### B. Quantized Launching
*   If I press "Unmute" on the kick drum, it shouldn't start *immediately* (off-beat).
*   **Quantization**: Wait for the next "Bar" or "Beat" (from the Rhythmic Intelligence clock) to toggle the mute state.

## 4. MIDI Integration (Web MIDI API)
**Goal**: Use a real Korg nanoKONTROL to drive the app.

### A. The `MidiManager`
*   **Discovery**: List available inputs (`navigator.requestMIDIAccess`).
*   **Learn Mode**:
    1.  Click a UI Knob (it starts pulsing).
    2.  Twist a physical knob.
    3.  Map `CC#74` on `Channel 1` to `Filter Cutoff`.

### B. Mapping Strategy
*   **Absolute vs. Relative**: Handle standard knobs (0-127) and endless encoders (increment/decrement).
*   **Pickup Mode**: If the physical knob is at 0 but the UI knob is at 100, don't jump to 0. Wait until the physical knob crosses 100 to "pick it up."

## 5. Technical Implementation

### A. `PerformanceStore`
A separate Zustand store for live state.
```typescript
interface PerformanceState {
  xyPads: {
    id: string;
    xParamId: string;
    yParamId: string;
    xValue: number;
    yValue: number;
  }[];
  midiMappings: {
    [ccId: string]: string; // "1:74" -> "node-123:frequency"
  };
}
```

### B. The `XYPad` Component
*   Use `react-use-gesture` for robust touch handling.
*   Render using SVG or Canvas for 60fps smoothness.
*   **Optimization**: Do *not* trigger React re-renders on drag. Update the DOM directly or use a `ref`-based animation loop, then sync to React state on release.

---
**Next Step**: Proceed to [Phase 10: The Polish](./10-The-Polish.md) to prepare for launch.
