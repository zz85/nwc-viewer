# soundfont-engine

SoundFont synthesizer engine with multiple WASM backends and MIDI scheduling for the browser.

Comes with a **built-in wavetable piano** that works instantly with zero setup. Load `.sf2` or `.sf3` soundfont files for full General MIDI support via three WASM backends.

## Quick Start

```javascript
import { SoundFontEngine } from './soundfont-engine/src/index.js';

// Works immediately - built-in piano, no files to load
const engine = new SoundFontEngine();
engine.noteOn(60, 0.8);   // Middle C
engine.noteOff(60);
```

## With a SoundFont

```javascript
const engine = new SoundFontEngine({
  backend: 'oxisynth',
  vendorPath: './soundfont-engine/vendor',
});

engine.on('loaded', ({ path }) => console.log('Ready:', path));
await engine.loadSoundFont('/soundfonts/GeneralMIDI.sf2');

engine.noteOn(60, 0.8);        // Piano
engine.programChange(0, 40);   // Switch to violin
engine.noteOn(67, 0.6);        // Play a G4 violin note
```

## Installation

No npm install needed. Copy or symlink the `soundfont-engine/` directory into your project and import directly:

```javascript
import { SoundFontEngine, MidiScheduler } from './soundfont-engine/src/index.js';
```

If serving from a web server, make sure the `vendor/` directory is accessible (it contains the WASM files).

## API Reference

### `SoundFontEngine`

The main facade. Wraps a single backend and exposes a unified MIDI synth interface.

#### Constructor

```javascript
const engine = new SoundFontEngine(options?)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backend` | `string \| BackendInstance` | `'wavetable'` | Backend to use (see [Backends](#backends)) |
| `audioContext` | `AudioContext` | auto-created | Share an existing AudioContext |
| `vendorPath` | `string` | `''` | Path to the `vendor/` directory (needed for WASM backends) |

#### SoundFont Loading

```javascript
// Load a single soundfont
await engine.loadSoundFont('/path/to/file.sf2');

// Load a stack - later files override earlier ones for matching presets
// Useful for: GM base + high-quality piano overlay
await engine.loadSoundFontStack([
  '/soundfonts/GeneralMIDI.sf2',
  '/soundfonts/SteinwayPiano.sf2',
]);
```

- **SF2** files are supported by all backends.
- **SF3** files are supported natively by `spessasynth`. For `oxisynth` and `rustysynth`, SF3 files are automatically converted to SF2 on the fly (via spessasynth_core).
- The `wavetable` backend ignores `loadSoundFont()` calls (it has no use for them).

#### Note Control

```javascript
engine.noteOn(midi, velocity?, channel?)   // velocity: 0.0-1.0, channel: 0-15
engine.noteOff(midi, channel?)
engine.allNotesOff(channel?)               // graceful stop with release envelopes
engine.allSoundOff()                       // immediate silence
```

#### MIDI Messages

```javascript
engine.programChange(channel, program)              // change instrument (0-127)
engine.controlChange(channel, controller, value)     // CC message (0-127)
engine.pitchBend(channel, value)                     // pitch bend (0-16383, center=8192)
```

Common control change numbers:
- `1` - Modulation
- `7` - Channel volume
- `10` - Pan
- `64` - Sustain pedal (0=off, 127=on)
- `121` - Reset all controllers

#### Lifecycle

```javascript
await engine.resume()          // resume AudioContext (required after user gesture)
engine.setBackend('oxisynth')  // hot-swap to a different backend (reloads required)
engine.dispose()               // release all resources
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `engine.ready` | `boolean` | Whether a soundfont is loaded (wavetable is always ready after first note) |
| `engine.audioContext` | `AudioContext` | The active AudioContext |
| `engine.capabilities` | `object` | `{ sf3, controlChange, pitchBend }` flags for current backend |
| `engine.activeSoundFont` | `string \| null` | Path of the currently active soundfont |

#### Events

```javascript
engine.on('loading', ({ path }) => { });   // soundfont fetch started
engine.on('loaded',  ({ path }) => { });   // soundfont ready to play
engine.on('error',   ({ path, error }) => { });
```

---

### `MidiScheduler`

AudioWorklet-based MIDI event scheduler. Runs on the audio thread for sample-accurate timing that survives browser background tabs.

```javascript
import { SoundFontEngine, MidiScheduler } from './soundfont-engine/src/index.js';

const engine = new SoundFontEngine({ backend: 'oxisynth', vendorPath: './soundfont-engine/vendor' });
await engine.loadSoundFont('/soundfonts/piano.sf2');

const scheduler = new MidiScheduler(engine);
await scheduler.init();

scheduler.load({
  notes: [
    { midi: 60, time: 0.0, duration: 0.5, velocity: 0.8, channel: 0 },
    { midi: 64, time: 0.5, duration: 0.5, velocity: 0.7, channel: 0 },
    { midi: 67, time: 1.0, duration: 0.5, velocity: 0.6, channel: 0 },
  ],
  controlChanges: [
    { time: 0.0, channel: 0, controller: 64, value: 127 },  // sustain on
    { time: 1.5, channel: 0, controller: 64, value: 0 },    // sustain off
  ],
});

// Hook into events for visualization
scheduler.on('noteOn',  (note) => highlightKey(note.midi));
scheduler.on('noteOff', (note) => unhighlightKey(note.midi));
scheduler.on('time',    (t) => updateProgressBar(t / scheduler.duration));
scheduler.on('end',     () => console.log('Playback finished'));

scheduler.play();
```

#### Constructor

```javascript
const scheduler = new MidiScheduler(target, options?)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | `SoundFontEngine \| BaseBackend` | required | Any object with `noteOn`/`noteOff`/`controlChange` |
| `options.workletPath` | `string` | auto-resolved | Path to `scheduler-worklet.js` |

#### Transport

```javascript
scheduler.play()           // start / resume playback
scheduler.pause()          // pause (retains position)
scheduler.stop()           // stop and reset to beginning
scheduler.seek(seconds)    // jump to position
scheduler.speed = 1.5      // playback speed multiplier
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `scheduler.ready` | `boolean` | Whether the AudioWorklet is initialized |
| `scheduler.playing` | `boolean` | Whether playback is active |
| `scheduler.currentTime` | `number` | Current position in seconds |
| `scheduler.duration` | `number` | Total duration of loaded data |
| `scheduler.speed` | `number` | Playback speed (read/write) |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `noteOn` | `NoteEvent` | A note should start playing |
| `noteOff` | `NoteEvent` | A note should stop |
| `cc` | `ControlChangeEvent` | A control change was fired |
| `time` | `number` | Current playback time (fires ~20x/sec) |
| `end` | none | Playback reached the end |

---

### Backends

| Backend | Key | SF2 | SF3 | CC | Pitch Bend | Dependencies |
|---------|-----|-----|-----|----|------------|-------------|
| **Wavetable Piano** | `'wavetable'` | - | - | - | - | None (built-in) |
| **OxiSynth** | `'oxisynth'` | Yes | Auto-convert | Yes | Yes | WASM |
| **SpessaSynth** | `'spessasynth'` | Yes | Native | Yes | Yes | JS + AudioWorklet |
| **RustySynth** | `'rustysynth'` | Yes | Auto-convert | - | - | WASM |

#### Using a specific backend directly

```javascript
import { OxiSynthBackend } from './soundfont-engine/src/backends/oxisynth.js';

const backend = new OxiSynthBackend({
  vendorPath: './soundfont-engine/vendor',
});
await backend.init();
await backend.loadSoundFont('/soundfonts/piano.sf2');
backend.noteOn(60, 0.8, 0);
```

#### Writing a custom backend

Extend `BaseBackend` and implement the abstract methods:

```javascript
import { BaseBackend } from './soundfont-engine/src/backends/base.js';

class MyBackend extends BaseBackend {
  get capabilities() {
    return { sf3: false, controlChange: true, pitchBend: false };
  }

  async _doInit() {
    // Initialize your synth engine
  }

  async _doLoadSoundFont(path, data) {
    // data is a Uint8Array of the SF2 file (SF3 is auto-converted for you)
  }

  _doNoteOn(midi, velocity, channel) { /* ... */ }
  _doNoteOff(midi, channel) { /* ... */ }
  _doProgramChange(channel, program) { /* ... */ }
  _doControlChange(channel, controller, value) { /* ... */ }
  _doDispose() { /* ... */ }
}

// Use it
const engine = new SoundFontEngine({ backend: new MyBackend() });
```

`BaseBackend` provides for free:
- AudioContext management (create or accept external)
- Pending command queue (commands before `ready` are buffered and flushed)
- SF3 auto-conversion (via spessasynth_core)
- Event emission (`loading`, `loaded`, `error`)
- `dispose()` with proper cleanup

---

## Data Types

### NoteEvent

```typescript
{
  midi: number;        // MIDI note number (0-127)
  time: number;        // Start time in seconds
  duration: number;    // Duration in seconds
  velocity: number;    // 0.0-1.0
  channel: number;     // MIDI channel (0-15)
}
```

### ControlChangeEvent

```typescript
{
  time: number;        // Time in seconds
  channel: number;     // MIDI channel (0-15)
  controller: number;  // Controller number (0-127)
  value: number;       // Value (0-127)
}
```

## TypeScript

Full type declarations are included at `types/index.d.ts`.

## Project Structure

```
soundfont-engine/
├── src/
│   ├── index.js              # Public exports
│   ├── engine.js             # SoundFontEngine facade
│   ├── events.js             # EventEmitter
│   ├── scheduler.js          # MidiScheduler
│   ├── scheduler-worklet.js  # AudioWorklet processor
│   └── backends/
│       ├── base.js           # BaseBackend (extend this for custom backends)
│       ├── oxisynth.js       # OxiSynth WASM backend
│       ├── spessasynth.js    # SpessaSynth JS/AudioWorklet backend
│       ├── rustysynth.js     # RustySynth WASM backend
│       └── wavetable.js      # Built-in wavetable piano
├── types/
│   └── index.d.ts            # TypeScript declarations
├── vendor/
│   ├── oxisynth/             # OxiSynth WASM binaries
│   ├── rustysynth/           # RustySynth WASM binaries
│   └── spessasynth/          # SpessaSynth JS bundles + AudioWorklet processor
└── package.json
```
