# NWC Viewer — Layout & Rendering Feature Checklist

Every rendering characteristic needed to correctly display NWC files.
Items marked `[x]` are implemented; `[ ]` are outstanding.

## Parser

- [x] Binary NWC format (v1.55, v1.75, v2.0, v2.05)
- [x] NWC text format (.nwctxt)
- [x] Header parsing — variable zero-padding between fields
- [x] Null-terminated string fields with zero-skipping
- [x] Conditional V200 byte consumption
- [ ] 4 files fail new parser — "Unknown object type: 256", likely an unsupported object type or alignment issue in V2.05 files

## Score Structure

- [x] Multi-staff scores
- [x] Staff grouping flags: `bracketWithNext`, `braceWithNext`, `connectBarsWithNext`, `layerWithNext`
- [x] `allowLayering` file-level flag — controls whether `layerWithNext` collapses staves to same Y
- [x] Staff boundary properties: `boundaryTop`, `boundaryBottom` parsed and used for vertical spacing
- [x] Staff labels rendered to the left of the system bracket (e.g. "s", "t")
- [x] Title centered above score
- [x] Author/composer displayed
- [ ] Copyright footer — should appear at the bottom of the last page
- [ ] Lyricist display — parsed but not rendered

## Staves & Systems

- [x] 5-line staff rendering
- [x] System bracket — `[` shape drawn for `bracketWithNext` chains (not unconditional)
- [x] Curly brace — `{` shape for piano/organ grand staff groups (`braceWithNext`)
- [x] Bracket/brace positioned between staff labels and stave left edge
- [x] Layered staves share the same Y position (overlap completely)
- [x] Boundary-based vertical spacing — `boundaryTop`/`boundaryBottom` staff properties control inter-stave gaps
- [x] Barline connections respect `bracketWithNext`, `connectBarsWithNext`, `layerWithNext` flags
- [ ] Multi-system line breaks — ~~currently all measures flow on one infinite line; should wrap to fit canvas/page width~~ basic wrap mode implemented with DP-optimal and greedy break algorithms; needs refinement
- [x] Multi-system line breaks (basic) — wrap mode reflows measures into systems; respects NWC systemBreak flags; DP-optimal (Knuth-Plass style) and greedy algorithms; per-system justification; courtesy clef/key at system starts; scroll/wrap toggle
- [ ] First-system indent — first system should be indented to leave room for instrument names
- [ ] Staff visibility — some staves may be hidden; should respect visibility flags
- [ ] **Viewer/Editor mode toggle** — a view mode that hides invisible items (tokens with Visibility=Never, hidden barlines, etc.) vs editor mode that shows everything with visual indicators

## Clefs & Key/Time Signatures

- [x] Treble clef
- [x] Bass clef
- [x] Key signatures (sharps and flats drawn after clef)
- [x] Time signatures — numeric (e.g. 6/8), Common time (C), Alla breve (cut C)
- [ ] Alto clef (C clef on middle line)
- [ ] Tenor clef (C clef on fourth line)
- [ ] Mid-staff clef changes — clef change should appear small, between notes
- [x] Courtesy clef and key signature at start of each new system line
- [ ] Courtesy/cautionary key/time signatures at end of system before break

## Notes & Rests

- [x] Note heads — whole, half, quarter, 8th, 16th, 32nd
- [x] Stems — direction read from NWC file (`stem: 1` = up, `stem: 2` = down)
- [x] Flags — 8th and 16th flags on standalone (unbeamed) notes
- [x] Rests — whole, half, quarter, 8th, 16th
- [x] Dotted notes — augmentation dot after note head
- [x] Double-dotted notes
- [x] Accidentals — sharp, flat, natural drawn before note head
- [x] Ledger lines — above and below staff for notes outside the 5-line range
- [x] Chords — multiple note heads on a single stem
- [ ] Grace notes — small notes before the principal note, no time value
- [ ] Triplet/tuplet brackets — number and bracket above/below note group
- [ ] Ties — curved line connecting two notes of same pitch (partially implemented)
- [ ] Slurs — curved line connecting notes of different pitches (partially implemented)
- [ ] Double sharp / double flat accidentals

## Beams

- [x] Beam grouping from NWC beam markers (1=start, 3=middle, 2=end)
- [x] Primary beam count from coarsest duration in group (8th=1, 16th=2, 32nd=3)
- [x] Sub-beams for finer-duration notes — partial beams drawn per contiguous run, no double-drawing
- [x] Stem direction from NWC data, fallback to average-position heuristic
- [x] Beam stacking direction — additional beams toward noteheads (positive offset for stems-up, negative for stems-down)
- [x] Sub-beam stub length — 40% of gap to nearest neighbor
- [x] Beam spacing — 1.0x beam thickness center-to-center
- [ ] Cross-staff beams — beam connecting notes on different staves (e.g. piano left/right hand)
- [ ] Beam angle limits — beams should not exceed ~15 degree slope; currently follows raw stem endpoints

## Barlines

- [x] Single — thin vertical line
- [x] Double — two thin vertical lines
- [x] Section close — thin line + thick line (final barline)
- [x] Section open — thick line + thin line
- [x] Repeat open — thick + thin + two dots (repeat start)
- [x] Repeat close — two dots + thin + thick (repeat end)
- [x] Master repeat open/close — same visual as local repeats
- [x] Hidden — no barline drawn
- [x] Staff-level `endingBar` property — determines the final barline style after all tokens
- [x] Barline connectors between grouped staves (layered or `connectBarsWithNext`)
- [x] Connectors suppressed when lyrics exist between staves
- [ ] Repeat barline with custom repeat count — should display "x3" etc. when `repeatCount > 2`
- [ ] Ending brackets (1st/2nd endings) — `Ending` tokens parsed but not rendered

## Lyrics

- [x] Lyrics parsed from staff data
- [x] Syllables assigned to note tokens via tokenizer
- [x] Rendered left-aligned to note X position
- [x] Font size proportional to staff height (38% of fontSize)
- [x] Trailing hyphens stripped from display text — NWC renders hyphens as dashes centered between note positions
- [ ] Vertical position tuning — should sit centered in the gap between top and bottom staves
- [ ] Multi-verse lyrics — only the first lyric line is rendered; NWC supports up to 8 verses stacked vertically
- [x] Hyphen continuation — hyphens between syllables of a word drawn as en-dashes centered between note positions
- [ ] Melisma/extender lines — underscores should render as horizontal lines extending the syllable
- [x] Lyric syllable attachment control — `AttachLyricSyllable` (Default/Always/Never) extracted from binary data and respected during assignment
- [ ] Top-aligned lyrics — `LyricAlignment: Top` should place lyrics above the staff
- [ ] Underscore-as-space — NWC's "Underscore shown as space" option replaces `_` with space in display
- [ ] Lyric alignment mode — NWC supports "Start of Accidental/Note" and "Standard Rules" (center under note, left-align for multi-note phrases)
- [x] Slur/tie lyric skip — notes that are the target of a slur (end/mid) or tie (tieEnd) do not consume a lyric syllable; chords with tied child notes also skipped
- [x] Rest lyric skip — rests never consume a lyric syllable (Rest handler has no lyric logic)
- [x] **Do not assign `-` (hyphen) as lyrics to notes** — tokenizer skips leading/standalone hyphens; interpreter filters bare continuation markers before assignment

## Dynamics & Expressions

- [x] Dynamic markings parsed (pp, p, mp, mf, f, ff, fff)
- [x] Dynamic text rendered below staff
- [x] Dynamic positioning — uses `position` field from file; consistent -(pos+4) conversion
- [ ] Hairpins (crescendo/diminuendo) — wedge shapes spanning note ranges
- [x] Tempo markings — uses file position; renders BPM value above staff
- [x] Text expressions — user text annotations at file-specified positions
- [x] Performance directions (e.g. "Legato", "rit.") — uses file position

## Spacing & Layout

- [ ] **Staff boundary properties for layout** — NWC stores `boundaryTop` / `boundaryBottom` in staff properties (visual extent above/below center); should use these to compute inter-stave spacing instead of fixed gaps
- [ ] **Staff labels shift stave X origin** — rendering of staff labels currently doesn't offset where notes/staves begin; labels should push the stave start rightward
- [ ] **Lyrics-aware vertical spacing** — Y positioning of staves should account for the height of lyrics (number of verses × line height) rather than a fixed gap
- [ ] Adaptive inter-stave spacing — currently a fixed large gap (5x fontSize) between all stave groups; staves without lyrics between them should stack tighter (e.g. 2.5-3x), only expanding when lyrics need to be rendered in the gap
- [x] Inter-stave spacing — wider gap between groups, tighter within groups (1.8x)
- [x] Layered staves at zero spacing (complete overlap)
- [ ] Horizontal note density — currently too generous; should fit approximately 4 measures per system line, matching standard engraving density
- [ ] Proportional spacing — note spacing should reflect duration (half note gets ~2x quarter note width)
- [x] Measure-level justification — anchor-point stretching distributes extra space at note/rest gaps (capped at MAX_INTRA_STRETCH), overflow goes to barline padding; piecewise-constant offsets keep note units (head, stem, dot, beam, accidental) rigid
- [x] Last-line barline alignment — justified systems stretch the final barline to the page edge; unjustified last systems (fill < 20%) keep natural width
- [x] Line breaking algorithm — determine optimal points to break into new system lines
- [ ] Page breaks — support for page-level layout when printing/exporting
- [ ] **Preset paper sizes** — wrap layout currently uses viewport width; should offer standard paper sizes (A4, Letter, etc.) so the score wraps to a fixed width independent of browser window size
- [ ] Minimum measure width — very short measures (e.g. pickup bars) should still have readable spacing

## Investigation Notes (adohn.nwc reference)

### "Andante maestoso" placement — Text vs Tempo objects

Reference file: `nwcs/adohn.nwc` (O Holy Night, v1.75)

In NWC, "Andante maestoso" is a **Text** object (type 17), separate from the **Tempo** object (type 6) that stores the BPM. Both sit on Staff-3 (first staff, index 0).

**Parsed values from new parser** (`lib/nwc2xml/objects.js`):

| Object | Type | binary pos | adapter position (after fix) | Other fields |
|--------|------|-----------|------------------------------|-------------|
| Tempo  | 6    | -26       | **+26** (above)              | placement=0, value=75 BPM, base=2, text="" |
| Text   | 17   | -7        | **+7** (above)               | font=0 (StaffSymbols), text="Andante maestoso" |

### NWC position coordinate system

Two conventions exist — the binary storage and the user-facing model:

| Convention | positive | negative | 0 |
|------------|----------|----------|---|
| **Binary** (raw `readInt8`) | below center | above center | center line |
| **NWC user-facing** (adapter output) | above center | below center | center line |

The sign inversion is **not** an endianness issue — positions are single-byte `readInt8()`,
endianness only applies to multi-byte values. The binary simply uses screen-Y convention
(positive = downward) while the music convention is positive = upward.

Each unit = half a staff line spacing (0.5 increments).

```
user pos │  visual location (5-line staff)
─────────┼────────────────────────────────────
   +7    │  1.5 spaces above top line  ← "Andante maestoso"
   +4    │  top staff line (line 1)
   +2    │  second line
    0    │  center line (line 3)
   -2    │  fourth line
   -4    │  bottom staff line (line 5)
   -7    │  1.5 spaces below bottom line
  -14    │  below staff (e.g. piano dynamic mf)
```

### Adapter position handling (FIXED)

**Problem**: only Notes negated the binary pos; all other objects passed through raw.

**Fix** (`src/nwc.js`): all positioned objects now negate to user convention:
- Cases 6 (Tempo), 7 (Dynamic), 11 (Pedal), 12 (Flow), 14 (TempoVariance),
  15 (DynamicVariance), 16 (PerformanceStyle), 17 (Text):
  `token.position = -(obj.pos || 0)`
- Case 8 (Note): `position: -obj.pos` (already correct)
- Property name standardized to `token.position` (was `token.pos` for cases 11-16)

### Our layout coordinate system

The stave is drawn bottom-up from a reference Y (`getStaffY()`):

```
(drawing.js Stave.draw)
  i=0  ty =  0.0 * fs  →  bottom line  (user pos -4)
  i=1  ty = -0.25 * fs  →  4th line    (user pos -2)
  i=2  ty = -0.50 * fs  →  center line (user pos  0)
  i=3  ty = -0.75 * fs  →  2nd line    (user pos +2)
  i=4  ty = -1.00 * fs  →  top line    (user pos +4)
```

Conversion: `positionY(userPos + 4)` maps user convention to rendering pixels
(+4 shifts origin from center line to bottom line).

Notes apply this as: `relativePos = token.position + 4` → `Glyph(sym, relativePos)`.
Text applies this as: `new Text(str, -(pos + 4))` (the Text constructor internally negates).

Verified: Note and Text now produce identical pixel offsets for the same NWC position.

### Renderer — all positioned objects use file position (FIXED)

Previously Tempo, Dynamic, PerformanceStyle used hardcoded positions. Now all four
text-like token types in `typeset.js` use `token.position` with the same `-(pos + 4)`
conversion, falling back to sensible defaults:

| Token type | Default (user pos) | Equivalent old hardcode |
|------------|-------------------|------------------------|
| Text | +11 | was -11 raw |
| PerformanceStyle | +9 | was -13 raw |
| Tempo | +11 | was -15 raw |
| Dynamic | -13 | was +9 raw |

The nwctxt mapper (`mapTokens`) also standardized: Tempo now uses `token.position`
(was `token.pos`), consistent with Dynamic/PerformanceStyle/Text.

### Chord duration: split-stem / two-voice chords (FIXED)

In NWC, a NoteCM (chord) can represent **split-stem chords** where notes have
different durations and stem directions (two voices on one staff). Each child NoteObj
stores its own duration, stem direction, and beam state.

The parent `data1[0] & 0x0F` stores the chord's **timing advance** (typically the
shortest voice), used for beat tracking and horizontal spacing. Individual note
durations in `notes[]` may differ.

Example — `adohn.nwc` Staff-1 bar 1, chord [9]:
```
token.duration = 4 (quarter)  ← parent NoteCMObj (timing advance)
  notes[0]: D4  dur=2 (half)     stem=down  ← lower voice
  notes[1]: A4  dur=4 (quarter)  stem=up    ← upper voice
```

**Fix** (`lib/nwc2xml/objects.js`): added `getDuration()` and `getDurationType()` to
`NoteCMObj`, reading from `data1` (same byte layout as NoteObj).

**Fix** (`src/nwc.js` adapter, case 10): `token.duration` comes from the parent
NoteCMObj (timing advance); each note in `notes[]` keeps its own duration from the
child NoteObj.

**Fix** (`src/layout/typeset.js` `drawForNote`): uses individual note's duration for
notehead selection (`token.duration || durToken.duration`), so half notes in a
split-stem chord correctly render as open noteheads while quarter notes render filled.

## Testing

- [x] 22 beam unit tests (computeBeamLayout, groupBeamableNotes)
- [x] 20 score feature tests (staff labels, barline styles, lyrics flow, connector logic, ending barlines)
- [x] 108 NWC corpus parse tests
- [x] 185 existing parser/interpreter/layout tests
- [ ] Visual regression screenshots — baselines need updating after recent changes
- [ ] Integration tests for rendering output (Playwright)
