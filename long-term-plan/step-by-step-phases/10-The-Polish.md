# Phase 10: The Polish (Optimization & Release)

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."

## 1. The Core Concept
A powerful engine is useless if it stutters or if users can't figure it out. Phase 10 is about removing friction. We will optimize the DSP core with WebAssembly, adapt the UI for touch devices, and build a guided tour for new users.

### Key Components
1.  **WASM Core**: Porting heavy DSP to Rust/C++ for near-native performance.
2.  **Mobile Mode**: A dedicated UI layout for phones (Stack vs. Grid).
3.  **Onboarding**: An interactive "Driver.js" tour.
4.  **PWA Support**: Installable as a native app.

## 2. WASM Optimization (The Engine Upgrade)
**Goal**: Run 100 granular voices without dropping a frame.

### A. The Bottleneck
*   JavaScript `AudioWorklet` is fast, but Garbage Collection (GC) can cause glitches.
*   Complex math (FFT, Convolution) is slower in JS than C++.

### B. The Solution: Rust + Wasm
*   We will write the core DSP algorithms (Granular, Karplus-Strong) in **Rust**.
*   **Compilation**: Compile to `.wasm` using `wasm-pack`.
*   **Integration**: The `AudioWorkletProcessor` loads the Wasm module and calls its `process()` function.
*   **Memory**: SharedArrayBuffer for zero-copy audio transfer between JS and Wasm.

## 3. Mobile Layout (Touch First)
**Goal**: "Ambient Flow in your pocket."

### A. The Challenge
*   The "Graph" is too big for a phone screen.
*   **Solution**: On mobile, the Graph is hidden by default. The UI defaults to "Stage Mode" (Macro Knobs & XY Pads).

### B. Context Unlocking
*   Mobile browsers mute audio until a touch event.
*   **Implementation**: A full-screen "Start" overlay that captures the first click to `ctx.resume()`.

### C. Responsive CSS
*   Use CSS Grid/Flexbox to stack panels vertically on portrait screens.
*   Increase touch targets (min 44px) for all controls.

## 4. Onboarding (The Tour)
**Goal**: "Show, don't tell."

### A. Driver.js Integration
*   We will use `driver.js` to highlight UI elements and explain them.
*   **The Script**:
    1.  "Welcome to Ambient Flow."
    2.  (Highlight Node) "This is a Sound Source."
    3.  (Highlight Cable) "This connects audio."
    4.  (Highlight Output) "This is the Master Output."
    5.  "Try dragging a cable now!"

### B. The "First Run" Experience
*   Check `localStorage.getItem('hasSeenTour')`.
*   If false, load a simple "Tutorial Patch" and start the tour.

## 5. Technical Implementation

### A. `WasmAudioProcessor`
```rust
// dsp/src/lib.rs
#[wasm_bindgen]
pub struct GranularEngine {
    // ... internal state
}

#[wasm_bindgen]
impl GranularEngine {
    pub fn process(&mut self, output: &mut [f32]) {
        // High-performance DSP loop
    }
}
```

### B. `MobileDetector` Hook
```typescript
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  // Check window.matchMedia('(max-width: 768px)')
  return isMobile;
};
```

---
**Completion**: This concludes the 10-Phase Evolution Plan.
