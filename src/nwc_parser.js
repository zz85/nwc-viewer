import { NwcConstants } from './nwc_constants.js'

/**********************
 *
 *   Constants
 *
 **********************/

var CLEF_NAMES = {
	0: 'treble',
	1: 'bass',
	2: 'alto',
	3: 'tenor',
	4: 'percussion',
}

var DURATIONS = [1, 2, 4, 8, 16, 32, 64]
var ACCIDENTALS = {
	0: '#', // sharp
	1: 'b', // flat
	2: 'n', // neutral
	3: 'x', // double sharp ##
	4: 'v', // double flat bb
	5: '', //'auto'
}

var TokenParsers = {
	0: parseClef, // + 6
	1: parseKeySignature, // + 12
	2: parseBarline,
	3: parseEnding, // repeat
	4: parseInstrumentPatch, // instrument
	5: parseTimeSignature, // + 8 bytes
	6: parseTempo,
	7: parseDynamic,
	8: parseNote,
	9: parseRest, // 0x09
	10: parseChord, // 0x0a notechord
	11: parsePedal, // 0x0b SustainPedal
	12: parseFlow, // flow direction
	13: parseMidiInstruction, // 0x0d // MPC
	14: parseTempoVariance, // 0x0e // Fermata
	15: parseDynamicVariance, // 0x0f
	16: parsePerformanceStyle, // 0x10 performance
	17: parseText, // 0x11 text object
	18: parseRestChord, // 0x12
	// 19: User,
	// 20: Spacer,
	// 21: RestMultiBar,
	// 22: Boundary,
	// 23: Marker
}

function isVersionOneFive(reader) {
	return reader.data.header.version < 1.7
}

/**********************
 *
 *   Objects
 *
 **********************/
class Token {
	constructor(obj) {
		Object.assign(this, obj)
	}
}

class Clef extends Token {
	constructor(blend) {
		super(blend)
	}
}

/**********************
 *
 *   Token Modes
 *
 **********************/

function parseClef(reader) {
	return new Clef({
		type: 'Clef',
		clef: CLEF_NAMES[reader.readShort() & 7],
		octave: reader.readShort() & 3,
	})
}

function bitmapKeySignature(bitmap) {
	const AG = 'ABCDEFG'
	var names = []
	// bit map
	for (let i = 0; i < AG.length; i++) {
		if ((bitmap >> i) & 1) {
			names.push(AG.charAt(i))
		}
	}

	return names
}

function parseKeySignature(reader) {
	reader.set('type', 'KeySignature')
	var data = reader.readBytes(10)
	var flats = bitmapKeySignature(data[0])
	var sharps = bitmapKeySignature(data[2])
	reader.set('flats', flats)
	reader.set('sharps', sharps)

	var flatKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
	var sharpKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']

	if (flats.length) {
		reader.set('key', flatKeys[flats.length])
	} else if (sharps.length) {
		reader.set('key', sharpKeys[sharps.length])
	} else {
		reader.set('key', 'C')
	}
}

function parseBarline(reader) {
	var styleByte = reader.readByte()
	return new Token({
		type: 'Barline',
		barline: styleByte & 0x7F,
		systemBreak: (styleByte & 0x80) !== 0,
		repeat: reader.readByte(),
	})
}

function parseEnding(reader) {
	return new Token({
		type: 'Ending',
		repeat: reader.readByte(),
		style: reader.readByte(),
	})
}

function parseInstrumentPatch(reader) {
	reader.set('type', 'InstrumentPatch')
	var data = reader.readBytes(8)
}

function parseTimeSignature(reader) {
	reader.set('type', 'TimeSignature')

	var top = reader.readShort() // numerator
	var beats = Math.pow(2, reader.readShort()) // denominator
	reader.readShort()

	reader.set('group', top)
	reader.set('beat', beats)
	reader.set('signature', top + '/' + beats)
}

function parseTempo(reader) {
	// 5 bytes
	var position = reader.readSignedInt() // 2
	var placement = reader.readSignedInt() // 3
	var duration = reader.readShort() // 4-5 // value / duration
	var note = reader.readByte() // 6 // base / note

	reader.readLine() // ?

	return new Token({
		type: 'Tempo',
		position,
		placement,
		duration,
		note,
	})
}

function parseDynamic(reader) {
	var type = 'Dynamic'
	var version = reader.data.header.version
	var position, placement, style, velocity, volume
	
	if (version >= 1.7) {
		position = reader.readSignedInt()
		placement = reader.readSignedInt()
		style = reader.readByte()
		velocity = reader.readShort()
		volume = reader.readShort()
	} else {
		// v1.55 and earlier
		placement = reader.readByte()
		position = reader.readByte()
		velocity = reader.readShort()
		volume = reader.readShort()
		style = placement & 0x07
		placement = placement & (~0x07) // 0x10: Preserve Width
	}
	
	var dynamic = NwcConstants.DynamicLevels[style & 0x1F]

	return new Token({
		type,
		position,
		placement,
		style,
		velocity,
		volume,
		dynamic,
	})
}

function parseNote(reader) {
	reader.set('type', 'Note')
	var data = reader.readBytes(8)
	parseNoteValue(reader, data)
	if (isVersionOneFive(reader)) {
		reader.pos += 2
	}
}

function parseNoteValue(reader, data) {
	var byteDuration = data[0] // mDuration
	var extraAccidentalSpacing = (data[1] >> 4) & 0x0F // mData2[0] high nibble
	var extraNoteSpacing = data[1] & 0x0F // mData2[0] low nibble
	var byteMarking1 = data[2] // mData2[1]
	var byteMarking4 = data[3] // mData2[2] // beam slur stems
	var byteMarking2 = data[4] // mAttribute1[0] - accent tie staccato
	var byteMarking3 = data[5] // mAttribute1[1] - grace, tenuto
	var position = data[6] // mPos
	var byteMarking5 = data[7] // mAttribute2[0]

	var stemShift = byteMarking1 & 3
	var triplet = (byteMarking1 >> 2) & 3
	var stem = (byteMarking1 >> 4) & 3
	var lyricSyllable = (byteMarking4 >> 7) & 3 // 0x0180 bits

	var staccato = (byteMarking2 >> 1) & 1
	var tieEnd = (byteMarking2 >> 3) & 1
	var tieStart = (byteMarking2 >> 4) & 1
	var accent = (byteMarking2 >> 5) & 1

	var slur = byteMarking3 & 3
	var tenuto = (byteMarking3 >> 2) & 1
	var grace = (byteMarking3 >> 5) & 1

	var hasSlur = (byteMarking3 >> 7) & 1
	var hasTieDir = (byteMarking3 >> 6) & 1

	var beam = byteMarking4 & 3

	position = position > 127 ? 256 - position : -position
	reader.set('position', position)

	var accidental = ACCIDENTALS[byteMarking5 & 7]
	reader.set('accidental', accidental)
	var durationBit = byteDuration & 7

	reader.set('duration', DURATIONS[durationBit])

	var durationDotBit = byteMarking2

	var dots = durationDotBit & (1 << 2) ? 1 : durationDotBit & 1 ? 2 : 0

	reader.set('dots', dots)
	reader.set('stem', stem)
	reader.set('triplet', triplet)

	reader.set('tie', tieStart)
	if (tieEnd) reader.set('tieEnd', tieEnd)

	reader.set('staccato', staccato)
	reader.set('accent', accent)

	reader.set('tenuto', tenuto)
	reader.set('grace', grace)
	reader.set('slur', slur)

	// Additional articulation flags from unused bits in the note data
	var marcato = (byteMarking3 >> 3) & 1
	var sforzando = (byteMarking2 >> 6) & 1
	var staccatissimo = (byteMarking4 >> 4) & 1
	var crescendo = (byteMarking4 >> 2) & 1
	var diminuendo = (byteMarking4 >> 3) & 1
	var fermata = (byteMarking4 >> 5) & 1
	if (marcato) reader.set('marcato', marcato)
	if (sforzando) reader.set('sforzando', sforzando)
	if (staccatissimo) reader.set('staccatissimo', staccatissimo)
	if (crescendo) reader.set('crescendo', crescendo)
	if (diminuendo) reader.set('diminuendo', diminuendo)
	if (fermata) reader.set('fermata', fermata)
	
	// Store beam information
	if (beam) reader.set('beam', beam)

	// Store spacing if non-zero
	if (extraNoteSpacing) reader.set('extraNoteSpacing', extraNoteSpacing)
	if (extraAccidentalSpacing) reader.set('extraAccidentalSpacing', extraAccidentalSpacing)
	
	// Store lyric syllable control if not default
	if (lyricSyllable) reader.set('lyricSyllable', lyricSyllable)

	// NWC 2.0+ stem length
	if (byteMarking5 & 0x40) {
		var stemLength = reader.readByte()
		reader.set('stemLength', stemLength)
	}
}

function parseRest(reader) {
	reader.set('type', 'Rest')
	var data = reader.readBytes(8)
	parseNoteValue(reader, data)
}

function parseChord(reader) {
	reader.set('type', 'Chord')
	var data = reader.readBytes(10)

	var chords = data[8]
	var notes = new Array(chords)

	reader.set('chords', chords)
	reader.set('notes', notes)

	var pointer = reader.pointer
	// TODO make better pointer management

	for (var i = 0; i < chords; i++) {
		notes[i] = {}
		reader.pointer = pointer.notes[i]
		reader.skip()
		reader.skip(2)
		data = reader.readBytes(8)
		parseNoteValue(reader, data)
	}

	reader.pointer = pointer
	if (notes[0]) {
		reader.set('duration', notes[0].duration)
		reader.set('dots', notes[0].dots)
		reader.set('stem', notes[0].stem)
	}
}

function parseRestChord(reader) {
	reader.set('type', 'RestChord')
	var data = reader.readBytes(10)

	var chords = data[8]
	var notes = new Array(chords)

	reader.set('chords', chords)
	reader.set('notes', notes)

	var pointer = reader.pointer

	for (var i = 0; i < chords; i++) {
		notes[i] = {}
		reader.pointer = pointer.notes[i]
		reader.skip()
		reader.skip(2)
		data = reader.readBytes(8)
		parseNoteValue(reader, data)
	}

	reader.pointer = pointer
	if (notes[0]) {
		reader.set('duration', notes[0].duration)
		reader.set('dots', notes[0].dots)
	}
}

function parsePedal(reader) {
	reader.set('type', 'Pedal')
	var version = reader.data.header.version
	var pos, placement, style
	
	if (version >= 1.7) {
		pos = reader.readByte()
		placement = reader.readByte()
		style = reader.readByte()
	} else if (version <= 1.55) {
		pos = reader.readByte()
		reader.readByte() // unknown
		placement = reader.readByte()
		style = reader.readByte()
	} else {
		// v1.70
		pos = reader.readByte()
		placement = 0
		style = reader.readByte()
	}
	
	reader.set('pos', pos)
	reader.set('placement', placement)
	reader.set('sustain', style)
}

function parseFlow(reader) {
	reader.set('type', 'Flow')
	if (isVersionOneFive(reader)) {
		reader.set('pos', -8)
		reader.set('placement', 1)
		reader.set('style', reader.readShort())
		return
	}

	reader.set('pos', reader.readSignedInt())
	reader.set('placement', reader.readSignedInt())
	reader.set('style', reader.readShort())
}

function parseMidiInstruction(reader) {
	reader.set('type', 'MidiInstruction')
	var pos = reader.readByte()
	var placement = reader.readByte()
	var data = reader.readBytes(32)
}

function parseTempoVariance(reader) {
	reader.set('type', 'TempoVariance')
	var version = reader.data.header.version
	var style, pos, placement, delay
	
	if (version < 1.7) {
		style = reader.readByte()
		pos = reader.readByte()
		placement = reader.readByte()
		delay = reader.readByte()
		style = style & 0x0F
	} else {
		pos = reader.readByte()
		placement = reader.readByte()
		style = reader.readByte()
		delay = reader.readByte()
	}

	reader.set('pos', pos)
	reader.set('placement', placement)
	// Pre-v2.0 files store style values offset by -1; the native viewer adjusts style += 1 for values >= 1
	if (version < 2.0 && style >= 1) style = (style + 1) & 0xFF
	reader.set('style', style)
	reader.set('delay', delay)
}

function parseDynamicVariance(reader) {
	reader.set('type', 'DynamicVariance')
	var version = reader.data.header.version
	var style, pos, placement
	
	if (version < 1.7) {
		pos = reader.readByte()
		style = reader.readByte()
		placement = 0
	} else {
		pos = reader.readByte()
		placement = reader.readByte()
		style = reader.readByte()
	}
	
	reader.set('pos', pos)
	reader.set('placement', placement)
	reader.set('style', style)
}

function parsePerformanceStyle(reader) {
	reader.set('type', 'PerformanceStyle')
	var version = reader.data.header.version
	var style, pos, placement
	
	if (version < 1.7) {
		style = reader.readByte()
		pos = reader.readByte()
		placement = 0
	} else {
		pos = reader.readByte()
		placement = reader.readByte()
		style = reader.readByte()
	}

	reader.set('pos', pos)
	reader.set('placement', placement)
	reader.set('style', style)
	reader.set('text', NwcConstants.PerformanceStyle[style])
}

function parseText(reader) {
	reader.set('type', 'Text')
	var version = reader.data.header.version
	var position, font, preserveWidth, text
	
	if (version >= 1.7) {
		position = reader.readSignedInt()
		var data = reader.readByte()
		font = reader.readByte()
		// Parse bit fields from data byte
		preserveWidth = data & 0x01
	} else {
		// v1.55
		font = reader.readByte()
		position = reader.readByte()
		preserveWidth = font >> 4
		font = font & 0x0F
	}
	
	text = reader.readString()

	reader.set('position', position)
	reader.set('font', font)
	reader.set('text', text)
	if (preserveWidth) reader.set('preserveWidth', preserveWidth)
}

export { TokenParsers }
