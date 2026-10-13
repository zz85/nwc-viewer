import { describe, test, expect } from 'bun:test'

// Mock browser globals needed by the typeset → drawing → loaders import chain
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null, style: {} }
globalThis.document = globalThis.document || { getElementById: () => mockElement, body: mockElement, createElement: () => mockElement }
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const { computeCollapse } = await import('../src/layout/typeset.js')
const { parseNWCTxt } = await import('../lib/nwc2xml/nwctxt-parser.js')

const FS = 28
const bar = { type: 'Barline' }
const note = { type: 'Note' }
const collapse = { type: 'Boundary', style: 'Collapse' }
const endCollapse = { type: 'Boundary', style: 'EndCollapse' }

// A staff of n bars; `marks` puts boundary tokens at the start of bars
function staff(n, marks = {}) {
	const tokens = []
	for (let b = 0; b < n; b++) {
		if (b > 0) tokens.push(bar)
		if (marks[b]) tokens.push(marks[b])
		tokens.push(note)
	}
	return { tokens }
}

// Systems as lists of bars per system → systemBreaks (barline index before each new system)
function breaks(barsPerSystem) {
	const out = []
	let bars = 0
	for (const n of barsPerSystem.slice(0, -1)) { bars += n; out.push({ boundaryIndex: bars - 1 }) }
	return out
}

// Staves 100 px apart: 0 → 0, 1 → 100, 2 → 200 ...
const run = (staves, barsPerSystem, opts = {}) =>
	computeCollapse(staves, breaks(barsPerSystem), barsPerSystem.length, 200 + FS,
		{ staffY: (si) => (opts.ys ? opts.ys[si] : si * 100), fontSize: FS, showHidden: !!opts.showHidden })

describe('computeCollapse', () => {
	test('nothing collapses without Collapse boundaries', () => {
		expect(run([staff(8), staff(8)], [4, 4])).toBe(null)
	})

	test('a staff collapsed from the start is hidden until the system with its EndCollapse', () => {
		// Voice collapsed bars 0-4, ends at bar 5 (inside the second system)
		const staves = [staff(12, { 0: collapse, 5: endCollapse }), staff(12), staff(12)]
		const [s1, s2, s3] = run(staves, [4, 4, 4])
		expect(s1.hidden).toEqual([true, false, false])
		expect(s2.hidden).toEqual([false, false, false]) // EndCollapse mid-system: shown throughout
		expect(s3.hidden).toEqual([false, false, false])
		// The staves below move up into the gap and the system gets shorter
		expect(s1.dy).toEqual([0, -100, -100])
		expect(s1.height).toBe(100 + FS)
		expect(s2.height).toBe(200 + FS)
	})

	test('a Collapse mid-system takes effect from the next system', () => {
		const staves = [staff(12), staff(12, { 2: collapse })]
		const [s1, s2] = run(staves, [4, 8])
		expect(s1.hidden).toEqual([false, false])
		expect(s2.hidden).toEqual([false, true])
		expect(s2.height).toBe(FS) // only the top staff left
	})

	test('layered staves collapse only together', () => {
		// Staves 0 and 1 share a position (layers); only one is collapsed
		const one = run([staff(4, { 0: collapse }), staff(4), staff(4)], [4], { ys: [0, 0, 100] })
		expect(one[0].hidden).toEqual([false, false, false])
		const both = run([staff(4, { 0: collapse }), staff(4, { 0: collapse }), staff(4)], [4], { ys: [0, 0, 100] })
		expect(both[0].hidden).toEqual([true, true, false])
	})

	test('a system never loses all its staves', () => {
		const [s1] = run([staff(4, { 0: collapse }), staff(4, { 0: collapse })], [4])
		expect(s1.hidden).toEqual([false, false])
	})

	test('with Show hidden items collapsed staves stay in place', () => {
		const [s1] = run([staff(4, { 0: collapse }), staff(4)], [4], { showHidden: true })
		expect(s1.hidden).toEqual([true, false])
		expect(s1.dy).toEqual([0, 0])
		expect(s1.height).toBe(200 + FS)
	})
})

describe('Boundary objects in nwctxt', () => {
	test('are parsed with their style and kept fields', () => {
		const file = parseNWCTxt('!NoteWorthyComposer(2.75)\r\n|AddStaff|Name:"V"\r\n|Boundary|Style:Collapse\r\n|Boundary|Style:NewSystem|NewPage:Y\r\n!NoteWorthyComposer-End')
		const [a, b] = file.staffs[0].objects
		expect(a.styleName).toBe('Collapse')
		expect(b.styleName).toBe('NewSystem')
		expect(b.newPage).toBe(true)
		expect(b.fields).toEqual(['Style:NewSystem', 'NewPage:Y'])
	})
})
