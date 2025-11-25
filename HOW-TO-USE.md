# Ambient Flow - How to Use

A generative audio workstation for creating ambient soundscapes.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## Sample Files Setup

The granular synthesis and convolution reverb engines require audio samples. Place them in the `public/samples/` directory.

### Directory Structure

```
public/
└── samples/
    ├── textures/           # For Granular Synthesis (Texture Node)
    │   ├── rain-roof.wav
    │   ├── forest-wind.wav
    │   ├── ocean-waves.wav
    │   └── vinyl-crackle.wav
    │
    ├── impulses/           # For Convolution Reverb
    │   ├── cathedral.wav
    │   ├── small-room.wav
    │   ├── cave.wav
    │   └── plate.wav
    │
    └── oneshots/           # For Physical Modeling Exciters
        ├── click.wav
        ├── thud.wav
        └── pluck.wav
```

### Sample Requirements

| Type | Format | Duration | Notes |
|------|--------|----------|-------|
| **Textures** | WAV/MP3, 44.1kHz, Stereo | 5-60 seconds | Loopable ambient sounds work best |
| **Impulse Responses** | WAV, 44.1kHz, Stereo | 0.5-6 seconds | True stereo IRs for best quality |
| **Oneshots** | WAV, 44.1kHz, Mono/Stereo | < 500ms | Short transients for exciters |

### Finding Free Samples

- **Freesound.org** - CC0/CC-BY field recordings and IRs
- **OpenAir** (openairlib.net) - Free impulse responses
- **BBC Sound Effects** - Public domain field recordings

### Testing Without Samples

The app includes fallback generators for testing:

```typescript
// Generate a test texture (pink noise)
sampleManager.generateTestSample('test-texture', 2); // 2 second duration

// Generate synthetic reverb IR
convolutionReverb.generateSyntheticIR(2, 0.5); // 2 seconds, medium decay
```

---

## Application Modes

### Classic Mode (Default)

The main control panel with:
- **Play/Stop** - Start/stop the audio engine
- **Scene Selector** - Choose preset soundscapes
- **Volume** - Master output level
- **Module Cards** - Rhythm, Atmosphere, Modulation, Spatial controls

### Graph Mode

A visual node-based patching interface:
- **Module Dock** - Drag modules onto the canvas
- **Connections** - Draw cables between nodes
- **Node Parameters** - Click nodes to adjust settings

#### Available Nodes

| Node | Label | Description |
|------|-------|-------------|
| Oscillator | OSC | Basic sine wave generator |
| String Synth | STR | Karplus-Strong physical modeling |
| Texture | TXT | Granular synthesis cloud |
| Resonator | RES | Modal synthesis (Glass/Wood/Metal) |
| Filter | FLT | Lowpass/highpass filtering |
| Envelope | ENV | ADSR envelope generator |
| Sequencer | SEQ | Step sequencer |
| Physics | PHY | Bouncing ball modulation source |
| Output | OUT | Final audio output |

---

## Audio Engines

### Atmosphere Engine
Long-form textures and ambient beds. Uses:
- Brown/pink noise generators
- Field recording playback
- Convolution reverb

### Synth Engine
Event-based synthesis. Uses:
- Oscillators
- Karplus-Strong strings
- Modal resonators
- Envelopes and sequencers

### Granular Engine (NEW)
Cloud-like textures from samples:
- **Position** - Where to read from the sample
- **Spray** - Randomness of position
- **Density** - Grains per second (1-100 Hz)
- **Size** - Grain duration (10-500ms)
- **Pitch** - Playback rate (0.25x - 4x)

### Convolution Reverb (NEW)
Realistic acoustic spaces:
- **Mix** - Wet/dry balance
- **Pre-delay** - Initial delay (0-500ms)
- **High Damp** - Treble rolloff
- **Low Damp** - Bass rolloff

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Stop |
| `G` | Toggle Graph Mode |
| `Esc` | Exit Graph Mode |

---

## Performance Tips

1. **Reduce 3D Complexity** - The background visualizer uses GPU resources
2. **Limit Concurrent Grains** - Keep density under 50 for smooth performance
3. **Single Global Reverb** - Use one convolution reverb as a send bus
4. **Close Other Tabs** - Web Audio competes for system resources

---

## Troubleshooting

### No Sound
- Click the Play button (browser requires user interaction for audio)
- Check the master volume slider
- Ensure your system audio is not muted

### Crackling/Glitches
- Lower the grain density in Texture nodes
- Reduce the number of active nodes
- Close other browser tabs

### Samples Not Loading
- Verify files are in `public/samples/` with correct subdirectories
- Check browser console for 404 errors
- Ensure files are valid WAV/MP3 format

### Graph Mode Canvas Not Visible
- Refresh the page
- Check that the browser supports WebGL

---

## Development

### Adding New Samples

1. Place audio file in appropriate `public/samples/` subdirectory
2. Add entry to `SAMPLE_LIBRARY` in `src/audio/engine/SampleManager.ts`:

```typescript
{
  id: 'texture-my-sample',
  name: 'My Sample',
  url: '/samples/textures/my-sample.wav',
  category: 'texture',
}
```

### Creating New Nodes

1. Create component in `src/components/nodegraph/nodes/`
2. Register in `nodeTypes` in `NodeEditor.tsx`
3. Add to `MODULES` array in `NodeSidebar.tsx`

---

## License

MIT License - See LICENSE file for details.
