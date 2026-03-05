import { describe, test, expect } from 'bun:test'

import {
	buildDurationTable,
	quantizeDuration,
	quantizeStartTick,
	detectClef,
	midiToStaffPosition,
	fifthsToKeySig,
	splitAtBarlines,
	groupSimultaneousNotes,
	applyBeaming,
	generateRests,
	ticksToRests,
	buildStaffTokens,
	isMidiFile,
} from '../src/midi-import.js'

// ── buildDurationTable ─────────────────────────────────────────────────────

describe('buildDurationTable', () => {
	const ppq = 480
	const table = buildDurationTable(ppq)

	test('produces candidates sorted by ticks descending', () => {
		for (let i = 1; i < table.length; i++) {
			expect(table[i].ticks).toBeLessThanOrEqual(table[i - 1].ticks)
		}
	})

	test('contains whole note (1920 ticks at ppq=480)', () => {
		const whole = table.find(c => c.duration === 1 && c.dots === 0 && !c.triplet)
		expect(whole).toBeTruthy()
		expect(whole.ticks).toBe(1920)
	})

	test('contains quarter note (480 ticks at ppq=480)', () => {
		const quarter = table.find(c => c.duration === 4 && c.dots === 0 && !c.triplet)
		expect(quarter).toBeTruthy()
		expect(quarter.ticks).toBe(480)
	})

	test('contains dotted quarter (720 ticks at ppq=480)', () => {
		const dq = table.find(c => c.duration === 4 && c.dots === 1 && !c.triplet)
		expect(dq).toBeTruthy()
		expect(dq.ticks).toBe(720)
	})

	test('contains 16th note (120 ticks at ppq=480)', () => {
		const sixteenth = table.find(c => c.duration === 16 && c.dots === 0 && !c.triplet)
		expect(sixteenth).toBeTruthy()
		expect(sixteenth.ticks).toBe(120)
	})

	test('contains triplet quarter (320 ticks at ppq=480)', () => {
		const tq = table.find(c => c.duration === 4 && c.dots === 0 && c.triplet)
		expect(tq).toBeTruthy()
		expect(tq.ticks).toBe(320)
	})

	test('contains double-dotted half (1680 ticks at ppq=480)', () => {
		const ddh = table.find(c => c.duration === 2 && c.dots === 2 && !c.triplet)
		expect(ddh).toBeTruthy()
		expect(ddh.ticks).toBe(1680)
	})
})

// ── quantizeDuration ───────────────────────────────────────────────────────

describe('quantizeDuration', () => {
	const ppq = 480
	const table = buildDurationTable(ppq)

	test('exact quarter note → duration 4, dots 0', () => {
		const result = quantizeDuration(480, table)
		expect(result.duration).toBe(4)
		expect(result.dots).toBe(0)
		expect(result.triplet).toBe(false)
	})

	test('close to quarter note (490 ticks) → snaps to quarter', () => {
		const result = quantizeDuration(490, table)
		expect(result.duration).toBe(4)
		expect(result.dots).toBe(0)
	})

	test('exact dotted quarter (720 ticks) → duration 4, dots 1', () => {
		const result = quantizeDuration(720, table)
		expect(result.duration).toBe(4)
		expect(result.dots).toBe(1)
	})

	test('exact eighth note (240 ticks) → duration 8, dots 0', () => {
		const result = quantizeDuration(240, table)
		expect(result.duration).toBe(8)
		expect(result.dots).toBe(0)
	})

	test('triplet quarter ~320 ticks → duration 4, triplet true', () => {
		const result = quantizeDuration(320, table)
		expect(result.duration).toBe(4)
		expect(result.triplet).toBe(true)
	})

	test('very short duration → smallest available', () => {
		const result = quantizeDuration(15, table)
		expect(result.duration).toBeGreaterThanOrEqual(16)
	})
})

// ── quantizeStartTick ──────────────────────────────────────────────────────

describe('quantizeStartTick', () => {
	test('snaps to nearest 16th note grid (ppq=480, grid=120)', () => {
		expect(quantizeStartTick(0, 120)).toBe(0)
		expect(quantizeStartTick(59, 120)).toBe(0)    // rounds to 0
		expect(quantizeStartTick(61, 120)).toBe(120)   // rounds to 120
		expect(quantizeStartTick(120, 120)).toBe(120)
		expect(quantizeStartTick(180, 120)).toBe(240)  // rounds to 240
	})

	test('exact grid position unchanged', () => {
		expect(quantizeStartTick(480, 120)).toBe(480)
		expect(quantizeStartTick(960, 120)).toBe(960)
	})
})

// ── detectClef ─────────────────────────────────────────────────────────────

describe('detectClef', () => {
	test('high notes → treble', () => {
		const notes = [{ midiNote: 72 }, { midiNote: 76 }, { midiNote: 80 }]
		expect(detectClef(notes)).toBe('treble')
	})

	test('low notes → bass', () => {
		const notes = [{ midiNote: 36 }, { midiNote: 40 }, { midiNote: 45 }]
		expect(detectClef(notes)).toBe('bass')
	})

	test('middle C area → bass (median < 60)', () => {
		const notes = [{ midiNote: 48 }, { midiNote: 55 }, { midiNote: 58 }]
		expect(detectClef(notes)).toBe('bass')
	})

	test('above middle C → treble', () => {
		const notes = [{ midiNote: 60 }, { midiNote: 65 }, { midiNote: 70 }]
		expect(detectClef(notes)).toBe('treble')
	})

	test('empty notes → treble (default)', () => {
		expect(detectClef([])).toBe('treble')
	})
})

// ── midiToStaffPosition ───────────────────────────────────────────────────

describe('midiToStaffPosition', () => {
	// Position convention: negative = below middle line, positive = above.
	// In treble clef, middle line = B4 (offset 34).
	// In bass clef, middle line = D3 (offset 22).

	test('C4 (MIDI 60) in treble clef → position -6 (below staff)', () => {
		const result = midiToStaffPosition(60, 'treble', [], [])
		expect(result.name).toBe('C')
		expect(result.octave).toBe(4)
		expect(result.accidental).toBe('')
		// C4 absPitch = 4*7+0 = 28, treble offset = 34, position = 28-34 = -6
		expect(result.position).toBe(-6)
	})

	test('B4 (MIDI 71) in treble clef → position 0 (middle line)', () => {
		const result = midiToStaffPosition(71, 'treble', [], [])
		expect(result.name).toBe('B')
		expect(result.octave).toBe(4)
		// B4 absPitch = 4*7+6 = 34, position = 34-34 = 0
		expect(result.position).toBe(0)
	})

	test('D3 (MIDI 50) in bass clef → position 0 (middle line)', () => {
		const result = midiToStaffPosition(50, 'bass', [], [])
		expect(result.name).toBe('D')
		expect(result.octave).toBe(3)
		// D3 absPitch = 3*7+1 = 22, bass offset=22, position = 0
		expect(result.position).toBe(0)
	})

	test('E4 (MIDI 64) in treble clef → position -4 (bottom line)', () => {
		// This matches real NWC data: "What Child Is This" has E4 at position -4
		const result = midiToStaffPosition(64, 'treble', [], [])
		expect(result.name).toBe('E')
		expect(result.position).toBe(-4)
	})

	test('C5 (MIDI 72) in treble clef → position 1 (above middle)', () => {
		const result = midiToStaffPosition(72, 'treble', [], [])
		expect(result.name).toBe('C')
		expect(result.octave).toBe(5)
		// C5 absPitch = 5*7+0 = 35, position = 35-34 = 1
		expect(result.position).toBe(1)
	})

	test('F#4 (MIDI 66) in key of G → no explicit accidental', () => {
		const result = midiToStaffPosition(66, 'treble', ['F'], [])
		expect(result.name).toBe('F')
		// In key of G, F is already sharp, so no explicit needed
		expect(result.accidental).toBe('')
	})

	test('F4 natural (MIDI 65) in key of G → needs natural sign', () => {
		const result = midiToStaffPosition(65, 'treble', ['F'], [])
		expect(result.name).toBe('F')
		expect(result.accidental).toBe('n')
	})

	test('Bb3 (MIDI 58) in key of Bb → no explicit accidental', () => {
		const result = midiToStaffPosition(58, 'treble', [], ['B'])
		expect(result.name).toBe('B')
		expect(result.accidental).toBe('')
	})

	test('B natural 3 (MIDI 59) in key of Bb → needs natural sign', () => {
		const result = midiToStaffPosition(59, 'treble', [], ['B'])
		expect(result.name).toBe('B')
		expect(result.accidental).toBe('n')
	})

	test('C# (MIDI 61) in C major → sharp spelling with explicit #', () => {
		// C major has no sharps/flats, so C# defaults to sharp spelling
		const result = midiToStaffPosition(61, 'treble', [], [])
		expect(result.name).toBe('C')
		expect(result.accidental).toBe('#')
	})

	test('Bb (MIDI 58) in F major → flat spelling, no explicit accidental', () => {
		// F major has Bb in key sig
		const result = midiToStaffPosition(58, 'treble', [], ['B'])
		expect(result.name).toBe('B')
		expect(result.accidental).toBe('')
	})

	test('Eb (MIDI 63) in Eb major → no explicit accidental', () => {
		const result = midiToStaffPosition(63, 'treble', [], ['B', 'E', 'A'])
		expect(result.name).toBe('E')
		expect(result.accidental).toBe('')
	})

	test('Ab (MIDI 68) in Eb major → no explicit accidental (Ab in key sig)', () => {
		// Eb major has B, E, A flats — Ab IS in the key sig
		const result = midiToStaffPosition(68, 'treble', [], ['B', 'E', 'A'])
		expect(result.name).toBe('A')
		expect(result.accidental).toBe('')
	})

	test('Gb (MIDI 66) in Eb major → flat spelling with explicit b', () => {
		// Eb major has B, E, A flats — Gb is NOT in the key sig
		const result = midiToStaffPosition(66, 'treble', [], ['B', 'E', 'A'])
		expect(result.name).toBe('G')
		expect(result.accidental).toBe('b')
	})

	test('F# (MIDI 66) in D major → no explicit accidental', () => {
		const result = midiToStaffPosition(66, 'treble', ['F', 'C'], [])
		expect(result.name).toBe('F')
		expect(result.accidental).toBe('')
	})

	test('G# (MIDI 68) in D major → sharp spelling with explicit #', () => {
		// D major has F#, C# — G# not in key sig
		const result = midiToStaffPosition(68, 'treble', ['F', 'C'], [])
		expect(result.name).toBe('G')
		expect(result.accidental).toBe('#')
	})

	test('round-trip: position + clefOffset gives correct diatonic pitch', () => {
		// For every MIDI note 36-96, verify the position round-trips
		const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
		for (let midi = 36; midi <= 96; midi++) {
			const result = midiToStaffPosition(midi, 'treble', [], [])
			const pitch = result.position + 34  // treble offset
			const nameFromPitch = NOTES[((pitch % 7) + 7) % 7]
			const octaveFromPitch = pitch >= 0 ? Math.floor(pitch / 7) : -1 - Math.floor((-pitch - 1) / 7)
			expect(nameFromPitch).toBe(result.name)
			expect(octaveFromPitch).toBe(result.octave)
		}
	})
})

// ── fifthsToKeySig ─────────────────────────────────────────────────────────

describe('fifthsToKeySig', () => {
	test('0 → C major', () => {
		const ks = fifthsToKeySig(0)
		expect(ks.key).toBe('C')
		expect(ks.sharps).toEqual([])
		expect(ks.flats).toEqual([])
	})

	test('1 → G major (one sharp: F)', () => {
		const ks = fifthsToKeySig(1)
		expect(ks.key).toBe('G')
		expect(ks.sharps).toEqual(['F'])
	})

	test('3 → A major (F, C, G)', () => {
		const ks = fifthsToKeySig(3)
		expect(ks.key).toBe('A')
		expect(ks.sharps).toEqual(['F', 'C', 'G'])
	})

	test('-1 → F major (one flat: B)', () => {
		const ks = fifthsToKeySig(-1)
		expect(ks.key).toBe('F')
		expect(ks.flats).toEqual(['B'])
	})

	test('-3 → Eb major (B, E, A)', () => {
		const ks = fifthsToKeySig(-3)
		expect(ks.key).toBe('Eb')
		expect(ks.flats).toEqual(['B', 'E', 'A'])
	})
})

// ── splitAtBarlines ────────────────────────────────────────────────────────

describe('splitAtBarlines', () => {
	const ticksPerMeasure = 1920  // 4/4 at ppq=480

	test('note within one measure → no split', () => {
		const segments = splitAtBarlines(0, 480, { ticksPerMeasure }, null)
		expect(segments).toHaveLength(1)
		expect(segments[0].tieStart).toBe(0)
		expect(segments[0].tieEnd).toBe(0)
		expect(segments[0].durationTicks).toBe(480)
	})

	test('note spanning barline → two segments with tie', () => {
		// Starts at beat 3 (tick 960), lasts a whole note (1920 ticks)
		const segments = splitAtBarlines(960, 960 + 1920, { ticksPerMeasure }, null)
		expect(segments).toHaveLength(2)

		// First segment: tick 960 → 1920 (end of measure 0)
		expect(segments[0].startTick).toBe(960)
		expect(segments[0].durationTicks).toBe(960)
		expect(segments[0].tieStart).toBe(1)
		expect(segments[0].tieEnd).toBe(0)

		// Second segment: tick 1920 → 2880
		expect(segments[1].startTick).toBe(1920)
		expect(segments[1].durationTicks).toBe(960)
		expect(segments[1].tieStart).toBe(0)
		expect(segments[1].tieEnd).toBe(1)
	})

	test('note spanning two barlines → three segments', () => {
		// Starts mid-measure, lasts 3 measures worth
		const start = 480
		const end = start + 3 * 1920
		const segments = splitAtBarlines(start, end, { ticksPerMeasure }, null)
		expect(segments).toHaveLength(4)

		// First: partial measure
		expect(segments[0].tieStart).toBe(1)
		expect(segments[0].tieEnd).toBe(0)

		// Middle: full measures
		expect(segments[1].tieStart).toBe(1)
		expect(segments[1].tieEnd).toBe(1)

		// Last: partial measure
		expect(segments[segments.length - 1].tieStart).toBe(0)
		expect(segments[segments.length - 1].tieEnd).toBe(1)
	})
})

// ── groupSimultaneousNotes ─────────────────────────────────────────────────

describe('groupSimultaneousNotes', () => {
	test('single notes at different ticks → one per group', () => {
		const notes = [
			{ startTick: 0, midiNote: 60 },
			{ startTick: 480, midiNote: 64 },
			{ startTick: 960, midiNote: 67 },
		]
		const groups = groupSimultaneousNotes(notes)
		expect(groups).toHaveLength(3)
		expect(groups[0].notes).toHaveLength(1)
	})

	test('three notes at same tick → one chord group', () => {
		const notes = [
			{ startTick: 0, midiNote: 60 },
			{ startTick: 0, midiNote: 64 },
			{ startTick: 0, midiNote: 67 },
		]
		const groups = groupSimultaneousNotes(notes)
		expect(groups).toHaveLength(1)
		expect(groups[0].notes).toHaveLength(3)
	})

	test('mixed single and chord → correct grouping', () => {
		const notes = [
			{ startTick: 0, midiNote: 60 },
			{ startTick: 480, midiNote: 64 },
			{ startTick: 480, midiNote: 67 },
			{ startTick: 960, midiNote: 72 },
		]
		const groups = groupSimultaneousNotes(notes)
		expect(groups).toHaveLength(3)
		expect(groups[0].notes).toHaveLength(1)
		expect(groups[1].notes).toHaveLength(2)
		expect(groups[2].notes).toHaveLength(1)
	})
})

// ── applyBeaming ───────────────────────────────────────────────────────────

describe('applyBeaming', () => {
	test('two consecutive 8th notes on same beat → beamed', () => {
		const tokens = [
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 0 },
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 240 },
		]
		applyBeaming(tokens, 480, 4, 4)
		expect(tokens[0].beam).toBe(1)  // first
		expect(tokens[1].beam).toBe(3)  // end
	})

	test('three 8th notes on same beat → first/middle/end', () => {
		const tokens = [
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 0 },
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 240 },
			{ type: 'Note', duration: 16, beam: 0, _quantizedTick: 360 },  // 16th note, same beat
		]
		applyBeaming(tokens, 480, 4, 4)
		expect(tokens[0].beam).toBe(1)
		expect(tokens[1].beam).toBe(2)
		expect(tokens[2].beam).toBe(3)
	})

	test('quarter notes are NOT beamed', () => {
		const tokens = [
			{ type: 'Note', duration: 4, beam: 0, _quantizedTick: 0 },
			{ type: 'Note', duration: 4, beam: 0, _quantizedTick: 480 },
		]
		applyBeaming(tokens, 480, 4, 4)
		expect(tokens[0].beam).toBe(0)
		expect(tokens[1].beam).toBe(0)
	})

	test('8th notes across beat boundary → separate beam groups', () => {
		const tokens = [
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 0 },
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 240 },
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 480 },
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 720 },
		]
		applyBeaming(tokens, 480, 4, 4)
		// Beat 0: tokens[0] and [1]
		expect(tokens[0].beam).toBe(1)
		expect(tokens[1].beam).toBe(3)
		// Beat 1: tokens[2] and [3]
		expect(tokens[2].beam).toBe(1)
		expect(tokens[3].beam).toBe(3)
	})

	test('single 8th note → not beamed (needs 2+ in group)', () => {
		const tokens = [
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 0 },
			{ type: 'Rest', duration: 8, _quantizedTick: 240 },
			{ type: 'Note', duration: 8, beam: 0, _quantizedTick: 480 },
		]
		applyBeaming(tokens, 480, 4, 4)
		expect(tokens[0].beam).toBe(0)
		expect(tokens[2].beam).toBe(0)
	})
})

// ── generateRests / ticksToRests ───────────────────────────────────────────

describe('generateRests', () => {
	const ppq = 480
	const table = buildDurationTable(ppq)

	test('gap of one quarter note → one quarter rest', () => {
		const groups = [{ startTick: 480, endTick: 960 }]
		const rests = generateRests(groups, 960, table, ppq)
		expect(rests).toHaveLength(1)
		expect(rests[0].type).toBe('Rest')
		expect(rests[0].duration).toBe(4)
		expect(rests[0].dots).toBe(0)
	})

	test('gap of one whole note → one whole rest', () => {
		const groups = [{ startTick: 1920, endTick: 2400 }]
		const rests = generateRests(groups, 2400, table, ppq)
		expect(rests).toHaveLength(1)
		expect(rests[0].duration).toBe(1)
	})

	test('no gap → no rests', () => {
		const groups = [{ startTick: 0, endTick: 480 }]
		const rests = generateRests(groups, 480, table, ppq)
		expect(rests).toHaveLength(0)
	})

	test('gap of 3 quarter notes → multiple rests', () => {
		// 3 quarter notes = 1440 ticks.  Should produce dotted half (1440 ticks)
		const groups = [{ startTick: 1440, endTick: 1920 }]
		const rests = generateRests(groups, 1920, table, ppq)
		const totalTicks = rests.reduce((sum, r) => {
			const cand = table.find(c => c.duration === r.duration && c.dots === r.dots && !c.triplet)
			return sum + (cand ? cand.ticks : 0)
		}, 0)
		// Should fill the 1440 tick gap
		expect(totalTicks).toBeCloseTo(1440, -1)
	})
})

describe('ticksToRests', () => {
	const ppq = 480
	const table = buildDurationTable(ppq)

	test('480 ticks → quarter rest', () => {
		const rests = ticksToRests(0, 480, table, ppq)
		expect(rests).toHaveLength(1)
		expect(rests[0].duration).toBe(4)
	})

	test('240 ticks → eighth rest', () => {
		const rests = ticksToRests(0, 240, table, ppq)
		expect(rests).toHaveLength(1)
		expect(rests[0].duration).toBe(8)
	})

	test('720 ticks → dotted quarter rest', () => {
		const rests = ticksToRests(0, 720, table, ppq)
		expect(rests).toHaveLength(1)
		expect(rests[0].duration).toBe(4)
		expect(rests[0].dots).toBe(1)
	})
})

// ── buildStaffTokens ───────────────────────────────────────────────────────

describe('buildStaffTokens', () => {
	const ppq = 480
	const table = buildDurationTable(ppq)

	test('produces initial Clef, KeySignature, TimeSignature, Tempo tokens', () => {
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		expect(tokens[0].type).toBe('Clef')
		expect(tokens[0].clef).toBe('treble')
		expect(tokens[1].type).toBe('KeySignature')
		expect(tokens[1].key).toBe('C')
		expect(tokens[2].type).toBe('TimeSignature')
		expect(tokens[2].group).toBe(4)
		expect(tokens[2].beat).toBe(4)
		expect(tokens[3].type).toBe('Tempo')
		expect(tokens[3].duration).toBe(120)
	})

	test('single quarter note at tick 0 → one Note token', () => {
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		const noteTokens = tokens.filter(t => t.type === 'Note')
		expect(noteTokens.length).toBeGreaterThanOrEqual(1)
		expect(noteTokens[0].duration).toBe(4)
		expect(noteTokens[0].dots).toBe(0)
	})

	test('two simultaneous notes → Chord token', () => {
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
			{ midiNote: 64, startTick: 0, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		const chordTokens = tokens.filter(t => t.type === 'Chord')
		expect(chordTokens.length).toBeGreaterThanOrEqual(1)
		expect(chordTokens[0].notes).toHaveLength(2)
	})

	test('gap between notes produces Rest tokens', () => {
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
			{ midiNote: 64, startTick: 960, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		const restTokens = tokens.filter(t => t.type === 'Rest')
		expect(restTokens.length).toBeGreaterThanOrEqual(1)
	})

	test('barlines are inserted at measure boundaries', () => {
		// Two measures of notes
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
			{ midiNote: 64, startTick: 1920, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 3840
		)

		const barlines = tokens.filter(t => t.type === 'Barline')
		expect(barlines.length).toBeGreaterThanOrEqual(1)
	})

	test('no _quantizedTick remains on output tokens', () => {
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		for (const tok of tokens) {
			expect(tok._quantizedTick).toBeUndefined()
		}
	})
})

// ── isMidiFile ─────────────────────────────────────────────────────────────

describe('isMidiFile', () => {
	test('MThd header → true', () => {
		const buf = new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06]).buffer
		expect(isMidiFile(buf)).toBe(true)
	})

	test('[NWZ] header → false', () => {
		const buf = new Uint8Array([0x5B, 0x4E, 0x57, 0x5A]).buffer
		expect(isMidiFile(buf)).toBe(false)
	})

	test('[Note header → false', () => {
		const buf = new Uint8Array([0x5B, 0x4E, 0x6F, 0x74]).buffer
		expect(isMidiFile(buf)).toBe(false)
	})

	test('empty buffer → false', () => {
		expect(isMidiFile(new ArrayBuffer(0))).toBe(false)
	})

	test('null → false', () => {
		expect(isMidiFile(null)).toBe(false)
	})

	test('3 bytes → false (too short)', () => {
		const buf = new Uint8Array([0x4D, 0x54, 0x68]).buffer
		expect(isMidiFile(buf)).toBe(false)
	})
})

// ── Integration-style: round-trip plausibility ─────────────────────────────

describe('round-trip plausibility', () => {
	const ppq = 480
	const table = buildDurationTable(ppq)

	test('C major scale → 8 notes, correct positions', () => {
		// C4, D4, E4, F4, G4, A4, B4, C5  (MIDI 60-72)
		const scale = [60, 62, 64, 65, 67, 69, 71, 72]
		const notes = scale.map((midi, i) => ({
			midiNote: midi,
			startTick: i * 480,
			durationTick: 480,
			velocity: 80,
		}))

		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 8 * 480
		)

		const noteTokens = tokens.filter(t => t.type === 'Note')
		expect(noteTokens.length).toBe(8)

		// All should be quarter notes
		for (const nt of noteTokens) {
			expect(nt.duration).toBe(4)
			expect(nt.dots).toBe(0)
		}

		// No accidentals in C major
		for (const nt of noteTokens) {
			expect(nt.accidental === '' || nt.accidental === undefined).toBe(true)
		}
	})

	test('triad chord → Chord token with 3 child notes', () => {
		// C major triad: C4, E4, G4
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 1920, velocity: 80 },
			{ midiNote: 64, startTick: 0, durationTick: 1920, velocity: 80 },
			{ midiNote: 67, startTick: 0, durationTick: 1920, velocity: 80 },
		]

		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		const chords = tokens.filter(t => t.type === 'Chord')
		expect(chords.length).toBe(1)
		expect(chords[0].notes).toHaveLength(3)
		expect(chords[0].duration).toBe(1)  // whole note
	})

	test('all token types have required properties for interpreter', () => {
		const notes = [
			{ midiNote: 60, startTick: 0, durationTick: 480, velocity: 80 },
			{ midiNote: 64, startTick: 480, durationTick: 480, velocity: 80 },
		]
		const tokens = buildStaffTokens(
			notes, 'treble', { key: 'C', sharps: [], flats: [] },
			[{ tick: 0, numerator: 4, denominator: 4 }],
			[{ tick: 0, bpm: 120 }],
			ppq, table, 1920
		)

		for (const tok of tokens) {
			expect(tok.type).toBeDefined()

			if (tok.type === 'Note') {
				expect(tok.position).toBeDefined()
				expect(tok.duration).toBeDefined()
				expect(tok.dots).toBeDefined()
				expect(tok.tie).toBeDefined()
				expect(tok.tieEnd).toBeDefined()
				expect(tok.beam).toBeDefined()
				expect(tok.stem).toBeDefined()
			}

			if (tok.type === 'Chord') {
				expect(tok.notes).toBeDefined()
				expect(Array.isArray(tok.notes)).toBe(true)
				expect(tok.duration).toBeDefined()
			}

			if (tok.type === 'Rest') {
				expect(tok.duration).toBeDefined()
				expect(tok.position).toBeDefined()
			}

			if (tok.type === 'Clef') {
				expect(tok.clef).toBeDefined()
			}

			if (tok.type === 'KeySignature') {
				expect(tok.key).toBeDefined()
			}

			if (tok.type === 'TimeSignature') {
				expect(tok.group).toBeDefined()
				expect(tok.beat).toBeDefined()
			}
		}
	})

	test('MIDI round-trip: position + accidental → interpreter → toMidi recovers original', () => {
		// Full pipeline: MIDI note → midiToStaffPosition → position + accidental →
		// interpreter resolves name/octave/accidentalValue → toMidi() = original MIDI
		const SEMITONE_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
		const ACC_DELTA = { '#': 1, b: -1, n: 0, x: 2, v: -2 }
		const NOTES_7 = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

		function simulateInterpreter(position, accidental, clefOffset, keySigFlats) {
			// Simulate what the interpreter does: pitch = position + offset
			const pitch = position + clefOffset
			const name = NOTES_7[((pitch % 7) + 7) % 7]
			const octave = pitch >= 0 ? Math.floor(pitch / 7) : -1 - Math.floor((-pitch - 1) / 7)
			// Resolve accidental: explicit > key sig
			let resolvedAcc = accidental
			if (!resolvedAcc) {
				if (keySigFlats.includes(name)) resolvedAcc = 'b'
			}
			return { name, octave, accidentalValue: resolvedAcc || undefined }
		}

		function toMidi(name, octave, accidentalValue) {
			return 12 * (octave + 1) + (SEMITONE_MAP[name] ?? 0) + (ACC_DELTA[accidentalValue] ?? 0)
		}

		// Test C major (sharp spelling, no key sig accidentals)
		for (let midi = 21; midi <= 108; midi++) {
			const result = midiToStaffPosition(midi, 'treble', [], [])
			const interp = simulateInterpreter(result.position, result.accidental, 34, [])
			const recovered = toMidi(interp.name, interp.octave, interp.accidentalValue)
			expect(recovered).toBe(midi)
		}

		// Test Eb major (flat spelling)
		const ebFlats = ['B', 'E', 'A']
		for (let midi = 21; midi <= 108; midi++) {
			const result = midiToStaffPosition(midi, 'treble', [], ebFlats)
			const interp = simulateInterpreter(result.position, result.accidental, 34, ebFlats)
			const recovered = toMidi(interp.name, interp.octave, interp.accidentalValue)
			expect(recovered).toBe(midi)
		}

		// Test D major (sharp spelling with F#, C#)
		const dSharps = ['F', 'C']
		for (let midi = 21; midi <= 108; midi++) {
			const result = midiToStaffPosition(midi, 'treble', dSharps, [])
			// For sharp key sig resolution: interpreter applies '#' to notes in keySigSharps
			const pitch = result.position + 34
			const name = NOTES_7[((pitch % 7) + 7) % 7]
			const octave = pitch >= 0 ? Math.floor(pitch / 7) : -1 - Math.floor((-pitch - 1) / 7)
			let resolvedAcc = result.accidental
			if (!resolvedAcc && dSharps.includes(name)) resolvedAcc = '#'
			const recovered = toMidi(name, octave, resolvedAcc || undefined)
			expect(recovered).toBe(midi)
		}
	})
})
