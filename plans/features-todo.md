# Notably — Features TODO

Planned features and improvements, roughly prioritized.

## Playback

- [x] SoundFont playback — OxiSynth (Rust/WASM) + Creative 8MB GM SoundFont, wavetable fallback
- [x] Playback controls — play/pause, stop, progress bar with scrubbing, time display
- [x] Playback note highlighting — translucent yellow overlay on active noteheads, position cursor
- [x] Highlight style toggle — colored overlay vs glow/halo mode
- [x] Auto-scroll during playback — smooth scroll in wrap (vertical) and scroll (horizontal) modes, with toggle
- [x] Solo / mute per staff — play back only the selected track instead of all staves
- [x] Piano keyboard visualization — 88-key piano with per-staff color-coded key lighting
- [x] Keep highlights on pause — score and piano highlights stay visible when paused
- [x] Fix chord accidental MIDI — accidentals on chord child notes now resolve correctly (key sig + running + explicit)
- [x] Highlight current bar — light red translucent overlay behind the active measure during playback
- [x] Instrument/channel assignment per staff — each staff gets its own MIDI channel (skipping ch9 for non-percussion), with GM program change sent before playback using the NWC patchName
- [x] Tempo beat unit conversion — tempo markings with non-quarter beat units (half, eighth, dotted) are converted to equivalent quarter-note BPM for correct playback speed
- [x] NoteOff overlap fix — reference-counted active notes prevent premature noteOff when overlapping notes share the same pitch on the same channel
- [x] Staff transposition — per-staff semitone transposition extracted from binary/nwctxt formats, applied to MIDI output for correct sounding pitch of transposing instruments
- [x] Dynamic markings affect playback velocity — NWC 2.75 spec velocity mapping (ppp=10..fff=127), per-staff running velocity tracked through `buildNoteEvents`, default mf
- [x] Repeat/volta playback support — segment-based playback order walker in `src/playback-order.js` handles local repeats, master repeats with special endings, and flow directions (D.C., D.S., Coda, Segno, Fine, To Coda). Post-D.C./D.S. rules: master repeats disabled, default endings (D) taken, re-enabled after To Coda. Ties broken at segment boundaries.
- [ ] Tempo changes during playback (rit., accel.)

## Tier 2 — Critical for correct visual rendering (score looks wrong without these)

- [x] **Hairpins (crescendo/diminuendo)** — Hairpin wedges drawn with canvas lines; span auto-sized to reach next dynamic/barline. Rinforzando/Sforzando rendered as dynamic text.
- [x] **Special endings / volta brackets** — VoltaBracket class draws horizontal bracket with hooks and ending number text. Span auto-sized to reach next ending/barline.
- [x] **Articulation glyphs** — ArticulationMark class renders SMuFL glyphs for staccato, accent, tenuto, marcato, staccatissimo, fermata. Placed on the notehead side (opposite the stem); fermata always above. Staff-line avoidance nudges glyphs into spaces. Multiple articulations stack outward. Visual tests cover downbeam (beamed stems-down) notes and chords with articulations.
- [x] **Triplet/tuplet brackets** — TupletBracket class with optional bracket (numeral-only for beamed triplets). Post-layout pass scans triplet=1..3 groups; numeral placed on stem/beam side; vocal staves force numeral above lyrics. Bracket with hooks only shown for unbeamed/mixed groups (rests, quarter notes).
- [x] **Grace notes** — Grace note flag causes 60% scale rendering via `_graceScale` on Glyph/Accidental draw, with reduced horizontal spacing. Width scaled on glyph object for correct beam/tie calculations.
- [x] **Dynamic variance rendering** — DynamicVariance tokens rendered: styles 0-2 as hairpin wedges, Rinforzando as "rfz", Sforzando as "sfz". TempoVariance rendered: Fermata as SMuFL glyph, breath mark as comma, text variants (rit., rall., accel., etc.) as italic text.
- [x] **Flow direction rendering** — Coda/Segno rendered as SMuFL glyphs; Fine/D.C./D.S./To Coda/etc. rendered as bold italic text.

## Layout & Rendering

- [x] Wrap layout with DP-optimal line breaking, anchor-point justification, rigid note units
- [x] Page layout mode — Letter/A4 paper sizes, white page backgrounds with drop shadows
- [x] Layout toggle — cycles scroll → wrap → page; page size selector in page mode
- [x] Default font size 28
- [x] Courtesy clef + key signature at start of each new system line
- [x] Lyrics — syllable tokenizer, assignment respecting LyricSyllable/slur/tie rules, inter-syllable dashes
- [x] Staff visual properties — boundary-based spacing, bracket chains, layering, barline connector suppression near lyrics
- [x] Additional music fonts — SMuFL-compliant fonts: Bravura (default), [Petaluma](https://github.com/steinbergmedia/petaluma), [Leland](https://github.com/MuseScoreFonts/Leland), [Sebastian](https://github.com/fkretlow/sebastian), [Golden Age](https://github.com/benwiggy/GoldenAge), [Leipzig](https://github.com/rism-digital/leipzig); dynamic switching via dropdown with localStorage persistence
- [x] Companion text fonts — BravuraText, LelandText, PetalumaText, SebastianText loaded via @font-face; all text elements (lyrics, titles, tempo, staff labels) use the matching text font; GoldenAge/Leipzig fall back to serif
- [x] Dynamic markings rendered as SMuFL glyphs — pre-composed glyphs (pp, mp, mf, ff, etc.) from the music font instead of italic text; falls back to individual letter glyph composition for unknown combinations
- [x] Landscape / portrait page orientation toggle — `[Portrait | Landscape]` segmented button group in page mode, swaps page width/height via `getPageDimensions()`, persisted to localStorage
- [ ] Multi-page rendering — display all pages vertically like a PDF viewer (currently only lays out pages but rendering may clip)
- [ ] Page navigation — jump to page N (page indicator + input or prev/next buttons)
- [ ] Page numbers, headers/footers in page mode
- [ ] Bar compression — fix bug where bars with many notes overflow or don't shrink to fit available width
- [ ] First-system indent for instrument names
- [ ] Melisma/extender lines for slurred notes under one syllable
- [ ] Multiple lyric verses (currently only verse 1 rendered; NWC supports up to 8)
- [x] Grand staff brace rendering (`braceWithNext` parsed and drawn as SMuFL glyph)
- [x] Spring-and-rod spacing model — Ross/Gould duration tables, per-system spring factor, rod = max of musical width and lyric width. Fixed spacing mode removed from UI. Tuning sliders (density, rod/spring, visual/timing) hidden behind a "Tuning" popover button.
- [x] Grace notes — 60% scale noteheads/accidentals, stems always up, shorter stems (~5 half-spaces), thinner stem/beam lines, scaled flag glyphs, acciaccatura slash through stem. Beamed grace groups get scaled beams. Reduced horizontal spacing (40% spring, 50% padding).
- [x] Ties and slurs — direction follows stem (up→below, down→above); anchored at notehead pitch (offsetY); per-child-note chord ties; cross-system tie splitting preserves direction; slurs use outer chord note as anchor
- [x] **Professional tie/slur engraving** — Cubic bezier curves with proportional arc height (short ties = round, long ties = flat); separate Tie/Slur classes (ties thicker+rounder, slurs thinner+more open); edge-anchored ties (gap from notehead edges, "never touch"); chord inner/outer direction (top curves above, bottom below, inner follows nearest); mixed-stem slurs default above; staff-line avoidance (peak nudged into spaces); accidental collision clearance; engraving constants in `src/engraving-rules.js`
- [x] Triplet/tuplet brackets — numeral on stem/beam side; fully-beamed triplets get numeral only (no bracket); unbeamed/mixed get bracket+numeral; vocal staves place numeral above to clear lyrics
- [ ] **Future: Full OSMD-style slur math** — Coordinate-rotation bezier calculation (tangent angles with 30-80 degree clamping), skyline/bottomline collision system, `SlurHeightFlatten` factors for long slurs, per-note articulation Y offsets at slur endpoints. See `references/osmd-engraving-notes.md`.
- [ ] Alto and tenor clef support

## Known Bugs

- [x] **Staves need sufficient vertical space** — `computeStaffExtents()` estimates per-staff content bounds (note positions, stem tips, dynamics, tempo marks, lyrics, voltas) in half-space units before layout. `buildStaffYMap()` uses these extents to compute inter-staff gaps that prevent content overlap, with a minimum clearance padding. Falls back to static `boundaryTop`/`boundaryBottom` from the file or fixed defaults when extents aren't needed.
- [ ] **Hairpins collide with adjacent dynamics** — a crescendo/decrescendo wedge that leads into a dynamic marking (e.g. cresc → ff) can overlap the dynamic glyph. The hairpin end-point should stop short to leave clearance, or the dynamic should be nudged right.
- [ ] **Hairpins and dynamics vertical alignment** — hairpin wedges and dynamic markings on the same staff should share a consistent baseline Y position so they read as a continuous expression lane, rather than each sitting at its own independent vertical offset.
- [x] **Grace notes: stem/flag not scaled** — Fixed: stems shortened to ~5 half-spaces with 60% thickness, flag glyphs scaled, acciaccatura slash drawn, stems forced up. Beam groups also scaled (thinner beams, shorter stems).
- [x] **Stave brackets and system barline** — bracket rendering corrected; braces use SMuFL glyph (U+E000) vertically scaled; system barline (thin vertical line) connects all staves at the left edge of each system for scores with 2+ visible staves.
- [x] **Chord tie orientation fixed** — `getChordTieDirection()` had the position-to-pitch mapping inverted (`sorted[0]` was treated as "top" but is actually the lowest position). Fixed: top note (most positive position = highest on staff) curves above, bottom note curves below, inner notes follow nearest outer. Multi-voice context (layered staves with ties toward stem) not yet implemented.
- [ ] **Slur direction with mixed beams** — when a slur spans notes that belong to different beam groups or a mix of beamed and unbeamed notes, the slur direction heuristic can pick the wrong side. Should consider the overall phrase contour and stem directions of all spanned notes, not just the start/end.
- [x] **Playback cursor spans across staves** — the position cursor draws a vertical line spanning all staves in the system (top of first staff to bottom of last staff) using persisted system geometry from the layout pass. When notes are actively sounding, the cursor snaps to the leftmost active notehead X for exact alignment with note highlights. Works in scroll, wrap, and page modes.
- [x] **More highlight modes** — unified highlight mode system with five options: Notes (colored overlay), Glow (blue halo), Bar (translucent measure overlay), Column (vertical band at current beat), and Off (no highlighting). Dropdown selector in toolbar replaces the old toggle button. Cursor always visible during playback regardless of mode.
- [x] **Click to select/position cursor** — clicking on the score during playback (or when paused) seeks to that position. Canvas click coordinates are mapped to score-space using zoom and scroll offsets, then the time index is reverse-searched to find the corresponding playback time. The playback engine seeks, cursor and progress bar update. Drag-scrolls are distinguished from clicks using a 5px movement threshold.
- [x] **Bar numbers** — measure numbers displayed above the first staff at each system start (wrap/page modes) and above every barline (scroll mode). Font scales with fontSize. System-start numbers computed from system break boundary indices. `_measureGeometry` entries now include `measureIndex`.
- [ ] **Page numbers** — display page numbers in page layout mode (footer or header position, configurable).
- [ ] **Triplet numeral misaligned with bracket** — the "3" numeral on triplet brackets is not horizontally centered or vertically aligned with the square bracket. The numeral should sit centered in the gap of the bracket.
- [ ] **Grace note spacing incorrect** — grace notes calculate incorrect visual space-time, taking up too much or too little horizontal space relative to their visual weight in the measure.
- [ ] **Ties/voltas break across systems** — ties and volta brackets have rendering issues at line breaks. Partial ties at system edges may be mispositioned or missing; volta brackets may not continue correctly across system boundaries.
- [ ] **Glow highlight renders on top of stems** — glow mode highlight halo paints over stem lines instead of behind them. Should render in a lower z-layer so stems remain crisp. Also the glow shape could be more rectangular (less circular) to better match the notehead footprint.
- [ ] **MIDI tempo not restored after rit./a tempo** — when a TempoVariance (e.g. rit., rallentando) slows playback, a subsequent "a tempo" or "Tempo Primo" should restore the previous base tempo. Currently the tempo stays reduced.

## UI / UX

- [x] Font size +/- buttons with console logging
- [x] Zoom controls (transform-based)
- [x] Layout/page size preferences persisted to localStorage
- [ ] Keyboard shortcuts (space = play/pause, arrow keys = scroll, +/- = zoom)
- [ ] Viewer/editor mode toggle — hide invisible items in view mode
- [ ] Staff visibility toggle
- [ ] Dark mode for the score canvas
- [ ] Mobile-friendly touch controls

## Import / Export

- [x] MIDI import — load .mid/.midi files; SpessaSynth binary parser + grid-snap quantization (16th note default) → internal score format with notes, chords, rests, barlines, time/key signatures, tempo, clef detection, beaming. Supports SMF format 0/1, channel-split staffing, dotted/triplet durations, tie splitting at barlines, GM program → staff names.
  - [ ] Adaptive quantization — multi-pass with multiple grid levels, best-fit selection per note (for rubato/live recordings)
  - [ ] Expression parsing — Dynamic tokens from velocity changes, sustain pedal (CC64), program change → instrument assignment per staff
  - [ ] Percussion staff — Channel 10 → percussion clef + GM drum map
  - [ ] Voice splitting — Detect multiple voices within one MIDI track
  - [ ] Tuplet detection beyond triplets — quintuplets, septuplets, etc.
- [ ] MIDI export — export score as Standard MIDI File
- [ ] MusicXML import — load .musicxml / .mxl files
- [ ] MuseScore import — load .mscx / .mscz files
- [ ] LilyPond export — export score as .ly file
- [ ] PDF export / print feature from page layout

## Beam Engraving Guidelines

Rules for rendering beams (especially across triplets) to achieve professional appearance without interfering with staff lines.

### Standard Stem Length

- **The Octave Rule**: Standard stem length for any note (including triplet notes) is one octave = 3.5 staff spaces.
- **Anchor stems**: In a beamed group of three notes, identify the note farthest from the middle staff line and set its stem to the standard one-octave length. This becomes the anchor from which the beam angle is derived.
- **Minimum stem lengths**:
  - 3 staff spaces if the beam falls within the staff
  - 2.5 staff spaces if the beam falls outside the staff

### Adjusting for Beam Angle

- **Slant limits**: A beam should not slant more than one staff space (approximately a third of the staff height) to maintain readability.
- **Intermediate stems**: Once the two outer stems establish the beam angle, any middle (intermediate) stem is lengthened or shortened as needed to exactly touch the beam line.
- **Horizontal beams**: If the notes have a varied contour (e.g., up-down-up or similar non-monotonic pitch pattern), the beam should be rendered perfectly horizontal.

### Specialized Requirements

- **32nd note triplets**: Require stems slightly longer than one octave (~4–4.5 staff spaces) to accommodate the extra beam lines without crowding the noteheads.
- **Ledger line notes**: If a notehead sits on a ledger line far from the staff, the stem must be long enough to reach at least the middle line of the staff.

## Parser / Data

- [x] Binary NWC format (v1.55, v1.75, v2.0, v2.05) + NWC text format
- [x] LyricSyllable bit extraction from binary format
- [x] Beam convention fix — NWC binary uses 1=start, 2=middle, 3=end (was swapped in beams.js)
- [x] Parent Chord drawingNoteHead — set from first child note for slur/highlight anchoring
- [ ] V205+ staff visual property parsing (only 4 test files affected)
- [ ] Fix 4 files that fail new parser ("Unknown object type: 256")
- [ ] Visual regression test baselines
- [ ] Integration tests (Playwright)
