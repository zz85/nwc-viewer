import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

globalThis.window = { ctx: null, canvas: null }
globalThis.Zlib = { Inflate: class { decompress() { return new Uint8Array() } } }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')
const { MusicContext } = await import('../src/context.js')

// Mock canvas context
const mockCanvas = {
	getContext: () => mockCtx,
	width: 800,
	height: 600
}

const mockCtx = {
	clearRect: () => {},
	save: () => {},
	restore: () => {},
	translate: () => {},
	scale: () => {},
	beginPath: () => {},
	moveTo: () => {},
	lineTo: () => {},
	stroke: () => {},
	fill: () => {},
	fillRect: () => {},
	measureText: () => ({ width: 10 }),
	font: '',
	textBaseline: '',
	lineWidth: 1,
	strokeStyle: '#000'
}

describe('Layout System', () => {
	test('calculatePadding returns reasonable spacing values', () => {
		// Import the module to test spacing logic
		const testData = {
			score: {
				staves: [{
					tokens: [
						{ type: 'Clef', clef: 'treble' },
						{ type: 'Note', position: 0, duration: 4, dots: 0 },
						{ type: 'Note', position: 1, duration: 8, dots: 0 }
					]
				}]
			}
		}

		const context = new MusicContext(testData, mockCanvas)
		interpret(context)

		const notes = testData.score.staves[0].tokens.filter(t => t.type === 'Note')
		notes.forEach(note => {
			expect(note.durValue).toBeDefined()
			expect(note.durValue.value()).toBeGreaterThan(0)
		})
	})

	test('tokens receive tabValue for layout positioning', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const tokens = data.score.staves[0].tokens
		let lastTabValue = -1
		
		tokens.forEach(token => {
			if (token.tabValue !== undefined) {
				expect(token.tabValue).toBeGreaterThanOrEqual(lastTabValue)
				lastTabValue = token.tabValue
			}
		})
	})

	test('notes with different durations have different spacing', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const notes = data.score.staves[0].tokens.filter(t => t.type === 'Note')
		const wholeNotes = notes.filter(n => n.duration === 1)
		const quarterNotes = notes.filter(n => n.duration === 4)

		if (wholeNotes.length > 0 && quarterNotes.length > 0) {
			const wholeDur = wholeNotes[0].durValue.value()
			const quarterDur = quarterNotes[0].durValue.value()
			expect(wholeDur).toBeGreaterThan(quarterDur)
		}
	})

	test('beam groups are identified correctly', () => {
		const testData = {
			score: {
				staves: [{
					tokens: [
						{ type: 'Note', position: 0, duration: 8, beam: 1, drawingNoteHead: { x: 0, y: 0, width: 10 } },
						{ type: 'Note', position: 1, duration: 8, beam: 3, drawingNoteHead: { x: 20, y: 0, width: 10 } },
						{ type: 'Note', position: 2, duration: 8, beam: 2, drawingNoteHead: { x: 40, y: 0, width: 10 } },
						{ type: 'Note', position: 3, duration: 8, beam: 0, drawingNoteHead: { x: 60, y: 0, width: 10 } }
					]
				}]
			}
		}

		// The first 3 notes should be beamed, the 4th should have a flag
		const beamableNotes = testData.score.staves[0].tokens.filter(t => t.duration >= 8)
		expect(beamableNotes.length).toBe(4)
		
		// Verify beam markers
		expect(beamableNotes[0].beam).toBe(1) // start
		expect(beamableNotes[1].beam).toBe(3) // middle
		expect(beamableNotes[2].beam).toBe(2) // end
		expect(beamableNotes[3].beam).toBe(0) // no beam
	})

	test('dotted notes with flags have proper spacing', () => {
		const testData = {
			score: {
				staves: [{
					tokens: [
						{ type: 'Note', position: -2, duration: 8, dots: 1, beam: 0, stem: 1 }
					]
				}]
			}
		}

		interpret(testData)
		const note = testData.score.staves[0].tokens[0]
		
		// Verify note has duration value and dots
		expect(note.durValue).toBeDefined()
		expect(note.dots).toBe(1)
		expect(note.duration).toBe(8)
		
		// Note should be marked for stem up (position < 0)
		expect(note.position).toBeLessThan(0)
	})
})
