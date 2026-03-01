import './constants.js'
import { NwcConstants, FontStyles } from './nwc_constants.js'
import { TokenParsers } from './nwc_parser.js'
import { parseNWC } from '../lib/nwc-parser.js'

var should_debug = false

// Toggle to use new parser (set to true to use lib/nwc2xml parser)
// Can be toggled at runtime via setUseNewParser()
let USE_NEW_PARSER = true;

export function getUseNewParser() {
	return USE_NEW_PARSER;
}

export function setUseNewParser(value) {
	USE_NEW_PARSER = value;
}

function isBrowser() {
	return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

function isNode() {
	return typeof process !== 'undefined' && process.versions != null && process.versions.node != null
}

function debug(...args) {
	if (should_debug) console.log(...args)
}

function decodeNwcArrayBuffer(arrayBuffer) {
	if (USE_NEW_PARSER) {
		console.log('Using lib/nwc2xml parser (new robust parser)');
		try {
			const nwcFile = parseNWC(arrayBuffer);
			
			if (!nwcFile || !nwcFile.staffs) {
				throw new Error('Parser returned invalid structure');
			}
			
			console.log('Parsed with new parser:', nwcFile);
			// Convert to old format for compatibility
			return convertFromNewParser(nwcFile);
		} catch (error) {
			console.error('New parser failed, falling back to old parser:', error);
			// Fall through to old parser
		}
	}
	
	console.log('Using src/nwc.js parser (original viewer parser)');
	try {
		var byteArray = new Uint8Array(arrayBuffer)
		var firstBytes = shortArrayToString(byteArray.subarray(0, 5))
		
		if ('[NWZ]' === firstBytes) {
			console.log('Detected compressed NWC file [NWZ]');
			var nwz = byteArray.subarray(6)
			if (isBrowser()) {
				var inflate = new Zlib.Inflate(nwz)
				var plain = inflate.decompress()
			} else {
				var plain = require('zlib').inflateSync(Buffer.from(nwz))
			}
			return processNwc(plain)
		} else if ('[Note' === firstBytes) {
			console.log('Detected binary NWC file [Note]');
			return processNwc(byteArray)
		} else if ('!Note' === firstBytes) {
			console.log('Detected NWC text format (!Note)');
			return processNwcText(byteArray, longArrayToString(byteArray))
		} else {
			throw new Error(`Unrecognized NWC file format: ${firstBytes}`)
		}
	} catch (error) {
		console.error('NWC parsing failed:', error)
		throw error
	}
}

function shortArrayToString(array) {
	return String.fromCharCode.apply(null, array)
}

function longArrayToString(array, chunkSize) {
	/*
	For way longer strings, better to use this
	var enc = new TextDecoder();
	var arr = new Uint8Array([84,104,105,...]);
	console.log(enc.decode(arr));
	*/

	var buffer = []

	var chunk = chunkSize || 1024
	for (var i = 0; i < array.length; i += chunk) {
		buffer.push(shortArrayToString(array.slice(i, i + chunk)))
	}

	return buffer.join('')
}

// Convert from new parser format to old viewer format
// ================================================================
// Adapter: converts NWCFile (new parser) -> old viewer data format
// ================================================================

var TYPE_NAMES = {
	0: 'Clef', 1: 'KeySignature', 2: 'Barline', 3: 'Ending', 4: 'Instrument',
	5: 'TimeSignature', 6: 'Tempo', 7: 'Dynamic', 8: 'Note', 9: 'Rest',
	10: 'Chord', 11: 'Pedal', 12: 'Flow', 13: 'MidiInstruction',
	14: 'TempoVariance', 15: 'DynamicVariance', 16: 'PerformanceStyle',
	17: 'Text', 18: 'RestChord', 19: 'User', 20: 'Spacer',
	21: 'RestMultiBar', 22: 'Boundary', 23: 'Marker',
}

var ADAPTER_DURATIONS = [1, 2, 4, 8, 16, 32, 64]
var ADAPTER_ACCIDENTALS = { 0: '#', 1: 'b', 2: 'n', 3: 'x', 4: 'v', 5: '' }
var ADAPTER_CLEFS = { 0: 'treble', 1: 'bass', 2: 'alto', 3: 'tenor', 4: 'percussion' }
var ADAPTER_DYNAMICS = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
var ADAPTER_FLAT_KEYS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
var ADAPTER_SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
var ADAPTER_PERF_STYLES = [
	'Ad Libitum','Animato','Cantabile','Con brio','Dolce','Espressivo',
	'Grazioso','Legato','Maestoso','Marcato','Meno mosso','Poco a poco',
	'Più mosso','Semplice','Simile','Solo','Sostenuto','Sotto Voce',
	'Staccato','Subito','Tenuto','Tutti','Volta Subito',
]
var ADAPTER_VISIBILITY = ['Default', 'Always', 'TopStaff', 'SingleStaff', 'MultiStaff', 'Never']

function versionToFloat(v) {
	var major = v >> 8
	var minor = v & 0xFF
	return major + minor * 0.01
}

function bitmapToNotes(bitmap) {
	var AG = 'ABCDEFG', names = []
	for (var i = 0; i < 7; i++) if ((bitmap >> i) & 1) names.push(AG.charAt(i))
	return names
}

function adaptNoteAttrs(obj) {
	// Extract flat properties from new parser NoteObj getAttributes() bitmask
	var attr = obj.getAttributes()
	var dt = obj.getDurationType()
	var result = {
		position: -obj.pos,
		duration: ADAPTER_DURATIONS[obj.getDuration()] || 4,
		dots: (dt & 0x02) ? 2 : (dt & 0x01) ? 1 : 0,
		accidental: ADAPTER_ACCIDENTALS[obj.getAccidental()] || '',
		tie: (attr & 0x20000) ? 1 : 0,
		tieEnd: (attr & 0x40000) ? 1 : 0,
		slur: (attr >> 11) & 3,
		beam: (attr >> 9) & 3,
		stem: (attr >> 15) & 3,
		triplet: (dt >> 2) & 3,
		staccato: (attr & 0x004) ? 1 : 0,
		accent: (attr & 0x001) ? 1 : 0,
		grace: (attr & 0x002) ? 1 : 0,
		tenuto: (attr & 0x008) ? 1 : 0,
	}
	// Additional articulation flags (additive, only set if non-zero)
	if (attr & 0x010) result.marcato = 1
	if (attr & 0x020) result.sforzando = 1
	if (attr & 0x040) result.staccatissimo = 1
	if (attr & 0x080) result.crescendo = 1
	if (attr & 0x100) result.diminuendo = 1
	if (attr & 0x200000) result.fermata = 1
	// Lyric Syllable: 0=Default, 1=Always, 2=Never
	if (obj.getLyricSyllable) {
		var ls = obj.getLyricSyllable()
		if (ls) result.lyricSyllable = ls
	}
	return result
}

function adaptObject(obj) {
	var type = TYPE_NAMES[obj.type] || ('Unknown_' + obj.type)
	var token = { type: type }
	var vis = obj.visible !== undefined ? obj.visible : 0
	if (vis > 0 && vis < ADAPTER_VISIBILITY.length) token.Visibility = ADAPTER_VISIBILITY[vis]

	switch (obj.type) {
		case 0: // Clef
			token.clef = ADAPTER_CLEFS[obj.clefType & 7] || 'treble'
			token.octave = obj.octaveShift || 0
			break

		case 1: { // KeySignature
			var flatBits = obj.flat || 0
			var sharpBits = obj.sharp || 0
			var flatNames = bitmapToNotes(flatBits)
			var sharpNames = bitmapToNotes(sharpBits)
			token.flats = flatNames
			token.sharps = sharpNames
			if (obj.getFifths) {
				var fifths = obj.getFifths()
				if (fifths < 0) token.key = ADAPTER_FLAT_KEYS[-fifths] || 'C'
				else if (fifths > 0) token.key = ADAPTER_SHARP_KEYS[fifths] || 'C'
				else token.key = 'C'
			} else {
				token.key = flatNames.length ? ADAPTER_FLAT_KEYS[flatNames.length] || 'C'
					: sharpNames.length ? ADAPTER_SHARP_KEYS[sharpNames.length] || 'C' : 'C'
			}
			break
		}

		case 2: // Barline
			token.barline = obj.getStyle ? obj.getStyle() : (obj.style & 0x7F)
			token.repeat = obj.repeatCount || 2
			token.systemBreak = obj.systemBreak ? obj.systemBreak() : false
			break

		case 3: // Ending
			token.repeat = obj.style & 0xFF
			token.style = (obj.style >> 8) & 0xFF
			break

		case 4: // Instrument
			break

		case 5: // TimeSignature
			token.group = obj.beats || 4
			token.beat = obj.getBeatType ? obj.getBeatType() : (1 << (obj.beatType || 2))
			token.signature = token.group + '/' + token.beat
			// Handle special time signatures
			if (obj.style === 1) token.signature = 'Common'
			else if (obj.style === 2) token.signature = 'AllaBreve'
			break

		case 6: // Tempo
			// NWC binary: positive=below, negative=above; negate to user convention (positive=above)
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.duration = obj.value || obj.getSpeed?.() || 120
			token.note = obj.base || 2
			break

		case 7: // Dynamic
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.style = obj.style || 0
			token.dynamic = obj.getStyleName ? obj.getStyleName() : (ADAPTER_DYNAMICS[obj.style & 0x1F] || 'mf')
			break

		case 8: { // Note
			var noteAttrs = adaptNoteAttrs(obj)
			Object.assign(token, noteAttrs)
			break
		}

		case 9: { // Rest
			var durIdx = obj.getDuration ? obj.getDuration() : (obj.duration & 0x0F)
			var restDt = obj.getDurationType ? obj.getDurationType() : 0
			token.duration = ADAPTER_DURATIONS[durIdx] || 4
			token.dots = (restDt & 0x02) ? 2 : (restDt & 0x01) ? 1 : 0
			token.position = 0
			token.triplet = (restDt >> 2) & 3
			break
		}

		case 10: { // Chord (NoteCM)
			var children = obj.children || []
			// Filter out any child objects that lack the NoteObj interface (e.g.
			// misread NoteCMObj children in old binary formats like v1.75).
			var noteChildren = children.filter(function(c) { return typeof c.getAttributes === 'function' })
			var notes = []
			// First child data becomes the primary token properties
			if (noteChildren.length > 0) {
				var first = noteChildren[0]
				var firstAttrs = adaptNoteAttrs(first)
				Object.assign(token, firstAttrs)
				// Build notes array for all children — each keeps its own duration
				// (split-stem chords have per-note durations)
				for (var ci = 0; ci < noteChildren.length; ci++) {
					notes.push(adaptNoteAttrs(noteChildren[ci]))
				}
			}
			// Token-level duration comes from the parent NoteCMObj for timing/spacing.
			// This represents the chord's tick advance (typically the shortest voice).
			// Individual note durations in notes[] may differ (split-stem chords).
			if (typeof obj.getDuration === 'function') {
				var chordDt = typeof obj.getDurationType === 'function' ? obj.getDurationType() : 0
				token.duration = ADAPTER_DURATIONS[obj.getDuration()] || 4
				token.dots = (chordDt & 0x02) ? 2 : (chordDt & 0x01) ? 1 : 0
				token.triplet = (chordDt >> 2) & 3
			}
			token.chords = noteChildren.length
			token.notes = notes
			break
		}

		case 11: // Pedal
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.sustain = obj.style || 0
			break

		case 12: // Flow
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.style = obj.style || 0
			break

		case 13: // MPC
			break

		case 14: // TempoVariance
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.style = obj.style || 0
			token.delay = obj.delay || 0
			break

		case 15: // DynamicVariance
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.style = obj.style || 0
			break

		case 16: // PerformanceStyle
			token.position = -(obj.pos || 0)
			token.placement = obj.placement || 0
			token.style = obj.style || 0
			token.text = ADAPTER_PERF_STYLES[obj.style] || ''
			break

		case 17: // Text
			token.position = -(obj.pos || 0)
			token.font = obj.font || 0
			token.text = obj.text || ''
			break

		case 18: { // RestChord (RestCM)
			var rcChildren = obj.children || []
			// Filter out any child objects that lack the NoteObj interface (e.g.
			// misread NoteCMObj children in old binary formats like v1.75).
			var rcNoteChildren = rcChildren.filter(function(c) { return typeof c.getAttributes === 'function' })
			var rcNotes = []
			if (rcNoteChildren.length > 0) {
				var rcFirst = rcNoteChildren[0]
				var rcFirstAttrs = adaptNoteAttrs(rcFirst)
				Object.assign(token, rcFirstAttrs)
				for (var ri = 0; ri < rcNoteChildren.length; ri++) {
					rcNotes.push(adaptNoteAttrs(rcNoteChildren[ri]))
				}
			}
			// Fall back to parent object's own duration data when no valid note children
			if (rcNoteChildren.length === 0 && typeof obj.getDuration === 'function') {
				token.duration = ADAPTER_DURATIONS[obj.getDuration()] || 4
				var rcDt = typeof obj.getDurationType === 'function' ? obj.getDurationType() : 0
				token.dots = (rcDt & 0x02) ? 2 : (rcDt & 0x01) ? 1 : 0
				token.position = 0
				token.triplet = (rcDt >> 2) & 3
			}
			token.chords = rcNoteChildren.length
			token.notes = rcNotes
			break
		}

		default:
			break
	}

	return token
}

function convertFromNewParser(nwcFile) {
	if (!nwcFile || !nwcFile.staffs) {
		throw new Error('Parser returned invalid structure');
	}

	return {
		header: {
			version: versionToFloat(nwcFile.version),
			company: '[NoteWorthy ArtWare]',
			product: '[NoteWorthy Composer]',
		},
		info: {
			title: nwcFile.title || '',
			author: nwcFile.author || '',
			lyricist: nwcFile.lyricist || '',
			copyright1: nwcFile.copyright1 || '',
			copyright2: nwcFile.copyright2 || '',
			comments: nwcFile.comment || '',
		},
		score: {
			allowLayering: nwcFile.allowLayering !== false,
			staves: nwcFile.staffs.map(function(staff) {
				return {
					staff_name: staff.name || '',
					staff_label: staff.label || '',
					group_name: staff.group || '',
					channel: staff.channel || 0,
					// WithNextStaff grouping flags
					bracketWithNext: !!staff.bracketWithNext,
					braceWithNext: !!staff.braceWithNext,
					connectBarsWithNext: !!staff.connectBarsWithNext,
					layerWithNext: !!staff.layerWithNext,
					boundaryTop: staff.boundaryTop || 0,
					boundaryBottom: staff.boundaryBottom || 0,
					endingBar: staff.endingBar || 0,
					lines: staff.lines || 5,
					lyrics: (staff.lyrics || []).map(function(lyric) {
						// New parser produces pre-split syllable arrays where each
						// element maps 1:1 to notes.  Pass them through directly.
						// Old parser produces raw strings that need tokenizing.
						return Array.isArray(lyric) ? lyric : (lyric || '')
					}),
					tokens: (staff.objects || []).map(adaptObject)
				}
			})
		}
	};
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

	data.score.staves.forEach((stave) => {
		stave.tokens = stave.tokens.map(mapTokens)
	})
}

function parseOpts(token) {
	const { Opts } = token
	if (!Opts) return

	const opts = Opts.split(',')
	opts.forEach((opt) => {
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
			// Map nwctxt barline style names to numeric style codes
			var barStyles = { Single: 0, Double: 1, SectionOpen: 2, SectionClose: 3, LocalRepeatOpen: 4, LocalRepeatClose: 5, MasterRepeatOpen: 6, MasterRepeatClose: 7 }
			if (token.Style) token.barline = barStyles[token.Style] || 0
			if (token.SysBreak === 'Y') token.systemBreak = true
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
			token.position = +token.Pos || 0
			// Visibility
			break
		case 'PerformanceStyle':
		case 'Dynamic':
		case 'Text':
			token.position = +token.Pos || 0
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
	margins = margins.split(' ').map(function (x) {
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
		// V205 has 13 extra bytes before staff count
		if (version >= 2.05) reader.skip(13)
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
			console.log('Warning, token not recognized', token, reader.pos)
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

			...keys.map((k) => hex(byteArray[i + k])),
			// ...keys.map(k => binary(byteArray[i + k])),
			'|',
			...keys.map((k) => string(byteArray[i + k])),
			...keys.map((k) => num(byteArray[i + k]))
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
DataReader.prototype.descend = function (path) {
	this.pointer = this.data
	this.descendPath = []
	this.enter(path)
}

DataReader.prototype.ended = function () {
	var cursor = this.pos
	return cursor >= this.array.length
}

// Relative descend
DataReader.prototype.enter = function (path) {
	var node = this.pointer
	var self = this
	if (typeof path !== 'string') path = '' + path
	path.split('.').forEach(function (p) {
		if (!(p in node)) {
			node[p] = {}
		}
		node = node[p]
		self.pointer = node
		self.descendPath.push(p)
	})
}

DataReader.prototype.exit = function () {
	this.descend(this.descendPath.slice(0, -1).join('.'))
}

/**
 * set property to value at current path
 * @param {*} name
 * @param {*} value
 */
DataReader.prototype.set = function (name, value) {
	this.pointer[name] = value
}

DataReader.prototype.setObject = function (object) {
	Object.assign(this.pointer, object)
}

DataReader.prototype.push = function (value) {
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
DataReader.prototype.token = function (key, value) {
	tokenMode(this, key, value)
}

DataReader.prototype.readUntil = function (x) {
	var pos = this.pos
	while (this.array[pos] !== x && pos < this.array.length) {
		pos++
	}

	var slice = this.array.subarray(this.pos, pos)
	pos++
	this.pos = pos
	return slice
}

DataReader.prototype.readUntilNonZero = function () {
	var x = this.pos

	if (this.array[x] !== 0) return

	while (++x < this.array.length && this.array[x] === 0);
	var slice = this.array.subarray(this.pos, x)
	this.pos = x
	return slice
}

DataReader.prototype.readLine = function () {
	return this.readUntil(0)
}

DataReader.prototype.readString = function () {
	return shortArrayToString(this.readLine())
}

DataReader.prototype.readByte = function () {
	var slice = this.array[this.pos++]
	return slice
}

DataReader.prototype.readSignedInt = function () {
	var int = this.readByte()
	return int > 127 ? int - 256 : int
}

DataReader.prototype.readShort = function () {
	var num = this.readBytes(2)
	return num[0] + num[1] * 256
}

DataReader.prototype.readBytes = function (k) {
	var pos = this.pos
	pos += k
	var slice = this.array.subarray(this.pos, pos)
	this.pos = pos
	return slice
}

DataReader.prototype.skip = function (k) {
	this.pos += k || 1
}

DataReader.prototype.dump = function (limit) {
	dump(this.array, this.pos, limit)
}

DataReader.prototype.where = function () {
	console.log('position', this.pos, '0x' + this.pos.toString(16))
}

// Exports

if (typeof window !== 'undefined') {
	Object.assign(window, { decodeNwcArrayBuffer })
}

export { decodeNwcArrayBuffer }
