import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

// Mock browser globals
globalThis.window = { utils: {} }
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
})
