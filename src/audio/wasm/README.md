# WASM DSP Core

This directory is reserved for future WebAssembly-based DSP implementations.

## Why WASM?

WebAssembly offers significant performance benefits for computationally intensive DSP operations:

- **Near-native performance**: WASM runs at near-native speed
- **Predictable timing**: No garbage collection pauses
- **SIMD support**: Vectorized operations for parallel processing
- **Memory safety**: Rust's ownership model prevents common audio bugs

## Planned WASM Modules

### 1. Granular Synthesis Engine
```rust
// Future implementation: granular_engine.rs
pub struct GranularEngine {
    grains: Vec<Grain>,
    sample_buffer: Vec<f32>,
    grain_size: usize,
    density: f32,
    pitch_spread: f32,
}
```

### 2. Convolution Reverb
```rust
// Future implementation: convolution.rs
pub struct ConvolutionReverb {
    ir_buffer: Vec<f32>,
    fft_size: usize,
    overlap_add_buffer: Vec<f32>,
}
```

### 3. Spectral Processing
```rust
// Future implementation: spectral.rs
pub struct SpectralProcessor {
    fft_plan: FftPlan,
    window: Vec<f32>,
    analysis_buffer: Vec<Complex<f32>>,
}
```

## Setup Instructions

### Prerequisites

1. **Install Rust toolchain**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Add wasm32 target**:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **Install wasm-pack**:
   ```bash
   cargo install wasm-pack
   ```

### Project Structure

```
src/audio/wasm/
├── Cargo.toml          # Rust project configuration
├── src/
│   ├── lib.rs          # Main entry point
│   ├── granular.rs     # Granular synthesis
│   ├── convolution.rs  # Convolution reverb
│   └── spectral.rs     # FFT-based processing
├── pkg/                # Generated WASM package
└── README.md           # This file
```

### Building

```bash
cd src/audio/wasm
wasm-pack build --target web
```

### Integration with AudioWorklet

```typescript
// Example integration pattern
class WasmWorkletProcessor extends AudioWorkletProcessor {
    private wasmModule: WebAssembly.Module;
    private wasmInstance: WebAssembly.Instance;
    
    constructor() {
        super();
        // Load WASM module
        this.loadWasm();
    }
    
    async loadWasm() {
        const response = await fetch('/wasm/dsp_core_bg.wasm');
        const bytes = await response.arrayBuffer();
        this.wasmModule = await WebAssembly.compile(bytes);
        this.wasmInstance = await WebAssembly.instantiate(this.wasmModule);
    }
    
    process(inputs, outputs, parameters) {
        // Call WASM DSP function
        const output = outputs[0];
        this.wasmInstance.exports.process_audio(output[0], output[0].length);
        return true;
    }
}
```

## Performance Targets

| Operation | JS AudioWorklet | WASM Target | Improvement |
|-----------|----------------|-------------|-------------|
| Granular (100 grains) | 15ms | 2ms | 7.5x |
| Convolution (2s IR) | 8ms | 1.5ms | 5x |
| FFT (4096 samples) | 3ms | 0.4ms | 7.5x |

## Resources

- [Rust and WebAssembly Book](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/)
- [AudioWorklet + WASM](https://googlechromelabs.github.io/web-audio-samples/audio-worklet/)
- [dasp - Rust DSP Library](https://github.com/RustAudio/dasp)

## Status

🚧 **Not Yet Implemented** - This is a future enhancement.

Current DSP is handled by JavaScript AudioWorklets which provide adequate performance for most use cases. WASM implementation is planned for computationally intensive features like:

- Real-time granular synthesis with 100+ grains
- Long convolution reverbs (>2 seconds)
- Spectral morphing and vocoding
- Physical modeling synthesis
