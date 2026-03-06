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
- [ ] Highlight current bar — light red translucent overlay behind the active measure during playback
- [ ] Instrument/channel assignment per staff — currently all notes go to channel 0 / piano
- [ ] MIDI instrument/track selection — choose instrument per staff from GM program list
- [ ] Dynamic markings affect playback velocity
- [ ] Repeat/volta playback support
- [ ] Tempo changes during playback (rit., accel.)

## Tier 2 — Critical for correct visual rendering (score looks wrong without these)

- [x] **Hairpins (crescendo/diminuendo)** — Hairpin wedges drawn with canvas lines; span auto-sized to reach next dynamic/barline. Rinforzando/Sforzando rendered as dynamic text.
- [x] **Special endings / volta brackets** — VoltaBracket class draws horizontal bracket with hooks and ending number text. Span auto-sized to reach next ending/barline.
- [x] **Articulation glyphs** — ArticulationMark class renders SMuFL glyphs for staccato, accent, tenuto, marcato, staccatissimo, fermata. Placed above/below notehead based on stem direction; multiple articulations stack outward.
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
- [ ] Landscape / portrait page orientation toggle (page layout mode)
- [ ] Multi-page rendering — display all pages vertically like a PDF viewer (currently only lays out pages but rendering may clip)
- [ ] Page navigation — jump to page N (page indicator + input or prev/next buttons)
- [ ] Page numbers, headers/footers in page mode
- [ ] Bar compression — fix bug where bars with many notes overflow or don't shrink to fit available width
- [ ] First-system indent for instrument names
- [ ] Melisma/extender lines for slurred notes under one syllable
- [ ] Multiple lyric verses (currently only verse 1 rendered; NWC supports up to 8)
- [ ] Grand staff brace rendering (`braceWithNext` parsed but not drawn)
- [ ] Proportional / spring-and-rod spacing (currently fixed-width-per-duration)
- [x] Grace notes — drawn at 60% scale with reduced spacing
- [x] Ties and slurs — direction follows stem (up→below, down→above); anchored at notehead pitch (offsetY); per-child-note chord ties; cross-system tie splitting preserves direction; slurs use outer chord note as anchor
- [x] Triplet/tuplet brackets — numeral on stem/beam side; fully-beamed triplets get numeral only (no bracket); unbeamed/mixed get bracket+numeral; vocal staves place numeral above to clear lyrics
- [ ] Alto and tenor clef support
- [x] Ending brackets (1st/2nd endings) — VoltaBracket class with ending numbers
- [x] Hairpins (crescendo/diminuendo) — Hairpin class with auto-spanning

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
