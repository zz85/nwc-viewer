# Engraving Rules Reference

Reference document for the music engraving rules that Notably follows.
Rules are sourced from standard references (Gould, Ross, Stone) and
conventional practice. Each section notes what is implemented vs. what
remains to be done.

Code constants live in `src/engraving-rules.js`. Layout logic lives
primarily in `src/layout/ties.js`, `src/layout/beams.js`, and
`src/layout/typeset.js`.

---

## Ties

### General

- A tie connects two noteheads of the **exact same pitch**. It extends
  the duration of the first note into the second.
- Ties start and end at the **edges of the noteheads** (just right of
  the first, just left of the second). They should never touch the
  noteheads. This distinguishes them from slurs, which anchor at or
  near the notehead centre.
- Shape: cubic bezier with proportional arc height -- short ties are
  round, long ties are flatter. Tapered crescent (two-path fill),
  thicker at midpoint, zero at endpoints.
- Staff-line avoidance: if the arc peak lands on or very close to a
  staff line, it is nudged into the nearest space.
- Accidental clearance: if the destination note has a drawn accidental,
  the arc height is increased to clear it.
- Accidental inheritance: an accidental on the first note of a tied
  pair applies to the second note automatically, even across a barline.

**Status**: Implemented in `Tie` class (`drawing.js`) and `layoutTies`
(`ties.js`). Constants in `engraving-rules.js`.

### Single-Note Tie Direction

- Ties arc **away from the stem** (on the notehead side).
  - Stems up: tie curves below.
  - Stems down: tie curves above.

**Status**: Implemented in `getTieDirection()`.

### Chord Ties

Every note intended to be held in a chord must have its own individual
tie. If only some notes are sustained, ties are drawn only for those
specific notes ("partial ties").

#### Single-Voice Context (default)

Direction is determined by the note's position within the chord:

- **Two-note chords**: top note arcs above, bottom note arcs below.
  This creates an oval/lens shape between the two tied pairs.
- **Three or more notes**: the topmost tie arcs above, the bottommost
  tie arcs below. Middle ties are distributed between up and down,
  following the direction of the nearest outer note.
- **Single tied note in a chord**: falls back to standard stem-based
  direction (away from stem).

**Status**: Implemented in `getChordTieDirection()` (`ties.js`).
Position mapping was inverted prior to fix (most negative position was
treated as "top note" but is actually the lowest on staff). Now correct:
most positive position = highest on staff = top note.

#### Multi-Voice Context (layered staves)

When two voices share a staff (e.g., via NWC's `layerWithNext`), ties
arc **toward the stem** to save space and avoid clashing with the other
voice:

- Upper voice (stems up): ties arc **above**.
- Lower voice (stems down): ties arc **below**.

This is the **opposite** of the single-voice rule, where ties arc away
from the stem.

**Status**: NOT IMPLEMENTED. The current code always uses the
single-voice rule. When layered staves produce overlapping voices, ties
may collide. Fix: detect layered context (check `stave.layerWithNext`
or `stave.layeredWith` flags) and invert the direction rule.

### Cross-System Ties

When a tie spans a system break, it is split into two partial arcs:

1. Arc 1 (end of system N): from the start note to the right edge.
2. Arc 2 (start of system N+1): from the left edge to the end note.

Both arcs preserve the original tie direction. Detection uses `_sysIdx`
stored during reflow.

**Status**: Implemented via `PartialTie` class in `drawing.js`.

---

## Slurs

### General

- A slur indicates phrasing or legato. It connects two noteheads that
  may differ in pitch.
- Slurs anchor at or near the **notehead centre** (not at the edge
  like ties).
- Slurs are visually thinner and have a more open profile than ties.
- Separate `Slur` class with distinct thickness and height constants.

### Direction

- Standard: slurs arc **away from the stem**, same as ties.
- Mixed stem directions (start and end notes have different stem
  directions): slur goes **above** by default.

### Chord Slurs

For chords, the slur anchors on the **outer note** (opposite side from
the stem):

- Stems up: use the bottom note (most positive position) as anchor.
- Stems down: use the top note (most negative position) as anchor.

**Status**: Implemented in `getSlurAnchor()` (`ties.js`).

### Intermediate Note Clearance

If any notes between the slur endpoints protrude into the arc path,
the arc height is increased. Uses parabolic approximation of the bezier
shape: `4 * t * (1 - t)` where `t` is the fractional X position.
Notes near endpoints (fraction < 0.03 or > 0.97) are skipped.

**Status**: Implemented in `intermediateNoteClearance()` (`ties.js`).

---

## Beams

### Stem Length

- **Standard**: one octave = 3.5 staff spaces.
- **Minimum within staff**: 3 staff spaces.
- **Minimum outside staff**: 2.5 staff spaces.
- **Anchor stem**: in a beamed group, the note farthest from the
  middle staff line gets the standard length. Other stems are adjusted
  to meet the beam line.
- **Ledger line notes**: stem must reach at least the middle staff line.
- **32nd notes**: stems slightly longer (~4-4.5 staff spaces) to
  accommodate extra beam lines.

### Slope

- **Maximum slope**: clamped to MAX_BEAM_SLOPE = 2 half-spaces
  (1 staff space).
- **Non-monotonic pitch contour** (e.g., up-down-up): beam is rendered
  perfectly horizontal (slope = 0).
- Beams are rendered as filled parallelograms (4-point path + fill),
  not stroked lines, for correct visual thickness at slanted angles.

### Sub-Beams

- Primary beam count from coarsest duration in group (8th=1, 16th=2,
  32nd=3).
- Partial beams drawn per contiguous run of finer durations.
- Sub-beam stub length: 40% of the gap to the nearest neighbour.
- Beam spacing: 1.0x beam thickness centre-to-centre.
- Stacking direction: additional beams toward the noteheads.

### NWC Beam Convention

Binary format 2-bit field: `1=start, 2=middle/continue, 3=end`.
(The constant names in the NWC format are confusingly named --
`BeamEnd=0x400` actually means middle, `BeamMid=0x600` actually means
end.)

**Status**: Implemented in `src/layout/beams.js`.

---

## Articulations

### Placement

- Articulations are placed on the **notehead side** (opposite the
  stem). Exception: fermata is always above.
- Staff-line avoidance: glyphs are nudged into spaces, not placed
  on lines.
- Multiple articulations on the same note stack outward from the staff.

### SMuFL Glyphs

Staccato, accent, tenuto, marcato, staccatissimo, fermata all use
standard SMuFL codepoints.

**Status**: Implemented in `ArticulationMark` class (`drawing.js`).

### Playback Effects (not yet implemented)

- Staccato: ~50% of written duration.
- Tenuto: ~100% of written duration (full value).
- Accent/Marcato: velocity boost (~+20-30%).
- Staccatissimo: ~25% of written duration.
- Fermata: extends duration 1.5-2x, pauses tempo.

---

## Dynamics

### Visual

- Dynamic markings use SMuFL pre-composed glyphs (U+E527-E53D) when
  available. Falls back to individual letter glyph composition.
- Rendered at full font size (no scaling reduction).
- Positioned below the staff using the NWC position field.

### Playback

NWC 2.75 spec velocity mapping:

| Marking | Velocity |
|---------|----------|
| ppp     | 10       |
| pp      | 26       |
| p       | 42       |
| mp      | 58       |
| mf      | 74       |
| f       | 90       |
| ff      | 106      |
| fff     | 127      |

Per-staff running velocity tracked through `buildNoteEvents()`,
default mf.

**Status**: Implemented.

---

## Hairpins (Crescendo/Diminuendo)

- Canvas-drawn wedge shapes.
- Span auto-calculated in `layoutHairpinSpans()` to reach the next
  Dynamic, DynamicVariance, or Barline token.
- DynamicVariance styles 0-2 rendered as hairpin wedges.
- Rinforzando rendered as "rfz", Sforzando as "sfz".

### Known Issues

- Hairpins can collide with adjacent dynamic markings. The end-point
  should stop short to leave clearance.
- Hairpins and dynamics should share a consistent baseline Y position
  (expression lane), but currently each sits at its own offset.

**Status**: Rendering implemented. Collision avoidance not yet done.

---

## Triplet/Tuplet Brackets

- **Numeral placement**: on the beam/stem side of notes. Vocal staves
  (with lyrics) force the numeral above to avoid collision.
- **Fully beamed triplets**: numeral only, no bracket (the beam already
  groups the notes visually).
- **Unbeamed or mixed groups** (containing rests, quarter notes, or
  notes without beam markers): full bracket with hooks + numeral.
- **Stem side determination**: uses majority stem direction of all
  notes in the group, not just the first note.
- **Bracket position**: computed from actual note positions (extreme
  note position + stem extent + padding), not hardcoded offsets.

**Status**: Implemented in `TupletBracket` class and
`layoutTripletBrackets()` post-layout pass.

---

## Grace Notes

Standard engraving practice per Gould, Ross, and modern software
(Dorico, MuseScore).

### Types

- **Acciaccatura** (short grace note): small eighth note with a slash
  through the stem and flag. Played very quickly, typically just before
  the beat.
- **Appoggiatura** (long grace note): small note without a slash.
  Historically takes half the value of the principal note (or
  two-thirds of a dotted note) and is played on the beat.
- **Multiple grace notes**: usually written as 16th notes (or 32nd
  notes) and beamed together. Slashes are not used on groups of
  multiple grace notes -- only on single acciaccaturas.

### Stemming and Sizing

- **Size**: 60-75% of standard noteheads. We use 60% (`_graceScale`).
- **Stem direction**: stems almost always point up, regardless of
  staff position. Exception: in a multi-voice (layered) context, the
  lower voice's grace notes stem down to avoid the top voice.
- **Stem length**: shortened proportionally but long enough to clearly
  show flags or beams. We use ~5 half-spaces with 60% thickness.
- **Flags**: scaled flag glyphs. Acciaccatura slash drawn through stem.
- **Beamed groups**: scaled beams (thinner lines, shorter stems).

### Slurring and Placement

- **Slurs**: nearly all grace notes should be connected to their
  principal note by a slur. The slur generally goes underneath the
  noteheads (from notehead to notehead) unless it would obscure ledger
  lines or accidentals.
- **Horizontal spacing**: grace notes are placed before the principal
  note with enough clearance for accidentals on both the grace note
  and the main note. We use 40% of normal spring width, 50% of normal
  padding. Accidental space reservation scaled by `graceScale`.
- **Barline placement**: grace notes go after the barline, immediately
  before the main note they ornament.

### Playback

- **Time-stealing**: standard practice is for grace notes to steal time
  from the following principal note. Single acciaccatura steals a small
  fraction; appoggiatura steals half (or two-thirds of dotted note).
  Multiple grace notes split the stolen time equally.
- **NWC behavior**: NWC's own grace notes advance musical time
  sequentially (they DO occupy measure time), which is non-standard
  but NWC-compatible.

### Implementation Status

- Rendering: implemented (60% scale, stems up, flags, slash, beams).
- Spacing: implemented (40% spring, 50% padding, scaled accidentals).
- Width on glyph object: implemented (beams/ties use correct dims).
- Grace-to-principal slur: NOT implemented (slurs exist but are not
  auto-generated for grace notes).
- Time-stealing playback: NOT implemented.
- Multi-voice stem-down exception: NOT implemented.
- Known bug: grace notes calculate incorrect visual space-time in some
  cases (see `features-todo.md`).

---

## System Header Spacing

At the beginning of each system, elements follow a strict order:
**Clef -> Key Signature -> Time Signature -> First Note**. If an
element is absent (e.g., C major has no key signature accidentals),
the next element follows naturally without inflated space.

### Gould's Rules

- Minimum gap of ~1 staff-space between each component.
- Clef at the far left, key signature next, time signature last.
- Mid-score clef changes occur before the barline; key changes
  after the barline; time signature changes follow the barline.

### Reference Values (staff-spaces)

| Gap                        | LilyPond | MuseScore | OSMD  | Ours |
|----------------------------|----------|-----------|-------|------|
| Clef left margin           | --       | 0.75      | 0.50  | ~1.1 |
| Clef -> Key Signature      | 0.82     | 0.75      | 0.75  | 1.0  |
| Key Sig -> Time Sig        | 1.15     | 1.00      | 0.75  | 1.0  |
| Clef -> Time Sig (no key)  | 1.52     | 1.00      | --    | 1.0  |
| Time Sig -> First Note     | 2.00     | 2.50      | 1.25  | 1.0  |
| Mid-score clef -> key      | --       | 1.00      | --    | --   |
| Key -> barline             | --       | 1.00      | --    | --   |

Sources:
- LilyPond: `space-alist` entries in Clef/KeySignature/TimeSignature
  grob definitions (`define-grobs.scm`). Uses pair-wise lookups:
  left element's space-alist keyed by right element's break-align-symbol.
- MuseScore: `styledef.cpp` style definitions (`clefKeyDistance`,
  `keyTimesigDistance`, `systemHeaderDistance`, etc.).
- OSMD: `EngravingRules.ts` properties (`ClefRightMargin`,
  `KeyRightMargin`, `RhythmRightMargin`, etc.).

### Analysis

Dedicated constants now defined in `engraving-rules.js` and used in
`typeset.js` (Cursor constructor, `createCourtesyItems`, and
`handleToken` for Clef/KeySignature/TimeSignature).

| Gap                        | LilyPond | MuseScore | OSMD  | Ours |
|----------------------------|----------|-----------|-------|------|
| Clef left margin           | --       | 0.75      | 0.50  | 0.75 |
| Clef -> Key Signature      | 0.82     | 0.75      | 0.75  | 0.80 |
| Key Sig -> Time Sig        | 1.15     | 1.00      | 0.75  | 1.00 |
| Clef -> Time Sig (no key)  | 1.52     | 1.00      | --    | 0.80 |
| Time Sig -> First Note     | 2.00     | 2.50      | 1.25  | 2.25 |

### Layout Considerations

- **Absent key signature**: when key is C major (no accidentals),
  `KeySignature.width = 0` and no extra space is consumed. The time
  signature (or first note) follows the clef directly.
- **Courtesy items at system starts (system > 0)**: courtesy clef
  and key signature are drawn at the start of continuation systems.
  These use the same spacing constants as the initial system.
- **Vertical alignment**: spacing should prevent collisions with
  lyrics, articulations, or dynamics below.

**Status**: Implemented. Named constants `CLEF_LEFT_MARGIN`,
`AFTER_CLEF_GAP`, `AFTER_KEYSIG_GAP`, `AFTER_TIMESIG_GAP` in
`engraving-rules.js`, used in `typeset.js`.

---

## Spacing

### Spring-Rod Model

- Rod = max of musical width and lyric width for each beat position.
- Spring stretch distributes remaining space proportionally across the
  system.
- Ross/Gould duration tables determine natural widths.
- Per-system spring factor computed from DP-optimal line breaking.

### Anchor-Point Justification

- Extra space is added only at anchor points (between notes/rests).
- Elements within a note unit (beams, stems, dots, accidentals) move
  as a rigid unit -- no space is inserted within them.
- Piecewise-constant nearest-anchor snapping in `computeJustifyX()`.
- `MAX_INTRA_STRETCH = 5.0` caps inter-note gap growth.

**Status**: Implemented.

---

## Constants Reference

All values are fractions of fontSize unless noted (fontSize = 4 staff-spaces).
See `src/engraving-rules.js` for the code.

Values calibrated against MuseScore 4 (tieMidWidth=0.21 sp,
tieMinShoulder=0.30 sp, tieMaxShoulder=2.0 sp) and LilyPond
(tie ratio=0.333, height-limit=1.0 sp; slur ratio=0.25,
height-limit=2.0 sp).

### Ties

| Constant            | Value  | Staff-sp | Description                       |
|---------------------|--------|----------|-----------------------------------|
| TIE_HEIGHT_K        | 0.06   | --       | Interpolation slope               |
| TIE_HEIGHT_D        | 0.06   | --       | Interpolation Y-intercept         |
| TIE_HEIGHT_MIN      | 0.08   | 0.32     | Minimum arc height factor         |
| TIE_HEIGHT_MAX      | 0.45   | 1.80     | Maximum arc height factor         |
| TIE_X_GAP           | 0.06   | 0.24     | Horizontal gap from notehead edge |
| TIE_Y_OFFSET        | 0.10   | 0.40     | Vertical offset toward curve      |
| TIE_THICKNESS       | 0.055  | 0.22     | Midpoint thickness                |

### Slurs

| Constant            | Value  | Staff-sp | Description                       |
|---------------------|--------|----------|-----------------------------------|
| SLUR_HEIGHT_K       | 0.05   | --       | Interpolation slope               |
| SLUR_HEIGHT_D       | 0.08   | --       | Interpolation Y-intercept         |
| SLUR_HEIGHT_MIN     | 0.10   | 0.40     | Minimum arc height factor         |
| SLUR_HEIGHT_MAX     | 0.50   | 2.00     | Maximum arc height factor         |
| SLUR_Y_OFFSET       | 0.18   | 0.72     | Vertical offset (larger than ties)|
| SLUR_THICKNESS      | 0.045  | 0.18     | Midpoint thickness (thinner)      |

### Collision Avoidance

| Constant               | Value | Description                       |
|------------------------|-------|-----------------------------------|
| STAFF_LINE_THRESHOLD   | 0.15  | Proximity to trigger nudge        |
| STAFF_LINE_NUDGE       | 0.25  | Nudge distance (line-spacing)     |
| ACCIDENTAL_CLEARANCE   | 0.12  | Extra height for accidentals      |

### Beams

| Constant            | Value | Description                          |
|---------------------|-------|--------------------------------------|
| MAX_BEAM_SLOPE      | 2     | Max slope in half-spaces             |

### System Header Spacing

| Constant            | Value  | Staff-sp | Description                       |
|---------------------|--------|----------|-----------------------------------|
| CLEF_LEFT_MARGIN    | 0.19   | 0.75     | Left margin before clef           |
| AFTER_CLEF_GAP      | 0.20   | 0.80     | Gap after clef                    |
| AFTER_KEYSIG_GAP    | 0.25   | 1.00     | Gap after key signature           |
| AFTER_TIMESIG_GAP   | 0.56   | 2.25     | Gap after time signature          |
