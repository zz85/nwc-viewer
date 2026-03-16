/**
 * MuseScore (.mscx / .mscz) file parser for Notably.
 *
 * Parses MuseScore XML into the same data shape that the NWC parser produces,
 * with all timing and pitch information already resolved so that the
 * interpreter step can be skipped.
 *
 * Supports both MuseScore 3 and MuseScore 4 format variants.
 */

import { unzip } from './zip.js'
import Fraction from './fraction.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map MuseScore durationType strings to NWC-style numeric durations */
const DURATION_MAP = {
	'maxima': 0.125,   // 8 whole notes (rare)
	'long': 0.25,      // 4 whole notes (rare)
	'breve': 0.5,      // double whole
	'whole': 1,
	'half': 2,
	'quarter': 4,
	'eighth': 8,
	'16th': 16,
	'32nd': 32,
	'64th': 64,
	'128th': 128,
	'256th': 256,
	'512th': 512,
	'1024th': 1024,
}

/** Map MuseScore durationType to Fraction (numerator, denominator) */
const DURATION_FRACTIONS = {
	'breve': [2, 1],
	'whole': [1, 1],
	'half': [1, 2],
	'quarter': [1, 4],
	'eighth': [1, 8],
	'16th': [1, 16],
	'32nd': [1, 32],
	'64th': [1, 64],
	'128th': [1, 128],
}

/**
 * MuseScore clef type → internal clef name + octave shift.
 * Covers both MS3 (concertClefType) and MS4 variants.
 */
const CLEF_MAP = {
	'G':     { clef: 'treble', octave: 0 },
	'G8va':  { clef: 'treble', octave: 1 },   // Octave Up
	'G8vb':  { clef: 'treble', octave: 2 },   // Octave Down
	'G15ma': { clef: 'treble', octave: 1 },   // Two octaves up (approximate)
	'G15mb': { clef: 'treble', octave: 2 },   // Two octaves down (approximate)
	'F':     { clef: 'bass', octave: 0 },
	'F8vb':  { clef: 'bass', octave: 2 },
	'F8va':  { clef: 'bass', octave: 1 },
	'F15mb': { clef: 'bass', octave: 2 },
	'C1':    { clef: 'alto', octave: 0 },     // Soprano clef (C on line 1)
	'C2':    { clef: 'alto', octave: 0 },     // Mezzo-soprano
	'C3':    { clef: 'alto', octave: 0 },     // Alto clef
	'C4':    { clef: 'tenor', octave: 0 },    // Tenor clef
	'C5':    { clef: 'alto', octave: 0 },     // Baritone clef
	'PERC':  { clef: 'percussion', octave: 0 },
	'TAB':   { clef: 'treble', octave: 0 },   // Tablature fallback
}

/**
 * NWC clef pitch offsets — same values as interpreter.js.
 * Used to compute staff position from absolute diatonic pitch.
 */
const OCTAVE_START = 3
const OCTAVE_NOTES = 7
const CLEF_PITCH_OFFSETS = {
	treble: (OCTAVE_START + 1) * OCTAVE_NOTES + 6,     // 34 → B4 at position 0
	bass: (OCTAVE_START + 0) * OCTAVE_NOTES + 1,       // 22 → D3 at position 0
	alto: (OCTAVE_START + 1) * OCTAVE_NOTES,            // 28 → C4 at position 0
	tenor: (OCTAVE_START + 0) * OCTAVE_NOTES + 5,      // 26 → A3 at position 0
	percussion: (OCTAVE_START + 0) * OCTAVE_NOTES + 1,
}

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

/**
 * TPC (Tonal Pitch Class) decoding.
 * TPC values follow the circle of fifths starting from Fbb = -1.
 * Formula: noteNames[(tpc + 1) % 7], accidentalLevel = floor((tpc + 1) / 7) - 2
 *
 * TPC -1 = Fbb, 0 = Cbb, ..., 6 = Bbb
 * TPC  6 = Fb,  7 = Cb, ..., 13 = Bb
 * TPC 13 = F,   14 = C, ..., 20 = B
 * TPC 20 = F#,  21 = C#, ..., 27 = B#
 * TPC 27 = Fx,  28 = Cx, ..., 34 = Bx
 */
const TPC_NOTE_NAMES = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const ACCIDENTAL_STRINGS = { '-2': 'v', '-1': 'b', '0': '', '1': '#', '2': 'x' }

/**
 * Decode a TPC value into note name and accidental.
 * @param {number} tpc — MuseScore tonal pitch class
 * @returns {{ name: string, accidental: string, accidentalValue: string }}
 */
function decodeTPC(tpc) {
	const idx = ((tpc + 1) % 7 + 7) % 7   // safe modulo for negative tpc
	const name = TPC_NOTE_NAMES[idx]
	const level = Math.floor((tpc + 1) / 7) - 2
	const accidental = ACCIDENTAL_STRINGS[String(level)] || ''
	return { name, accidental, accidentalValue: accidental || undefined }
}

/**
 * Compute NWC staff position from note name, octave, and clef.
 * position = diatonicPitch - clefOffset
 * diatonicPitch = octave * 7 + NOTE_INDEX[name]
 */
function computePosition(name, octave, clef, octaveShift) {
	const diatonicPitch = octave * 7 + NOTE_INDEX[name]
	let offset = CLEF_PITCH_OFFSETS[clef] || CLEF_PITCH_OFFSETS.treble
	if (octaveShift === 1) offset += 7      // 8va
	else if (octaveShift === 2) offset -= 7 // 8vb
	return diatonicPitch - offset
}

/**
 * Compute note name and octave from MIDI pitch and TPC.
 * MIDI pitch gives us the absolute pitch; TPC gives enharmonic spelling.
 * @param {number} midiPitch
 * @param {number} tpc
 * @returns {{ name: string, octave: number, accidental: string, accidentalValue: string }}
 */
function midiAndTpcToNote(midiPitch, tpc) {
	const { name, accidental, accidentalValue } = decodeTPC(tpc)

	// Derive octave from MIDI pitch and note name.
	// MIDI 60 = C4.  The diatonic note index within an octave is NOTE_INDEX[name].
	// accidentalSemitones adjusts for sharps/flats so we get the right octave.
	const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
	const ACC_SEMI = { '': 0, '#': 1, 'b': -1, 'x': 2, 'v': -2 }
	const baseSemitone = SEMITONES[name] + (ACC_SEMI[accidental] || 0)

	// octave = floor((midiPitch - baseSemitone) / 12) - 1
	// But we need to be careful with edge cases (e.g., Cb5 = B4 = MIDI 71)
	const octave = Math.round((midiPitch - baseSemitone) / 12) - 1

	return { name, octave, accidental, accidentalValue }
}

// ---------------------------------------------------------------------------
// Key Signature Helpers
// ---------------------------------------------------------------------------

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Map number of sharps/flats to key name */
const KEY_NAMES_SHARP = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
const KEY_NAMES_FLAT  = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']

function buildKeySigToken(accidentalCount, clef, clefOctave) {
	let key, sharps = [], flats = [], accidentals = []

	if (accidentalCount > 0) {
		// Sharps
		key = KEY_NAMES_SHARP[accidentalCount] || 'C'
		for (let i = 0; i < accidentalCount && i < 7; i++) {
			sharps.push(SHARP_ORDER[i])
			accidentals.push(SHARP_ORDER[i].toLowerCase() + '#')
		}
	} else if (accidentalCount < 0) {
		// Flats
		const count = Math.abs(accidentalCount)
		key = KEY_NAMES_FLAT[count] || 'C'
		for (let i = 0; i < count && i < 7; i++) {
			flats.push(FLAT_ORDER[i])
			accidentals.push(FLAT_ORDER[i] + 'b')
		}
	} else {
		key = 'C'
	}

	return {
		type: 'KeySignature',
		key,
		sharps,
		flats,
		accidentals,
		clef,
		clefOffset: CLEF_PITCH_OFFSETS[clef] || CLEF_PITCH_OFFSETS.treble,
	}
}

// ---------------------------------------------------------------------------
// XML Helpers
// ---------------------------------------------------------------------------

/** Get text content of first child element with given tag name */
function xmlText(parent, tagName) {
	const el = parent.getElementsByTagName(tagName)[0]
	return el ? el.textContent.trim() : ''
}

/** Get integer from child element */
function xmlInt(parent, tagName, defaultVal) {
	const text = xmlText(parent, tagName)
	if (text === '') return defaultVal !== undefined ? defaultVal : 0
	return parseInt(text, 10)
}

/** Get float from child element */
function xmlFloat(parent, tagName, defaultVal) {
	const text = xmlText(parent, tagName)
	if (text === '') return defaultVal !== undefined ? defaultVal : 0
	return parseFloat(text)
}

/** Get direct child elements (not nested descendants) with given tag name */
function directChildren(parent, tagName) {
	const result = []
	const nodes = parent.childNodes
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].nodeType === 1 && nodes[i].tagName === tagName) result.push(nodes[i])
	}
	return result
}

/** Iterate direct child elements of a parent node */
function forEachChildElement(parent, callback) {
	const nodes = parent.childNodes
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].nodeType === 1) callback(nodes[i])
	}
}

/** Convert a NodeList to a real array (for..of compatible) */
function toArray(nodeList) {
	const arr = []
	for (let i = 0; i < nodeList.length; i++) arr.push(nodeList[i])
	return arr
}

// ---------------------------------------------------------------------------
// Main Parser
// ---------------------------------------------------------------------------

/**
 * Parse a MuseScore file (.mscx XML or .mscz ZIP) into the Notably data format.
 *
 * @param {ArrayBuffer} buffer — raw file contents
 * @returns {Promise<Object>} — data object matching NWC parser output shape
 */
export async function parseMuseScore(buffer) {
	const bytes = new Uint8Array(buffer)

	let xmlString
	if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
		// ZIP file (.mscz) — extract the .mscx from inside
		const files = await unzip(buffer)
		xmlString = findMscxInZip(files)
	} else {
		// Raw XML (.mscx)
		xmlString = new TextDecoder().decode(bytes)
	}

	const parser = new DOMParser()
	const doc = parser.parseFromString(xmlString, 'text/xml')

	// Check for parse errors
	const parseError = doc.querySelector('parsererror')
	if (parseError) {
		throw new Error('MuseScore XML parse error: ' + parseError.textContent)
	}

	return convertMuseScoreDOM(doc)
}

/**
 * Find the .mscx file inside a .mscz ZIP archive.
 */
function findMscxInZip(files) {
	// Look for .mscx file (could be at root or in a subdirectory)
	for (const [name, data] of files) {
		if (name.endsWith('.mscx')) {
			return new TextDecoder().decode(data)
		}
	}

	// MS4 uses .mscx inside a META-INF structure sometimes, or just at root
	// Also check for score.mscx specifically
	for (const [name, data] of files) {
		if (name.includes('.mscx') || name === 'score.mscx' || name.endsWith('/score.mscx')) {
			return new TextDecoder().decode(data)
		}
	}

	throw new Error('No .mscx file found inside .mscz archive. Files: ' +
		Array.from(files.keys()).join(', '))
}

/**
 * Convert a parsed MuseScore DOM document into the Notably data format.
 */
function convertMuseScoreDOM(doc) {
	const root = doc.documentElement // <museScore>
	const version = root.getAttribute('version') || '3.0'
	const isV4 = version.startsWith('4')

	// Find the main Score element (first one — subsequent ones are part excerpts)
	const scoreElements = directChildren(root, 'Score')
	const scoreEl = scoreElements[0]
	if (!scoreEl) {
		throw new Error('No <Score> element found in MuseScore file')
	}

	// Extract metadata
	const info = extractInfo(scoreEl)

	// Extract parts (instrument/staff metadata)
	const partElements = directChildren(scoreEl, 'Part')
	const parts = partElements.map((partEl, i) => extractPart(partEl, i, isV4))

	// Extract staff data (measures with music content)
	const staffElements = directChildren(scoreEl, 'Staff')
	const staves = []

	for (let si = 0; si < staffElements.length; si++) {
		const staffEl = staffElements[si]
		const staffId = parseInt(staffEl.getAttribute('id'), 10) || (si + 1)

		// Find matching part — parts contain Staff sub-elements
		// staffId maps to part index (parts can have multiple staves)
		const { part, staffIndexInPart } = findPartForStaff(parts, staffId)

		const staff = convertStaff(staffEl, part, staffIndexInPart, si, staffElements.length, isV4)
		staves.push(staff)
	}

	return {
		header: {
			version: 'MuseScore ' + version,
			company: 'MuseScore',
			product: 'MuseScore',
		},
		info,
		score: {
			allowLayering: false,
			staves,
		},
		_source: 'musescore',
	}
}

/**
 * Extract title, author, etc. from Score element.
 */
function extractInfo(scoreEl) {
	const info = {
		title: '',
		author: '',
		lyricist: '',
		copyright1: '',
		copyright2: '',
		comments: '',
	}

	// MetaTags
	const metaTags = scoreEl.getElementsByTagName('metaTag')
	for (const tag of toArray(metaTags)) {
		const name = tag.getAttribute('name')
		const value = tag.textContent.trim()
		switch (name) {
			case 'workTitle':
			case 'movementTitle':
				if (!info.title) info.title = value
				break
			case 'composer':
			case 'arranger':
				if (!info.author) info.author = value
				break
			case 'lyricist':
				info.lyricist = value
				break
			case 'copyright':
				info.copyright1 = value
				break
		}
	}

	// Also check VBox in first staff for title text
	const staffEls = directChildren(scoreEl, 'Staff')
	if (staffEls.length > 0) {
		const vbox = directChildren(staffEls[0], 'VBox')[0]
		if (vbox) {
			const textEls = directChildren(vbox, 'Text')
			for (const textEl of toArray(textEls)) {
				const style = xmlText(textEl, 'style')
				const text = xmlText(textEl, 'text')
				if (style === 'title' && !info.title) info.title = text
				else if (style === 'composer' && !info.author) info.author = text
				else if (style === 'subtitle' && !info.comments) info.comments = text
			}
		}
	}

	return info
}

/**
 * Extract part metadata (instrument, staff info, channel).
 */
function extractPart(partEl, index, isV4) {
	const trackName = xmlText(partEl, 'trackName')
	const instEl = partEl.getElementsByTagName('Instrument')[0]

	let longName = '', shortName = '', channel = 0, program = 0

	if (instEl) {
		longName = xmlText(instEl, 'longName')
		shortName = xmlText(instEl, 'shortName')

		const channelEl = instEl.getElementsByTagName('Channel')[0]
		if (channelEl) {
			const progEl = channelEl.getElementsByTagName('program')[0]
			if (progEl) program = parseInt(progEl.getAttribute('value'), 10) || 0
		}
	}

	// Count staves in this part and extract per-staff default clefs
	const staffSubElements = directChildren(partEl, 'Staff')
	const staffCount = staffSubElements.length || 1

	// Build per-staff clef defaults.
	// Sources (in priority order):
	//   1. <Part><Staff><defaultClef>F</defaultClef>  (MS2 grand staff)
	//   2. <Part><Instrument><clef>C3</clef>          (MS2 single-staff: viola/cello)
	//      <Part><Instrument><clef staff="2">F</clef> (MS2 multi-staff: piano)
	//   3. Default to 'G' (treble)
	const staffClefs = []
	for (let i = 0; i < staffSubElements.length; i++) {
		const staffEl = staffSubElements[i]
		const defaultClef = xmlText(staffEl, 'defaultClef')
		if (defaultClef) {
			staffClefs.push(defaultClef)
		} else if (instEl) {
			// Check Instrument <clef> elements — match by staff number
			const clefEls = instEl.getElementsByTagName('clef')
			let found = ''
			for (let ci = 0; ci < clefEls.length; ci++) {
				const clefStaff = clefEls[ci].getAttribute('staff')
				if (clefStaff && parseInt(clefStaff) === i + 1) {
					found = clefEls[ci].textContent.trim()
					break
				} else if (!clefStaff && staffSubElements.length === 1) {
					// Single-staff instrument with no staff attr
					found = clefEls[ci].textContent.trim()
					break
				}
			}
			staffClefs.push(found || 'G')
		} else {
			staffClefs.push('G')
		}
	}

	// If no Staff sub-elements, check Instrument clef
	if (staffClefs.length === 0) {
		const instClef = instEl ? xmlText(instEl, 'clef') : ''
		staffClefs.push(instClef || 'G')
	}

	// Transposition for transposing instruments (Bb clarinet, F horn, etc.)
	const transposeChromatic = instEl ? xmlInt(instEl, 'transposeChromatic', 0) : 0

	return {
		trackName,
		longName,
		shortName,
		channel: index, // Each part gets its own channel
		program,
		staffCount,
		staffClefs,
		transposeChromatic,
		partIndex: index,
	}
}

/**
 * Find the part that owns a given staff id, and the staff's index within that part.
 * In MuseScore, Part elements contain Staff sub-elements.
 * Staff ids are sequential: Part 1 with 2 staves → staffIds 1, 2.
 */
function findPartForStaff(parts, staffId) {
	let cumulative = 0
	for (const part of parts) {
		const prevCumulative = cumulative
		cumulative += part.staffCount
		if (staffId <= cumulative) {
			const staffIndexInPart = staffId - prevCumulative - 1
			return { part, staffIndexInPart }
		}
	}
	return { part: parts[parts.length - 1] || { trackName: '', longName: '', shortName: '', channel: 0, program: 0, staffClefs: ['G'] }, staffIndexInPart: 0 }
}

/**
 * Convert a <Staff> element (containing measures) into a Notably staff object.
 */
function convertStaff(staffEl, part, staffIndexInPart, staffIndex, totalStaves, isV4) {
	const tokens = []
	const measureEls = directChildren(staffEl, 'Measure')

	// Determine default clef from Part definition
	const defaultClefType = part.staffClefs?.[staffIndexInPart] || 'G'
	const defaultMapped = CLEF_MAP[defaultClefType] || CLEF_MAP['G']

	// Transposition: for transposing instruments (Bb clarinet, etc.), the .mscx
	// stores concert pitch + written TPC.  We want written pitch for rendering.
	const transposeChromatic = part.transposeChromatic || 0

	// Track running state
	let currentClef = defaultMapped.clef
	let currentClefOctave = defaultMapped.octave
	let currentTimeSigN = 4
	let currentTimeSigD = 4
	let hadInitialClef = false
	let hadInitialTimeSig = false
	let hadInitialKeySig = false

	const tickCounter = new Fraction(0, 1)
	const tabCounter = new Fraction(0, 1)

	for (let mi = 0; mi < measureEls.length; mi++) {
		const measureEl = measureEls[mi]
		const voiceEls = directChildren(measureEl, 'voice')
		const hasVoiceWrappers = voiceEls.length > 0

		// ── Walk direct children of <Measure> for non-voice elements (MS3+ only) ──
		// In MS3+, KeySig/TimeSig/Tempo can appear as direct Measure children
		// outside <voice>.  In MS2, everything is a direct Measure child and will
		// be handled by the main content walker below.
		if (hasVoiceWrappers) {
		forEachChildElement(measureEl, (child) => {
			const tag = child.tagName
			if (tag === 'voice') return

			switch (tag) {
				case 'Clef': {
					const clefType = xmlText(child, 'concertClefType') || xmlText(child, 'clefType') || 'G'
					const mapped = CLEF_MAP[clefType] || CLEF_MAP['G']
					currentClef = mapped.clef
					currentClefOctave = mapped.octave
					hadInitialClef = true

					const token = {
						type: 'Clef',
						clef: mapped.clef,
						octave: mapped.octave,
						tickValue: tickCounter.value(),
						tabValue: tabCounter.value(),
					}
					tabCounter.add(1, 4)
					token.tabUntilValue = tabCounter.value()
					tokens.push(token)
					break
				}

				case 'KeySig': {
					let accCount = xmlInt(child, 'accidental', undefined)
					if (accCount === undefined) accCount = xmlInt(child, 'key', 0)

					const keySigToken = buildKeySigToken(accCount, currentClef, currentClefOctave)
					keySigToken.tickValue = tickCounter.value()
					keySigToken.tabValue = tabCounter.value()
					tabCounter.add(1, 4)
					keySigToken.tabUntilValue = tabCounter.value()
					hadInitialKeySig = true
					tokens.push(keySigToken)
					break
				}

				case 'TimeSig': {
					const sigN = xmlInt(child, 'sigN', 4)
					const sigD = xmlInt(child, 'sigD', 4)
					currentTimeSigN = sigN
					currentTimeSigD = sigD

					const signature = sigN + '/' + sigD
					const token = {
						type: 'TimeSignature',
						signature,
						group: sigN,
						beat: sigD,
						tickValue: tickCounter.value(),
						tabValue: tabCounter.value(),
					}
					tabCounter.add(1, 4)
					token.tabUntilValue = tabCounter.value()
					hadInitialTimeSig = true
					tokens.push(token)
					break
				}

				case 'Tempo': {
					const bps = xmlFloat(child, 'tempo', 2.0)
					const bpm = Math.round(bps * 60)
					const token = {
						type: 'Tempo',
						position: -7,
						placement: 0,
						duration: bpm,
						note: 4,
						tickValue: tickCounter.value(),
						tabValue: tabCounter.value(),
						tabUntilValue: tabCounter.value(),
					}
					tokens.push(token)
					break
				}
			}
		})
		} // end if (hasVoiceWrappers) measure-level scan

		// ── Walk voice/measure children for music content ──

		// MS2 format has no <voice> wrappers — notes/rests are direct Measure children.
		// MS3+ wraps them in <voice> elements. Handle both by using the measure itself
		// as the container when no voice elements exist.
		const voiceEl = voiceEls[0] || null
		const contentParent = voiceEl || measureEl

		// Check if this measure actually has any Chord/Rest children
		const hasContent = directChildren(contentParent, 'Chord').length > 0
			|| directChildren(contentParent, 'Rest').length > 0

		if (!hasContent) {
			// No notes or rests in this measure — add a whole-bar rest
			const restToken = makeWholeBarRest(currentTimeSigN, currentTimeSigD, tickCounter, tabCounter)
			tokens.push(restToken)
			// Add barline at end of measure
			if (mi < measureEls.length - 1) {
				tokens.push(makeBarline(0, tickCounter, tabCounter))
			}
			continue
		}

		// Walk content children in document order
		// In MS3+, Clef/KeySig/TimeSig/Tempo also appear inside <voice>.
		// In MS2, they appear at measure level (already handled above).
		forEachChildElement(contentParent, (child) => {
			const tag = child.tagName

			switch (tag) {
				case 'Clef': {
					const clefType = xmlText(child, 'concertClefType') || xmlText(child, 'clefType') || 'G'
					const mapped = CLEF_MAP[clefType] || CLEF_MAP['G']
					currentClef = mapped.clef
					currentClefOctave = mapped.octave
					hadInitialClef = true

					const token = {
						type: 'Clef',
						clef: mapped.clef,
						octave: mapped.octave,
						tickValue: tickCounter.value(),
						tabValue: tabCounter.value(),
					}
					tabCounter.add(1, 4)
					token.tabUntilValue = tabCounter.value()
					tokens.push(token)
					break
				}

				case 'KeySig': {
					let accCount = xmlInt(child, 'accidental', undefined)
					if (accCount === undefined) accCount = xmlInt(child, 'key', 0)

					const keySigToken = buildKeySigToken(accCount, currentClef, currentClefOctave)
					keySigToken.tickValue = tickCounter.value()
					keySigToken.tabValue = tabCounter.value()
					tabCounter.add(1, 4)
					keySigToken.tabUntilValue = tabCounter.value()
					hadInitialKeySig = true
					tokens.push(keySigToken)
					break
				}

				case 'TimeSig': {
					const sigN = xmlInt(child, 'sigN', 4)
					const sigD = xmlInt(child, 'sigD', 4)
					currentTimeSigN = sigN
					currentTimeSigD = sigD

					const signature = sigN + '/' + sigD
					const token = {
						type: 'TimeSignature',
						signature,
						group: sigN,
						beat: sigD,
						tickValue: tickCounter.value(),
						tabValue: tabCounter.value(),
					}
					tabCounter.add(1, 4)
					token.tabUntilValue = tabCounter.value()
					hadInitialTimeSig = true
					tokens.push(token)
					break
				}

				case 'Chord': {
					const chordToken = convertChord(child, currentClef, currentClefOctave, tickCounter, tabCounter, currentTimeSigN, currentTimeSigD, transposeChromatic)
					tokens.push(chordToken)
					break
				}

				case 'Rest': {
					const restToken = convertRest(child, tickCounter, tabCounter, currentTimeSigN, currentTimeSigD)
					tokens.push(restToken)
					break
				}

				case 'Tempo': {
					const bps = xmlFloat(child, 'tempo', 2.0)
					const bpm = Math.round(bps * 60)
					const token = {
						type: 'Tempo',
						position: -7,
						placement: 0,
						duration: bpm,
						note: 4,
						tickValue: tickCounter.value(),
						tabValue: tabCounter.value(),
						tabUntilValue: tabCounter.value(),
					}
					tokens.push(token)
					break
				}

				// Skip elements we don't handle yet
				case 'location':
				case 'BarLine':
				case 'tick':
				case 'voice':
				case 'Spanner':
				case 'Beam':
				case 'Tuplet':
				case 'endTuplet':
				case 'Dynamic':
				case 'Fermata':
				case 'Articulation':
				case 'Lyrics':
				case 'StaffText':
				case 'SystemText':
				case 'RehearsalMark':
				case 'HairPin':
				case 'Volta':
				case 'endSpanner':
					// Future: handle these
					break

				default:
					// Unknown element — skip silently
					break
			}
		})

		// Check for explicit barline style in the Measure element
		const barlineEls = measureEl.getElementsByTagName('BarLine')
		let barlineStyle = 0 // default single
		// Check for endRepeat / startRepeat attributes on Measure (MS3 style)
		if (measureEl.hasAttribute('endRepeat')) barlineStyle = 5 // LocalClose
		if (measureEl.hasAttribute('startRepeat')) {
			// Insert repeat open barline before the measure content
			// For simplicity, we just note the style on the closing barline
		}

		// Add barline at end of measure (except last)
		if (mi < measureEls.length - 1) {
			tokens.push(makeBarline(barlineStyle, tickCounter, tabCounter))
		} else {
			// Final barline
			tokens.push(makeBarline(3, tickCounter, tabCounter)) // SectionClose (double barline)
		}
	}

	// Ensure we have initial clef/keysig/timesig if the file didn't provide them
	if (!hadInitialClef) {
		const clefToken = {
			type: 'Clef',
			clef: currentClef,
			octave: currentClefOctave,
			tickValue: 0,
			tabValue: 0,
			tabUntilValue: 0.25,
		}
		tokens.unshift(clefToken)
	}

	if (!hadInitialKeySig) {
		// C major implied — emit it explicitly so the renderer knows
		const keySigToken = buildKeySigToken(0, currentClef, currentClefOctave)
		keySigToken.tickValue = 0
		keySigToken.tabValue = 0
		keySigToken.tabUntilValue = 0.25
		// Insert after clef
		let insertIdx = 0
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type === 'Clef') insertIdx = i + 1
			else break
		}
		tokens.splice(insertIdx, 0, keySigToken)
	}

	if (!hadInitialTimeSig) {
		// Find where to insert (after clef, before first note)
		let insertIdx = 0
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type === 'Clef' || tokens[i].type === 'KeySignature') insertIdx = i + 1
			else break
		}
		const timeSigToken = {
			type: 'TimeSignature',
			signature: currentTimeSigN + '/' + currentTimeSigD,
			group: currentTimeSigN,
			beat: currentTimeSigD,
			tickValue: 0,
			tabValue: 0,
			tabUntilValue: 0.25,
		}
		tokens.splice(insertIdx, 0, timeSigToken)
	}

	return {
		staff_name: part.longName || part.trackName || 'Staff ' + (staffIndex + 1),
		staff_label: part.shortName || '',
		group_name: '',
		channel: part.channel || 0,

		bracketWithNext: false,
		braceWithNext: staffIndex < totalStaves - 1 && part.staffCount > 1,
		connectBarsWithNext: staffIndex < totalStaves - 1,
		layerWithNext: false,

		boundaryTop: -12,
		boundaryBottom: 12,
		endingBar: 0,
		lines: 5,
		lyrics: [],
		tokens,
	}
}

/**
 * Read note pitch from a <Note> element, handling transposing instruments.
 * Uses tpc2 (written TPC) when available, falls back to tpc (concert TPC).
 * Adjusts MIDI pitch by transposeChromatic for correct octave calculation.
 */
function readNotePitch(noteEl, transposeChromatic = 0) {
	const pitch = xmlInt(noteEl, 'pitch', 60)
	const tpc2 = xmlInt(noteEl, 'tpc2', undefined)
	const tpc = xmlInt(noteEl, 'tpc', 14)

	if (tpc2 !== undefined && transposeChromatic !== 0) {
		// Transposing instrument: use tpc2 (written) and adjust MIDI pitch
		return midiAndTpcToNote(pitch - transposeChromatic, tpc2)
	}
	return midiAndTpcToNote(pitch, tpc)
}

/**
 * Detect tie start/end on a <Note> element.
 * MS2: <Tie id="N"> = start, <endSpanner id="N"/> = end
 * MS3+: <Spanner type="Tie"><next>...</next></Spanner> = start,
 *       <Spanner type="Tie"><prev>...</prev></Spanner> = end
 */
function detectTie(noteEl) {
	let tie = 0, tieEnd = 0

	// MS3+ format: Spanner type="Tie"
	const spannerEls = noteEl.getElementsByTagName('Spanner')
	for (const sp of toArray(spannerEls)) {
		if (sp.getAttribute('type') === 'Tie') {
			if (sp.getElementsByTagName('next').length > 0) tie = 1
			if (sp.getElementsByTagName('prev').length > 0) tieEnd = 1
		}
	}

	// MS2 format: <Tie id="N"> = tie start, <endSpanner id="N"/> = tie end
	if (!tie && noteEl.getElementsByTagName('Tie').length > 0) {
		tie = 1
	}
	if (!tieEnd && noteEl.getElementsByTagName('endSpanner').length > 0) {
		tieEnd = 1
	}

	return { tie, tieEnd }
}

/**
 * Convert a <Chord> element to a Note or Chord token.
 */
function convertChord(chordEl, clef, clefOctave, tickCounter, tabCounter, timeSigN, timeSigD, transposeChromatic = 0) {
	const durType = xmlText(chordEl, 'durationType') || 'quarter'
	const dots = countDots(chordEl)
	const noteEls = chordEl.getElementsByTagName('Note')

	const duration = DURATION_MAP[durType] || 4

	if (noteEls.length === 0) {
		// Chord with no notes? Treat as rest
		return convertRest(chordEl, tickCounter, tabCounter, timeSigN, timeSigD)
	}

	// Compute duration as Fraction
	const durFraction = makeDurationFraction(durType, dots)

	if (noteEls.length === 1) {
		// Single note
		const noteEl = noteEls[0]
		const { name, octave, accidental, accidentalValue } = readNotePitch(noteEl, transposeChromatic)
		const position = computePosition(name, octave, clef, clefOctave)

		// Check for tie
		const { tie, tieEnd } = detectTie(noteEl)

		const token = {
			type: 'Note',
			position,
			duration,
			dots,
			accidental: accidental || '',
			name,
			octave,
			accidentalValue,
			tie,
			tieEnd,
			slur: 0,
			beam: 0,    // Let the renderer figure out beaming
			stem: 0,    // Auto
			triplet: 0,
			staccato: 0,
			accent: 0,
			grace: 0,
			tenuto: 0,
			lyricSyllable: 0,
		}

		// Set timing
		setTiming(token, durFraction, tickCounter, tabCounter)
		return token
	}

	// Multi-note chord
	const notes = []
	for (const noteEl of toArray(noteEls)) {
		const { name, octave, accidental, accidentalValue } = readNotePitch(noteEl, transposeChromatic)
		const position = computePosition(name, octave, clef, clefOctave)

		const { tie, tieEnd } = detectTie(noteEl)

		notes.push({
			position,
			duration,
			dots,
			accidental: accidental || '',
			name,
			octave,
			accidentalValue,
			tie,
			tieEnd,
			slur: 0,
			beam: 0,
			stem: 0,
			triplet: 0,
			staccato: 0,
			accent: 0,
			grace: 0,
			tenuto: 0,
		})
	}

	// Sort notes by position (bottom to top) — NWC convention
	notes.sort((a, b) => a.position - b.position)

	// Chord token: merge first note's properties onto the chord
	const first = notes[0]
	const token = {
		type: 'Chord',
		...first,
		duration,
		dots,
		chords: notes.length,
		notes,
		lyricSyllable: 0,
	}

	setTiming(token, durFraction, tickCounter, tabCounter)
	return token
}

/**
 * Convert a <Rest> element to a Rest token.
 */
function convertRest(restEl, tickCounter, tabCounter, timeSigN, timeSigD) {
	const durType = xmlText(restEl, 'durationType') || 'quarter'
	const dots = countDots(restEl)

	if (durType === 'measure') {
		// Whole-bar rest — use time signature duration
		return makeWholeBarRest(timeSigN, timeSigD, tickCounter, tabCounter)
	}

	const duration = DURATION_MAP[durType] || 4
	const durFraction = makeDurationFraction(durType, dots)

	const token = {
		type: 'Rest',
		position: 0,
		duration,
		dots,
		triplet: 0,
	}

	setTiming(token, durFraction, tickCounter, tabCounter)
	return token
}

/**
 * Make a whole-bar rest using the current time signature.
 */
function makeWholeBarRest(timeSigN, timeSigD, tickCounter, tabCounter) {
	const durFraction = new Fraction(timeSigN, timeSigD)

	// NWC represents whole-bar rests as duration=1 (whole note)
	const token = {
		type: 'Rest',
		position: 0,
		duration: 1,
		dots: 0,
		triplet: 0,
		durValue: durFraction.clone(),
	}

	token.tickValue = tickCounter.value()
	token.tabValue = tabCounter.value()

	tickCounter.add(durFraction)
	tabCounter.add(durFraction)

	token.tabUntilValue = tabCounter.value()
	return token
}

/**
 * Make a barline token.
 */
function makeBarline(style, tickCounter, tabCounter) {
	return {
		type: 'Barline',
		barline: style,
		repeat: 2,
		systemBreak: false,
		tickValue: tickCounter.value(),
		tabValue: tabCounter.value(),
		tabUntilValue: tabCounter.value(),
	}
}

/**
 * Count <dots/> or <dot/> child elements in a Chord/Rest/Note element.
 */
function countDots(el) {
	// MS3/4 uses <dots>N</dots> as a child element with count
	const dotsText = xmlText(el, 'dots')
	if (dotsText) return parseInt(dotsText, 10)

	// Or count individual <dot/> elements
	return directChildren(el, 'dot').length
}

/**
 * Create a Fraction for a given duration type and dot count.
 */
function makeDurationFraction(durType, dots) {
	const entry = DURATION_FRACTIONS[durType]
	if (!entry) {
		console.warn('Unknown durationType:', durType, '— defaulting to quarter')
		return new Fraction(1, 4)
	}

	const frac = new Fraction(entry[0], entry[1])
	if (dots === 1) frac.multiply(3, 2)
	else if (dots === 2) frac.multiply(7, 4)
	return frac
}

/**
 * Set timing properties on a token and advance counters.
 */
function setTiming(token, durFraction, tickCounter, tabCounter) {
	token.durValue = durFraction.clone()

	token.tickValue = tickCounter.value()
	token.tabValue = tabCounter.value()

	tickCounter.add(durFraction)
	tabCounter.add(durFraction)

	token.tabUntilValue = tabCounter.value()
}

// ---------------------------------------------------------------------------
// Format Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether an ArrayBuffer contains a MuseScore file.
 * @param {ArrayBuffer} buffer
 * @returns {boolean}
 */
export function isMuseScoreFile(buffer) {
	const bytes = new Uint8Array(buffer)

	// Check for ZIP magic (PK\x03\x04)
	if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
		return true // Could be .mscz — we'll verify during parsing
	}

	// Check for XML declaration or <museScore tag
	const head = new TextDecoder().decode(bytes.subarray(0, Math.min(200, bytes.length)))
	if (head.includes('<museScore') || head.includes('museScore')) {
		return true
	}

	return false
}

/**
 * More specific check: is this definitely a MuseScore file?
 * (As opposed to any other ZIP file)
 */
export function isMuseScoreFileStrict(buffer, filename) {
	if (filename) {
		const lower = filename.toLowerCase()
		if (lower.endsWith('.mscz') || lower.endsWith('.mscx')) return true
	}

	const bytes = new Uint8Array(buffer)
	const head = new TextDecoder().decode(bytes.subarray(0, Math.min(500, bytes.length)))
	return head.includes('<museScore')
}
