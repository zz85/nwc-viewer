#!/usr/bin/env bun
// Happy Birthday — Variations for Violin and Piano (samples/HappyBirthdayVirtuoso.nwctxt)
//   bun scripts/compose/examples/happy-birthday-violin.js [out.nwctxt]
import { writeFileSync } from 'fs'
import { Score, n, r, seq, raw, dyn, tempo, perf, text, fermata, hairpin, midi, octave } from '../nwctxt-builder.js'

const score = new Score({
	title: 'Happy Birthday',
	author: 'Trad. (Mildred & Patty Hill) - Variations for Violin and Piano',
	key: 'D',
	time: '3/4',
})
const vln = score.addStaff({ name: 'Violin', label: 'Violin', abbr: 'Vln.', clef: 'treble', patch: 40 })
const rh = score.addStaff({ name: 'Piano RH', label: 'Piano', abbr: 'Pno.', clef: 'treble', patch: 0, withNext: 'Brace', connectBars: true })
const lh = score.addStaff({ name: 'Piano LH', clef: 'bass', patch: 0 })

// --- Harmony -------------------------------------------------------------------------
// Pitch classes, piano right-hand voicing and bass for each chord. 'A7/G' carries
// the tune's C# on the "you" of "dear ___" (bar 6) and resolves to G on beat 2.
const CHORDS = {
	D: { pcs: 'D F# A', rh: 'A3 D4 F#4', bass: 'D3' },
	A7: { pcs: 'A C# E G', rh: 'G3 C#4 E4', bass: 'A2' },
	'A7/G': { pcs: 'A C# E G', rh: 'G3 C#4 E4', bass: 'G2' },
	D7: { pcs: 'D F# A C', rh: 'A3 C4 F#4', bass: 'D3' },
	G: { pcs: 'G B D', rh: 'G3 B3 D4', bass: 'G2' },
	Gm6: { pcs: 'G Bb D E', rh: 'G3 Bb3 E4', bass: 'G2' },
	'D/A': { pcs: 'D F# A', rh: 'A3 D4 F#4', bass: 'A2' },
}
// One chord and one melody note per beat over the tune's 8 bars; the last beat
// is the pickup into the next section
const HARMONY = [['D', 'D', 'D'], ['A7', 'A7', 'A7'], ['A7', 'A7', 'A7'], ['D', 'D', 'D7'],
	['D7', 'D7', 'D7'], ['A7/G', 'G', 'Gm6'], ['D/A', 'D/A', 'A7'], ['D', 'D', 'A7']]
const MELODY = [['B4', 'A4', 'D5'], ['C#5', 'C#5', 'A4'], ['B4', 'A4', 'E5'], ['D5', 'D5', 'A4'],
	['A5', 'F#5', 'D5'], ['C#5', 'B4', 'G5'], ['F#5', 'D5', 'E5'], ['D5', 'D5', 'A4']]

const pcOf = (p) => midi(p) % 12
/** Chord tones of `chord` below pitch `p`, nearest first, as pitch names. */
function chordTonesBelow(p, chord) {
	const names = CHORDS[chord].pcs.split(' ')
	const out = []
	for (let m = midi(p) - 1; out.length < 6; m--) {
		const name = names.find(x => pcOf(x + '4') === m % 12)
		if (name) out.push(name + (Math.floor(m / 12) - 1))
	}
	return out
}
/** Double-stop partner under melody note p: a chord tone a 3rd, else 6th, else 4th below. */
function doubleStopUnder(p, chord) {
	const below = chordTonesBelow(p, chord)
	for (const want of [[3, 4], [8, 9], [5]]) {
		const hit = below.find(q => want.includes(midi(p) - midi(q)))
		if (hit) return hit
	}
	throw new Error(`no double stop under ${p} in ${chord}`)
}

/** Piano waltz: bass on beat 1, chords on 2 and 3. */
function waltz({ stac = false, octaves = false } = {}) {
	HARMONY.forEach(([a, b, c]) => {
		const bass = CHORDS[a].bass
		lh.bar(n(octaves ? [octave(bass, -1), bass] : bass, '4'), r('2'))
		rh.bar(r('4'), n(CHORDS[b].rh, '4', { stac }), n(CHORDS[c].rh, '4', { stac }))
	})
}

// --- Intro (bars 1-4) ------------------------------------------------------------------
vln.bar(tempo(72), perf('Maestoso'), r('bar'))
vln.bar(r('bar'))
vln.bar(r('bar'))
const flourish = 'A4 B4 C#5 D5 E5 F#5 G5 A5 B5 A5 G5 F#5 E5 D5 C#5 B4'.split(' ')
vln.bar(dyn('f'), flourish.map((p, k) => n(p, '32', { slur: k % 8 !== 7 })), n('A4', '8.'), n('A4', '16'))
rh.bar(dyn('ff'), n('D4 F#4 A4 D5', '2.', { acc: true }))
rh.bar(n('D4 F#4 B4 D5', '2.', { acc: true }))
rh.bar(n('D4 G4 B4 D5', '2.', { acc: true }))
rh.bar(n('C#4 E4 G4 A4', '4', { acc: true }), r('2'))
lh.bar(n('D2 D3', '2.')).bar(n('B1 B2', '2.')).bar(n('G1 G2', '2.')).bar(n('A1 A2', '4'), r('2'))

// --- Theme (bars 5-12) -----------------------------------------------------------------
vln.bar(tempo(84), perf('Cantabile'), dyn('mp'), n('B4', '4'), n('A4', '4'), n('D5', '4'))
vln.bar(n('A4 C#5', '2'), n('A4', '8.'), n('A4', '16'))
vln.bar(n('B4', '4'), n('A4', '4'), n('E5', '4'))
vln.bar(n('F#4 D5', '2'), n('A4', '8.'), n('A4', '16'))
vln.bar(dyn('mf'), n('A5', '4', { ten: true }), n('F#5', '4'), n('D5', '4'))
vln.bar(n('C#5', '4'), n('B4', '4'), n('G5', '8.'), n('G5', '16'))
vln.bar(n('F#5', '4'), n('D5', '4'), n('E5', '4'))
vln.bar(n('F#4 D5', '2'), dyn('f'), seq('E4 F#4 G4 A4', '16', { slur: true }))
waltz()
rh.bars[4].unshift(dyn('p'))

// --- Var. I (bars 13-20): running 16ths ----------------------------------------------------
const V1 = ['B4 C#5 D5 B4 A4 D5 F#5 A5 D6 A5 F#5 D5', 'C#5 E5 A5 C#6 E6 C#6 A5 G5 E5 C#5 B4 A4',
	'B4 C#5 D5 E5 A4 C#5 E5 G5 E5 G5 C#6 E6', 'D6 A5 F#5 D5 F#5 A5 D6 F#6 A6 F#6 D6 A5',
	'A5 C6 A5 F#5 F#5 A5 F#5 D5 D5 F#5 A5 C6', 'C#6 B5 A5 G5 B5 G5 D5 B4 G5 Bb5 D6 E6',
	'F#6 D6 A5 F#5 D6 A5 F#5 D5 E6 C#6 A5 G5']
V1.forEach((line, b) => {
	const head = b === 0 ? [tempo(112), text('Var. I'), perf('Con brio')] : []
	// three slurred, one detached
	vln.bar(head, line.split(' ').map((p, k) => n(p, '16', { slur: k % 4 !== 3, stac: k % 4 === 3 })))
})
vln.bar(seq('D6 E6 D6', '16', { slur: true }), n('C#6', '16'), seq('D6 A5 F#5 D5', '16'),
	dyn('mp'), n('A5', '8t', { slur: true }), n('G5', '8t', { slur: true }), n('E5', '8t'))
waltz({ stac: true, octaves: true })

// --- Var. II (bars 21-28): triplet broken chords --------------------------------------------
HARMONY.forEach((chords, b) => {
	const items = b === 0 ? [tempo(120), text('Var. II'), perf('Legato')] : []
	chords.forEach((chord, k) => {
		if (b === 7 && k === 2) {
			// pickup into Var. III, in double stops
			const top = octave(MELODY[b][k])
			const under = doubleStopUnder(top, chord)
			items.push(dyn('f'), n([under, top], '8.', { acc: true }), n([under, top], '16'))
			return
		}
		const top = octave(MELODY[b][k])
		const [t1, t2] = chordTonesBelow(top, chord)
		items.push(n(top, '8t', { slur: true }), n(t1, '8t', { slur: true }), n(t2, '8t'))
	})
	vln.bar(items)
	// bass under the chord of beat 1, and again when beat 3 changes chord
	const [a, bch, c] = chords
	lh.bar(CHORDS[c].bass === CHORDS[a].bass ? n(CHORDS[a].bass, '2.') : [n(CHORDS[a].bass, '2'), n(CHORDS[c].bass, '4')])
	rh.bar(r('4'), n(CHORDS[bch].rh, '4', { stac: true }), n(CHORDS[c].rh, '4', { stac: true }))
})

// --- Var. III (bars 29-36): the tune in double stops ----------------------------------------
const RHYTHM = [['4', '4', '4'], ['2', null, 'P'], ['4', '4', '4'], ['2', null, 'P'],
	['4', '4', '4'], ['4', '4', 'P'], ['4', '4', '4'], ['2', null, 'R']]
HARMONY.forEach((chords, b) => {
	const items = b === 0 ? [tempo(96), text('Var. III'), perf('Marcato')] : []
	if (b === 4) items.push(dyn('ff'))
	RHYTHM[b].forEach((rhythm, k) => {
		if (!rhythm) return
		if (rhythm === 'R') return items.push(r('4'))
		const top = octave(MELODY[b][k])
		const pair = [doubleStopUnder(top, chords[k]), top]
		if (rhythm === 'P') items.push(n(pair, '8.', { acc: true }), n(pair, '16'))
		else items.push(n(pair, rhythm, { acc: k === 0 }))
	})
	vln.bar(items)
	const [a, , c] = chords
	lh.bar(n([octave(CHORDS[a].bass, -1), CHORDS[a].bass], '4', { acc: true }), r('4'), n([octave(CHORDS[c].bass, -1), CHORDS[c].bass], '4'))
	rh.bar(b === 0 ? dyn('f') : [], chords.map((ch, k) => n(CHORDS[ch].rh, '4', { acc: k === 0 })))
})

// --- Cadenza (bars 37-40) --------------------------------------------------------------------
vln.bar(tempo(80), text('Cadenza (a piacere)', 'StaffItalic'), dyn('mf'),
	seq('D4 F#4 A4 D5 F#5 A5 D6 F#6 A6 F#6 D6 A5 F#5 D5 A4 F#4 D4 F#4 A4 D5 F#5 A5 D6 F#6', '32'))
vln.bar(seq('A3 C#4 E4 G4 A4 C#5 E5 G5 A5 C#6 E6 G6 A6 G6 E6 C#6 A5 G5 E5 C#5 A4 G4 E4 C#4', '32'))
vln.bar(hairpin('Crescendo'), seq('A6 G6 F#6 E6 D6 C#6 B5 A5 G5 F#5 E5 D5 C#5 B4 A4 G4 F#4 G4 A4 B4 C#5 D5 E5 F#5', '32'))
vln.bar(fermata(), n('A4 G5', '2.', { acc: true }))
rh.bar(fermata(), n('D4 F#4 A4 D5', '2.')).bar(r('bar')).bar(r('bar')).bar(fermata(), n('C#4 E4 G4 A4', '2.'))
lh.bar(n('A1 A2', '2.')).bar(r('bar')).bar(r('bar')).bar(n('A1 A2', '2.'))

// --- Coda (bars 41-48): Presto ------------------------------------------------------------------
const oct = (p, d, f = {}) => n([p, octave(p)], d, f)
vln.bar(tempo(152), text('Presto'), r('4'), r('4'), dyn('ff'), oct('A4', '8.', { acc: true }), oct('A4', '16'))
vln.bar(oct('B4', '4', { acc: true }), oct('A4', '4', { acc: true }), oct('D5', '4', { acc: true }))
vln.bar(oct('C#5', '2', { acc: true }), oct('A4', '8.', { acc: true }), oct('A4', '16'))
vln.bar(oct('B4', '4', { acc: true }), oct('A4', '4', { acc: true }), oct('E5', '4', { acc: true }))
vln.bar(oct('D5', '4', { acc: true }), seq('D5 E5 F#5 G5 A5 B5 C#6 D6', '16', { slur: true }))
vln.bar(seq('E6 F#6 G6 A6 F#6 D6 A5 F#5 D5 A4 F#4 D4', '16', { slur: true }))
vln.bar(n('A4 E5 C#6', '4', { acc: true }), r('4'), n('A4 E5 C#6', '4', { acc: true }))
vln.bar(fermata(), n('D4 A4 F#5 D6', '2.', { acc: true }))
const CODA = ['A7', 'D', 'A7', 'A7', 'D', 'D', 'A7']
CODA.forEach((c, b) => {
	rh.bar(b === 0 ? dyn('ff') : [], Array.from({ length: 6 }, (_, k) => n(CHORDS[c].rh, '8', { stac: true, acc: k % 2 === 0 })))
	const bass = CHORDS[c].bass
	lh.bar([0, 1, 2].map(k => n([octave(bass, -1), bass], '4', { acc: k === 0 })))
})
rh.bar(fermata(), n('D4 F#4 A4 D5', '2.', { acc: true }))
lh.bar(n('D2 D3', '2.', { acc: true }))

score.doubleBarAfter(4, 12, 20, 28, 36, 40)
const out = process.argv[2] || new URL('../../../samples/HappyBirthdayVirtuoso.nwctxt', import.meta.url).pathname
writeFileSync(out, score.toNwctxt())
console.log(`wrote ${out}`)
