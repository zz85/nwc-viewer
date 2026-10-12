import { describe, test, expect } from 'bun:test'

// Minimal browser globals for modules that reference them at import time
globalThis.window = globalThis.window || { ctx: null, canvas: null }

const { buildNoteEvents } = await import('../src/audio.js')
const { interpret } = await import('../src/interpreter.js')
const { buildOnsets } = await import('../src/view3d/onsets.js')

// ── Helpers ────────────────────────────────────────────────────────────────

const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
/** Treble clef staff position (0 = B4) */
const pos = (name, octave) => (octave - 4) * 7 + (NOTE_INDEX[name] - 6)

const note = (name, octave = 4) => ({ type: 'Note', position: pos(name, octave), duration: 4, dots: 0 })
const chord = (...names) => ({
	type: 'Chord', position: pos(names[0], 4), duration: 4, dots: 0,
	notes: names.map(n => ({ position: pos(n, 4), duration: 4 })),
})
const barline = (style, repeat = 2) => ({ type: 'Barline', barline: style, repeat })

function makeScore(staffTokens) {
	const data = {
		score: {
			staves: staffTokens.map(tokens => ({
				tokens, channel: 0, transposition: 0, clef: 'Treble', keySig: 'C', timeSig: { group: 4, beat: 4 },
			})),
		},
	}
	interpret(data)
	return data
}

/**
 * Stand-in for layout + buildScoreMeshes: give every note (and chord child)
 * a drawingNoteHead element, and map each element to a head record.
 * Staves listed in `undrawn` get no heads (like hidden staves).
 */
function drawHeads(data, undrawn = []) {
	const heads = new Map()
	data.score.staves.forEach((stave, si) => {
		stave.tokens.forEach((tok, ti) => {
			if (undrawn.includes(si)) return
			const draw = (n, k) => {
				n.drawingNoteHead = { name: 'noteheadBlack' }
				heads.set(n.drawingNoteHead, { x: ti * 10, y: si * -20 + k, staff: si })
			}
			if (tok.type === 'Note') draw(tok, 0)
			if (tok.type === 'Chord') {
				tok.notes.forEach(draw)
				tok.drawingNoteHead = tok.notes[0].drawingNoteHead
			}
		})
	})
	return heads
}

function onsetsFor(data, heads) {
	const hits = buildNoteEvents(data).notes.map(n => ({ time: n.time, staff: n.staffIndex, token: n.token }))
	return buildOnsets(hits, heads, data.score.staves.length)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('3D view onsets', () => {
	test('one time-sorted onset per note, one list per staff', () => {
		const data = makeScore([
			[note('C'), note('D'), note('E')],
			[note('C', 3), note('G', 3)],
		])
		const perStaff = onsetsFor(data, drawHeads(data))
		expect(perStaff.length).toBe(2)
		expect(perStaff.map(l => l.staff)).toEqual([0, 1])
		expect(perStaff[0].length).toBe(3)
		expect(perStaff[1].length).toBe(2)
		for (const list of perStaff) {
			for (let i = 1; i < list.length; i++) expect(list[i].time).toBeGreaterThan(list[i - 1].time)
		}
		expect(perStaff[0][0].time).toBe(0)
	})

	test('a chord is one onset holding every notehead', () => {
		const data = makeScore([[chord('C', 'E', 'G'), note('D')]])
		const perStaff = onsetsFor(data, drawHeads(data))
		expect(perStaff[0].length).toBe(2)
		expect(perStaff[0][0].heads.length).toBe(3)
		expect(perStaff[0][1].heads.length).toBe(1)
	})

	test('a repeated passage lights its noteheads again on the second pass', () => {
		const data = makeScore([[barline(4), note('C'), note('D'), barline(5)]])
		const heads = drawHeads(data)
		const perStaff = onsetsFor(data, heads)
		const [first] = perStaff
		expect(first.length).toBe(4)
		// Same heads, second pass later in time
		expect(first[2].heads[0]).toBe(first[0].heads[0])
		expect(first[3].heads[0]).toBe(first[1].heads[0])
		expect(first[2].time).toBeGreaterThan(first[1].time)
	})

	test('notes without a drawn notehead are left out', () => {
		const data = makeScore([[note('C'), note('D')], [note('E'), note('F')]])
		const perStaff = onsetsFor(data, drawHeads(data, [1]))
		expect(perStaff[0].length).toBe(2)
		expect(perStaff[1].length).toBe(0)
	})

	test('does not add fields to the score tokens', () => {
		const data = makeScore([[note('C'), chord('C', 'E')]])
		const heads = drawHeads(data)
		const before = data.score.staves[0].tokens.map(t => Object.keys(t).sort().join())
		onsetsFor(data, heads)
		expect(data.score.staves[0].tokens.map(t => Object.keys(t).sort().join())).toEqual(before)
	})
})
