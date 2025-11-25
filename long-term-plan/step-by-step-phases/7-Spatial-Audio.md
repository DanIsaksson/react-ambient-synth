# Phase 7: Spatial Audio (3D Soundscapes)

> "Stereo is a painting. Spatial audio is a sculpture."

## 1. The Core Concept
To create a truly immersive "Ambient Flow," sounds cannot just exist "left" or "right." They must inhabit a physical space. We will leverage the Web Audio API's 3D spatialization features to place every node in a virtual room.

### Key Components
1.  **Binaural Panning (HRTF)**: Simulating how ears hear 3D sound.
2.  **Distance Models**: Natural volume rolloff.
3.  **Doppler Effect**: Pitch shifting based on velocity (Manual Implementation).
4.  **Environmental Reflections**: Convolution Reverb as a "Room" simulator.

## 2. Binaural Panning
**Goal**: Place a sound *behind* or *above* the user.

### A. The `PannerNode`
*   **Model**: We will use `panningModel: 'HRTF'` (Head-Related Transfer Function). This uses convolution to simulate ear shape filtering, allowing for vertical and front/back localization.
*   **Coordinates**: Web Audio uses a Right-Hand Cartesian system (+X Right, +Y Up, -Z Forward).
*   **Sync**: We must sync the Three.js camera position to the `AudioListener` and the 3D Mesh position to the `PannerNode`.

### B. The `AudioListener`
*   Represents the user's head.
*   **Properties**: `positionX/Y/Z`, `forwardX/Y/Z`, `upX/Y/Z`.
*   **Update Loop**: On every frame (rAF), we update the Listener's orientation to match the Camera's quaternion.

## 3. Distance Attenuation
**Goal**: Sounds get quieter and "muffled" as they move away.

### A. Distance Models
*   **Inverse Model**: `gain = refDistance / (refDistance + rolloffFactor * (distance - refDistance))`. Most natural for point sources.
*   **Rolloff Factor**: Tunable per node. A "Whisper" node might have a high rolloff (disappears quickly), while a "Thunder" node has a low rolloff (heard from miles away).

### B. Air Absorption (Lowpass)
*   Real air absorbs high frequencies over distance.
*   **Implementation**: A `BiquadFilterNode` (Lowpass) connected after the Panner.
*   **Automation**: `frequency.value` is modulated by distance. `cutoff = 20000 * Math.exp(-distance * 0.01)`.

## 4. The Doppler Effect
**Goal**: The "Zoom" sound when a node flies past the camera.

### A. The Problem
*   The native `PannerNode.setVelocity()` and Doppler features were deprecated/removed due to glitches.

### B. Manual Implementation
We must build a custom `DopplerPanner` wrapper.
1.  **Velocity Tracking**: Calculate `deltaPosition / deltaTime` for both Source and Listener.
2.  **Relative Speed**: Project the relative velocity vector onto the Source-Listener vector.
3.  **Pitch Shift**: `playbackRate = speedOfSound / (speedOfSound - relativeSpeed)`.
4.  **Delay Line**: A variable `DelayNode` to simulate propagation time (optional, adds realism but complexity).

## 5. Technical Implementation

### A. `SpatialNode` Wrapper
```typescript
class SpatialNode {
  constructor(ctx, sourceNode) {
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    
    // Air Absorption
    this.filter = ctx.createBiquadFilter();
    
    // Graph: Source -> Filter -> Panner -> Destination
    sourceNode.connect(this.filter);
    this.filter.connect(this.panner);
  }

  update(pos: Vector3, listenerPos: Vector3) {
    // Update Panner Position
    this.panner.positionX.value = pos.x;
    // ...
    
    // Calculate Distance for Air Absorption
    const dist = pos.distanceTo(listenerPos);
    this.filter.frequency.value = calculateAirAbsorption(dist);
  }
}
```

### B. Performance Considerations
*   **HRTF Cost**: HRTF panning is expensive (convolution). We might limit it to the "nearest 8 nodes" and use 'equalpower' (stereo panning) for distant nodes.
*   **Update Rate**: Updating `AudioParam`s every frame (60fps) is fine, but avoid garbage collection in the loop.

---
**Next Step**: Proceed to [Phase 8: The Library](./8-The-Library.md) to define how we save these 3D worlds.
