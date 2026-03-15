/**
 * Synthetic visual test fixtures.
 *
 * Each fixture builds score data objects directly — no NWC file parsing
 * involved.  This isolates individual rendering features so regressions
 * can be pinpointed visually.
 *
 * Token shapes match what interpret() + score() expect.
 */

// ── Builder helpers ────────────────────────────────────────────────

function makeStaff(tokens, opts = {}) {
	return {
		tokens,
		lyrics: opts.lyrics || [],
		bracketWithNext: opts.bracketWithNext || false,
		braceWithNext: opts.braceWithNext || false,
		connectBarsWithNext: opts.connectBarsWithNext || false,
		layerWithNext: opts.layerWithNext || false,
		boundaryTop: opts.boundaryTop || 0,
		boundaryBottom: opts.boundaryBottom || 0,
		lines: 5,
		endingBar: opts.endingBar || 0,
	}
}

function makeScore(title, staves, opts = {}) {
	return {
		header: { version: '2.75' },
		info: { title, author: opts.author || '' },
		score: {
			allowLayering: opts.allowLayering || false,
			staves: staves.map(s => Array.isArray(s) ? makeStaff(s) : s),
		},
	}
}

// Token shorthand factories
function clef(c = 'treble') {
	return { type: 'Clef', clef: c, octave: 0 }
}

function keySig(k = 'C') {
	// Map key names to accidental arrays for the KeySignature drawing class
	const KEY_ACCIDENTALS = {
		'C': [],
		'G': ['f#'],
		'D': ['f#', 'c#'],
		'A': ['f#', 'c#', 'g#'],
		'E': ['f#', 'c#', 'g#', 'd#'],
		'B': ['f#', 'c#', 'g#', 'd#', 'a#'],
		'F#': ['f#', 'c#', 'g#', 'd#', 'a#', 'e#'],
		'C#': ['f#', 'c#', 'g#', 'd#', 'a#', 'e#', 'b#'],
		'F': ['Bb'],
		'Bb': ['Bb', 'Eb'],
		'Eb': ['Bb', 'Eb', 'Ab'],
		'Ab': ['Bb', 'Eb', 'Ab', 'Db'],
		'Db': ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
		'Gb': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
		'Cb': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
	}
	return { type: 'KeySignature', key: k, accidentals: KEY_ACCIDENTALS[k] || [] }
}

function timeSig(sig = '4/4') {
	const parts = sig.split('/')
	return {
		type: 'TimeSignature',
		signature: sig,
		group: parseInt(parts[0]) || 4,
		beat: parseInt(parts[1]) || 4,
	}
}

function note(pos, dur = 4, opts = {}) {
	return {
		type: 'Note',
		position: pos,
		duration: dur,
		dots: opts.dots || 0,
		stem: opts.stem || 0,
		tie: opts.tie || 0,
		tieEnd: opts.tieEnd || 0,
		slur: opts.slur || 0,
		beam: opts.beam || 0,
		accidental: opts.accidental || '',
		triplet: opts.triplet || 0,
		staccato: opts.staccato || 0,
		accent: opts.accent || 0,
		tenuto: opts.tenuto || 0,
		marcato: opts.marcato || 0,
		staccatissimo: opts.staccatissimo || 0,
		fermata: opts.fermata || 0,
		grace: opts.grace || 0,
		lyricSyllable: opts.lyricSyllable || 0,
	}
}

function rest(dur = 4, opts = {}) {
	return {
		type: 'Rest',
		position: 0,
		duration: dur,
		dots: opts.dots || 0,
		triplet: opts.triplet || 0,
	}
}

function chord(positions, dur = 4, opts = {}) {
	return {
		type: 'Chord',
		duration: dur,
		dots: opts.dots || 0,
		stem: opts.stem || 0,
		tie: opts.tie || 0,
		tieEnd: opts.tieEnd || 0,
		slur: opts.slur || 0,
		beam: opts.beam || 0,
		triplet: opts.triplet || 0,
		staccato: opts.staccato || 0,
		accent: opts.accent || 0,
		tenuto: opts.tenuto || 0,
		marcato: opts.marcato || 0,
		staccatissimo: opts.staccatissimo || 0,
		fermata: opts.fermata || 0,
		grace: opts.grace || 0,
		lyricSyllable: opts.lyricSyllable || 0,
		notes: positions.map((p, i) => {
			const noteOpts = opts.noteOpts?.[i] || {}
			return {
				position: typeof p === 'number' ? p : p.pos,
				duration: dur,
				accidental: (typeof p === 'object' ? p.acc : null) || noteOpts.accidental || '',
				tie: noteOpts.tie || 0,
				tieEnd: noteOpts.tieEnd || 0,
				dots: 0,
				stem: opts.stem || 0,
				beam: opts.beam || 0,
				slur: 0,
				staccato: 0,
				accent: 0,
				tenuto: 0,
				grace: 0,
			}
		}),
	}
}

function bar(style = 0) {
	return { type: 'Barline', barline: style, systemBreak: false }
}

function dynamic(d, pos = -13) {
	return { type: 'Dynamic', position: pos, dynamic: d }
}

function tempo(bpm, pos = 11) {
	return { type: 'Tempo', position: pos, duration: bpm }
}

function dynVariance(style, pos = -13) {
	return { type: 'DynamicVariance', position: pos, style }
}

function tempoVariance(style, pos = 11) {
	return { type: 'TempoVariance', position: pos, style }
}

function flow(style, pos = 11) {
	return { type: 'Flow', position: pos, style }
}

function ending(repeat, style = 0) {
	return { type: 'Ending', repeat, style }
}

// ── Fixture definitions ────────────────────────────────────────────

const SYNTHETIC_FIXTURES = [
	// ────────────────────────────────────────────────────────────
	{
		category: 'Notes & Rests',
		tests: [
			{
				label: 'Note Durations',
				desc: 'Whole, half, quarter, 8th, 16th, 32nd',
				data: () => makeScore('Note Durations', [[
					clef(), keySig(), timeSig(),
					note(0, 1), bar(),
					note(0, 2), note(0, 2), bar(),
					note(0, 4), note(1, 4), note(2, 4), note(3, 4), bar(),
					note(0, 8), note(1, 8), note(2, 8), note(3, 8), note(4, 8), note(5, 8), note(6, 8), note(7, 8), bar(),
					note(0, 16), note(1, 16), note(2, 16), note(3, 16), bar(),
					note(0, 32), note(1, 32), note(2, 32), note(3, 32),
					bar(3),
				]]),
			},
			{
				label: 'Dotted Notes',
				desc: 'Dotted quarter, dotted half, double-dotted',
				data: () => makeScore('Dotted Notes', [[
					clef(), keySig(), timeSig(),
					note(0, 2, { dots: 1 }), note(2, 4), bar(),
					note(0, 4, { dots: 1 }), note(2, 8), note(0, 4, { dots: 1 }), note(-2, 8), bar(),
					note(0, 4, { dots: 2 }), note(2, 16), note(3, 8),
					bar(3),
				]]),
			},
			{
				label: 'Rest Durations',
				desc: 'Whole, half, quarter, 8th, 16th rests',
				data: () => makeScore('Rest Durations', [[
					clef(), keySig(), timeSig(),
					rest(1), bar(),
					rest(2), rest(2), bar(),
					rest(4), rest(4), rest(4), rest(4), bar(),
					rest(8), rest(8), rest(8), rest(8), rest(4), rest(4), bar(),
					rest(16), rest(16), rest(16), rest(16), rest(4), rest(4), rest(4),
					bar(3),
				]]),
			},
			{
				label: 'Stem Directions',
				desc: 'Stems up, stems down, auto (position-based)',
				data: () => makeScore('Stem Directions', [[
					clef(), keySig(), timeSig(),
					note(-4, 4, { stem: 1 }), note(-2, 4, { stem: 1 }), note(0, 4, { stem: 1 }), note(2, 4, { stem: 1 }), bar(),
					note(-4, 4, { stem: 2 }), note(-2, 4, { stem: 2 }), note(0, 4, { stem: 2 }), note(2, 4, { stem: 2 }), bar(),
					note(4, 4), note(2, 4), note(0, 4), note(-2, 4), note(-4, 4), note(-6, 4),
					bar(3),
				]]),
			},
			{
				label: 'Accidentals',
				desc: 'Sharp, flat, natural on various positions',
				data: () => makeScore('Accidentals', [[
					clef(), keySig(),  timeSig(),
					note(0, 4, { accidental: '#' }), note(1, 4, { accidental: 'b' }),
					note(2, 4, { accidental: 'n' }), note(3, 4), bar(),
					note(-3, 4, { accidental: '#' }), note(-1, 4, { accidental: 'b' }),
					note(5, 4, { accidental: '#' }), note(7, 4, { accidental: 'b' }),
					bar(3),
				]]),
			},
			{
				label: 'Ledger Lines — Below',
				desc: 'Notes stepping below staff: spaces and lines',
				data: () => makeScore('Ledger Lines — Below', [[
					clef(), keySig(), timeSig(),
					note(0, 4),   // bottom staff line (no ledger)
					note(-1, 4),  // first space below (no ledger)
					note(-2, 4),  // first ledger line below
					note(-3, 4),  // space below first ledger
					bar(),
					note(-4, 4),  // second ledger line below
					note(-6, 4),  // third ledger line
					note(-8, 4),  // fourth ledger line
					note(-10, 4), // fifth ledger line
					bar(3),
				]]),
			},
			{
				label: 'Ledger Lines — Above',
				desc: 'Notes stepping above staff: spaces and lines',
				data: () => makeScore('Ledger Lines — Above', [[
					clef(), keySig(), timeSig(),
					note(4, 4),   // top staff line (no ledger)
					note(5, 4),   // first space above (no ledger)
					note(6, 4),   // first ledger line above
					note(7, 4),   // space above first ledger
					bar(),
					note(8, 4),   // second ledger line above
					note(10, 4),  // third ledger line
					note(12, 4),  // fourth ledger line
					note(14, 4),  // fifth ledger line
					bar(3),
				]]),
			},
			{
				label: 'Ledger Lines — Whole Notes',
				desc: 'Wider noteheads get proportionally wider ledger lines',
				data: () => makeScore('Ledger Lines — Whole Notes', [[
					clef(), keySig(), timeSig(),
					note(-4, 1),  // whole note below staff
					bar(),
					note(8, 1),   // whole note above staff
					bar(3),
				]]),
			},
			{
				label: 'Ledger Lines — Chords',
				desc: 'Chord ledger lines cover full range without duplication',
				data: () => makeScore('Ledger Lines — Chords', [[
					clef(), keySig(), timeSig(),
					chord([-6, -4, -2], 4), bar(),  // chord spanning 3 ledger lines below
					chord([6, 8, 10], 4), bar(),     // chord spanning 3 ledger lines above
					chord([-4, 0, 8], 2),             // chord crossing both sides
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Beams',
		tests: [
			{
				label: 'Simple 8th Beams',
				desc: 'Pairs and groups of beamed 8ths',
				data: () => makeScore('Simple Beams', [[
					clef(), keySig(), timeSig(),
					note(0, 8, { beam: 1 }), note(1, 8, { beam: 3 }),
					note(2, 8, { beam: 1 }), note(3, 8, { beam: 3 }), bar(),
					note(0, 8, { beam: 1 }), note(1, 8, { beam: 2 }), note(2, 8, { beam: 2 }), note(3, 8, { beam: 3 }),
					note(4, 4), note(2, 4),
					bar(3),
				]]),
			},
			{
				label: '16th Beams',
				desc: 'Groups of 16th notes with double beams',
				data: () => makeScore('16th Beams', [[
					clef(), keySig(), timeSig(),
					note(0, 16, { beam: 1 }), note(1, 16, { beam: 2 }), note(2, 16, { beam: 2 }), note(3, 16, { beam: 3 }),
					note(4, 16, { beam: 1 }), note(3, 16, { beam: 2 }), note(2, 16, { beam: 2 }), note(1, 16, { beam: 3 }),
					note(0, 4), note(0, 4),
					bar(3),
				]]),
			},
			{
				label: '32nd Beams',
				desc: 'Groups of 32nd notes with triple beams — verifies beam thickness and spacing',
				data: () => makeScore('32nd Beams', [[
					clef(), keySig(), timeSig(),
					note(0, 32, { beam: 1 }), note(1, 32, { beam: 2 }), note(2, 32, { beam: 2 }), note(3, 32, { beam: 3 }),
					note(4, 32, { beam: 1 }), note(3, 32, { beam: 2 }), note(2, 32, { beam: 2 }), note(1, 32, { beam: 3 }),
					bar(3),
				]]),
			},
			{
				label: 'Wide Interval Beam',
				desc: 'D4→G5 — tests slope clamping (max 1 staff space)',
				data: () => makeScore('Wide Interval Beam', [[
					clef(), keySig(), timeSig(),
					note(-2, 8, { beam: 1, stem: 1 }), note(6, 8, { beam: 3, stem: 1 }), // D4 → G5
					note(6, 8, { beam: 1, stem: 2 }), note(-2, 8, { beam: 3, stem: 2 }), // G5 → D4
					note(-4, 4, { stem: 1 }), note(8, 4, { stem: 2 }),
					bar(3),
				]]),
			},
			{
				label: 'Non-Monotonic Beam',
				desc: 'Up-down-up pattern — should produce horizontal beam',
				data: () => makeScore('Non-Monotonic Beam', [[
					clef(), keySig(), timeSig(),
					note(0, 8, { beam: 1 }), note(4, 8, { beam: 2 }), note(-2, 8, { beam: 2 }), note(3, 8, { beam: 3 }),
					note(5, 8, { beam: 1 }), note(0, 8, { beam: 2 }), note(6, 8, { beam: 2 }), note(1, 8, { beam: 3 }),
					bar(3),
				]]),
			},
			{
				label: 'Triplet Beams',
				desc: 'Beamed triplets with bracket numeral',
				data: () => makeScore('Triplet Beams', [[
					clef(), keySig(), timeSig(),
					note(0, 8, { beam: 1, triplet: 1 }), note(1, 8, { beam: 2, triplet: 2 }),
					note(2, 8, { beam: 3, triplet: 3 }),
					note(3, 8, { beam: 1, triplet: 1 }), note(4, 8, { beam: 2, triplet: 2 }),
					note(5, 8, { beam: 3, triplet: 3 }),
					note(0, 4), note(2, 4),
					bar(3),
				]]),
			},
			{
				label: 'Triplet Beams — Stem Down',
				desc: 'Beamed triplets, stems down — numeral below beam',
				data: () => makeScore('Triplet Beams Stem Down', [[
					clef(), keySig(), timeSig(),
					note(0, 8, { beam: 1, triplet: 1, stem: 2 }), note(1, 8, { beam: 2, triplet: 2, stem: 2 }),
					note(2, 8, { beam: 3, triplet: 3, stem: 2 }),
					note(3, 8, { beam: 1, triplet: 1, stem: 2 }), note(4, 8, { beam: 2, triplet: 2, stem: 2 }),
					note(5, 8, { beam: 3, triplet: 3, stem: 2 }),
					note(0, 4), note(2, 4),
					bar(3),
				]]),
			},
			{
				label: 'Unbeamed Triplets',
				desc: 'Quarter-note triplets — bracket + numeral',
				data: () => makeScore('Unbeamed Triplets', [[
					clef(), keySig(), timeSig(),
					note(0, 4, { triplet: 1 }), note(2, 4, { triplet: 2 }), note(4, 4, { triplet: 3 }),
					note(-2, 4, { triplet: 1, stem: 2 }), note(0, 4, { triplet: 2, stem: 2 }), note(2, 4, { triplet: 3, stem: 2 }),
					bar(3),
				]]),
			},
			{
				label: 'Triplets with Rests',
				desc: 'Triplet group containing a rest — requires bracket',
				data: () => makeScore('Triplets with Rests', [[
					clef(), keySig(), timeSig(),
					note(0, 8, { triplet: 1 }), rest(8, { triplet: 2 }), note(2, 8, { triplet: 3 }),
					note(-2, 8, { triplet: 1, stem: 2 }), rest(8, { triplet: 2 }), note(0, 8, { triplet: 3, stem: 2 }),
					note(0, 4), note(0, 4),
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Ties',
		tests: [
			{
				label: 'Basic Ties',
				desc: 'Same-pitch ties at different durations',
				data: () => makeScore('Basic Ties', [[
					clef(), keySig(), timeSig(),
					note(0, 4, { tie: 1 }), note(0, 4, { tieEnd: 1 }), note(2, 4), note(2, 4), bar(),
					note(-2, 2, { tie: 1 }), note(-2, 2, { tieEnd: 1 }), bar(),
					note(4, 4, { tie: 1, stem: 2 }), note(4, 4, { tieEnd: 1, stem: 2 }), note(4, 2),
					bar(3),
				]]),
			},
			{
				label: 'Ties — High & Low',
				desc: 'Ties on notes above and below staff (ledger lines)',
				data: () => makeScore('Ties High/Low', [[
					clef(), keySig(), timeSig(),
					note(8, 2, { tie: 1 }), note(8, 2, { tieEnd: 1 }), bar(),
					note(-8, 2, { tie: 1 }), note(-8, 2, { tieEnd: 1 }),
					bar(3),
				]]),
			},
			{
				label: 'Chord Ties — Inner/Outer',
				desc: '2-note and 3-note chord ties, outer notes curve outward',
				data: () => makeScore('Chord Ties', [[
					clef(), keySig(), timeSig(),
					chord([0, 4], 2, { noteOpts: [{ tie: 1 }, { tie: 1 }] }),
					chord([0, 4], 2, { noteOpts: [{ tieEnd: 1 }, { tieEnd: 1 }] }), bar(),
					chord([-2, 2, 6], 2, { noteOpts: [{ tie: 1 }, { tie: 1 }, { tie: 1 }] }),
					chord([-2, 2, 6], 2, { noteOpts: [{ tieEnd: 1 }, { tieEnd: 1 }, { tieEnd: 1 }] }),
					bar(3),
				]]),
			},
			{
				label: 'Tie with Accidental',
				desc: 'Tie into a note with sharp — arc should clear accidental',
				data: () => makeScore('Tie + Accidental', [[
					clef(), keySig(), timeSig(),
					note(2, 4, { tie: 1 }), note(2, 4, { tieEnd: 1, accidental: '#' }),
					note(0, 4, { tie: 1 }), note(0, 4, { tieEnd: 1, accidental: 'b' }),
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Slurs',
		tests: [
			{
				label: 'Basic Slur',
				desc: 'Slur between two notes, same stem direction',
				data: () => makeScore('Basic Slur', [[
					clef(), keySig(), timeSig(),
					note(0, 4, { slur: 1, stem: 1 }), note(2, 4, { slur: 2, stem: 1 }),
					note(4, 4, { slur: 1, stem: 2 }), note(6, 4, { slur: 2, stem: 2 }),
					bar(3),
				]]),
			},
			{
				label: 'Mixed Stem Slur',
				desc: 'Slur between stems-up and stems-down — should go above',
				data: () => makeScore('Mixed Stem Slur', [[
					clef(), keySig(), timeSig(),
					note(-2, 4, { slur: 1, stem: 1 }), note(2, 4, { stem: 1 }),
					note(4, 4, { stem: 2 }), note(6, 4, { slur: 2, stem: 2 }),
					bar(3),
				]]),
			},
			{
				label: 'Slur Over High Middle Note',
				desc: 'D→G→F# — the G protrudes; arc must clear it',
				data: () => makeScore('Slur Clearance', [[
					clef(), keySig(), timeSig(),
					note(-2, 4, { slur: 1, stem: 1 }),  // D4
					note(6, 4, { stem: 1 }),              // G5 (high middle)
					note(5, 4, { slur: 2, stem: 1 }),    // F#5
					note(0, 4),
					bar(3),
				]]),
			},
			{
				label: 'Slur Over Low Middle Note',
				desc: 'High→Low→High — arc below must clear dip',
				data: () => makeScore('Slur Low Clearance', [[
					clef(), keySig(), timeSig(),
					note(4, 4, { slur: 1, stem: 2 }),   // high
					note(-4, 4, { stem: 2 }),             // low dip
					note(3, 4, { slur: 2, stem: 2 }),   // high
					note(0, 4),
					bar(3),
				]]),
			},
			{
				label: 'Long Slur',
				desc: '8 notes under one slur — tests arc flattening',
				data: () => makeScore('Long Slur', [[
					clef(), keySig(), timeSig(),
					note(0, 8, { slur: 1 }), note(1, 8), note(2, 8), note(3, 8),
					note(4, 8), note(3, 8), note(2, 8), note(1, 8, { slur: 2 }),
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Chords',
		tests: [
			{
				label: '2-Note Chords',
				desc: 'Thirds, fifths, octaves',
				data: () => makeScore('2-Note Chords', [[
					clef(), keySig(), timeSig(),
					chord([0, 2], 4), chord([0, 4], 4), chord([0, 7], 4), chord([0, 3], 4), bar(),
					chord([-2, 2], 2, { stem: 1 }), chord([-4, 4], 2, { stem: 2 }),
					bar(3),
				]]),
			},
			{
				label: '3 & 4-Note Chords',
				desc: 'Triads and seventh chords',
				data: () => makeScore('3-4 Note Chords', [[
					clef(), keySig(), timeSig(),
					chord([0, 2, 4], 4), chord([0, 3, 7], 4),
					chord([0, 2, 4, 6], 4), chord([-1, 2, 5, 7], 4),
					bar(3),
				]]),
			},
			{
				label: 'Wide-Spread Chords',
				desc: 'More than an octave apart — extreme spacing',
				data: () => makeScore('Wide Chords', [[
					clef(), keySig(), timeSig(),
					chord([-6, 6], 2), chord([-8, 8], 2), bar(),
					chord([-8, 0, 8], 2), chord([-6, -2, 4, 10], 2),
					bar(3),
				]]),
			},
			{
				label: 'Cluster Chords',
				desc: 'Seconds (adjacent notes) — noteheads should offset',
				data: () => makeScore('Cluster Chords', [[
					clef(), keySig(), timeSig(),
					chord([0, 1], 4), chord([0, 1, 2], 4),
					chord([-1, 0, 1], 4), chord([-1, 0, 1, 2], 4), bar(),
					chord([3, 4, 5, 6], 2), chord([-2, -1, 0, 1, 2], 2),
					bar(3),
				]]),
			},
			{
				label: 'Chords with Accidentals',
				desc: 'Sharps and flats on chord notes',
				data: () => makeScore('Chord Accidentals', [[
					clef(), keySig(), timeSig(),
					chord([{ pos: 0, acc: '#' }, 4], 4),
					chord([0, { pos: 4, acc: 'b' }], 4),
					chord([{ pos: -2, acc: '#' }, { pos: 2, acc: 'b' }, { pos: 6, acc: 'n' }], 4),
					note(0, 4),
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Clefs & Signatures',
		tests: [
			{
				label: 'Treble & Bass Clef',
				desc: 'Two staves: treble and bass',
				data: () => makeScore('Clefs', [
					[clef('treble'), keySig(), timeSig(), note(0, 4), note(2, 4), note(4, 4), note(6, 4), bar(3)],
					[clef('bass'), keySig(), timeSig(), note(0, 4), note(-2, 4), note(-4, 4), note(-6, 4), bar(3)],
				]),
			},
			{
				label: 'Key Signatures',
				desc: 'C, G, D, Bb, Eb, Ab',
				data: () => makeScore('Key Signatures', [[
					clef(), keySig('C'), timeSig(), note(0, 4), note(2, 4), bar(),
					keySig('G'), note(0, 4), note(2, 4), bar(),
					keySig('D'), note(0, 4), note(2, 4), bar(),
					keySig('Bb'), note(0, 4), note(2, 4), bar(),
					keySig('Eb'), note(0, 4), note(2, 4), bar(),
					keySig('Ab'), note(0, 4), note(2, 4),
					bar(3),
				]]),
			},
			{
				label: 'Time Signatures',
				desc: '4/4, 3/4, 6/8, 2/4, Common, AllaBreve',
				data: () => makeScore('Time Signatures', [[
					clef(), keySig(),
					timeSig('4/4'), note(0, 1), bar(),
					timeSig('3/4'), note(0, 2, { dots: 1 }), bar(),
					timeSig('6/8'), note(0, 4, { dots: 1 }), note(2, 4, { dots: 1 }), bar(),
					timeSig('2/4'), note(0, 2), bar(),
					timeSig('Common'), note(0, 1),
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Dynamics & Expressions',
		tests: [
			{
				label: 'Dynamic Markings',
				desc: 'pp, p, mp, mf, f, ff, fff — SMuFL glyphs',
				data: () => makeScore('Dynamics', [[
					clef(), keySig(), timeSig(),
					dynamic('pp'), note(0, 2), note(2, 2), bar(),
					dynamic('p'), note(0, 2), note(2, 2), bar(),
					dynamic('mp'), note(0, 2), note(2, 2), bar(),
					dynamic('mf'), note(0, 2), note(2, 2), bar(),
					dynamic('f'), note(0, 2), note(2, 2), bar(),
					dynamic('ff'), note(0, 2), note(2, 2), bar(),
					dynamic('fff'), note(0, 1),
					bar(3),
				]]),
			},
			{
				label: 'Hairpins — Basic',
				desc: 'Crescendo and decrescendo wedges with terminal dynamic',
				data: () => makeScore('Hairpins — Basic', [[
					clef(), keySig(), timeSig(),
					dynamic('p'), dynVariance(0), note(0, 4), note(1, 4), note(2, 4), note(3, 4), bar(), // cresc
					dynamic('f'), dynVariance(1), note(3, 4), note(2, 4), note(1, 4), note(0, 4), bar(), // decresc
					dynamic('p'), note(0, 1),
					bar(3),
				]]),
			},
			{
				label: 'Hairpins — Diminuendo',
				desc: 'Diminuendo (style 2) vs decrescendo (style 1)',
				data: () => makeScore('Hairpins — Dimin vs Decresc', [[
					clef(), keySig(), timeSig(),
					dynVariance(1), note(4, 4), note(3, 4), note(2, 4), note(1, 4), bar(), // decresc (style 1)
					dynVariance(2), note(4, 4), note(3, 4), note(2, 4), note(1, 4), bar(), // dimin (style 2)
					dynamic('pp'), note(0, 1),
					bar(3),
				]]),
			},
			{
				label: 'Hairpins — Swell',
				desc: 'Messa di voce: cresc followed immediately by decresc',
				data: () => makeScore('Hairpins — Swell', [[
					clef(), keySig(), timeSig(),
					dynamic('p'),
					dynVariance(0), note(0, 4), note(2, 4),
					dynVariance(1), note(4, 4), note(2, 4), bar(),
					dynamic('p'), note(0, 1),
					bar(3),
				]]),
			},
			{
				label: 'Hairpins — To Barline',
				desc: 'Hairpin ending at a barline with no following dynamic',
				data: () => makeScore('Hairpins — To Barline', [[
					clef(), keySig(), timeSig(),
					dynVariance(0), note(0, 4), note(1, 4), note(2, 4), note(3, 4), bar(),
					note(4, 4), note(3, 4), note(2, 4), note(1, 4), bar(),
					dynVariance(1), note(4, 4), note(3, 4), note(2, 4), note(1, 4), bar(),
					note(0, 1),
					bar(3),
				]]),
			},
			{
				label: 'Hairpins — Short',
				desc: 'Short hairpins over two notes (minimum legible span)',
				data: () => makeScore('Hairpins — Short', [[
					clef(), keySig(), timeSig(),
					dynVariance(0), note(0, 2), dynamic('f'), note(4, 2), bar(),
					dynVariance(1), note(4, 2), dynamic('p'), note(0, 2), bar(),
					dynVariance(0), note(0, 4), dynamic('mf'), note(2, 4), note(4, 4), note(2, 4),
					bar(3),
				]]),
			},
			{
				label: 'Tempo & Flow',
				desc: 'Tempo marking, fermata, D.C., Coda, Segno',
				data: () => makeScore('Tempo & Flow', [[
					clef(), keySig(), timeSig(),
					tempo(120), note(0, 4), note(2, 4), note(4, 4),
					tempoVariance(2), note(0, 4), bar(), // fermata
					flow(1), note(0, 4), note(2, 4), note(4, 4), note(0, 4), bar(), // segno
					flow(0), note(0, 1), bar(), // coda
					flow(4), note(0, 1), // D.C.
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Articulations & Grace Notes',
		tests: [
			{
				label: 'Articulations',
				desc: 'Staccato, accent, tenuto, marcato, fermata',
				data: () => makeScore('Articulations', [[
					clef(), keySig(), timeSig(),
					note(0, 4, { staccato: 1 }), note(2, 4, { accent: 1 }),
					note(4, 4, { tenuto: 1 }), note(0, 4, { marcato: 1 }), bar(),
					note(0, 4, { staccato: 1, stem: 2 }), note(-2, 4, { accent: 1, stem: 2 }),
					note(-4, 4, { tenuto: 1, stem: 2 }), note(0, 4, { fermata: 1 }),
					bar(3),
				]]),
			},
		{
			label: 'Stacked Articulations',
			desc: 'Multiple articulations on one note',
			data: () => makeScore('Stacked Articulations', [[
				clef(), keySig(), timeSig(),
				note(0, 4, { staccato: 1, accent: 1 }),
				note(2, 4, { staccato: 1, tenuto: 1 }),
				note(4, 4, { accent: 1, fermata: 1 }),
				note(0, 2),
				bar(3),
			]]),
		},
		{
			label: 'Beamed Articulations',
			desc: 'Beamed 8ths with articulations — stems up and stems down',
			data: () => makeScore('Beamed Articulations', [[
				clef(), keySig(), timeSig(),
				// Stems up: staccato pair
				note(0, 8, { staccato: 1, stem: 1, beam: 1 }),
				note(2, 8, { staccato: 1, stem: 1, beam: 3 }),
				// Stems up: accent + tenuto
				note(-2, 8, { accent: 1, stem: 1, beam: 1 }),
				note(0, 8, { tenuto: 1, stem: 1, beam: 3 }),
				// Stems down: staccato pair
				note(2, 8, { staccato: 1, stem: 2, beam: 1 }),
				note(0, 8, { staccato: 1, stem: 2, beam: 3 }),
				// Stems down: marcato group
				note(4, 8, { marcato: 1, stem: 2, beam: 1 }),
				note(2, 8, { marcato: 1, stem: 2, beam: 3 }),
				bar(3),
			]]),
		},
		{
			label: 'Chord Articulations',
			desc: 'Chords with staccato, accent, tenuto, marcato — both stem dirs',
			data: () => makeScore('Chord Articulations', [[
				clef(), keySig(), timeSig(),
				// Stem up (default) chords with articulations
				chord([0, 4], 4, { staccato: 1 }),
				chord([2, 5], 4, { accent: 1 }),
				chord([0, 4, 7], 4, { tenuto: 1 }),
				chord([-2, 2], 4, { marcato: 1 }),
				bar(),
				// Stem down chords with articulations
				chord([0, 4], 4, { staccato: 1, stem: 2 }),
				chord([2, 5], 4, { accent: 1, stem: 2 }),
				chord([0, 4, 7], 4, { fermata: 1, stem: 2 }),
				chord([-2, 2], 4, { staccato: 1, accent: 1, stem: 2 }),
				bar(3),
			]]),
		},
		{
			label: 'Dotted Note Articulations',
			desc: 'Articulations on dotted notes — should center on notehead, not dot',
			data: () => makeScore('Dotted Note Articulations', [[
				clef(), keySig(), timeSig(),
				// Single dot + staccato, various positions & stem dirs
				note(0, 4, { dots: 1, staccato: 1 }),
				note(2, 4, { dots: 1, accent: 1 }),
				note(-2, 4, { dots: 1, tenuto: 1 }),
				note(4, 4, { dots: 1, marcato: 1 }),
				bar(),
				// Stem down, dotted + articulations
				note(0, 4, { dots: 1, staccato: 1, stem: 2 }),
				note(2, 4, { dots: 1, accent: 1, stem: 2 }),
				note(-4, 4, { dots: 1, fermata: 1 }),
				note(0, 2, { dots: 1, staccato: 1 }),
				bar(),
				// Double-dotted + articulations
				note(0, 4, { dots: 2, staccato: 1 }),
				note(2, 4, { dots: 2, accent: 1, stem: 2 }),
				// Dotted eighth (flagged) + staccato
				note(0, 8, { dots: 1, staccato: 1 }),
				note(-2, 8, { dots: 1, accent: 1, stem: 2 }),
				bar(),
				// Dotted chord + articulations
				chord([0, 4], 4, { dots: 1, staccato: 1 }),
				chord([2, 5], 4, { dots: 1, accent: 1, stem: 2 }),
				rest(2),
				bar(3),
			]]),
		},
			{
			label: 'Grace Notes',
			desc: 'Acciaccatura (slashed stem), scaled flag, stems up',
			data: () => makeScore('Grace Notes', [[
				clef(), keySig(), timeSig(),
				// Single grace notes before different durations
				note(2, 8, { grace: 1 }), note(0, 4),
				note(4, 8, { grace: 1 }), note(2, 4),
				note(-2, 8, { grace: 1 }), note(0, 2),
				bar(3),
			]]),
		},
		{
			label: 'Grace Note Variants',
			desc: 'High/low positions, with accidentals, beamed grace group',
			data: () => makeScore('Grace Note Variants', [[
				clef(), keySig(), timeSig(),
				// Grace note with accidental
				note(0, 8, { grace: 1, accidental: '#' }), note(0, 4),
				// Grace note high on staff
				note(6, 8, { grace: 1 }), note(4, 4),
				// Beamed grace note pair (16ths)
				note(0, 16, { grace: 1, beam: 1 }),
				note(2, 16, { grace: 1, beam: 3 }),
				note(0, 2),
				bar(3),
			]]),
		},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Barlines & Endings',
		tests: [
			{
				label: 'Barline Styles',
				desc: 'Single, double, final, repeat open/close',
				data: () => makeScore('Barlines', [[
					clef(), keySig(), timeSig(),
					note(0, 1), bar(0),      // single
					note(0, 1), bar(1),      // double
					note(0, 1), bar(4),      // repeat open
					note(0, 1), bar(5),      // repeat close
					note(0, 1), bar(3),      // section close (final)
				]]),
			},
			{
				label: 'Volta Brackets',
				desc: '1st and 2nd endings',
				data: () => makeScore('Volta Brackets', [[
					clef(), keySig(), timeSig(),
					note(0, 4), note(2, 4), note(4, 4), note(2, 4), bar(4),
					ending(1, 0), note(0, 4), note(2, 4), note(4, 4), note(6, 4), bar(5),
					ending(2, 1), note(0, 4), note(-2, 4), note(0, 2),
					bar(3),
				]]),
			},
		],
	},
	// ────────────────────────────────────────────────────────────
	{
		category: 'Grand Staff & Multi-Staff',
		tests: [
			{
				label: 'Piano Grand Staff (Brace)',
				desc: 'Treble + bass clef with curly brace',
				data: () => makeScore('Grand Staff', [
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						note(0, 4), note(2, 4), note(4, 4), note(6, 4), bar(),
						chord([0, 4, 7], 2), chord([2, 5, 9], 2),
						bar(3),
					], { braceWithNext: true, connectBarsWithNext: true }),
					makeStaff([
						clef('bass'), keySig(), timeSig(),
						note(0, 4), note(-2, 4), note(-4, 4), note(-6, 4), bar(),
						chord([-7, -4, 0], 2), chord([-9, -5, -2], 2),
						bar(3),
					]),
				]),
			},
			{
				label: 'Orchestral Bracket',
				desc: 'Three staves with system bracket',
				data: () => makeScore('Orchestral', [
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						note(4, 4), note(6, 4), note(8, 4), note(6, 4), bar(3),
					], { bracketWithNext: true }),
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						note(0, 4), note(2, 4), note(4, 4), note(2, 4), bar(3),
					], { bracketWithNext: true }),
					makeStaff([
						clef('bass'), keySig(), timeSig(),
						note(-2, 4), note(0, 4), note(2, 4), note(0, 4), bar(3),
					]),
				]),
			},
			{
				label: 'Brace + Bracket',
				desc: 'Piano brace inside orchestral bracket',
				data: () => makeScore('Piano + Orchestral', [
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						note(4, 4), note(6, 2), bar(3),
					], { bracketWithNext: true }),
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						chord([0, 4, 7], 2), chord([2, 5, 9], 2), bar(3),
					], { bracketWithNext: true, braceWithNext: true, connectBarsWithNext: true }),
					makeStaff([
						clef('bass'), keySig(), timeSig(),
						chord([-7, -4, 0], 2), chord([-5, -2, 2], 2), bar(3),
					]),
				]),
			},
			{
				label: 'System Barline',
				desc: 'All staves connected with vertical line at system start',
				data: () => makeScore('System Barline', [
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						note(0, 4), note(4, 4), note(2, 2), bar(3),
					]),
					makeStaff([
						clef('bass'), keySig(), timeSig(),
						note(0, 4), note(-4, 4), note(-2, 2), bar(3),
					]),
				]),
			},
			{
				label: 'Cross-Staff Alignment — Key Sig Width',
				desc: 'Staves with different key sigs: noteheads at same beat must align vertically',
				data: () => makeScore('Cross-Staff Alignment', [
					makeStaff([
						clef('treble'), keySig('E'), timeSig(),
						note(0, 4), note(2, 4), note(4, 4), note(6, 4), bar(),
						note(4, 2), note(0, 2),
						bar(3),
					], { braceWithNext: true, connectBarsWithNext: true }),
					makeStaff([
						clef('bass'), keySig('C'), timeSig(),
						note(0, 4), note(-2, 4), note(-4, 4), note(-6, 4), bar(),
						note(-4, 2), note(0, 2),
						bar(3),
					]),
				]),
			},
			{
				label: 'Cross-Staff Alignment — Clef + Key',
				desc: 'Different clefs and key sigs: wider header on top staff',
				data: () => makeScore('Clef + Key Alignment', [
					makeStaff([
						clef('treble'), keySig('B'), timeSig('3/4'),
						note(0, 4), note(4, 4), note(2, 4), bar(),
						note(6, 2, { dots: 1 }),
						bar(3),
					], { braceWithNext: true, connectBarsWithNext: true }),
					makeStaff([
						clef('bass'), keySig(), timeSig('3/4'),
						note(0, 4), note(-4, 4), note(-2, 4), bar(),
						note(-6, 2, { dots: 1 }),
						bar(3),
					]),
				]),
			},
			{
				label: 'Cross-Staff Alignment — Same Key',
				desc: 'Both staves same key sig: noteheads should align perfectly',
				data: () => makeScore('Same Key Alignment', [
					makeStaff([
						clef('treble'), keySig('Ab'), timeSig(),
						note(0, 4), note(2, 4), note(4, 4), note(6, 4), bar(),
						note(4, 2), note(0, 2),
						bar(3),
					], { braceWithNext: true, connectBarsWithNext: true }),
					makeStaff([
						clef('bass'), keySig('Ab'), timeSig(),
						note(0, 4), note(-2, 4), note(-4, 4), note(-6, 4), bar(),
						note(-4, 2), note(0, 2),
						bar(3),
					]),
				]),
			},
			{
				label: 'Cross-Staff Alignment — Flow Directions',
				desc: 'Segno/Coda on one staff should not shift notes out of vertical alignment',
				data: () => makeScore('Flow Direction Alignment', [
					makeStaff([
						clef('treble'), keySig(), timeSig(),
						note(0, 4), note(2, 4), flow(1), note(4, 4), note(6, 4), bar(),
						note(4, 2), flow(0), note(0, 2),
						bar(3),
					], { braceWithNext: true, connectBarsWithNext: true }),
					makeStaff([
						clef('bass'), keySig(), timeSig(),
						note(0, 4), note(-2, 4), note(-4, 4), note(-6, 4), bar(),
						note(-4, 2), note(0, 2),
						bar(3),
					]),
				]),
			},
		],
	},
]

export { SYNTHETIC_FIXTURES, makeScore, makeStaff, note, rest, chord, bar, clef, keySig, timeSig, dynamic, tempo, dynVariance, tempoVariance, flow, ending }
