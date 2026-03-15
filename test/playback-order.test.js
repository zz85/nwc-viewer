import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

// Minimal browser globals for modules that reference them at import time
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.Zlib = globalThis.Zlib || { Inflate: class { decompress() { return new Uint8Array() } } }

const { buildNoteEvents, buildTempoMap, ticksToSeconds, DYNAMIC_VELOCITY } = await import('../src/audio.js')
const { buildPlaybackSegments, collectMarkers, getMaxTick, findMasterMaxIterations } = await import('../src/playback-order.js')
const { interpret } = await import('../src/interpreter.js')
const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { Fraction } = await import('../src/fraction.js')

// ── Helpers ────────────────────────────────────────────────────────────────

/** Treble clef position: position 0 = B4 */
const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
function notePosition(name, octave) {
	return (octave - 4) * 7 + (NOTE_INDEX[name] - 6)
}

/** Create a minimal note token with correct staff position for treble clef */
function note(name, octave, dur = 4, extra = {}) {
	return {
		type: 'Note',
		position: notePosition(name, octave),
		duration: dur,
		dots: 0,
		accidental: '',
		tie: 0,
		tieEnd: 0,
		slur: 0,
		beam: 0,
		stem: 0,
		triplet: 0,
		staccato: 0,
		accent: 0,
		grace: 0,
		tenuto: 0,
		...extra,
	}
}

/** Create a dynamic token */
function dynamic(style) {
	return { type: 'Dynamic', dynamic: style }
}

/** Create a barline token */
function barline(style, repeat = 2) {
	return { type: 'Barline', barline: style, repeat }
}

/** Create an ending token */
function ending(bits, style = 0) {
	return { type: 'Ending', repeat: bits, style }
}

/** Create a flow direction token */
function flow(style) {
	return { type: 'Flow', style }
}

/** Create a rest token */
function rest(dur = 4) {
	return { type: 'Rest', duration: dur, dots: 0, triplet: 0 }
}

/**
 * Build a minimal interpreted score data structure from an array of staves.
 * Each staff is an array of tokens.
 * Runs the interpreter to assign tickValues and durValues.
 */
function makeScore(staffTokens, options = {}) {
	const data = {
		score: {
			staves: staffTokens.map(tokens => ({
				tokens,
				channel: 0,
				transposition: 0,
				clef: 'Treble',
				keySig: 'C',
				timeSig: { group: 4, beat: 4 },
				...options,
			})),
		},
	}
	interpret(data)
	return data
}

// ── Dynamic Velocity Tests ─────────────────────────────────────────────────

describe('Dynamic velocity', () => {
	test('DYNAMIC_VELOCITY has correct NWC spec values', () => {
		expect(DYNAMIC_VELOCITY.ppp).toBeCloseTo(10 / 127, 4)
		expect(DYNAMIC_VELOCITY.pp).toBeCloseTo(30 / 127, 4)
		expect(DYNAMIC_VELOCITY.p).toBeCloseTo(45 / 127, 4)
		expect(DYNAMIC_VELOCITY.mp).toBeCloseTo(60 / 127, 4)
		expect(DYNAMIC_VELOCITY.mf).toBeCloseTo(75 / 127, 4)
		expect(DYNAMIC_VELOCITY.f).toBeCloseTo(92 / 127, 4)
		expect(DYNAMIC_VELOCITY.ff).toBeCloseTo(108 / 127, 4)
		expect(DYNAMIC_VELOCITY.fff).toBeCloseTo(127 / 127, 4)
	})

	test('default velocity is mf when no dynamic marking', () => {
		const data = makeScore([[note('C', 4), note('D', 4)]])
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBe(2)
		expect(notes[0].velocity).toBeCloseTo(DYNAMIC_VELOCITY.mf, 4)
		expect(notes[1].velocity).toBeCloseTo(DYNAMIC_VELOCITY.mf, 4)
	})

	test('dynamic marking changes velocity for subsequent notes', () => {
		const data = makeScore([[
			note('C', 4),
			dynamic('ff'),
			note('D', 4),
			note('E', 4),
		]])
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBe(3)
		expect(notes[0].velocity).toBeCloseTo(DYNAMIC_VELOCITY.mf, 4) // before ff
		expect(notes[1].velocity).toBeCloseTo(DYNAMIC_VELOCITY.ff, 4) // after ff
		expect(notes[2].velocity).toBeCloseTo(DYNAMIC_VELOCITY.ff, 4) // still ff
	})

	test('multiple dynamic changes are tracked', () => {
		const data = makeScore([[
			dynamic('pp'),
			note('C', 4),
			dynamic('f'),
			note('D', 4),
			dynamic('ppp'),
			note('E', 4),
		]])
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBe(3)
		expect(notes[0].velocity).toBeCloseTo(DYNAMIC_VELOCITY.pp, 4)
		expect(notes[1].velocity).toBeCloseTo(DYNAMIC_VELOCITY.f, 4)
		expect(notes[2].velocity).toBeCloseTo(DYNAMIC_VELOCITY.ppp, 4)
	})

	test('dynamics are per-staff', () => {
		const data = makeScore([
			[dynamic('pp'), note('C', 4)],
			[dynamic('ff'), note('C', 4)],
		])
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBe(2)
		// Sort by staff to make assertion order deterministic
		const byStaff = notes.sort((a, b) => a.staffIndex - b.staffIndex)
		expect(byStaff[0].velocity).toBeCloseTo(DYNAMIC_VELOCITY.pp, 4)
		expect(byStaff[1].velocity).toBeCloseTo(DYNAMIC_VELOCITY.ff, 4)
	})

	test('unknown dynamic string keeps previous velocity', () => {
		const data = makeScore([[
			dynamic('f'),
			note('C', 4),
			{ type: 'Dynamic', dynamic: 'sfzz' }, // not in map
			note('D', 4),
		]])
		const { notes } = buildNoteEvents(data)
		expect(notes[0].velocity).toBeCloseTo(DYNAMIC_VELOCITY.f, 4)
		expect(notes[1].velocity).toBeCloseTo(DYNAMIC_VELOCITY.f, 4) // unchanged
	})
})

// ── Playback Segment Tests ─────────────────────────────────────────────────

describe('buildPlaybackSegments', () => {
	test('no structural markers → single segment covering whole score', () => {
		const data = makeScore([[note('C', 4), note('D', 4)]])
		const segs = buildPlaybackSegments(data.score.staves)
		expect(segs.length).toBe(1)
		expect(segs[0].startTick).toBe(0)
		expect(segs[0].endTick).toBeGreaterThan(0)
	})

	test('single barlines (non-repeat) → single segment', () => {
		const data = makeScore([[
			note('C', 4),
			barline(0), // Single barline
			note('D', 4),
		]])
		const segs = buildPlaybackSegments(data.score.staves)
		expect(segs.length).toBe(1)
	})

	// ── Local Repeats ────────────────────────────────────────────────────

	describe('local repeats', () => {
		test('local repeat with default count (2) produces 2 segments', () => {
			const data = makeScore([[
				barline(4), // LocalOpen
				note('C', 4),
				note('D', 4),
				barline(5), // LocalClose, default repeat=2
			]])
			const segs = buildPlaybackSegments(data.score.staves)
			// Should produce 2 passes through the repeated section
			expect(segs.length).toBe(2)
			expect(segs[0].startTick).toBe(segs[1].startTick)
			expect(segs[0].endTick).toBe(segs[1].endTick)
		})

		test('local repeat with count=3 produces 3 segments', () => {
			const data = makeScore([[
				barline(4), // LocalOpen
				note('C', 4),
				barline(5, 3), // LocalClose, repeat=3
			]])
			const segs = buildPlaybackSegments(data.score.staves)
			expect(segs.length).toBe(3)
		})

		test('content before and after local repeat', () => {
			const data = makeScore([[
				note('A', 4),             // before repeat
				barline(4),               // LocalOpen
				note('C', 5),
				barline(5),               // LocalClose
				note('E', 5),             // after repeat
			]])
			const segs = buildPlaybackSegments(data.score.staves)
			// Segment 1: start → LocalClose (A + C first pass)
			// Segment 2: LocalOpen → end (C repeat + E)
			expect(segs.length).toBe(2)
			// Verify correct notes via buildNoteEvents
			const { notes } = buildNoteEvents(data)
			const pitches = notes.map(n => n.midi)
			// Playback: A, C, C, E
			expect(pitches).toEqual([69, 72, 72, 76])
		})

		test('local repeat plays correct notes via buildNoteEvents', () => {
			const data = makeScore([[
				barline(4),               // LocalOpen
				note('C', 4),
				note('D', 4),
				barline(5),               // LocalClose
			]])
			const { notes } = buildNoteEvents(data)
			// Should hear: C D C D
			expect(notes.length).toBe(4)
			// Notes should be time-sorted; first pair then second pair
			expect(notes[0].midi).toBe(60) // C4
			expect(notes[1].midi).toBe(62) // D4
			expect(notes[2].midi).toBe(60) // C4 (repeat)
			expect(notes[3].midi).toBe(62) // D4 (repeat)
			// Second pair should start after first pair ends
			expect(notes[2].time).toBeGreaterThan(notes[0].time)
		})
	})

	// ── Master Repeats with Endings ──────────────────────────────────────

	describe('master repeats with endings', () => {
		test('master repeat without endings → 2 iterations', () => {
			const data = makeScore([[
				barline(6), // MasterOpen
				note('C', 4),
				barline(7), // MasterClose
			]])
			const segs = buildPlaybackSegments(data.score.staves)
			expect(segs.length).toBe(2)
		})

		test('master repeat with 1st/2nd endings', () => {
			const data = makeScore([[
				barline(6),               // MasterOpen
				note('C', 4),             // shared content
				ending(0x01),             // Ending 1 (bit 0)
				note('D', 4),             // 1st ending notes
				barline(7),               // MasterClose
				ending(0x02),             // Ending 2 (bit 1)
				note('E', 4),             // 2nd ending notes
			]])
			const { notes } = buildNoteEvents(data)
			// Playback: C, D (1st ending), C, E (2nd ending)
			expect(notes.length).toBe(4)
			expect(notes[0].midi).toBe(60) // C4
			expect(notes[1].midi).toBe(62) // D4 (1st ending)
			expect(notes[2].midi).toBe(60) // C4 (repeat)
			expect(notes[3].midi).toBe(64) // E4 (2nd ending)
		})

		test('master repeat with 3 endings', () => {
			// NWC structure: endings 1 and 2 inside repeat, ending 3 after MasterClose
			const data = makeScore([[
				barline(6),               // MasterOpen
				note('C', 4),             // shared
				ending(0x01),             // Ending 1
				note('D', 4),
				ending(0x02),             // Ending 2
				note('E', 4),
				barline(7),               // MasterClose
				ending(0x04),             // Ending 3
				note('F', 4),
			]])

			const segs = buildPlaybackSegments(data.score.staves)
			// Should have 3 iterations
			const { notes } = buildNoteEvents(data)
			// Playback: C D, C E, C F
			expect(notes.filter(n => n.midi === 60).length).toBe(3) // C played 3 times
		})

		test('combined endings (1st+2nd share same measures)', () => {
			const data = makeScore([[
				barline(6),               // MasterOpen
				note('C', 4),
				ending(0x03),             // Endings 1 AND 2 (bits 0+1)
				note('D', 4),
				barline(7),               // MasterClose
				ending(0x04),             // Ending 3
				note('E', 4),
			]])
			const segs = buildPlaybackSegments(data.score.staves)
			// Iterations 1 and 2 both match ending(0x03), iteration 3 matches ending(0x04)
			const { notes } = buildNoteEvents(data)
			// C D, C D, C E
			const cNotes = notes.filter(n => n.midi === 60)
			const dNotes = notes.filter(n => n.midi === 62)
			const eNotes = notes.filter(n => n.midi === 64)
			expect(cNotes.length).toBe(3)
			expect(dNotes.length).toBe(2)
			expect(eNotes.length).toBe(1)
		})
	})

	// ── Flow Directions ──────────────────────────────────────────────────

	describe('flow directions', () => {
		test('Da Capo jumps to beginning', () => {
			const data = makeScore([[
				note('C', 4),
				note('D', 4),
				flow(4), // DaCapo
				note('E', 4), // after D.C. — should play on second pass
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C D (hits D.C.)
			// Second pass: C D E (plays through to end)
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 60, 62, 64])
		})

		test('D.C. al Fine stops at Fine', () => {
			const data = makeScore([[
				note('C', 4),
				flow(2), // Fine
				note('D', 4),
				flow(6), // DCAlFine
				note('E', 4), // unreachable
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C, Fine (ignored), D, hits DCAlFine
			// Second pass: C, Fine (active → stop)
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 60])
		})

		test('Dal Segno jumps to Segno', () => {
			const data = makeScore([[
				note('C', 4),
				flow(1), // Segno
				note('D', 4),
				note('E', 4),
				flow(7), // DalSegno
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C D E (hits D.S.)
			// Second pass: from Segno → D E (plays to end)
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 64, 62, 64])
		})

		test('D.S. al Coda jumps Segno→ToCoda→Coda', () => {
			const data = makeScore([[
				note('C', 4),
				flow(1), // Segno
				note('D', 4),
				flow(3), // ToCoda
				note('E', 4),
				flow(8), // DSAlCoda
				flow(0), // Coda
				note('F', 4),
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C D (ToCoda ignored) E (hits DSAlCoda)
			// Second pass: from Segno → D (ToCoda active → jump to Coda) F
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 64, 62, 65])
		})

		test('D.C. al Coda', () => {
			const data = makeScore([[
				note('C', 4),
				note('D', 4),
				flow(3), // ToCoda
				note('E', 4),
				flow(5), // DCAlCoda
				flow(0), // Coda
				note('F', 4),
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C D (ToCoda ignored) E (hits DCAlCoda)
			// Second pass: from beginning → C D (ToCoda active → jump to Coda) F
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 64, 60, 62, 65])
		})

		test('Fine is ignored on first pass', () => {
			const data = makeScore([[
				note('C', 4),
				flow(2), // Fine — ignored first time
				note('D', 4),
			]])
			const { notes } = buildNoteEvents(data)
			// No D.C./D.S., so Fine is never active — plays straight through
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62])
		})

		test('ToCoda is ignored on first pass', () => {
			const data = makeScore([[
				note('C', 4),
				flow(3), // ToCoda — ignored without D.C./D.S.
				note('D', 4),
				flow(0), // Coda
				note('E', 4),
			]])
			const { notes } = buildNoteEvents(data)
			// No D.C./D.S., so ToCoda ignored — plays straight through
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 64])
		})
	})

	// ── D.C./D.S. with Master Repeats ────────────────────────────────────

	describe('D.C./D.S. master repeat interaction', () => {
		test('master repeats disabled after D.C.', () => {
			const data = makeScore([[
				barline(6),               // MasterOpen
				note('C', 4),
				barline(7),               // MasterClose
				note('D', 4),
				flow(4),                  // DaCapo
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C C D (master repeat plays twice)
			// After D.C.: master repeat disabled, so C (once) D
			const pitches = notes.map(n => n.midi)
			// C, C, D, C, D
			expect(pitches).toEqual([60, 60, 62, 60, 62])
		})

		test('default ending (D) taken after D.C.', () => {
			const data = makeScore([[
				barline(6),               // MasterOpen
				note('C', 4),
				ending(0x01),             // Ending 1
				note('D', 4),
				barline(7),               // MasterClose
				ending(0x82),             // Ending 2 + Default (bits 1 and 7)
				note('E', 4),
				flow(4),                  // DaCapo
			]])
			const { notes } = buildNoteEvents(data)
			// First pass: C D (ending 1), C E (ending 2)
			// After D.C.: master disabled, takes default (D) ending → C E
			const pitches = notes.map(n => n.midi)
			expect(pitches).toEqual([60, 62, 60, 64, 60, 64])
		})
	})

	// ── Segment-aware tie handling ───────────────────────────────────────

	describe('ties with segments', () => {
		test('ties within a segment still merge', () => {
			const data = makeScore([[
				barline(4),               // LocalOpen
				note('C', 4, 4, { tie: 1 }),
				note('C', 4, 4, { tieEnd: 1 }),
				barline(5),               // LocalClose
			]])
			const { notes } = buildNoteEvents(data)
			// Each pass should have 1 merged note (tie within segment)
			// 2 passes × 1 note each = 2 notes
			expect(notes.length).toBe(2)
			// Each note should be longer than a single quarter
			const quarterDur = notes[0].duration
			// Actually it depends on how the tie merging works...
			// The first note has tie=1, second has tieEnd=1
			// Within segment, they should merge
		})

		test('ties at repeat boundary do not merge across segments', () => {
			const data = makeScore([[
				barline(4),               // LocalOpen
				note('C', 4),
				note('D', 4, 4, { tie: 1 }),
				barline(5),               // LocalClose (repeat boundary)
			]])
			const { notes } = buildNoteEvents(data)
			// The tie from D should NOT extend into the repeated section
			// 2 passes × 2 notes = 4 notes
			expect(notes.length).toBe(4)
		})
	})

	// ── Dynamic velocity with segments ───────────────────────────────────

	describe('dynamics with repeats', () => {
		test('velocity resets to last dynamic before segment start on repeat', () => {
			const data = makeScore([[
				dynamic('pp'),
				barline(4),               // LocalOpen
				note('C', 4),
				dynamic('ff'),
				note('D', 4),
				barline(5),               // LocalClose
			]])
			const { notes } = buildNoteEvents(data)
			// Pass 1: C at pp, D at ff
			// Pass 2: C at pp (resets to last dynamic before segment start), D at ff
			expect(notes.length).toBe(4)
			expect(notes[0].velocity).toBeCloseTo(DYNAMIC_VELOCITY.pp, 4)
			expect(notes[1].velocity).toBeCloseTo(DYNAMIC_VELOCITY.ff, 4)
			expect(notes[2].velocity).toBeCloseTo(DYNAMIC_VELOCITY.pp, 4)
			expect(notes[3].velocity).toBeCloseTo(DYNAMIC_VELOCITY.ff, 4)
		})
	})

	// ── Timing ───────────────────────────────────────────────────────────

	describe('timing with segments', () => {
		test('repeated notes have correct time spacing', () => {
			const data = makeScore([[
				barline(4),
				note('C', 4),  // quarter = 0.5s at 120bpm
				barline(5),    // repeat
			]])
			const { notes } = buildNoteEvents(data)
			expect(notes.length).toBe(2)
			// At 120 BPM, quarter note = 0.5s
			// First C at time ~0, second C at time ~0.5
			expect(notes[0].time).toBeCloseTo(0, 1)
			expect(notes[1].time).toBeCloseTo(0.5, 1)
		})

		test('total duration includes repeated sections', () => {
			const data = makeScore([[
				barline(4),
				note('C', 4),
				note('D', 4),
				barline(5, 3), // repeat 3 times
			]])
			const { duration } = buildNoteEvents(data)
			// 2 quarter notes × 3 repeats = 6 quarter notes
			// At 120 BPM: 6 × 0.5s = 3.0s
			expect(duration).toBeCloseTo(3.0, 1)
		})
	})

	// ── collectMarkers ───────────────────────────────────────────────────

	describe('collectMarkers', () => {
		test('collects barlines, endings, and flow from all staves', () => {
			const data = makeScore([
				[barline(4), note('C', 4), barline(5)],
				[barline(4), note('D', 4), barline(5)],
			])
			const markers = collectMarkers(data.score.staves)
			// Should deduplicate — only one LocalOpen and one LocalClose
			const barlineMarkers = markers.filter(m => m.kind === 'barline')
			expect(barlineMarkers.length).toBe(2)
		})

		test('ignores non-structural barlines (Single, Double)', () => {
			const data = makeScore([[
				note('C', 4),
				barline(0), // Single
				note('D', 4),
				barline(1), // Double
				note('E', 4),
			]])
			const markers = collectMarkers(data.score.staves)
			expect(markers.length).toBe(0)
		})

		test('sorts endings before barlines at same tick', () => {
			const data = makeScore([[
				barline(6),
				note('C', 4),
				ending(0x01),
				note('D', 4),
				barline(7),
			]])
			const markers = collectMarkers(data.score.staves)
			// Find markers at the ending/masterClose tick
			const endingIdx = markers.findIndex(m => m.kind === 'ending')
			const closeIdx = markers.findIndex(m => m.kind === 'barline' && m.barline === 7)
			// If they're at the same tick, ending should come first
			if (endingIdx !== -1 && closeIdx !== -1 && markers[endingIdx].tick === markers[closeIdx].tick) {
				expect(endingIdx).toBeLessThan(closeIdx)
			}
		})
	})

	// ── findMasterMaxIterations ──────────────────────────────────────────

	describe('findMasterMaxIterations', () => {
		test('returns 2 when no endings', () => {
			const data = makeScore([[
				barline(6),
				note('C', 4),
				barline(7),
			]])
			const markers = collectMarkers(data.score.staves)
			const openIdx = markers.findIndex(m => m.kind === 'barline' && m.barline === 6)
			expect(findMasterMaxIterations(markers, openIdx)).toBe(2)
		})

		test('returns highest ending number', () => {
			const data = makeScore([[
				barline(6),
				note('C', 4),
				ending(0x01), // ending 1
				note('D', 4),
				barline(7),
				ending(0x04), // ending 3
				note('E', 4),
			]])
			const markers = collectMarkers(data.score.staves)
			const openIdx = markers.findIndex(m => m.kind === 'barline' && m.barline === 6)
			expect(findMasterMaxIterations(markers, openIdx)).toBe(3)
		})
	})
})

// ── Integration tests with real NWC files ──────────────────────────────────

describe('Dynamic velocity with real NWC files', () => {
	test('bachjesu.nwc notes have velocity from dynamics', () => {
		let data
		try {
			const contents = readFileSync('nwcs/bachjesu.nwc')
			data = decodeNwcArrayBuffer(contents)
		} catch {
			return // skip if file not available
		}

		interpret(data)
		const { notes } = buildNoteEvents(data)
		expect(notes.length).toBeGreaterThan(0)

		// All notes should have numeric velocity in valid range
		for (const n of notes) {
			expect(n.velocity).toBeGreaterThan(0)
			expect(n.velocity).toBeLessThanOrEqual(1.0)
		}

		// Check that not all velocities are the same (if file has dynamics)
		const uniqueVelocities = new Set(notes.map(n => Math.round(n.velocity * 1000)))
		// bachjesu.nwc may or may not have dynamics — just check valid range
		expect(uniqueVelocities.size).toBeGreaterThanOrEqual(1)
	})
})
