/**
 * MusicXML (.musicxml / .mxl / .xml) file parser for Notably.
 *
 * Parses MusicXML into the same data shape that the NWC parser produces,
 * with all timing and pitch information already resolved so that the
 * interpreter step can be skipped.
 *
 * Supports MusicXML 3.x and 4.0 (score-partwise and score-timewise formats).
 */

import { unzip } from './zip.js'
import Fraction from './fraction.js'
import {
	DURATION_MAP, DURATION_FRACTIONS,
	CLEF_PITCH_OFFSETS, NOTE_INDEX, ACCIDENTAL_STRINGS,
	computePosition, buildKeySigToken,
	makeDurationFraction, setTiming, makeBarline, makeWholeBarRest,
	xmlText, xmlInt, xmlFloat, directChildren, forEachChildElement, toArray,
} from './music-import-utils.js'

// ---------------------------------------------------------------------------
// MusicXML-Specific Constants
// ---------------------------------------------------------------------------

/** Map MusicXML clef sign+line to internal clef name */
const CLEF_SIGN_MAP = {
	'G2': 'treble',
	'F4': 'bass',
	'C3': 'alto',
	'C4': 'tenor',
	'C1': 'alto',       // Soprano clef — approximate as alto
	'C2': 'alto',       // Mezzo-soprano — approximate as alto
	'C5': 'bass',       // Baritone — approximate as bass
	'percussion': 'percussion',
}

/** Map alter value to accidental character */
const ALTER_TO_ACCIDENTAL = { '-2': 'v', '-1': 'b', '0': '', '1': '#', '2': 'x' }

/** Map dynamics tag names to internal style numbers */
const DYNAMIC_STYLE_MAP = {
	'ppp': 0, 'pp': 1, 'p': 2, 'mp': 3,
	'mf': 4, 'f': 5, 'ff': 6, 'fff': 7,
	'sfz': 8, 'fp': 9, 'sf': 10, 'fz': 11,
}

/** Known dynamic tag names */
const DYNAMIC_NAMES = new Set([
	'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff',
	'sfz', 'fp', 'sf', 'fz', 'sfp', 'sffz', 'rfz',
])

// ---------------------------------------------------------------------------
// Format Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a buffer + filename represents a MusicXML file.
 * @param {ArrayBuffer} buffer
 * @param {string} [filename]
 * @returns {boolean}
 */
export function isMusicXMLFile(buffer, filename) {
	if (filename) {
		const lower = filename.toLowerCase()
		if (lower.endsWith('.musicxml') || lower.endsWith('.mxl')) return true
		if (lower.endsWith('.xml')) {
			// Ambiguous — check content
			const bytes = new Uint8Array(buffer)
			const head = new TextDecoder().decode(bytes.subarray(0, Math.min(500, bytes.length)))
			if (head.includes('<score-partwise') || head.includes('<score-timewise')) return true
			if (head.includes('<museScore')) return false
			return false
		}
	}

	// No filename — check content
	const bytes = new Uint8Array(buffer)
	if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
		// ZIP — could be .mxl. We'd need to check inside, but without
		// filename context, we can't be sure. Return false and let caller
		// handle via filename.
		return false
	}

	const head = new TextDecoder().decode(bytes.subarray(0, Math.min(500, bytes.length)))
	return head.includes('<score-partwise') || head.includes('<score-timewise')
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

/**
 * Parse a MusicXML file (or XML string) into internal format.
 * @param {ArrayBuffer|string} input — file bytes or XML string
 * @param {string} [filename]
 * @returns {Promise<Object>}
 */
export async function parseMusicXML(input, filename) {
	let xmlString

	if (typeof input === 'string') {
		xmlString = input
	} else {
		const bytes = new Uint8Array(input)

		// Check for ZIP (.mxl)
		if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
			xmlString = await extractMXL(input)
		} else {
			xmlString = new TextDecoder().decode(bytes)
		}
	}

	const parser = new DOMParser()
	const doc = parser.parseFromString(xmlString, 'text/xml')

	// Check for parse errors (querySelector may not exist in xmldom)
	const errorEl = doc.querySelector
		? doc.querySelector('parsererror')
		: doc.getElementsByTagName('parsererror')[0]
	if (errorEl) {
		throw new Error('MusicXML parse error: ' + errorEl.textContent.substring(0, 200))
	}

	// Detect root element
	const root = doc.documentElement
	if (root.tagName === 'score-partwise') {
		return convertScorePartwise(doc)
	} else if (root.tagName === 'score-timewise') {
		return convertScoreTimewise(doc)
	} else {
		throw new Error('Unrecognized MusicXML root element: ' + root.tagName)
	}
}

// ---------------------------------------------------------------------------
// MXL (Compressed MusicXML) Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the MusicXML content from a .mxl (ZIP) file.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
async function extractMXL(buffer) {
	const files = await unzip(buffer)

	// Try META-INF/container.xml first
	const containerData = files.get('META-INF/container.xml')
	if (containerData) {
		const containerXml = new TextDecoder().decode(containerData)
		const parser = new DOMParser()
		const containerDoc = parser.parseFromString(containerXml, 'text/xml')
		const rootfileEls = containerDoc.getElementsByTagName('rootfile')
		for (let i = 0; i < rootfileEls.length; i++) {
			const fullPath = rootfileEls[i].getAttribute('full-path')
			if (fullPath && files.has(fullPath)) {
				return new TextDecoder().decode(files.get(fullPath))
			}
		}
	}

	// Fallback: find first .musicxml or .xml file
	for (const [name, data] of files) {
		if (name.endsWith('.musicxml') || (name.endsWith('.xml') && !name.includes('META-INF'))) {
			return new TextDecoder().decode(data)
		}
	}

	throw new Error('MXL: No MusicXML file found in archive. Files: ' + [...files.keys()].join(', '))
}

// ---------------------------------------------------------------------------
// Shared Score Helpers
// ---------------------------------------------------------------------------

/** Extract header info (title, composer, etc.) from the score root element. */
function extractInfo(root) {
	const info = {
		title: '',
		author: '',
		lyricist: '',
		copyright1: '',
		copyright2: '',
		comments: '',
	}

	const workTitle = xmlText(root, 'work-title')
	const movementTitle = xmlText(root, 'movement-title')
	info.title = workTitle || movementTitle || ''

	const idEl = root.getElementsByTagName('identification')[0]
	if (idEl) {
		const creators = idEl.getElementsByTagName('creator')
		for (let i = 0; i < creators.length; i++) {
			const type = creators[i].getAttribute('type')
			const text = creators[i].textContent.trim()
			if (type === 'composer') info.author = text
			else if (type === 'lyricist') info.lyricist = text
		}
		const rights = idEl.getElementsByTagName('rights')
		if (rights.length > 0) info.copyright1 = rights[0].textContent.trim()
		if (rights.length > 1) info.copyright2 = rights[1].textContent.trim()
	}

	return info
}

/** Extract part-list metadata (names, MIDI info) from the score root element. */
function extractPartMetas(root) {
	const partMetas = []
	const scorePartEls = root.getElementsByTagName('score-part')
	for (let i = 0; i < scorePartEls.length; i++) {
		const sp = scorePartEls[i]
		const id = sp.getAttribute('id')
		const partName = xmlText(sp, 'part-name') || `Part ${i + 1}`
		const partAbbrev = xmlText(sp, 'part-abbreviation') || ''

		let channel = 0, patchName = 0
		const midiInstr = sp.getElementsByTagName('midi-instrument')[0]
		if (midiInstr) {
			channel = xmlInt(midiInstr, 'midi-channel', 1) - 1
			patchName = xmlInt(midiInstr, 'midi-program', 1) - 1
		}

		partMetas.push({ id, partName, partAbbrev, channel, patchName })
	}
	return partMetas
}

/** Build the final score result object. */
function buildScoreResult(root, info, staves) {
	const version = root.getAttribute('version') || '3.0'
	return {
		header: {
			version: `MusicXML ${version}`,
			company: 'MusicXML',
			product: 'MusicXML',
		},
		info,
		score: {
			allowLayering: false,
			staves,
		},
		_source: 'musicxml',
	}
}

/**
 * Convert measure element arrays to staves, handling multi-staff parts.
 * @param {Array<Object>} partMetas - Part metadata from extractPartMetas
 * @param {Function} getMeasureEls - Function(meta, index) returning array of measure-like elements
 */
function convertPartsToStaves(partMetas, getMeasureEls) {
	const staves = []
	for (let pi = 0; pi < partMetas.length; pi++) {
		const meta = partMetas[pi]
		const measureEls = getMeasureEls(meta, pi)
		const staffCount = detectStaffCount(measureEls)

		if (staffCount > 1) {
			for (let s = 1; s <= staffCount; s++) {
				const staff = convertPart(measureEls, meta, pi, partMetas.length, s, staffCount)
				staff.braceWithNext = s < staffCount
				staves.push(staff)
			}
		} else {
			staves.push(convertPart(measureEls, meta, pi, partMetas.length, 1, 1))
		}
	}
	return staves
}

// ---------------------------------------------------------------------------
// Score Conversion — Partwise
// ---------------------------------------------------------------------------

/**
 * Convert a <score-partwise> document into internal format.
 */
function convertScorePartwise(doc) {
	const root = doc.documentElement
	const info = extractInfo(root)
	const partMetas = extractPartMetas(root)

	// In partwise: root → <part> → <measure> children
	const partEls = root.getElementsByTagName('part')
	const partElMap = new Map()
	for (let i = 0; i < partEls.length; i++) {
		partElMap.set(partEls[i].getAttribute('id'), partEls[i])
	}

	const staves = convertPartsToStaves(partMetas, (meta, pi) => {
		const partEl = partElMap.get(meta.id) || partEls[pi]
		return partEl ? toArray(partEl.getElementsByTagName('measure')) : []
	})

	return buildScoreResult(root, info, staves)
}

// ---------------------------------------------------------------------------
// Score Conversion — Timewise
// ---------------------------------------------------------------------------

/**
 * Convert a <score-timewise> document into internal format.
 * Timewise structure: root → <measure> → <part> (children contain notes, etc.)
 * Each <part> element within a timewise <measure> is treated as one measure's
 * content for the corresponding part.
 */
function convertScoreTimewise(doc) {
	const root = doc.documentElement
	const info = extractInfo(root)
	const partMetas = extractPartMetas(root)

	// In timewise: root → <measure> → <part> children
	const topMeasures = directChildren(root, 'measure')

	// Build map: partId → [partElement, ...] across all measures
	const partMeasureMap = new Map()
	for (const meta of partMetas) {
		partMeasureMap.set(meta.id, [])
	}

	for (const twMeasure of topMeasures) {
		const partEls = directChildren(twMeasure, 'part')
		for (const partEl of partEls) {
			const partId = partEl.getAttribute('id')
			if (partMeasureMap.has(partId)) {
				partMeasureMap.get(partId).push(partEl)
			}
		}
	}

	const staves = convertPartsToStaves(partMetas, (meta) => {
		return partMeasureMap.get(meta.id) || []
	})

	return buildScoreResult(root, info, staves)
}

// ---------------------------------------------------------------------------
// Staff Count Detection
// ---------------------------------------------------------------------------

/**
 * Detect how many staves a part uses by scanning for <staves> in attributes
 * across an array of measure-like elements.
 * @param {Array<Element>} measureEls - Array of elements to scan
 */
function detectStaffCount(measureEls) {
	for (const el of measureEls) {
		const attrEls = el.getElementsByTagName('attributes')
		for (let i = 0; i < attrEls.length; i++) {
			const stavesText = xmlText(attrEls[i], 'staves')
			if (stavesText) {
				const n = parseInt(stavesText, 10)
				if (n > 1) return n
			}
		}
	}
	return 1
}

// ---------------------------------------------------------------------------
// Part Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an array of measure-like elements to a staff object.
 * In partwise format, these are <measure> elements from a <part>.
 * In timewise format, these are <part> elements from each <measure>.
 * @param {Array<Element>} measureEls - Array of elements to process as measures
 * @param {Object} meta - Part metadata from <score-part>
 * @param {number} partIndex - Index in part list
 * @param {number} totalParts - Total number of parts
 * @param {number} staffNum - Which staff (1-indexed) for multi-staff parts
 * @param {number} staffCount - Total staves in this part
 */
function convertPart(measureEls, meta, partIndex, totalParts, staffNum, staffCount) {
	const tokens = []

	// Running state across measures
	const state = {
		currentClef: staffNum === 1 ? 'treble' : 'bass',
		currentClefOctave: 0,
		currentTimeSigN: 4,
		currentTimeSigD: 4,
		currentDivisions: 1,
		tickCounter: new Fraction(0, 1),
		tabCounter: new Fraction(0, 1),
		hadInitialClef: false,
		hadInitialTimeSig: false,
		hadInitialKeySig: false,
		tripletState: 0,   // 0=none, 1=start set, 2=middle, 3=end set
		staffNum,          // which staff we're extracting (1-indexed)
		staffCount,
		lyrics: [],
	}

	const totalMeasures = measureEls.length

	for (let mi = 0; mi < totalMeasures; mi++) {
		convertMeasure(measureEls[mi], state, tokens, mi, totalMeasures)
	}

	// --- Ensure initial tokens exist ---
	ensureInitialTokens(state, tokens)

	return {
		staff_name: staffCount > 1
			? `${meta.partName} (staff ${staffNum})`
			: meta.partName,
		staff_label: meta.partAbbrev,
		group_name: '',
		channel: meta.channel,
		patchName: meta.patchName,

		bracketWithNext: false,
		braceWithNext: false,
		connectBarsWithNext: true,
		layerWithNext: false,

		boundaryTop: -12,
		boundaryBottom: 12,
		endingBar: 0,
		lines: 5,
		lyrics: state.lyrics,
		tokens,
	}
}

// ---------------------------------------------------------------------------
// Measure Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a single <measure> element.
 */
function convertMeasure(measureEl, state, tokens, measureIndex, totalMeasures) {
	const isLastMeasure = measureIndex === totalMeasures - 1
	let hasLeftBarline = false
	let hasRightBarline = false

	const nodes = measureEl.childNodes
	for (let i = 0; i < nodes.length; i++) {
		const el = nodes[i]
		if (el.nodeType !== 1) continue  // skip text nodes

		switch (el.tagName) {
			case 'attributes':
				handleAttributes(el, state, tokens, measureIndex)
				break
			case 'note':
				handleNote(el, state, tokens)
				break
			case 'direction':
				handleDirection(el, state, tokens)
				break
			case 'barline': {
				const location = el.getAttribute('location') || 'right'
				if (location === 'left') hasLeftBarline = true
				else hasRightBarline = true
				handleBarline(el, state, tokens, location)
				break
			}
			case 'forward':
				handleForward(el, state)
				break
			case 'backup':
				handleBackup(el, state)
				break
		}
	}

	// Emit implicit barline at measure boundary (if no explicit right barline)
	if (!hasRightBarline) {
		if (isLastMeasure) {
			// Final barline (section close)
			tokens.push(makeBarline(3, state.tickCounter, state.tabCounter))
		} else {
			// Normal barline
			tokens.push(makeBarline(0, state.tickCounter, state.tabCounter))
		}
	}
}

// ---------------------------------------------------------------------------
// Attributes Handler
// ---------------------------------------------------------------------------

function handleAttributes(attrEl, state, tokens, measureIndex) {
	// Divisions (affects duration calculation)
	const divText = xmlText(attrEl, 'divisions')
	if (divText) {
		state.currentDivisions = parseInt(divText, 10) || 1
	}

	// Clefs — may have multiple for multi-staff parts
	const clefEls = attrEl.getElementsByTagName('clef')
	for (let i = 0; i < clefEls.length; i++) {
		const clefEl = clefEls[i]
		const clefStaffNum = parseInt(clefEl.getAttribute('number') || '1', 10)

		// Only process clefs for our staff
		if (state.staffCount > 1 && clefStaffNum !== state.staffNum) continue

		const sign = xmlText(clefEl, 'sign')
		const line = xmlText(clefEl, 'line') || '2'
		const octChange = xmlInt(clefEl, 'clef-octave-change', 0)

		let clef
		if (sign.toLowerCase() === 'percussion') {
			clef = 'percussion'
		} else {
			clef = CLEF_SIGN_MAP[sign + line] || 'treble'
		}

		let octave = 0
		if (octChange === 1) octave = 1       // 8va
		else if (octChange === -1) octave = 2  // 8vb

		state.currentClef = clef
		state.currentClefOctave = octave

		const token = {
			type: 'Clef',
			clef,
			octave,
			tickValue: state.tickCounter.value(),
			tabValue: state.tabCounter.value(),
			tabUntilValue: state.tabCounter.value(),
		}
		tokens.push(token)

		if (measureIndex === 0) state.hadInitialClef = true
	}

	// Key signatures
	const keyEls = attrEl.getElementsByTagName('key')
	for (let i = 0; i < keyEls.length; i++) {
		const keyEl = keyEls[i]
		// Multi-staff: check number attribute
		const keyStaffNum = parseInt(keyEl.getAttribute('number') || '0', 10)
		if (keyStaffNum > 0 && state.staffCount > 1 && keyStaffNum !== state.staffNum) continue

		const fifths = xmlInt(keyEl, 'fifths', 0)
		const token = buildKeySigToken(fifths, state.currentClef, state.currentClefOctave)
		token.tickValue = state.tickCounter.value()
		token.tabValue = state.tabCounter.value()
		token.tabUntilValue = state.tabCounter.value()
		tokens.push(token)

		if (measureIndex === 0) state.hadInitialKeySig = true
	}

	// Time signatures
	const timeEls = attrEl.getElementsByTagName('time')
	for (let i = 0; i < timeEls.length; i++) {
		const timeEl = timeEls[i]
		const beats = xmlInt(timeEl, 'beats', 4)
		const beatType = xmlInt(timeEl, 'beat-type', 4)
		const symbol = timeEl.getAttribute('symbol')

		state.currentTimeSigN = beats
		state.currentTimeSigD = beatType

		let signature
		if (symbol === 'common') signature = 'Common'
		else if (symbol === 'cut') signature = 'AllaBreve'
		else signature = `${beats}/${beatType}`

		const token = {
			type: 'TimeSignature',
			signature,
			group: beats,
			beat: beatType,
			tickValue: state.tickCounter.value(),
			tabValue: state.tabCounter.value(),
			tabUntilValue: state.tabCounter.value(),
		}
		tokens.push(token)

		if (measureIndex === 0) state.hadInitialTimeSig = true
	}
}

// ---------------------------------------------------------------------------
// Note Handler
// ---------------------------------------------------------------------------

function handleNote(noteEl, state, tokens) {
	const isRest = noteEl.getElementsByTagName('rest').length > 0
	const isChord = noteEl.getElementsByTagName('chord').length > 0
	const isGrace = noteEl.getElementsByTagName('grace').length > 0

	// Multi-staff: skip notes not on our staff
	if (state.staffCount > 1) {
		const staffText = xmlText(noteEl, 'staff')
		const noteStaff = staffText ? parseInt(staffText, 10) : 1
		if (noteStaff !== state.staffNum) {
			// Advance timing for non-chord, non-grace notes/rests
			// (chord members share timing; grace notes don't advance)
			if (!isChord && !isGrace) {
				advanceTiming(noteEl, state)
			}
			return
		}
	}

	// Voice filtering for multi-staff parts only: the <staff> element already
	// filters by staff number above. For single-staff parts, accept all voices
	// since backup/forward handles tick positioning for secondary voices.
	// For multi-staff: accept all voices that passed the staff filter above.

	// --- Duration ---
	const typeText = xmlText(noteEl, 'type')
	const dotEls = noteEl.getElementsByTagName('dot')
	const dots = dotEls.length

	let duration, durType
	if (typeText) {
		durType = typeText
		duration = DURATION_MAP[typeText] || 4
	} else if (isRest) {
		// Whole-measure rest (no <type> element)
		durType = null  // signal for whole-bar rest
		duration = 1
	} else {
		durType = 'quarter'
		duration = 4
	}

	// --- Ties ---
	let tie = 0, tieEnd = 0
	const tieEls = noteEl.getElementsByTagName('tie')
	for (let i = 0; i < tieEls.length; i++) {
		const type = tieEls[i].getAttribute('type')
		if (type === 'start') tie = 1
		if (type === 'stop') tieEnd = 1
	}

	// --- Beam ---
	let beam = 0
	const beamEls = noteEl.getElementsByTagName('beam')
	if (beamEls.length > 0) {
		const beamText = beamEls[0].textContent.trim()
		if (beamText === 'begin') beam = 1
		else if (beamText === 'continue') beam = 2
		else if (beamText === 'end') beam = 3
	}

	// --- Stem ---
	const stemText = xmlText(noteEl, 'stem')
	const stem = stemText === 'up' ? 1 : stemText === 'down' ? 2 : 0

	// --- Notations: articulations, slur, tuplet, fermata ---
	let staccato = 0, accent = 0, tenuto = 0, fermata = 0
	let slur = 0
	let triplet = 0

	const notationsEls = noteEl.getElementsByTagName('notations')
	if (notationsEls.length > 0) {
		const notationsEl = notationsEls[0]

		// Articulations
		const artsEls = notationsEl.getElementsByTagName('articulations')
		if (artsEls.length > 0) {
			const artsEl = artsEls[0]
			if (artsEl.getElementsByTagName('staccato').length) staccato = 1
			if (artsEl.getElementsByTagName('accent').length) accent = 1
			if (artsEl.getElementsByTagName('tenuto').length) tenuto = 1
			if (artsEl.getElementsByTagName('strong-accent').length) accent = 1  // marcato → accent
		}

		// Fermata
		if (notationsEl.getElementsByTagName('fermata').length) fermata = 1

		// Slur
		const slurEls = notationsEl.getElementsByTagName('slur')
		if (slurEls.length > 0) {
			const slurType = slurEls[0].getAttribute('type')
			if (slurType === 'start') slur = 1
			else if (slurType === 'stop') slur = 2
			else if (slurType === 'continue') slur = 3
		}

		// Tuplet
		const tupletEls = notationsEl.getElementsByTagName('tuplet')
		if (tupletEls.length > 0) {
			const tupType = tupletEls[0].getAttribute('type')
			if (tupType === 'start') state.tripletState = 1
			else if (tupType === 'stop') state.tripletState = 3
		}
	}

	// Triplet tracking via time-modification
	const hasTimeMod = noteEl.getElementsByTagName('time-modification').length > 0
	if (hasTimeMod) {
		if (state.tripletState === 1) { triplet = 1; state.tripletState = 2 }
		else if (state.tripletState === 3) { triplet = 3; state.tripletState = 0 }
		else { triplet = 2 }
	}

	// --- Build token ---
	if (isRest) {
		if (!durType) {
			// Whole-bar rest
			const token = makeWholeBarRest(
				state.currentTimeSigN, state.currentTimeSigD,
				state.tickCounter, state.tabCounter
			)
			token.triplet = triplet
			tokens.push(token)
		} else {
			const durFraction = makeDurationFraction(durType, dots)
			const token = {
				type: 'Rest',
				position: 0,
				duration,
				dots,
				triplet,
			}
			if (!isGrace) {
				setTiming(token, durFraction, state.tickCounter, state.tabCounter)
			} else {
				token.tickValue = state.tickCounter.value()
				token.tabValue = state.tabCounter.value()
				token.tabUntilValue = state.tabCounter.value()
				token.durValue = durFraction.clone()
			}
			tokens.push(token)
		}
		return
	}

	// --- Pitched note ---
	const pitchEl = noteEl.getElementsByTagName('pitch')[0]
	if (!pitchEl) return  // Unpitched percussion, skip

	const step = xmlText(pitchEl, 'step')
	const alter = xmlInt(pitchEl, 'alter', 0)
	const octave = xmlInt(pitchEl, 'octave', 4)
	const position = computePosition(step, octave, state.currentClef, state.currentClefOctave)

	const accidental = ALTER_TO_ACCIDENTAL[String(alter)] || ''
	const accidentalValue = accidental || undefined

	if (isChord) {
		// This note belongs to the previous token's chord
		const prevToken = tokens[tokens.length - 1]
		if (!prevToken) return

		const newNote = {
			position,
			duration,
			dots,
			accidental,
			name: step,
			octave,
			accidentalValue,
			tie,
			tieEnd,
			slur: 0,
			beam: 0,
			stem,
			triplet: 0,
			staccato,
			accent,
			grace: isGrace ? 1 : 0,
			tenuto,
		}

		if (prevToken.type === 'Note') {
			// Convert Note → Chord
			const existingNote = {
				position: prevToken.position,
				duration: prevToken.duration,
				dots: prevToken.dots,
				accidental: prevToken.accidental,
				name: prevToken.name,
				octave: prevToken.octave,
				accidentalValue: prevToken.accidentalValue,
				tie: prevToken.tie,
				tieEnd: prevToken.tieEnd,
				slur: prevToken.slur,
				beam: prevToken.beam,
				stem: prevToken.stem,
				triplet: prevToken.triplet,
				staccato: prevToken.staccato,
				accent: prevToken.accent,
				grace: prevToken.grace,
				tenuto: prevToken.tenuto,
			}

			prevToken.type = 'Chord'
			prevToken.notes = [existingNote, newNote]
			prevToken.notes.sort((a, b) => a.position - b.position)
			prevToken.chords = prevToken.notes.length
			prevToken.lyricSyllable = prevToken.lyricSyllable || 0

			// Update chord-level props from lowest note
			const lowest = prevToken.notes[0]
			prevToken.position = lowest.position
			prevToken.name = lowest.name
			prevToken.octave = lowest.octave
			prevToken.accidental = lowest.accidental
			prevToken.accidentalValue = lowest.accidentalValue
		} else if (prevToken.type === 'Chord') {
			prevToken.notes.push(newNote)
			prevToken.notes.sort((a, b) => a.position - b.position)
			prevToken.chords = prevToken.notes.length

			const lowest = prevToken.notes[0]
			prevToken.position = lowest.position
			prevToken.name = lowest.name
			prevToken.octave = lowest.octave
			prevToken.accidental = lowest.accidental
			prevToken.accidentalValue = lowest.accidentalValue
		}
		return
	}

	// Single note (non-chord)
	const durFraction = durType ? makeDurationFraction(durType, dots) : new Fraction(1, 4)

	const token = {
		type: 'Note',
		position,
		duration,
		dots,
		accidental,
		name: step,
		octave,
		accidentalValue,
		tie,
		tieEnd,
		slur,
		beam,
		stem,
		triplet,
		staccato,
		accent,
		grace: isGrace ? 1 : 0,
		tenuto,
		lyricSyllable: 0,
	}

	if (isGrace) {
		token.tickValue = state.tickCounter.value()
		token.tabValue = state.tabCounter.value()
		token.tabUntilValue = state.tabCounter.value()
		token.durValue = durFraction.clone()
	} else {
		setTiming(token, durFraction, state.tickCounter, state.tabCounter)
	}

	tokens.push(token)

	// --- Lyrics ---
	const lyricEls = noteEl.getElementsByTagName('lyric')
	for (let i = 0; i < lyricEls.length; i++) {
		const lyricEl = lyricEls[i]
		const verseNum = parseInt(lyricEl.getAttribute('number') || '1', 10) - 1
		const syllabic = xmlText(lyricEl, 'syllabic')
		const text = xmlText(lyricEl, 'text')
		if (!text) continue

		const prefix = (syllabic === 'middle' || syllabic === 'end') ? '-' : ''
		if (!state.lyrics[verseNum]) state.lyrics[verseNum] = []
		state.lyrics[verseNum].push(prefix + text)
	}
}

/**
 * Advance the tick counter for a note/rest we're skipping (wrong staff/voice).
 */
function advanceTiming(noteEl, state) {
	const durationText = xmlText(noteEl, 'duration')
	if (durationText) {
		const xmlDuration = parseInt(durationText, 10) || 0
		if (xmlDuration > 0 && state.currentDivisions > 0) {
			const frac = new Fraction(xmlDuration, state.currentDivisions * 4)
			state.tickCounter.add(frac)
			state.tabCounter.add(frac)
		}
	}
}

// ---------------------------------------------------------------------------
// Direction Handler
// ---------------------------------------------------------------------------

function handleDirection(dirEl, state, tokens) {
	// Check for sound element (tempo)
	const soundEls = dirEl.getElementsByTagName('sound')
	let soundTempo = 0
	for (let i = 0; i < soundEls.length; i++) {
		const tempoAttr = soundEls[i].getAttribute('tempo')
		if (tempoAttr) soundTempo = parseFloat(tempoAttr)

		// Flow directions from sound attributes
		if (soundEls[i].getAttribute('fine') !== null) {
			tokens.push({
				type: 'Flow',
				style: 2,  // Fine
				tickValue: state.tickCounter.value(),
				tabValue: state.tabCounter.value(),
				tabUntilValue: state.tabCounter.value(),
			})
		}
		if (soundEls[i].getAttribute('tocoda') !== null) {
			tokens.push({
				type: 'Flow',
				style: 3,  // ToCoda
				tickValue: state.tickCounter.value(),
				tabValue: state.tabCounter.value(),
				tabUntilValue: state.tabCounter.value(),
			})
		}
		if (soundEls[i].getAttribute('dacapo') === 'yes') {
			tokens.push({
				type: 'Flow',
				style: 4,  // DaCapo
				tickValue: state.tickCounter.value(),
				tabValue: state.tabCounter.value(),
				tabUntilValue: state.tabCounter.value(),
			})
		}
		if (soundEls[i].getAttribute('dalsegno') !== null) {
			tokens.push({
				type: 'Flow',
				style: 7,  // DalSegno
				tickValue: state.tickCounter.value(),
				tabValue: state.tabCounter.value(),
				tabUntilValue: state.tabCounter.value(),
			})
		}
	}

	// Direction types
	const dirTypeEls = dirEl.getElementsByTagName('direction-type')
	for (let i = 0; i < dirTypeEls.length; i++) {
		const dtEl = dirTypeEls[i]
		const nodes = dtEl.childNodes

		for (let j = 0; j < nodes.length; j++) {
			const child = nodes[j]
			if (child.nodeType !== 1) continue

			switch (child.tagName) {
				case 'metronome': {
					const beatUnit = xmlText(child, 'beat-unit') || 'quarter'
					const perMinute = xmlText(child, 'per-minute')
					const bpm = perMinute ? parseFloat(perMinute) : soundTempo
					const hasDot = child.getElementsByTagName('beat-unit-dot').length > 0
					if (bpm) {
						const durCode = DURATION_MAP[beatUnit] || 4
						// beatDuration must be in whole-note fractions (0.25 = quarter)
						// for the audio tempo map. DURATION_MAP gives NWC codes (4 = quarter).
						let beatDur = 1 / durCode
						if (hasDot) beatDur *= 1.5
						tokens.push({
							type: 'Tempo',
							position: -7,
							placement: 0,
							duration: Math.round(bpm),
							note: durCode,
							beatDuration: beatDur,
							tickValue: state.tickCounter.value(),
							tabValue: state.tabCounter.value(),
							tabUntilValue: state.tabCounter.value(),
						})
					}
					// If we emitted a metronome, skip the bare sound tempo
					soundTempo = 0
					break
				}

				case 'dynamics': {
					// The first child element's tag name is the dynamic marking
					const dynNodes = child.childNodes
					for (let k = 0; k < dynNodes.length; k++) {
						if (dynNodes[k].nodeType === 1 && DYNAMIC_NAMES.has(dynNodes[k].tagName)) {
							const dynName = dynNodes[k].tagName
							tokens.push({
								type: 'Dynamic',
								dynamic: dynName,
								position: 8,
								style: DYNAMIC_STYLE_MAP[dynName] !== undefined ? DYNAMIC_STYLE_MAP[dynName] : 4,
								tickValue: state.tickCounter.value(),
								tabValue: state.tabCounter.value(),
								tabUntilValue: state.tabCounter.value(),
							})
							break
						}
					}
					break
				}

				case 'wedge': {
					const wedgeType = child.getAttribute('type')
					if (wedgeType === 'crescendo' || wedgeType === 'diminuendo') {
						tokens.push({
							type: 'DynamicVariance',
							style: wedgeType === 'crescendo' ? 0 : 1,
							tickValue: state.tickCounter.value(),
							tabValue: state.tabCounter.value(),
							tabUntilValue: state.tabCounter.value(),
						})
					}
					// type="stop" — no token needed, layout handles span
					break
				}

				case 'pedal': {
					const pedalType = child.getAttribute('type')
					tokens.push({
						type: 'Pedal',
						sustain: pedalType === 'start' ? 1 : 0,
						pos: 8,
						placement: 0,
						tickValue: state.tickCounter.value(),
						tabValue: state.tabCounter.value(),
						tabUntilValue: state.tabCounter.value(),
					})
					break
				}

				case 'coda':
					tokens.push({
						type: 'Flow',
						style: 0,
						tickValue: state.tickCounter.value(),
						tabValue: state.tabCounter.value(),
						tabUntilValue: state.tabCounter.value(),
					})
					break

				case 'segno':
					tokens.push({
						type: 'Flow',
						style: 1,
						tickValue: state.tickCounter.value(),
						tabValue: state.tabCounter.value(),
						tabUntilValue: state.tabCounter.value(),
					})
					break

				case 'words': {
					const text = child.textContent.trim()
					// Check for known flow directions
					if (/d\.?\s*c\.?\s*al\s*coda/i.test(text)) {
						tokens.push({ type: 'Flow', style: 5,
							tickValue: state.tickCounter.value(),
							tabValue: state.tabCounter.value(),
							tabUntilValue: state.tabCounter.value() })
					} else if (/d\.?\s*s\.?\s*al\s*coda/i.test(text)) {
						tokens.push({ type: 'Flow', style: 8,
							tickValue: state.tickCounter.value(),
							tabValue: state.tabCounter.value(),
							tabUntilValue: state.tabCounter.value() })
					} else if (/d\.?\s*c\.?\s*al\s*fine/i.test(text)) {
						tokens.push({ type: 'Flow', style: 6,
							tickValue: state.tickCounter.value(),
							tabValue: state.tabCounter.value(),
							tabUntilValue: state.tabCounter.value() })
					} else if (/d\.?\s*s\.?\s*al\s*fine/i.test(text)) {
						tokens.push({ type: 'Flow', style: 9,
							tickValue: state.tickCounter.value(),
							tabValue: state.tabCounter.value(),
							tabUntilValue: state.tabCounter.value() })
					}
					break
				}
			}
		}
	}

	// Emit bare tempo from <sound> if no <metronome> was present
	if (soundTempo > 0) {
		tokens.push({
			type: 'Tempo',
			position: -7,
			placement: 0,
			duration: Math.round(soundTempo),
			note: 4,
			beatDuration: 0.25,  // quarter note in whole-note fractions
			tickValue: state.tickCounter.value(),
			tabValue: state.tabCounter.value(),
			tabUntilValue: state.tabCounter.value(),
		})
	}
}

// ---------------------------------------------------------------------------
// Barline Handler
// ---------------------------------------------------------------------------

function handleBarline(barlineEl, state, tokens, location) {
	const barStyle = xmlText(barlineEl, 'bar-style')
	const repeatEl = barlineEl.getElementsByTagName('repeat')[0]
	const endingEl = barlineEl.getElementsByTagName('ending')[0]

	let barlineCode = null

	if (repeatEl) {
		const dir = repeatEl.getAttribute('direction')
		if (dir === 'forward') {
			barlineCode = 4  // LocalRepeatOpen
		} else if (dir === 'backward') {
			barlineCode = 5  // LocalRepeatClose
		}
	} else if (barStyle) {
		switch (barStyle) {
			case 'light-light': barlineCode = 1; break      // Double
			case 'light-heavy': barlineCode = 3; break      // SectionClose
			case 'heavy-light': barlineCode = 2; break      // SectionOpen
			case 'heavy-heavy': barlineCode = 3; break      // SectionClose (approximate)
			case 'none': barlineCode = 0; break              // Hidden → normal
		}
	}

	if (barlineCode !== null) {
		const token = makeBarline(barlineCode, state.tickCounter, state.tabCounter)

		// Repeat count
		if (repeatEl) {
			const times = parseInt(repeatEl.getAttribute('times') || '2', 10)
			token.repeat = times
		}

		tokens.push(token)
	}

	// Endings (volta brackets)
	if (endingEl) {
		const endingType = endingEl.getAttribute('type')
		const endingNumber = endingEl.getAttribute('number') || '1'

		if (endingType === 'start') {
			// Parse ending numbers into bitmask
			const numbers = endingNumber.split(/[,\s]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n))
			let bitmask = 0
			for (const n of numbers) {
				bitmask |= (1 << (n - 1))
			}

			tokens.push({
				type: 'Ending',
				repeat: bitmask,
				style: bitmask,
				tickValue: state.tickCounter.value(),
				tabValue: state.tabCounter.value(),
				tabUntilValue: state.tabCounter.value(),
			})
		}
	}
}

// ---------------------------------------------------------------------------
// Forward / Backup (Multi-Voice) — Phase 3 placeholder
// ---------------------------------------------------------------------------

function handleForward(el, state) {
	const xmlDuration = xmlInt(el, 'duration', 0)
	if (xmlDuration > 0 && state.currentDivisions > 0) {
		const frac = new Fraction(xmlDuration, state.currentDivisions * 4)
		state.tickCounter.add(frac)
		state.tabCounter.add(frac)
	}
}

function handleBackup(el, state) {
	const xmlDuration = xmlInt(el, 'duration', 0)
	if (xmlDuration > 0 && state.currentDivisions > 0) {
		const frac = new Fraction(xmlDuration, state.currentDivisions * 4)
		state.tickCounter.subtract(frac)
		state.tabCounter.subtract(frac)
	}
}

// ---------------------------------------------------------------------------
// Ensure Initial Tokens
// ---------------------------------------------------------------------------

/**
 * Insert default initial clef/keysig/timesig if the file didn't provide them
 * in the first measure.
 */
function ensureInitialTokens(state, tokens) {
	let insertIdx = 0

	if (!state.hadInitialClef) {
		tokens.splice(insertIdx, 0, {
			type: 'Clef',
			clef: state.currentClef,
			octave: state.currentClefOctave,
			tickValue: 0,
			tabValue: 0,
			tabUntilValue: 0,
		})
		insertIdx++
	}

	if (!state.hadInitialKeySig) {
		const keySigToken = buildKeySigToken(0, state.currentClef, state.currentClefOctave)
		keySigToken.tickValue = 0
		keySigToken.tabValue = 0
		keySigToken.tabUntilValue = 0
		tokens.splice(insertIdx, 0, keySigToken)
		insertIdx++
	}

	if (!state.hadInitialTimeSig) {
		tokens.splice(insertIdx, 0, {
			type: 'TimeSignature',
			signature: `${state.currentTimeSigN}/${state.currentTimeSigD}`,
			group: state.currentTimeSigN,
			beat: state.currentTimeSigD,
			tickValue: 0,
			tabValue: 0,
			tabUntilValue: 0.25,
		})
	}
}
