# Changelog

### v2.6 - October 2026

#### Interface
- New player-style shell: top bar with title (click to rename), composer, save status, Page | Wrap | Line | 3D, Aa and Share
- Menu drawer for opening files and samples and exporting (nwctxt, nwc, MusicXML, PDF, Video); Aa drawer with the regrouped settings
- Studio (dark) and Light themes
- Transport bar: time and "Bar n of N · section", previous / play / next section, a scrub bar split into the score's sections (repeats unrolled), volume, speed, piano keyboard, full screen; fades while playing
- Keyboard shortcuts (press ? for the list); playback resumes where it was paused
- Sound picker: General MIDI, FluidR3, concert piano, or any .sf2/.sf3 file

#### 3D View & Video
- 3D view: the score extruded in three.js, a light per voice hopping from note to note during playback
- Video export (.mp4) of the 3D view: resolution, aspect, camera tours, title cards, frame rate, range, audio in the chosen sound

#### Engraving & Layout
- Collapsing staves (NWC Boundary Collapse / EndCollapse): collapsed staves leave the system and the staves below close up
- Forced system breaks (Boundary NewSystem), from the top staff only as NWC does
- Brackets engraved per instrument group with the font's curved ends, outside any brace they enclose; staff labels clear them
- Show hidden items (Aa > Advanced): hidden staves, marks, filler rests and collapsed bars drawn as faint ghosts
- Staves stay aligned through mid-piece clef, key and time changes (53 of 120 samples had drifting barlines)
- Secondary beams sit right inside the primary beam

#### MusicXML Import
- Notes last their real length (tuplets), so staves stay in step with each other and with playback
- Each measure ends at its longest voice, with tuplet rounding snapped to the time signature

#### Samples & Tools
- Happy Birthday: Variations for Violin and Piano, and a Concert Paraphrase for Piano; trio voicing fix
- compose-score skill and scripts/compose tools: build .nwctxt from code, check scores (alignment, ranges, clashes), render to PNG

### v2.5 - October 2026

#### Save, Share & Export
- Save menu: NoteWorthy text (.nwctxt), NoteWorthy Composer 2.75 (.nwc), MusicXML and PDF, including edits made in the viewer
- Text and 2.75 sources keep every other line byte for byte; older binary files are converted (new nwctxt writer)
- Unsaved changes are kept in the browser with the original file and restored on reload, with Discard
- Share links: `?song=<sample>` opens a built-in sample; other or edited scores travel compressed in the URL fragment
- PDF export at 300 DPI on Letter/A4, portrait or landscape, with an option to fit on one page

#### Editing
- Click the title, author or lyricist to edit it in place

#### Engraving & Layout
- Ending barlines line up across staves and connect through the staff group, with proper space after the last note
- Connected barlines are kept in wrap and page modes
- Fixed stem direction of beamed groups without a stored direction
- System gaps sized from the content of the systems they separate; page mode keeps systems below the title
- First system indented for staff labels
- Ties, slurs and hairpins split across system breaks; slurs shaped to clear the notes they span
- Dynamics and hairpins kept clear of notes, on a shared line; hairpins from note attributes
- All lyric verses, lyrics on chords, verse numbers, '_' as a space, no overlapping syllables
- Full-bar rests centred (only when alone in the bar), 2.75 multi-bar rests expanded, rest chords drawn and timed
- Title block, text styles, text scaling and tempo marks match NWC
- Object Visibility respected; staves left out of the score are hidden
- Fixed placement of flow marks, repeats and texts
- Staff text (chord names, expressions in staff fonts) sized like NWC: 1:1 with the staff size
- Bar numbers no longer count a leading repeat or a ":||:" pair as a bar
- Scroll mode: title shown on the opening screen, staff labels with room made for them
- Rests in layered voices keep their vertical offset

#### Parsing
- NWC 2.75 text parsed to parity with binary files; plain .nwctxt files use the new parser (instruments and transposition)
- NWC 2.05 files and 2.0x header edge cases
- Encoding detection for EUC-KR/CP949, Shift-JIS, GBK and Windows-1251; Western text no longer misdetected as CJK
- Fixed nwctxt key signatures, MIDI channels and blank lyric syllables
- Staff names made of non-breaking spaces no longer decode as Korean text
- The old parser is only an automatic fallback; its comparison toggle moved to Settings > Advanced and is no longer remembered
- Fixed swapped beam middle/end in NWC to MusicXML

#### Playback
- Muted staves stay silent
- Grace notes take no metric time; fixed rest-chord timing

#### UI
- Toolbar reorganised into a main bar and a Settings menu, kept on one row in page mode
- New sample: Happy Birthday for oboe, viola and double bass

### v2.4 - May 2026

#### MuseScore Import (.mscx/.mscz)
- Added full MuseScore file import support (v1.x, v2, v3, v4 formats)
- Multi-voice and multi-staff parsing
- Transposing instrument support
- WebMscore pipeline for binary .mscz files with JS parser fallback

#### MusicXML Import (.musicxml / .mxl / .xml)
- Added MusicXML import support including score-timewise format
- Hardened WebMscore pipeline for the import process

#### NWC Comparison & Validation
- Multi-voice pitch comparison with measure-based analysis
- Improved tie-end inference by pitch matching
- Ottava (8va/8vb) tolerance and dominant octave shift detection
- Better categorization of comparison results

#### Playback
- Added playback speed control (slider + number input)
- Fixed tempo calculation: beatDuration now uses whole-note fractions instead of NWC codes

#### Page View & Navigation
- Added page view modes: single-page, fit-width, fit-height, two-up, horizontal scroll
- Added page numbers, copyright footer, and jump-to-page navigation
- Reworked zoom controls for fit-width/height modes

#### Rendering Fixes
- Fixed cross-staff barline and note alignment with mismatched barlines
- Fixed duplicate ending barlines and spurious bar numbers
- Fixed stave/barline alignment

#### Parser Fixes
- Fixed NWC text parsing: version extraction from header, Locale, and unknown tokens
- Fixed MS v1.x key/time signature parsing
- Fixed initial clef/keysig/timesig detection (only mark as present if found in the first measure)
- Fixed multi-staff naming and simplified timing advance

#### Tests
- Added multi-staff/voice integration tests
- Added round-trip integration tests (skipped when test data is missing)

#### Docs
- Updated musicxml-import.md and musescore-import.md with implementation status and test results

### v2.3 - March 2026
- **Print emulation** — WebGL2 ink-bleed post-processing filter for paper-like rendering; paper color picker; page-mode background masking
- **Page layout mode** — Letter and A4 paper sizes with proper page breaks
- **Advanced controls panel** — collapsible panel with spacing density, rod/spring balance, duration proportionality, and ink-bleed sliders
- **Dynamic inter-staff spacing** — content-aware vertical gaps based on actual note extents rather than fixed multipliers
- **System barline** — single barline connecting all staves at the left edge of each system
- **Grand staff braces** — SMuFL glyph-rendered `{` brace for piano/organ staves, tips aligned to stave edge via glyph bbox
- **Bar numbers** — measure numbers displayed at the start of each system
- **Articulations** — staccato, accent, tenuto, marcato, staccatissimo, fermata; correct stem-side placement with staff-line avoidance
- **Grace notes** — acciaccatura (slashed) and appoggiatura; scaled stems/flags/beams, stems forced up; zero display timing for cross-staff alignment
- **Triplet brackets** — bracket-less numeral for beamed groups; bracketed for unbeamed/rest-containing groups; stem-side placement
- **Chord second displacement** — alternating noteheads for cluster chords
- **Beam engraving** — standard 0.5 staff-space thickness and 0.25 staff-space separation per Gould/Dorico spec
- **Playback highlights** — bar overlay, columnar, and note-column modes; click-to-seek; auto-scroll
- **Piano keyboard** — on-screen keyboard visualization with solo/mute per staff
- **Per-staff MIDI** — GM instrument assignment and transposition per staff; dynamic velocity; repeat/volta playback
- **Hairpin rendering** — correct wedge geometry spanning note ranges
- **Volta brackets** — first/second ending brackets rendered above staff
- **Multiple music fonts** — dynamic font switching with 20+ bundled fonts (Finale Maestro, Jazz, Broadway, Leland, Petaluma, Leipzig, Sebastian, etc.) and matched companion text fonts
- **MIDI import** — load `.mid`/`.midi` files as rendered score
- **Spacing model** — spring-rod spacing with duration proportionality; two-pass line breaking; interactive sliders
- **Engraving rules** — constants calibrated against MuseScore, LilyPond, and OSMD; font-size-relative dimensions replacing hardcoded pixels
- **Professional ties/slurs** — cubic bezier curves, separate Slur class, staff-line collision avoidance, beam slope clamping
- **Parser** — V175 staff connection flags from staffType; color field parsing; Segno/Coda non-spacing fix
- **UI refresh** — two-row toolbar, segmented layout/orientation controls, logo links to GitHub, localStorage persistence for last loaded song
- **CI** — GitHub Actions workflow running tests on push
- 530 unit tests; 50+ synthetic visual test fixtures (open `test/visual/index.html`)

### v2.2 - March 2026
- **Wrap layout** with DP-optimal line breaking and anchor-point justification
- **Lyrics** — syllable assignment respecting slur/tie/LyricSyllable rules, inter-syllable dashes
- **Staff visual properties** — boundary-based spacing, bracket/brace chains, layering
- **SoundFont playback** — OxiSynth (Rust/WASM) with GM SoundFont, replacing musical.js
- **Playback controls** — play/pause, stop, progress bar, time display
- Beam, tie, and barline connector fixes
- Virtual viewport rendering with transform-based zoom
- 285 unit tests

### v2.0 - January 2026
- Refactored global variables to MusicContext pattern for better modularity
- Implemented proper beam support respecting NWC file beam markers
- Improved tie and slur rendering with better matching logic
- Added comprehensive error handling throughout parsing and rendering
- Improved layout spacing with logarithmic scale for better visual balance
- Added layout test suite (184 total tests)
- Fixed dotted note spacing for stem-up notes with flags
- Fixed quickDraw resize handling

### 5 May 2020
- Add support for loading nwc v1.55
- lyrics rendering
- add zoom scaling
- add canvas scrolling by dragging
- initial tie
- added debug glyph buttons

### v1 "MVP" 28 December 2017
[Basic opening of some nwc files](https://github.com/zz85/nwc-viewer/releases/tag/v1)
- open more nwc files (1.75, 2, 2.75/nwctext)
- musicial alignment
- music playback via musical.js with abc export
- more accurate font loading via opentype.js

### v0 "POC" 20 Nov 2017
Porting nwc2ly.py to js, basic notation rendering
- basic smufl font tests
- basic glyph renderings
- basic nwc file parsing
