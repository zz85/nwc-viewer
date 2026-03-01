import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

globalThis.window = {}
globalThis.Zlib = { Inflate: class { decompress() { return new Uint8Array() } } }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')

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
