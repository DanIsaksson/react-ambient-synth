# Phase 8: The Library (Preset Ecosystem)

> "A patch is a moment in time, frozen in amber."

## 1. The Core Concept
Users spend hours crafting the perfect soundscape. If they refresh the page and lose it, they will never return. "The Library" is the persistence layer that saves their work, allows sharing, and provides a starting point with curated presets.

### Key Components
1.  **Serialization Engine**: Converting the complex Graph + Audio State into a lightweight JSON.
2.  **Preset Browser**: A UI for loading Factory and User patches.
3.  **URL Sharing**: Encoding the entire state into a shareable link (no backend required).

## 2. Serialization Strategy
**Goal**: Save *everything* needed to reconstruct the sound.

### A. The Data Structure
We need a unified `PatchData` interface.
```typescript
interface PatchData {
  meta: {
    name: string;
    author: string;
    version: string; // Semantic versioning for compatibility
  };
  graph: {
    nodes: ReactFlow.Node[]; // Position, Type, ID
    edges: ReactFlow.Edge[]; // Connections
  };
  audio: {
    [nodeId: string]: {
      [paramName: string]: number | string; // Knob values
    };
  };
  global: {
    masterVolume: number;
    bpm: number;
  };
}
```

### B. The Challenge: Audio Graph vs. Visual Graph
*   **React Flow** stores the *visual* state (x, y, label).
*   **Audio Engine** stores the *sonic* state (frequency, gain).
*   **Solution**: The `SerializationManager` must query *both* stores.
    1.  `UIStore.getNodes()` -> Visuals.
    2.  `AudioStore.getAllParams()` -> Audio values.
    3.  Merge into `PatchData`.

## 3. URL Sharing (Serverless)
**Goal**: "Check out this drone I made." -> Click -> Exact replica loads.

### A. Compression (LZ-String)
*   A raw JSON patch might be 10KB. Too big for a URL.
*   **Algorithm**: Use `lz-string` to compress the JSON into a Base64-like string.
*   **Format**: `ambientflow.app/?patch=N4IgzgLgWg...`

### B. Loading Flow
1.  App Init.
2.  Check `window.location.search` for `?patch=`.
3.  If found:
    *   Decode & Decompress.
    *   **Clear** existing graph.
    *   **Hydrate** Audio Engine (create nodes, connect edges).
    *   **Hydrate** UI (place nodes).

## 4. Curated Presets ("The Factory Bank")
**Goal**: Show off what the engine can do.

### Categories
1.  **Sleep**: Deep, low-frequency drones (Brown noise + Lowpass).
2.  **Focus**: Crisp, rhythmic textures (Euclidean bleeps + Rain).
3.  **Sci-Fi**: Generative, chaotic FX (Lorenz Attractor + FM).
4.  **Nature**: Field recordings + subtle wind.

### Implementation
*   Store these as constant JSON files in `src/presets/`.
*   Load them instantly on button click.

## 5. Technical Implementation

### A. `PresetManager` Class
```typescript
class PresetManager {
  save(): string {
    const visual = useUIStore.getState().nodes;
    const audio = useAudioStore.getState().params;
    const patch = { visual, audio };
    return LZString.compressToEncodedURIComponent(JSON.stringify(patch));
  }

  load(compressed: string) {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    const patch = JSON.parse(json);
    // 1. Stop Engine
    // 2. Rebuild Graph
    // 3. Start Engine
  }
}
```

### B. Versioning
*   **Risk**: We change a node's internal ID or parameter name in v2.0. Old patches break.
*   **Fix**: Include a `version: 1` field. If loading a v1 patch in v2 app, run a `migration` function to map old params to new ones.

---
**Next Step**: Proceed to [Phase 9: The Stage](./9-The-Stage.md) to define the performance features.
