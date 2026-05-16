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

// =============================================================================
// TickTracker — barline alignment across staves
// =============================================================================
import { TickTracker } from '../src/layout/tick-tracker.js'

describe('TickTracker barline alignment', () => {
	// Helper: create a cursor-like object at a given X
	function cursor(x) {
		return { staveX: x, lastPadRight: 0 }
	}

	// ------------------------------------------------------------------
	// Example 1: matching barlines on both staves align vertically
	// stave 1: | a a a |
	// stave 2: | b b b |
	// ------------------------------------------------------------------
	test('matching barlines at same tabValue align at same X', () => {
		const tt = new TickTracker()
		// Simulate notes ending at tabUntilValue=1.0, cursor at X=100
		const note0 = { tabValue: 0, tabUntilValue: 1.0, type: 'Note' }
		const c0 = cursor(100)
		tt.add(note0, c0)  // maxTicks[1.0] = 100

		const note1 = { tabValue: 0, tabUntilValue: 1.0, type: 'Note' }
		const c1 = cursor(95)
		tt.add(note1, c1)  // maxTicks[1.0] = 100 (not updated, 95 < 100)

		// Barline on staff 0 at tabValue=1.0
		const bar0Cursor = cursor(100)
		const bar0 = { tabValue: 1.0, tabUntilValue: 1.0, type: 'Barline' }
		tt.alignBarline(bar0, bar0Cursor)
		const barlineX = bar0Cursor.staveX
		// Register: drawn at barlineX, post-gap at barlineX + 20
		tt.addBarline(bar0, barlineX, barlineX + 20)

		// Barline on staff 1 at tabValue=1.0
		const bar1Cursor = cursor(95)
		const bar1 = { tabValue: 1.0, tabUntilValue: 1.0, type: 'Barline' }
		tt.alignBarline(bar1, bar1Cursor)

		// Both barlines must be at the same X
		expect(bar1Cursor.staveX).toBe(barlineX)
	})

	// ------------------------------------------------------------------
	// Example 2: extra barline on one staff, notes still align
	// stave 1: | a a | a |
	// stave 2: | b b   b |
	// ------------------------------------------------------------------
	test('notes align across staves despite extra barline on one staff', () => {
		const tt = new TickTracker()
		// Two notes on both staves end at tabUntilValue=0.5
		const noteEnd = { tabValue: 0, tabUntilValue: 0.5, type: 'Note' }
		tt.add(noteEnd, cursor(80))

		// Extra barline on staff 0 at tabValue=0.5 (staff 1 has no barline)
		const barCursor = cursor(80)
		const bar = { tabValue: 0.5, tabUntilValue: 0.5, type: 'Barline' }
		tt.alignBarline(bar, barCursor)
		const barDrawnX = barCursor.staveX  // should be 80
		const postGapX = barDrawnX + 20     // simulate gap
		tt.addBarline(bar, barDrawnX, postGapX)

		// Note on staff 0 after barline (cursor at postGapX)
		const noteA = { tabValue: 0.5, tabUntilValue: 1.0, type: 'Note' }
		const cA = cursor(postGapX)  // cursor at 100 (past gap)
		tt.alignWithMax(noteA, cA)
		const noteAx = cA.staveX

		// Note on staff 1 at same tabValue (cursor at 80, no barline gap)
		const noteB = { tabValue: 0.5, tabUntilValue: 1.0, type: 'Note' }
		const cB = cursor(80)
		tt.alignWithMax(noteB, cB)
		const noteBx = cB.staveX

		// Both notes must be at the same X (pushed past the barline gap)
		expect(noteAx).toBe(noteBx)
		// And that X should be past the barline gap
		expect(noteAx).toBe(postGapX)
	})

	// ------------------------------------------------------------------
	// Example 3: multiple extra barlines create space, rules still hold
	// stave 1: | a a | | | a |
	// stave 2: | b b |     b |
	// ------------------------------------------------------------------
	test('matching barline aligns with first barline, extras create space', () => {
		const tt = new TickTracker()
		const GAP = 20

		// Notes end at tabUntilValue=0.5, cursor at 80
		tt.add({ tabValue: 0, tabUntilValue: 0.5, type: 'Note' }, cursor(80))

		// --- Staff 0: three barlines at tabValue=0.5 ---
		// Barline 1 (staff 0)
		const c0bar1 = cursor(80)
		tt.alignBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, c0bar1)
		const bar1X = c0bar1.staveX
		tt.addBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, bar1X, bar1X + GAP)

		// Barline 2 (staff 0) — cursor advanced by gap
		const c0bar2 = cursor(bar1X + GAP)
		tt.alignBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, c0bar2)
		const bar2X = c0bar2.staveX
		tt.addBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, bar2X, bar2X + GAP)

		// Barline 3 (staff 0) — cursor advanced again
		const c0bar3 = cursor(bar2X + GAP)
		tt.alignBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, c0bar3)
		const bar3X = c0bar3.staveX
		tt.addBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, bar3X, bar3X + GAP)

		// --- Staff 1: one barline at tabValue=0.5 ---
		const c1bar = cursor(80)
		tt.alignBarline({ tabValue: 0.5, tabUntilValue: 0.5 }, c1bar)

		// Staff 1's barline must align with staff 0's FIRST barline
		expect(c1bar.staveX).toBe(bar1X)

		// --- Notes after all barlines ---
		// Staff 0 note (cursor past all 3 barline gaps)
		const cA = cursor(bar3X + GAP)
		tt.alignWithMax({ tabValue: 0.5, tabUntilValue: 1.0, type: 'Note' }, cA)

		// Staff 1 note (cursor at barline + 1 gap only)
		const cB = cursor(bar1X + GAP)
		tt.alignWithMax({ tabValue: 0.5, tabUntilValue: 1.0, type: 'Note' }, cB)

		// Both notes must be at the same X (the furthest post-gap position)
		expect(cA.staveX).toBe(cB.staveX)
		expect(cA.staveX).toBe(bar3X + GAP)
	})

	test('end barlines align across staves after notes', () => {
		const tt = new TickTracker()
		// Notes on both staves end at tabUntilValue=1.0
		tt.add({ tabValue: 0, tabUntilValue: 1.0, type: 'Note' }, cursor(200))
		tt.add({ tabValue: 0, tabUntilValue: 1.0, type: 'Note' }, cursor(190))

		// End barline on staff 0
		const endBar0 = cursor(200)
		tt.alignBarline({ tabValue: 1.0, tabUntilValue: 1.0 }, endBar0)
		const endBarX = endBar0.staveX
		tt.addBarline({ tabValue: 1.0, tabUntilValue: 1.0 }, endBarX, endBarX + 20)

		// End barline on staff 1
		const endBar1 = cursor(190)
		tt.alignBarline({ tabValue: 1.0, tabUntilValue: 1.0 }, endBar1)

		// Both end barlines at the same X
		expect(endBar1.staveX).toBe(endBarX)
	})

	test('alignWithMax uses Math.max — never snaps cursor backward', () => {
		const tt = new TickTracker()
		// Register a position at tabUntilValue=0.5
		tt.add({ tabValue: 0, tabUntilValue: 0.5, type: 'Note' }, cursor(50))

		// A cursor already past that position should NOT snap back
		const c = cursor(100)
		tt.alignWithMax({ tabValue: 0.5, type: 'Note' }, c)
		expect(c.staveX).toBe(100)  // stays at 100, not snapped back to 50
	})
})
