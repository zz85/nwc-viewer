import Fraction from './fraction.js'
import tokenizeLyrics from './lyrics.js'
// Scanner / SightReader / Runner / PlayContext

/**********************
 *
 *  Do Some Parsing,
 *	that understands
 *  music
 *
 **********************/

var tabbableTypes = new Set([
	'Clef',
	'KeySignature',
	'TimeSignature',
	'Barline',
	'Chord',
])

var untabbableTypes = new Set([
	'StaffProperties',
	'StaffInstrument',
	'PerformanceStyle',
	'Dynamic',
	'Spacer',
	'Tempo',
	'Boundary',
	'Text',
	'Instrument',
	'DynamicVariance',
	'TempoVariance',
	'MidiInstruction',
])

var NOTE_NAMES = 'C D E F G A B'.split(' ')

function isTabbable(token) {
	const visible = token.Visibility !== 'Never'
	if (tabbableTypes.has(token.type)) {
		// visible &&
		return true
	} else {
		if (!untabbableTypes.has(token.type) && visible)
			console.log('NOT TABING', token.type)
		return false
	}
}

function interpret(dataOrContext) {
	// Support both legacy data object and new MusicContext
	const data = dataOrContext.getData ? dataOrContext.getData() : dataOrContext
	var staves = data.score.staves
	var reading = new SightReader()
	reading.read(staves)
	/*
	State

	- clef
	- key signature
	- notes (with accidentals)
	- barlines

	Tokens are tagged with following attributes
	- durValue. music time value note should be played for
	- tickValue. abs musical time value when it should be played (startTime)
	- tickUntilValue. abs musical timevalue music stops playing (endTime)
	- tabValue. (display "start time")
	- tabUntilValue (display "end time")
	*/
}

window.utils = window.utils || {}
window.utils.getScoreBar = function (n) {
	var tokens = data.score.staves[0].tokens
	var bar = 1

	var index
	tokens.some((token, i) => {
		if (bar === n) {
			index = i
			return true
		}

		if (token.type == 'Barline') {
			bar++
		}

		return false
	})

	if (index !== undefined) return tokens[index + 1]
}

window.utils.whichBar = function (find) {
	// tokens.indexOf(tokens.filter(x => x.tie)[0])
	var tokens = data.score.staves[0].tokens

	var bar = 1
	tokens.some((token, i) => {
		if (token === find) {
			return true
		}
		if (token.type == 'Barline') {
			bar++
		}

		return false
	})

	return bar
}

function SightReader() {
	// Note Streamer
	this.tickCounter = new Fraction(0, 1) // commutativeTickDuration
	this.tabCounter = new Fraction(0, 1) // commutativeTabDuration
	this.tmpFraction = new Fraction(0, 1)
	this.timeSigVal = new Fraction(4, 4)
	this.reset()
}

var lyricsToken

SightReader.prototype.read = function (staves) {
	staves.forEach((staff) => {
		this.reset()

		lyricsToken = null
		var lyrics = staff.lyrics
		if (lyrics && lyrics.length) {
			var firstLine = lyrics[0]
			if (Array.isArray(firstLine)) {
				// New parser: pre-split syllable array — each element maps 1:1 to
				// a note.  Prefix conventions:
				//   ' ' (space)    = word boundary
				//   '-' (hyphen)   = syllable continuation within a word
				//   '\r' (CR)      = new phrase/line
				// We strip whitespace/CR prefixes but keep '-' prefix so the
				// renderer can detect continuations and draw inter-note dashes.
				// A leading '-' becomes a trailing '-' on the previous syllable
				// (equivalent to the tokenizer's 'Glo-' format).
				lyricsToken = []
				for (var li = 0; li < firstLine.length; li++) {
					var raw = firstLine[li]
					var trimmed = raw.replace(/^[\s\r]+/, '')
					if (trimmed.startsWith('-')) {
						// Continuation syllable: mark previous token with trailing hyphen
						// and strip the leading hyphen from this syllable.
						if (lyricsToken.length > 0) {
							var prev = lyricsToken[lyricsToken.length - 1]
							if (!prev.endsWith('-')) {
								lyricsToken[lyricsToken.length - 1] = prev + '-'
							}
						}
						trimmed = trimmed.slice(1)
					}
					lyricsToken.push(trimmed)
				}
			} else {
				// Old parser: raw string that needs tokenizing
				lyricsToken = tokenizeLyrics(firstLine)
			}
		}
		staff.tokens.forEach((token) => {
			var type = token.type

			// absolute time value when note should be played
			token.tickValue = this.tickCounter.value()
			token.tabValue = this.tabCounter.value()

			if (type in this) {
				// calls corresponding token function
				this[type](token)
			}

			// if (token.type === 'Boundary') console.log('$$$', token);

			if (token.durValue) {
				// computes cumumutative value duration
				this.tickCounter.add(token.durValue).simplify()
				this.tabCounter.add(token.durValue).simplify()
			} else {
				if (isTabbable(token)) {
					this.tmpFraction.set(1, 4)
					this.tabCounter.add(this.tmpFraction).simplify()
				}
			}

			// token.tickUntilValue = this.tickCounter.value()
			token.tabUntilValue = this.tabCounter.value()
		})
	})
}

SightReader.prototype.reset = function () {
	this.setClef('treble')
	this.tickCounter.set(0, 1)
	this.tabCounter.set(0, 1)
	this.lastTimeSignature = null

	this.pitches = {}
	this.keySig = {}
	this.setKeySignature(['C'])
}

SightReader.prototype.setClef = function (clef, octaveShift) {
	this.clef = clef
	this.offset = CLEF_PITCH_OFFSETS[clef]
	// OctaveShift: 1 = Octave Up (8va), 2 = Octave Down (8vb)
	if (octaveShift === 1 || octaveShift === 'Octave Up') this.offset += 7
	else if (octaveShift === 2 || octaveShift === 'Octave Down') this.offset -= 7
}

SightReader.prototype.Clef = function (token) {
	this.setClef(token.clef, token.octave)
}

SightReader.prototype.TimeSignature = function (token) {
	this.lastTimeSignature = token
	// TODO account for Common / Cuttime
	if (!(token.group && token.beat)) {
		if (token.signature === 'Common') {
			token.group = 4
			token.beat = 4
		}
		if (token.signature === 'AllaBreve') {
			token.group = 2
			token.beat = 2
		}
	}

	this.timeSigVal.set(token.group, token.beat)
}

SightReader.prototype.Barline = function () {
	// reset
	this.pitches = {} // should reset??
}

const sharps = {
	C: [],
	G: ['f#'],
	D: ['f#', 'c#'],
	A: ['f#', 'c#', 'g#'],
	E: ['f#', 'c#', 'g#', 'd#'],
	B: ['f#', 'c#', 'g#', 'd#', 'a#'],
	'F#': ['f#', 'c#', 'g#', 'd#', 'a#', 'e#'],
	'C#': ['f#', 'c#', 'g#', 'd#', 'a#', 'e#', 'b#'],
}

const flats = {
	C: [],
	F: ['Bb'],
	Bb: ['Bb', 'Eb'],
	Eb: ['Bb', 'Eb', 'Ab'],
	Ab: ['Bb', 'Eb', 'Ab', 'Db'],
	Db: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
	Gb: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
	Cb: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
}

SightReader.prototype.setKeySignature = function (accidentals) {
	// Majors only!
	NOTE_NAMES.forEach((name) => {
		this.keySig[name.toUpperCase()] = ''
	})

	if (!accidentals || !accidentals.length) return
	accidentals.forEach((accidental, l) => {
		this.keySig[accidental.charAt(0).toUpperCase()] = accidental.charAt(1)
	})
}

SightReader.prototype.KeySignature = function (token) {
	var signature = token.key
	if (!signature) console.error('no key found for key signature', token)
	const accidentals = sharps[signature] || flats[signature]
	this.setKeySignature(accidentals)

	// reset
	token.accidentals = accidentals
	token.clef = this.clef
	token.clefOffset = this.offset
}

function circularIndex(n) {
	var m = 7
	return n < 0 ? (m - (-n % m)) % m : n % m
	/*
	0   1   2   3   4   5   6
	7   8   9   10  11  12  13
	-7  -6  -5  -4  -3  -2  -1
	-14 -13 -12 -11 -10 -9  -8
	*/
}

function octaveIndex(pitch) {
	if (pitch >= 0) return (pitch / 7) | 0

	/*
	0   1   2   3   4   5   6  => 0
	7   8   9   10  11  12  13 => 1
	-7  -6  -5  -4  -3  -2  -1 => -1
	-14 -13 -12 -11 -10 -9  -8 => -2
	*/
	// -1 => -1
	// -6 => -1
	// -7 => -2
	// -14 => -2
	// -15 => -3
	return -1 - (((-pitch - 1) / 7) | 0)
}

SightReader.prototype.Rest = function (token) {
	if (token.duration === 1) {
		// whole bar rest take into account time signature

		token.durValue = this.timeSigVal.clone()
		return
	}
	this._handle_duration(token)
}

SightReader.prototype.Chord = function (token) {
	this._handle_duration(token)

	// --- Lyric assignment for chords (NWC rules) ---
	// Chords get a syllable unless they contain tied notes from previous notes.
	// A chord with both rest+note is considered audible and gets a syllable.
	// lyricSyllable overrides: Always(1) forces, Never(2) skips.
	if (lyricsToken && lyricsToken.length) {
		var isSlurBeneficiary = token.slur === 2 || token.slur === 3
		var isTieBeneficiary = !!token.tieEnd

		// Also check if any child note has a tie end
		if (!isTieBeneficiary && token.notes) {
			isTieBeneficiary = token.notes.some(function(n) { return !!n.tieEnd })
		}

		var lyricSyl = token.lyricSyllable || 0
		var shouldAssign
		if (lyricSyl === 2) {
			shouldAssign = false
		} else if (lyricSyl === 1) {
			shouldAssign = true
		} else {
			shouldAssign = !isSlurBeneficiary && !isTieBeneficiary
		}

		if (shouldAssign) {
			var syllable = lyricsToken.shift()
			while (syllable && /^[-_]$/.test(syllable) && lyricsToken.length) {
				syllable = lyricsToken.shift()
			}
			if (syllable && !/^[-_]$/.test(syllable)) {
				token.text = syllable
			}
		}
	}

	// Resolve pitch for each note in the chord
	if (token.notes) {
		token.notes.forEach((note) => {
			if (note.position !== undefined) {
				var pitch = note.position + this.offset
				note.name = NOTE_NAMES[circularIndex(pitch)]
				note.octave = octaveIndex(pitch)
			}
		})
	}
}

var OCTAVE_START = 3
var OCTAVE_NOTES = 7

var CLEF_PITCH_OFFSETS = {
	treble: (OCTAVE_START + 1) * OCTAVE_NOTES + 6, // b'
	bass: (OCTAVE_START + 0) * OCTAVE_NOTES + 1, // d
	alto: (OCTAVE_START + 1) * OCTAVE_NOTES, // c'
	tenor: (OCTAVE_START + 0) * OCTAVE_NOTES + 5, // a'
	percussion: (OCTAVE_START + 0) * OCTAVE_NOTES + 1, // same middle line as bass per HLIL
}

SightReader.prototype.Note = function (token) {
	var pos = token.position

	var pitch = pos + this.offset

	if (pitch < 0) {
		console.log('Warning: negative pitch?')
	}

	var note_name = NOTE_NAMES[circularIndex(pitch)]
	var octave = octaveIndex(pitch)

	token.name = note_name
	token.octave = octave

	// rule - note, previous note in bar, octave note, keysignature
	var accidental = token.accidental
	var computedAccidental

	// Override
	if (accidental) {
		computedAccidental = accidental
		// set running pitch to accidental
		this.pitches[pitch] = accidental
	} else if (this.pitches[pitch] !== undefined) {
		// takes the running value from pitch
		computedAccidental = this.pitches[pitch]
	} else {
		var changed = this.keySig[note_name]
		if (changed) {
			computedAccidental = changed
		}
		// takes accidental value from key signature
	}

	token.accidentalValue = computedAccidental

	// --- Lyric assignment (NWC rules) ---
	// Per NWC spec:
	// - Only notes NOT the beneficiary of a slur or tie get a syllable.
	// - "Beneficiary" = slur end (2), slur mid (3), or tie end.
	// - Rests are ignored (handled in Rest handler, not here).
	// - Slur start (1) and tie start get a syllable normally.
	// - lyricSyllable: 0=Default (use rules above), 1=Always, 2=Never
	if (lyricsToken && lyricsToken.length) {
		var isSlurBeneficiary = token.slur === 2 || token.slur === 3
		var isTieBeneficiary = !!token.tieEnd

		// lyricSyllable overrides: Always(1) forces assignment, Never(2) forces skip
		var lyricSyl = token.lyricSyllable || 0
		var shouldAssign
		if (lyricSyl === 2) {
			shouldAssign = false // Never
		} else if (lyricSyl === 1) {
			shouldAssign = true  // Always
		} else {
			shouldAssign = !isSlurBeneficiary && !isTieBeneficiary // Default
		}

		if (shouldAssign) {
			var syllable = lyricsToken.shift()

			// Skip bare continuation markers (hyphens, underscores) that shouldn't
			// render as lyric text.  They indicate syllable continuation, not content.
			while (syllable && /^[-_]$/.test(syllable) && lyricsToken.length) {
				syllable = lyricsToken.shift()
			}
			// Don't assign bare markers as lyric text
			if (syllable && !/^[-_]$/.test(syllable)) {
				token.text = syllable
			}
		}
	}

	// duration of this note
	this._handle_duration(token)
}

SightReader.prototype._handle_duration = function (token) {
	// Guard against missing or zero duration: fall back to quarter note (4).
	// A zero denominator in Fraction(1, 0) propagates NaN through simplify()
	// and then triggers an infinite loop in GCD(NaN, NaN).
	var dur = token.duration
	if (!dur || !isFinite(dur) || dur <= 0) {
		console.warn('_handle_duration: invalid duration', dur, 'on token', token.type, '- defaulting to 4')
		dur = 4
	}
	token.durValue = new Fraction(1, dur)
	// Dotted: d * 3/2.  Double-dotted: d * 7/4 (NOT 3/2 * 3/2 = 9/4).
	if (token.dots === 2) {
		token.durValue.multiply(7, 4)
	} else if (token.dots === 1) {
		token.durValue.multiply(3, 2)
	}
	if (token.triplet) {
		token.durValue.multiply(2, 3)
	}
}

window.interpret = interpret

export { interpret }
