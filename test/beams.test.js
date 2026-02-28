import { describe, test, expect } from 'bun:test'

// Mock browser globals needed by drawing.js → loaders.js import chain
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null }
globalThis.document = globalThis.document || {
	getElementById: () => mockElement,
	body: mockElement,
}
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const { computeBeamLayout, groupBeamableNotes } = await import('../src/layout/beams.js')

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

	test('beam markers 1=start, 3=middle, 2=end form one group', () => {
		const tokens = [
			makeNote(8, 1),
			makeNote(8, 3),
			makeNote(8, 2),
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
			makeNote(8, 2),
			makeNote(16, 1),
			makeNote(16, 2),
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(2)
		expect(groups[0].length).toBe(2)
		expect(groups[1].length).toBe(2)
	})

	test('quarter notes (duration < 8) are not beamable', () => {
		const tokens = [
			{ type: 'Note', duration: 4, beam: 1, drawingNoteHead: { x: 0, y: 0, width: 10 } },
			{ type: 'Note', duration: 4, beam: 2, drawingNoteHead: { x: 20, y: 0, width: 10 } },
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(0)
	})

	test('notes without drawingNoteHead are skipped', () => {
		const tokens = [
			{ type: 'Note', duration: 8, beam: 1 },
			{ type: 'Note', duration: 8, beam: 2 },
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(0)
	})

	test('non-note tokens break beam groups', () => {
		const tokens = [
			makeNote(8, 1),
			{ type: 'Barline' },
			makeNote(8, 2),
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
			{ type: 'Chord', duration: 8, beam: 2, drawingNoteHead: { x: 20, y: 0, width: 10 }, notes: [{ position: 0 }, { position: 2 }] },
		]
		const groups = groupBeamableNotes(tokens)
		expect(groups.length).toBe(1)
		expect(groups[0].length).toBe(2)
	})
})
