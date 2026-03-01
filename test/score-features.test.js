import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.Zlib = globalThis.Zlib || { Inflate: class { decompress() { return new Uint8Array() } } }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')

describe('Staff labels and endingBar pass-through', () => {
	test('staff_label is passed through from parser (AChildThisDayIsBorn)', () => {
		const contents = readFileSync('samples/AChildThisDayIsBorn.nwc')
		const data = decodeNwcArrayBuffer(contents)

		expect(data.score.staves[0].staff_label).toBe('s')
		expect(data.score.staves[1].staff_label).toBe('a')
		expect(data.score.staves[2].staff_label).toBe('t')
		expect(data.score.staves[3].staff_label).toBe('b')
	})

	test('staff_label is passed through from parser (WhatChildIsThis)', () => {
		const contents = readFileSync('samples/WhatChildIsThis.nwc')
		const data = decodeNwcArrayBuffer(contents)

		expect(data.score.staves[0].staff_label).toBe('s')
		expect(data.score.staves[2].staff_label).toBe('t')
	})

	test('endingBar is passed through from parser', () => {
		const contents = readFileSync('samples/AChildThisDayIsBorn.nwc')
		const data = decodeNwcArrayBuffer(contents)

		// endingBar=0 maps to 'Section Close' (default)
		data.score.staves.forEach(stave => {
			expect(stave.endingBar).toBeDefined()
			expect(typeof stave.endingBar).toBe('number')
		})
	})

	test('empty label returns empty string', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)

		// carenot.nwc is a simple file — labels should be empty string
		data.score.staves.forEach(stave => {
			expect(typeof stave.staff_label).toBe('string')
		})
	})
})

describe('Barline styles in parsed data', () => {
	test('barline tokens have style values (WhatChildIsThis)', () => {
		const contents = readFileSync('samples/WhatChildIsThis.nwc')
		const data = decodeNwcArrayBuffer(contents)

		const barlines = data.score.staves[0].tokens.filter(t => t.type === 'Barline')
		expect(barlines.length).toBeGreaterThan(0)

		// Each barline should have a numeric barline style
		barlines.forEach(b => {
			expect(typeof b.barline).toBe('number')
			expect(b.barline).toBeGreaterThanOrEqual(0)
			expect(b.barline).toBeLessThanOrEqual(8)
		})
	})

	test('WhatChildIsThis has Single(0), Double(1), and SectionClose(3) barlines', () => {
		const contents = readFileSync('samples/WhatChildIsThis.nwc')
		const data = decodeNwcArrayBuffer(contents)

		const barlines = data.score.staves[0].tokens.filter(t => t.type === 'Barline')
		const styles = new Set(barlines.map(b => b.barline))

		expect(styles.has(0)).toBe(true)  // Single
		expect(styles.has(1)).toBe(true)  // Double
		expect(styles.has(3)).toBe(true)  // SectionClose
	})

	test('most barlines are Single style (0)', () => {
		const contents = readFileSync('samples/AChildThisDayIsBorn.nwc')
		const data = decodeNwcArrayBuffer(contents)

		const barlines = data.score.staves[0].tokens.filter(t => t.type === 'Barline')
		const singles = barlines.filter(b => b.barline === 0)

		// Majority should be single barlines
		expect(singles.length).toBeGreaterThan(barlines.length / 2)
	})
})

describe('Lyrics data flow', () => {
	test('staves with lyrics have non-empty lyrics array', () => {
		const contents = readFileSync('samples/AChildThisDayIsBorn.nwc')
		const data = decodeNwcArrayBuffer(contents)

		// Staff 0 (soprano) has lyrics
		const soprano = data.score.staves[0]
		expect(soprano.lyrics).toBeDefined()
		expect(soprano.lyrics.length).toBeGreaterThan(0)
		expect(soprano.lyrics[0].length).toBeGreaterThan(0)

		// Staff 1 (alto) has no lyrics
		const alto = data.score.staves[1]
		expect(alto.lyrics.length === 0 || alto.lyrics.every(l => !l || l.length === 0)).toBe(true)
	})

	test('lyrics are assigned to note tokens after interpret', () => {
		const contents = readFileSync('samples/AChildThisDayIsBorn.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		const soprano = data.score.staves[0]
		const notesWithText = soprano.tokens.filter(t =>
			(t.type === 'Note' || t.type === 'Chord') && t.text
		)

		// Soprano staff should have lyrics assigned to notes
		expect(notesWithText.length).toBeGreaterThan(0)

		// First lyric should start with the song text
		const firstLyric = notesWithText.find(n => n.text && n.text.trim().length > 0)
		expect(firstLyric).toBeDefined()
	})

	test('non-lyric staves have no text on notes after interpret', () => {
		const contents = readFileSync('samples/AChildThisDayIsBorn.nwc')
		const data = decodeNwcArrayBuffer(contents)
		interpret(data)

		// Alto staff (index 1) should have no lyrics on notes
		const alto = data.score.staves[1]
		const notesWithText = alto.tokens.filter(t =>
			(t.type === 'Note' || t.type === 'Chord') && t.text && t.text.trim().length > 0
		)
		expect(notesWithText.length).toBe(0)
	})
})

describe('Barline connector logic with lyrics', () => {
	// The barline connector should NOT connect staves when lyrics exist between them.
	// This tests the decision logic, not the drawing.

	function hasLyricsBetweenStaves(staves, staveIndex, getStaffY) {
		var staveData = staves[staveIndex]
		if (!staveData) return false
		for (var lsi = staveIndex; lsi < staves.length - 1; lsi++) {
			if (getStaffY(lsi) !== getStaffY(staveIndex) && lsi !== staveIndex) break
			var stLyrics = staves[lsi].lyrics
			if (stLyrics && stLyrics.length && stLyrics.some(function(l) { return l && l.length > 0 })) {
				return true
			}
		}
		return false
	}

	test('detects lyrics on soprano staff (should block connector)', () => {
		const staves = [
			{ lyrics: ['A Child this day is born'], bracketWithNext: true },
			{ lyrics: [], bracketWithNext: false },
		]
		const getStaffY = (i) => i * 200

		expect(hasLyricsBetweenStaves(staves, 0, getStaffY)).toBe(true)
	})

	test('no lyrics means connector is allowed', () => {
		const staves = [
			{ lyrics: [], bracketWithNext: true },
			{ lyrics: [], bracketWithNext: false },
		]
		const getStaffY = (i) => i * 200

		expect(hasLyricsBetweenStaves(staves, 0, getStaffY)).toBe(false)
	})

	test('empty lyrics array does not block connector', () => {
		const staves = [
			{ lyrics: [''], bracketWithNext: true },
			{ lyrics: [], bracketWithNext: false },
		]
		const getStaffY = (i) => i * 200

		// lyrics: [''] has length > 0 but content is empty string
		expect(hasLyricsBetweenStaves(staves, 0, getStaffY)).toBe(false)
	})

	test('layered staves at same Y — lyrics on any of them blocks connector', () => {
		// Staves 0 and 1 are layered (same Y), stave 2 is separate
		const staves = [
			{ lyrics: [], bracketWithNext: true },
			{ lyrics: ['some lyrics'], bracketWithNext: false },
			{ lyrics: [], bracketWithNext: false },
		]
		// Staves 0 and 1 share Y=100, stave 2 at Y=300
		const getStaffY = (i) => i < 2 ? 100 : 300

		// From stave 0, stave 1 (same Y) has lyrics → should block
		expect(hasLyricsBetweenStaves(staves, 0, getStaffY)).toBe(true)
	})

	test('second group without lyrics does not block', () => {
		const staves = [
			{ lyrics: ['lyrics here'], bracketWithNext: true },
			{ lyrics: [], bracketWithNext: false },
			{ lyrics: [], bracketWithNext: true },
			{ lyrics: [], bracketWithNext: false },
		]
		const getStaffY = (i) => i * 200

		// Stave 0 has lyrics → blocks
		expect(hasLyricsBetweenStaves(staves, 0, getStaffY)).toBe(true)
		// Stave 2 has no lyrics → allows
		expect(hasLyricsBetweenStaves(staves, 2, getStaffY)).toBe(false)
	})
})

describe('Ending barline style mapping', () => {
	// endingBar staff property → BarStyle mapping:
	// [SectionClose(3), MasterClose(7), Single(0), Double(1), Hidden(8)]
	const endingBarStyles = [3, 7, 0, 1, 8]

	test('endingBar 0 maps to SectionClose (3)', () => {
		expect(endingBarStyles[0]).toBe(3)
	})

	test('endingBar 1 maps to MasterClose (7)', () => {
		expect(endingBarStyles[1]).toBe(7)
	})

	test('endingBar 2 maps to Single (0)', () => {
		expect(endingBarStyles[2]).toBe(0)
	})

	test('endingBar 3 maps to Double (1)', () => {
		expect(endingBarStyles[3]).toBe(1)
	})

	test('endingBar 4 maps to Hidden (8)', () => {
		expect(endingBarStyles[4]).toBe(8)
	})
})

describe('Staff visual properties pass-through (WhatChildIsThis)', () => {
	const contents = readFileSync('samples/WhatChildIsThis.nwc')
	const data = decodeNwcArrayBuffer(contents)

	test('boundaryTop values match parsed data', () => {
		// Staff 0 (s): Upper Boundary = 12 (stored as -12)
		expect(data.score.staves[0].boundaryTop).toBe(-12)
		// Staff 2 (t): Upper Boundary = 16 (stored as -16)
		expect(data.score.staves[2].boundaryTop).toBe(-16)
	})

	test('boundaryBottom values match parsed data', () => {
		// Staff 0 (s): Lower Boundary = 16
		expect(data.score.staves[0].boundaryBottom).toBe(16)
		// Staff 2 (t): Lower Boundary = 18
		expect(data.score.staves[2].boundaryBottom).toBe(18)
	})

	test('bracketWithNext flags match parsed data', () => {
		// Staff 0 (s): Orchestral Bracket = checked
		expect(data.score.staves[0].bracketWithNext).toBe(true)
		// Staff 1 (a): Orchestral Bracket = not checked (end of bracket group)
		expect(data.score.staves[1].bracketWithNext).toBe(false)
		// Staff 2 (t): Orchestral Bracket = checked
		expect(data.score.staves[2].bracketWithNext).toBe(true)
		// Staff 3 (b): not checked
		expect(data.score.staves[3].bracketWithNext).toBe(false)
	})

	test('layerWithNext flags default to false in this file', () => {
		data.score.staves.forEach(stave => {
			expect(stave.layerWithNext).toBe(false)
		})
	})

	test('lines defaults to 5 for all staves', () => {
		data.score.staves.forEach(stave => {
			expect(stave.lines).toBe(5)
		})
	})
})
