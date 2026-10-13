# Soundfonts

Played by the soundfont engine (OxiSynth). Pick one under the playback bar's
⚙ → Sound (the list is `SOUNDS` in `src/audio.js`); "Load a soundfont file…"
plays any .sf2 / .sf3 from your computer for that visit.

| File | Sound | Notes |
|---|---|---|
| `Creative(emu10k1)8MBGMSFX.sf2` | General MIDI (default) | 7.6 MB, all 128 GM instruments + drums |
| `FluidR3.sf3` | FluidR3 General MIDI | Frank Wen's FluidR3 GM (MIT licence), Ogg-compressed SF3 (20 MB); converted to SF2 when loaded, which takes a few seconds |
| `Motif_ES6_Concert_Piano.sf2` | Concert piano | Sampled Yamaha Motif ES6 grand (12.6 MB); one instrument, so every part plays piano |

FluidR3 and the Motif piano come from [midiviz](https://github.com/zz85/midiviz/tree/main/soundfonts),
which uses the same set.
