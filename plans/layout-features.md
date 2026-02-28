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
- [x] `allowLayering` file-level flag — discriminates bracket-as-layer (SATB choral) vs visual-only bracket
- [x] Staff labels rendered to the left of the system bracket (e.g. "s", "t")
- [x] Title centered above score
- [x] Author/composer displayed
- [ ] Copyright footer — should appear at the bottom of the last page
- [ ] Lyricist display — parsed but not rendered

## Staves & Systems

- [x] 5-line staff rendering
- [x] System bracket — `[` shape spanning all visible staves in a system
- [x] Curly brace — `{` shape for piano/organ grand staff groups (`braceWithNext`)
- [x] Bracket/brace positioned between staff labels and stave left edge
- [x] Layered staves share the same Y position (overlap completely)
- [x] Grouped staves have tighter vertical spacing than separate staves
- [ ] Multi-system line breaks — currently all measures flow on one infinite line; should wrap to fit canvas/page width
- [ ] First-system indent — first system should be indented to leave room for instrument names
- [ ] Staff visibility — some staves may be hidden; should respect visibility flags

## Clefs & Key/Time Signatures

- [x] Treble clef
- [x] Bass clef
- [x] Key signatures (sharps and flats drawn after clef)
- [x] Time signatures — numeric (e.g. 6/8), Common time (C), Alla breve (cut C)
- [ ] Alto clef (C clef on middle line)
- [ ] Tenor clef (C clef on fourth line)
- [ ] Mid-staff clef changes — clef change should appear small, between notes
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
- [ ] Vertical position tuning — should sit centered in the gap between top and bottom staves
- [ ] Multi-verse lyrics — only the first lyric line is rendered; NWC supports multiple verses stacked vertically
- [ ] Hyphen continuation — hyphens between syllables of a word should be drawn as dashes between note positions
- [ ] Melisma/extender lines — underscores should render as horizontal lines extending the syllable
- [ ] Lyric syllable attachment control — `AttachLyricSyllable` flag (Always/Never/Default) not respected
- [ ] Top-aligned lyrics — `LyricAlignment: Top` should place lyrics above the staff

## Dynamics & Expressions

- [x] Dynamic markings parsed (pp, p, mp, mf, f, ff, fff)
- [x] Dynamic text rendered below staff
- [ ] Dynamic positioning — should use `placement` field; currently fixed below staff
- [ ] Hairpins (crescendo/diminuendo) — wedge shapes spanning note ranges
- [ ] Tempo markings — quarter-note = 120 style display above staff
- [ ] Text expressions — user text annotations at specified positions
- [ ] Performance directions (e.g. "Legato", "rit.") — parsed but not rendered at correct positions

## Spacing & Layout

- [x] Inter-stave spacing — wider gap between groups (5x fontSize), tighter within groups (1.8x)
- [x] Layered staves at zero spacing (complete overlap)
- [ ] Horizontal note density — currently too generous; should fit approximately 4 measures per system line, matching standard engraving density
- [ ] Proportional spacing — note spacing should reflect duration (half note gets ~2x quarter note width)
- [ ] Measure-level justification — measures should stretch to fill the system width evenly
- [ ] Line breaking algorithm — determine optimal points to break into new system lines
- [ ] Page breaks — support for page-level layout when printing/exporting
- [ ] Minimum measure width — very short measures (e.g. pickup bars) should still have readable spacing

## Testing

- [x] 22 beam unit tests (computeBeamLayout, groupBeamableNotes)
- [x] 20 score feature tests (staff labels, barline styles, lyrics flow, connector logic, ending barlines)
- [x] 108 NWC corpus parse tests
- [x] 185 existing parser/interpreter/layout tests
- [ ] Visual regression screenshots — baselines need updating after recent changes
- [ ] Integration tests for rendering output (Playwright)
