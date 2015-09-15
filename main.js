/**********************
 *
 *   Constants
 *
 **********************/

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
	'1',
	'2',
	'4',
	'8',
	'16',
	'32',
	'64',
];

var ACCIDENTALS = [
	'#',
	'b',
	'', // neutral
	'##',
	'bb',
	'', //'auto'
];

var NAMES = 'C D E F G A B'.split(' ');

/**********************
 *
 *   Helpers
 *
 **********************/

function ajax(url, callback) {
	var oReq = new XMLHttpRequest();
	oReq.open('GET', url, true);
	oReq.responseType = 'arraybuffer';

	oReq.onload = function(oEvent) {
		console.log('ajax done for ', url);
		var arrayBuffer = oReq.response;
		callback(arrayBuffer);
	};

	oReq.send();
}

ajax('samples/anongs.nwc', received);

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

function received(arrayBuffer) {
	var byteArray = new Uint8Array(arrayBuffer);
	var firstBytes = shortArrayToString(byteArray.subarray(0, 5));
	if ('[NWZ]' === firstBytes) {
		var nwz = byteArray.subarray(6);
		var inflate = new Zlib.Inflate(nwz);
		var plain = inflate.decompress();
		process(plain);
	} else if ('[Note' === firstBytes) {
		process(byteArray);
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


function process(array) {
	var lex = new Lex(array);
	Header(lex);
	Info(lex);
	PageSetup(lex);
	Score(lex);

	window.data = lex.data;
	parse(data);
	vex();
}

/**********************
 *
 *  Do Some Parsing,
 *	that understands
 *
 **********************/
function parse(data) {
	var staves = data.score.staves;

	/*
	State

	- clef
	- key signature
	- notes (with accidentals)
	- barlines
	*/

	var reader = new SightReader();

	staves.forEach(function(staff) {
		staff.tokens.forEach(function(token) {
			var type = token.type;
			if (type in reader) {
				reader[type](token);
			}
		});
	});
};

function SightReader() {
	// Note Streamer
	this.setClef('treble');
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
	// this.key =
	console.log(token);
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
	if (accidental < 5) {
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
	// console.log(accidental);
};




/**********************
 *
 *   Parse Modes
 *
 **********************/


function Header(lex) {
	lex.descend('header');
	lex.emit('company', lex.readLineString());
	var skip = shortArrayToString(lex.readLine());
	skip = shortArrayToString(lex.readLine());
	lex.emit('product', lex.readLineString());

	var v = lex.readLine();

	lex.skip(2);
	lex.emit('name1', lex.readLineString());
	lex.emit('name2', lex.readLineString());
	lex.skip(8);
	lex.skip(2);

	var version_minor = v[0];
	var version_major = v[1];
	version = version_major + version_minor * 0.01;
	lex.emit('version', version);
}

function Info(lex) {
	lex.descend('info');
	lex.emit('title', lex.readLineString());
	lex.emit('author', lex.readLineString());
	lex.emit('copyright1', lex.readLineString());
	lex.emit('copyright2', lex.readLineString());
	if (version >= 2) {
		lex.emit('something', lex.readLineString());
	}
	lex.emit('comments', lex.readLineString());
	console.log(lex.data);
}

function PageSetup(lex) {
	lex.descend('page_setup');
	margins = Margins(lex);
	staffSize = Fonts(lex);
}

function Margins(lex) {
	lex.skip(9);
	lex.emit('measureStart', lex.readByte());
	lex.skip(1); // likely 0
	margins = lex.readLineString();
	margins = margins.split(' ').map(function(x) {
		return +x;
	});
	lex.emit('margins', margins);
}

function Fonts(lex) {
	lex.skip(36);
	lex.emit('staff_size', lex.readByte());
	lex.skip(1);

	var fonts = [], font, style, size, typeface;
	for (var i = 0; i < 12; i++) {
		font = lex.readLineString();
		style = STYLES[lex.readByte() & 3];
		size = lex.readByte();
		lex.skip(1);
		typeface = lex.readByte();

		fonts.push({
			font: font,
			style: style,
			size: size,
			typeface: typeface
		});
	}
	lex.emit('fonts', fonts);
}

function Score(lex) {
	lex.descend('score');
	lex.readUntil(0xff);

	lex.readBytes(2);
	lex.emit('layering', lex.readByte(1));
	var staves = lex.readByte(1);
	lex.emit('staves', new Array(staves));
	lex.skip(1);

	for (var i = 0; i < staves; i++) {
		StaffInfo(lex, i);
	}

}

function StaffInfo(lex, staff) {
	lex.descend('score.staves.' + staff);
	lex.emit('staff_name', lex.readLineString());
	lex.emit('group_name', lex.readLineString());
	lex.emit('end_bar', lex.readByte() & 7);
	lex.emit('muted', !!(lex.readByte() & 1));
	lex.skip(1);
	lex.emit('channel', lex.readByte());
	lex.skip(9);
	lex.emit('staff_type', lex.readByte() & 3);
	lex.skip(1);

	lex.emit('uppersize', 256 - lex.readByte());
	lex.readUntil(0xff);
	lex.emit('lowersize', lex.readByte());
	lex.skip(1);
	lex.emit('lines', lex.readByte());
	lex.emit('layer', !!(lex.readByte() & 1));
	lex.emit('part_volume', lex.readByte());
	lex.skip(1);
	lex.emit('stero_pan', lex.readByte());
	if (lex.data.header.version === 1.7) {
		lex.skip(2);
	} else {
		lex.skip(3);
	}

	lex.skip(2);
	var lyrics = lex.readShort();
	var noLyrics = lex.readShort();

	console.log('noLyrics' ,noLyrics);

	if (lyrics) {
		var lyricsOption = lex.readShort();
		lex.skip(3);

		for (var i = 0; i < noLyrics; i++) {
			var lyrics = [];
			lyrics.push(Lyrics(lex));
			lex.emit('lyrics', lyrics);
		}
		lex.skip(1);
	}

	lex.skip();
	lex.emit('color', lex.readByte() & 3);

	var tokens = lex.readShort();
	lex.emit('tokens', []);

	// console.log('Tokens', tokens);
	for (var i = 0; i < tokens - 2; i++) {
		if (lex.data.header.version === 1.7) {
			lex.skip(2);
		}
		var token = lex.readByte();

		lex.descend('score.staves.' + staff + '.tokens.' + i);
		var func = TOKENS[token];
		if (!func) console.log('Warning, token not recongnized', token);
		func(lex);
		if (RestChord === func) {
			i--;
		}
	}
}
/**********************
 *
 *   Token Modes
 *
 **********************/

function Clef(lex) {
	lex.emit('type', 'Clef');
	var data = lex.readBytes(6);
	lex.emit('clef', CLEF_NAMES[data[2] & 3]);
	lex.emit('octave', data[4] & 3);
}

function KeySignature(lex) {
	lex.emit('type', 'KeySignature');
	var data = lex.readBytes(12);
	lex.emit('flats', data[2]);
	lex.emit('sharps', data[4]);
}

function Barline(lex) {
	lex.emit('type', 'Barline');
	var data = lex.readBytes(4);
	lex.emit('barline', data[2] & 15);
}

function Repeat(lex) {
	lex.emit('type', 'Repeat');
	var data = lex.readBytes(4);
	lex.emit('repeat', data[2]);
}

function InstrumentPatch(lex) {
	lex.emit('type', 'InstrumentPatch');
	var data = lex.readBytes(10);
}

function TimeSignature(lex) {
	lex.emit('type', 'TimeSignature');
	var data = lex.readBytes(8);

	lex.emit('group', data[2]);
	lex.emit('beat', data[4]);
	lex.emit('signature', data[2] + '/' + data[4]);

}

function Tempo(lex) {
	lex.emit('type', 'Tempo');
	var data = lex.readBytes(7);
	lex.readLine(); // ?

	lex.emit('note', data[6]);
	lex.emit('duration', data[4]);
}

function Dynamic(lex) {
	lex.emit('type', 'Dynamic');
	var data = lex.readBytes(9);
	lex.emit('dynamic', data[4] & 7);
}


function Note(lex) {
	lex.emit('type', 'Note');
	var data = lex.readBytes(10);
	NoteValue(lex, data);
}

function NoteValue(lex, data) {
	var position = data[8];
	position = position > 127 ? 256 - position : - position;
	lex.emit('position', position);

	var accidental = data[9] & 7;
	lex.emit('accidental', accidental);
	var durationBit = data[2] & 7;

	lex.emit('duration', DURATIONS[durationBit]);

	var durationDotBit = data[6];

	var dots = durationDotBit & 1 << 2 ? 1 :
		durationDotBit & 1 ? 2 :
			0;

	lex.emit('dots', dots);
	lex.emit('stem', data[4] >> 4 & 3);
	lex.emit('triplet', data[4] >> 2 & 3);
	lex.emit('tie', data[6] >> 4 & 1);

	lex.emit('staccato', data[6] >> 1 & 1);
	lex.emit('accent', data[6] >> 5 & 1);
	lex.emit('tenuto', data[7] >> 2 & 1);
	lex.emit('grace', data[7] >> 5 & 1);
	lex.emit('slur', data[7] & 3);
}


function Rest(lex) {
	lex.emit('type', 'Rest');
	var data = lex.readBytes(10);
	NoteValue(lex, data);
}

function Chord(lex) {
	lex.emit('type', 'Chord');
	var data = lex.readBytes(12);

	var chords = data[10];
	// NoteValue(lex, data);

	for (var i = 0; i < chords; i++) {
		lex.skip();
		data = lex.readBytes(10);
		NoteValue(lex, data)
	}
}

function RestChord(lex) {
	lex.emit('type', 'RestChord');
	var data = lex.readBytes(12);
	NoteValue(lex, data);
}

function Pedal(lex) {
	lex.emit('type', 'Pedal');
	var data = lex.readBytes(5);
	lex.emit('sustain', data[4]);
}

function MidiInstruction(lex) {
	lex.emit('type', 'MidiInstruction');
	var data = lex.readBytes(36);
}

function Fermata(lex) {
	lex.emit('type', 'Fermata');
	var data = lex.readBytes(6);
	// TODO
	lex.emit('sustain', data[4]);
}

function DynamicVariance(lex) {
	lex.emit('type', 'DynamicVariance');
	var data = lex.readBytes(5);
	lex.emit('sustain', data[4]);
	// TODO
}

function PerformanceStyle(lex) {
	lex.emit('type', 'PerformanceStyle');
	var data = lex.readBytes(5);
	lex.emit('style', data[4]);
	// TODO
}

function Text(lex) {
	lex.emit('type', 'Text');
	lex.skip(2);
	lex.emit('position', lex.readByte());
	lex.skip(2);
	lex.emit('text', lex.readLineString());
}


// TODO
// Clef.type = 'Clef'
// Clef.token = 0
// Clef.load(stream);
// Clef.write();

function Lyrics(lex) {
	var data = lex.readByte();
	if (!data) return;

	var blocks;
	switch (lex.readByte()) {
		case 4:
			blocks = 1;
			break;
		case 8:
			blocks = 1;
			break;
		default:
			return;
	}

	// dump(lex.array, lex.start);

	var lyricsLen = lex.readShort();
	lex.skip(1);

	var chunk = lex.readBytes(1024 * blocks);
	var cs = shortArrayToString(chunk);
	console.log('cs', cs, cs.toString(16));
	var lyrics = chunk.subarray(0, lyricsLen);
	return shortArrayToString(lyrics);
}

/**********************
 *
 *   Data Access
 *
 **********************/

function Lex(array) {
	this.array = array;
	this.start = 0;
	this.pos   = 0; // cursor

	this.data = {};
	this.pointer = this.data;
}

Lex.prototype.descend = function(path) {
	var node = this.data;
	var self = this;
	path.split('.').forEach(function(p) {
		if (!(p in node)) {
			node[p] = {};
		}
		node = node[p];
		self.pointer = node;
	});
	// this.pointer = this.data[name] = {};
};

Lex.prototype.emit = function(name, value) {
	this.pointer[name] = value;
};

Lex.prototype.push = function(value) {
	this.pointer.push(value);
};

Lex.prototype.readUntil = function(x) {
	while (this.array[this.pos] !== x) {
		this.pos++;
	}

	var slice = this.array.subarray(this.start, this.pos);
	this.pos++;
	this.start = this.pos;
	return slice;
};

Lex.prototype.readLine = function() {
	return this.readUntil(0);
};

Lex.prototype.readLineString = function() {
	return shortArrayToString(this.readLine());
};

Lex.prototype.readByte = function() {
	var slice = this.array[this.pos++];
	this.start = this.pos;
	return slice;
};

Lex.prototype.readShort = function() {
	var num = this.readBytes(2);
	return num[0] + num[1] * 256;
};

Lex.prototype.readBytes = function(k) {
	this.pos += k;
	var slice = this.array.subarray(this.start, this.pos);
	this.start = this.pos;
	return slice;
};

Lex.prototype.skip = function(k) {
	this.pos += k || 1;
	this.start = this.pos;
};