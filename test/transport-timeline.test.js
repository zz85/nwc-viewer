import { describe, test, expect } from 'bun:test'

// Minimal browser globals for modules that reference them at import time
globalThis.window = globalThis.window || { ctx: null, canvas: null }

const { interpret } = await import('../src/interpreter.js')
const { buildNoteEvents } = await import('../src/audio.js')
const { buildTimeline, positionAt, stepBars, stepSections } = await import('../src/transport-timeline.js')
const { keyName } = await import('../src/commands.js')

// ── Helpers ────────────────────────────────────────────────────────────────

const note = () => ({ type: 'Note', position: 0, duration: 4, dots: 0 })
const bar = (style = 0, repeat = 2) => ({ type: 'Barline', barline: style, repeat })
const text = (t, font = 1) => ({ type: 'Text', text: t, font, position: 8 })
const DOUBLE = 1, LOCAL_OPEN = 4, LOCAL_CLOSE = 5, SECTION_CLOSE = 3

/** 4/4 at ♩ = 120: a quarter note lasts 0.5 s, a bar 2 s. */
function makeScore(tokens) {
	const data = {
		score: {
			staves: [{
				tokens: [{ type: 'Tempo', duration: 120, beatDuration: 0.25 }, ...tokens],
				channel: 0, transposition: 0, clef: 'Treble', keySig: 'C', timeSig: { group: 4, beat: 4 },
			}],
		},
	}
	interpret(data)
	return data
}

const fourBars = () => [note(), note(), note(), note()]
const timelineOf = data => buildTimeline(data, { duration: buildNoteEvents(data).duration })

// ── Tests ──────────────────────────────────────────────────────────────────

describe('transport timeline', () => {
	test('bar starts in seconds, numbered from 1, closing barline starts nothing', () => {
		const tl = timelineOf(makeScore([...fourBars(), bar(), ...fourBars(), bar(), ...fourBars(), bar(SECTION_CLOSE)]))
		expect(tl.bars.map(b => b.bar)).toEqual([1, 2, 3])
		expect(tl.bars.map(b => b.time)).toEqual([0, 2, 4])
		expect(tl.barCount).toBe(3)
		expect(tl.duration).toBeCloseTo(6)
		expect(tl.tempo).toEqual({ bpm: 120, beat: 0.25, written: true })
	})

	test('a double barline starts a section, labelled by bold or all-caps text', () => {
		const tl = timelineOf(makeScore([
			...fourBars(), bar(), ...fourBars(), bar(DOUBLE),
			text('CHORUS  '), ...fourBars(), bar(), ...fourBars(), bar(SECTION_CLOSE),
		]))
		expect(tl.sections.map(s => [s.time, s.bar, s.label])).toEqual([[0, 1, ''], [4, 3, 'Chorus']])
		expect(tl.sections[0].end).toBe(4)
		expect(positionAt(tl, 5).section.label).toBe('Chorus')
		expect(positionAt(tl, 5).bar).toBe(3)
	})

	test('performance notes and verse numbers are not section names', () => {
		const tl = timelineOf(makeScore([
			...fourBars(), bar(DOUBLE), text('ad lib.', 6), text('1.', 1), ...fourBars(), bar(SECTION_CLOSE),
		]))
		expect(tl.sections.map(s => s.label)).toEqual(['', ''])
	})

	test('repeats are unrolled: each pass is a section and its bars appear again', () => {
		const tl = timelineOf(makeScore([
			...fourBars(), bar(LOCAL_OPEN), ...fourBars(), bar(), ...fourBars(), bar(LOCAL_CLOSE), ...fourBars(), bar(SECTION_CLOSE),
		]))
		expect(tl.bars.map(b => b.bar)).toEqual([1, 2, 3, 2, 3, 4])
		expect(tl.bars.map(b => b.time)).toEqual([0, 2, 4, 6, 8, 10])
		expect(tl.sections.map(s => s.time)).toEqual([0, 2, 6, 10])
	})

	test('stepBars moves by bars; going back from inside a bar returns to its start first', () => {
		const tl = timelineOf(makeScore([...fourBars(), bar(), ...fourBars(), bar(), ...fourBars(), bar(SECTION_CLOSE)]))
		expect(stepBars(tl, 0, 1)).toBe(2)
		expect(stepBars(tl, 2.1, 1)).toBe(4)
		expect(stepBars(tl, 3, -1)).toBe(2)    // well inside bar 2 → its start
		expect(stepBars(tl, 2.1, -1)).toBe(0)  // just started bar 2 → bar 1
		expect(stepBars(tl, 0, -5)).toBe(0)
		expect(stepBars(tl, 4, 5)).toBe(4)
	})

	test('stepSections moves between sections; back from inside one returns to its start first', () => {
		// sections at 0 (verse) and 4 s (Chorus), piece ends at 8 s
		const tl = timelineOf(makeScore([
			...fourBars(), bar(), ...fourBars(), bar(DOUBLE),
			text('CHORUS'), ...fourBars(), bar(), ...fourBars(), bar(SECTION_CLOSE),
		]))
		expect(stepSections(tl, 1, 1)).toBe(4)       // verse → Chorus
		expect(stepSections(tl, 5, 1)).toBe(null)    // already in the last section
		expect(stepSections(tl, 7, -1)).toBe(4)      // 3 s into the Chorus → its start
		expect(stepSections(tl, 4.5, -1)).toBe(0)    // just started the Chorus → the verse
		expect(stepSections(tl, 0.5, -1)).toBe(0)    // nothing before the first section
	})

	test('no score: an empty timeline', () => {
		const tl = buildTimeline(null)
		expect(tl.bars).toEqual([])
		expect(positionAt(tl, 3)).toEqual({ bar: 0, section: null })
		expect(stepBars(tl, 3, 1)).toBe(0)
	})
})

describe('shortcut key names', () => {
	const ev = (key, extra = {}) => ({ key, code: '', altKey: false, shiftKey: false, ...extra })
	test('printable keys are lower-cased and Shift is implied', () => {
		expect(keyName(ev(' '))).toBe('Space')
		expect(keyName(ev('K', { shiftKey: true }))).toBe('k')
		expect(keyName(ev('<', { shiftKey: true }))).toBe('<')
		expect(keyName(ev('?', { shiftKey: true }))).toBe('?')
	})
	test('named keys carry Shift; Alt+digit uses the key position', () => {
		expect(keyName(ev('ArrowLeft', { shiftKey: true }))).toBe('Shift+ArrowLeft')
		expect(keyName(ev('¡', { code: 'Digit1', altKey: true }))).toBe('Alt+1')
	})
})
