# Phase 2: The Tactile Graph (Graph Mode 2.0)

> "The graph is not a map. It is the territory."

## 1. The Core Concept
Currently, the "Graph Mode" is a static debugging tool. In Phase 2, we transform it into a **physical, bioluminescent workspace**. It should feel like plugging cables into a futuristic modular synthesizer.

### Key UX Goals
1.  **Tactility**: Nodes should feel heavy. Cables should snap with satisfaction.
2.  **Aliveness**: The graph should visualize the *signal*, not just the connection.
3.  **Clarity**: A complex patch should look like a beautiful circuit board, not a spiderweb.

## 2. Visual & Interaction Design

### A. The "Neon-Organic" Node Style
We will replace the default React Flow nodes with custom `BioluminescentNode` components.
-   **Backdrop**: Dark, frosted glass (blur-md) with a subtle inner glow.
-   **Border**: A "health bar" border that pulses with the node's output level (using a `useFrame` loop from R3F or direct CSS variable manipulation).
-   **Handles**: Instead of tiny dots, we use "Ports" – glowing rings that expand when a cable hovers nearby.
    -   *Input Port*: Blue/Cool glow.
    -   *Output Port*: Orange/Warm glow.

### B. Living Cables (Animated Edges)
Standard SVG lines are dead. We will create a custom `SignalEdge` component.
-   **The Pulse**: A packet of light travels along the cable to indicate signal flow.
    -   *Audio Rate*: Fast, continuous stream.
    -   *Control Rate (LFO)*: Slow, rhythmic pulses matching the LFO frequency.
-   **Styling**:
    -   Use SVG `<animateMotion>` for performant particle movement along the path.
    -   Use CSS `drop-shadow` for the neon glow.
    -   **Dynamic Width**: Louder signals = thicker cables (optional, maybe too noisy).

### C. The "Z-Index" Solution
To fix the "deadlock" issue where the graph is unclickable:
1.  **Layering Strategy**:
    -   *Layer 0 (Background)*: R3F Canvas (Stars, Nebulas).
    -   *Layer 1 (Graph)*: React Flow instance (z-index: 10).
    -   *Layer 2 (HUD)*: Global controls, Mute button (z-index: 50).
    -   *Layer 3 (Overlays)*: Modals, Tooltips (z-index: 100).
2.  **Pointer Events**: The R3F canvas must have `pointer-events: none` when the Graph is active, or specific interactive 3D objects must be carefully managed.

## 3. Technical Implementation

### A. Custom Node Architecture
We will build a generic `BaseNode` wrapper that handles the common "Neon" logic, and then specialized content components.

```tsx
// Concept Code
const BaseNode = ({ data, selected }) => {
  const signalLevel = useAudioStore(state => state.levels[data.id]);
  
  return (
    <div className={`glass-panel ${selected ? 'glow-active' : ''}`}>
      <NodeHeader title={data.label} type={data.type} />
      <NodeContent>
        {/* Specialized controls (Knobs, Sliders) go here */}
      </NodeContent>
      <SignalVisualizer level={signalLevel} />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};
```

### B. The "Context Switch"
When entering Graph Mode, we must ensure the audio engine reflects this state.
-   **Classic Mode**: The graph is hidden. The `AtmosphereEngine` runs a hardcoded preset.
-   **Graph Mode**: The `AudioEngine` switches to "Patch" mode. The graph *is* the source of truth.
-   **Transition**: A 500ms crossfade between the "Preset" audio and the "Graph" audio to prevent clicks.

### C. React Flow Configuration
We need to lock down the config for a premium feel:
-   `snapToGrid={true}`: For clean layouts.
-   `defaultEdgeOptions={{ type: 'signalEdge', animated: true }}`.
-   `connectionLineComponent={CustomConnectionLine}`: The "dragging" cable should look like a live wire, sparking at the end.

## 4. Development Steps

1.  **Fix the Layers**: Re-structure the main `App.tsx` layout to ensure React Flow is strictly above the background but below the HUD.
2.  **Create `BaseNode`**: Implement the glassmorphism CSS and basic layout.
3.  **Implement `SignalEdge`**: Create the custom SVG edge with the traveling light packet.
4.  **Port Existing Nodes**: Wrap the current `Oscillator`, `Filter`, etc., into the new `BaseNode` design.
5.  **Add Visual Feedback**: Connect the `AudioWorklet` analysis (metering) to the Node UI (this is the hardest part – requires efficient message passing).

---
**Next Step**: Proceed to [Phase 3: Neon-Organic UI](./3-Neon-Organic-UI.md) to define the specific component library (Knobs, Sliders) that will live *inside* these nodes.
