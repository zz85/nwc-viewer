import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

globalThis.window = {}
globalThis.Zlib = { Inflate: class { decompress() { return new Uint8Array() } } }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')
const { buildNoteEvents } = await import('../src/audio.js')

describe('Interpreter', () => {
	test('assigns tickValue to tokens', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const tokens = data.score.staves[0].tokens
		tokens.forEach(token => {
			expect(token.tickValue).toBeDefined()
			expect(typeof token.tickValue).toBe('number')
		})
	})

	test('assigns tabValue to tokens', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const tokens = data.score.staves[0].tokens
		tokens.forEach(token => {
			expect(token.tabValue).toBeDefined()
		})
	})

	test('assigns tabUntilValue to tokens', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const tokens = data.score.staves[0].tokens
		tokens.forEach(token => {
			expect(token.tabUntilValue).toBeDefined()
		})
	})

	test('interprets Note tokens with name and octave', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const notes = data.score.staves[0].tokens.filter(t => t.type === 'Note')
		notes.forEach(note => {
			expect(note.name).toBeDefined()
			expect(note.octave).toBeDefined()
			expect(typeof note.octave).toBe('number')
		})
	})

	test('interprets KeySignature with accidentals', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const keySigs = data.score.staves[0].tokens.filter(t => t.type === 'KeySignature')
		keySigs.forEach(ks => {
			expect(ks.accidentals).toBeDefined()
			expect(ks.clef).toBeDefined()
		})
	})

	test('assigns durValue to notes', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const notes = data.score.staves[0].tokens.filter(t => t.type === 'Note')
		notes.forEach(note => {
			expect(note.durValue).toBeDefined()
			expect(note.durValue.value()).toBeGreaterThan(0)
		})
	})

	test('assigns lyrics to notes from pre-split arrays', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		// "I Care Not for These Ladies" — first lyric line starts with
		// ["I", " care", " not", " for", " these", " La", "-dies", ...]
		// Expected assignment: first 7 notes get "I", "care", "not", "for", "these", "La-", "dies"
		const notes = data.score.staves[0].tokens.filter(t => t.type === 'Note' || t.type === 'Chord')
		const lyricsAssigned = notes.filter(n => n.text).map(n => n.text)

		// First syllable should be "I" (or "1. I" etc)
		expect(lyricsAssigned.length).toBeGreaterThan(0)
		// Check that "La-" (with continuation) and "dies" appear consecutively
		const laIdx = lyricsAssigned.indexOf('La-')
		if (laIdx >= 0) {
			expect(lyricsAssigned[laIdx + 1]).toBe('dies')
		}
		// No bare hyphens should be assigned
		lyricsAssigned.forEach(text => {
			expect(text).not.toBe('-')
			expect(text).not.toBe('_')
		})
	})
})

// ── Chord accidental resolution ────────────────────────────────────────────

describe('Chord accidental resolution', () => {
	function makeScore(tokens, keySig) {
		// Build a minimal score with a single staff
		const stave = {
			tokens: [
				{ type: 'Clef', clef: 'treble', octave: 0 },
				{ type: 'KeySignature', key: keySig || 'C' },
				{ type: 'TimeSignature', signature: '4/4' },
				...tokens,
			],
		}
		return { score: { staves: [stave] } }
	}

	test('explicit accidental on chord child note sets accidentalValue', () => {
		// Chord: C4 + G#4 (G sharp explicit)
		// Treble clef: pos 0 = B4, pos -2 = G4, pos -6 = C4
		const chord = {
			type: 'Chord',
			position: -6,
			duration: 4,
			dots: 0,
			notes: [
				{ position: -6, duration: 4 },            // C4 (no accidental)
				{ position: -2, duration: 4, accidental: '#' }, // G#4
			],
		}
		const data = makeScore([chord])
		interpret(data)

		expect(chord.notes[0].name).toBe('C')
		expect(chord.notes[0].accidentalValue).toBeUndefined()
		expect(chord.notes[1].name).toBe('G')
		expect(chord.notes[1].accidentalValue).toBe('#')
	})

	test('key signature accidentals apply to chord child notes', () => {
		// Key of G major (F#) — a chord containing F should get F#
		// Treble clef: pos -3 = F4, pos -5 = D4
		const chord = {
			type: 'Chord',
			position: -5,
			duration: 4,
			dots: 0,
			notes: [
				{ position: -5, duration: 4 },   // D4
				{ position: -3, duration: 4 },   // F4 (should become F# from key sig)
			],
		}
		const data = makeScore([chord], 'G')
		interpret(data)

		const fNote = chord.notes.find(n => n.name === 'F')
		expect(fNote).toBeTruthy()
		expect(fNote.accidentalValue).toBe('#')
	})

	test('running accidental from standalone note applies to chord child', () => {
		// G#4 standalone, then chord containing G4 at same pitch — should get #
		// Treble clef: pos -2 = G4, pos -6 = C4
		const note = {
			type: 'Note',
			position: -2,
			duration: 4,
			dots: 0,
			accidental: '#',
		}
		const chord = {
			type: 'Chord',
			position: -6,
			duration: 4,
			dots: 0,
			notes: [
				{ position: -6, duration: 4 },  // C4
				{ position: -2, duration: 4 },   // G4 (should pick up running #)
			],
		}
		const data = makeScore([note, chord])
		interpret(data)

		expect(chord.notes[1].name).toBe('G')
		expect(chord.notes[1].accidentalValue).toBe('#')
	})

	test('chord child accidental propagates as running accidental to subsequent note', () => {
		// Chord with G#4, then standalone G4 at same pitch — should get #
		// Treble clef: pos -2 = G4, pos -6 = C4
		const chord = {
			type: 'Chord',
			position: -6,
			duration: 4,
			dots: 0,
			notes: [
				{ position: -6, duration: 4 },
				{ position: -2, duration: 4, accidental: '#' },  // G#4
			],
		}
		const note = {
			type: 'Note',
			position: -2,
			duration: 4,
			dots: 0,
		}
		const data = makeScore([chord, note])
		interpret(data)

		expect(note.name).toBe('G')
		expect(note.accidentalValue).toBe('#')
	})

	test('natural accidental on chord child overrides key signature', () => {
		// Key of G major (F#), chord with explicit F natural
		// Treble clef: pos -3 = F4, pos -5 = D4
		const chord = {
			type: 'Chord',
			position: -5,
			duration: 4,
			dots: 0,
			notes: [
				{ position: -5, duration: 4 },
				{ position: -3, duration: 4, accidental: 'n' }, // F natural
			],
		}
		const data = makeScore([chord], 'G')
		interpret(data)

		const fNote = chord.notes.find(n => n.name === 'F')
		expect(fNote).toBeTruthy()
		expect(fNote.accidentalValue).toBe('n')
	})

	test('flat accidental on chord child produces correct MIDI', () => {
		// Chord with Bb4 + C5 — verify through buildNoteEvents
		// Pre-set name/octave/accidentalValue to test toMidi conversion directly
		const chord = {
			type: 'Chord',
			position: 0,
			duration: 4,
			dots: 0,
			tickValue: 0,
			durValue: { value: () => 0.25 },
			notes: [
				{ position: 0, duration: 4, name: 'B', octave: 4, accidentalValue: 'b' },
				{ position: 1, duration: 4, name: 'C', octave: 5, accidentalValue: undefined },
			],
		}
		const data = {
			score: { staves: [{ tokens: [chord] }] },
		}
		const { notes } = buildNoteEvents(data)

		// Bb4 = 12*(4+1)+11-1 = 70
		const bb = notes.find(n => n.midi === 70)
		expect(bb).toBeTruthy()
		// C5 = 12*(5+1)+0 = 72
		const c = notes.find(n => n.midi === 72)
		expect(c).toBeTruthy()
	})
})
