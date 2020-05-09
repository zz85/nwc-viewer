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
		clef: CLEF_NAMES[reader.readShort() & 3],
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
	return new Token({
		type: 'Barline',
		barline: reader.readByte() & 15,
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
	// 7 Bytes
	var position = reader.readSignedInt() // 1
	var placement = reader.readSignedInt() // 2
	var style = reader.readByte() & 7 // reader.readSignedInt(); // 3 dynamicRef
	var velocity = reader.readShort() // 4-5
	var volume = reader.readShort() // 6-7
	var dynamic = NwcConstants.DynamicLevels[style]

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
	// data[1]                 // mData2[0] unused
	var byteMarking1 = data[2] // mData2[1]
	var byteMarking4 = data[3] // mData2[2] // beam slur stemss
	var byteMarking2 = data[4] // mAttribute1[0] - accent tie staccato
	var byteMarking3 = data[5] // mAttribute1[1] - grace, tenuto
	var position = data[6] // mPos
	var byteMarking5 = data[7] // mAttribute2[0]

	var stemShift = byteMarking1 & 3
	var triplet = (byteMarking1 >> 2) & 3
	var stem = (byteMarking1 >> 4) & 3

	var staccato = (byteMarking2 >> 1) & 1
	var tieEnd = (byteMarking2 >> 3) & 1
	var tieStart = (byteMarking2 >> 4) & 1
	var accent = (byteMarking2 >> 5) & 1

	var slur = byteMarking3 & 3
	var tenuto = (byteMarking3 >> 2) & 1
	var grace = (byteMarking3 >> 5) & 1

	var hasSlur = (byteMarking3 >> 7) & 1
	var hasTieDir = (byteMarking3 >> 6) & 1

	// console.log('tieEnd', tieEnd);
	// console.log('stats', beam)

	if (hasSlur) {
		if (byteMarking1 & 0x40) {
			// down
		} else {
			// up
		}
	}

	if (hasTieDir) {
		if (byteMarking5 & 0x08) {
			// tie dir down
		} else {
			// tie dir up
		}
	}

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

	if (byteMarking5 & 0x40) {
		console.log('more stemming info')
		reader.readByte()
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
	reader.set('duration', notes[0].duration)
	reader.set('dots', notes[0].dots)
}

function parseRestChord(reader) {
	reader.set('type', 'RestChord')
	var data = reader.readBytes(10)
	parseNoteValue(reader, data)
}

function parsePedal(reader) {
	reader.set('type', 'Pedal')
	var pos = reader.readByte()
	var placement = reader.readByte()
	var style = reader.readByte()
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
	var style, pos, placement, delay
	if (isVersionOneFive(reader)) {
		placement = reader.readByte()
		pos = reader.readByte()
	} else {
		pos = reader.readByte()
		placement = reader.readByte()
	}
	style = reader.readByte()
	delay = reader.readByte()

	reader.set('sustain', style)
}

function parseDynamicVariance(reader) {
	reader.set('type', 'DynamicVariance')

	var style, pos, placement
	if (isVersionOneFive(reader)) {
		style = reader.readByte()
		pos = reader.readByte()
	} else {
		pos = reader.readByte()
		placement = reader.readByte()
		style = reader.readByte()
	}
	reader.set('sustain', style)
}

function parsePerformanceStyle(reader) {
	reader.set('type', 'PerformanceStyle')

	var style, pos, placement
	if (isVersionOneFive(reader)) {
		style = reader.readByte()
		pos = reader.readByte()
	} else {
		pos = reader.readByte()
		placement = reader.readByte()
		style = reader.readByte()
	}

	reader.set('style', style)
	reader.set('text', NwcConstants.PerformanceStyle[style])
}

function parseText(reader) {
	reader.set('type', 'Text')

	var position = reader.readSignedInt()
	var data = reader.readByte()
	var font = reader.readByte()
	var text = reader.readString()

	reader.set('position', position)
	reader.set('text', text)
}

export { TokenParsers }
