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

All MuseScore format versions are supported:

- **v1.x** (`.mscx` v1.14) — No `<Score>` wrapper; root `<museScore>` contains everything.
  Uses `<cleflist><clef idx="N"/>` (numeric clef indices from v2 ClefType enum),
  `<keylist><key idx="N"/>` for initial key sig, `<subtype>` for KeySig, `<nom1>`/`<den>` for TimeSig.
  No `<voice>` wrappers — notes are direct `<Measure>` children.
- **v2.x** (`.mscx` v2.06) — No `<voice>` wrappers. Ties use `<Tie id="N">` + `<endSpanner id="N"/>`.
  Clef from `<Part><Staff><defaultClef>` and `<Instrument><clef staff="N">`.
- **v3.x** (`.mscx` v3.01–3.02) — `<voice>` wrappers around notes. `<Spanner type="Tie">` for ties.
  `<concertClefType>` / `<transposingClefType>` for clefs.
- **v4.x** (`.mscx` v4.00–4.30) — Same structure as v3. `<Part id="N">` with id attribute.

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

## Current Scope

### Handled
- Notes (single) and Chords (multi-note) with TPC enharmonic spelling
- Rests (including whole-bar "measure" rests with correct time sig duration)
- Clefs (treble, bass, alto, tenor, percussion; with octave shifts)
  - Default clef from Part definitions (`<defaultClef>`, `<clef staff="N">`, `<cleflist><clef idx="N"/>`)
  - v1.x numeric clef index mapping (MuseScore v2 ClefType enum)
- Key signatures (sharps/flats → key name + accidentals array)
  - C major (fifths=0) emitted when no KeySig element present
  - v1.x `<subtype>` and `<keylist><key idx="N"/>` for initial key from Part definition
- Time signatures
  - v1.x `<nom1>`/`<den>` fallback for `<sigN>`/`<sigD>`
- Tempo markings (both voice-level and measure-level)
- Barlines (single between measures, section close at end)
- Multi-staff scores (Part → staff with name, label, channel)
- Multi-voice (voices 2+ merged into token stream at correct tick positions, MS3/MS4)
- Title and composer extraction from metaTags and VBox
- Ties (MS3 `<Spanner type="Tie">`, MS2 `<Tie id>` + `<endSpanner>`, v1.x `<Tie>`)
- Tie end inference by pitch matching (for formats without explicit tie end markers)
- Transposing instruments (`tpc2` for written pitch, `transposeChromatic` adjustment)
- All format versions: v1.x, v2.x, v3.x, v4.x

### Remaining Tasks

#### High Priority — Would improve more files

**Cross-staff notes**
- Notes that move between treble and bass staves mid-measure (e.g., piano arpeggios)
- Affects: One Summer's Day (2+3 pitch errors in m39)
- MuseScore encodes these with `<move>` or `<Staff>` elements within a voice
- Would need to detect staff reassignment and adjust note position/clef accordingly

**Voice 3-4 support**
- Currently only voice 1 and voice 2 are parsed. Some complex scores use voices 3-4.
- Affects: Tchaikovsky (314 errors), Rachmaninoff (79), Chopin (2162)
- The Chopin concerto has measures with 3-4 simultaneous voices
- Implementation: extend the voice 2+ loop to handle all voice elements (already partially done)

**Grace notes**
- MuseScore uses `<grace/>` or `<acciaccatura/>` markers inside `<Chord>` elements
- Not currently detected in MuseScore parser (NWC grace notes are handled separately)

#### Medium Priority — Polish and completeness

**Dynamics and hairpins**
- `<Dynamic><subtype>mf</subtype>` and `<Spanner type="HairPin">`
- Parser currently skips these in the switch statement

**Articulations**
- `<Articulation><subtype>staccato</subtype>` etc.
- Parser currently skips these

**Slurs**
- `<Spanner type="Slur">` with next/prev location references
- Would need span tracking similar to ties

**Tuplets/triplets**
- `<Tuplet>` / `<endTuplet>` elements modify note durations
- MuseScore stores the ratio (e.g., 3:2) and the affected notes
- Would need to adjust tick counter for affected notes

**Repeats and voltas**
- `<Volta>` elements with endings info, `<startRepeat>` / `<endRepeat>` on measures
- Partially handled (barline styles) but volta brackets and repeat flow not implemented

**Lyrics**
- `<Lyrics><text>` with syllabic info (`<syllabic>begin/middle/end/single`)
- Would map to our lyrics array format

**Beaming**
- MuseScore has `<Beam>` elements that group notes
- Currently all beaming is set to auto (0) — renderer handles basic beaming
- Explicit beaming would improve complex rhythmic patterns

#### Low Priority — Edge cases

**Bracket/brace grouping**
- `<bracket type="1" span="2"/>` in Part Staff definitions
- Currently hardcoded: grand staff → brace, multi-staff → connect bars
- Should read actual bracket/brace definitions from Part

**Ottava span tracking (for playback)**
- `<Spanner type="Ottava">` with `<subtype>8va/8vb/15ma/15mb</subtype>`
- For rendering, our parser correctly reads written pitch (no adjustment needed)
- For MIDI playback, would need to track active ottava spans and shift pitch
- Not a rendering bug — webmscore exports sounding pitch, we export written pitch

**Enharmonic respelling**
- Some chromatic passages may have different enharmonic spellings between
  concert and transposed pitch (e.g., F# vs Gb)
- Minor visual difference, musically equivalent

## Comparison Test Results (as of last run)

Tested against webmscore's MusicXML export using `scripts/compare-parsers.js`:

```
19 files, 14 clean (4 OK + 10 INFO), 5 with diffs, 0 errors

[ OK ]  Gravity Falls, Tango (violin+viola), Libertango (str qt), UPDATED Libertango
[INFO]  Interstellar Easy, Astor Piazzolla, TANGO POR UNA CABEZA, Never Gonna Give You Up,
        Disney Pixar's Up (both versions), River Flows In You, Libertango solo, duet,
        Interstellar-Suite
[DIFF]  One Summer's Day (2 errs), Interstellar MS4 (9), Tchaikovsky (314),
        Rachmaninoff (79), Chopin (2162)
```

INFO = only voice 2+ unsupported content differs (parsing is correct for voice 1).
DIFF = real pitch/note differences, mostly from cross-staff notes and heavy multi-voice.

### Test tooling

| File | Purpose |
|------|---------|
| `scripts/compare-parsers.js` | Runs both parsers on all .mscz files, measure-based pitch comparison |
| `scripts/_webmscore-worker.js` | Subprocess helper: loads .mscz via webmscore WASM, exports MusicXML |
| `scripts/webmscore.js` | CLI utility: `bun scripts/webmscore.js <file> [info\|xml\|midi\|svg\|parts\|all]` |
| `scripts/patch-webmscore.js` | Postinstall: patches webmscore for Bun WASM loading |
| `musescores/*.mscz` | 19 test files covering v1.x, v2.x, v3.x, v4.x formats |

## Files

| File | Purpose |
|------|---------|
| `src/musescore-parser.js` | Main parser: XML walking, token production, TPC/pitch/timing logic |
| `src/zip.js` | Minimal ZIP extractor using browser `DecompressionStream` |
| `src/main.js` | Format detection routing, interpreter skip for MuseScore data |
| `src/loaders.js` | Passes filename through for format detection |
| `test/musescore-parser.test.js` | 63 unit tests for core conversion logic |
| `samples/SimpleScale.mscx` | Sample 2-staff MuseScore file for testing |
| `musescores/*.mscz` | 19 test files covering v1.x–v4.x formats |
| `scripts/compare-parsers.js` | Comparison: our parser vs webmscore MusicXML export |
| `scripts/_webmscore-worker.js` | Subprocess: webmscore WASM → MusicXML |
| `scripts/webmscore.js` | CLI: info, xml, midi, svg, parts, all |
| `scripts/patch-webmscore.js` | Postinstall: Bun WASM loading fix |
| `test/visual/webmscore.html` | Browser: webmscore reference renderer |
| `vendor/webmscore/` | Vendored webmscore WASM (local, no CDN) |
