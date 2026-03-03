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

## Layout & Rendering

- [x] Wrap layout with DP-optimal line breaking, anchor-point justification, rigid note units
- [x] Page layout mode — Letter/A4 paper sizes, white page backgrounds with drop shadows
- [x] Layout toggle — cycles scroll → wrap → page; page size selector in page mode
- [x] Default font size 28
- [x] Courtesy clef + key signature at start of each new system line
- [x] Lyrics — syllable tokenizer, assignment respecting LyricSyllable/slur/tie rules, inter-syllable dashes
- [x] Staff visual properties — boundary-based spacing, bracket chains, layering, barline connector suppression near lyrics
- [ ] Additional music fonts — SMuFL-compliant fonts (e.g. [Leland](https://github.com/MuseScoreFonts/Leland), [Sebastian](https://github.com/fkretlow/sebastian), [GoldenAge](https://github.com/benwiggy/GoldenAge)), see [Verovio SMuFL docs](https://book.verovio.org/advanced-topics/smufl.html)
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
- [ ] Grace notes
- [ ] Ties and slurs (partially implemented)
- [ ] Triplet/tuplet brackets
- [ ] Alto and tenor clef support
- [ ] Ending brackets (1st/2nd endings)
- [ ] Hairpins (crescendo/diminuendo)

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

- [ ] MIDI import — load .mid files and convert to internal score representation
- [ ] MIDI export — export score as Standard MIDI File
- [ ] MusicXML import — load .musicxml / .mxl files
- [ ] MuseScore import — load .mscx / .mscz files
- [ ] LilyPond export — export score as .ly file
- [ ] PDF export / print feature from page layout

## Parser / Data

- [x] Binary NWC format (v1.55, v1.75, v2.0, v2.05) + NWC text format
- [x] LyricSyllable bit extraction from binary format
- [ ] V205+ staff visual property parsing (only 4 test files affected)
- [ ] Fix 4 files that fail new parser ("Unknown object type: 256")
- [ ] Visual regression test baselines
- [ ] Integration tests (Playwright)
