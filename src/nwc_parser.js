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

var ENDINGS = [
	'SectionClose',
	'MasterRepeatClose',
	'Single',
	'Double',
	'Open hidden',
]

var DURATIONS = [1, 2, 4, 8, 16, 32, 64]
var ACCIDENTALS = {
	0: '#', // sharp
	1: 'b', // flat
	2: 'n', // neutral
	3: 'x', // double sharp ##
	4: 'v', // double flat bb
	5: '', //'auto'
}

var TOKENS = {
	0: Clef, // + 6
	1: KeySignature, // + 12
	2: Barline,
	3: Ending, // repeat
	4: InstrumentPatch, // instrument
	5: TimeSignature, // + 8 bytes
	6: Tempo,
	7: Dynamic,
	8: Note,
	9: Rest, // 0x09
	10: Chord, // 0x0a notechord
	11: Pedal, // 0x0b SustainPedal
	12: Flow, // flow direction
	13: MidiInstruction, // 0x0d // MPC
	14: TempoVariance, // 0x0e // Fermata
	15: DynamicVariance, // 0x0f
	16: PerformanceStyle, // 0x10 performance
	17: Text, // 0x11 text object
	18: RestChord, // 0x12
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
 *   Token Modes
 *
 **********************/

function Clef(reader) {
	reader.set('type', 'Clef')
	reader.set('clef', CLEF_NAMES[reader.readShort() & 3])
	reader.set('octave', reader.readShort() & 3)
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

function KeySignature(reader) {
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

function Barline(reader) {
	reader.set('type', 'Barline')
	reader.set('barline', reader.readByte() & 15)
	reader.set('repeat', reader.readByte())
}

function Ending(reader) {
	reader.set('type', 'Ending')
	reader.set('repeat', reader.readByte())
	reader.set('style', reader.readByte())
}

function InstrumentPatch(reader) {
	reader.set('type', 'InstrumentPatch')
	var data = reader.readBytes(8)
}

function TimeSignature(reader) {
	reader.set('type', 'TimeSignature')

	var top = reader.readShort() // numerator
	var beats = Math.pow(2, reader.readShort()) // denominator
	reader.readShort()

	reader.set('group', top)
	reader.set('beat', beats)
	reader.set('signature', top + '/' + beats)
}

function Tempo(reader) {
	reader.set('type', 'Tempo')
	// 5 bytes
	var position = reader.readSignedInt() // 2
	var placement = reader.readSignedInt() // 3
	var duration = reader.readShort() // 4-5 // value / duration
	var note = reader.readByte() // 6 // base / note

	reader.readLine() // ?

	reader.setObject({
		position,
		placement,
		duration,
		note,
	})
}

function Dynamic(reader) {
	reader.set('type', 'Dynamic')
	// 7 Bytes
	var position = reader.readSignedInt() // 1
	var placement = reader.readSignedInt() // 2
	var style = reader.readByte() & 7 // reader.readSignedInt(); // 3 dynamicRef
	var velocity = reader.readShort() // 4-5
	var volume = reader.readShort() // 6-7
	var dynamic = NwcConstants.DynamicLevels[style]

	reader.setObject({
		position,
		placement,
		style,
		velocity,
		volume,
		dynamic,
	})
}

function Note(reader) {
	reader.set('type', 'Note')
	var data = reader.readBytes(8)
	NoteValue(reader, data)
	if (isVersionOneFive(reader)) {
		reader.pos += 2
	}
}

function NoteValue(reader, data) {
	var position = data[6]
	position = position > 127 ? 256 - position : -position
	reader.set('position', position)

	var accidental = ACCIDENTALS[data[7] & 7]
	reader.set('accidental', accidental)
	var durationBit = data[0] & 7

	reader.set('duration', DURATIONS[durationBit])

	var tieStart = (data[4] >> 4) & 1
	var tieEnd = (data[4] >> 3) & 1

	var durationDotBit = data[4]

	var dots = durationDotBit & (1 << 2) ? 1 : durationDotBit & 1 ? 2 : 0

	reader.set('dots', dots)
	reader.set('stem', (data[2] >> 4) & 3)
	reader.set('triplet', (data[2] >> 2) & 3)

	reader.set('tie', tieStart)
	if (tieEnd) reader.set('tieEnd', tieEnd)

	reader.set('staccato', (data[4] >> 1) & 1)
	reader.set('accent', (data[4] >> 5) & 1)

	reader.set('tenuto', (data[5] >> 2) & 1)
	reader.set('grace', (data[5] >> 5) & 1)
	reader.set('slur', data[5] & 3)

	if (data[7] & 0x40) {
		console.log('more stemming info')
		reader.readByte()
	}
}

function Rest(reader) {
	reader.set('type', 'Rest')
	var data = reader.readBytes(8)
	NoteValue(reader, data)
}

function Chord(reader) {
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
		NoteValue(reader, data)
	}

	reader.pointer = pointer
	reader.set('duration', notes[0].duration)
	reader.set('dots', notes[0].dots)
}

function RestChord(reader) {
	reader.set('type', 'RestChord')
	var data = reader.readBytes(10)
	NoteValue(reader, data)
}

function Pedal(reader) {
	reader.set('type', 'Pedal')
	var pos = reader.readByte()
	var placement = reader.readByte()
	var style = reader.readByte()
	reader.set('sustain', style)
}

function Flow(reader) {
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

function MidiInstruction(reader) {
	reader.set('type', 'MidiInstruction')
	var pos = reader.readByte()
	var placement = reader.readByte()
	var data = reader.readBytes(32)
}

function TempoVariance(reader) {
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

function DynamicVariance(reader) {
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

function PerformanceStyle(reader) {
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

function Text(reader) {
	reader.set('type', 'Text')

	var position = reader.readSignedInt()
	var data = reader.readByte()
	var font = reader.readByte()
	var text = reader.readString()

	reader.set('position', position)
	reader.set('text', text)
}

export { TOKENS }
