# Notably — Features TODO

Planned features and improvements, roughly prioritized.

## Playback

- [ ] Highlight current bar — light red translucent overlay behind the active measure during playback
- [x] Solo / mute per staff — play back only the selected track instead of all staves
- [x] Piano roll / keyboard visualization — show a piano at the bottom with keys lighting up as notes play
- [ ] Instrument/channel assignment per staff — currently all notes go to channel 0 / piano
- [ ] Dynamic markings affect playback velocity
- [ ] Repeat/volta playback support
- [ ] Tempo changes during playback (rit., accel.)

## Layout & Rendering

- [ ] Default font size 28 (currently 60)
- [ ] Landscape / portrait page orientation toggle (page layout mode)
- [ ] PDF export / print feature from page layout
- [ ] Page numbers, headers/footers in page mode
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

- [ ] Keyboard shortcuts (space = play/pause, arrow keys = scroll, +/- = zoom)
- [ ] Viewer/editor mode toggle — hide invisible items in view mode
- [ ] Staff visibility toggle
- [ ] Dark mode for the score canvas
- [ ] Mobile-friendly touch controls

## Parser / Data

- [ ] V205+ staff visual property parsing (only 4 test files affected)
- [ ] Fix 4 files that fail new parser ("Unknown object type: 256")
- [ ] Visual regression test baselines
- [ ] Integration tests (Playwright)
