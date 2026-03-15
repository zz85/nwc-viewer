# MuseScore Import — Architecture

## Data Flow

```
.mscz (ZIP) ──→ zip.js (DecompressionStream) ──→ .mscx XML
                                                      │
.mscx (raw XML) ─────────────────────────────────────┘
                                                      ▼
                        musescore-parser.js (DOMParser + token conversion)
                                                      │
                                                      ▼
                        { info, score: { staves: [{ tokens }] } }
                        (same shape as NWC parser output, with _source: 'musescore')
                                                      │
                              ┌────── skip interpret() ───────┐
                              ▼                               │
                        setDataAndRender() ──→ rerender() ──→ score() ──→ canvas
```

MuseScore files produce fully-resolved tokens (timing, pitch, accidentals all computed
during parsing), so the interpreter step is skipped entirely. The `_source: 'musescore'`
flag on the data object signals this to `rerender()`.

## Format Support

Both MuseScore 3 (`.mscx` v3.x) and MuseScore 4 (`.mscx` v4.x) are supported.
The core music content structure (`<Measure><voice><Chord>/<Rest>`) is largely the
same between versions; minor differences in element nesting and attribute names are
handled with fallback lookups.

- **`.mscz`** — ZIP archive containing a `.mscx` XML file. Decompressed using the
  browser's `DecompressionStream('deflate-raw')` API (no external dependencies).
- **`.mscx`** — Raw XML parsed with the browser's `DOMParser`.

## Key Mappings

### TPC (Tonal Pitch Class) → Note Name + Accidental

MuseScore uses TPC values that follow the circle of fifths:

```
TPC -1..5  = Fbb..Bbb (double flat)
TPC  6..12 = Fb..Bb   (flat)
TPC 13..19 = F..B     (natural)
TPC 20..26 = F#..B#   (sharp)
TPC 27..33 = Fx..Bx   (double sharp)

noteNames = ['F','C','G','D','A','E','B']
name = noteNames[(tpc + 1) % 7]
accidentalLevel = floor((tpc + 1) / 7) - 2
```

### MIDI Pitch + TPC → Octave

The TPC gives the enharmonic spelling (note name + accidental), and the MIDI pitch
gives the absolute pitch. The octave is derived:

```
SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }
baseSemitone = SEMITONES[name] + accidentalSemitones
octave = round((midiPitch - baseSemitone) / 12) - 1
```

### Pitch → Staff Position

NWC uses staff-line positions where 0 = middle line of the staff. The position is
computed from the absolute diatonic pitch and the clef offset:

```
diatonicPitch = octave * 7 + NOTE_INDEX[name]
position = diatonicPitch - CLEF_PITCH_OFFSETS[clef]

CLEF_PITCH_OFFSETS:
  treble = 34 (B4 at position 0)
  bass   = 22 (D3 at position 0)
  alto   = 28 (C4 at position 0)
  tenor  = 26 (A3 at position 0)
```

### Duration Type → Numeric Duration

```
'whole'→1, 'half'→2, 'quarter'→4, 'eighth'→8, '16th'→16, '32nd'→32, '64th'→64
```

Dots are handled via Fraction multiplication: single dot = ×3/2, double dot = ×7/4.

### Clef Type Mapping

```
G     → treble         F     → bass
G8vb  → treble (8vb)   F8vb  → bass (8vb)
G8va  → treble (8va)   C3    → alto
C4    → tenor           PERC  → percussion
```

## Current Scope (Minimal First Pass)

### Handled
- Notes (single) and Chords (multi-note) with TPC enharmonic spelling
- Rests (including whole-bar "measure" rests)
- Clefs (treble, bass, alto, tenor, percussion; with octave shifts)
- Key signatures (sharps/flats → key name + accidentals array)
- Time signatures
- Tempo markings
- Barlines (single between measures, section close at end)
- Multi-staff scores (Part → staff with name, label, channel)
- Title and composer extraction from metaTags and VBox
- Ties (from Spanner elements)

### Planned for Future Iterations
- Dynamics and hairpins (crescendo/diminuendo)
- Lyrics with syllabic info
- Articulations (staccato, accent, tenuto, marcato)
- Explicit beaming (currently auto/0 — renderer handles basic beaming)
- Slurs
- Multi-voice (voices 2-4, mapped via NWC layering)
- Tuplets/triplets
- Repeats, voltas, flow directions
- Grace notes
- Bracket/brace grouping from part structure

## Files

| File | Purpose |
|------|---------|
| `src/musescore-parser.js` | Main parser: XML walking, token production, TPC/pitch/timing logic |
| `src/zip.js` | Minimal ZIP extractor using browser `DecompressionStream` |
| `src/main.js` | Format detection routing, interpreter skip for MuseScore data |
| `src/loaders.js` | Passes filename through for format detection |
| `test/musescore-parser.test.js` | 63 unit tests for core conversion logic |
| `samples/SimpleScale.mscx` | Sample 2-staff MuseScore file for testing |
