---
name: compose-score
description: Compose or arrange music as a NoteWorthy (.nwctxt) score that plays and renders in Notably — arrangements of a tune for given instruments, variations, showpieces, exercises. Use when asked to write, arrange, orchestrate or re-voice a piece "in nwc/nwctxt format", "for the viewer", or "for Notably".
---

# Compose a score for Notably

Write the music as a small generator script on top of
`scripts/compose/nwctxt-builder.js`, then check it with the viewer's own
parser (`check-score.js`), look at it (`render-score.js`), and fix what the
checks and your eyes find. Never hand-type nwctxt: the builder computes staff
positions, accidentals, beams and triplets, and rejects bars of the wrong
length.

## 1. Plan before writing notes

Decide and write down (you'll explain it to the user afterwards):

- **Form** — e.g. intro, theme, variations, cadenza, coda; bars per section;
  where pickups (anacruses) fall. Put a pickup into the next section on the
  last beat of the previous section's final bar.
- **Key** — suit the instruments (strings: D, A, G; winds: F, Bb, Eb; piano:
  any) and the melody's range.
- **Registers and ranges** — keep each part in its comfortable range
  (`check-score.js` knows the usual ranges by GM patch); give the melody the
  instrument's singing register; space chords wide at the bottom, close at the
  top.
- **Harmony chart** — one chord per beat (or half bar) for the whole tune,
  as data in the script. Every voice is derived from it, so it must be right:
  check melody notes against it and re-harmonize where a melody note clashes
  (e.g. a dominant over the bass note, `A7/G`, instead of a triad the melody
  rubs against).
- **Texture per section** and what makes each section harder or different
  (running notes, broken chords, double stops, octaves, leaps, tempo).

## 2. Write the generator

`scripts/compose/examples/happy-birthday-violin.js` is a complete example
(intro, theme, three variations, cadenza, coda, violin + piano). Copy its
shape:

```js
import { Score, n, r, seq, dyn, tempo, perf, text, fermata, hairpin, octave, midi } from '../nwctxt-builder.js'
const score = new Score({ title, author, key: 'D', time: '3/4' })
const vln = score.addStaff({ name: 'Violin', label: 'Violin', abbr: 'Vln.', clef: 'treble', patch: 40 })
const rh = score.addStaff({ name: 'Piano RH', label: 'Piano', clef: 'treble', patch: 0, withNext: 'Brace', connectBars: true })
const lh = score.addStaff({ name: 'Piano LH', clef: 'bass', patch: 0 })
vln.bar(tempo(84), dyn('mp'), n('B4', '4'), n('A4', '4'), n('D5', '4'))
vln.bar(n('A4 C#5', '2'), n('A4', '8.'), n('A4', '16'))   // chord = space-separated pitches
score.doubleBarAfter(4, 12)
writeFileSync(out, score.toNwctxt())
```

- Pitches: `C4` = middle C, `#`/`b`/`x`/`bb`. Spell them as the harmony
  needs (`Bb` in Gm, `C` natural in D7) — the builder writes accidentals
  against the key signature and the bar.
- Durations: `'1' '2' '4' '8' '16' '32'`, dots `'4.'`, triplet members `'8t'`
  (three in a row), `'bar'` for a full-bar (whole) rest.
- Note flags: `slur` (slurred to the next note), `tie`, `stac`, `acc`, `ten`,
  `marc`, `grace`, `stem`.
- Marks go before the note they belong to: `dyn('f')`, `tempo(120)`,
  `perf('Cantabile')` (NWC's list: Maestoso, Cantabile, Con brio, Legato,
  Marcato, Dolce, Grazioso, Espressivo…), `text('Var. I')`, `fermata()`
  (put one on every staff), `hairpin('Crescendo')`, `pedal()`.
- Derive figurations from the harmony chart in code (chord tones below a
  melody note, broken chords, double-stop partners) rather than typing them:
  that's what keeps them in the harmony. Choose double-stop and chord partners
  from chord tones, preferring 3rds and 6ths.
- Instruments: GM patch numbers are 0-based (piano 0, violin 40, viola 41,
  cello 42, double bass 43 with `trans: -12` and the part written an octave
  up, flute 73, oboe 68, clarinet 71, horn 60, trumpet 56).
- Grand staff: `withNext: 'Brace', connectBars: true` on the upper staff.
  Score groups of instruments: `withNext: 'Bracket'`.
- Write each staff's bars in order; all staves need the same number of bars.

Run it: `bun scripts/compose/examples/<piece>.js samples/<Piece>.nwctxt`.

## 3. Check — and fix until clean

```
bun scripts/compose/check-score.js samples/<Piece>.nwctxt          # clashes lasting an 8th+
bun scripts/compose/check-score.js samples/<Piece>.nwctxt --clash 4 # only quarter-length or longer
```

It reads the file exactly as Notably does and reports:

- **structure** — bar counts and barlines out of line across staves (exit 1);
- **ranges** — notes outside each instrument's usual range;
- **clashes** — semitone clashes (minor 2nd/9th, major 7th) between notes
  sounding together for an 8th or longer, as `bar.beat upper–lower parts`.

Treat every clash as a wrong note until proven otherwise: fix the voicing,
the chord, or the melody's harmonization. Short passing-note rubs in fast
runs only show with `--clash 16`; those are normally fine. The checker can't
hear parallel fifths/octaves, weak voice leading or unidiomatic writing —
review those yourself (outer voices, leaps, string crossings, hand spans:
a piano hand spans an octave, a 9th at most).

### Voicing and writing rules that the checks taught us

- Double stops and chord partners: chord tones only, 3rds/6ths first — a
  plain diatonic 3rd under the melody clashes with the accompaniment's
  harmony (G under B over a D chord, B against D7's C).
- Chords under a melody: keep every inner voice at least a 3rd below the one
  above; nearest-chord-tone voicings bunch into seconds.
- When the harmony changes on a later beat, move the bass with it (a held
  bass under a new chord is a clash the checker reports).
- Doubling a bass an octave lower: check it stays at or above A0 (piano),
  E1 (double bass) — derive from the bass up, not down.
- Dynamics under beamed runs collide with the beams: give `dyn()` a lower
  `pos` (-12, -14).

## 4. Look at it

```
node scripts/compose/render-score.js samples/<Piece>.nwctxt --out /tmp/<piece>.png --height 3400
```

Read the PNG (crop with `sips -c <h> <w> --cropOffset <y> <x>` to inspect
sections). Check: notes and accidentals as intended, beams and slurs per beat,
dynamics and text not colliding with notes (move them with their `pos`
argument), staves aligned, rests sensible (`'bar'` for empty bars).
`--mode page` shows the printed pages; `--hidden` shows hidden items.

## 5. Finish

- Add the file to the `samples` array in `src/main.js` so it shows in the
  dropdown and opens with `?song=<file>`.
- Run the unit tests (`bun test test/*.test.js`, read the pass/fail counts).
- Tell the user what you wrote: the form as a table (bars, section, what each
  part does), the key and harmony, what you checked, and what is untested
  (nobody has played it). Keep the generator in `scripts/compose/examples/` so
  the piece can be changed and regenerated.

## NWC/nwctxt facts the builder already handles (for debugging output)

- Staff positions count from the middle line (treble B4, bass D3, alto C4);
  accidentals persist per position for the rest of the bar.
- Lines end in CRLF; the file starts `!NoteWorthyComposer(2.75)` and ends
  `!NoteWorthyComposer-End`.
- A fermata is a `|TempoVariance|Style:Fermata` before the note; dynamics,
  tempo and text objects take a `Pos` (positive = above the staff).
- `Boundary` objects (`Style:Collapse`/`EndCollapse`/`NewSystem`) collapse
  staves or force system breaks — `NewSystem` only acts on the top staff.
