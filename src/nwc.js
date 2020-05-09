import './constants.js'
import { NwcConstants, FontStyles } from './nwc_constants.js'
import { TokenParsers } from './nwc_parser.js'

var should_debug = false

function debug(...args) {
	if (should_debug) console.log(...args)
}

function decodeNwcArrayBuffer(arrayBuffer) {
	var byteArray = new Uint8Array(arrayBuffer)
	var firstBytes = shortArrayToString(byteArray.subarray(0, 5))
	if ('[NWZ]' === firstBytes) {
		var nwz = byteArray.subarray(6)
		if (isBrowser()) {
			var inflate = new Zlib.Inflate(nwz)
			var plain = inflate.decompress()
		}
		if (isNode()) {
			var plain = require('zlib').inflateSync(Buffer.from(nwz))
			// require('fs').writeFileSync('plain.nwc', plain);
		}

		return processNwc(plain)
	} else if ('[Note' === firstBytes) {
		return processNwc(byteArray)
	} else if ('!Note' === firstBytes) {
		return processNwcText(byteArray, longArrayToString(byteArray))
	} else {
		console.log('Unrecognized headers', firstBytes)
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

	var buffer = []

	var chunk = 1024 || chunk
	for (var i = 0; i < array.length; i += chunk) {
		buffer.push(shortArrayToString(array.slice(i, i + chunk)))
	}

	return buffer.join('')
}

/**********************
 *
 *   Start Data Process
 *
 **********************/

function processNwcText(array, nwctext) {
	// copy pasta from below
	var reader = new DataReader(array)
	if (isBrowser()) window.reader = reader
	// Header(reader)
	if (reader.data.header.version < 2.7) {
		console.log('warning, should not be < 2.7 version')
	}

	console.log('done', nwctext)
	reader.set('nwctext', nwctext)
	parseNwc275(reader, nwctext)
	convert275Tokens(reader)
	return reader.data
}

function processNwc(array) {
	var reader = new DataReader(array)
	if (isBrowser()) window.reader = reader

	/*
	// dump
	for (;reader.pos < reader.array.length;) {
		reader.dump();
		reader.skip(80)
	}
	return
	*/

	Header(reader)
	if (reader.data.header.version >= 2.7) {
		console.log('done', reader.data)
		var nwctext = longArrayToString(reader.readLine())
		// console.log(nwctext);
		reader.set('nwctext', nwctext)
		parseNwc275(reader, nwctext)
		convert275Tokens(reader)

		return reader.data
	}
	Info(reader)
	PageSetup(reader)
	Score(reader)

	// start parsing
	var data = reader.data

	return data
}

function parseNwc275(reader, nwctext) {
	var lines = nwctext.split('\r\n')

	var first = lines.shift()

	if (!first.match(/\!NoteWorthyComposer/)) {
		console.log('bad start format')
	}

	reader.descend('score')
	reader.set('fonts', [])
	reader.set('staves', [])

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i]

		if (line === '!NoteWorthyComposer-End') {
			console.log('Processed', i, 'nwctext lines')
			break
		}

		var parts = line.split('|')
		var type = parts[1]
		var obj = { type }

		reader.token('type', type)

		for (var j = 2; j < parts.length; j++) {
			var kv = parts[j].split(':')
			obj[kv[0]] = kv[1]
			reader.token(kv[0], kv[1])
		}

		reader.token('next')
		// console.log(i, parts);
	}
}

function convert275Tokens(reader) {
	var data = reader.data

	data.score.staves.forEach(stave => {
		stave.tokens = stave.tokens.map(mapTokens)
	})
}

function parseOpts(token) {
	const { Opts } = token
	if (!Opts) return

	const opts = Opts.split(',')
	opts.forEach(opt => {
		const pairs = opt.split('=')
		token[pairs[0]] = pairs[1]
	})
}

function getPos(str) {
	// regex from https://github.com/nwsw/nwc2utsk/blob/91045bfab1e81ad328af4adeb2953412794df005/lib/obj_NWC2NotePitchPos.inc#L16
	const NWC2NotePitchPos = /([\#bnxv]{0,1})(\-{0,1}[0-9]+)([oxXzyYabcdefghijklmnpqrstuvw]{0,1})([\^]{0,1})/
	const match = NWC2NotePitchPos.exec(str)

	if (!match) {
		console.log('cannot parse note!', str)
		return
	}

	const accidental = match[1]
	const position = +match[2]
	const notehead = match[3]
	const tied = match[4]

	return {
		accidental,
		position,
		notehead,
		tied,
	}
}

function getChordPos(str) {
	var positions = str.split(',').map(getPos)
	return positions
}

var durs = {
	Whole: 1,
	Half: 2,
	'4th': 4,
	'8th': 8,
	'16th': 16,
	'32th': 32,
	'32nd': 32,
	'64th': 64,
}

function parseDur(dur) {
	var parts = dur.split(',')

	var duration = durs[parts[0]]
	var dots = 0
	if (parts[1]) {
		if (parts[1] === 'Dotted') {
			dots++
		} else if (parts[1] === 'DblDotted') {
			dots += 2
		}
	}

	if (!duration) console.log('!!', dur)

	return {
		duration,
		dots,
	}
}

/* This maps nwctxt to object */
function mapTokens(token) {
	var type = token.type
	parseOpts(token)

	switch (type) {
		case 'Clef':
			token = {
				type,
				clef: token.Type.toLowerCase(),
				octave: token.OctaveShift || 0,
			}
			// Octave Down
			break
		case 'TimeSig':
			var parts = token.Signature.split('/')
			// console.log('parts', parts);
			// AllaBreve
			token = {
				type: 'TimeSignature',
				signature: token.Signature,
			}

			if (parts.length === 2) {
				token.group = +parts[0]
				token.beat = +parts[1]
			}

			break
		case 'Chord':
			Object.assign(token, { notes: getChordPos(token.Pos) })
			Object.assign(token, parseDur(token.Dur))
			break
		case 'Note':
			Object.assign(token, getPos(token.Pos))
			Object.assign(token, parseDur(token.Dur))
			// Slur(Upward) Lyric(Never) Beam(End/First) Stem(Up/Down) XNoteSpace
			break
		case 'Bar':
			token.type = 'Barline'
			break
		case 'Rest':
			return Object.assign(
				{
					type,
					position: 0,
				},
				parseDur(token.Dur)
			)
		case 'Key':
			return {
				type: 'KeySignature',
				key: token.Tonic,
				// Signature
			}
		case 'Tempo':
			token.duration = token.Tempo // note
			token.note = 1
			token.pos = token.Pos
			// Visibility
			break
		case 'PerformanceStyle':
		case 'Dynamic':
		case 'Text':
			token.position = +token.Pos
			token.text = token.Text
			if (token.Style) token.text = token.dynamic = token.Style
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

function Header(reader) {
	// for (var i = 0; i < 25; i ++) {
	// 	var line = reader.readLine();
	// 	console.log(i, 'line', line, shortArrayToString(line), reader.pos);
	// }
	// return

	var company = reader.readString()
	var skip = reader.readUntilNonZero()
	var product = reader.readString()
	skip = reader.readUntilNonZero()
	var v = reader.readBytes(2)
	skip = reader.readBytes(1)
	skip = reader.readUntilNonZero()
	var name1 = reader.readString()
	skip = reader.readUntilNonZero()
	var name2 = reader.readString()

	reader.descend('header')
	reader.set('company', company)
	reader.set('product', product)
	reader.set('name1', name1)
	reader.set('name2', name2)

	var version_minor = v[0]
	var version_major = v[1]
	var version = version_major + version_minor * 0.01
	console.log('Detected NWC version', version)
	reader.set('version', version)

	if (version >= 2.75) {
		// reader.readBytes(4);
		reader.readUntil(36)
	}

	skip = reader.readUntilNonZero()
	// reader.skip(2);
	// reader.skip(8);
	// reader.skip(2);
}

function Info(reader) {
	var infoHeader = reader.readBytes(2) // 0x10 - nwc175 0x18 - nwc2
	if (infoHeader[0] !== 0x10 && infoHeader[0] !== 0x18) {
		console.log('info header possibly not aligned!', infoHeader)
	}

	var version = reader.data.header.version

	reader.descend('info')
	var title = reader.readString()
	var author = reader.readString()

	if (version >= 2) {
		var lyricist = reader.readString()
		reader.set('lyricist', lyricist)

		var copyright1 = reader.readString()
		var copyright2 = reader.readString()
	} else {
		var copyright1 = reader.readString()
		if (isVersionOneFive(reader)) reader.pos++
		var copyright2 = reader.readString()
	}
	var comments = reader.readString()

	///
	reader.descend('info')
	reader.setObject({
		title,
		author,
		copyright1,
		copyright2,
		comments,
	})
	debug('info', reader.data)
}

function PageSetup(reader) {
	reader.descend('page_setup')
	Margins(reader)
	Fonts(reader)
}

function Margins(reader) {
	// reader.skip(9);
	// 4e 4e 5f  0 46 32  0 0 0
	// 4e 59 5f  0 46 32  0 0 0
	// 4e 4e 5f  0 46 32  0 1 0
	// 59 59 5f  0 46 32  0 0 0
	reader.readUntil(0x46)
	reader.readUntil(0x32)
	reader.skip(3)

	reader.set('measureStart', reader.readByte())
	reader.skip(1) // likely 0
	let margins = reader.readString()
	margins = margins.split(' ').map(function(x) {
		return +x
	})
	reader.set('margins', margins)
}

function isVersionOneFive(reader) {
	return reader.data.header.version < 1.7
}

function Fonts(reader) {
	// 08 01 ?
	if (reader.data.header.version < 2) {
		reader.skip(36)
		var staff_size = reader.readByte()
		reader.skip(1)
	} else {
		reader.readUntil(0xff)
		var pre = reader.readBytes(3) // 0 11 0
		var staff_size = pre[1]
	}

	reader.set('staff_size', staff_size)

	var fonts = [],
		font,
		style,
		size,
		typeface

	console.log('staff_size', staff_size)
	var FONTS_TO_READ = isVersionOneFive(reader) ? 10 : 12
	for (var i = 0; i < FONTS_TO_READ; i++) {
		font = reader.readString()
		style = FontStyles[reader.readByte() & 3]
		size = reader.readByte()
		reader.skip(1)
		typeface = reader.readByte()

		fonts.push({
			font: font,
			style: style,
			size: size,
			typeface: typeface,
		})
	}
	reader.set('fonts', fonts)
}

function Score(reader) {
	reader.descend('score')
	var version = reader.data.header.version

	if (isVersionOneFive(reader)) {
		reader.readBytes(2)
		reader.set('layering', reader.readByte(1))
		reader.pos += 1
	} else {
		reader.readUntil(0xff)
		reader.readBytes(2)
		reader.set('layering', reader.readByte(1))
	}

	var staves
	if (version < 2) {
		staves = reader.readShort()
	} else {
		reader.readByte()
		staves = reader.readByte()

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

	console.log('Detected Staves', staves)

	reader.set('staves', new Array(staves))

	for (var i = 0; i < staves; i++) {
		console.log('STAFFF', i)
		StaffInfo(reader, i)
	}

	console.log(reader.pos, '/', reader.array.length)
}

function StaffInfo(reader, staff) {
	var version = reader.data.header.version

	if (version > 2) {
		reader.readShort()
		reader.readShort()
		reader.readUntilNonZero()
	}

	var staff_name = reader.readString()
	var group_name = reader.readString()
	var end_bar = reader.readByte() & 7
	var muted = !!(reader.readByte() & 1)
	reader.skip(1)
	var channel = reader.readByte()
	reader.skip(9)
	var staff_type = reader.readByte() & 3
	reader.skip(1)

	var uppersize = 256 - reader.readByte()
	reader.readUntil(0xff)
	var lowersize = reader.readByte()
	reader.skip(1)
	var lines = reader.readByte()
	var layer = !!(reader.readByte() & 1)
	var part_volume = reader.readByte()
	reader.skip(1)
	var stero_pan = reader.readByte()

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
	}

	reader.descend('score.staves.' + staff)
	reader.setObject(info)

	if (reader.data.header.version === 1.7) {
		reader.skip(2)
	} else {
		reader.skip(3)
	}

	reader.skip(2)

	if (isVersionOneFive(reader)) {
		reader.pos -= 2
	}
	var lyrics = reader.readShort()
	var noLyrics = reader.readShort()

	if (noLyrics) console.log('noLyrics', noLyrics)

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
		var lyricsOption = reader.readShort()
		reader.skip(3)

		var lyrics = []
		for (var i = 0; i < noLyrics; i++) {
			var text = Lyrics(reader)
			// console.log('lyrics', text);
			lyrics.push(text)
		}

		reader.set('lyrics', lyrics)
		reader.skip(1)
	}

	reader.skip()
	reader.set('color', reader.readByte() & 3)

	var tokens = reader.readShort()
	reader.set('tokens', [])
	console.log('tokens', tokens)

	if (!isVersionOneFive(reader)) {
		tokens -= 2
	}

	for (var i = 0; i < tokens; i++) {
		if (reader.data.header.version === 1.7) {
			reader.skip(2)
		}

		// TODO convert to Short
		var token = reader.readByte()

		reader.descend('score.staves.' + staff + '.tokens.' + i)
		var func = TokenParsers[token]

		if (func) {
			var name = NwcConstants.ObjLabels[token] // (func + '').split('\n')[0]
			// debug('token', name, i)
			// reader.where()
			if (isVersionOneFive(reader)) {
				reader.skip(1)
			} else {
				reader.skip(2)
			}
			var ret = func(reader)
			if (ret) {
				reader.exit()
				reader.set(i, ret)
			}
		} else {
			console.log('Warning, token not recongnized', token, reader.pos)
			reader.dump()
			return
		}

		// if (func == Rest) i--;
	}
}

function Lyrics(reader) {
	var blockHeader = reader.readByte() // 1 byte
	var lyricsLen = reader.readShort() // 2 byte
	reader.skip(1) // 1 byte

	var blocks
	switch (blockHeader) {
		case 4:
			blocks = 1
			break
		case 8:
			blocks = 2
			break
		default:
			break
	}

	var lyricBlock = blocks ? 1024 * blocks : lyricsLen + 2
	var chunk = reader.readBytes(lyricBlock) // rest of the block

	var cs = shortArrayToString(chunk)
	console.log('cs', cs, cs.toString(16))
	var lyrics = chunk.subarray(0, lyricsLen)
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

function binary(number) {
	return ('00000000' + (number || 0).toString(2)).slice(-8)
}

function string(number) {
	return ('_' + String.fromCharCode(number)).slice(-1)
}

function num(number) {
	return ('  ' + number).slice(-3)
}

function dump(byteArray, start, limit) {
	limit = limit || 20
	start = start || 0
	var group = 12
	var keys = [...Array(group).keys()]
	var pad = '      '
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
		)
	}
}

/**********************
 *
 *   Data Access
 *
 **********************/

function DataReader(array) {
	this.array = array // the binary source
	this.pos = 0 // cursor

	this.data = {} // single root of data
	this.pointer = this.data // what emits operates on
	this.descendPath = []
}

/**
 * descend takes a dot delimited path,
 * traverse down the structure,
 * creating an object if it does not exist
 * @param {*} path
 */
DataReader.prototype.descend = function(path) {
	this.pointer = this.data
	this.descendPath = []
	this.enter(path)
}

DataReader.prototype.ended = function() {
	var cursor = this.pos
	return cursor >= this.array.length
}

// Relative descend
DataReader.prototype.enter = function(path) {
	var node = this.pointer
	var self = this
	if (typeof path !== 'string') path = '' + path
	path.split('.').forEach(function(p) {
		if (!(p in node)) {
			node[p] = {}
		}
		node = node[p]
		self.pointer = node
		self.descendPath.push(p)
	})
}

DataReader.prototype.exit = function() {
	this.descend(this.descendPath.slice(0, -1).join('.'))
}

/**
 * set property to value at current path
 * @param {*} name
 * @param {*} value
 */
DataReader.prototype.set = function(name, value) {
	this.pointer[name] = value
}

DataReader.prototype.setObject = function(object) {
	Object.assign(this.pointer, object)
}

DataReader.prototype.push = function(value) {
	this.pointer.push(value)
	return this.pointer.length - 1
}

// https://github.com/nwsw/nwcplugin-api/blob/master/examples/xyAnalyzer.demo.nwctxt
var TokenMode = {
	EnterExit: (reader, key, value) => {
		if (key === 'next') {
			reader.exit()
			tokenMode = TokenMode.JustSet
			return
		}

		reader.set(key, value)
	},

	JustSet: (reader, key, value) => {
		if (key === 'next') {
			return
		}
		if (key === 'type') {
			if (/Lyric/.exec(value)) {
				// Lyrics, Lyric1, Lyric2...
				reader.enter(value)
				tokenMode = TokenMode.EnterExit
				return
			}
			switch (value) {
				case 'Editor':
					reader.descend('score.editor')
					break
				case 'Font':
					reader.descend('score.fonts')
					var i = reader.push({ type: value })
					reader.enter(i)
					tokenMode = TokenMode.EnterExit
					return
				case 'SongInfo':
				case 'PgSetup':
				case 'PgMargins':
					reader.descend('score.' + value)
					// reader.set('key', value);
					break
				case 'AddStaff':
					// tokenMode(reader, key, value);
					reader.descend('score.staves')
					var i = reader.push({ tokens: [] })
					reader.descend(`score.staves.${i}.tokens`)
					return
				default:
				case 'StaffProperties':
				case 'StaffInstrument':
					var i = reader.push({ type: value })
					reader.enter(i)
					tokenMode = TokenMode.EnterExit
					return
			}
		}

		reader.set(key, value)
	},
}

var tokenMode = TokenMode.JustSet

// aka "emits"
DataReader.prototype.token = function(key, value) {
	tokenMode(this, key, value)
}

DataReader.prototype.readUntil = function(x) {
	var pos = this.pos
	while (this.array[pos] !== x && pos < this.array.length) {
		pos++
	}

	var slice = this.array.subarray(this.pos, pos)
	pos++
	this.pos = pos
	return slice
}

DataReader.prototype.readUntilNonZero = function() {
	var x = this.pos

	if (this.array[x] !== 0) return

	while (++x < this.array.length && this.array[x] === 0);
	var slice = this.array.subarray(this.pos, x)
	this.pos = x
	return slice
}

DataReader.prototype.readLine = function() {
	return this.readUntil(0)
}

DataReader.prototype.readString = function() {
	return shortArrayToString(this.readLine())
}

DataReader.prototype.readByte = function() {
	var slice = this.array[this.pos++]
	return slice
}

DataReader.prototype.readSignedInt = function() {
	var int = this.readByte()
	return int > 127 ? int - 256 : int
}

DataReader.prototype.readShort = function() {
	var num = this.readBytes(2)
	return num[0] + num[1] * 256
}

DataReader.prototype.readBytes = function(k) {
	var pos = this.pos
	pos += k
	var slice = this.array.subarray(this.pos, pos)
	this.pos = pos
	return slice
}

DataReader.prototype.skip = function(k) {
	this.pos += k || 1
}

DataReader.prototype.dump = function(limit) {
	dump(this.array, this.pos, limit)
}

DataReader.prototype.where = function() {
	console.log('position', this.pos, '0x' + this.pos.toString(16))
}

// Exports

Object.assign(isNode() ? module.exports : window, {
	decodeNwcArrayBuffer,
})

export { decodeNwcArrayBuffer }
