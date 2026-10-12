# 3D notation view (from midiviz Notation 3D)

Bring midiviz experiment #025 (`midiviz/025_notation_3d.html` + `midiviz/notation3d/`)
into Notably as a fourth view: the engraved score extruded into a three.js scene,
with lights hopping note to note during playback.

## What midiviz already does

The 3D page already runs *this* repo's engraver. `notation3d/nwc-bridge.js` imports
`../nwc-viewer/src/*`, stubs the DOM ids it needs, forces `setLayoutMode('scroll')`,
runs `interpret` + `typeset.score`, then takes `[...window.drawing.set]`.

| midiviz file | role | in Notably |
|---|---|---|
| `nwc-bridge.js` | headless loader for nwc-viewer | **drop**: we are in-process |
| `vector-recorder.js` | fake Canvas2D ctx replays `Draw.draw(ctx)` into path records; opentype `Path.draw` patched to record glyphs; extrudes into InstancedMesh / merged meshes | **copy as is** |
| `stage.js` | `NotationStage` (scene, cameras, themes, lanes, bloom/DOF, quality tiers) + `buildOnsets` | **copy**, vendor the title font |
| `midi-score.js` | own MIDI → tokens (grand-staff split) | later, optional (phase 3) |
| `video-export.js` | offline WebCodecs MP4 export with OxiSynth audio | later (phase 3) |
| page script | transport, clock interpolation, UI | **rewrite** as glue on Notably's `PlaybackController` |

The audio stack is the same library on both sides (`vendor/soundfont-engine`), so
the 3D view reuses Notably's playback and adds no second synth.

## Design

### Engraving: 3D implies scroll layout
`typeset.js` keeps its layout in module globals and one `window.drawing`. Wrap and page
modes reflow drawing objects in place. The stage also assumes a single line, because its
camera follows x. So entering 3D:

1. remembers the current layout mode, calls `setLayoutMode('scroll')`, then `rerender()`;
2. hides the 2D canvas (`window.canvas`, which is `position: fixed`) and `#score`, and shows `#score3d`;
3. on exit, restores the mode and calls `rerender()`.

There is no second layout pass and no fork of the typesetter.

### Build hook
`rerender()` (`main.js`) calls `view3d.rebuild(data)` right after
`highlighter.setScore(data)`, but only while 3D is active. Edits, font or staff-size
changes, "show hidden items" and solo all flow through `rerender`, so they rebuild
the 3D scene for free.

```
records = recordElements([...window.drawing.set].filter(el => !el.isTitleBlock), measureCtx)
built   = buildScoreMeshes(records, { fontSize: getFontSize(), materials: stage.materials })
hits    = events.notes.map(n => ({ time: n.time, staff: n.staffIndex, token: n.token }))
stage.setScore(built, buildOnsets(hits, built.heads, staves.length))
stage.setTitle(data.info.title)       // extruded 3D title instead of the 2D one
```

- **Title.** midiviz blanked `data.info.title`, which we must not do because it would be
  saved. Instead, `addTitleBlock` (`typeset.js`) tags its `Text` elements with
  `isTitleBlock = true`, and the recorder skips them.
- **Timing.** `buildNoteEvents(data)` (`audio.js`) gives repeat-unrolled seconds plus
  *live* tokens, as long as we call it directly rather than taking scheduler messages,
  which are structured clones. The view calls it at rebuild time.
  `PlaybackController.load()` only runs when Play is pressed, which is too late to
  reuse its events.
- **Solo and mute.** Only audible staves light up. A solo change rebuilds the scene.
- **Coalescing.** Rebuilds are coalesced to one per frame, because rerenders come in
  bursts as text fonts arrive.
- **Staff index mismatch is harmless here.** Heads are keyed by `token.drawingNoteHead`,
  and the staff index only groups and colours the lanes.
- **opentype patch.** Call `patchOpentype(window.opentype)` once on first enable.

### Clock
`playback.onTime` fires about every 46 ms, so the glue extrapolates the time the same
way midiviz `frame()` does: `est = audioTime + min(0.15, elapsed * speed)`.
`playback.seek()` emits nothing, so the glue sets its own clock on every seek (progress
bar, click-to-seek). The stage already re-colours when time jumps by more than 0.6 s.
It is wired into the existing single-callback fan-out in `main.js` (`onTime`,
`onStateChange`, `onEnd`), next to `highlighter` and `pianoKeyboard`.

The 3D view runs its own rAF loop only while visible. While 3D is shown,
`highlighter` must not drive `quickDraw`.

### three.js
- Vendor three r170 into `vendor/three-0.170.0/`: `build/three.module.min.js` plus the addons
  `stage.js` uses and their imports (postprocessing passes, Copy, LuminosityHighPass,
  Bokeh and Output shaders, VignetteShader, RoomEnvironment, FontLoader, TextGeometry,
  Reflector) and `fonts/droid/droid_serif_bold.typeface.json`. Notably vendors
  everything else and works offline.
- The addons import the bare specifier `'three'`, so `index.html` needs an importmap
  (`three`, `three/addons/`) placed before the `main.js` module script.
- Lazy loading: `main.js` does `await import('./view3d/view3d.js')` on first enable, so
  the 2D viewer pays nothing.

### UI
- **View button.** `#layout_group` becomes Scroll | Wrap | Page | **3D**. The click
  handler intercepts `data-mode="3d"` before `setLayoutMode`, which only accepts the
  three layout modes.
- **Toolbar in 3D.** Page nav and the 2D zoom group are hidden. Camera zoom is a
  slider in Settings.
- **Toolbar width.** The extra button made the toolbar wrap at 1280 px while playing
  and in page layout. The progress bar and zoom slider now shrink at ≤ 1360 px.
- **Settings → "3D view".** Camera, theme, lit notes, notehead and paper finish,
  Bloom, Focus blur, Trails, Shadows, Sparkles, Zoom and Hop. The controls hold the
  defaults; `[data-opt3d]` maps each control to a stage option. Clicking the scene
  still cycles the camera, and the Camera select follows it.
- **Persistence.** `nwc_view_3d` and `nwc_3d_opts` in localStorage, like `nwc_piano_visible`.
- **CSS.** `#score3d { flex: 1; position: relative }` and
  `#score3d canvas { position: static; background: none }` override the global
  `canvas { position: fixed }`.
- **Piano keyboard.** It stays available under the 3D view.

### Files
```
vendor/three-0.170.0/...         three r170 module build + 17 addon files + title font
src/view3d/vector-recorder.js    from midiviz; recordElements takes the default font
src/view3d/stage.js              from midiviz; TITLE_FONT → vendor path
src/view3d/onsets.js             buildOnsets, split out of stage.js (no three → unit
                                 tested); ids in a WeakMap instead of token._uid
src/view3d/view3d.js             View3D: rebuild, clock extrapolation, rAF, options
src/main.js                      enter3D/exit3D, rerender hook, playback fan-out,
                                 layout button, settings wiring, persistence
src/layout/typeset.js            isTitleBlock tag in addTitleBlock
src/drawing.js                   resizeToFit clamps a hidden #score (falls back to 800)
index.html                       importmap, 3D button, #score3d, settings section, CSS
test/view3d-onsets.test.js       onsets from buildNoteEvents
```

Once this lands, midiviz 025 should import `stage.js`, `onsets.js` and
`vector-recorder.js` from `NWC_BASE + 'src/view3d/'`, the same place it already loads
the engraver from, and delete its copies. That leaves one source of truth.

## Phases

1. **MVP: done.** Checked headless (Chromium with SwiftShader WebGL) on:
   - nwc (`AChildThisDayIsBorn`, `WeThreeKings`)
   - nwctxt (`HappyBirthdayTrio`)
   - MusicXML (from nwc2xml)
   - MIDI (`nwcs/schuspri.mid`)
   - MuseScore through webmscore (Up Theme)

   All of these play in sync with the audio and the piano keyboard. Leaving 3D
   restores the previous layout and resumes the 2D highlighter mid-playback. Reloading
   keeps the 3D view and its options. Build time for Chopin's Concerto No. 1 (30 842
   elements, 8 885 noteheads) is 183 ms.
2. **Correctness and polish.**
   - Repeats: the camera timeline assumes x increases, but unrolled repeats jump back.
     Snap the camera instead of sweeping backwards, and make `headState` keep every
     hit time so the second pass relights notes.
   - Click-to-seek: raycast the InstancedMesh `instanceId` to a head, then to its time.
     View cycling moves from click to a button and the `V` key.
   - Share the palette with `PianoKeyboard` so lights match the keys. They differ today.
   - Throttle the render loop when paused and idle. Today it renders every frame.
   - Light tied continuation noteheads. Only the first note of a tie gets an event.
   - Skip the rebuild when the layout input is unchanged, for example after a font
     `loadingdone`.
3. **Extras.**
   - Video export: needs `video-export.js` and a vendored `mp4-muxer`. OxiSynth is
     already at `vendor/soundfont-engine/vendor/oxisynth`. The schedule and programs
     come from the events plus `stave.patchName`, as in the midiviz NWC path.
   - `midi-score.js` as an alternative MIDI importer, which also benefits 2D.

## Testing
- **bun** (`test/view3d-onsets.test.js`). Checks onsets built from `buildNoteEvents`:
  per-staff onsets are time-sorted, chord heads are grouped, repeats yield repeated
  heads, undrawn staves are skipped, and tokens are not mutated.
- **Playwright** (still to do in `test/integration/`). Enable 3D, wait for
  `window.__render3DComplete = { elements, heads, onsets }`, and assert that `heads`
  equals the rendered notehead count. Do not use pixel baselines, because headless
  WebGL is flaky.

## Risks
- **Size.** three.js plus addons is about 0.8 MB, mitigated by lazy loading.
- **Large scores.** Geometry is already chunked every 40 units, and the stage has
  adaptive quality tiers. Build time is logged.
- **Opaque elements.** `Path` elements, used for braces and connectors, are opaque
  `_drawFn` closures. The recorder still captures them, because it records whatever
  they draw.
