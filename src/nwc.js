/**********************
 *
 *   Constants
 *
 **********************/

var NODE = typeof module !== 'undefined';
var BROWSER = typeof window !== 'undefined';

var TOKENS = {
	0: Clef,
	1: KeySignature,
	2: Barline,
	3: Repeat,
	4: InstrumentPatch,
	5: TimeSignature,
	6: Tempo,
	7: Dynamic,
	8: Note,
	9: Rest, // 0x09
	10: Chord, // 0x0a
	11: Pedal, // 0x0b
	12: Unknown,
	13: MidiInstruction, // 0x0d
	14: Fermata, // 0x0e
	15: DynamicVariance, // 0x0f
	16: PerformanceStyle, // 0x10
	17: Text, // 0x11
	18: RestChord, // 0x12
};

var CLEF_NAMES = {
	0: 'treble',
	1: 'bass',
	2: 'alto',
	3: 'tenor',
};

var CLEF_OFFSETS = {
	'treble': 0,
	'bass': 7,
	'alto': -7,
	'tenor': 4,
};

var STYLES = [
	'Regular',
	'Italic',
	'Bold',
	'Bold Italic'
];

var ENDINGS = [
	'SectionClose',
	'MasterRepeatClose',
	'Single',
	'Double',
	'Open hidden'
];

var DURATIONS = [
	1,
	2,
	4,
	8,
	16,
	32,
	64,
];

var ACCIDENTALS = [
	'#',
	'b',
	'n', // neutral
	'##',
	'bb',
	'', //'auto'
];

var NAMES = 'C D E F G A B'.split(' ');

/*
var clefs = {
	0: "b'",
	1: 'd',
	2: "c'",
	3: "a'",
}

var TIME_SIG_VALUES = {
	'4/4': '1',
	'3/4': '2.',
	'2/4': '2',
	'1/4': '1',
	'6/4': '2.',
	'5/4': 1,
	'1/8': '8',
	'2/8': '4',
	'3/8': '4.',
	'6/8': '2.',
	'4/8': '2',
	'9/8': '12',
	'12/8': '1',
	'2/2': '1',
	'4/2': '0',
	'1/2': '2',
}


var CLEF_OCTAVE = ('', '^8', '_8', '')
var CLEF_SHIFT = (0, 7, -7, 0)
*/


function decodeNwcArrayBuffer(arrayBuffer) {
	var byteArray = new Uint8Array(arrayBuffer);
	var firstBytes = shortArrayToString(byteArray.subarray(0, 5));
	if ('[NWZ]' === firstBytes) {
		var nwz = byteArray.subarray(6);
		if (BROWSER) {
			var inflate = new Zlib.Inflate(nwz);
			var plain = inflate.decompress();
		}
		if (NODE) {
			var plain = require('zlib').inflateSync(new Buffer(nwz));
		}

		return processNwc(plain);
	} else if ('[Note' === firstBytes) {
		return processNwc(byteArray);
	} else {
		console.log('Unrecognized headers');
	}
}

function shortArrayToString(array) {
	return String.fromCharCode.apply(null, array);
}

/**********************
 *
 *   Start Data Process
 *
 **********************/


function processNwc(array) {
	var reader = new DataReader(array);
	if (BROWSER) window.reader = reader;

	/*
	// dump
	for (;reader.pos < reader.array.length;) {
		reader.dump();
		reader.skip(80)
	}
	return
	*/

	Header(reader);
	if (reader.data.header.version >= 2.7) {
		console.log('done', reader.data)
		var nwctext = String.fromCharCode(...reader.readLine());
		// console.log(nwctext);
		reader.set('nwctext', nwctext);
		parseNwc275(reader, nwctext);
		convert275Tokens(reader);

		return reader.data;
	}
	Info(reader);
	PageSetup(reader);
	Score(reader);

	// start parsing
	var data = reader.data;

	return data;
}

function parseNwc275(reader, nwctext) {
	var lines = nwctext.split('\r\n');

	var first = lines.shift();

	if (!(first.match(/\!NoteWorthyComposer/))) {
		console.log('bad start format');
	}

	reader.descend('score');
	reader.set('fonts', []);
	reader.set('staves', []);

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (line === '!NoteWorthyComposer-End') {
			console.log('Processed', i, 'nwctext lines');
			break;
		}

		var parts = line.split('|');
		var type = parts[1];
		var obj = { type };

		reader.token('type', type);

		for (var j = 2; j < parts.length; j++) {
			var kv = parts[j].split(':');
			obj[kv[0]] = kv[1];
			reader.token(kv[0], kv[1]);
		}

		reader.token('next');
		// console.log(i, parts);
	}
}

function convert275Tokens(reader) {
	var data = reader.data;

	data.score.staves.forEach(stave => {
		stave.tokens = stave.tokens.map(mapTokens);
	});
}

var durs = {
	Whole: 1,
	Half: 2,
	'4th': 4,
	'8th': 8,
	'16th': 16
};

function parseDur(dur) {
	var parts = dur.split(',');

	var duration = durs[parts[0]];
	var dots = 0;
	if (parts[1]) {
		if (parts[1] === 'dotted') {
			dots++;
		}
	}

	if (!duration) console.log('!!', token.Dur);

	return {
		duration, dots
	}
}

function mapTokens(token) {
	var type = token.type;
	switch (type) {
		case 'Clef':
			token = {
				type,
				clef: token.Type.toLowerCase(),
				octave: token.OctaveShift || 0
			}
			// Octave Down
			break;
		case 'TimeSig':
			var parts = token.Signature.split('/')
			// console.log('parts', parts);
			// AllaBreve
			token = {
				type: 'TimeSignature',
				signature: token.Signature
			};

			if (parts.length === 2) {
				token.group = parts[0];
				token.beat = parts[1];
			}

			break;
		case 'Note':
			token.position = +token.Pos;
			Object.assign(token, parseDur(token.Dur));
			// console.log(token.Opts);
			// slur lyric beam stem

			break;
		case 'Bar':
			token.type = 'Barline';
			break;
		case 'Rest':
			return Object.assign({
				type,
				position: 0
			}, parseDur(token.Dur));
		case 'Key':
			return {
				type: 'KeySignature',
				signature: token.Signature
			};
			console.log('KEY', token);
	}
	return token;
}

/**********************
 *
 *  Do Some Parsing,
 *	that understands
 *  music
 *
 **********************/

var tabableTypes = new Set([
	'Clef', 'KeySignature', 'TimeSignature', 'Barline', 
])

var untabableTypes = new Set([
	'StaffProperties', 'StaffInstrument', 'PerformanceStyle', 'Dynamic', 'Spacer', 'Tempo',
	'Boundary', 'Text',
])

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

	staves.splice(2, 1);
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

			if (token.type === 'Boundary') console.log('$$$', token);

			if (token.durValue) {
				// computes cumumutative value duration
				reading.tickCounter.add(token.durValue).simplify()
				reading.tabCounter.add(token.durValue).simplify()
			}
			else {
				// type dynamic
				// if (token.Visibility !== 'Never' && token.type !== 'Text' && token.type !== 'Spacer') {
				if (token.Visibility !== 'Never' && tabableTypes.has(token.type)) {
					reading.tmpFraction.set(1, 4);
					reading.tabCounter.add(reading.tmpFraction).simplify()
				}
				else {
					if (!untabableTypes.has(token.type)) console.log('NOT TABING', token.type);
					// return
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
}

SightReader.prototype.setClef = function(clef) {
	this.clef = clef;
	this.offset = CLEF_OFFSETS[clef];
	this.pitches = {};
}

SightReader.prototype.Clef = function(token) {
	this.setClef(token.clef);
};

SightReader.prototype.Barline = function() {
	// reset
	this.pitches = {};
};

SightReader.prototype.KeySignature = function(token) {
	// reset
	this.key = token.signature;
	token.clef = this.clef;
	token.clefOffset = this.offset;
};

function circularIndex(n) {
	var m = 7;
	return n < 0 ? m - (n % m) : n % m;
	/*
	[ -2 -1 0 1 2 3 4 5 ]
	[  5  6 0 1 2 3 ]
	[  2  1 ]
	n < 0 ? m - (n % m) : n % m
	*/
}

SightReader.prototype.Rest = function(token) {
	this._handle_duration(token)
}

SightReader.prototype.Note = function(token) {
	var pos = token.position
	var OCTAVE_START = 4;
	var pitch = pos + this.offset;
	// console.log(token.position, this.offset, pitch)
	pitch += 7 * OCTAVE_START;

	if (pitch < 0) {
		console.log('Pitch should not be negative!!!');
	}

	var note_name = NAMES[circularIndex(pitch)];
	var octave = pitch / 7 | 0;

	token.name = note_name;
	token.octave = octave;

	// rule - note, previous note in bar, octave note, keysignature
	var accidental = token.accidental;

	// Override
	if (accidental < 6) {
		this.pitches[pitch] = accidental;
	}
	else if (this.pitches[pitch] !== undefined) {
		accidental = this.pitches[pitch];
	}
	else {
		// key signature
	}

	accidental = ACCIDENTALS[accidental];
	token.accidental = accidental;
	// console.log('accidental', accidental);

	// duration of this note
	this._handle_duration(token);	
};

SightReader.prototype._handle_duration = function(token) {
	token.durValue = new Fraction(1, token.duration);
	for (var i = 0; i < token.dots; i++) {
		token.durValue.multiply(3, 2);
	}
}


/**********************
 *
 *   Parse Modes
 *
 **********************/

// version 4
// 3 7 8
function Header(reader) {
	// for (var i = 0; i < 25; i ++) {
	// 	var line = reader.readLine();
	// 	console.log(i, 'line', line, shortArrayToString(line), reader.pos);
	// }
	// return

	reader.descend('header');
	reader.set('company', reader.readString());
	var skip = shortArrayToString(reader.readLine());
	skip = shortArrayToString(reader.readLine());
	reader.set('product', reader.readString());

	var v = reader.readLine();
	// var v = reader.readBytes(2);

	reader.skip(2);
	reader.set('name1', reader.readString());
	reader.set('name2', reader.readString());
	reader.skip(8);
	reader.skip(2);

	var version_minor = v[0];
	var version_major = v[1];
	version = version_major + version_minor * 0.01;
	console.log('Detected NWC version', version);
	reader.set('version', version);
}

function Info(reader) {
	reader.descend('info');
	reader.set('title', reader.readString());
	reader.set('author', reader.readString());
	reader.set('copyright1', reader.readString());
	reader.set('copyright2', reader.readString());
	if (version >= 2) {
		reader.set('something', reader.readString());
	}
	reader.set('comments', reader.readString());
	console.log(reader.data);
}

function PageSetup(reader) {
	reader.descend('page_setup');
	// margins =
	Margins(reader);
	// staffSize =
	Fonts(reader);
}

function Margins(reader) {
	reader.skip(9);
	reader.set('measureStart', reader.readByte());
	reader.skip(1); // likely 0
	margins = reader.readString();
	margins = margins.split(' ').map(function(x) {
		return +x;
	});
	reader.set('margins', margins);
}

function Fonts(reader) {
	reader.skip(36);
	reader.set('staff_size', reader.readByte());
	reader.skip(1);

	var fonts = [], font, style, size, typeface;
	for (var i = 0; i < 12; i++) {
		font = reader.readString();
		style = STYLES[reader.readByte() & 3];
		size = reader.readByte();
		reader.skip(1);
		typeface = reader.readByte();

		fonts.push({
			font: font,
			style: style,
			size: size,
			typeface: typeface
		});
	}
	reader.set('fonts', fonts);
}

function Score(reader) {
	reader.descend('score');

	reader.readUntil(0xff);
	reader.readBytes(2);
	reader.set('layering', reader.readByte(1));

	var staves = reader.readShort();
	console.log('Detected Staves', staves);

	reader.set('staves', new Array(staves));

	for (var i = 0; i < staves; i++) {
		console.log('STAFFF', i);
		StaffInfo(reader, i);
	}

	console.log(reader.pos, '/', reader.array.length);
}

function StaffInfo(reader, staff) {
	reader.descend('score.staves.' + staff);
	reader.set('staff_name', reader.readString());
	reader.set('group_name', reader.readString());
	reader.set('end_bar', reader.readByte() & 7);
	reader.set('muted', !!(reader.readByte() & 1));
	reader.skip(1);
	reader.set('channel', reader.readByte());
	reader.skip(9);
	reader.set('staff_type', reader.readByte() & 3);
	reader.skip(1);

	reader.set('uppersize', 256 - reader.readByte());
	reader.readUntil(0xff);
	reader.set('lowersize', reader.readByte());
	reader.skip(1);
	reader.set('lines', reader.readByte());
	reader.set('layer', !!(reader.readByte() & 1));
	reader.set('part_volume', reader.readByte());
	reader.skip(1);
	reader.set('stero_pan', reader.readByte());
	if (reader.data.header.version === 1.7) {
		reader.skip(2);
	} else {
		reader.skip(3);
	}

	reader.skip(2);
	var lyrics = reader.readShort();
	var noLyrics = reader.readShort();

	console.log('noLyrics', noLyrics);

	if (lyrics) {
		var lyricsOption = reader.readShort();
		reader.skip(3);

		for (var i = 0; i < noLyrics; i++) {
			var lyrics = [];
			lyrics.push(Lyrics(reader));
			reader.set('lyrics', lyrics);
		}
		reader.skip(1);
	}

	reader.skip();
	reader.set('color', reader.readByte() & 3);

	var tokens = reader.readShort();
	reader.set('tokens', []);


	for (var i = 0; i < tokens - 2; i++) {
		if (reader.data.header.version === 1.7) {
			reader.skip(2);
		}
		var token = reader.readByte();

		reader.descend('score.staves.' + staff + '.tokens.' + i);
		var func = TOKENS[token];

		if (func) {
			func(reader);
		} else {
			reader.dump();
			console.log('Warning, token not recongnized', token, reader.pos);
			return;
		}

		// if (func == Rest) i--;
	}
}
/**********************
 *
 *   Token Modes
 *
 **********************/

function Clef(reader) {
	reader.set('type', 'Clef');
	var data = reader.readBytes(6);
	reader.set('clef', CLEF_NAMES[data[2] & 3]);
	reader.set('octave', data[4] & 3);
}

function KeySignature(reader) {
	reader.set('type', 'KeySignature');
	var data = reader.readBytes(12);
	reader.set('flats', data[2]);

	var sharps = data[4];
	const AG = 'ABCDEFG';
	var names = [];
	// bit map
	for (let i = 0; i < AG.length; i++) {
		if ((sharps >> i) & 1) {
			names.push(AG.charAt(i));
		}
	}
	reader.set('sharps', names);
}

function Barline(reader) {
	reader.set('type', 'Barline');
	var data = reader.readBytes(4);
	reader.set('barline', data[2] & 15);
}

function Repeat(reader) {
	reader.set('type', 'Repeat');
	var data = reader.readBytes(4);
	reader.set('repeat', data[2]);
}

function InstrumentPatch(reader) {
	reader.set('type', 'InstrumentPatch');
	var data = reader.readBytes(10);
}

function TimeSignature(reader) {
	reader.set('type', 'TimeSignature');
	var data = reader.readBytes(8);

	var beats = Math.pow(2, data[4]);

	reader.set('group', data[2]);
	reader.set('beat', beats);
	reader.set('signature', data[2] + '/' + beats);

}

function Tempo(reader) {
	reader.set('type', 'Tempo');
	var data = reader.readBytes(7);
	reader.readLine(); // ?

	reader.set('note', data[6]);
	reader.set('duration', data[4]);
}

function Dynamic(reader) {
	reader.set('type', 'Dynamic');
	var data = reader.readBytes(9);
	reader.set('dynamic', data[4] & 7);
}


function Note(reader) {
	reader.set('type', 'Note');
	var data = reader.readBytes(10);
	NoteValue(reader, data);
}

function NoteValue(reader, data) {
	var position = data[8];
	position = position > 127 ? 256 - position : - position;
	reader.set('position', position);

	var accidental = data[9] & 7;
	reader.set('accidental', accidental);
	var durationBit = data[2] & 7;

	reader.set('duration', DURATIONS[durationBit]);

	var durationDotBit = data[6];

	var dots = durationDotBit & 1 << 2 ? 1 :
		durationDotBit & 1 ? 2 :
			0;

	reader.set('dots', dots);
	reader.set('stem', data[4] >> 4 & 3);
	reader.set('triplet', data[4] >> 2 & 3);
	reader.set('tie', data[6] >> 4 & 1);

	reader.set('staccato', data[6] >> 1 & 1);
	reader.set('accent', data[6] >> 5 & 1);
	reader.set('tenuto', data[7] >> 2 & 1);
	reader.set('grace', data[7] >> 5 & 1);
	reader.set('slur', data[7] & 3);
}


function Rest(reader) {
	reader.set('type', 'Rest');
	var data = reader.readBytes(10);
	NoteValue(reader, data);
}

function Chord(reader) {
	////
	reader.set('type', 'Chord');
	var data = reader.readBytes(12);

	var chords = data[10];
	// NoteValue(reader, data);
	reader.set('chords', chords);
	reader.set('notes', new Array(chords));

	var pointer = reader.pointer;
	// TODO make better pointer management

	for (var i = 0; i < chords; i++) {
		pointer.notes[i] = {}
		reader.pointer = pointer.notes[i]
		reader.skip();
		data = reader.readBytes(10);
		NoteValue(reader, data)
	}

	reader.pointer = pointer;
}

function RestChord(reader) {
	reader.set('type', 'RestChord');
	var data = reader.readBytes(12);
	NoteValue(reader, data);
}

function Pedal(reader) {
	reader.set('type', 'Pedal');
	var data = reader.readBytes(5);
	reader.set('sustain', data[4]);
}

function Unknown(reader) {
	reader.set('type', 'Unknown');
	// TODO
	// console.log('Unknown');
	// reader.dump();
	var data = reader.readBytes(6);
	// 4 5 6* 11*
	// reader.set('Unknown', data[4]);
}

function MidiInstruction(reader) {
	reader.set('type', 'MidiInstruction');
	var data = reader.readBytes(36);
}

function Fermata(reader) {
	reader.set('type', 'Fermata');
	var data = reader.readBytes(6);
	// TODO
	reader.set('sustain', data[4]);
}

function DynamicVariance(reader) {
	reader.set('type', 'DynamicVariance');
	var data = reader.readBytes(5);
	reader.set('sustain', data[4]);
	// TODO
}

function PerformanceStyle(reader) {
	reader.set('type', 'PerformanceStyle');
	var data = reader.readBytes(5);
	reader.set('style', data[4]);
	// TODO
}

function Text(reader) {
	reader.set('type', 'Text');
	reader.skip(2);
	reader.set('position', reader.readByte());
	reader.skip(2);
	reader.set('text', reader.readString());
}


// TODO
// Clef.type = 'Clef'
// Clef.token = 0
// Clef.load(stream);
// Clef.write();

function Lyrics(reader) {
	var data = reader.readByte();
	if (!data) return;

	var blocks;
	switch (data) {
		case 4:
			blocks = 1;
			break;
		case 8:
			blocks = 2;
			break;
		default:
			return;
	}

	var lyricsLen = reader.readShort();
	reader.skip(1);

	var chunk = reader.readBytes(1024 * blocks);
	var cs = shortArrayToString(chunk);
	console.log('cs', cs, cs.toString(16));
	var lyrics = chunk.subarray(0, lyricsLen);
	return shortArrayToString(lyrics);
}


/**********************
 *
 *   Data Helpers
 *
 **********************/

function hex(number) {
	return ('00' + (number || 0).toString(16)).slice(-2);
}

function binary(number) {
	return ('00000000' + (number || 0).toString(2)).slice(-8);
}

function string(number) {
	return (' ' + String.fromCharCode(number)).slice(-1);
}

function num(number) {
	return ('  ' + number).slice(-3);
}

function dump(byteArray, start) {
	var limit = 20;
	start = start || 0;
	for (var i = start, lim = 0; i < byteArray.length, lim < limit; i+=4, lim++) {
		console.log(
			// '%c' + i, 'background: #222; color: #bada55',
			('000' + i + ')').slice(-4),

			hex(byteArray[i]),
			hex(byteArray[i + 1]),
			hex(byteArray[i + 2]),
			hex(byteArray[i + 3]),

			binary(byteArray[i]),
			binary(byteArray[i + 1]),
			binary(byteArray[i + 2]),
			binary(byteArray[i + 3]),

			string(byteArray[i]),
			string(byteArray[i + 1]),
			string(byteArray[i + 2]),
			string(byteArray[i + 3]),

			num(byteArray[i]),
			num(byteArray[i + 1]),
			num(byteArray[i + 2]),
			num(byteArray[i + 3])
		);
	}
}


/**********************
 *
 *   Data Access
 *
 **********************/

function DataReader(array) {
	this.array = array; // the binary source
	this.start = 0;
	this.pos   = 0; // cursor

	this.data = {}; // single root of data
	this.pointer = this.data; // what emits operates on
	this.descendPath = [];
}

/**
 * descend takes a dot delimited path,
 * traverse down the structure,
 * creating an object if it does not exist
 * @param {*} path
 */
DataReader.prototype.descend = function(path) {
	this.pointer = this.data;
	this.descendPath = [];
	this.enter(path);
};

// Relative descend
DataReader.prototype.enter = function(path) {
	var node = this.pointer;
	var self = this;
	if (typeof path !== 'string') path = '' + path;
	path.split('.').forEach(function(p) {
		if (!(p in node)) {
			node[p] = {};
		}
		node = node[p];
		self.pointer = node;
		self.descendPath.push(p);
	});
};

DataReader.prototype.exit = function() {
	this.descend(this.descendPath.slice(0, -1).join('.'));
};

/**
 * set property to value at current path
 * @param {*} name
 * @param {*} value
 */
DataReader.prototype.set = function(name, value) {
	this.pointer[name] = value;
};

DataReader.prototype.push = function(value) {
	this.pointer.push(value);
	return this.pointer.length - 1;
};


// https://github.com/nwsw/nwcplugin-api/blob/master/examples/xyAnalyzer.demo.nwctxt
var TokenMode = {
	EnterExit: (reader, key, value) => {
		if (key === 'next') {
			reader.exit();
			tokenMode = TokenMode.JustSet;
			return;
		}

		reader.set(key, value);
	},

	JustSet: (reader, key, value) => {
		if (key === 'next') {
			return;
		}
		if (key === 'type') {
			if (/Lyric/.exec(value)) { // Lyrics, Lyric1, Lyric2...
				reader.enter(value);
				tokenMode = TokenMode.EnterExit;
				return;
			}
			switch (value) {
				case 'Editor':
					reader.descend('score.editor')
					break;
				case 'Font':
					reader.descend('score.fonts')
					var i = reader.push({ type: value });
					reader.enter(i);
					tokenMode = TokenMode.EnterExit;
					return;
				case 'SongInfo':
				case 'PgSetup':
				case 'PgMargins':
					reader.descend('score.' + value)
					// reader.set('key', value);
					break;
				case 'AddStaff':
				// tokenMode(reader, key, value);
					reader.descend('score.staves');
					var i = reader.push({ tokens: [] });
					reader.descend(`score.staves.${i}.tokens`);
					return;
				default:
				case 'StaffProperties':
				case 'StaffInstrument':
					var i = reader.push({ type: value });
					reader.enter(i);
					tokenMode = TokenMode.EnterExit;
					return;
			}
		}

		reader.set(key, value);
	}
}

var tokenMode = TokenMode.JustSet;

// aka "emits"
DataReader.prototype.token = function(key, value) {
	// if (key === 'next') {

	// }
	tokenMode(reader, key, value);
};

DataReader.prototype.readUntil = function(x) {
	while (this.array[this.pos] !== x && this.pos < this.array.length) {
		this.pos++;
	}

	var slice = this.array.subarray(this.start, this.pos);
	this.pos++;
	this.start = this.pos;
	return slice;
};

DataReader.prototype.readLine = function() {
	return this.readUntil(0);
};

DataReader.prototype.readString = function() {
	return shortArrayToString(this.readLine());
};

DataReader.prototype.readByte = function() {
	var slice = this.array[this.pos++];
	this.start = this.pos;
	return slice;
};

DataReader.prototype.readShort = function() {
	var num = this.readBytes(2);
	return num[0] + num[1] * 256;
};

DataReader.prototype.readBytes = function(k) {
	this.pos += k;
	var slice = this.array.subarray(this.start, this.pos);
	this.start = this.pos;
	return slice;
};

DataReader.prototype.skip = function(k) {
	this.pos += k || 1;
	this.start = this.pos;
};

DataReader.prototype.dump = function() {
	dump(this.array, this.start);
};

if (NODE) {
	Object.assign(module.exports, {
		decodeNwcArrayBuffer
	});
}