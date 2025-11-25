# The Neon Horizon: A 10-Phase Evolution Plan

**Vision**: To evolve Ambient Flow from a "noise generator" into a **premium, living generative audio ecosystem**. The focus shifts from "making it work" to "making it feel alive, tactile, and professional."

---

## [Phase 1: The Schism (Engine Re-Architecture)](./step-by-step-phases/1-The-Schism.md)
**Concept**: "Divide and Conquer."
We cannot have a muddy mix of noise and melody. We will split the audio core into two distinct, specialized engines that can run independently or together.
-   **The Atmosphere Engine**: Optimized for continuous, texture-based audio (Brown noise, Rain, Drones). Uses long buffers and convolution.
-   **The Synth Engine**: Optimized for event-based, precise audio (Oscillators, Envelopes, Sequencers). Uses low-latency scheduling.
-   **The Mixer**: A master bus that blends these two worlds cleanly, preventing the "muddy" sound.

## [Phase 2: The Tactile Graph (Graph Mode 2.0)](./step-by-step-phases/2-The-Tactile-Graph.md)
**Concept**: "Touching the Sound."
The Graph Mode is currently a static picture. It needs to become a physical workspace.
-   **Interaction Fixes**: Solve the Z-index/interaction bugs. Nodes should feel heavy and satisfying to drag.
-   **Live Visualization**: Cables should pulse with the signal they carry. Nodes should light up when triggered.
-   **Context Awareness**: The graph should *replace* the Classic Mode engine when active, ensuring a clean sonic slate.

## [Phase 3: Neon-Organic UI (Visual Overhaul)](./step-by-step-phases/3-Neon-Organic-UI.md)
**Concept**: "Bioluminescent Hardware."
Abandon the flat web buttons. We are building a futuristic instrument.
-   **Aesthetics**: Dark glass backgrounds, neon accent lines that act as VU meters.
-   **Controls**: Knobs that feel like physical potentiometers. Sliders with inertia.
-   **Feedback**: Every interaction triggers a visual response (a glow, a ripple).
-   **Curves**: Replace boxy divs with organic, rounded layouts inspired by patch cables and sound waves.

## [Phase 4: Deep Synthesis (Sonic Depth)](./step-by-step-phases/4-Deep-Synthesis.md)
**Concept**: "Beyond the Sine Wave."
Generic oscillators are boring. We need texture.
-   **Granular Synthesis**: Breaking samples into microscopic grains for lush clouds.
-   **Physical Modeling**: refined Karplus-Strong and Modal synthesis for "real" sounding objects (wood, metal, glass).
-   **Field Recordings**: High-quality stereo samples for the Atmosphere Engine (Real cafe sounds, not just filtered noise).

## [Phase 5: Rhythmic Intelligence](./step-by-step-phases/5-Rhythmic-Intelligence.md)
**Concept**: "The Ghost in the Machine."
Randomness is chaos; we want *groove*.
-   **Euclidean Sequencers**: Mathematical rhythms that always sound musical.
-   **Polyrhythms**: Different tracks running at different time signatures (e.g., 4/4 against 5/4).
-   **Probability**: "Chance" knobs for every step. "Maybe play this note."

## [Phase 6: The Nervous System (Modulation)](./step-by-step-phases/6-The-Nervous-System.md)
**Concept**: "Everything is Connected."
A static patch is dead. A living patch breathes.
-   **Global LFOs**: Slow, drifting waves that change the timbre over minutes.
-   **Chaos Generators**: Lorenz Attractors and Perlin Noise for unpredictable but natural evolution.
-   **Macro Mapping**: One knob to rule them all. "Day/Night" knob that shifts 50 parameters at once.

## [Phase 7: Spatial Audio (3D Soundscapes)](./step-by-step-phases/7-Spatial-Audio.md)
**Concept**: "Immersion."
Stereo is flat. We want depth.
-   **Binaural Panning**: Placing sounds *around* the user's head, not just left/right.
-   **Distance Attenuation**: Sounds get muffled as they move "away" in the virtual space.
-   **Doppler Effect**: Pitch shifting for moving sound sources.

## [Phase 8: The Library (Preset Ecosystem)](./step-by-step-phases/8-The-Library.md)
**Concept**: "Save Your World."
Users need to save their creations.
-   **Serialization**: robust saving of the entire graph state, engine settings, and visual layout.
-   **Curated Presets**: A bank of "Factory" sounds designed by us to show off the engine.
-   **Sharing**: Export patches as JSON strings or URLs.

## [Phase 9: The Stage (Performance Mode)](./step-by-step-phases/9-The-Stage.md)
**Concept**: "Play the Instrument."
For users who want to perform, not just listen.
-   **XY Pads**: Large performance surfaces for gesture control.
-   **Mute Groups**: Bring entire sections of the orchestra in and out.
-   **MIDI Integration**: Connect a physical keyboard or controller.

## [Phase 10: The Polish (Optimization & Release)](./step-by-step-phases/10-The-Polish.md)
**Concept**: "Silky Smooth."
-   **WASM Optimization**: Move heavy DSP to C++/Rust via WebAssembly for performance.
-   **Mobile Layout**: A dedicated touch interface for phones/tablets.
-   **Onboarding**: An interactive tutorial that teaches the user how to build a patch.
