# Playback Highlights — Implementation Plan

> **STATUS: IMPLEMENTED.** Playback highlighting is fully working, evolved beyond the original plan. Key differences from plan: uses single-canvas rendering (not overlay canvas) with `PlaybackHighlighter.drawHighlights(ctx)` called from `quickDraw()`. Five highlight modes: Notes (translucent yellow overlay), Glow (blue halo), Bar (measure overlay), Column (vertical band), Off. Position cursor spans all staves. Auto-scroll in both wrap and scroll modes. Click-to-seek. Highlights persist on pause, clear on stop.

## Problem

During playback, there's no visual feedback on the score — notes don't highlight
and there's no position indicator. The playback system (`MidiScheduler`) already
emits `noteOn`/`noteOff` events, but `PlaybackController` doesn't forward them,
and `NoteEvent` objects have no link back to the score tokens/visual elements.

## Design Decisions

| Choice            | Decision                                                     |
|-------------------|--------------------------------------------------------------|
| Highlight style   | Colored noteheads (default) with toggle-able glow/halo option |
| Auto-scroll       | Yes, smooth scroll to keep active system visible             |
| Rendering         | Overlay canvas on top of score canvas                        |
| Trigger           | Both: individual noteOn/noteOff coloring + vertical position cursor |

## Architecture

```
MidiScheduler ──noteOn/noteOff──► PlaybackController ──► PlaybackHighlighter
     │                                  │                       │
     │ (time events ~46ms)              │ onNoteOn(ev)          │ manages overlay canvas
     └──────────────────────────────────┘ onNoteOff(ev)         │ tracks active note set
                                          onTime(t)             │ draws cursor + highlights
                                                                │ auto-scrolls viewport
```

## Changes Required

### 1. `src/audio.js` — Extend NoteEvent with token references

Currently `buildNoteEvents()` produces `{midi, time, duration, velocity, channel}`
and the link to the source token is lost. Add:

```js
{
  midi, time, duration, velocity, channel,
  staffIndex: si,       // NEW — index into staves[]
  tokenIndex: ti,       // NEW — index into staves[si].tokens[]
  token: tok            // NEW — direct reference to the token object
}
```

After layout, `token.drawingNoteHead` gives us the Glyph's `(x, y)` — the exact
canvas position of the notehead.

For Chord tokens, each child NoteEvent carries a reference to the child note
object in `tok.notes[i]`, which also has its own `drawingNoteHead`.

### 2. `src/audio.js` — Forward noteOn/noteOff from PlaybackController

Add two new callback registrations:

```js
onNoteOn(fn)   // fn(noteEvent) — called when a note starts sounding
onNoteOff(fn)  // fn(noteEvent) — called when a note stops sounding
```

Wire these to `MidiScheduler`'s existing `'noteOn'` and `'noteOff'` events in
`_ensureInit()`.

### 3. `src/layout/typeset.js` — Store staffIndex on tokens

In `handleToken()`, add `token.staffIndex = staveIndex` so that after layout,
tokens carry their staff identity. Currently this is only available via array
position.

### 4. New file: `src/playback-highlight.js` — PlaybackHighlighter class

Core class managing the visual overlay:

```
PlaybackHighlighter
├── constructor(scoreContainer)
│   └── creates overlay <canvas>, positions it over score canvas
│
├── setScore(staves, tempoMap)
│   └── builds sorted timeIndex: [{time, x, y, systemIdx, token}]
│       from all Note/Chord tokens across all staves
│       (uses token.tickValue → seconds via tempo map, token.drawingNoteHead.x/y)
│
├── onNoteOn(noteEvent)
│   └── adds noteEvent.token to activeNotes Set
│
├── onNoteOff(noteEvent)
│   └── removes noteEvent.token from activeNotes Set
│
├── updateTime(currentTime)
│   └── updates cursor X position (binary search in timeIndex)
│   └── triggers auto-scroll if needed
│
├── start() / stop()
│   └── begin/end requestAnimationFrame render loop (~30fps)
│
├── setHighlightStyle('colored' | 'glow')
│   └── switches rendering mode
│
├── render()  [rAF callback]
│   ├── clear overlay canvas
│   ├── draw vertical cursor line at interpolated X position
│   ├── for each token in activeNotes:
│   │   ├── get (x, y) from token.drawingNoteHead
│   │   ├── if style === 'glow': draw blurred colored circle behind notehead
│   │   └── draw notehead glyph path filled with highlight color
│   └── (no score redraw needed — overlay only)
│
├── handleResize()
│   └── resize overlay to match score canvas + zoom
│
└── dispose()
    └── stop loop, remove overlay canvas
```

### 5. Position cursor

A semi-transparent vertical line spanning the full system height, positioned at
the interpolated X of the current playback time:

- Build a sorted array of `{time, x, systemY, systemHeight}` from all note tokens
- Binary search for current time → get `x` (lerp between two nearest notes)
- In wrap mode: cursor also determines which system we're on (for auto-scroll)
- In scroll mode: cursor is a single vertical line

### 6. Auto-scroll

- **Wrap mode**: When the cursor moves to a new system, smooth-scroll the
  viewport to keep that system centered
- **Scroll mode**: Keep the cursor X within the center third of the viewport;
  scroll horizontally if it leaves that zone
- Use `element.scrollTo({ top, left, behavior: 'smooth' })` on the `#score`
  container

### 7. `src/main.js` — Wire everything together

```js
import { PlaybackHighlighter } from './playback-highlight.js'

const highlighter = new PlaybackHighlighter(document.getElementById('score'))

// After render:
highlighter.setScore(scoreManager.getData())

// Playback callbacks:
playback.onNoteOn(ev => highlighter.onNoteOn(ev))
playback.onNoteOff(ev => highlighter.onNoteOff(ev))
playback.onTime((t, dur) => {
    highlighter.updateTime(t)
    // existing progress bar update...
})
playback.onStateChange(playing => {
    if (playing) highlighter.start()
    else highlighter.stop()
})
```

### 8. `index.html` — UI additions

- Highlight style toggle button (colored ↔ glow) in the toolbar
- CSS for the overlay canvas (position: fixed, pointer-events: none)

### 9. Tests

- `test/playback-highlight.test.js`:
  - Time index building from mock tokens
  - Binary search for cursor position
  - NoteEvent ↔ token roundtrip (staffIndex, tokenIndex preserved)
  - Active note set management (add/remove on noteOn/noteOff)

## Implementation Order

| Step | File(s)                    | Description                                                |
|------|----------------------------|------------------------------------------------------------|
| 1    | `audio.js`                 | Extend NoteEvent with `staffIndex`, `tokenIndex`, `token`  |
| 2    | `audio.js`                 | Add `onNoteOn`/`onNoteOff` to PlaybackController           |
| 3    | `typeset.js`               | Store `token.staffIndex = staveIndex` in `handleToken()`   |
| 4    | `playback-highlight.js`    | Create PlaybackHighlighter: overlay canvas, render loop    |
| 5    | `playback-highlight.js`    | Implement colored notehead highlighting                    |
| 6    | `playback-highlight.js`    | Implement glow/halo effect (toggle-able)                   |
| 7    | `playback-highlight.js`    | Implement position cursor (vertical line)                  |
| 8    | `playback-highlight.js`    | Build time→position index + binary search                  |
| 9    | `playback-highlight.js`    | Implement auto-scroll (wrap + scroll modes)                |
| 10   | `main.js` + `index.html`   | Wire highlighter to playback, add style toggle UI          |
| 11   | `test/`                    | Unit tests for time index, cursor position, note events    |

## Risks / Open Questions

- **Chord noteheads**: A Chord token has multiple noteheads (one per
  `token.notes[i]`). Each child may have its own `drawingNoteHead`. Need to
  highlight all of them.
- **Canvas redraw on stop**: When playback stops, overlay clears. If the user
  resizes or relayouts during playback, the overlay needs to re-sync with new
  positions.
- **Performance**: The rAF loop only touches the overlay canvas. The score canvas
  is never redrawn during playback. Should be fine for typical scores.
- **Glyph path access**: To draw a colored notehead, we need the opentype.js
  `Path` object from the Glyph. `Glyph.draw(ctx)` uses `this.path.draw(ctx)`.
  We can replicate this on the overlay with a different fill color.
- **Reflow during playback**: If the user toggles layout mode or resizes the
  window during playback, the highlighter must rebuild its time→position index
  from the newly-reflowed token positions.
