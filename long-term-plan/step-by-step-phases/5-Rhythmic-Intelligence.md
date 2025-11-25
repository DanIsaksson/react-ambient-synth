# Phase 5: Rhythmic Intelligence

> "The heart of the machine must beat, but it shouldn't just tick."

## 1. The Core Concept
Current sequencers in the app are likely simple loops. To make the system feel "intelligent," we need rhythms that evolve. We will implement three layers of rhythmic complexity:
1.  **Euclidean Rhythms**: Algorithmic distribution of beats.
2.  **Polyrhythms**: Independent time signatures per track.
3.  **Probability**: Non-deterministic triggering.

## 2. Euclidean Sequencer Node
**Goal**: Generate complex, culturally rich rhythms from two numbers.

### A. The Algorithm (Bjorklund's)
*   **Inputs**: `Steps` (n) and `Pulses` (k).
*   **Logic**: Distribute `k` pulses as evenly as possible over `n` steps.
*   **Examples**:
    *   (3, 8) -> `[1, 0, 0, 1, 0, 0, 1, 0]` (Tresillo/Reggaeton)
    *   (5, 8) -> `[1, 0, 1, 1, 0, 1, 1, 0]` (Cinquillo/Cuban)
*   **Rotation**: A `Rotate` parameter shifts the start point, creating variations of the same groove.

### B. UI Representation
*   **Visual**: A circular ring (polar coordinates).
*   **Active Steps**: Lit up segments.
*   **Playhead**: A rotating radar sweep.

## 3. The Polyrhythmic Scheduler
**Goal**: Break free from the "4/4 Grid."

### A. Independent Clocks
*   Instead of one global `Step` counter, each Sequencer Node has its own `Phase` accumulator.
*   **Time Signatures**: Track A runs in 4/4, Track B runs in 5/4. They phase in and out of sync, creating long-form evolution (Steve Reich style).
*   **Clock Source**: We must use `AudioContext.currentTime` for sample-accurate scheduling. `requestAnimationFrame` is only for visuals.

### B. The "Lookahead" Scheduler
To ensure timing accuracy even if the main thread lags:
1.  **Interval**: A `setInterval` runs every 25ms.
2.  **Schedule**: It looks ahead 100ms into the future.
3.  **Queue**: It pushes note events to the `AudioWorklet` or `Oscillator` nodes with exact `startTime = ctx.currentTime + delta`.

## 4. Probability & Logic
**Goal**: "Maybe play this note."

### A. Per-Step Probability
*   Every step in a sequence has a `Chance` value (0.0 - 1.0).
*   **Logic**: `if (Math.random() < step.chance) playNote();`
*   **Use Case**: Ghost notes on a snare drum (low probability) vs. the backbeat (100% probability).

### B. Conditional Logic (Advanced)
*   **"First"**: Play only on the first loop iteration.
*   **"Every 4"**: Play only every 4th loop.
*   **"Fill"**: If a global "Fill" button is pressed, override probability.

## 5. Technical Implementation

### A. `SequencerNode` (Custom Logic)
This is *not* an AudioNode, but a Logic Node in the graph.
*   **Outputs**: It sends *Triggers* (messages), not audio.
*   **Connections**: Connect `Sequencer` -> `Envelope` (Gate) -> `Oscillator` (Freq).

### B. The Trigger System
We need a standard event format for the graph.
```typescript
interface TriggerEvent {
  type: 'note_on' | 'note_off';
  time: number; // Absolute AudioContext time
  velocity: number; // 0.0 - 1.0
  pitch?: number; // Optional frequency override
}
```

### C. Visualizing the Invisible
Since the scheduler runs ahead of time:
*   **Audio**: Happens perfectly on time.
*   **Visuals**: The UI playhead must be interpolated to match `currentTime` so it doesn't look "jittery" or ahead of the sound.

---
**Next Step**: Proceed to [Phase 6: The Nervous System](./6-The-Nervous-System.md) to define how these rhythms modulate parameters over time.
