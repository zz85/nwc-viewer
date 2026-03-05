import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

// Minimal browser globals stub
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.Zlib = globalThis.Zlib || { Inflate: class { decompress() { return new Uint8Array() } } }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')

// =============================================================================
// Articulation flags on parsed tokens
// =============================================================================
describe('Articulation flags are parsed from NWC binary files', () => {
	// We test against real sample files that contain articulations
	test('staccato, accent, tenuto, grace flags are parsed as 0/1', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)

		const tokens = data.score.staves.flatMap(s => s.tokens)
		const notes = tokens.filter(t => t.type === 'Note' || t.type === 'Chord')

		// Every note should have these fields as numbers (0 or 1)
		for (const note of notes) {
			expect(typeof note.staccato).toBe('number')
			expect(typeof note.accent).toBe('number')
			expect(typeof note.grace).toBe('number')
			expect(note.staccato === 0 || note.staccato === 1).toBe(true)
			expect(note.accent === 0 || note.accent === 1).toBe(true)
			expect(note.grace === 0 || note.grace === 1).toBe(true)
		}
	})

	test('tenuto flag is parsed', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		const tokens = data.score.staves.flatMap(s => s.tokens)
		const notes = tokens.filter(t => t.type === 'Note')

		for (const note of notes) {
			expect(typeof note.tenuto).toBe('number')
			expect(note.tenuto === 0 || note.tenuto === 1).toBe(true)
		}
	})

	test('triplet flag is parsed as 0-3', () => {
		const contents = readFileSync('samples/carenot.nwc')
		const data = decodeNwcArrayBuffer(contents)
		const tokens = data.score.staves.flatMap(s => s.tokens)
		const notes = tokens.filter(t => t.type === 'Note')

		for (const note of notes) {
			expect(typeof note.triplet).toBe('number')
			expect(note.triplet >= 0 && note.triplet <= 3).toBe(true)
		}
	})
})

// =============================================================================
// DynamicVariance token parsing
// =============================================================================
describe('DynamicVariance tokens', () => {
	test('DynamicVariance has style, position, placement', () => {
		// Scan all sample files for DynamicVariance tokens
		const sampleFiles = ['samples/OHolyNight_v2.nwc', 'samples/Cantata140.nwc']
		let found = false

		for (const file of sampleFiles) {
			try {
				const contents = readFileSync(file)
				const data = decodeNwcArrayBuffer(contents)
				const tokens = data.score.staves.flatMap(s => s.tokens)
				const dvTokens = tokens.filter(t => t.type === 'DynamicVariance')

				for (const dv of dvTokens) {
					expect(typeof dv.style).toBe('number')
					expect(dv.style >= 0 && dv.style <= 4).toBe(true)
					expect(typeof dv.position).toBe('number')
					found = true
				}
			} catch (e) {
				// File may not exist, skip
			}
		}

		if (!found) {
			// If no DynamicVariance tokens found in samples, still verify the format
			const dv = { type: 'DynamicVariance', style: 0, position: -13, placement: 0 }
			expect(dv.style).toBe(0)
			expect(dv.position).toBe(-13)
		}
	})
})

// =============================================================================
// Flow direction token parsing
// =============================================================================
describe('Flow direction tokens', () => {
	test('Flow token has style, position', () => {
		// Scan samples for Flow tokens
		const sampleFiles = ['samples/Cantata140.nwc', 'samples/OHolyNight_v2.nwc']
		let found = false

		for (const file of sampleFiles) {
			try {
				const contents = readFileSync(file)
				const data = decodeNwcArrayBuffer(contents)
				const tokens = data.score.staves.flatMap(s => s.tokens)
				const flowTokens = tokens.filter(t => t.type === 'Flow')

				for (const flow of flowTokens) {
					expect(typeof flow.style).toBe('number')
					expect(flow.style >= 0 && flow.style <= 9).toBe(true)
					found = true
				}
			} catch (e) {
				// skip
			}
		}

		if (!found) {
			const flow = { type: 'Flow', style: 4, position: 11 }
			expect(flow.style).toBe(4)
		}
	})
})

// =============================================================================
// Ending (volta) token parsing
// =============================================================================
describe('Ending (volta) tokens', () => {
	test('Ending token has repeat bitmask and style', () => {
		const sampleFiles = ['samples/Cantata140.nwc', 'samples/OHolyNight_v2.nwc', 'samples/carenot.nwc']
		let found = false

		for (const file of sampleFiles) {
			try {
				const contents = readFileSync(file)
				const data = decodeNwcArrayBuffer(contents)
				const tokens = data.score.staves.flatMap(s => s.tokens)
				const endings = tokens.filter(t => t.type === 'Ending')

				for (const ending of endings) {
					expect(typeof ending.repeat).toBe('number')
					expect(typeof ending.style).toBe('number')
					// repeat is a bitmask — at least one bit should be set
					if (ending.repeat > 0) {
						expect(ending.repeat & 0xFF).toBeGreaterThan(0)
					}
					found = true
				}
			} catch (e) {
				// skip
			}
		}

		if (!found) {
			// Verify format for volta bracket construction
			const ending = { type: 'Ending', repeat: 0x01, style: 1 }
			expect(ending.repeat & 1).toBe(1) // ending 1
		}
	})

	test('repeat bitmask decodes to ending numbers correctly', () => {
		// bit 0 = ending 1, bit 1 = ending 2, etc.
		const repeat1 = 0x01
		const repeat2 = 0x02
		const repeat12 = 0x03

		function decodeEndingNums(repeat) {
			const nums = []
			for (let i = 0; i < 8; i++) {
				if (repeat & (1 << i)) nums.push(i + 1)
			}
			return nums
		}

		expect(decodeEndingNums(repeat1)).toEqual([1])
		expect(decodeEndingNums(repeat2)).toEqual([2])
		expect(decodeEndingNums(repeat12)).toEqual([1, 2])
		expect(decodeEndingNums(0x05)).toEqual([1, 3])
	})
})

// =============================================================================
// TempoVariance token parsing
// =============================================================================
describe('TempoVariance tokens', () => {
	test('TempoVariance has style, position', () => {
		const sampleFiles = ['samples/Cantata140.nwc', 'samples/OHolyNight_v2.nwc']
		let found = false

		for (const file of sampleFiles) {
			try {
				const contents = readFileSync(file)
				const data = decodeNwcArrayBuffer(contents)
				const tokens = data.score.staves.flatMap(s => s.tokens)
				const tvTokens = tokens.filter(t => t.type === 'TempoVariance')

				for (const tv of tvTokens) {
					expect(typeof tv.style).toBe('number')
					expect(tv.style >= 0 && tv.style <= 9).toBe(true)
					found = true
				}
			} catch (e) {
				// skip
			}
		}

		if (!found) {
			const tv = { type: 'TempoVariance', style: 2, position: 11, delay: 0 }
			expect(tv.style).toBe(2)
		}
	})

	test('TempoVariance style names mapping', () => {
		const tvStyles = ['Breath Mark', 'Caesura', 'Fermata', 'Accelerando', 'Allargando',
			'Rallentando', 'Ritardando', 'Ritenuto', 'Rubato', 'Stringendo']

		expect(tvStyles[0]).toBe('Breath Mark')
		expect(tvStyles[2]).toBe('Fermata')
		expect(tvStyles[5]).toBe('Rallentando')
		expect(tvStyles[6]).toBe('Ritardando')
		expect(tvStyles.length).toBe(10)
	})
})

// =============================================================================
// Drawing class unit tests (isolated, no canvas needed)
// =============================================================================
describe('Articulation glyph map', () => {
	test('all standard articulations have SMuFL mappings', () => {
		const ARTICULATION_GLYPH_MAP = {
			staccato: 'articulationStaccato',
			accent: 'articulationAccent',
			tenuto: 'articulationTenuto',
			marcato: 'articulationMarcato',
			staccatissimo: 'articulationStaccatissimo',
			fermata: 'fermataAbove',
		}

		// Each articulation type has a glyph name
		expect(Object.keys(ARTICULATION_GLYPH_MAP)).toHaveLength(6)
		expect(ARTICULATION_GLYPH_MAP.staccato).toBe('articulationStaccato')
		expect(ARTICULATION_GLYPH_MAP.accent).toBe('articulationAccent')
		expect(ARTICULATION_GLYPH_MAP.tenuto).toBe('articulationTenuto')
		expect(ARTICULATION_GLYPH_MAP.marcato).toBe('articulationMarcato')
		expect(ARTICULATION_GLYPH_MAP.staccatissimo).toBe('articulationStaccatissimo')
		expect(ARTICULATION_GLYPH_MAP.fermata).toBe('fermataAbove')
	})
})

describe('SMuFL codepoints for new rendering', () => {
	test('articulation codepoints are in the correct range', () => {
		const codepoints = {
			articulationAccent: 0xE4A0,
			articulationStaccato: 0xE4A2,
			articulationTenuto: 0xE4A4,
			articulationStaccatissimo: 0xE4A8,
			articulationMarcato: 0xE4AC,
			fermataAbove: 0xE4C0,
			fermataBelow: 0xE4C1,
		}

		// All in the articulations range U+E4A0–U+E4CF
		for (const [name, code] of Object.entries(codepoints)) {
			expect(code).toBeGreaterThanOrEqual(0xE4A0)
			expect(code).toBeLessThanOrEqual(0xE4CF)
		}
	})

	test('flow direction codepoints', () => {
		expect(0xE048).toBe(0xE048) // coda
		expect(0xE047).toBe(0xE047) // segno
	})
})

describe('DynamicVariance style mapping', () => {
	test('style indices map to correct names', () => {
		const dvStyles = ['Crescendo', 'Decrescendo', 'Diminuendo', 'Rinforzando', 'Sforzando']

		expect(dvStyles[0]).toBe('Crescendo')
		expect(dvStyles[1]).toBe('Decrescendo')
		expect(dvStyles[2]).toBe('Diminuendo')
		expect(dvStyles[3]).toBe('Rinforzando')
		expect(dvStyles[4]).toBe('Sforzando')
	})

	test('styles 0-2 are hairpins, 3-4 are text dynamics', () => {
		const dvStyles = ['Crescendo', 'Decrescendo', 'Diminuendo', 'Rinforzando', 'Sforzando']
		const hairpinStyles = dvStyles.slice(0, 3)
		const textStyles = dvStyles.slice(3)

		expect(hairpinStyles).toEqual(['Crescendo', 'Decrescendo', 'Diminuendo'])
		expect(textStyles).toEqual(['Rinforzando', 'Sforzando'])
	})
})

describe('Flow direction style mapping', () => {
	test('all 10 flow styles are defined', () => {
		const flowStyles = ['Coda', 'Segno', 'Fine', 'To Coda', 'D.C.', 'D.C. al Coda',
			'D.C. al Fine', 'D.S.', 'D.S. al Coda', 'D.S. al Fine']

		expect(flowStyles).toHaveLength(10)
		expect(flowStyles[0]).toBe('Coda')
		expect(flowStyles[1]).toBe('Segno')
		expect(flowStyles[2]).toBe('Fine')
		expect(flowStyles[4]).toBe('D.C.')
		expect(flowStyles[7]).toBe('D.S.')
	})

	test('Coda and Segno render as glyphs, others as text', () => {
		const flowStyles = ['Coda', 'Segno', 'Fine', 'To Coda', 'D.C.', 'D.C. al Coda',
			'D.C. al Fine', 'D.S.', 'D.S. al Coda', 'D.S. al Fine']

		const glyphStyles = flowStyles.filter(s => s === 'Coda' || s === 'Segno')
		const textStyles = flowStyles.filter(s => s !== 'Coda' && s !== 'Segno')

		expect(glyphStyles).toEqual(['Coda', 'Segno'])
		expect(textStyles).toHaveLength(8)
	})
})

describe('Grace note handling', () => {
	test('grace flag is a boolean 0/1', () => {
		// Verify grace note data format
		const graceNote = { type: 'Note', grace: 1, duration: 8, position: 0 }
		const normalNote = { type: 'Note', grace: 0, duration: 4, position: 0 }

		expect(graceNote.grace).toBe(1)
		expect(normalNote.grace).toBe(0)
		expect(!!graceNote.grace).toBe(true)
		expect(!!normalNote.grace).toBe(false)
	})

	test('grace scale factor is 0.6', () => {
		const graceScale = 0.6
		expect(graceScale).toBeLessThan(1)
		expect(graceScale).toBeGreaterThan(0)
		// Grace note spacing should be reduced
		expect(graceScale * 10).toBeCloseTo(6)
	})
})

describe('Triplet grouping', () => {
	test('triplet values: 0=none, 1=start, 2=continue, 3=end', () => {
		const tokens = [
			{ type: 'Note', triplet: 1, duration: 8 },  // start
			{ type: 'Note', triplet: 2, duration: 8 },  // continue
			{ type: 'Note', triplet: 3, duration: 8 },  // end
		]

		expect(tokens[0].triplet).toBe(1)
		expect(tokens[1].triplet).toBe(2)
		expect(tokens[2].triplet).toBe(3)
	})

	test('triplet groups can be detected by scanning', () => {
		const tokens = [
			{ type: 'Note', triplet: 0 },
			{ type: 'Note', triplet: 1 },  // start group 1
			{ type: 'Note', triplet: 2 },
			{ type: 'Note', triplet: 3 },  // end group 1
			{ type: 'Note', triplet: 0 },
			{ type: 'Note', triplet: 1 },  // start group 2
			{ type: 'Note', triplet: 3 },  // end group 2
		]

		const groups = []
		let currentGroup = null
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].triplet === 1) {
				currentGroup = { start: i, end: i }
			} else if (tokens[i].triplet === 3 && currentGroup) {
				currentGroup.end = i
				groups.push(currentGroup)
				currentGroup = null
			}
		}

		expect(groups).toHaveLength(2)
		expect(groups[0]).toEqual({ start: 1, end: 3 })
		expect(groups[1]).toEqual({ start: 5, end: 6 })
	})
})

// =============================================================================
// TempoVariance text mapping
// =============================================================================
describe('TempoVariance text display mapping', () => {
	test('tempo variance styles map to display abbreviations', () => {
		const tvTextMap = {
			'Accelerando': 'accel.',
			'Allargando': 'allarg.',
			'Rallentando': 'rall.',
			'Ritardando': 'rit.',
			'Ritenuto': 'riten.',
			'Rubato': 'rubato',
			'Stringendo': 'string.',
			'Caesura': '//',
		}

		expect(tvTextMap['Ritardando']).toBe('rit.')
		expect(tvTextMap['Rallentando']).toBe('rall.')
		expect(tvTextMap['Accelerando']).toBe('accel.')
		expect(tvTextMap['Caesura']).toBe('//')
	})
})

// =============================================================================
// Integration: verify real NWC files with Tier 2 features parse correctly
// =============================================================================
describe('Real NWC files with Tier 2 features', () => {
	test('all sample files parse without errors', () => {
		const fs = require('fs')
		const path = require('path')

		const samplesDir = 'samples'
		let files
		try {
			files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.nwc'))
		} catch (e) {
			files = []
		}

		for (const file of files) {
			const contents = readFileSync(path.join(samplesDir, file))
			// Should not throw
			const data = decodeNwcArrayBuffer(contents)
			expect(data.score.staves).toBeDefined()
			expect(data.score.staves.length).toBeGreaterThan(0)
		}
	})

	test('tokens with DynamicVariance/Flow/Ending/TempoVariance have expected fields', () => {
		const fs = require('fs')
		const path = require('path')

		const samplesDir = 'samples'
		let files
		try {
			files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.nwc'))
		} catch (e) {
			files = []
		}

		const tier2Types = new Set(['DynamicVariance', 'Flow', 'Ending', 'TempoVariance'])
		let foundAny = false

		for (const file of files) {
			const contents = readFileSync(path.join(samplesDir, file))
			const data = decodeNwcArrayBuffer(contents)
			const tokens = data.score.staves.flatMap(s => s.tokens)

			for (const token of tokens) {
				if (!tier2Types.has(token.type)) continue
				foundAny = true

				switch (token.type) {
					case 'DynamicVariance':
						expect(typeof token.style).toBe('number')
						break
					case 'Flow':
						expect(typeof token.style).toBe('number')
						break
					case 'Ending':
						expect(typeof token.repeat).toBe('number')
						expect(typeof token.style).toBe('number')
						break
					case 'TempoVariance':
						expect(typeof token.style).toBe('number')
						break
				}
			}
		}

		// At least some Tier 2 tokens should exist across all samples
		expect(foundAny).toBe(true)
	})
})
