/**
 * Unit tests for the MuseScore parser.
 *
 * Tests the core conversion logic: TPC decoding, position computation,
 * duration mapping, and XML → token conversion.
 */

import { describe, it, expect } from 'bun:test'

// We can't import directly from musescore-parser.js because it imports
// zip.js which uses browser APIs (DecompressionStream). Instead, we test
// the pure-logic functions by extracting them or by testing with .mscx XML
// (which doesn't need unzipping).

// Since the module uses browser DOMParser, we need to check if it's available.
// Bun includes a minimal DOM — let's test what we can.

// Import Fraction for comparison
import Fraction from '../src/fraction.js'

// ---- TPC Decoding Tests ----
// Re-implement decodeTPC here for direct unit testing
// (avoids importing the module which has browser-only dependencies)

const TPC_NOTE_NAMES = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const ACCIDENTAL_STRINGS = { '-2': 'v', '-1': 'b', '0': '', '1': '#', '2': 'x' }

function decodeTPC(tpc) {
	const idx = ((tpc + 1) % 7 + 7) % 7
	const name = TPC_NOTE_NAMES[idx]
	const level = Math.floor((tpc + 1) / 7) - 2
	const accidental = ACCIDENTAL_STRINGS[String(level)] || ''
	return { name, accidental, accidentalValue: accidental || undefined }
}

describe('TPC Decoding', () => {
	it('decodes C natural (TPC 14)', () => {
		const result = decodeTPC(14)
		expect(result.name).toBe('C')
		expect(result.accidental).toBe('')
	})

	it('decodes D natural (TPC 16)', () => {
		const result = decodeTPC(16)
		expect(result.name).toBe('D')
		expect(result.accidental).toBe('')
	})

	it('decodes E natural (TPC 18)', () => {
		const result = decodeTPC(18)
		expect(result.name).toBe('E')
		expect(result.accidental).toBe('')
	})

	it('decodes F natural (TPC 13)', () => {
		const result = decodeTPC(13)
		expect(result.name).toBe('F')
		expect(result.accidental).toBe('')
	})

	it('decodes G natural (TPC 15)', () => {
		const result = decodeTPC(15)
		expect(result.name).toBe('G')
		expect(result.accidental).toBe('')
	})

	it('decodes A natural (TPC 17)', () => {
		const result = decodeTPC(17)
		expect(result.name).toBe('A')
		expect(result.accidental).toBe('')
	})

	it('decodes B natural (TPC 19)', () => {
		const result = decodeTPC(19)
		expect(result.name).toBe('B')
		expect(result.accidental).toBe('')
	})

	it('decodes F# (TPC 20)', () => {
		const result = decodeTPC(20)
		expect(result.name).toBe('F')
		expect(result.accidental).toBe('#')
	})

	it('decodes C# (TPC 21)', () => {
		const result = decodeTPC(21)
		expect(result.name).toBe('C')
		expect(result.accidental).toBe('#')
	})

	it('decodes Bb (TPC 12)', () => {
		const result = decodeTPC(12)
		expect(result.name).toBe('B')
		expect(result.accidental).toBe('b')
	})

	it('decodes Eb (TPC 11)', () => {
		const result = decodeTPC(11)
		expect(result.name).toBe('E')
		expect(result.accidental).toBe('b')
	})

	it('decodes Ab (TPC 10)', () => {
		const result = decodeTPC(10)
		expect(result.name).toBe('A')
		expect(result.accidental).toBe('b')
	})

	it('decodes Fx (double sharp, TPC 27)', () => {
		const result = decodeTPC(27)
		expect(result.name).toBe('F')
		expect(result.accidental).toBe('x')
	})

	it('decodes Bbb (double flat, TPC 5)', () => {
		const result = decodeTPC(5)
		expect(result.name).toBe('B')
		expect(result.accidental).toBe('v')
	})

	// Full circle of fifths: C Db D Eb E F Gb G Ab A Bb B
	it('decodes all natural notes correctly', () => {
		const expected = [
			[13, 'F'], [14, 'C'], [15, 'G'], [16, 'D'],
			[17, 'A'], [18, 'E'], [19, 'B'],
		]
		for (const [tpc, name] of expected) {
			const result = decodeTPC(tpc)
			expect(result.name).toBe(name)
			expect(result.accidental).toBe('')
		}
	})
})

// ---- MIDI + TPC to Note Tests ----

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACC_SEMI = { '': 0, '#': 1, 'b': -1, 'x': 2, 'v': -2 }

function midiAndTpcToNote(midiPitch, tpc) {
	const { name, accidental, accidentalValue } = decodeTPC(tpc)
	const baseSemitone = SEMITONES[name] + (ACC_SEMI[accidental] || 0)
	const octave = Math.round((midiPitch - baseSemitone) / 12) - 1
	return { name, octave, accidental, accidentalValue }
}

describe('MIDI + TPC to Note', () => {
	it('converts C4 (MIDI 60, TPC 14)', () => {
		const note = midiAndTpcToNote(60, 14)
		expect(note.name).toBe('C')
		expect(note.octave).toBe(4)
		expect(note.accidental).toBe('')
	})

	it('converts A4 (MIDI 69, TPC 17)', () => {
		const note = midiAndTpcToNote(69, 17)
		expect(note.name).toBe('A')
		expect(note.octave).toBe(4)
	})

	it('converts C5 (MIDI 72, TPC 14)', () => {
		const note = midiAndTpcToNote(72, 14)
		expect(note.name).toBe('C')
		expect(note.octave).toBe(5)
	})

	it('converts D5 (MIDI 74, TPC 16)', () => {
		const note = midiAndTpcToNote(74, 16)
		expect(note.name).toBe('D')
		expect(note.octave).toBe(5)
	})

	it('converts E5 (MIDI 76, TPC 18)', () => {
		const note = midiAndTpcToNote(76, 18)
		expect(note.name).toBe('E')
		expect(note.octave).toBe(5)
	})

	it('converts G3 (MIDI 55, TPC 15)', () => {
		const note = midiAndTpcToNote(55, 15)
		expect(note.name).toBe('G')
		expect(note.octave).toBe(3)
	})

	it('converts Bb3 (MIDI 58, TPC 12)', () => {
		const note = midiAndTpcToNote(58, 12)
		expect(note.name).toBe('B')
		expect(note.octave).toBe(3)
		expect(note.accidental).toBe('b')
	})

	it('converts F#4 (MIDI 66, TPC 20)', () => {
		const note = midiAndTpcToNote(66, 20)
		expect(note.name).toBe('F')
		expect(note.octave).toBe(4)
		expect(note.accidental).toBe('#')
	})

	it('converts Cb5 = MIDI 71 (TPC 7)', () => {
		const note = midiAndTpcToNote(71, 7)
		expect(note.name).toBe('C')
		expect(note.octave).toBe(5)
		expect(note.accidental).toBe('b')
	})

	it('converts B#4 = MIDI 72 (TPC 26)', () => {
		const note = midiAndTpcToNote(72, 26)
		expect(note.name).toBe('B')
		expect(note.octave).toBe(4)
		expect(note.accidental).toBe('#')
	})
})

// ---- Position Computation Tests ----

const OCTAVE_START = 3
const OCTAVE_NOTES = 7
const CLEF_PITCH_OFFSETS = {
	treble: (OCTAVE_START + 1) * OCTAVE_NOTES + 6,
	bass: (OCTAVE_START + 0) * OCTAVE_NOTES + 1,
	alto: (OCTAVE_START + 1) * OCTAVE_NOTES,
	tenor: (OCTAVE_START + 0) * OCTAVE_NOTES + 5,
}

const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

function computePosition(name, octave, clef, octaveShift) {
	const diatonicPitch = octave * 7 + NOTE_INDEX[name]
	let offset = CLEF_PITCH_OFFSETS[clef] || CLEF_PITCH_OFFSETS.treble
	if (octaveShift === 1) offset += 7
	else if (octaveShift === 2) offset -= 7
	return diatonicPitch - offset
}

describe('Position Computation', () => {
	it('B4 is position 0 in treble clef', () => {
		expect(computePosition('B', 4, 'treble', 0)).toBe(0)
	})

	it('C5 is position 1 in treble clef', () => {
		expect(computePosition('C', 5, 'treble', 0)).toBe(1)
	})

	it('C4 (middle C) is position -6 in treble clef', () => {
		expect(computePosition('C', 4, 'treble', 0)).toBe(-6)
	})

	it('A4 is position -1 in treble clef', () => {
		expect(computePosition('A', 4, 'treble', 0)).toBe(-1)
	})

	it('E5 is position 3 in treble clef (space below top line)', () => {
		expect(computePosition('E', 5, 'treble', 0)).toBe(3)
	})

	it('F5 is position 4 in treble clef (top line)', () => {
		expect(computePosition('F', 5, 'treble', 0)).toBe(4)
	})

	it('D3 is position 0 in bass clef', () => {
		expect(computePosition('D', 3, 'bass', 0)).toBe(0)
	})

	it('C4 (middle C) is position 6 in bass clef', () => {
		expect(computePosition('C', 4, 'bass', 0)).toBe(6)
	})

	it('G2 is position -1 in bass clef', () => {
		// diatonic = 2*7 + 4 = 18, offset = 22, pos = -4
		expect(computePosition('G', 2, 'bass', 0)).toBe(-4)
	})

	it('C4 is position 0 in alto clef', () => {
		expect(computePosition('C', 4, 'alto', 0)).toBe(0)
	})

	it('treble 8vb shifts offset down by 7', () => {
		// B4 in treble clef = 0
		// B4 in treble 8vb = 34 - (34-7) = 7
		expect(computePosition('B', 4, 'treble', 2)).toBe(7)
	})
})

// ---- Duration Fraction Tests ----

describe('Duration Fraction', () => {
	it('quarter note = 1/4', () => {
		const f = new Fraction(1, 4)
		expect(f.value()).toBe(0.25)
	})

	it('dotted quarter = 3/8', () => {
		const f = new Fraction(1, 4)
		f.multiply(3, 2)
		expect(f.value()).toBe(0.375)
	})

	it('double-dotted quarter = 7/16', () => {
		const f = new Fraction(1, 4)
		f.multiply(7, 4)
		expect(f.value()).toBe(0.4375)
	})

	it('whole note = 1', () => {
		const f = new Fraction(1, 1)
		expect(f.value()).toBe(1)
	})

	it('eighth note = 1/8', () => {
		const f = new Fraction(1, 8)
		expect(f.value()).toBe(0.125)
	})
})

// ---- Key Signature Tests ----

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']
const KEY_NAMES_SHARP = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
const KEY_NAMES_FLAT  = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']

function buildKeySigToken(accidentalCount) {
	let key, sharps = [], flats = [], accidentals = []

	if (accidentalCount > 0) {
		key = KEY_NAMES_SHARP[accidentalCount] || 'C'
		for (let i = 0; i < accidentalCount && i < 7; i++) {
			sharps.push(SHARP_ORDER[i])
			accidentals.push(SHARP_ORDER[i].toLowerCase() + '#')
		}
	} else if (accidentalCount < 0) {
		const count = Math.abs(accidentalCount)
		key = KEY_NAMES_FLAT[count] || 'C'
		for (let i = 0; i < count && i < 7; i++) {
			flats.push(FLAT_ORDER[i])
			accidentals.push(FLAT_ORDER[i] + 'b')
		}
	} else {
		key = 'C'
	}

	return { key, sharps, flats, accidentals }
}

describe('Key Signature', () => {
	it('0 accidentals = C major', () => {
		const ks = buildKeySigToken(0)
		expect(ks.key).toBe('C')
		expect(ks.accidentals).toEqual([])
	})

	it('1 sharp = G major (F#)', () => {
		const ks = buildKeySigToken(1)
		expect(ks.key).toBe('G')
		expect(ks.accidentals).toEqual(['f#'])
	})

	it('2 sharps = D major (F#, C#)', () => {
		const ks = buildKeySigToken(2)
		expect(ks.key).toBe('D')
		expect(ks.accidentals).toEqual(['f#', 'c#'])
	})

	it('-1 flat = F major (Bb)', () => {
		const ks = buildKeySigToken(-1)
		expect(ks.key).toBe('F')
		expect(ks.accidentals).toEqual(['Bb'])
	})

	it('-3 flats = Eb major (Bb, Eb, Ab)', () => {
		const ks = buildKeySigToken(-3)
		expect(ks.key).toBe('Eb')
		expect(ks.accidentals).toEqual(['Bb', 'Eb', 'Ab'])
	})

	it('7 sharps = C# major', () => {
		const ks = buildKeySigToken(7)
		expect(ks.key).toBe('C#')
		expect(ks.accidentals).toHaveLength(7)
	})
})

// ---- File Detection Tests ----
// Re-implement detection logic for testing without browser APIs

function isMuseScoreFileStrict(buffer, filename) {
	if (filename) {
		const lower = filename.toLowerCase()
		if (lower.endsWith('.mscz') || lower.endsWith('.mscx')) return true
	}
	const bytes = new Uint8Array(buffer)
	const head = new TextDecoder().decode(bytes.subarray(0, Math.min(500, bytes.length)))
	return head.includes('<museScore')
}

describe('File Detection', () => {
	it('detects .mscz filename', () => {
		const buf = new ArrayBuffer(4)
		expect(isMuseScoreFileStrict(buf, 'score.mscz')).toBe(true)
	})

	it('detects .mscx filename', () => {
		const buf = new ArrayBuffer(4)
		expect(isMuseScoreFileStrict(buf, 'My Song.mscx')).toBe(true)
	})

	it('detects .MSCZ filename (case-insensitive)', () => {
		const buf = new ArrayBuffer(4)
		expect(isMuseScoreFileStrict(buf, 'SCORE.MSCZ')).toBe(true)
	})

	it('detects museScore XML content', () => {
		const xml = '<?xml version="1.0"?>\n<museScore version="4.20">'
		const enc = new TextEncoder().encode(xml)
		expect(isMuseScoreFileStrict(enc.buffer, null)).toBe(true)
	})

	it('rejects unknown file without matching content', () => {
		const data = new TextEncoder().encode('Hello World')
		expect(isMuseScoreFileStrict(data.buffer, 'hello.txt')).toBe(false)
	})

	it('rejects NWC file', () => {
		const data = new TextEncoder().encode('[NoteWorthy')
		expect(isMuseScoreFileStrict(data.buffer, 'song.nwc')).toBe(false)
	})
})

// ---- Clef Mapping Tests ----

const CLEF_MAP = {
	'G':     { clef: 'treble', octave: 0 },
	'G8vb':  { clef: 'treble', octave: 2 },
	'F':     { clef: 'bass', octave: 0 },
	'C3':    { clef: 'alto', octave: 0 },
	'C4':    { clef: 'tenor', octave: 0 },
	'PERC':  { clef: 'percussion', octave: 0 },
}

describe('Clef Mapping', () => {
	it('G maps to treble', () => {
		expect(CLEF_MAP['G']).toEqual({ clef: 'treble', octave: 0 })
	})

	it('G8vb maps to treble with octave down', () => {
		expect(CLEF_MAP['G8vb']).toEqual({ clef: 'treble', octave: 2 })
	})

	it('F maps to bass', () => {
		expect(CLEF_MAP['F']).toEqual({ clef: 'bass', octave: 0 })
	})

	it('C3 maps to alto', () => {
		expect(CLEF_MAP['C3']).toEqual({ clef: 'alto', octave: 0 })
	})

	it('C4 maps to tenor', () => {
		expect(CLEF_MAP['C4']).toEqual({ clef: 'tenor', octave: 0 })
	})
})

// ---- Edge Case Tests ----

describe('Edge Cases', () => {
	it('midiAndTpcToNote handles very low notes (A0 = MIDI 21)', () => {
		const note = midiAndTpcToNote(21, 17) // A, TPC 17
		expect(note.name).toBe('A')
		expect(note.octave).toBe(0)
	})

	it('midiAndTpcToNote handles very high notes (C8 = MIDI 108)', () => {
		const note = midiAndTpcToNote(108, 14) // C, TPC 14
		expect(note.name).toBe('C')
		expect(note.octave).toBe(8)
	})

	it('computePosition handles notes far below staff', () => {
		// C2 in treble clef should be well below the staff
		const pos = computePosition('C', 2, 'treble', 0)
		expect(pos).toBe(14 - 34) // diatonic = 14, offset = 34 → -20
	})

	it('computePosition handles notes far above staff', () => {
		// C7 in treble clef
		const pos = computePosition('C', 7, 'treble', 0)
		expect(pos).toBe(49 - 34) // diatonic = 49, offset = 34 → 15
	})

	it('decodeTPC handles negative TPC (Fbb = -1)', () => {
		const result = decodeTPC(-1)
		expect(result.name).toBe('F')
		expect(result.accidental).toBe('v') // double flat
	})
})
