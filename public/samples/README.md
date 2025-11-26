# Ambient Flow Sample Library

This folder contains audio samples for the Ambient Flow application.

## Folder Structure

```
samples/
├── catalog.json      # Sample metadata manifest
├── ambient/          # Nature sounds, weather, environments
├── textures/         # Noise, vinyl, tape hiss
├── tonal/            # Pads, drones, chords
└── percussion/       # Clicks, thuds, impacts
```

## Adding New Samples

1. **Prepare your audio file**
   - Format: OGG Vorbis (preferred), WAV, FLAC, or MP3
   - Sample rate: 44.1kHz or 48kHz
   - Bit depth: 16-bit or 24-bit
   - Channels: Mono or Stereo

2. **Place in appropriate category folder**

3. **Update `catalog.json`** with metadata:
   ```json
   {
     "id": "unique-sample-id",
     "name": "Display Name",
     "category": "ambient|texture|tonal|percussion|vocal|sfx",
     "tags": ["searchable", "tags"],
     "url": "/samples/category/filename.ogg",
     "format": "ogg",
     "fileSize": 123456,
     "duration": 10.5,
     "sampleRate": 48000,
     "channels": 2
   }
   ```

## Optional Metadata

For musical samples:
- `bpm`: Tempo for loops (e.g., 120)
- `key`: Musical key (e.g., "C minor")
- `rootNote`: MIDI note number for pitched samples (e.g., 60 = C4)

## File Size Guidelines

- Ambient loops: 30s - 2min, < 5MB
- Textures: 10s - 30s, < 2MB
- Tonal: 5s - 15s, < 1MB
- Percussion: < 1s, < 100KB

## License

All samples in this library should be:
- Royalty-free
- CC0 or similar permissive license
- Original creations or properly licensed
