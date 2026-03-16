# MusicXML Import — Architecture & Implementation Plan

## Goal

Add MusicXML import support to Notably, enabling the viewer to load `.musicxml`,
`.mxl` (compressed), and `.xml` files from any source — MuseScore, Finale,
Sibelius, Dorico, LilyPond, etc.

Optionally, route MuseScore files through the vendored **webmscore** WASM library
(`score.saveXml()`) to produce MusicXML, then feed that into the same importer.
This gives full-fidelity MuseScore import without maintaining a hand-written
MuseScore XML parser.

---

## Data Flow

### Path A: Native MusicXML files

```
.mxl (ZIP) ──→ zip.js (DecompressionStream) ──→ .musicxml XML
                                                      │
.musicxml / .xml (raw XML) ──────────────────────────┘
                                                      ▼
                    musicxml-import.js (DOMParser + token conversion)
                                                      │
                                                      ▼
                    { info, score: { staves: [{ tokens }] } }
                    (same shape as NWC/MuseScore output, _source: 'musicxml')
                                                      │
                              ┌────── skip interpret() ───────┐
                              ▼                               │
                    setDataAndRender() ──→ rerender() ──→ score() ──→ canvas
```

### Path B: MuseScore via webmscore (optional enhancement)

```
.mscz / .mscx ──→ WebMscore.load(format, data)
                         │
                         ▼
                   score.saveXml()  →  MusicXML string
                         │
                         ▼
                   musicxml-import.js  →  internal format  →  render
```

Both paths converge on the same `parseMusicXML()` function.

---

## MusicXML Format Summary

MusicXML 4.0 `<score-partwise>` is the dominant format. Structure:

```xml
<score-partwise version="4.0">
  <work><work-title>...</work-title></work>
  <movement-title>...</movement-title>
  <identification>
    <creator type="composer">...</creator>
    <rights>...</rights>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
      <midi-instrument id="P1-I1">
        <midi-channel>1</midi-channel>
        <midi-program>1</midi-program>
      </midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      ...
    </measure>
  </part>
</score-partwise>
```

### Key Differences from MuseScore Native XML

| Concept | MuseScore XML | MusicXML |
|---------|--------------|----------|
| **Pitch** | MIDI number + TPC (circle of fifths) | `<step>C</step><alter>1</alter><octave>4</octave>` (explicit) |
| **Duration** | `<durationType>quarter</durationType>` (string only) | `<duration>1</duration>` (integer ticks) + `<type>quarter</type>` (display) |
| **Divisions** | Implicit | `<divisions>` per quarter note in `<attributes>` |
| **Chords** | `<Chord>` wraps multiple `<Note>` children | `<chord/>` empty element on 2nd+ notes of same chord |
| **Voices** | `<voice>` child of `<Measure>` | `<voice>N</voice>` child of `<note>`, uses `<backup>`/`<forward>` for timing |
| **Barlines** | Implicit (one per `<Measure>` boundary) + attributes | Explicit `<barline location="right/left">` with `<bar-style>`, `<repeat>`, `<ending>` |
| **Clef/Key/Time** | Inline elements in voice | Grouped in `<attributes>` blocks |
| **Directions** | `<Tempo>`, `<Dynamic>`, `<Spanner>` | `<direction><direction-type>` containing `<metronome>`, `<dynamics>`, `<words>`, `<wedge>` etc. |
| **Compressed** | `.mscz` (ZIP with `.mscx`) | `.mxl` (ZIP with `META-INF/container.xml` pointing to rootfile) |

**Pitch handling is simpler in MusicXML** — `<step>` gives the note name directly
(`C`/`D`/`E`/`F`/`G`/`A`/`B`), `<alter>` gives the chromatic alteration (`-1` for
flat, `1` for sharp, etc.), and `<octave>` gives the octave number. No TPC decoding
needed.

---

## Files to Create / Modify

| File | Action | Est. Lines |
|------|--------|-----------|
| `src/music-import-utils.js` | **Create** — shared constants + helpers | ~180 |
| `src/musescore-parser.js` | **Modify** — import from utils, remove duplicated code | Net −120 |
| `src/musicxml-import.js` | **Create** — MusicXML parser | ~550 |
| `src/main.js` | **Modify** — add import, format detection, interpreter skip | +12 |
| `index.html` | **Modify** — update file input `accept` attribute | +1 |
| `test/musicxml-import.test.js` | **Create** — unit tests | ~400 |

---

## Step 0: Extract Shared Helpers → `src/music-import-utils.js`

Several constants and functions in `musescore-parser.js` are pure music-domain
logic, not MuseScore-specific. Extract them into a shared utility module so both
parsers can reuse them.

### Constants to extract

From `src/musescore-parser.js`:

| Constant | Line | Description |
|----------|------|-------------|
| `DURATION_MAP` | 19 | Duration type string → numeric (`'quarter'` → `4`) |
| `DURATION_FRACTIONS` | 37 | Duration type string → `[numerator, denominator]` |
| `CLEF_PITCH_OFFSETS` | 78 | Clef name → half-space offset from bottom of piano |
| `OCTAVE_START`, `OCTAVE_NOTES` | 76–77 | Used by `CLEF_PITCH_OFFSETS` |
| `NOTE_NAMES`, `NOTE_INDEX` | 86–87 | `['C','D',...]` and `{C:0, D:1, ...}` |
| `SHARP_ORDER`, `FLAT_ORDER` | 157–158 | Accidental order for key signatures |
| `KEY_NAMES_SHARP`, `KEY_NAMES_FLAT` | 161–162 | Fifths count → key name |
| `ACCIDENTAL_STRINGS` | 101 | Alteration level → accidental character |

### Functions to extract

| Function | Line | Signature |
|----------|------|-----------|
| `computePosition` | 121 | `(name, octave, clef, octaveShift) → number` |
| `buildKeySigToken` | 164 | `(accidentalCount, clef, clefOctave) → token` |
| `makeDurationFraction` | 1000 | `(durType, dots) → Fraction` |
| `setTiming` | 1016 | `(token, durFraction, tickCounter, tabCounter) → void` |
| `makeBarline` | 969 | `(style, tickCounter, tabCounter) → token` |
| `makeWholeBarRest` | 943 | `(timeSigN, timeSigD, tickCounter, tabCounter) → token` |

### XML helpers to extract

| Function | Line | Signature |
|----------|------|-----------|
| `xmlText` | 202 | `(parent, tagName) → string` |
| `xmlInt` | 208 | `(parent, tagName, defaultVal) → number` |
| `xmlFloat` | 215 | `(parent, tagName, defaultVal) → number` |
| `directChildren` | 222 | `(parent, tagName) → Element[]` |

### Refactor procedure

1. Create `src/music-import-utils.js` with all the above as named exports
2. Update `src/musescore-parser.js` to import from `./music-import-utils.js`
3. Remove the now-duplicated definitions from `musescore-parser.js`
4. Run `bun test` — all 530+ existing tests must pass unchanged

---

## Step 1: Create `src/musicxml-import.js`

### 1a. Format Detection

```js
export function isMusicXMLFile(buffer, filename) → boolean
```

Detection logic (in order):
1. If `filename` ends with `.musicxml` or `.mxl` → `true`
2. If `filename` ends with `.xml`:
   - Decode first 500 bytes as UTF-8
   - Check for `<score-partwise` or `<score-timewise` → `true`
   - Check for `<museScore` → `false` (it's MuseScore, not MusicXML)
3. If buffer starts with ZIP magic (`PK\x03\x04`) and filename is `.mxl` → `true`
4. If no filename: decode first 500 bytes, check for MusicXML root elements
5. Otherwise → `false`

### 1b. Entry Point

```js
export async function parseMusicXML(bufferOrString, filename) → Promise<Object>
```

Accepts either an `ArrayBuffer` (file bytes) or a `string` (XML text — for the
webmscore `saveXml()` pipeline).

Logic:
1. If input is `ArrayBuffer`:
   - Detect `.mxl` (ZIP): extract using `unzip()` from `zip.js`
     - Look for `META-INF/container.xml` → parse to find `<rootfile full-path="...">`
     - Fallback: scan for first file ending in `.musicxml` or `.xml`
   - Otherwise: decode as UTF-8 string
2. Parse XML string with `new DOMParser().parseFromString(xml, 'text/xml')`
3. Check for parse errors (`<parsererror>`)
4. Detect root element:
   - `<score-partwise>` → proceed to `convertScorePartwise(doc)`
   - `<score-timewise>` → throw `'score-timewise format not yet supported'`
     (or implement a transpose pass — deferred to Phase 3)
5. Return canonical internal data object

### 1c. Score Header Parser

```js
function convertScorePartwise(doc) → Object
```

Maps MusicXML header elements to internal `info` structure:

| MusicXML Path | Internal Field |
|---------------|---------------|
| `<work><work-title>` | `info.title` |
| `<movement-title>` | `info.title` (fallback if no work-title) |
| `<identification><creator type="composer">` | `info.author` |
| `<identification><creator type="lyricist">` | `info.lyricist` |
| `<identification><rights>` (1st) | `info.copyright1` |
| `<identification><rights>` (2nd) | `info.copyright2` |
| `<part-list><score-part>` | Part metadata array |

Part metadata extraction from `<score-part>`:

| MusicXML | Internal |
|----------|----------|
| `<part-name>` | `staff_name` |
| `<part-abbreviation>` | `staff_label` |
| `id` attribute | Part ID for matching to `<part>` elements |
| `<midi-instrument><midi-channel>` | `channel` (value − 1) |
| `<midi-instrument><midi-program>` | `patchName` (value − 1) |

Then walks each `<part>` element, matching by `id` to the part metadata, and
calls `convertPart()`.

Returns:
```js
{
  header: { version: 'MusicXML X.X', company: 'MusicXML', product: 'MusicXML' },
  info: { title, author, lyricist, copyright1, copyright2, comments: '' },
  score: { allowLayering: false, staves: [...] },
  _source: 'musicxml',
}
```

### 1d. Part Conversion

```js
function convertPart(partEl, partMeta, partIndex, totalParts) → staff object
```

Maintains running state across measures:

```js
const state = {
  currentClef: 'treble',
  currentClefOctave: 0,
  currentTimeSigN: 4,
  currentTimeSigD: 4,
  currentDivisions: 1,       // MusicXML <divisions> per quarter note
  tickCounter: new Fraction(0, 1),
  tabCounter: new Fraction(0, 1),
  hadInitialClef: false,
  hadInitialTimeSig: false,
  hadInitialKeySig: false,
  inTriplet: false,          // tracking triplet groups
  tripletState: 0,           // 0=none, 1=start, 2=continue, 3=end
}
```

For each `<measure>`:
1. Walk child elements in document order
2. Dispatch based on element tag name (see table in §1e–1h)
3. At measure boundary (except last): emit implicit barline token
4. At final measure: emit section-close barline

After processing all measures, ensure initial clef/timesig/keysig tokens exist
(same logic as MuseScore parser lines 621–651).

Returns staff object matching canonical shape:
```js
{
  staff_name, staff_label, group_name: '',
  channel, patchName,
  bracketWithNext: false,
  braceWithNext: (multi-staff part heuristic),
  connectBarsWithNext: (partIndex < totalParts - 1),
  layerWithNext: false,
  boundaryTop: -12, boundaryBottom: 12,
  endingBar: 0, lines: 5,
  lyrics: [...],  // populated from <lyric> elements
  tokens: [...],
}
```

### 1e. Attributes Handler

```js
function handleAttributes(attrEl, state, tokens) → void
```

Processes `<attributes>` children in order:

**`<divisions>`**
```js
state.currentDivisions = xmlInt(attrEl, 'divisions', state.currentDivisions)
```

**`<clef>`** (may appear multiple via `number` attribute for multi-staff parts)
```js
const sign = xmlText(clefEl, 'sign')     // 'G', 'F', 'C', 'percussion'
const line = xmlInt(clefEl, 'line', 2)   // staff line number
const octChange = xmlInt(clefEl, 'clef-octave-change', 0)
```

Mapping table:

| sign + line | Internal clef |
|-------------|--------------|
| G + 2 | `treble` |
| F + 4 | `bass` |
| C + 3 | `alto` |
| C + 4 | `tenor` |
| C + 1 | `alto` (soprano — approximate) |
| percussion | `percussion` |

Octave shift: `octChange === 1` → octave up (1), `octChange === -1` → octave down (2).

Produces token:
```js
{ type: 'Clef', clef, octave: octaveShift, tickValue, tabValue, tabUntilValue }
```

**`<key>`**
```js
const fifths = xmlInt(keyEl, 'fifths', 0)
const token = buildKeySigToken(fifths, state.currentClef, state.currentClefOctave)
// set tickValue, tabValue, tabUntilValue
```

**`<time>`**
```js
const beats = xmlInt(timeEl, 'beats', 4)
const beatType = xmlInt(timeEl, 'beat-type', 4)
const symbol = timeEl.getAttribute('symbol')  // 'common', 'cut', or null
```

Produces token:
```js
{
  type: 'TimeSignature',
  signature: symbol === 'common' ? 'Common' : symbol === 'cut' ? 'AllaBreve' : `${beats}/${beatType}`,
  group: beats,
  beat: beatType,
  tickValue, tabValue, tabUntilValue,
}
```

### 1f. Note Handler

```js
function handleNote(noteEl, state, tokens) → void
```

This is the most complex handler. Detailed extraction:

**Step 1: Detect rest vs pitched note**
```js
const isRest = noteEl.getElementsByTagName('rest').length > 0
const isChord = noteEl.getElementsByTagName('chord').length > 0
const isGrace = noteEl.getElementsByTagName('grace').length > 0
```

**Step 2: Extract pitch** (for non-rest notes)
```js
const pitchEl = noteEl.getElementsByTagName('pitch')[0]
const step = xmlText(pitchEl, 'step')       // 'C','D','E','F','G','A','B'
const alter = xmlInt(pitchEl, 'alter', 0)    // -2, -1, 0, 1, 2
const octave = xmlInt(pitchEl, 'octave', 4)
const position = computePosition(step, octave, state.currentClef, state.currentClefOctave)
```

Accidental from alter value:
```js
const ALTER_TO_ACCIDENTAL = { '-2': 'v', '-1': 'b', '0': '', '1': '#', '2': 'x' }
const accidental = ALTER_TO_ACCIDENTAL[String(alter)] || ''
const accidentalValue = accidental || undefined
```

**Step 3: Extract duration**
```js
const durType = xmlText(noteEl, 'type') || 'quarter'
const duration = DURATION_MAP[durType] || 4
const dots = noteEl.getElementsByTagName('dot').length
const durFraction = makeDurationFraction(durType, dots)
```

For whole-measure rests, MusicXML may omit `<type>` and just have `<duration>`
equal to the full measure. Detect via: `isRest && !xmlText(noteEl, 'type')`.

**Step 4: Extract ties**
```js
let tie = 0, tieEnd = 0
for (const tieEl of noteEl.getElementsByTagName('tie')) {
  if (tieEl.getAttribute('type') === 'start') tie = 1
  if (tieEl.getAttribute('type') === 'stop') tieEnd = 1
}
```

**Step 5: Extract beam**
```js
let beam = 0
const beamEl = noteEl.getElementsByTagName('beam')[0]
if (beamEl) {
  const beamText = beamEl.textContent.trim()
  beam = { 'begin': 1, 'continue': 2, 'end': 3 }[beamText] || 0
}
```

**Step 6: Extract notations** (articulations, slur, tuplet, fermata)
```js
const notationsEl = noteEl.getElementsByTagName('notations')[0]
let staccato = 0, accent = 0, tenuto = 0, marcato = 0
let staccatissimo = 0, fermata = 0, sforzando = 0
let slur = 0

if (notationsEl) {
  // Articulations
  const artsEl = notationsEl.getElementsByTagName('articulations')[0]
  if (artsEl) {
    if (artsEl.getElementsByTagName('staccato').length) staccato = 1
    if (artsEl.getElementsByTagName('accent').length) accent = 1
    if (artsEl.getElementsByTagName('tenuto').length) tenuto = 1
    if (artsEl.getElementsByTagName('strong-accent').length) marcato = 1
    if (artsEl.getElementsByTagName('staccatissimo').length) staccatissimo = 1
  }

  // Fermata
  if (notationsEl.getElementsByTagName('fermata').length) fermata = 1

  // Slur
  const slurEl = notationsEl.getElementsByTagName('slur')[0]
  if (slurEl) {
    slur = { 'start': 1, 'stop': 2, 'continue': 3 }[slurEl.getAttribute('type')] || 0
  }

  // Tuplet
  const tupletEl = notationsEl.getElementsByTagName('tuplet')[0]
  if (tupletEl) {
    const tupType = tupletEl.getAttribute('type')
    if (tupType === 'start') state.tripletState = 1   // triplet start
    else if (tupType === 'stop') state.tripletState = 3  // triplet end
  }
}
```

**Step 7: Triplet tracking**

MusicXML marks tuplets with both `<time-modification>` (on every note in the
group) and `<tuplet type="start/stop">` (on first/last). Use the tuplet notations
to set the `triplet` field:

```js
const hasTimeModification = noteEl.getElementsByTagName('time-modification').length > 0
let triplet = 0
if (hasTimeModification) {
  if (state.tripletState === 1) { triplet = 1; state.tripletState = 2 }
  else if (state.tripletState === 3) { triplet = 3; state.tripletState = 0 }
  else { triplet = 2 }  // middle of group
}
```

**Step 8: Stem direction**
```js
const stemText = xmlText(noteEl, 'stem')
const stem = stemText === 'up' ? 1 : stemText === 'down' ? 2 : 0
```

**Step 9: Lyrics**

MusicXML `<lyric>` elements are children of `<note>`, one per verse number:
```xml
<lyric number="1">
  <syllabic>begin</syllabic>
  <text>Glo</text>
</lyric>
```

Collect per-verse syllable arrays on the staff:
```js
for (const lyricEl of noteEl.getElementsByTagName('lyric')) {
  const verseNum = parseInt(lyricEl.getAttribute('number') || '1', 10) - 1
  const syllabic = xmlText(lyricEl, 'syllabic')  // single, begin, middle, end
  const text = xmlText(lyricEl, 'text')
  const prefix = (syllabic === 'middle' || syllabic === 'end') ? '-' : ''
  // Push to lyrics[verseNum] array
  state.lyrics[verseNum] = state.lyrics[verseNum] || []
  state.lyrics[verseNum].push(prefix + text)
}
```

**Step 10: Assemble token**

For a **rest**:
```js
{ type: 'Rest', position: 0, duration, dots, triplet }
```

For a **single note** (no `<chord/>` on this element or next):
```js
{
  type: 'Note', position, duration, dots,
  accidental, name: step, octave, accidentalValue,
  tie, tieEnd, slur, beam, stem, triplet,
  staccato, accent, tenuto, marcato, staccatissimo, sforzando, fermata,
  grace: isGrace ? 1 : 0,
  lyricSyllable: 0,
}
```

For a **chord** (when `<chord/>` is present, meaning this note belongs to the
previous note's attack):
- Find the last token in `tokens` (should be a Note or Chord)
- If it's a `Note`, convert it to a `Chord`: move its properties into a
  `notes[]` array, change `type` to `'Chord'`, add `chords` count
- Append this new note to the `notes[]` array
- Sort `notes[]` by position (low to high — NWC convention)

**Step 11: Timing**

For non-grace, non-chord notes/rests:
```js
setTiming(token, durFraction, state.tickCounter, state.tabCounter)
```

Grace notes get timing values but do NOT advance counters:
```js
token.tickValue = state.tickCounter.value()
token.tabValue = state.tabCounter.value()
token.tabUntilValue = state.tabCounter.value()
token.durValue = durFraction.clone()
```

Chord notes share timing with the previous token (already set).

### 1g. Direction Handler

```js
function handleDirection(dirEl, state, tokens) → void
```

Walks `<direction-type>` children:

**Tempo / Metronome**
```xml
<direction>
  <direction-type>
    <metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome>
  </direction-type>
  <sound tempo="120"/>
</direction>
```

→ Tempo token:
```js
{
  type: 'Tempo',
  position: -7,        // above staff
  placement: 0,
  duration: bpm,       // from <per-minute> or <sound tempo>
  note: DURATION_MAP[beatUnit],  // 4 for quarter, 8 for eighth, etc.
  tickValue, tabValue, tabUntilValue,
}
```

Check for `<beat-unit-dot/>` — if present, it's a dotted tempo base.

**Dynamics**
```xml
<direction-type><dynamics><mf/></dynamics></direction-type>
```

→ Dynamic token:
```js
{
  type: 'Dynamic',
  dynamic: dynamicName,  // tag name of child element: 'ppp','pp','p','mp','mf','f','ff','fff'
  position: 8,           // below staff
  style: DYNAMIC_STYLE_MAP[dynamicName],
  tickValue, tabValue, tabUntilValue,
}
```

**Wedge (Hairpin)**
```xml
<direction-type><wedge type="crescendo"/></direction-type>
```

→ DynamicVariance token:
```js
{
  type: 'DynamicVariance',
  style: type === 'crescendo' ? 0 : type === 'diminuendo' ? 1 : 2,
  tickValue, tabValue, tabUntilValue,
}
```

`type="stop"` closes the active hairpin (no token emitted — the layout engine
handles span sizing).

**Words / Text**
```xml
<direction-type><words>rit.</words></direction-type>
```

→ PerformanceStyle or Text token depending on content. Known performance styles:
`Legato`, `Staccato`, `rit.`, `rall.`, `accel.`, `a tempo`, `Tempo Primo`.

**Coda / Segno**
```xml
<direction-type><coda/></direction-type>
```

→ Flow token:
```js
{ type: 'Flow', style: 0 }  // 0=Coda, 1=Segno
```

**Flow directions from `<sound>` attributes:**
| `<sound>` attribute | Flow style |
|--------------------|-----------|
| `fine=""` | 2 (Fine) |
| `tocoda=""` | 3 (ToCoda) |
| `dacapo="yes"` | 4 (DaCapo) |
| `dalsegno=""` | 7 (DalSegno) |

These may also appear as `<words>` text (e.g., "D.C. al Coda" → style 5).

**Pedal**
```xml
<direction-type><pedal type="start"/></direction-type>
```

→ Pedal token:
```js
{ type: 'Pedal', sustain: type === 'start' ? 1 : 0, pos: 8, placement: 0 }
```

### 1h. Barline Handler

```js
function handleBarline(barlineEl, state, tokens) → void
```

MusicXML barlines have a `location` attribute (`left` or `right`) and contain:
- `<bar-style>`: visual style
- `<repeat direction="forward|backward">`: repeat barline
- `<ending type="start|stop" number="1,2,...">`: volta bracket

Mapping:

| MusicXML bar-style | repeat | Internal barline code |
|-------------------|--------|----------------------|
| `light-light` | — | 1 (Double) |
| `light-heavy` | — | 3 (SectionClose) |
| `heavy-light` | — | 2 (SectionOpen) |
| `none` | — | 8 (Hidden) |
| `heavy-light` | `forward` | 4 (LocalRepeatOpen) |
| `light-heavy` | `backward` | 5 (LocalRepeatClose) |

Repeat count from `<repeat>` `times` attribute (default 2).

Volta endings:
```xml
<barline location="left">
  <ending type="start" number="1, 2"/>
</barline>
```

→ Ending token:
```js
{
  type: 'Ending',
  repeat: bitmask,  // number "1, 2" → bits 0x03 (bit 0 for ending 1, bit 1 for ending 2)
  style: bitmask,
}
```

### 1i. Forward / Backup (Multi-Voice) — Phase 3

```xml
<backup><duration>4</duration></backup>
```

`<backup>` rewinds the time cursor within a measure to allow writing a second
voice. `<forward>` advances it (to skip beats in a voice).

**Phase 1–2:** Ignore `<backup>` and `<forward>`. Only the first voice is
processed. Log a warning when these elements are encountered.

**Phase 3:** Track voice numbers. When `<backup>` is encountered:
1. Save current tick position
2. Rewind tick counter by the `<duration>` amount
3. Subsequent notes belong to a new voice
4. At the end of the measure, create a layered staff (via `layerWithNext`) for
   voice 2+, following the same approach planned for MuseScore multi-voice import

---

## Step 2: Modify `src/main.js`

### 2a. Add import (after line 16)

```js
import { parseMusicXML, isMusicXMLFile } from './musicxml-import.js'
```

### 2b. Add format detection in `processData()` (after line 696)

Insert between the MuseScore check and the MIDI check:

```js
// Detect MusicXML files (.musicxml / .mxl / .xml)
if (isMusicXMLFile(payload, filename)) {
    console.log('Detected MusicXML file:', filename)
    parseMusicXML(payload, filename).then(data => {
        console.log('MusicXML parsed:', data)
        setDataAndRender(data)
    }).catch(error => {
        console.error('Failed to parse MusicXML file:', error)
        alert(`Error loading MusicXML file: ${error.message}\n\nSee DevTools console for the full stack trace.`)
    })
    return
}
```

The detection order becomes:
1. MuseScore (`.mscz` / `.mscx` / `<museScore>` root)
2. **MusicXML** (`.musicxml` / `.mxl` / `<score-partwise>` or `<score-timewise>` root)
3. MIDI (magic bytes `MThd`)
4. NWC (fallback)

This order is safe because `isMuseScoreFileStrict` checks for `.mscz`/`.mscx`
extension or `<museScore>` in content, so it won't false-positive on MusicXML.
The `.xml` extension is ambiguous but `isMusicXMLFile` checks XML content.

### 2c. Extend interpreter skip (line 647)

```js
// Change from:
if (data._source !== 'musescore') {
    interpret(musicContext)
}

// To:
if (data._source !== 'musescore' && data._source !== 'musicxml') {
    interpret(musicContext)
}
```

---

## Step 3: Modify `index.html`

### 3a. Update file input `accept` (line 254)

```html
<input type="file" id="opener" accept=".nwc,.nwz,.nwctxt,.mid,.midi,.mscx,.mscz,.musicxml,.mxl,.xml" hidden />
```

---

## Step 4: WebMscore Pipeline (Optional / Deferred)

Route MuseScore files through webmscore for full-fidelity import:

```js
// In processData(), replace or augment the MuseScore detection block:
if (isMuseScoreFileStrict(payload, filename) && window.WebMscore) {
    const ext = filename.split('.').pop().toLowerCase()
    const format = ext === 'mscz' ? 'mscz' : 'mscx'
    try {
        const score = await WebMscore.load(format, new Uint8Array(payload))
        const musicxml = await score.saveXml()
        score.destroy()
        const data = await parseMusicXML(musicxml, filename)
        setDataAndRender(data)
    } catch (error) {
        console.warn('WebMscore pipeline failed, falling back to direct parser:', error)
        // Fallback to existing musescore-parser.js
        parseMuseScore(payload).then(data => setDataAndRender(data))
    }
    return
}
```

Prerequisites:
- Lazy-load `vendor/webmscore/webmscore.js` only when a MuseScore file is detected
  (avoid ~3MB WASM cost on every page load)
- Wait for `WebMscore.ready` before calling `load()`
- Add UI indication of loading state ("Converting via MuseScore engine...")
- Keep `musescore-parser.js` as fast fallback when webmscore is unavailable

---

## Step 5: Tests (`test/musicxml-import.test.js`)

### Test strategy

Follow the `test/musescore-parser.test.js` pattern: re-implement pure-logic
functions locally in the test file to avoid browser API dependencies
(`DOMParser`, `DecompressionStream`). Test music-domain conversions directly.

### Test suites

| Suite | ~Tests | What's Tested |
|-------|--------|---------------|
| **Pitch Parsing** | 8 | step+alter+octave → position, name, accidental for: C4 natural, C#4, Bb3, F##5, Ebb2, enharmonics |
| **Clef Mapping** | 6 | MusicXML sign+line → internal clef: G/2→treble, F/4→bass, C/3→alto, C/4→tenor, percussion, octave-change |
| **Duration Parsing** | 6 | type → numeric, dot counting, triplet fraction adjustment, grace (no timing advance) |
| **Key Signature** | 5 | fifths → key name + sharps/flats: 0→C, 1→G, -2→Bb, 7→C#, -7→Cb |
| **Barline Mapping** | 5 | bar-style + repeat + ending → internal codes: double, section close, repeat open/close, volta bitmask |
| **Chord Assembly** | 4 | Single note stays Note, 2nd note with `<chord/>` → Chord type, sort by position, ties per chord member |
| **Direction Parsing** | 5 | Tempo/metronome, dynamics (mf, ff), wedge/hairpin, coda/segno, pedal |
| **Format Detection** | 6 | `.musicxml` → true, `.mxl` → true, `.xml` with MusicXML content → true, `.xml` with MuseScore → false, `.nwc` → false, no filename + MusicXML content → true |
| **Full Parse (integration)** | 3 | Small hand-crafted MusicXML → verify complete token stream for: single-staff scale, multi-staff piano, score with dynamics+articulations |

**Total: ~48 tests**

### Test data

- Existing converted files: `nwc2xml/js/test-output/*.xml` (108 files from NWC→MusicXML)
- Hand-crafted minimal fixtures inline in the test file (small XML strings)
- MusicXML "Hello World" from the W3C tutorial

---

## Phased Delivery

### Phase 1: Core (MVP) — DONE

- `music-import-utils.js` — shared helpers
- `musicxml-import.js` — format detection, `.mxl` extraction, score header,
  `<attributes>` (clef, key, time, divisions), `<note>` (pitch, rest, chord,
  duration, dots), implicit barlines, `main.js` integration
- **Result:** Simple single-voice scores render correctly

### Phase 2: Expression & Ties — DONE

- Ties (`<tie>` / `<tied>`)
- Articulations (`<articulations>` children)
- Fermata
- Grace notes (`<grace/>`)
- Beaming (`<beam>`)
- Stem direction (`<stem>`)
- Dynamics (`<dynamics>`)
- Tempo (`<metronome>` + `<sound tempo>`)
- **Result:** Expressive scores render with correct articulation/dynamics

### Phase 3: Advanced — PARTIALLY DONE

- Slurs (`<slur>`) — **DONE**
- Tuplets/triplets (`<time-modification>` + `<tuplet>`) — **DONE**
- Lyrics (`<lyric>`) — **DONE**
- Hairpins/wedges (`<wedge>`) — **DONE**
- Explicit barlines (`<barline>` with `<bar-style>`, `<repeat>`, `<ending>`) — **DONE**
- Flow directions (Coda, Segno, D.C., D.S., Fine, To Coda) — **DONE**
- Pedal — **DONE**
- Multi-voice (`<backup>` / `<forward>`) — **DONE** (all voices, backup/forward timing)
- Score-timewise support — NOT YET
- WebMscore pipeline integration — NOT YET
- **Result:** Most features implemented, 2 advanced items remaining

---

## Implementation Status

**Implemented in commits `04e215b`, `2844438`, `54d365f`:**

### Test Results

| Corpus | Files | Passed | Notes |
|--------|-------|--------|-------|
| NWC→MusicXML (nwc2xml) | 108 | 108 (100%) | 914 staves, 835K tokens, 475K notes |
| WebMscore exports (.mscz) | 19 | 18 (100%) | 1 empty XML from webmscore (MS4 file) |
| Note count accuracy | 18 | 18 (100%) | Exact match on all non-empty files |
| Native .musicxml files | 2 | 2 (100%) | |
| Quality (timing sanity) | 108 | 108 (100%) | No negative ticks, no timing issues |
| Unit tests | 76 | 76 | Pitch, clef, duration, key, barline, chord, direction, timing, format detection, multi-staff, multi-voice |

### Remaining Phase 3 Items

- `<score-timewise>` → transpose to partwise (rare format, low priority)
- WebMscore pipeline: route `.mscz` through webmscore → MusicXML → our parser

---

## Verification

1. **Unit tests:** `bun test test/musicxml-import.test.js`
2. **Round-trip test:** Load NWC files → export via `nwc2xml` → reimport via
   `musicxml-import.js` → compare rendered output against direct NWC rendering.
   Use the 108 files in `nwc2xml/js/test-output/` as test corpus.
3. **Visual regression:** Use the existing Playwright integration test
   infrastructure to snapshot MusicXML-imported scores.
4. **WebMscore cross-check:** Load `.mscz` in webmscore reference renderer
   (`test/visual/webmscore.html`), export MusicXML, load in Notably, compare
   SVG output from webmscore against canvas rendering.

---

## Files

| File | Purpose |
|------|---------|
| `src/music-import-utils.js` | Shared constants and helper functions for all XML-based importers |
| `src/musicxml-import.js` | MusicXML parser: XML → internal token format |
| `src/musescore-parser.js` | (Modified) Imports shared helpers from `music-import-utils.js` |
| `src/main.js` | (Modified) Format detection routing + interpreter skip for MusicXML |
| `index.html` | (Modified) File input accept filter includes MusicXML extensions |
| `test/musicxml-import.test.js` | Unit tests for the MusicXML importer |
