import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

// Minimal mocks for the import chain (typeset → drawing → loaders → DOM)
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null }
globalThis.document = globalThis.document || {
	getElementById: () => mockElement,
	body: mockElement,
}
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { computeStaffExtents, isOffStaffRest } = await import('../src/layout/typeset.js')

const rest = (position) => ({ type: 'Rest', duration: 4, position })
const note = (position) => ({ type: 'Note', duration: 4, position })

describe('rests moved far off the staff', () => {
	test('offsets of a few staff heights are real, hundreds hide the rest', () => {
		expect(isOffStaffRest(rest(-10))).toBe(false)
		expect(isOffStaffRest(rest(20))).toBe(false)
		expect(isOffStaffRest(rest(-2000))).toBe(true)
		expect(isOffStaffRest(rest(2000))).toBe(true)
		expect(isOffStaffRest(note(-2000))).toBe(false)
	})

	test("don't widen the staff spacing", () => {
		const plain = computeStaffExtents([{ tokens: [note(0), rest(-6)] }])
		const hidden = computeStaffExtents([{ tokens: [note(0), rest(-6), rest(-2000), rest(2000)] }])
		expect(hidden).toEqual(plain)
		// a moderately offset rest still counts
		expect(computeStaffExtents([{ tokens: [rest(-20)] }])[0].minPos).toBe(-17)
	})

	test('uzbekistan.nwc hides its layered-voice rests this way', () => {
		const log = console.log
		console.log = () => {}
		let song
		try {
			const bytes = new Uint8Array(readFileSync(new URL('../nwcs/uzbekistan.nwc', import.meta.url)))
			song = decodeNwcArrayBuffer(bytes.buffer)
		} finally {
			console.log = log
		}
		const far = song.score.staves.flatMap(s => s.tokens).filter(isOffStaffRest).map(t => t.position)
		expect(far.length).toBeGreaterThan(0)
		expect(far.every(p => Math.abs(p) === 2000)).toBe(true)
	})
})
