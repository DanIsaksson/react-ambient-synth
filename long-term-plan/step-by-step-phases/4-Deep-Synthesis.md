# Phase 4: Deep Synthesis (Sonic Depth)

> "A sine wave is a drawing of a sound. A grain is a photograph of a sound."

## 1. The Core Concept
Our current "Classic Mode" sounds flat because it relies on subtractive synthesis (filtering white noise). Real-world sounds have complex, evolving spectra. To achieve "Sonic Depth," we will implement three advanced synthesis engines:
1.  **Granular Synthesis**: For lush, cloud-like textures.
2.  **Physical Modeling**: For organic, plucked/struck sounds.
3.  **Convolution Reverb**: For placing sounds in real physical spaces.

## 2. Granular Synthesis Engine
**Goal**: Turn short samples into infinite, evolving textures.

### A. The `GranularNode` (AudioWorklet)
We cannot do this on the main thread. The `GranularProcessor` will handle:
*   **Grain Scheduling**: Spawning 10-100 grains per second.
*   **Windowing**: Applying a Hanning or Gaussian envelope to each grain to prevent clicks.
*   **Jitter**: Randomizing grain position, pitch, and duration to avoid "machine-gun" artifacts.

### B. Parameters
*   **Position**: Where in the sample to pull grains from.
*   **Spray (Jitter)**: Randomness of the position.
*   **Density**: Grains per second (Hz).
*   **Size**: Duration of each grain (10ms - 500ms).
*   **Pitch**: Playback rate of the grain.

### C. Sample Management
*   We need a `SampleManager` to fetch, decode, and cache `AudioBuffer`s.
*   **Source Material**: High-quality stereo field recordings (Rain on roof, Distant traffic, Forest wind).

## 3. Physical Modeling Engine
**Goal**: Create sounds that feel "struck" or "plucked" rather than just "played."

### A. Karplus-Strong (String Synthesis)
*   **Algorithm**: Short noise burst -> Delay Line -> Lowpass Filter (Damping) -> Feedback.
*   **Extension**: We will add a "Stiffness" allpass filter in the feedback loop to simulate metal/nylon strings.
*   **Exciter**: Instead of just white noise, we can use short samples (e.g., a "click" or "thud") to excite the string.

### B. Modal Synthesis (Resonators)
*   **Algorithm**: A bank of high-Q Bandpass filters tuned to specific ratios (harmonics).
*   **Materials**:
    *   *Glass*: Non-integer harmonics, high Q (long decay).
    *   *Wood*: Integer harmonics, low Q (short decay).
    *   *Metal*: Clustered inharmonic partials.
*   **Implementation**: A `ModalResonatorNode` that takes an impulse (ping) and rings out.

## 4. Field Recordings & Convolution
**Goal**: "The Atmosphere Engine."

### A. The Convolver
*   We will use the native `ConvolverNode` for realistic reverb.
*   **Impulse Responses (IRs)**: We need a library of IRs (Cathedral, Small Room, Cave, Forest).
*   **True Stereo**: We must handle 4-channel convolution (LL, LR, RL, RR) for true stereo immersion if possible, or standard 2-channel for performance.

### B. Streaming Large Files
*   Field recordings can be long (minutes). We shouldn't decode them all at once.
*   **Technique**: Use `MediaElementSourceNode` (streaming) for the "Bed" tracks (background rain), and `AudioBufferSourceNode` (memory) for the "One-shot" sounds (thunder crack).

## 5. Technical Implementation Strategy

### A. The `AudioWorklet` Structure
We will create a modular DSP system in C++ (future) or optimized TS (now).

```typescript
// worklets/granular-processor.ts
class GranularProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    // 1. Check if it's time to spawn a grain
    // 2. Loop through active grains
    // 3. Mix grain output to output buffer
    // 4. Clean up finished grains
    return true;
  }
}
```

### B. Node Interface
The UI will expose these complex engines as simple nodes.
*   **Texture Node**: A granular player with "Cloud" and "Density" knobs.
*   **Resonator Node**: A modal synth with "Material" (Glass/Wood/Metal) and "Strike" controls.

### C. Performance Budget
*   **Granular**: Max 50 concurrent grains per node.
*   **Modal**: Max 8 filters per resonator.
*   **Convolution**: 1 global reverb instance (send bus), not per-node.

---
**Next Step**: Proceed to [Phase 5: Rhythmic Intelligence](./5-Rhythmic-Intelligence.md) to add the "brain" that plays these new instruments.
