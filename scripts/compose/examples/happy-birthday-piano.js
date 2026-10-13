#!/usr/bin/env bun
// Happy Birthday — Concert Paraphrase for Piano (samples/HappyBirthdayPiano.nwctxt)
//   bun scripts/compose/examples/happy-birthday-piano.js [out.nwctxt]
import { writeFileSync } from 'fs'
import { Score, n, r, seq, dyn, tempo, perf, text, fermata, hairpin, pedal, midi, octave } from '../nwctxt-builder.js'

const score = new Score({
	title: 'Happy Birthday',
	author: 'Trad. (Mildred & Patty Hill) - Concert Paraphrase for Piano',
	key: 'Db',
	time: '3/4',
})
const rh = score.addStaff({ name: 'Piano RH', label: 'Piano', clef: 'treble', patch: 0, withNext: 'Brace', connectBars: true })
const lh = score.addStaff({ name: 'Piano LH', clef: 'bass', patch: 0 })

// --- Harmony -------------------------------------------------------------------------------
// pcs: chord tones (spelled), bass: lowest note
const CHORDS = {
	I: { pcs: 'Db F Ab', bass: 'Db2' },
	'I6/4': { pcs: 'Db F Ab', bass: 'Ab1' },
	I7: { pcs: 'Db F Ab Cb', bass: 'Db2' },
	IV: { pcs: 'Gb Bb Db', bass: 'Gb1' },
	iv6: { pcs: 'Gb Bbb Db Eb', bass: 'Gb1' },
	ii7: { pcs: 'Eb Gb Bb Db', bass: 'Eb2' },
	V7: { pcs: 'Ab C Eb Gb', bass: 'Ab1' },
	'V7/Gb': { pcs: 'Ab C Eb Gb', bass: 'Gb1' },
	// B-flat minor (Var. III)
	i: { pcs: 'Bb Db F', bass: 'Bb1' },
	'i6/4': { pcs: 'Bb Db F', bass: 'F1' },
	'v/iv': { pcs: 'Bb D F Ab', bass: 'Bb1' },
	iv: { pcs: 'Eb Gb Bb', bass: 'Eb2' },
	'V/b': { pcs: 'F A C Eb', bass: 'F1' },
	'V/b-Eb': { pcs: 'F A C Eb', bass: 'Eb2' },
}
// The tune, one melody note and chord per beat; the last beat is the pickup
// into the next section ('P')
const TUNE = [['Bb4', 'Ab4', 'Db5'], ['C5', 'C5', 'Ab4'], ['Bb4', 'Ab4', 'Eb5'], ['Db5', 'Db5', 'Ab4'],
	['Ab5', 'F5', 'Db5'], ['C5', 'Bb4', 'Gb5'], ['F5', 'Db5', 'Eb5'], ['Db5', 'Db5', 'P']]
const HARMONY = [['I', 'I', 'I'], ['V7', 'V7', 'V7'], ['V7', 'V7', 'V7'], ['I', 'I', 'I7'],
	['I7', 'I7', 'I7'], ['V7/Gb', 'IV', 'iv6'], ['I6/4', 'I6/4', 'V7'], ['I', 'I', 'V7']]
// The same tune in B-flat minor; bar 6 uses the harmonic-minor step A–Gb
const TUNE_MINOR = [['G4', 'F4', 'Bb4'], ['A4', 'A4', 'F4'], ['G4', 'F4', 'C5'], ['Bb4', 'Bb4', 'F4'],
	['F5', 'Db5', 'Bb4'], ['A4', 'Gb4', 'Eb5'], ['Db5', 'Bb4', 'C5'], ['Bb4', 'Bb4', 'P']]
const HARMONY_MINOR = [['i', 'i', 'i'], ['V/b', 'V/b', 'V/b'], ['V/b', 'V/b', 'V/b'], ['i', 'i', 'i'],
	['i', 'i', 'v/iv'], ['V/b-Eb', 'iv', 'iv'], ['i6/4', 'i6/4', 'V/b'], ['i', 'i', 'V7']]

const pc = (name) => midi(name + '4') % 12
const spell = (m, chord) => {
	const name = CHORDS[chord].pcs.split(' ').find(x => pc(x) === ((m % 12) + 12) % 12)
	if (!name) return null
	// octave of a spelled note: Cb/B# sit across the octave line
	const o = Math.floor(m / 12) - 1 + (name.startsWith('Cb') ? 1 : 0) - (name.startsWith('B#') ? 1 : 0)
	return name + o
}
/** Chord tones below (dir -1) or above (dir 1) pitch p, nearest first. */
function chordTones(p, chord, dir, count) {
	const out = []
	for (let m = midi(p) + dir; out.length < count; m += dir) {
		const s = spell(m, chord)
		if (s) out.push(s)
	}
	return out
}
/**
 * Melody note p with chord tones filling the octave below it, each at least a
 * 3rd below the one above, so the tune stands clear and nothing bunches up.
 */
function voiced(p, chord, notes = 3) {
	const out = [p]
	for (const q of chordTones(p, chord, -1, 6)) {
		if (out.length === notes || midi(p) - midi(q) > 12) break
		if (midi(out[out.length - 1]) - midi(q) >= 3) out.push(q)
	}
	return out
}
/** Octave chord: melody doubled an octave below with chord tones between. */
function octaveChord(p, chord) {
	const low = octave(p, -1)
	const inner = chordTones(p, chord, -1, 4).filter(q => midi(q) > midi(low))
	return [low, ...inner.slice(-2), p]
}
/** Left-hand broken chord rising from the bass: bass, then chord tones a 5th or more above. */
function rising(chord, count) {
	const bass = CHORDS[chord].bass
	const up = chordTones(bass, chord, 1, 10).filter(q => midi(q) - midi(bass) >= 7)
	return [bass, ...up].slice(0, count)
}
const oct = (p) => [octave(p, -1), p]
/** Left-hand chord in the tenor register: the chord tones just above G2. */
const lhChord = (ch) => chordTones('G2', ch, 1, 3)

// --- Introduction (bars 1-4) ----------------------------------------------------------------
rh.bar(tempo(60), perf('Maestoso'), dyn('f'), seq('Ab3 Db4 F4 Ab4 Db5 F5 Ab5 Db6 F6 Ab6 F6 Db6', '16', { slur: true }))
rh.bar(seq('Bb3 Db4 Gb4 Bb4 Db5 Gb5 Bb5 Db6 Gb6 Bb6 Gb6 Db6', '16', { slur: true }))
rh.bar(hairpin('Crescendo'), seq('Gb3 Bb3 Db4 Eb4 Gb4 Bb4 Db5 Eb5 Gb5 Bb5 Db6 Eb6', '16', { slur: true }))
rh.bar(dyn('ff', -14), seq('Gb6 Eb6 C6 Ab5 Gb5 Eb5 C5 Ab4 Gb4 Eb4 C4 Ab3 C4 Eb4 Gb4', '32', { slur: true }), n('Ab4', '32'),
	dyn('p'), n('Ab4', '8.'), n('Ab4', '16'))
lh.bar(pedal(), n('Db1 Db2', '2.')).bar(n('Gb1 Gb2', '2.')).bar(n('Eb1 Eb2', '2.')).bar(n('Ab1 Ab2', '4', { acc: true }), r('2'))

// --- Theme (bars 5-12): the tune in chords, rolling left hand ----------------------------------
TUNE.forEach((beats, b) => {
	const head = b === 0 ? [tempo(72), perf('Cantabile')] : []
	const items = []
	const hold = beats[0] === beats[1]
	beats.forEach((m, k) => {
		if (k === 1 && hold) return
		if (m === 'P') return items.push(dyn('mp', -12), seq('Eb5 F5 Gb5 Ab5', '16', { slur: true }))  // into Var. I
		if (k === 2 && (b === 1 || b === 3 || b === 5)) {
			// the tune's dotted pickup
			return items.push(n(m, '8.'), n(m, '16'))
		}
		items.push(n(voiced(m, HARMONY[b][k]), hold && k === 0 ? '2' : '4'))
	})
	rh.bar(head, items)
	const lhNotes = rising(HARMONY[b][0], 4)
	const lhLast = HARMONY[b][2] !== HARMONY[b][0] ? rising(HARMONY[b][2], 2) : lhNotes.slice(1, 3).reverse()
	lh.bar(b === 0 ? pedal() : [], lhNotes.map(p => n(p, '8')), lhLast.map(p => n(p, '8')))
})

// --- Var. I (bars 13-20): broken chords falling from the melody ------------------------------
TUNE.forEach((beats, b) => {
	const head = b === 0 ? [tempo(96), text('Var. I'), perf('Grazioso'), dyn('mp')] : []
	const items = []
	beats.forEach((m, k) => {
		if (m === 'P') {
			// pickup into Var. II: octave melody
			return items.push(dyn('f'), n(oct('Ab5'), '8.', { acc: true }), n(oct('Ab5'), '16'))
		}
		const top = octave(m)
		const [t1, t2, t3] = chordTones(top, HARMONY[b][k], -1, 3)
		items.push(n(top, '16', { slur: true }), n(t1, '16', { slur: true }), n(t2, '16', { slur: true }), n(t3, '16', { stac: true }))
	})
	rh.bar(head, items)
	const [a, x, c] = HARMONY[b]
	lh.bar(n(oct(octave(CHORDS[a].bass, 1)), '4'), n(lhChord(x), '4', { stac: true }), n(lhChord(c), '4', { stac: true }))
})

// --- Var. II (bars 21-28): valse — melody in octaves, leaping left hand -------------------------
const HARMONY2 = HARMONY.map(bar => bar.slice())
HARMONY2[7][2] = 'V/b' // lead into B-flat minor
TUNE.forEach((beats, b) => {
	const head = b === 0 ? [tempo(144), text('Var. II'), perf('Grazioso')] : []
	const items = []
	const hold = beats[0] === beats[1]
	beats.forEach((m, k) => {
		if (k === 1 && hold) return
		if (m === 'P') return items.push(dyn('ff'), n(oct('F5'), '8.', { acc: true }), n(oct('F5'), '16'))  // into Var. III
		const top = octave(m)
		if (k === 2 && (b === 1 || b === 3 || b === 5)) return items.push(n(oct(top), '8.', { acc: true }), n(oct(top), '16', { stac: true }))
		items.push(n(oct(top), hold && k === 0 ? '2' : '4', { acc: k === 0 }))
	})
	rh.bar(head, items)
	const [a, x, c] = HARMONY2[b]
	lh.bar(n(oct(octave(CHORDS[a].bass, 1)), '4', { acc: true }), n(lhChord(x), '4', { stac: true }), n(lhChord(c), '4', { stac: true }))
})

// --- Var. III (bars 29-36): Appassionato, B-flat minor -------------------------------------------
TUNE_MINOR.forEach((beats, b) => {
	const head = b === 0 ? [tempo(108), text('Var. III'), perf('Espressivo'), dyn('ff')] : []
	const items = []
	const hold = beats[0] === beats[1]
	beats.forEach((m, k) => {
		if (k === 1 && hold) return
		if (m === 'P') {
			// rest before the cadenza
			return items.push(r('4'))
		}
		const top = octave(m)
		const ch = HARMONY_MINOR[b][k]
		if (k === 2 && (b === 1 || b === 3 || b === 5)) return items.push(n(octaveChord(top, ch), '8.', { acc: true }), n(octaveChord(top, ch), '16'))
		items.push(n(octaveChord(top, ch), hold && k === 0 ? '2' : '4', { acc: true }))
	})
	rh.bar(head, items)
	// thundering 16ths: each beat rises from the bass
	lh.bar(HARMONY_MINOR[b].map(ch => rising(ch, 4).map((p, i) => n(p, '16', { acc: i === 0 }))))
})

// --- Cadenza (bars 37-40) ----------------------------------------------------------------------------
rh.bar(tempo(66), text('Cadenza', 'StaffItalic'), dyn('f'),
	seq('Ab3 Db4 F4 Ab4 Db5 F5 Ab5 Db6 F6 Ab6 Db7 Ab6 F6 Db6 Ab5 F5 Db5 Ab4 F4 Db4 F4 Ab4 Db5 F5', '32'))
rh.bar(hairpin('Diminuendo'), seq('Ab6 G6 Gb6 F6 E6 Eb6 D6 Db6 C6 B5 Bb5 A5 Ab5 G5 Gb5 F5 E5 Eb5 D5 Db5 C5 B4 Bb4 A4', '32'))
rh.bar(dyn('mf'), hairpin('Crescendo'), seq('C5 Eb5 Gb5 Ab5 C6 Eb6 Gb6 Ab6 C7 Ab6 Gb6 Eb6', '16'))
rh.bar(fermata(), dyn('ff'), n('Gb4 C5 Eb5 Ab5', '2.', { acc: true }))
lh.bar(pedal(), n('Ab1 Ab2', '2.')).bar(r('bar'))
lh.bar(seq('Ab3 Gb3 Eb3 C3 Ab2 Gb2 Eb2 C2 Ab1 C2 Eb2 Gb2', '16'))
lh.bar(fermata(9), n('Ab1 Ab2', '2.', { acc: true }))

// --- Finale (bars 41-48): Presto con fuoco ---------------------------------------------------------
const FINALE_TUNE = [[null, null, 'Ab4'], ['Bb4', 'Ab4', 'Db5'], ['C5', null, 'Ab4'], ['Bb4', 'Ab4', 'Eb5']]
const FINALE_HARMONY = [['V7', 'V7', 'V7'], ['I', 'I', 'I'], ['V7', 'V7', 'V7'], ['V7', 'V7', 'V7']]
FINALE_TUNE.forEach((beats, b) => {
	const head = b === 0 ? [tempo(160), text('Presto con fuoco'), dyn('ff')] : []
	const items = []
	beats.forEach((m, k) => {
		const ch = FINALE_HARMONY[b][k]
		if (b === 0 && k < 2) return items.push(r('4'))
		if (m === null) return
		const top = octave(m)
		if (k === 2 && (b === 0 || b === 2)) return items.push(n(octaveChord(top, ch), '8.', { acc: true }), n(octaveChord(top, ch), '16'))
		items.push(n(octaveChord(top, ch), b === 2 && k === 0 ? '2' : '4', { acc: true }))
	})
	rh.bar(head, items)
	// driving 8ths: bass octave, chord
	lh.bar(FINALE_HARMONY[b].map(ch => [n(oct(octave(CHORDS[ch].bass, 1)), '8', { acc: true }), n(lhChord(ch), '8', { stac: true })]))
})
// "you": the tonic, then a sweep up and a cascade down
rh.bar(n(octaveChord('Db6', 'I'), '4', { acc: true }), seq('Db5 F5 Ab5 Db6 F6 Ab6 Db7 Ab6', '16', { slur: true }))
rh.bar(seq('Db7 C7 Bb6 Ab6 Gb6 F6 Eb6 Db6 C6 Bb5 Ab5 F5', '16', { slur: true }))
rh.bar(n('Gb4 C5 Eb5 Ab5', '8', { acc: true }), r('8'), n('Gb4 C5 Eb5 Ab5', '8', { acc: true }), r('8'), n('Gb4 C5 Eb5 Ab5', '4', { acc: true }))
rh.bar(fermata(), n('Db5 F5 Ab5 Db6', '2.', { acc: true }))
lh.bar(n(oct('Db2'), '8', { acc: true }), n('Ab2 Db3 F3', '8'), n(oct('Db2'), '8'), n('Ab2 Db3 F3', '8'), n(oct('Db2'), '8'), n('Ab2 Db3 F3', '8'))
// bass steps down under the cascade: I – vi – IV
lh.bar(n(oct('Db3'), '8', { acc: true }), n('Ab2 Db3 F3', '8'), n(oct('Bb2'), '8'), n('Bb2 Db3 F3', '8'), n(oct('Gb2'), '8'), n('Bb2 Db3 Gb3', '8'))
lh.bar(n(oct('Ab2'), '8', { acc: true }), r('8'), n(oct('Ab2'), '8', { acc: true }), r('8'), n(oct('Ab2'), '4', { acc: true }))
lh.bar(fermata(9), n('Db1 Db2', '2.', { acc: true }))

score.doubleBarAfter(4, 12, 20, 28, 36, 40)
const out = process.argv[2] || new URL('../../../samples/HappyBirthdayPiano.nwctxt', import.meta.url).pathname
writeFileSync(out, score.toNwctxt())
console.log(`wrote ${out}`)
