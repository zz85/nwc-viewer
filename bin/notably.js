(function () {
'use strict';

const NODE$1 = typeof module !== 'undefined';
const BROWSER$1 = typeof window !== 'undefined';

// TODO remove HARDCODING
const FONT_SIZE$1 = 36;

Object.assign(NODE$1 ? global : window, { NODE: NODE$1, BROWSER: BROWSER$1, FONT_SIZE: FONT_SIZE$1 });

/**********************
 *
 *   Loading Helpers
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

// TODO Drag and Drop, File Opener

// onclick="opener.click()

var opener = document.getElementById('opener');
opener.onchange = function() {
	var files = opener.files;
	handleFileList(files);
};

document.getElementById('open').onclick = () => opener.click();

function handleFileList(files) {
	if (files && files.length) {
		console.log(files);
		// TODO filter file.name / name.type
		readFile(files[0]);
	}
}

function readFile(file) {
	var reader = new FileReader();
	reader.onload = function(event) {
		var arraybuffer = event.target.result;
		console.log(event);
		processData(arraybuffer);
	};
	reader.readAsArrayBuffer(file);
}

function setupDragAndDrop(element) {
	element.ondragover = function handleDragOver(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
	};

	element.ondrop = function handleFileSelect(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		var files = evt.dataTransfer.files;

		handleFileList(files);
	};
}

setupDragAndDrop(document.body);

/**********************
 *
 *   Constants
 *
 **********************/

var TOKENS = {
	0: Clef, // + 6
	1: KeySignature$1, // + 12
	2: Barline$1,
	3: Ending, // repeat
	4: InstrumentPatch, // instrument
	5: TimeSignature$1, // + 8 bytes
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
	17: Text$1, // 0x11 text object
	18: RestChord, // 0x12
	// 19: User,
	// 20: Spacer,
	// 21: RestMultiBar,
	// 22: Boundary,
	// 23: Marker
};

var CLEF_NAMES = {
	0: 'treble',
	1: 'bass',
	2: 'alto',
	3: 'tenor',
};

var STYLES = ['Regular', 'Italic', 'Bold', 'Bold Italic'];

var DURATIONS = [1, 2, 4, 8, 16, 32, 64];
var ACCIDENTALS = {
	0: '#', // sharp
	1: 'b', // flat
	2: 'n', // neutral
	3: 'x', // double sharp ##
	4: 'v', // double flat bb
	5: '', //'auto'
};

/*
var CLEF_OCTAVE = ('', '^8', '_8', '')
var CLEF_SHIFT = (0, 7, -7, 0)
*/

// https://github.com/nwsw/nwcplugin-api/blob/6dfa771380e41c34e37d5d81b4b3bf8400985285/api/nwc.md
const NwcConstants = {
	AttachLyricSyllable: ['Default', 'Always', 'Never'],
	BarLineType: [
		'Single',
		'Double',
		'BrokenSingle',
		'BrokenDouble',
		'SectionOpen',
		'SectionClose',
		'LocalRepeatOpen',
		'LocalRepeatClose',
		'MasterRepeatOpen',
		'MasterRepeatClose',
		'Transparent',
	],
	BoundaryTypes: [
		'Reset',
		'NewSize',
		'Collapse',
		'EndCollapse',
		'Gap',
		'NewSystem',
	],
	ClefType: ['Treble', 'Bass', 'Alto', 'Tenor', 'Percussion'],
	DrawFillStyle: ['fill', 'stroke', 'strokeandfill'],
	DrawPenStyle: ['solid', 'dot', 'dash'],
	DrawTextAlign: ['left', 'center', 'right'],
	DrawTextVAlign: ['top', 'middle', 'baseline', 'bottom'],
	DynamicLevels: ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'],
	DynamicVariance: [
		'Crescendo',
		'Decrescendo',
		'Diminuendo',
		'Rinforzando',
		'Sforzando',
	],
	ExpressionJustify: ['Left', 'Center', 'Right'],
	ExpressionPlacement: [
		'BestFit',
		'BestFitForward',
		'AsStaffSignature',
		'AtNextNote',
	],
	FlowDirTypes: [
		'Coda',
		'Segno',
		'Fine',
		'ToCoda',
		'DaCapo',
		'DCalCoda',
		'DCalFine',
		'DalSegno',
		'DSalCoda',
		'DSalFine',
	],
	ItemColor: [
		'Default',
		'Highlight 1',
		'Highlight 2',
		'Highlight 3',
		'Highlight 4',
		'Highlight 5',
		'Highlight 6',
		'Highlight 7',
	],
	ItemVisibility: [
		'Default',
		'Always',
		'TopStaff',
		'SingleStaff',
		'MultiStaff',
		'Never',
	],
	Lyric2NoteAlignment: ['Start of Accidental/Note', 'Standard Rules'],
	LyricAlignment: ['Bottom', 'Top'],
	MPCControllers: [
		'tempo',
		'vol',
		'pan',
		'bc',
		'pitch',
		'mod',
		'foot',
		'portamento',
		'datamsb',
		'bal',
		'exp',
		'fx1',
		'fx2',
		'reverb',
		'tremolo',
		'chorus',
		'detune',
		'phaser',
	],
	MPCStyle: ['Absolute', 'Linear Sweep'],
	MarkerTargets: ['Articulation', 'Slur', 'Triplet'],
	MeasureNumStyles: ['None', 'Plain', 'Circled', 'Boxed'],
	NoteConnectState: ['None', 'First', 'Middle', 'End'],
	NoteDurBase: ['Whole', 'Half', '4th', '8th', '16th', '32nd', '64th'],
	NoteDuration: [
		'Whole',
		'Half',
		'Quarter',
		'Eighth',
		'Sixteenth',
		'Thirtysecond',
		'Sixtyfourth',
	],
	NoteScale: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
	ObjLabels: [
		'Clef',
		'Key',
		'Bar',
		'Ending',
		'Instrument',
		'TimeSig',
		'Tempo',
		'Dynamic',
		'Note',
		'Rest',
		'Chord',
		'SustainPedal',
		'Flow',
		'MPC',
		'TempoVariance',
		'DynamicVariance',
		'PerformanceStyle',
		'Text',
		'RestChord',
		'User',
		'Spacer',
		'RestMultiBar',
		'Boundary',
		'Marker',
	],
	OctaveShift: ['None', 'Octave Up', 'Octave Down'],
	PageMarginFields: ['Left', 'Top', 'Right', 'Bottom', 'Mirror'],
	PageSetupFields: [
		'TitlePage',
		'JustifyVertically',
		'PrintSystemSepMark',
		'ExtendLastSystem',
		'DurationPadding',
		'PageNumbers',
		'StaffLabels',
		'BarNumbers',
		'StartingBar',
		'AllowLayering',
	],
	PerformanceStyle: [
		'Ad Libitum',
		'Animato',
		'Cantabile',
		'Con brio',
		'Dolce',
		'Espressivo',
		'Grazioso',
		'Legato',
		'Maestoso',
		'Marcato',
		'Meno mosso',
		'Poco a poco',
		'Più mosso',
		'Semplice',
		'Simile',
		'Solo',
		'Sostenuto',
		'Sotto Voce',
		'Staccato',
		'Subito',
		'Tenuto',
		'Tutti',
		'Volta Subito',
	],
	PlayMidiCmds: [
		'noteOff',
		'noteOn',
		'keyAftertouch',
		'controller',
		'patch',
		'channelAftertouch',
		'pitchBend',
	],
	SongInfoFields: [
		'Title',
		'Author',
		'Lyricist',
		'Copyright1',
		'Copyright2',
		'Comments',
	],
	SpanTypes: ['notes', 'syllables', 'bars', 'ticks', 'items'],
	SpecialSignatures: ['Standard', 'Common', 'AllaBreve'],
	StaffEndBarLineType: [
		'Section Close',
		'Master Repeat Close',
		'Single',
		'Double',
		'Open (hidden)',
	],
	StaffLabelStyles: ['None', 'First System', 'Top Systems', 'All Systems'],
	StaffProperties: [
		'Name',
		'Label',
		'LabelAbbr',
		'Group',
		'EndingBar',
		'BoundaryTop',
		'BoundaryBottom',
		'Lines',
		'BracketWithNext',
		'BraceWithNext',
		'ConnectBarsWithNext',
		'LayerWithNext',
		'MultiPartDotPlacement',
		'Color',
		'Muted',
		'Volume',
		'StereoPan',
		'Device',
		'Channel',
	],
	SustainPedalStatus: ['Down', 'Released'],
	TempoBase: [
		'Eighth',
		'Eighth Dotted',
		'Quarter',
		'Quarter Dotted',
		'Half',
		'Half Dotted',
	],
	TempoVariance: [
		'Breath Mark',
		'Caesura',
		'Fermata',
		'Accelerando',
		'Allargando',
		'Rallentando',
		'Ritardando',
		'Ritenuto',
		'Rubato',
		'Stringendo',
	],
	TextExpressionFonts: [
		'StaffSymbols',
		'StaffCueSymbols',
		'StaffItalic',
		'StaffBold',
		'StaffLyric',
		'PageTitleText',
		'PageText',
		'PageSmallText',
		'User1',
		'User2',
		'User3',
		'User4',
		'User5',
		'User6',
	],
	TieDir: ['Default', 'Upward', 'Downward'],
	UserObjClassTypes: ['Standard', 'StaffSig', 'Span'],
	UserPropValueTypes: ['text', 'enum', 'bool', 'int', 'float'],

	Accidentals: ['v', 'b', 'n', '#', 'x'],
};

function decodeNwcArrayBuffer$1(arrayBuffer) {
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

		return processNwc(plain)
	} else if ('[Note' === firstBytes) {
		return processNwc(byteArray)
	} else {
		console.log('Unrecognized headers');
	}
}

function shortArrayToString(array) {
	return String.fromCharCode.apply(null, array)
}

function longArrayToString(array, chunk) {
	/*
	For way longer strings, better to use this
	var enc = new TextDecoder();
	var arr = new Uint8Array([84,104,105,...]);
	console.log(enc.decode(arr));
	*/

	var buffer = [];

	var chunk = 1024 || chunk;
	for (var i = 0; i < array.length; i += chunk) {
		buffer.push(shortArrayToString(array.slice(i, i + chunk)));
	}

	return buffer.join('')
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
		console.log('done', reader.data);
		var nwctext = longArrayToString(reader.readLine());
		// console.log(nwctext);
		reader.set('nwctext', nwctext);
		parseNwc275(reader, nwctext);
		convert275Tokens(reader);

		return reader.data
	}
	Info(reader);
	PageSetup(reader);
	Score(reader);

	// start parsing
	var data = reader.data;

	return data
}

function parseNwc275(reader, nwctext) {
	var lines = nwctext.split('\r\n');

	var first = lines.shift();

	if (!first.match(/\!NoteWorthyComposer/)) {
		console.log('bad start format');
	}

	reader.descend('score');
	reader.set('fonts', []);
	reader.set('staves', []);

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (line === '!NoteWorthyComposer-End') {
			console.log('Processed', i, 'nwctext lines');
			break
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

function parseOpts(token) {
	const { Opts } = token;
	if (!Opts) return

	const opts = Opts.split(',');
	opts.forEach(opt => {
		const pairs = opt.split('=');
		token[pairs[0]] = pairs[1];
	});
}

function getPos(str) {
	// regex from https://github.com/nwsw/nwc2utsk/blob/91045bfab1e81ad328af4adeb2953412794df005/lib/obj_NWC2NotePitchPos.inc#L16
	const NWC2NotePitchPos = /([\#bnxv]{0,1})(\-{0,1}[0-9]+)([oxXzyYabcdefghijklmnpqrstuvw]{0,1})([\^]{0,1})/;
	const match = NWC2NotePitchPos.exec(str);

	if (!match) {
		console.log('cannot parse note!', str);
		return
	}

	const accidental = match[1];
	const position = +match[2];
	const notehead = match[3];
	const tied = match[4];

	return {
		accidental,
		position,
		notehead,
		tied,
	}
}

function getChordPos(str) {
	var positions = str.split(',').map(getPos);
	return positions
}

var durs = {
	Whole: 1,
	Half: 2,
	'4th': 4,
	'8th': 8,
	'16th': 16,
	'32th': 32,
};

function parseDur(dur) {
	var parts = dur.split(',');

	var duration = durs[parts[0]];
	var dots = 0;
	if (parts[1]) {
		if (parts[1] === 'Dotted') {
			dots++;
		} else if (parts[1] === 'DblDotted') {
			dots += 2;
		}
	}

	if (!duration) console.log('!!', token.Dur);

	return {
		duration,
		dots,
	}
}

function mapTokens(token) {
	var type = token.type;
	parseOpts(token);

	switch (type) {
		case 'Clef':
			token = {
				type,
				clef: token.Type.toLowerCase(),
				octave: token.OctaveShift || 0,
			};
			// Octave Down
			break
		case 'TimeSig':
			var parts = token.Signature.split('/');
			// console.log('parts', parts);
			// AllaBreve
			token = {
				type: 'TimeSignature',
				signature: token.Signature,
			};

			if (parts.length === 2) {
				token.group = +parts[0];
				token.beat = +parts[1];
			}

			break
		case 'Chord':
			Object.assign(token, { notes: getChordPos(token.Pos) });
			Object.assign(token, parseDur(token.Dur));
			break
		case 'Note':
			Object.assign(token, getPos(token.Pos));
			Object.assign(token, parseDur(token.Dur));
			// Slur(Upward) Lyric(Never) Beam(End/First) Stem(Up/Down) XNoteSpace
			break
		case 'Bar':
			token.type = 'Barline';
			break
		case 'Rest':
			return Object.assign(
				{
					type,
					position: 0,
				},
				parseDur(token.Dur)
			)
			break
		case 'Key':
			return {
				type: 'KeySignature',
				key: token.Tonic,
				// Signature
			}
			break
		case 'Tempo':
			token.duration = token.Tempo; // note
			token.note = 1;
			token.pos = token.Pos;
			// Visibility
			break
		case 'PerformanceStyle':
		case 'Dynamic':
		case 'Text':
			token.position = +token.Pos;
			token.text = token.Text;
			if (token.Style) token.text = token.dynamic = token.Style;
			// Justify, Visibility Font
			break
	}
	return token
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

	var company = reader.readString();
	var skip = reader.readUntilNonZero();
	var product = reader.readString();
	skip = reader.readUntilNonZero();
	var v = reader.readBytes(2);
	skip = reader.readBytes(1);
	skip = reader.readUntilNonZero();
	var name1 = reader.readString();
	skip = reader.readUntilNonZero();
	var name2 = reader.readString();

	reader.descend('header');
	reader.set('company', company);
	reader.set('product', product);
	reader.set('name1', name1);
	reader.set('name2', name2);

	var version_minor = v[0];
	var version_major = v[1];
	var version = version_major + version_minor * 0.01;
	console.log('Detected NWC version', version);
	reader.set('version', version);

	if (version >= 2.75) {
		// reader.readBytes(4);
		reader.readUntil(36);
	}

	skip = reader.readUntilNonZero();
	// reader.skip(2);
	// reader.skip(8);
	// reader.skip(2);
}

function Info(reader) {
	var infoHeader = reader.readBytes(2); // 0x10 - nwc175 0x18 - nwc2
	if (infoHeader[0] !== 0x10 && infoHeader[0] !== 0x18) {
		console.log('info header not aligned!');
	}

	var version = reader.data.header.version;

	reader.descend('info');
	var title = reader.readString();
	var author = reader.readString();

	if (version >= 2) {
		var lyricist = reader.readString();
		reader.set('lyricist', lyricist);
		var copyright1 = reader.readString();
		var copyright2 = reader.readString();
	} else {
		var copyright1 = reader.readString();
		var copyright2 = reader.readString();
	}
	var comments = reader.readString();
	console.log(reader.data);

	///
	reader.descend('info');
	reader.setObject({
		title,
		author,
		copyright1,
		copyright2,
		comments,
	});
	console.log(reader.data);
}

function PageSetup(reader) {
	reader.descend('page_setup');
	Margins(reader);
	Fonts(reader);
}

function Margins(reader) {
	// reader.skip(9);
	// 4e 4e 5f  0 46 32  0 0 0
	// 4e 59 5f  0 46 32  0 0 0
	// 4e 4e 5f  0 46 32  0 1 0
	// 59 59 5f  0 46 32  0 0 0
	reader.readUntil(0x46);
	reader.readUntil(0x32);
	reader.skip(3);

	reader.set('measureStart', reader.readByte());
	reader.skip(1); // likely 0
	let margins = reader.readString();
	margins = margins.split(' ').map(function(x) {
		return +x
	});
	reader.set('margins', margins);
}

function Fonts(reader) {
	if (reader.data.header.version < 2) {
		reader.skip(36);
		reader.skip(1);
		var staff_size = reader.readByte();
	} else {
		reader.readUntil(0xff);
		var pre = reader.readBytes(3); // 0 11 0
		var staff_size = pre[1];
	}

	reader.set('staff_size', staff_size);

	var fonts = [],
		font,
		style,
		size,
		typeface;
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
			typeface: typeface,
		});
	}
	reader.set('fonts', fonts);
}

function Score(reader) {
	reader.descend('score');
	var version = reader.data.header.version;

	reader.readUntil(0xff);
	reader.readBytes(2);
	reader.set('layering', reader.readByte(1));

	if (version < 2) {
		var staves = reader.readShort();
		console.log('Detected Staves', staves);
	} else {
		reader.readByte();
		var staves = reader.readByte();

		// if (version === 2.02) {
		// reader.readUntilNonZero();

		//  0 fc ff 50  1 4e  1  0  1
		// make a loop, read until ff

		// ff  4  0 73  0 73  0
		// 83  1 61  0 61  0
		// 5   5 74 0 74 0
		// fe  5 62  0 62  0
		// 43 68 6f
	}

	console.log('Detected Staves', staves);

	reader.set('staves', new Array(staves));

	for (var i = 0; i < staves; i++) {
		console.log('STAFFF', i);
		StaffInfo(reader, i);
	}

	console.log(reader.pos, '/', reader.array.length);
}

function StaffInfo(reader, staff) {
	var version = reader.data.header.version;

	if (version > 2) {
		reader.readShort();
		reader.readShort();
		reader.readUntilNonZero();
	}

	var staff_name = reader.readString();
	var group_name = reader.readString();
	var end_bar = reader.readByte() & 7;
	var muted = !!(reader.readByte() & 1);
	reader.skip(1);
	var channel = reader.readByte();
	reader.skip(9);
	var staff_type = reader.readByte() & 3;
	reader.skip(1);

	var uppersize = 256 - reader.readByte();
	reader.readUntil(0xff);
	var lowersize = reader.readByte();
	reader.skip(1);
	var lines = reader.readByte();
	var layer = !!(reader.readByte() & 1);
	var part_volume = reader.readByte();
	reader.skip(1);
	var stero_pan = reader.readByte();

	var info = {
		staff_name,
		group_name,
		end_bar,
		muted,
		channel,
		staff_type,
		uppersize,
		lowersize,
		lines,
		layer,
		part_volume,
	};

	reader.descend('score.staves.' + staff);
	reader.setObject(info);

	if (reader.data.header.version === 1.7) {
		reader.skip(2);
	} else {
		reader.skip(3);
	}

	reader.skip(2);
	var lyrics = reader.readShort();
	var noLyrics = reader.readShort();

	if (noLyrics) console.log('noLyrics', noLyrics);

	/*
	var counting = 0;
	while (!reader.ended()) {
		counting++
		var tmp = reader.readUntil(0xfb); //0xff
		console.log(...[...tmp].map(hex), shortArrayToString(tmp)	)
	}
	console.log('counted', counting);
	// 0x10 - 106, 1 - 116, 2 - 219, 0 - 2000
	// 0x20 - 20
	// 0x21 - 6
	// 0xfd 23
	// 0xfe - 16
	// 0xff - 43

	// debugger;
	return;
	*/

	if (lyrics) {
		var lyricsOption = reader.readShort();
		reader.skip(3);

		var lyrics = [];
		for (var i = 0; i < noLyrics; i++) {
			var text = Lyrics(reader);
			// console.log('lyrics', text);
			lyrics.push(text);
		}

		reader.set('lyrics', lyrics);
		reader.skip(1);
	}

	reader.skip();
	reader.set('color', reader.readByte() & 3);

	var tokens = reader.readShort();
	reader.set('tokens', []);
	console.log('tokens', tokens);

	for (var i = 0; i < tokens - 2; i++) {
		if (reader.data.header.version === 1.7) {
			reader.skip(2);
		}

		// TODO convert to Short
		var token = reader.readByte();

		reader.descend('score.staves.' + staff + '.tokens.' + i);
		var func = TOKENS[token];

		if (func) {
			func(reader);
		} else {
			console.log('Warning, token not recongnized', token, reader.pos);
			reader.dump();
			return
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

function bitmapKeySignature(bitmap) {
	const AG = 'ABCDEFG';
	var names = [];
	// bit map
	for (let i = 0; i < AG.length; i++) {
		if ((bitmap >> i) & 1) {
			names.push(AG.charAt(i));
		}
	}

	return names
}

function KeySignature$1(reader) {
	reader.set('type', 'KeySignature');
	var data = reader.readBytes(12);
	var flats = bitmapKeySignature(data[2]);
	var sharps = bitmapKeySignature(data[4]);
	reader.set('flats', flats);
	reader.set('sharps', sharps);

	var flatKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
	var sharpKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

	if (flats.length) {
		reader.set('key', flatKeys[flats.length]);
	} else if (sharps.length) {
		reader.set('key', sharpKeys[sharps.length]);
	} else {
		reader.set('key', 'C');
	}
}

function Barline$1(reader) {
	reader.set('type', 'Barline');
	var data = reader.readBytes(4);
	reader.set('barline', data[2] & 15);
}

function Ending(reader) {
	reader.set('type', 'Ending');
	var data = reader.readBytes(4);
	reader.set('repeat', data[2]);
}

function InstrumentPatch(reader) {
	reader.set('type', 'InstrumentPatch');
	var data = reader.readBytes(10);
}

function TimeSignature$1(reader) {
	reader.set('type', 'TimeSignature');
	var data = reader.readBytes(8);

	var top = data[2]; // numerator
	var beats = Math.pow(2, data[4]); // denominator

	reader.set('group', top);
	reader.set('beat', beats);
	reader.set('signature', top + '/' + beats);
}

function Tempo(reader) {
	reader.set('type', 'Tempo');
	// 7 byes
	var data = reader.skip(2);
	var position = reader.readSignedInt(); // 2
	var placement = reader.readSignedInt(); // 3
	var duration = reader.readShort(); // 4-5 // value / duration
	var note = reader.readByte(); // 6 // base / note

	reader.readLine(); // ?

	reader.setObject({
		position,
		placement,
		duration,
		note,
	});
}

function Dynamic(reader) {
	reader.set('type', 'Dynamic');
	// 9 Bytes
	reader.skip(2);
	var position = reader.readSignedInt(); // 1
	var placement = reader.readSignedInt(); // 2
	var style = reader.readByte() & 7; // reader.readSignedInt(); // 3 dynamicRef
	var velocity = reader.readShort(); // 4-5
	var volume = reader.readShort(); // 6-7
	var dynamic = NwcConstants.DynamicLevels[style];

	reader.setObject({
		position,
		placement,
		style,
		velocity,
		volume,
		dynamic,
	});
}

function Note(reader) {
	reader.set('type', 'Note');
	var data = reader.readBytes(10);
	NoteValue(reader, data);
}

function NoteValue(reader, data) {
	var position = data[8];
	position = position > 127 ? 256 - position : -position;
	reader.set('position', position);

	var accidental = ACCIDENTALS[data[9] & 7];
	reader.set('accidental', accidental);
	var durationBit = data[2] & 7;

	reader.set('duration', DURATIONS[durationBit]);

	var durationDotBit = data[6];

	var dots = durationDotBit & (1 << 2) ? 1 : durationDotBit & 1 ? 2 : 0;

	reader.set('dots', dots);
	reader.set('stem', (data[4] >> 4) & 3);
	reader.set('triplet', (data[4] >> 2) & 3);
	reader.set('tie', (data[6] >> 4) & 1);

	reader.set('staccato', (data[6] >> 1) & 1);
	reader.set('accent', (data[6] >> 5) & 1);
	reader.set('tenuto', (data[7] >> 2) & 1);
	reader.set('grace', (data[7] >> 5) & 1);
	reader.set('slur', data[7] & 3);

	if (data[9] & 0x40) {
		console.log('more stemming info');
		reader.readByte();
	}
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
	var notes = new Array(chords);

	reader.set('chords', chords);
	reader.set('notes', notes);

	var pointer = reader.pointer;
	// TODO make better pointer management

	for (var i = 0; i < chords; i++) {
		notes[i] = {};
		reader.pointer = pointer.notes[i];
		reader.skip();
		data = reader.readBytes(10);
		NoteValue(reader, data);
	}

	reader.pointer = pointer;
	reader.set('duration', notes[0].duration);
	reader.set('dots', notes[0].dots);
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

function Flow(reader) {
	reader.set('type', 'Flow');
	// TODO
	// console.log('Flow');
	// reader.dump();
	var data = reader.readBytes(6);
	// 4 5 6* 11*
	// reader.set('Flow', data[4]);
}

function MidiInstruction(reader) {
	reader.set('type', 'MidiInstruction');
	var data = reader.readBytes(36);
}

function TempoVariance(reader) {
	reader.set('type', 'TempoVariance');
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
	reader.set('text', NwcConstants.PerformanceStyle[data[4]]);
}

function Text$1(reader) {
	reader.set('type', 'Text');
	reader.skip(2);

	var position = reader.readSignedInt();
	var data = reader.readByte();
	var font = reader.readByte();
	var text = reader.readString();

	reader.set('position', position);
	reader.set('text', text);
}

function Lyrics(reader) {
	var blockHeader = reader.readByte(); // 1 byte
	var lyricsLen = reader.readShort(); // 2 byte
	reader.skip(1); // 1 byte

	var blocks;
	switch (blockHeader) {
		case 4:
			blocks = 1;
			break
		case 8:
			blocks = 2;
			break
		default:
			break
	}

	var lyricBlock = blocks ? 1024 * blocks : lyricsLen + 2;
	var chunk = reader.readBytes(lyricBlock); // rest of the block

	var cs = shortArrayToString(chunk);
	console.log('cs', cs, cs.toString(16));
	var lyrics = chunk.subarray(0, lyricsLen);
	return shortArrayToString(lyrics)
}

/**********************
 *
 *   Data Helpers
 *
 **********************/

function hex(number) {
	// 00
	return ('  ' + (number || 0).toString(16)).slice(-2)
}

function string(number) {
	return ('_' + String.fromCharCode(number)).slice(-1)
}

function num(number) {
	return ('  ' + number).slice(-3)
}

function dump(byteArray, start, limit) {
	limit = limit || 20;
	start = start || 0;
	var group = 12;
	var keys = [...Array(group).keys()];
	var pad = '      ';
	for (
		var i = start, lim = 0;
		i < byteArray.length, lim < limit;
		i += group, lim++
	) {
		console.log(
			// '%c' + i, 'background: #222; color: #bada55',
			// '00000'
			(pad + i + ')').slice(-pad.length),

			...keys.map(k => hex(byteArray[i + k])),
			// ...keys.map(k => binary(byteArray[i + k])),
			'|',
			...keys.map(k => string(byteArray[i + k])),
			...keys.map(k => num(byteArray[i + k]))
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
	this.pos = 0; // cursor

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

DataReader.prototype.ended = function() {
	var cursor = this.pos;
	return cursor >= this.array.length
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

DataReader.prototype.setObject = function(object) {
	Object.assign(this.pointer, object);
};

DataReader.prototype.push = function(value) {
	this.pointer.push(value);
	return this.pointer.length - 1
};

// https://github.com/nwsw/nwcplugin-api/blob/master/examples/xyAnalyzer.demo.nwctxt
var TokenMode = {
	EnterExit: (reader, key, value) => {
		if (key === 'next') {
			reader.exit();
			tokenMode = TokenMode.JustSet;
			return
		}

		reader.set(key, value);
	},

	JustSet: (reader, key, value) => {
		if (key === 'next') {
			return
		}
		if (key === 'type') {
			if (/Lyric/.exec(value)) {
				// Lyrics, Lyric1, Lyric2...
				reader.enter(value);
				tokenMode = TokenMode.EnterExit;
				return
			}
			switch (value) {
				case 'Editor':
					reader.descend('score.editor');
					break
				case 'Font':
					reader.descend('score.fonts');
					var i = reader.push({ type: value });
					reader.enter(i);
					tokenMode = TokenMode.EnterExit;
					return
				case 'SongInfo':
				case 'PgSetup':
				case 'PgMargins':
					reader.descend('score.' + value);
					// reader.set('key', value);
					break
				case 'AddStaff':
					// tokenMode(reader, key, value);
					reader.descend('score.staves');
					var i = reader.push({ tokens: [] });
					reader.descend(`score.staves.${i}.tokens`);
					return
				default:
				case 'StaffProperties':
				case 'StaffInstrument':
					var i = reader.push({ type: value });
					reader.enter(i);
					tokenMode = TokenMode.EnterExit;
					return
			}
		}

		reader.set(key, value);
	},
};

var tokenMode = TokenMode.JustSet;

// aka "emits"
DataReader.prototype.token = function(key, value) {
	tokenMode(this, key, value);
};

DataReader.prototype.readUntil = function(x) {
	var pos = this.pos;
	while (this.array[pos] !== x && pos < this.array.length) {
		pos++;
	}

	var slice = this.array.subarray(this.pos, pos);
	pos++;
	this.pos = pos;
	return slice
};

DataReader.prototype.readUntilNonZero = function() {
	var x = this.pos;

	if (this.array[x] !== 0) return

	while (++x < this.array.length && this.array[x] === 0);
	var slice = this.array.subarray(this.pos, x);
	this.pos = x;
	return slice
};

DataReader.prototype.readLine = function() {
	return this.readUntil(0)
};

DataReader.prototype.readString = function() {
	return shortArrayToString(this.readLine())
};

DataReader.prototype.readByte = function() {
	var slice = this.array[this.pos++];
	return slice
};

DataReader.prototype.readSignedInt = function() {
	var int = this.readByte();
	return int > 127 ? int - 256 : int
};

DataReader.prototype.readShort = function() {
	var num = this.readBytes(2);
	return num[0] + num[1] * 256
};

DataReader.prototype.readBytes = function(k) {
	var pos = this.pos;
	pos += k;
	var slice = this.array.subarray(this.pos, pos);
	this.pos = pos;
	return slice
};

DataReader.prototype.skip = function(k) {
	this.pos += k || 1;
};

DataReader.prototype.dump = function(limit) {
	dump(this.array, this.pos, limit);
};

// Exports

Object.assign(NODE ? module.exports : window, {
	decodeNwcArrayBuffer: decodeNwcArrayBuffer$1,
});

// Fraction class reimported from Vexflow
//
// ## Description
// Fraction class that represents a rational number
//
// @author zz85
// @author incompleteopus (modifications)

class Fraction {
	/**
	 * GCD: Find greatest common divisor using Euclidean algorithm
	 */
	static GCD(a, b) {
		if (typeof a !== 'number' || typeof b !== 'number') {
			throw new Error('BadArgument', `Invalid numbers: ${a}, ${b}`)
		}

		let t;

		while (b !== 0) {
			t = b;
			b = a % b;
			a = t;
		}

		return a
	}

	/**
	 * LCM: Lowest common multiple
	 */
	static LCM(a, b) {
		return a * b / Fraction.GCD(a, b)
	}

	/**
	 * LCMM: Lowest common multiple for more than two numbers
	 */
	static LCMM(args) {
		if (args.length === 0) {
			return 0
		} else if (args.length === 1) {
			return args[0]
		} else if (args.length === 2) {
			return Fraction.LCM(args[0], args[1])
		} else {
			const arg0 = args[0];
			args.shift();
			return Fraction.LCM(arg0, Fraction.LCMM(args))
		}
	}

	constructor(numerator, denominator) {
		this.set(numerator, denominator);
	}
	set(numerator, denominator) {
		this.numerator = numerator === undefined ? 1 : numerator;
		this.denominator = denominator === undefined ? 1 : denominator;
		return this
	}
	value() {
		return this.numerator / this.denominator
	}
	simplify() {
		let u = this.numerator;
		let d = this.denominator;

		const gcd = Fraction.GCD(u, d);
		u /= gcd;
		d /= gcd;

		if (d < 0) {
			d = -d;
			u = -u;
		}
		return this.set(u, d)
	}
	add(param1, param2) {
		let otherNumerator;
		let otherDenominator;

		if (param1 instanceof Fraction) {
			otherNumerator = param1.numerator;
			otherDenominator = param1.denominator;
		} else {
			if (param1 !== undefined) {
				otherNumerator = param1;
			} else {
				otherNumerator = 0;
			}

			if (param2 !== undefined) {
				otherDenominator = param2;
			} else {
				otherDenominator = 1;
			}
		}

		const lcm = Fraction.LCM(this.denominator, otherDenominator);
		const a = lcm / this.denominator;
		const b = lcm / otherDenominator;

		const u = this.numerator * a + otherNumerator * b;
		return this.set(u, lcm)
	}
	subtract(param1, param2) {
		let otherNumerator;
		let otherDenominator;

		if (param1 instanceof Fraction) {
			otherNumerator = param1.numerator;
			otherDenominator = param1.denominator;
		} else {
			if (param1 !== undefined) {
				otherNumerator = param1;
			} else {
				otherNumerator = 0;
			}

			if (param2 !== undefined) {
				otherDenominator = param2;
			} else {
				otherDenominator = 1;
			}
		}

		const lcm = Fraction.LCM(this.denominator, otherDenominator);
		const a = lcm / this.denominator;
		const b = lcm / otherDenominator;

		const u = this.numerator * a - otherNumerator * b;
		return this.set(u, lcm)
	}
	multiply(param1, param2) {
		let otherNumerator;
		let otherDenominator;

		if (param1 instanceof Fraction) {
			otherNumerator = param1.numerator;
			otherDenominator = param1.denominator;
		} else {
			if (param1 !== undefined) {
				otherNumerator = param1;
			} else {
				otherNumerator = 1;
			}

			if (param2 !== undefined) {
				otherDenominator = param2;
			} else {
				otherDenominator = 1;
			}
		}

		return this.set(
			this.numerator * otherNumerator,
			this.denominator * otherDenominator
		)
	}
	divide(param1, param2) {
		let otherNumerator;
		let otherDenominator;

		if (param1 instanceof Fraction) {
			otherNumerator = param1.numerator;
			otherDenominator = param1.denominator;
		} else {
			if (param1 !== undefined) {
				otherNumerator = param1;
			} else {
				otherNumerator = 1;
			}

			if (param2 !== undefined) {
				otherDenominator = param2;
			} else {
				otherDenominator = 1;
			}
		}

		return this.set(
			this.numerator * otherDenominator,
			this.denominator * otherNumerator
		)
	}

	// Simplifies both sides and checks if they are equal.
	equals(compare) {
		const a = Fraction.__compareA.copy(compare).simplify();
		const b = Fraction.__compareB.copy(this).simplify();

		return a.numerator === b.numerator && a.denominator === b.denominator
	}

	// Greater than operator.
	greaterThan(compare) {
		const a = Fraction.__compareB.copy(this);
		a.subtract(compare);
		return a.numerator > 0
	}

	// Greater than or equals operator.
	greaterThanEquals(compare) {
		const a = Fraction.__compareB.copy(this);
		a.subtract(compare);
		return a.numerator >= 0
	}

	// Less than operator.
	lessThan(compare) {
		return !this.greaterThanEquals(compare)
	}

	// Less than or equals operator.
	lessThanEquals(compare) {
		return !this.greaterThan(compare)
	}

	// Creates a new copy with this current values.
	clone() {
		return new Fraction(this.numerator, this.denominator)
	}

	// Copies value of another Fraction into itself.
	copy(copy) {
		return this.set(copy.numerator, copy.denominator)
	}

	// Returns the integer component eg. (4/2) == 2
	quotient() {
		return Math.floor(this.numerator / this.denominator)
	}

	// Returns the fraction component when reduced to a mixed number
	fraction() {
		return this.numerator % this.denominator
	}

	// Returns the absolute value
	abs() {
		this.denominator = Math.abs(this.denominator);
		this.numerator = Math.abs(this.numerator);
		return this
	}

	// Returns a raw string representation
	toString() {
		return this.numerator + '/' + this.denominator
	}

	// Returns a simplified string respresentation
	toSimplifiedString() {
		return Fraction.__tmp
			.copy(this)
			.simplify()
			.toString()
	}

	// Returns string representation in mixed form
	toMixedString() {
		let s = '';
		const q = this.quotient();
		const f = Fraction.__tmp.copy(this);

		if (q < 0) {
			f.abs().fraction();
		} else {
			f.fraction();
		}

		if (q !== 0) {
			s += q;

			if (f.numerator !== 0) {
				s += ' ' + f.toSimplifiedString();
			}
		} else {
			if (f.numerator === 0) {
				s = '0';
			} else {
				s = f.toSimplifiedString();
			}
		}

		return s
	}

	// Parses a fraction string
	parse(str) {
		const i = str.split('/');
		const n = parseInt(i[0], 10);
		const d = i[1] ? parseInt(i[1], 10) : 1;

		return this.set(n, d)
	}
}

// Temporary cached objects
Fraction.__compareA = new Fraction();
Fraction.__compareB = new Fraction();
Fraction.__tmp = new Fraction();

if (NODE) module.exports = Fraction;

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
]);

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
]);

var NOTE_NAMES = 'C D E F G A B'.split(' ');

function isTabbable(token) {
	const visible = token.Visibility !== 'Never';
	if (tabbableTypes.has(token.type)) {
		// visible &&
		return true
	} else {
		if (!untabbableTypes.has(token.type) && visible)
			console.log('NOT TABING', token.type);
		return false
	}
}

function interpret$1(data) {
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
				reading.tickCounter.add(token.durValue).simplify();
				reading.tabCounter.add(token.durValue).simplify();
			} else {
				if (isTabbable(token)) {
					reading.tmpFraction.set(1, 4);
					reading.tabCounter.add(reading.tmpFraction).simplify();
				}
			}

			token.tickUntilValue = reading.tickCounter.value();
			token.tabUntilValue = reading.tabCounter.value();
		});
	});
}

function SightReader() {
	// Note Streamer
	this.tickCounter = new Fraction(0, 1); // commutativeTickDuration
	this.tabCounter = new Fraction(0, 1); // commutativeTabDuration
	this.tmpFraction = new Fraction(0, 1);
	this.timeSigVal = new Fraction(4, 4);
	this.reset();
}

SightReader.prototype.reset = function() {
	this.setClef('treble');
	this.tickCounter.set(0, 1);
	this.tabCounter.set(0, 1);
	this.lastTimeSignature = null;

	this.pitches = {};
	this.keySig = {};
	this.setKeySignature(['C']);
};

SightReader.prototype.setClef = function(clef) {
	this.clef = clef;
	this.offset = CLEF_PITCH_OFFSETS[clef];
};

SightReader.prototype.Clef = function(token) {
	this.setClef(token.clef);
};

SightReader.prototype.TimeSignature = function(token) {
	this.lastTimeSignature = token;
	// TODO account for Common / Cuttime
	if (!(token.group && token.beat)) {
		if (token.signature === 'Common') {
			token.group = 4;
			token.beat = 4;
		}
		if (token.signature === 'AllaBreve') {
			token.group = 2;
			token.beat = 2;
		}
	}

	this.timeSigVal.set(token.group, token.beat);
};

SightReader.prototype.Barline = function() {
	// reset
	this.pitches = {}; // should reset??
};

const sharps = {
	C: [],
	G: ['f#'],
	D: ['f#', 'c#'],
	A: ['f#', 'c#', 'g#'],
	E: ['f#', 'c#', 'g#', 'd#'],
	B: ['f#', 'c#', 'g#', 'd#', 'a#'],
	'F#': ['f#', 'c#', 'g#', 'd#', 'a#', 'e#'],
	'C#': ['f#', 'c#', 'g#', 'd#', 'a#', 'e#', 'b#'],
};

const flats = {
	C: [],
	F: ['Bb'],
	Bb: ['Bb', 'Eb'],
	Eb: ['Bb', 'Eb', 'Ab'],
	Ab: ['Bb', 'Eb', 'Ab', 'Db'],
	Db: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
	Gb: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
	Cb: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
};

SightReader.prototype.setKeySignature = function(accidentals) {
	// Majors only!
	NOTE_NAMES.forEach(name => {
		this.keySig[name.toUpperCase()] = '';
	});

	if (!accidentals || !accidentals.length) return
	accidentals.forEach((accidental, l) => {
		this.keySig[accidental.charAt(0).toUpperCase()] = accidental.charAt(1);
	});
};

SightReader.prototype.KeySignature = function(token) {
	var signature = token.key;
	const accidentals = sharps[signature] || flats[signature];
	this.setKeySignature(accidentals);

	// reset
	token.accidentals = accidentals;
	token.clef = this.clef;
	token.clefOffset = this.offset;
};

function circularIndex(n) {
	var m = 7;
	return n < 0 ? (m - -n % m) % m : n % m
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

SightReader.prototype.Rest = function(token) {
	if (token.duration === 1) {
		// whole bar rest take into account time signature

		token.durValue = this.timeSigVal.clone();
		return
	}
	this._handle_duration(token);
};

SightReader.prototype.Chord = function(token) {
	this._handle_duration(token);
};

var OCTAVE_START = 3;
var OCTAVE_NOTES = 7;

var CLEF_PITCH_OFFSETS = {
	treble: (OCTAVE_START + 1) * OCTAVE_NOTES + 6, // b'
	bass: (OCTAVE_START + 0) * OCTAVE_NOTES + 1, // d
	alto: (OCTAVE_START + 1) * OCTAVE_NOTES, // c'
	tenor: (OCTAVE_START + 0) * OCTAVE_NOTES + 5, // a'
};

SightReader.prototype.Note = function(token) {
	var pos = token.position;

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
	} else if (this.pitches[pitch] !== undefined) {
		// takes the running value from pitch
		computedAccidental = this.pitches[pitch];
	} else {
		var changed = this.keySig[note_name];
		if (changed) {
			computedAccidental = changed;
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
};

window.interpret = interpret$1;

const fontMap = {
	// barlines

	// clefs
	gClef: 'e050', // treble
	cClef: 'e05c', // alto
	fClef: 'e062', // bass

	// time signatures
	timeSig0: 'e080',
	timeSig1: 'e081',
	timeSig2: 'e082',
	timeSig3: 'e083',
	timeSig4: 'e084',
	timeSig5: 'e085',
	timeSig6: 'e086',
	timeSig7: 'e087',
	timeSig8: 'e088',
	timeSig9: 'e089',
	timeSigCommon: 'e08a',
	timeSigCutCommon: 'E08B',

	// text based only
	// timeSigCombNumerator timeSig8Numerator
	// timeSigCombNumerator: 'E09E',

	// stemUpSE

	// Rests
	restDoubleWhole: 'E4E2',
	restWhole: 'E4E3',
	restHalf: 'E4E4',
	restQuarter: 'E4E5',
	rest8th: 'E4E6',
	rest16th: 'E4E7',
	rest32nd: 'E4E8',
	rest64th: 'E4E9',
	rest128th: 'E4EA',

	// Noteheads
	noteheadDoubleWhole: 'E0A0',
	noteheadWhole: 'E0A2',
	noteheadHalf: 'E0A3',
	noteheadBlack: 'E0A4',

	noteWhole: 'E1D2', // 1D15D
	noteHalfUp: 'E1D3', // 1D15E

	stem: 'E210',

	flag8thUp: 'E240',
	flag8thDown: 'E241',
	flag16thUp: 'E242',
	flag16thDown: 'E243',
	flagInternalUp: 'E250',
	flagInternalDown: 'E251',
	restHBar: 'E4EE	',

	// Repeats
	repeat1Bar: 'E500',
	repeat2Bars: 'E501',
	repeat4Bars: 'E502',

	// Standard accidentals (12-EDO) (U+E260–U+E26F)

	accidentalFlat: 'e260',
	accidentalNatural: 'e261',
	accidentalSharp: 'e262',
	accidentalDoubleSharp: 'e263',
	accidentalDoubleFlat: 'e264',
	accidentalNaturalFlat: 'e267',
	accidentalNaturalSharp: 'e268',
	accidentalParensLeft: 'e26a',
	accidentalParensRight: 'e26b',

	textBlackNoteShortStem: 'E1F0',
	textAugmentationDot: 'E1FC',
	textTuplet3ShortStem: 'E1FF',

	// Dynamics (U+E520–U+E54F)
	dynamicPiano: 'E520',
	dynamicMezzo: 'E521',
	dynamicForte: 'E522',
	dynamicRinforzando: 'E523',
	dynamicSforzando: 'E524',

	// Common ornaments (U+E560–U+E56F)
};

const getCode = name => String.fromCharCode(parseInt(fontMap[name], 16));

function setupCanvas() {
	var score = document.getElementById('score');
	var invisible_canvas = document.getElementById('invisible_canvas');

	var canvas = document.createElement('canvas');
	score.insertBefore(canvas, invisible_canvas);

	var ctx = canvas.getContext('2d');

	window.ctx = ctx;
	window.canvas = canvas;

	resizeByBounds$1();
}

function resizeByBounds$1() {
	var score = document.getElementById('score');
	const bb = score.getBoundingClientRect();
	console.log(bb);

	// TODO take min of canvas size vs bb heigh
	// resize(bb.width, bb.height)
	resize(score.clientWidth - 20, score.clientHeight - 20);
}

function resize(width, height) {
	var dpr = window.devicePixelRatio;

	width = width || 800;
	height = height || 800;

	canvas.width = width * dpr;
	canvas.height = height * dpr;
	canvas.style.width = width;
	canvas.style.height = height;

	ctx.scale(dpr, dpr);
}

/* opentype.js loading */
function setup$1(render, path) {
	if (notableLoaded) return render()

	path = path || 'vendor/bravura-1.211/';

	setupCanvas();
	loadFont(render, path);
}

var notableLoaded = false;

function loadFont(cb, path) {
	window.opentype.load(`${path}otf/Bravura.otf`, (err, font) => {
		if (err) return console.log('Error, font cannot be loaded', err)

		notableLoaded = true;
		window.smuflFont = font;
		cb && cb();
	});
}

class Draw {
	draw() {
		console.log('implement me .draw()');
	}

	outline() {}

	debug(ctx) {
		ctx.fillRect(0, 0, 10, 10);

		console.log(this.width);
		ctx.strokeRect(0, 0, this.width || 40, 40);
		// TODO add y bounds
	}

	moveTo(x, y) {
		this.x = x;
		this.y = y;
	}

	positionY(semitones) {
		this.offsetY = this.unitsToY(semitones);
	}

	unitsToY(units) {
		return -units / 2 / 4 * FONT_SIZE
	}
}

class Stave$1 extends Draw {
	constructor(width) {
		super();
		this.size = FONT_SIZE; // TODO global
		this.x = 0;
		this.y = 0;
		this.width = width || 100;
	}

	draw(ctx) {
		const { width, size } = this;

		ctx.strokeStyle = '#000';
		ctx.lineWidth = 1.3;

		// 5 lines
		const spaces = 4; // TODO global
		for (let i = 0; i <= spaces; i++) {
			const ty = -i / spaces * size;
			ctx.beginPath();
			ctx.moveTo(0, ty);
			ctx.lineTo(width, ty);
			ctx.stroke();
		}

		// this.debug(ctx);
	}
}

class Line$1 extends Draw {
	constructor(x0, y0, x1, y1) {
		super();
		this.x = x0;
		this.y = y0;
		this.x1 = x1;
		this.y1 = y1;
	}

	draw(ctx) {
		ctx.beginPath();
		ctx.lineWidth = 1.4;
		ctx.moveTo(this.x, this.y);
		ctx.lineTo(this.x1, this.y1);
		ctx.stroke();
	}
}

class Glyph$1 extends Draw {
	constructor(char, adjustY) {
		super();

		this.name = char;
		this.char = getCode(char);
		this.fontSize = FONT_SIZE; // * (0.8 + Math.random() * 0.4);
		this.width = window.smuflFont.getAdvanceWidth(this.char, this.fontSize);

		// this.padLeft = this.width;
		if (adjustY) this.positionY(adjustY);
	}

	draw(ctx) {
		ctx.fillStyle = '#000';

		window.smuflFont.draw(ctx, this.char, 0, 0, this.fontSize);
		// this.debug(ctx);
	}
}

const Clef$1 = Glyph$1;

/**
 * Clefs
 */

class TrebleClef extends Clef$1 {
	constructor() {
		super('gClef', 2);
	}
}

class BassClef extends Clef$1 {
	constructor() {
		super('fClef', 6);
	}
}

class AltoClef extends Clef$1 {
	constructor() {
		super('cClef', 4);
	}
}

/**
 * Time signatures
 */
class TimeSignature$2 extends Glyph$1 {
	constructor(x = 0, y) {
		super('timeSig' + x, y);
	}
}

function noteToPosition(note, clefOffset) {
	// TODO fix this!
	let y = rotate(note, clefOffset);
	if (y + 7 < 9) return y + 7
	return y
}

const AG = 'abcdefg';
function rotate(note, offset) {
	const pos = (AG.indexOf(note) + 3 + (offset || 0)) % AG.length;
	return pos
}

// e => 0, f => 1, g => 2, a => 3, b => 4, c => 5, d => 6
// 1| 2 3| 4 5| 6 7| 8 9|

// gClef = 'e' // line 0 = e // 0
// fClef = 'g' // line 0 = g // 5 -2
// // alto 6 -1
var clefOffsetMap = {
	treble: 0,
	bass: -2,
};
/**
 * Key Signature
 */
class KeySignature$2 extends Draw {
	constructor(accidentals, clef) {
		super();
		// eg. ['f#', 'c#', 'g#', 'd#', 'a#', 'e#', 'b#'] ||
		// ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb']
		this.accidentals = accidentals;

		this.sharps = this.accidentals.map((v, l) => {
			const pos = noteToPosition(
				v.charAt(0).toLowerCase(),
				clefOffsetMap[clef] || 0
			);

			const sharp = new Accidental$1(v.charAt(1), pos);
			sharp.moveTo(l * sharp.width, 0);
			// sharp._debug = true;
			return sharp
		});

		if (this.sharps.length)
			this.width = this.sharps.length * this.sharps[0].width;
	}

	draw(ctx) {
		this.sharps.forEach(s => Drawing$1._draw(ctx, s));
	}
}

class Sharp extends Glyph$1 {
	constructor(name, pos) {
		super('accidentalSharp', pos);
	}
}

class Flat extends Glyph$1 {
	constructor(name, pos) {
		super('accidentalFlat', pos);
	}
}

class Natural extends Glyph$1 {
	constructor(name, pos) {
		super('accidentalNatural', pos);
	}
}

class DoubleSharp extends Glyph$1 {
	constructor(name, pos) {
		super('accidentalDoubleSharp', pos);
	}
}

class Accidental$1 extends Glyph$1 {
	constructor(name, pos) {
		super(
			name === '#'
				? 'accidentalSharp'
				: name === 'b'
					? 'accidentalFlat'
					: name === 'n' || name === ''
						? 'accidentalNatural'
						: name === 'x'
							? 'DoubleSharp'
							: name === 'v' ? 'accidentalDoubleFlat' : '',
			pos
		);

		// super('accidental' + name[0].toUpperCase() + , pos)
	}
}

class Ledger$1 extends Draw {
	constructor(start, end) {
		super();
		const from = Math.min(start, end);
		const to = Math.max(start, end);
		this.positionY(from);
		this.to = to - from;
		this.width = 18;
	}

	draw(ctx) {
		for (let i = 0; i < this.to; i += 2) {
			ctx.beginPath();
			ctx.moveTo(-4, this.unitsToY(i));
			ctx.lineTo(this.width, this.unitsToY(i));
			ctx.stroke();
		}
	}
}

// TODO generalized as vertical lines?
class Stem$1 extends Draw {
	constructor(start, len) {
		super();
		// this.name = 'stem';
		this.positionY(start);
		this.len = len || 7;
	}

	draw(ctx) {
		ctx.beginPath();
		ctx.lineWidth = 1.2;
		ctx.moveTo(0, 0);
		ctx.lineTo(0, this.unitsToY(this.len));
		ctx.stroke();
	}
}

class Barline$2 extends Draw {
	constructor(start, len) {
		super();
		this.len = len || 8;
	}

	draw(ctx) {
		ctx.beginPath();
		ctx.lineWidth = 1.2;
		ctx.moveTo(0, 0);
		ctx.lineTo(0, this.unitsToY(this.len));
		ctx.stroke();
	}
}

class Dot$1 extends Glyph$1 {
	constructor(pos) {
		super('textAugmentationDot', pos);
		this.offsetX = 5;
	}
}

class Text$2 extends Glyph$1 {
	constructor(text, position, opts) {
		super();
		if (!text) {
			console.log('NO TEXT', text);
		}
		this.text = text || '';
		this.positionY(-position || 0);

		// .font .textAlign
		if (opts) Object.assign(this, opts);
	}

	draw(ctx) {
		ctx.font = this.font || 'italic bold 12px arial';
		if (this.textAlign) ctx.textAlign = this.textAlign;
		ctx.fillText(this.text, 0, 0);
	}
}

class Drawing$1 {
	constructor(ctx) {
		this.set = new Set();

		ctx.font = `${FONT_SIZE}px Bravura`;
		ctx.textBaseline = 'alphabetic'; // alphabetic  bottom top
	}

	add(el) {
		this.set.add(el);
	}

	remove(el) {
		this.set.delete(el);
	}

	static _draw(ctx, el) {
		if (el instanceof Draw) {
			ctx.save();
			ctx.translate(el.x, el.y);
			ctx.translate(el.offsetX || 0, el.offsetY || 0);
			el.draw(ctx);

			if (el._text) {
				ctx.font = '8px arial';
				ctx.fillText(el._text, 0, 50);
			}

			if (el._debug) {
				el.debug(ctx);
			}
			ctx.restore();
		} else {
			console.log('Element', el, 'not a draw element');
		}
	}

	draw(ctx) {
		ctx.save();
		for (const el of this.set) {
			Drawing$1._draw(ctx, el);
		}
		ctx.restore();
	}
}

// TODO find namespace

const Claire$1 = {
	Drawing: Drawing$1,
	Draw,
	Stave: Stave$1,
	Glyph: Glyph$1,
	TrebleClef,
	BassClef,
	AltoClef,
	TimeSignature: TimeSignature$2,
	KeySignature: KeySignature$2,
	Accidental: Accidental$1,
	Sharp,
	Flat,
	Natural,
	DoubleSharp,
	Stem: Stem$1,
	Barline: Barline$2,
	Dot: Dot$1,
	Ledger: Ledger$1,
	Text: Text$2,
	Line: Line$1,
};

Object.assign(
	window,
	{ Drawing: Drawing$1, setup: setup$1, Stave: Stave$1, Claire: Claire$1, resize, resizeByBounds: resizeByBounds$1 },
	Claire$1
);

/**********************
 *
 *   Exporters
 *
 **********************/

function exportAbc() {
	// ABC references
	// http://trillian.mit.edu/~jc/music/abc/doc/ABCprimer.html
	// http://abcnotation.com/wiki/abc:standard:v2.1#rests

	var abc = [];
	interpret(data);

	abc.push('X: 1'); // reference number

	var { title, author } = data.info || {};
	if (title) abc.push(`T: ${title}`); // title
	if (title) abc.push(`C: ${author}`); // composer
	abc.push(`N: Generated from Notably`); // notes

	//

	data.score.staves[0].tokens
		.filter(token => token.type === 'TimeSignature')
		.some(token => {
			abc.push(`M:${token.group}/${token.beat}`); // Meter
			return true
		});

	// hardcode tempo first
	abc.push('Q:1/4=100');

	data.score.staves[0].tokens
		.filter(token => token.type === 'Tempo')
		.some(token => {
			// abc.push(`Q:1/${token.note}=${token.duration}`) // Tempo
			abc.push(`Q:1/4=${token.duration}`); // Tempo

			return true
		});

	abc.push('L: 1'); // default note length
	// N: // comments
	// K: Key

	const abc_accidentals = { b: '_', '#': '^', n: '=' };

	data.score.staves.forEach((stave, v) => {
		var tmp = '';

		tmp += `\n[V:${v}]\n`;
		stave.tokens.forEach(token => {
			if (token.type === 'Note') {
				if (token.accidentalValue) {
					tmp += abc_accidentals[token.accidentalValue];
				}

				tmp += token.name.toLowerCase();
				var octave = token.octave - 4;

				if (octave < 0) {
					tmp += Array(Math.abs(octave))
						.fill(',')
						.join('');
				} else {
					tmp += Array(octave)
						.fill("'")
						.join('');
				}

				// tmp += '1/' + token.duration
				// tmp += Array(token.dots).fill('.').join('')
				tmp += token.durValue.toString();
				tmp += ' ';
			}

			if (token.type === 'Barline') {
				tmp += '|\n';
			}

			if (token.type === 'Rest') {
				tmp += `z${token.durValue.toString()} `;
			}

			// if (token.type === 'KeySignature') {
			// 	console.log(token);
			// 	// ly += `\\key ${token.signature}`
			// }

			if (token.type === 'TimeSignature') {
				tmp += `M:${token.group}/${token.beat}\n`; // Meter
			}
		});

		abc.push(tmp);
	});

	abc = abc.join('\n');
	console.log('abc', abc);

	return abc
}

// based on nwc music json representation,
// attempt to convert them to symbols to be drawn.
// also make weak attempt to lay them out

// music json -> draw symbols. interpretation? translation? engrave? typeset? layout? drawing?

/**
 * TODOs
 * - triplets
 * - dynamics
 */
const X_STRETCH = 0.5;

class StaveCursor {
	constructor(stave, staveIndex) {
		this.tokenIndex = -1;
		this.staveIndex = staveIndex;
		this.staveX = 60;
		this.stave = stave;
		this.tokens = stave.tokens;
	}

	peek() {
		return this.tokens[this.tokenIndex + 1]
	}

	hasNext() {
		return this.tokenIndex + 1 < this.tokens.length
	}

	next(func) {
		const tokenIndex = this.incTokenIndex();
		const token = this.tokens[tokenIndex];

		this.lastPadRight = 0;
		func(token, tokenIndex, this.staveIndex, this);
	}

	incStaveX(inc) {
		this.staveX += inc;
	}

	tokenPadRight(pad) {
		this.lastPadRight = pad;
		// this.incStaveX(pad);
	}

	posGlyph(glyph) {
		glyph.moveTo(this.staveX, getStaffY(this.staveIndex));
	}

	incTokenIndex() {
		return ++this.tokenIndex
	}
}

class TickTracker {
	constructor() {
		this.maxTicks = {};
	}

	add(token, cursor) {
		if (token.Visibility === 'hidden') return

		const refValue = token.tabUntilValue;
		// tickValue tickUntilValue tabValue
		const which = this.maxTicks[refValue];

		const x = cursor.staveX + cursor.lastPadRight * X_STRETCH || 0;
		if (!which || x > which.staveX) {
			this.maxTicks[refValue] = {
				cursor,
				staveX: x,
				token: token,
			};
		}
	}

	alignWithMax(token, cursor) {
		// console.log('alignWithMax', token, cursor);

		let moveX = cursor.staveX;

		if (cursor.lastPadRight) {
			moveX += cursor.lastPadRight * 4;
		}

		// increments staveX or align with item which already contains staveX for tabValue
		const key = token.tabValue;
		if (key && key in this.maxTicks) {
			const which = this.maxTicks[key];

			moveX = which.staveX;
		}

		cursor.staveX = moveX;
		return false
	}
}

const tickTracker = new TickTracker();
let drawing; // placeholder for drawing system
let info; // running debug info

function quickDraw(data, x, y) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.save();
	ctx.translate(x, y);
	drawing.draw(ctx);
	ctx.restore();
}

window.quickDraw = quickDraw;

function score(data) {
	var ctx = window.ctx;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawing = new Drawing(ctx);

	const staves = data.score.staves;
	const stavePointers = staves.map(
		(stave, staveIndex) => new StaveCursor(stave, staveIndex)
	);

	/*
	stavePointers.forEach((cursor, staveIndex) => {
		cursor.tokens.forEach((token, tokenIndex) => {
			handleToken(token, tokenIndex, staveIndex, cursor);
		});
	});
	*/

	while (true) {
		// for (var i = 0; i < 50; i++) {
		if (!stavePointers.some(s => s.hasNext())) {
			console.log('nothing left');
			break
		}

		var smallestTick = Infinity,
			smallestIndex = -1;
		stavePointers.forEach(cursor => {
			const token = cursor.peek();
			if (!token) return
			const tick = token.tabValue || 0;

			if (tick < smallestTick) {
				smallestTick = tick;
				smallestIndex = cursor.staveIndex;
			}
		});

		if (smallestIndex > -1) {
			stavePointers[smallestIndex].next(handleToken);
		} else {
			console.log('no candidate!!');
		}
	}

	window.maxCanvasWidth = 100;
	window.maxCanvasHeight = 100;

	// draw staves
	stavePointers.forEach((cursor, staveIndex) => {
		drawStave(cursor, staveIndex);
		maxCanvasWidth = Math.max(cursor.staveX + 100, maxCanvasWidth);
	});

	// draw braces
	var bottom = getStaffY(stavePointers.length - 1) - FONT_SIZE$1 * 0.5;
	drawing.add(new Line(20, getStaffY(-1), 20, bottom));

	maxCanvasHeight = bottom + 10;

	var { title, author, copyright1, copyright2 } = data.info || {};
	var middle = window.innerWidth / 2;
	if (title) {
		var titleDrawing = new Claire.Text(title, 0, {
			font: '20px arial',
			textAlign: 'center',
		}); // italic bold
		titleDrawing.moveTo(middle, 40);
		drawing.add(titleDrawing);
	}

	if (author) {
		var authorDrawing = new Claire.Text(author, 0, {
			font: 'italic 14px arial',
			textAlign: 'center',
		}); // italic bold
		authorDrawing.moveTo(middle, 60);
		drawing.add(authorDrawing);
	}

	if (copyright1) {
		var authorDrawing = new Claire.Text(copyright1, 0, {
			font: '10px arial',
			textAlign: 'center',
		}); // italic bold
		authorDrawing.moveTo(middle, bottom + 80);
		drawing.add(authorDrawing);
	}

	if (copyright2) {
		var authorDrawing = new Claire.Text(copyright2, 0, {
			font: '10px arial',
			textAlign: 'center',
		}); // italic bold
		authorDrawing.moveTo(middle, bottom + 90);
		drawing.add(authorDrawing);
	}

	drawing.draw(ctx);

	// TODO move this out of this function

	var invisible_canvas = document.getElementById('invisible_canvas');
	invisible_canvas.style.width = `${maxCanvasWidth}px`;
	invisible_canvas.style.height = `${Math.max(
		maxCanvasHeight,
		document.getElementById('score').clientHeight
	)}px`;

	// https://stackoverflow.com/questions/21064101/understanding-offsetwidth-clientwidth-scrollwidth-and-height-respectively
}

function getStaffY(staffIndex) {
	return FONT_SIZE$1 * 4 + FONT_SIZE$1 * 2.6 * staffIndex
	// 120 100
}

function drawStave(cursor, staveIndex) {
	const staveStart = 40;
	const s = new Stave(cursor.staveX + staveStart);
	s.moveTo(staveStart, getStaffY(staveIndex));
	drawing.add(s);

	console.log('staveIndex', staveIndex, cursor.tokens);
}

function handleToken(token, tokenIndex, staveIndex, cursor) {
	// info = tokenIndex
	// info = absCounter++ + ' : ' + tokenIndex
	let info = '';
	const type = token.type;
	let t, s;

	// console.log('handleToken', token)
	tickTracker.alignWithMax(token, cursor);

	switch (type) {
		default:
			console.log('Typeset: Unhandled type - ', type); // , token
			break
		case 'StaffProperties':
		case 'StaffInstrument':
			// TODO infomational purposes
			break

		case 'Clef':
			// TODO handle octave down
			// console.log('clef', token);
			let clef;
			switch (token.clef) {
				case 'treble':
					clef = new Claire.TrebleClef();
					break
				case 'bass':
					clef = new Claire.BassClef();
					break
				case 'alto':
					clef = new Claire.AltoClef();
					break
				default:
					console.log('ERR unknown clef', token.clef);
			}
			// clef = new {
			// 	treble: Claire.TrebleClef,
			// }[token.clef]()

			cursor.posGlyph(clef);
			drawing.add(clef);
			cursor.incStaveX(clef.width * 2);
			break

		case 'TimeSignature':
			const sig = token.signature;

			var name =
				sig === 'AllaBreve' ? 'CutCommon' : sig === 'Common' ? 'Common' : '';

			if (name) {
				t = new TimeSignature('Common', 4);
				cursor.posGlyph(t);
				drawing.add(t);

				cursor.incStaveX(t.width * 2);
			} else if (token.group && token.beat) {
				t = new TimeSignature(token.group, 6);
				cursor.posGlyph(t);
				drawing.add(t);

				t = new TimeSignature(token.beat, 2);
				cursor.posGlyph(t);
				drawing.add(t);

				cursor.incStaveX(t.width * 2);
			}

			break
		case 'KeySignature':
			const key = new KeySignature(token.accidentals, token.clef);
			cursor.posGlyph(key);
			drawing.add(key);

			cursor.incStaveX(key.width * 2);
			break

		case 'Rest':
			var duration = token.duration;
			var sym = {
				1: 'restWhole',
				2: 'restHalf',
				4: 'restQuarter',
				8: 'rest8th',
				16: 'rest16th',
			}[duration];

			if (!sym) console.log('FAIL REST', token, duration);

			s = new Glyph(sym, token.position + 4); // + 4
			cursor.posGlyph(s);
			s._text = info;
			drawing.add(s);

			cursor.incStaveX(s.width * 1);
			cursor.tokenPadRight(s.width * calculatePadding(token.durValue));
			break

		case 'Barline':
			s = new Barline();
			cursor.posGlyph(s);
			s._text = info;
			drawing.add(s);

			cursor.tokenPadRight(10);
			break

		case 'Chord':
			let tmp = cursor.staveX;
			token.notes.forEach(note => {
				cursor.staveX = tmp;
				drawForNote(note, cursor, token);
			});
			break

		case 'Note':
			drawForNote(token, cursor, token);
			break
		case 'Text':
			var pos = token.position !== undefined ? token.position : -11;
			var text = new Text(token.text, pos);
			cursor.posGlyph(text);
			drawing.add(text);
			break
		case 'PerformanceStyle':
			var pos = token.position !== undefined ? token.position : -11;
			var text = new Text(token.text, pos);
			cursor.posGlyph(text);
			drawing.add(text);
			break
		case 'Tempo':
			var pos = token.position !== undefined ? token.position : -15;
			var text = new Text(
				// `${token.note} = ${token.duration}`
				`(${token.duration})`,
				pos
			);
			cursor.posGlyph(text);
			drawing.add(text);
			break
		case 'Dynamic':
			var pos = token.position !== undefined ? token.position : 7;
			var text = new Text(token.dynamic, pos);
			cursor.posGlyph(text);
			drawing.add(text);
			break
		case 'moo':
			console.log('as', token);
			break
	}

	tickTracker.add(token, cursor);
}

function drawForNote(token, cursor, durToken) {
	const duration = durToken.duration;
	const durValue = durToken.durValue;

	const sym =
		duration < 2
			? 'noteheadWhole'
			: duration < 4 ? 'noteheadHalf' : 'noteheadBlack';

	const relativePos = token.position + 4;
	const requireStem = duration >= 2;
	const stemUp =
		token.Stem === 'Up'
			? true
			: token.Stem === 'Down' ? false : token.position < 0;

	// TODO refactor flag drawing!!
	const requireFlag = duration >= 8;

	if (token.accidental) {
		var acc = new Accidental(token.accidental, relativePos);
		cursor.posGlyph(acc);
		acc.offsetX = -acc.width * 1.2;
		drawing.add(acc);
	}

	// if (token.Beam) console.log('Beam', token);

	// note head
	const noteHead = new Glyph(sym, relativePos);
	cursor.posGlyph(noteHead);
	// noteHead._text = info + '.' // + ':' + token.name;
	drawing.add(noteHead);
	const noteHeadWidth = noteHead.width;
	let space = noteHeadWidth;

	// ledger lines
	if (relativePos < 0) {
		const ledger = new Ledger(((relativePos / 2) | 0) * 2, 0);
		cursor.posGlyph(ledger);
		drawing.add(ledger);
	} else if (relativePos > 8) {
		const ledger = new Ledger((((relativePos + 1) / 2) | 0) * 2, 8);
		cursor.posGlyph(ledger);
		drawing.add(ledger);
	}

	if (requireStem && !stemUp) {
		// stem down
		const stem = new Stem(relativePos - 7);
		cursor.posGlyph(stem);
		drawing.add(stem);

		let flag;
		if (requireFlag) {
			flag = new Glyph(`flag${duration}thDown`, relativePos - 7 - 0.5);
			cursor.posGlyph(flag);
			flag._text = info;
			drawing.add(flag);
			space = Math.max(space, flag.width || 0);
		}

		cursor.incStaveX(space);
	} else if (requireStem && stemUp) {
		cursor.incStaveX(noteHeadWidth);

		let flag;

		// stem up
		const stem = new Stem(relativePos);
		cursor.posGlyph(stem);
		drawing.add(stem);
		// cursor.incStaveX(stem.width);

		// Flags
		if (requireFlag) {
			flag = new Glyph(`flag${duration}thUp`, relativePos + 7);
			cursor.posGlyph(flag);
			flag._text = info;
			drawing.add(flag);
			cursor.incStaveX(flag.width);
		}
	} else {
		cursor.incStaveX(noteHeadWidth);
	}

	for (let i = 0; i < token.dots; i++) {
		const dot = new Dot(relativePos);
		cursor.posGlyph(dot);
		drawing.add(dot);
		cursor.incStaveX(dot.width);
	}

	var spaceMultiplier = calculatePadding(durValue || token.durValue);
	cursor.tokenPadRight(noteHead.width * 1 * spaceMultiplier);
}

function calculatePadding(durValue) {
	// TODO tweak this, consider exponential or constrains systems
	var spaceMultiplier = Math.min(Math.max(durValue.value() * 8, 1), 8);
	// use 1/8 as units
	// console.log(spaceMultiplier);

	return spaceMultiplier
}

/**********************
 *
 *   Entry
 *
 **********************/

window.addEventListener('resize', () => {
	resizeByBounds();
});

// For testing purposes
setTimeout(() => {
	// data = blank
	// data = test_data;
	// data = test_dot_quaver;
	// rerender();
});

// v1.7 nwc
// ajax('samples/anongs.nwc', processData);
// ajax('samples/adohn.nwc', processData);
// ajax('samples/bwv140-2.nwc', processData);
// ajax('samples/carenot.nwc', processData);

// v2.75
// ajax('samples/AveMariaArcadelt.nwc', processData);
// ajax('samples/WeThreeKingsOfOrientAre.nwc', processData)

// v2.02?
// ajax('samples/AChildThisDayIsBorn.nwc', processData);
ajax('samples/WhatChildIsThis.nwc', processData$1);
/**
 * Playback
 */

const play = () => {
	// Select a timbre that sounds like a piano.
	const inst = new Instrument({ wave: 'piano', detune: 0 });

	// inst.on('noteon', e => console.log('noteon', e))
	// inst.on('noteoff', e => console.log('noteoff', e))

	// The song below is written in ABC notation.  More on abc
	// notation can be found at http://abcnotation.com/.
	var song = exportAbc();

	// Play a song from a string in ABC notation.
	inst.play(song, () => {
		console.log('(Done playing.)');
	});
};

document.getElementById('play').onclick = play;

const rerender = () => {
	setup(() => {
		interpret(data$1);
		score(data$1);
	});
	// exportLilypond()
};

let data$1;

function processData$1(payload) {
	data$1 = decodeNwcArrayBuffer(payload);
	window.data = data$1;
	// console.log(JSON.stringify(data.score.staves[1].tokens.slice(0, 20), 0, 0));
	rerender();
}

window.rerender = rerender;
window.processData = processData$1;

}());
