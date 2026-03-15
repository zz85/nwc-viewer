import { describe, test, expect } from 'bun:test'

// Mock browser globals needed by drawing.js → loaders.js import chain
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null }
globalThis.document = globalThis.document || {
	getElementById: () => mockElement,
	body: mockElement,
}
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const { computeBeamLayout, groupBeamableNotes, computeStemLength } = await import('../src/layout/beams.js')

describe('computeBeamLayout', () => {
	test('two 8th notes → 1 primary beam, no sub-beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 8])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams).toEqual([])
	})

	test('three 8th notes → 1 primary beam, no sub-beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 8, 8])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams).toEqual([])
	})

	test('two 16th notes → 2 primary beams, no sub-beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([16, 16])
		expect(primaryBeamCount).toBe(2)
		expect(subBeams).toEqual([])
	})

	test('four 16th notes → 2 primary beams, no sub-beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([16, 16, 16, 16])
		expect(primaryBeamCount).toBe(2)
		expect(subBeams).toEqual([])
	})

	test('dotted-8th + 16th → 1 primary beam, 1 stub sub-beam on the 16th', () => {
		// Dotted 8th has duration=8 (dot is separate flag), 16th has duration=16
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 16])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams.length).toBe(1)
		// Sub-beam is on the 16th note (index 1), stub toward the 8th (index 0)
		expect(subBeams[0].startIdx).toBe(1)
		expect(subBeams[0].endIdx).toBe(1)
		expect(subBeams[0].stub).toBe(true)
		expect(subBeams[0].neighborIdx).toBe(0)
		expect(subBeams[0].level).toBe(2)
	})

	test('16th + dotted-8th → 1 primary beam, 1 stub sub-beam on the 16th', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([16, 8])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams.length).toBe(1)
		// Sub-beam on 16th (index 0), stub toward 8th (index 1)
		expect(subBeams[0].startIdx).toBe(0)
		expect(subBeams[0].endIdx).toBe(0)
		expect(subBeams[0].stub).toBe(true)
		expect(subBeams[0].neighborIdx).toBe(1)
		expect(subBeams[0].level).toBe(2)
	})

	test('8th + two 16ths → 1 primary beam, 1 full sub-beam across the 16ths', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 16, 16])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams.length).toBe(1)
		// Full sub-beam across notes 1-2 (no double-draw)
		expect(subBeams[0].startIdx).toBe(1)
		expect(subBeams[0].endIdx).toBe(2)
		expect(subBeams[0].stub).toBe(false)
		expect(subBeams[0].level).toBe(2)
	})

	test('two 16ths + 8th → 1 primary, 1 full sub-beam across the 16ths', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([16, 16, 8])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams.length).toBe(1)
		expect(subBeams[0].startIdx).toBe(0)
		expect(subBeams[0].endIdx).toBe(1)
		expect(subBeams[0].stub).toBe(false)
	})

	test('8th + 16th + 16th: exactly 1 sub-beam, no duplicate (regression)', () => {
		// Old code drew the sub-beam twice — once per 16th note.
		// New code should emit exactly 1 sub-beam segment.
		const { subBeams } = computeBeamLayout([8, 16, 16])
		expect(subBeams.length).toBe(1)
	})

	test('8th + 16th + 8th → 1 primary, 1 isolated stub on middle 16th', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 16, 8])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams.length).toBe(1)
		expect(subBeams[0].startIdx).toBe(1)
		expect(subBeams[0].stub).toBe(true)
		// Should stub toward next neighbor (index 2)
		expect(subBeams[0].neighborIdx).toBe(2)
	})

	test('8th + 16th + 32nd → multi-level sub-beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 16, 32])
		expect(primaryBeamCount).toBe(1)
		// Level 2: 16th and 32nd both need ≥2 beams → full segment [1,2]
		// Level 3: only 32nd needs 3 beams → isolated stub at index 2
		const level2 = subBeams.filter(s => s.level === 2)
		const level3 = subBeams.filter(s => s.level === 3)
		expect(level2.length).toBe(1)
		expect(level2[0].startIdx).toBe(1)
		expect(level2[0].endIdx).toBe(2)
		expect(level2[0].stub).toBe(false)
		expect(level3.length).toBe(1)
		expect(level3[0].startIdx).toBe(2)
		expect(level3[0].stub).toBe(true)
	})

	test('two 32nd notes → 3 primary beams, no sub-beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([32, 32])
		expect(primaryBeamCount).toBe(3)
		expect(subBeams).toEqual([])
	})

	test('single note returns 0 beams', () => {
		const { primaryBeamCount, subBeams } = computeBeamLayout([8])
		expect(primaryBeamCount).toBe(0)
		expect(subBeams).toEqual([])
	})

	test('dotted-8th + 16th + dotted-8th + 16th (compound 6/8 pattern)', () => {
		// Common in 6/8: dotted-8th + 16th repeated
		const { primaryBeamCount, subBeams } = computeBeamLayout([8, 16, 8, 16])
		expect(primaryBeamCount).toBe(1)
		// Two isolated 16ths, each gets a stub
		expect(subBeams.length).toBe(2)
		expect(subBeams[0].startIdx).toBe(1)
		expect(subBeams[0].stub).toBe(true)
		expect(subBeams[1].startIdx).toBe(3)
		expect(subBeams[1].stub).toBe(true)
	})

	test('16th + 16th + 16th + 8th → 2 primary, 1 full sub-beam across first 3', () => {
		// Wait — minDuration is 8, so primaryBeamCount = 1
		const { primaryBeamCount, subBeams } = computeBeamLayout([16, 16, 16, 8])
		expect(primaryBeamCount).toBe(1)
		expect(subBeams.length).toBe(1)
		expect(subBeams[0].startIdx).toBe(0)
		expect(subBeams[0].endIdx).toBe(2)
		expect(subBeams[0].stub).toBe(false)
	})
})

describe('groupBeamableNotes', () => {
	function makeNote(duration, beam, position = 0) {
		return {
			type: 'Note',
			duration,
			beam,
			position,
			drawingNoteHead: { x: position * 20, y: 0, width: 10 }
		}
	}

	test('beam markers 1=start, 2=middle, 3=end form one group', () => {
		const tokens = [
			makeNote(8, 1),
			makeNote(8, 2),
			makeNote(8, 3),
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(1)
		expect(groups[0].length).toBe(3)
	})

	test('beam=0 notes are standalone (no group)', () => {
		const tokens = [
			makeNote(8, 0),
			makeNote(8, 0),
		]
		const groups = groupBeamableNotes(tokens)
		// Each beam=0 note is standalone, not grouped
		expect(groups.length).toBe(0)
	})

	test('two separate beam groups', () => {
		const tokens = [
			makeNote(8, 1),
			makeNote(8, 3),
			makeNote(16, 1),
			makeNote(16, 3),
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(2)
		expect(groups[0].length).toBe(2)
		expect(groups[1].length).toBe(2)
	})

	test('quarter notes (duration < 8) are not beamable', () => {
		const tokens = [
			{ type: 'Note', duration: 4, beam: 1, drawingNoteHead: { x: 0, y: 0, width: 10 } },
			{ type: 'Note', duration: 4, beam: 3, drawingNoteHead: { x: 20, y: 0, width: 10 } },
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(0)
	})

	test('notes without drawingNoteHead are skipped', () => {
		const tokens = [
			{ type: 'Note', duration: 8, beam: 1 },
			{ type: 'Note', duration: 8, beam: 3 },
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(0)
	})

	test('non-note tokens break beam groups', () => {
		const tokens = [
			makeNote(8, 1),
			{ type: 'Barline' },
			makeNote(8, 3),
		]
		const groups = groupBeamableNotes(tokens)
		// Barline breaks the group; each side has 1 note
		expect(groups.length).toBe(2)
		expect(groups[0].length).toBe(1)
		expect(groups[1].length).toBe(1)
	})

	test('Chord type tokens are beamable', () => {
		const tokens = [
			{ type: 'Chord', duration: 8, beam: 1, drawingNoteHead: { x: 0, y: 0, width: 10 }, notes: [{ position: 0 }, { position: 2 }] },
			{ type: 'Chord', duration: 8, beam: 3, drawingNoteHead: { x: 20, y: 0, width: 10 }, notes: [{ position: 0 }, { position: 2 }] },
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(1)
		expect(groups[0].length).toBe(2)
	})
})

// =============================================================================
// computeStemLength — engraving guidelines
// =============================================================================
describe('computeStemLength', () => {
	test('standard stem length is 7 half-spaces (3.5 staff spaces) for single beam', () => {
		// Note on middle line (position=0), stems up, no chord span, 1 beam
		expect(computeStemLength(0, true, 0, 1)).toBe(7)
		expect(computeStemLength(0, false, 0, 1)).toBe(7)
	})

	test('standard stem length is 7 for notes near middle line', () => {
		// Notes within the staff don't need extra length
		expect(computeStemLength(2, true, 0, 1)).toBe(7)   // above middle, stems up
		expect(computeStemLength(-2, false, 0, 1)).toBe(7)  // below middle, stems down
		expect(computeStemLength(-4, true, 0, 1)).toBe(7)   // bottom line, stems up
	})

	test('chord span adds to stem length', () => {
		// Chord spanning 4 half-spaces
		expect(computeStemLength(0, true, 4, 1)).toBe(7 + 4)
	})

	test('32nd notes (3 beams) get extra stem length', () => {
		// 3 beams: extra (3-1)*2 = 4 half-space units
		const len = computeStemLength(0, true, 0, 3)
		expect(len).toBe(7 + 4)  // 11 half-spaces = 5.5 staff spaces
	})

	test('16th notes (2 beams) get extra stem length', () => {
		// 2 beams: extra (2-1)*2 = 2 half-space units
		const len = computeStemLength(0, true, 0, 2)
		expect(len).toBe(7 + 2)  // 9 half-spaces = 4.5 staff spaces
	})

	test('ledger line note below staff (stems up) reaches middle line', () => {
		// Position -8 = 4 half-spaces below bottom staff line (-4), stems up
		// Stem must reach from -8 up to middle line (0), distance = 8
		const len = computeStemLength(-8, true, 0, 1)
		expect(len).toBe(8)  // 8 > 7 (base), so uses 8
	})

	test('ledger line note far below staff (stems up) reaches middle line', () => {
		// Position -12 = way below staff, stems up
		const len = computeStemLength(-12, true, 0, 1)
		expect(len).toBe(12)  // must reach all the way to middle
	})

	test('ledger line note above staff (stems down) reaches middle line', () => {
		// Position +8 = 4 half-spaces above top staff line (+4), stems down
		// Stem must reach from +8 down to middle line (0), distance = 8
		const len = computeStemLength(8, false, 0, 1)
		expect(len).toBe(8)
	})

	test('notes within staff do not trigger ledger line extension', () => {
		// Position -3 is within the staff (between -4 and +4)
		const len = computeStemLength(-3, true, 0, 1)
		expect(len).toBe(7)  // standard length, no ledger line override
	})

	test('combined chord span + extra beams + ledger line', () => {
		// Position -10, chord span 4, 3 beams (stems up from way below staff)
		// Base: 7 + 4 (chord) = 11, + 4 (extra beams) = 15
		// Ledger line: need 10 to reach middle line, but 15 > 10
		const len = computeStemLength(-10, true, 4, 3)
		expect(len).toBe(15)
	})

	test('standalone notes get beamCount=0 (no extra beam length)', () => {
		// Standalone flagged notes should use beamCount=0
		// A 32nd note standalone: 7 base, no beam extras
		expect(computeStemLength(0, true, 0, 0)).toBe(7)
	})
})
