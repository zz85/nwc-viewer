# Spacing Improvements Plan

Inspired by the spring-rod model implementation
and traditional engraving conventions (Gould, Ross, Stone).

## Overview

The spring-rod model is in place (Ross/Gould tables, per-system spring factor,
rod = max of musical width and lyric width). These improvements address
remaining gaps found during a thorough spacing audit.

---

## 1. Multi-Staff Spring Map

**Impact: HIGH | Files: typeset.js**

`buildSpringMap()` and `collectAnchors()` only read `staves[0]`. If staff 2
has wider notes (accidental chords, dense ornaments), the rod is underestimated
and springs over-compress, causing overlap on non-primary staves.

**Fix:** Iterate over ALL staves' tokens in `buildSpringMap()`. For each beat
position, take `max(rod)` across all staves. `collectAnchors()` should merge
anchor X positions from all staves (they should already be identical due to
TickTracker, but rod/spring values differ per staff).

---

## 2. Accidental Space Reservation

**Impact: HIGH | Files: typeset.js (drawForNote)**

Accidentals hang left via `acc.offsetX = -acc.width * 1.2` with zero space
reserved before the notehead. This means the accidental occupies space to the
LEFT of `cursor.staveX`, potentially colliding with the previous note's dots,
flags, or stem.

**Fix:** Before placing the notehead, call `cursor.incStaveX(accWidth)` where
`accWidth = acc.width * 1.2 * graceScale`. This advances the cursor past the
accidental zone so subsequent elements don't overlap it.

---

## 3. Cross-System Ties

**Impact: HIGH | Files: ties.js, typeset.js**

Ties spanning system breaks produce incorrect rendering. The `Tie` constructor
computes width from start.x to end.x, but when these are on different systems
the reflow pass applies the wrong system's justification to the end coordinate.

**Fix:** In `layoutTies()`, detect when start and end notes span a system break
(using `collectMeasureBoundaries` or breakXs). When detected:
1. Replace the single tie with two partial arcs.
2. Arc 1 (system N): from start note to the right edge of system N.
3. Arc 2 (system N+1): from the left edge (after courtesy items) to end note.
4. Both arcs use correct Y coordinates for their respective systems.

---

## 4. TickTracker Multiplier Consistency

**Impact: MEDIUM | Files: typeset.js (TickTracker)**

`TickTracker.add()` uses `lastPadRight * 0.5` (X_STRETCH) while
`alignWithMax()` uses `lastPadRight * 4` — an 8x discrepancy.

- `add()` at 0.5x registers a very tight "end of note" position for
  cross-staff alignment.
- `alignWithMax()` at 4x jumps forward aggressively when no alignment
  target exists, creating large unexpected gaps.

**Fix:** Unify to a consistent multiplier (1.0x for both) and tune from there.
Since `tokenPadRight` values are already scaled by `calculatePadding()` (which
returns sqrt-based values from 0.5 to 4.0), a 1.0x multiplier is neutral.

---

## 5. Missing 32nd/64th Rest Glyphs

**Impact: LOW | Files: typeset.js (handleToken, Rest case)**

The rest duration-to-glyph map only covers durations 1-16:
```js
var sym = {1:'restWhole', 2:'restHalf', 4:'restQuarter', 8:'rest8th', 16:'rest16th'}[duration]
```
Durations 32 and 64 map to `undefined`, causing silent failures. These glyphs
exist in all SMuFL fonts (`rest32nd`, `rest64th`).

**Fix:** Add `32: 'rest32nd', 64: 'rest64th'` to the lookup map.

---

## 6. Grace Note Spacing

**Impact: MEDIUM | Files: typeset.js (drawForNote)**

Grace notes with accidentals get no space reservation (same accidental
collision issue as #2, but worse due to 0.6x scale). The spring is a fixed
`spacerWidth() * 0.5` (~3.5px) regardless of duration — too tight.

**Fix:**
- Apply accidental space reservation (same as #2) scaled by `graceScale`.
- Set grace note spring to `rossSpringWidth(durValue) * 0.4` (duration-
  proportional but compressed to 40%) instead of the fixed value.

---

## Implementation Order

1. #5 Missing rest glyphs (trivial, 1 line)
2. #2 Accidental space reservation (low effort, high impact)
3. #4 TickTracker multipliers (low effort, medium impact)
4. #6 Grace note spacing (low effort, depends on #2)
5. #1 Multi-staff spring map (medium effort, high impact)
6. #3 Cross-system ties (medium effort, high impact, separate concern)
