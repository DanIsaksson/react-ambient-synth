//! DSP Performance Benchmarks
//!
//! # Running Benchmarks
//! ```bash
//! # Native benchmarks (for comparison baseline)
//! cargo bench
//!
//! # With baseline comparison
//! cargo bench -- --save-baseline main
//! cargo bench -- --baseline main
//! ```
//!
//! # Performance Targets
//! | Operation | JS Baseline | WASM Target | Budget |
//! |-----------|-------------|-------------|--------|
//! | Granular (100 grains) | 15ms | <2ms | 2.9ms |
//! | Convolution (2s IR) | 8ms | <1.5ms | 2.9ms |
//! | FFT 4096 | 3ms | <0.4ms | 2.9ms |
//!
//! Hard Limit: 2.9ms per 128-sample block @ 44.1kHz

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use rustfft::{FftPlanner, num_complex::Complex};

// ============================================================================
// SIMD UTILITY BENCHMARKS
// ============================================================================

fn bench_simd_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_operations");
    
    // Test buffer sizes: 128 (typical), 256, 512
    for size in [128, 256, 512] {
        let mut buffer = vec![0.5f32; size];
        let buffer_b = vec![0.3f32; size];
        
        group.bench_with_input(
            BenchmarkId::new("scale_buffer", size),
            &size,
            |b, _| {
                b.iter(|| {
                    // Reset buffer
                    buffer.fill(0.5);
                    // Inline scale operation to avoid module dependency issues
                    let scale = black_box(0.8f32);
                    for sample in buffer.iter_mut() {
                        *sample *= scale;
                    }
                })
            },
        );
        
        group.bench_with_input(
            BenchmarkId::new("clear_buffer", size),
            &size,
            |b, _| {
                b.iter(|| {
                    buffer.fill(0.0);
                })
            },
        );
        
        group.bench_with_input(
            BenchmarkId::new("mix_buffers", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let gain = black_box(0.5f32);
                    for i in 0..buffer.len() {
                        buffer[i] += buffer_b[i] * gain;
                    }
                })
            },
        );
    }
    
    group.finish();
}

// ============================================================================
// FFT BENCHMARKS
// ============================================================================

fn bench_fft(c: &mut Criterion) {
    let mut group = c.benchmark_group("fft");
    
    // Test FFT sizes used in our DSP modules
    for size in [512, 1024, 2048, 4096] {
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(size);
        let ifft = planner.plan_fft_inverse(size);
        let mut buffer: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); size];
        
        // Initialize with some data
        for (i, c) in buffer.iter_mut().enumerate() {
            c.re = (i as f32 * 0.01).sin();
            c.im = 0.0;
        }
        
        group.bench_with_input(
            BenchmarkId::new("forward", size),
            &size,
            |b, _| {
                b.iter(|| {
                    fft.process(black_box(&mut buffer));
                })
            },
        );
        
        group.bench_with_input(
            BenchmarkId::new("inverse", size),
            &size,
            |b, _| {
                b.iter(|| {
                    ifft.process(black_box(&mut buffer));
                })
            },
        );
        
        group.bench_with_input(
            BenchmarkId::new("roundtrip", size),
            &size,
            |b, _| {
                b.iter(|| {
                    fft.process(black_box(&mut buffer));
                    ifft.process(black_box(&mut buffer));
                })
            },
        );
    }
    
    group.finish();
}

// ============================================================================
// FILTER BENCHMARKS
// ============================================================================

fn bench_biquad(c: &mut Criterion) {
    let mut group = c.benchmark_group("biquad_filter");
    
    // Biquad coefficients (lowpass @ 1kHz, Q=0.707, sr=44100)
    let b0 = 0.00362168f32;
    let b1 = 0.00724336f32;
    let b2 = 0.00362168f32;
    let a1 = -1.82269f32;
    let a2 = 0.83718f32;
    
    for size in [128, 256, 512] {
        let mut buffer = vec![0.5f32; size];
        let mut x1 = 0.0f32;
        let mut x2 = 0.0f32;
        let mut y1 = 0.0f32;
        let mut y2 = 0.0f32;
        
        group.bench_with_input(
            BenchmarkId::new("process", size),
            &size,
            |b, _| {
                b.iter(|| {
                    // Reset state
                    x1 = 0.0;
                    x2 = 0.0;
                    y1 = 0.0;
                    y2 = 0.0;
                    
                    for sample in buffer.iter_mut() {
                        let x = *sample;
                        let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
                        
                        x2 = x1;
                        x1 = x;
                        y2 = y1;
                        y1 = y;
                        
                        *sample = y;
                    }
                })
            },
        );
    }
    
    group.finish();
}

// ============================================================================
// DELAY LINE BENCHMARKS
// ============================================================================

fn bench_delay(c: &mut Criterion) {
    let mut group = c.benchmark_group("delay_line");
    
    const DELAY_SIZE: usize = 48000; // 1 second @ 48kHz
    let mut delay_buffer = vec![0.0f32; DELAY_SIZE];
    let mut write_pos = 0usize;
    let delay_samples = 22050usize; // 0.5 second delay
    
    for buffer_size in [128, 256] {
        let mut input = vec![0.5f32; buffer_size];
        
        group.bench_with_input(
            BenchmarkId::new("read_write", buffer_size),
            &buffer_size,
            |b, _| {
                b.iter(|| {
                    for i in 0..input.len() {
                        // Read from delay
                        let read_pos = (write_pos + DELAY_SIZE - delay_samples) % DELAY_SIZE;
                        let delayed = delay_buffer[read_pos];
                        
                        // Write to delay
                        delay_buffer[write_pos] = input[i];
                        write_pos = (write_pos + 1) % DELAY_SIZE;
                        
                        // Mix
                        input[i] = input[i] * 0.5 + delayed * 0.5;
                    }
                })
            },
        );
    }
    
    group.finish();
}

// ============================================================================
// GRANULAR SIMULATION BENCHMARK
// ============================================================================

fn bench_granular_simulation(c: &mut Criterion) {
    let mut group = c.benchmark_group("granular");
    
    // Simulate granular synthesis workload
    const MAX_GRAINS: usize = 100;
    const SOURCE_LEN: usize = 44100 * 10; // 10 seconds
    
    struct Grain {
        active: bool,
        pos: f32,
        phase: f32,
        rate: f32,
        amp: f32,
    }
    
    let source = vec![0.5f32; SOURCE_LEN];
    let mut grains: Vec<Grain> = (0..MAX_GRAINS)
        .map(|_| Grain {
            active: false,
            pos: 0.0,
            phase: 0.0,
            rate: 1.0,
            amp: 1.0,
        })
        .collect();
    
    // Activate some grains
    for (i, grain) in grains.iter_mut().enumerate().take(50) {
        grain.active = true;
        grain.pos = (i as f32) / 50.0;
        grain.rate = 1.0 + (i as f32 - 25.0) * 0.02;
    }
    
    for buffer_size in [128, 256] {
        let mut output_l = vec![0.0f32; buffer_size];
        let mut output_r = vec![0.0f32; buffer_size];
        
        group.bench_with_input(
            BenchmarkId::new("50_grains", buffer_size),
            &buffer_size,
            |b, &size| {
                b.iter(|| {
                    // Clear output
                    output_l.fill(0.0);
                    output_r.fill(0.0);
                    
                    // Process each sample
                    for sample_idx in 0..size {
                        for grain in grains.iter_mut() {
                            if !grain.active {
                                continue;
                            }
                            
                            // Read sample (simplified)
                            let source_idx = (grain.pos * SOURCE_LEN as f32) as usize;
                            let sample = if source_idx < SOURCE_LEN {
                                source[source_idx]
                            } else {
                                0.0
                            };
                            
                            // Envelope (raised cosine)
                            let env = 0.5 - 0.5 * (grain.phase * std::f32::consts::PI * 2.0).cos();
                            let out = sample * env * grain.amp;
                            
                            output_l[sample_idx] += out * 0.7;
                            output_r[sample_idx] += out * 0.7;
                            
                            // Advance
                            grain.pos += grain.rate / SOURCE_LEN as f32;
                            grain.phase += 1.0 / 256.0; // grain size
                        }
                    }
                })
            },
        );
    }
    
    group.finish();
}

// ============================================================================
// CONVOLUTION SIMULATION BENCHMARK
// ============================================================================

fn bench_convolution_simulation(c: &mut Criterion) {
    let mut group = c.benchmark_group("convolution");
    
    // Simulate overlap-add convolution
    const FFT_SIZE: usize = 512;
    const BLOCK_SIZE: usize = FFT_SIZE / 2;
    
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let ifft = planner.plan_fft_inverse(FFT_SIZE);
    
    let mut fft_buffer: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); FFT_SIZE];
    let ir_spectrum: Vec<Complex<f32>> = vec![Complex::new(0.1, 0.05); FFT_SIZE];
    let mut overlap = vec![0.0f32; FFT_SIZE];
    
    group.bench_function("block_256_samples", |b| {
        b.iter(|| {
            // Prepare input
            for i in 0..BLOCK_SIZE {
                fft_buffer[i] = Complex::new(0.5, 0.0);
            }
            for i in BLOCK_SIZE..FFT_SIZE {
                fft_buffer[i] = Complex::new(0.0, 0.0);
            }
            
            // FFT
            fft.process(&mut fft_buffer);
            
            // Complex multiply with IR
            for i in 0..FFT_SIZE {
                fft_buffer[i] = fft_buffer[i] * ir_spectrum[i];
            }
            
            // IFFT
            ifft.process(&mut fft_buffer);
            
            // Overlap-add
            let scale = 1.0 / FFT_SIZE as f32;
            for i in 0..FFT_SIZE {
                overlap[i] += fft_buffer[i].re * scale;
            }
        })
    });
    
    group.finish();
}

// ============================================================================
// PERFORMANCE BUDGET CHECK
// ============================================================================

fn bench_full_block_budget(c: &mut Criterion) {
    // This benchmark simulates a full audio processing block
    // to verify we stay within the 2.9ms budget for 128 samples @ 44.1kHz
    
    const BUFFER_SIZE: usize = 128;
    
    c.bench_function("full_block_128_samples", |b| {
        let mut output_l = vec![0.0f32; BUFFER_SIZE];
        let mut output_r = vec![0.0f32; BUFFER_SIZE];
        
        // Simulate typical processing chain
        b.iter(|| {
            // 1. Clear buffers
            output_l.fill(0.0);
            output_r.fill(0.0);
            
            // 2. Generate/process samples (simplified)
            for i in 0..BUFFER_SIZE {
                let t = i as f32 / 44100.0;
                output_l[i] = (t * 440.0 * std::f32::consts::PI * 2.0).sin() * 0.5;
                output_r[i] = output_l[i];
            }
            
            // 3. Apply filter
            let mut y1 = 0.0f32;
            for sample in output_l.iter_mut() {
                let y = *sample * 0.1 + y1 * 0.9;
                y1 = y;
                *sample = y;
            }
            
            // 4. Apply gain
            for sample in output_l.iter_mut() {
                *sample *= 0.8;
            }
            for sample in output_r.iter_mut() {
                *sample *= 0.8;
            }
            
            // Return sum as a simple check (avoids returning reference)
            black_box(output_l.iter().sum::<f32>() + output_r.iter().sum::<f32>())
        })
    });
}

// ============================================================================
// CRITERION CONFIGURATION
// ============================================================================

criterion_group!(
    benches,
    bench_simd_operations,
    bench_fft,
    bench_biquad,
    bench_delay,
    bench_granular_simulation,
    bench_convolution_simulation,
    bench_full_block_budget,
);

criterion_main!(benches);
