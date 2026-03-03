import { describe, test, expect } from 'bun:test'

// Minimal mocks for the import chain
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null, style: {}, appendChild() {}, clientWidth: 800, clientHeight: 600, scrollLeft: 0, scrollTop: 0, scrollTo() {} }
globalThis.document = globalThis.document || {
	getElementById: () => mockElement,
	createElement: (tag) => ({
		...mockElement,
		id: '', tagName: tag.toUpperCase(),
		getContext: () => ({
			clearRect() {}, save() {}, restore() {}, scale() {}, translate() {},
			beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
			arc() {}, fillRect() {}, setTransform() {},
		}),
	}),
	body: mockElement,
}
globalThis.window = globalThis.window || {
	ctx: null, canvas: null, devicePixelRatio: 1,
	requestAnimationFrame: (fn) => setTimeout(fn, 16),
	cancelAnimationFrame: (id) => clearTimeout(id),
}
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((fn) => setTimeout(fn, 16))
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id))

const { buildNoteEvents, buildTempoMap, ticksToSeconds } = await import('../src/audio.js')
const { PlaybackHighlighter } = await import('../src/playback-highlight.js')

// ── Helper: create mock tokens with interpreted fields ─────────────────────

function makeNote(tickValue, position = 0, si = 0, ti = 0) {
	return {
		type: 'Note',
		position,
		duration: 4,
		dots: 0,
		name: 'C',
		octave: 4,
		accidentalValue: '',
		tickValue,
		durValue: { value: () => 0.25 },
		tabValue: tickValue,
		tabUntilValue: tickValue + 0.25,
		drawingNoteHead: {
			x: tickValue * 200 + 50,
			y: 240 + si * 200,
			offsetX: 0,
			offsetY: -15,
			width: 12,
			path: { draw() {} },
		},
		staffIndex: si,
	}
}

function makeChord(tickValue, notePositions = [0, 4], si = 0, ti = 0) {
	const notes = notePositions.map((pos, i) => ({
		type: 'Note',
		position: pos,
		duration: 4,
		name: 'E',
		octave: 4,
		accidentalValue: '',
		drawingNoteHead: {
			x: tickValue * 200 + 50,
			y: 240 + si * 200 + pos * 7.5,
			offsetX: 0,
			offsetY: 0,
			width: 12,
			path: { draw() {} },
		},
	}))

	return {
		type: 'Chord',
		position: notePositions[0],
		duration: 4,
		dots: 0,
		name: 'C',
		octave: 4,
		accidentalValue: '',
		tickValue,
		durValue: { value: () => 0.25 },
		tabValue: tickValue,
		tabUntilValue: tickValue + 0.25,
		notes,
		chords: notePositions.length,
		drawingNoteHead: notes[0].drawingNoteHead,
		staffIndex: si,
	}
}

function makeStave(tokens, lyrics = []) {
	return { tokens, lyrics }
}

// ── buildNoteEvents: token references ──────────────────────────────────────

describe('buildNoteEvents token references', () => {
	test('NoteEvent includes staffIndex, tokenIndex, and token', () => {
		const note = makeNote(0)
		const data = {
			score: { staves: [makeStave([
				{ type: 'Clef', clef: 'treble', tabValue: 0, tabUntilValue: 0 },
				note,
			])] }
		}
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBe(1)
		expect(notes[0].staffIndex).toBe(0)
		expect(notes[0].tokenIndex).toBe(1) // index 0 is the clef
		expect(notes[0].token).toBe(note)
	})

	test('Chord NoteEvents all reference the chord token', () => {
		const chord = makeChord(0, [0, 4])
		const data = {
			score: { staves: [makeStave([chord])] }
		}
		const { notes } = buildNoteEvents(data)
		// Main voice + 2 chord notes = 3 events total
		expect(notes.length).toBe(3)
		for (const ev of notes) {
			expect(ev.token).toBe(chord)
			expect(ev.staffIndex).toBe(0)
			expect(ev.tokenIndex).toBe(0)
		}
	})

	test('Chord child NoteEvents have noteRef pointing to child note', () => {
		const chord = makeChord(0, [0, 4])
		const data = {
			score: { staves: [makeStave([chord])] }
		}
		const { notes } = buildNoteEvents(data)
		// First event is the main voice (no noteRef), rest are children
		const children = notes.filter(n => n.noteRef)
		expect(children.length).toBe(2)
		expect(children[0].noteRef).toBe(chord.notes[0])
		expect(children[1].noteRef).toBe(chord.notes[1])
	})

	test('multi-staff events have correct staffIndex', () => {
		const n0 = makeNote(0, 0, 0)
		const n1 = makeNote(0, -3, 1)
		const data = {
			score: { staves: [
				makeStave([n0]),
				makeStave([n1]),
			] }
		}
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBe(2)
		const s0 = notes.find(n => n.staffIndex === 0)
		const s1 = notes.find(n => n.staffIndex === 1)
		expect(s0.token).toBe(n0)
		expect(s1.token).toBe(n1)
	})
})

// ── buildTempoMap & ticksToSeconds ─────────────────────────────────────────

describe('tempo map', () => {
	test('default tempo is 120 BPM', () => {
		const map = buildTempoMap([makeStave([])])
		expect(map.length).toBe(1)
		expect(map[0].bpm).toBe(120)
	})

	test('ticksToSeconds at 120 BPM: quarter note = 0.5s', () => {
		const map = [{ tick: 0, bpm: 120 }]
		const sec = ticksToSeconds(0.25, map) // quarter note = 0.25 whole-note units
		expect(sec).toBeCloseTo(0.5, 5)
	})

	test('ticksToSeconds at 60 BPM: quarter note = 1.0s', () => {
		const map = [{ tick: 0, bpm: 60 }]
		const sec = ticksToSeconds(0.25, map)
		expect(sec).toBeCloseTo(1.0, 5)
	})
})

// ── PlaybackHighlighter: time index & cursor position ──────────────────────

describe('PlaybackHighlighter', () => {
	test('setScore builds time index from note tokens', () => {
		const h = new PlaybackHighlighter(mockElement)
		const n1 = makeNote(0)
		const n2 = makeNote(0.25)
		const n3 = makeNote(0.5)
		const data = {
			score: { staves: [makeStave([n1, n2, n3])] }
		}
		h.setScore(data)
		// Should have 3 entries (one per note)
		expect(h._timeIndex.length).toBe(3)
		// Entries should be sorted by time
		for (let i = 1; i < h._timeIndex.length; i++) {
			expect(h._timeIndex[i].time).toBeGreaterThanOrEqual(h._timeIndex[i - 1].time)
		}
	})

	test('setScore deduplicates notes at the same time (multi-staff)', () => {
		const h = new PlaybackHighlighter(mockElement)
		const n0 = makeNote(0, 0, 0)
		const n1 = makeNote(0, -3, 1) // same tickValue, different staff
		const data = {
			score: { staves: [makeStave([n0]), makeStave([n1])] }
		}
		h.setScore(data)
		// Two notes at time=0 should be deduplicated to 1 entry
		expect(h._timeIndex.length).toBe(1)
	})

	test('_getCursorPosition returns null for empty index', () => {
		const h = new PlaybackHighlighter(mockElement)
		h._timeIndex = []
		expect(h._getCursorPosition(0)).toBeNull()
	})

	test('_getCursorPosition returns first entry for time before first note', () => {
		const h = new PlaybackHighlighter(mockElement)
		h._timeIndex = [
			{ time: 0.5, x: 100, y: 240 },
			{ time: 1.0, x: 200, y: 240 },
		]
		const pos = h._getCursorPosition(0)
		expect(pos.x).toBe(100)
		expect(pos.y).toBe(240)
	})

	test('_getCursorPosition interpolates between entries', () => {
		const h = new PlaybackHighlighter(mockElement)
		h._timeIndex = [
			{ time: 0, x: 100, y: 240 },
			{ time: 1, x: 300, y: 240 },
		]
		const pos = h._getCursorPosition(0.5)
		expect(pos.x).toBeCloseTo(200, 1)
		expect(pos.y).toBeCloseTo(240, 1)
	})

	test('_getCursorPosition snaps at cross-system boundary', () => {
		const h = new PlaybackHighlighter(mockElement)
		h._timeIndex = [
			{ time: 0, x: 100, y: 240 },
			{ time: 1, x: 50, y: 600 }, // different system (large Y jump)
		]
		// At t=0.3 (closer to first), should snap to first entry
		const pos1 = h._getCursorPosition(0.3)
		expect(pos1.x).toBe(100)
		expect(pos1.y).toBe(240)

		// At t=0.7 (closer to second), should snap to second entry
		const pos2 = h._getCursorPosition(0.7)
		expect(pos2.x).toBe(50)
		expect(pos2.y).toBe(600)
	})

	test('active note tracking: onNoteOn adds, onNoteOff removes', () => {
		const h = new PlaybackHighlighter(mockElement)
		const tok = makeNote(0)
		const ev = { token: tok }

		expect(h._activeTokens.size).toBe(0)
		h.onNoteOn(ev)
		expect(h._activeTokens.size).toBe(1)
		expect(h._activeTokens.has(tok)).toBe(true)

		h.onNoteOff(ev)
		expect(h._activeTokens.size).toBe(0)
	})

	test('multiple simultaneous notes tracked independently', () => {
		const h = new PlaybackHighlighter(mockElement)
		const t1 = makeNote(0)
		const t2 = makeNote(0.25)

		h.onNoteOn({ token: t1 })
		h.onNoteOn({ token: t2 })
		expect(h._activeTokens.size).toBe(2)

		h.onNoteOff({ token: t1 })
		expect(h._activeTokens.size).toBe(1)
		expect(h._activeTokens.has(t2)).toBe(true)

		h.onNoteOff({ token: t2 })
		expect(h._activeTokens.size).toBe(0)
	})

	test('stop() clears active notes', () => {
		const h = new PlaybackHighlighter(mockElement)
		h.onNoteOn({ token: makeNote(0) })
		h.onNoteOn({ token: makeNote(0.25) })
		expect(h._activeTokens.size).toBe(2)
		h.stop()
		expect(h._activeTokens.size).toBe(0)
	})

	test('toggleStyle alternates between colored and glow', () => {
		const h = new PlaybackHighlighter(mockElement)
		expect(h._style).toBe('colored')
		const s1 = h.toggleStyle()
		expect(s1).toBe('glow')
		expect(h._style).toBe('glow')
		const s2 = h.toggleStyle()
		expect(s2).toBe('colored')
		expect(h._style).toBe('colored')
	})
})
