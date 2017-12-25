// Scanner / SightReader / Runner / PlayContext

/**********************
 *
 *  Do Some Parsing,
 *	that understands
 *  music
 *
 **********************/

var tabbableTypes = new Set([
	'Clef', 'KeySignature', 'TimeSignature', 'Barline',
	'Chord',
])

var untabbableTypes = new Set([
	'StaffProperties', 'StaffInstrument', 'PerformanceStyle', 'Dynamic', 'Spacer', 'Tempo',
	'Boundary', 'Text', 'Instrument', 'DynamicVariance', 'TempoVariance', 'MidiInstruction'
])

function isTabbable(token) {
	const visible = token.Visibility !== 'Never'
	if (visible && tabbableTypes.has(token.type)) {
		return true
	}
	else {
		if (!untabbableTypes.has(token.type) && visible) console.log('NOT TABING', token.type);
		return false;
	}
}

function interpret(data) {
	var staves = data.score.staves;

	/*
	State

	- clef
	- key signature
	- notes (with accidentals)
	- barlines

	Tokens are tagged with following attributes
	- tickValue. abs musical time value when it should be played
	- durValue. music time value note should be played for
	- tickUntilValue. abs musical timevalue music stops playing
	- tabValue
	- tabUntilValue
	*/

	var reading = new SightReader();

	// TODO move this into reader itself
	staves.forEach(function(staff) {
		reading.reset();
		staff.tokens.forEach(function(token) {
			var type = token.type;

			// absolute time value when note should be played
			token.tickValue = reading.tickCounter.value();
			token.tabValue = reading.tabCounter.value();

			if (type in reading) {
				// calls corresponding token function
				reading[type](token);
			}

			// if (token.type === 'Boundary') console.log('$$$', token);

			if (token.durValue) {
				// computes cumumutative value duration
				reading.tickCounter.add(token.durValue).simplify()
				reading.tabCounter.add(token.durValue).simplify()
			}
			else {
				if (isTabbable(token)) {
					reading.tmpFraction.set(1, 4);
					reading.tabCounter.add(reading.tmpFraction).simplify()
				}
			}

			token.tickUntilValue = reading.tickCounter.value();
			token.tabUntilValue = reading.tabCounter.value();
		});
	});
};

function SightReader() {
	// Note Streamer
	this.tickCounter = new Fraction(0, 1); // commutativeTickDuration
	this.tabCounter = new Fraction(0, 1); // commutativeTabDuration
	this.tmpFraction = new Fraction(0, 1);
	this.reset();
}

SightReader.prototype.reset = function() {
	this.setClef('treble');
	this.tickCounter.set(0, 1);
	this.tabCounter.set(0, 1);
	this.lastTimeSignature = null;

	this.pitches = {};
	this.keySig = {};
	NOTE_NAMES.forEach(name => { this.keySig[name.toUpperCase()] = '' });
}

SightReader.prototype.setClef = function(clef) {
	this.clef = clef;
	this.offset = CLEF_PITCH_OFFSETS[clef]
}

SightReader.prototype.Clef = function(token) {
	this.setClef(token.clef);
};

SightReader.prototype.TimeSignature = function(token) {
	this.lastTimeSignature = token;
	this.timeSigVal = new Fraction(token.group, token.beat).value()
}

SightReader.prototype.Barline = function() {
	// reset
	this.pitches = {}; // should reset??
};

SightReader.prototype.KeySignature = function(token) {
	NOTE_NAMES.forEach(name => { this.keySig[name.toUpperCase()] = '' });
	// set TO flats or sharps
	console.log('TODO please insert key signature mapping here!!!');
	this.keySig['F'] = '#'
	// this.keySig['B'] = 'b'
	// this.keySig['E'] = 'b'
	// ['F', 'C', 'G', 'D', 'A', 'E'].forEach(t => 
	// 	this.keySig[t] = '#')

	// reset
	this.key = token.signature;
	token.clef = this.clef;
	token.clefOffset = this.offset;
};

function circularIndex(n) {
	var m = 7;
	return n < 0 ? (m - (-n % m)) % m : n % m;
	/*
	0   1   2   3   4   5   6
	7   8   9   10  11  12  13
	-7  -6  -5  -4  -3  -2  -1
	-14 -13 -12 -11 -10 -9  -8
	*/
}

function octaveIndex(pitch) {
	if (pitch >= 0) return pitch / 7 | 0;

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
	return -1 - ((-pitch - 1) / 7 | 0);
}

SightReader.prototype.Rest = function(token) {
	// TODO take into account rest value
	// this.timeSigVal

	this._handle_duration(token)
}

SightReader.prototype.Chord = function(token) {
	this._handle_duration(token);
}

var OCTAVE_START = 3;
var OCTAVE_NOTES = 7;

var CLEF_PITCH_OFFSETS = {
	treble: (OCTAVE_START + 1) * OCTAVE_NOTES + 6, // b'
	bass: (OCTAVE_START + 0) * OCTAVE_NOTES + 1, // d
	alto: (OCTAVE_START + 1) * OCTAVE_NOTES, // c'
	tenor: (OCTAVE_START + 0) * OCTAVE_NOTES + 5 // a'
}

SightReader.prototype.Note = function(token) {
	var pos = token.position
	
	var pitch = pos + this.offset;

	if (pitch < 0) {
		console.log('Warning: negative pitch?');
	}

	var note_name = NOTE_NAMES[circularIndex(pitch)];
	var octave = octaveIndex(pitch);

	token.name = note_name;
	token.octave = octave;

	// rule - note, previous note in bar, octave note, keysignature
	var accidental = token.accidental;
	var computedAccidental;

	// Override
	if (accidental) {
		computedAccidental = accidental;
		// set running pitch to accidental
		this.pitches[pitch] = accidental;
	}
	else if (this.pitches[pitch] !== undefined) {
		// takes the running value from pitch
		computedAccidental = this.pitches[pitch];
	}
	else {
		var changed = this.keySig[note_name];
		if (changed) {
			computedAccidental = changed
		}
		// takes accidental value from key signature
	}

	token.accidentalValue = computedAccidental;

	// duration of this note
	this._handle_duration(token);
};

SightReader.prototype._handle_duration = function(token) {
	token.durValue = new Fraction(1, token.duration);
	for (var i = 0; i < token.dots; i++) {
		token.durValue.multiply(3, 2);
	}
}
