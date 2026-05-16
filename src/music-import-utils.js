/**
 * Shared constants and helper functions for XML-based music importers.
 *
 * Used by both musescore-parser.js (MuseScore native XML) and
 * musicxml-import.js (MusicXML / .mxl).
 */

import Fraction from './fraction.js'

// ---------------------------------------------------------------------------
// Duration Constants
// ---------------------------------------------------------------------------

/** Map duration type strings to NWC-style numeric durations */
export const DURATION_MAP = {
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

/** Map duration type to Fraction [numerator, denominator] */
export const DURATION_FRACTIONS = {
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

// ---------------------------------------------------------------------------
// Pitch / Clef Constants
// ---------------------------------------------------------------------------

export const OCTAVE_START = 3
export const OCTAVE_NOTES = 7

/**
 * NWC clef pitch offsets — same values as interpreter.js.
 * Used to compute staff position from absolute diatonic pitch.
 */
export const CLEF_PITCH_OFFSETS = {
	treble: (OCTAVE_START + 1) * OCTAVE_NOTES + 6,     // 34 → B4 at position 0
	bass: (OCTAVE_START + 0) * OCTAVE_NOTES + 1,       // 22 → D3 at position 0
	alto: (OCTAVE_START + 1) * OCTAVE_NOTES,            // 28 → C4 at position 0
	tenor: (OCTAVE_START + 0) * OCTAVE_NOTES + 5,      // 26 → A3 at position 0
	percussion: (OCTAVE_START + 0) * OCTAVE_NOTES + 1,
}

export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
export const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

export const ACCIDENTAL_STRINGS = { '-2': 'v', '-1': 'b', '0': '', '1': '#', '2': 'x' }

// ---------------------------------------------------------------------------
// Key Signature Constants
// ---------------------------------------------------------------------------

export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
export const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Map number of sharps/flats to key name */
export const KEY_NAMES_SHARP = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
export const KEY_NAMES_FLAT  = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']

// ---------------------------------------------------------------------------
// Pitch / Position Helpers
// ---------------------------------------------------------------------------

/**
 * Compute NWC staff position from note name, octave, and clef.
 * position = diatonicPitch - clefOffset
 * diatonicPitch = octave * 7 + NOTE_INDEX[name]
 */
export function computePosition(name, octave, clef, octaveShift) {
	const diatonicPitch = octave * 7 + NOTE_INDEX[name]
	let offset = CLEF_PITCH_OFFSETS[clef] || CLEF_PITCH_OFFSETS.treble
	if (octaveShift === 1) offset += 7      // 8va
	else if (octaveShift === 2) offset -= 7 // 8vb
	return diatonicPitch - offset
}

// ---------------------------------------------------------------------------
// Key Signature Helpers
// ---------------------------------------------------------------------------

/**
 * Build a KeySignature token from an accidental count (positive = sharps,
 * negative = flats) and the current clef.
 */
export function buildKeySigToken(accidentalCount, clef, clefOctave) {
	let key, sharps = [], flats = [], accidentals = []

	if (accidentalCount > 0) {
		key = KEY_NAMES_SHARP[accidentalCount] || 'C'
		for (let i = 0; i < accidentalCount && i < 7; i++) {
			sharps.push(SHARP_ORDER[i])
			accidentals.push(SHARP_ORDER[i].toLowerCase() + '#')
		}
	} else if (accidentalCount < 0) {
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
// Duration / Timing Helpers
// ---------------------------------------------------------------------------

/**
 * Create a Fraction for a given duration type and dot count.
 */
export function makeDurationFraction(durType, dots) {
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
export function setTiming(token, durFraction, tickCounter, tabCounter) {
	token.durValue = durFraction.clone()

	token.tickValue = tickCounter.value()
	token.tabValue = tabCounter.value()

	tickCounter.add(durFraction)
	tabCounter.add(durFraction)

	token.tabUntilValue = tabCounter.value()
}

/**
 * Make a barline token.
 */
export function makeBarline(style, tickCounter, tabCounter) {
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
 * Make a whole-bar rest using the current time signature.
 */
export function makeWholeBarRest(timeSigN, timeSigD, tickCounter, tabCounter) {
	const durFraction = new Fraction(timeSigN, timeSigD)

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

// ---------------------------------------------------------------------------
// XML Helpers
// ---------------------------------------------------------------------------

/** Get text content of first child element with given tag name */
export function xmlText(parent, tagName) {
	const el = parent.getElementsByTagName(tagName)[0]
	return el ? el.textContent.trim() : ''
}

/** Get integer from child element */
export function xmlInt(parent, tagName, defaultVal) {
	const text = xmlText(parent, tagName)
	if (text === '') return defaultVal !== undefined ? defaultVal : 0
	return parseInt(text, 10)
}

/** Get float from child element */
export function xmlFloat(parent, tagName, defaultVal) {
	const text = xmlText(parent, tagName)
	if (text === '') return defaultVal !== undefined ? defaultVal : 0
	return parseFloat(text)
}

/** Get direct child elements (not nested descendants) with given tag name */
export function directChildren(parent, tagName) {
	const result = []
	const nodes = parent.childNodes
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].nodeType === 1 && nodes[i].tagName === tagName) result.push(nodes[i])
	}
	return result
}

/** Iterate direct child elements of a parent node */
export function forEachChildElement(parent, callback) {
	const nodes = parent.childNodes
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].nodeType === 1) callback(nodes[i])
	}
}

/** Convert a NodeList to a real array (for..of compatible) */
export function toArray(nodeList) {
	const arr = []
	for (let i = 0; i < nodeList.length; i++) arr.push(nodeList[i])
	return arr
}
