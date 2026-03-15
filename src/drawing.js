import './constants.js'
import { ajax } from './loaders.js'
import { getFontSize, getZoomLevel, getMusicFontPath, getMusicTextFamily } from './constants.js'
import {
	TIE_HEIGHT_K, TIE_HEIGHT_D, TIE_HEIGHT_MIN, TIE_HEIGHT_MAX,
	TIE_X_GAP, TIE_Y_OFFSET, TIE_THICKNESS,
	SLUR_HEIGHT_K, SLUR_HEIGHT_D, SLUR_HEIGHT_MIN, SLUR_HEIGHT_MAX,
	SLUR_Y_OFFSET, SLUR_THICKNESS,
	computeArcHeight,
} from './engraving-rules.js'

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
	augmentationDot: 'E1E7',
	textTuplet3ShortStem: 'E1FF',

	// Dynamics (U+E520–U+E54F)
	// Individual letter glyphs
	dynamicPiano: 'E520',
	dynamicMezzo: 'E521',
	dynamicForte: 'E522',
	dynamicRinforzando: 'E523',
	dynamicSforzando: 'E524',
	dynamicZ: 'E525',
	dynamicNiente: 'E526',

	// Pre-composed dynamic combinations
	dynamicPPP: 'E52A',
	dynamicPP: 'E52B',
	dynamicMP: 'E52C',
	dynamicMF: 'E52D',
	dynamicPF: 'E52E',
	dynamicFF: 'E52F',
	dynamicFFF: 'E530',
	dynamicFP: 'E534',
	dynamicSF: 'E536',
	dynamicSFZ: 'E539',

	// Articulations (U+E4A0–U+E4BF)
	articulationAccent: 'E4A0',            // accent above
	articulationStaccato: 'E4A2',          // staccato above
	articulationTenuto: 'E4A4',            // tenuto above
	articulationMarcato: 'E4AC',           // marcato above (hat)
	articulationStaccatissimo: 'E4A8',     // staccatissimo above (wedge)

	// Fermatas (U+E4C0–U+E4CF)
	fermataAbove: 'E4C0',
	fermataBelow: 'E4C1',

	// Rehearsal / Flow marks (U+E048–U+E04F)
	coda: 'E048',
	segno: 'E047',

	// Brackets and braces (U+E000–U+E00F)
	brace: 'E000',

	// Common ornaments (U+E560–U+E56F)
}

const getCode = (name) => String.fromCharCode(parseInt(fontMap[name], 16))

function setupCanvas() {
	var canvas = document.createElement('canvas')
	var ctx = canvas.getContext('2d')

	// Keep for backward compatibility
	window.ctx = ctx
	window.canvas = canvas
	return { canvas, ctx }
}

function resizeToFit() {
	var score = document.getElementById('score')
	const bb = score.getBoundingClientRect()

	// TODO take min of canvas size vs bb heigh
	// resize(bb.width, bb.height)
	resize(score.clientWidth - 20, score.clientHeight - 20)
}

function resize(width, height) {
	// Browsers cap canvas backing-store dimensions (typically 16 384 px per axis).
	// Reduce the effective DPR when the logical size would exceed the limit so the
	// canvas is created at lower resolution rather than throwing.
	var MAX_CANVAS_DIM = 16384
	var nativeDpr = window.devicePixelRatio || 1

	width = width || 800
	height = height || 800

	var dpr = Math.min(
		nativeDpr,
		MAX_CANVAS_DIM / width,
		MAX_CANVAS_DIM / height
	)
	canvas.width = Math.round(width * dpr)
	canvas.height = Math.round(height * dpr)
	canvas.style.width = width + 'px'
	canvas.style.height = height + 'px'

	ctx.scale(dpr, dpr)
}

/* opentype.js loading */
function setup(render, path, ok) {
	if (notableLoaded) {
		render()
		return
	}

	path = path || getMusicFontPath()

	const { canvas, ctx } = setupCanvas()
	loadFont(render, path)
	ok && ok(canvas)
	return { canvas, ctx }
}

var notableLoaded = false
// Track which font file is currently loaded so we can detect changes.
var _loadedFontPath = null

function loadFont(cb, fontPath) {
	ajax(fontPath, (buffer) => {
		var font = window.opentype.parse(buffer)
		// if (err) return console.log('Error, font cannot be loaded', err)

		notableLoaded = true
		_loadedFontPath = fontPath
		window.smuflFont = font
		// Clear the glyph cache — paths/widths from the old font are invalid.
		glyphCache = {}
		cb && cb()
	})
}

/**
 * Switch to a different SMuFL font and re-render.  Called from the UI when
 * the user picks a new font from the dropdown.  `renderCb` is the rerender
 * function that rebuilds the score with the new font glyphs.
 */
function changeFont(renderCb) {
	const newPath = getMusicFontPath()
	if (newPath === _loadedFontPath) {
		// Same font — just re-render (e.g. if font size changed).
		renderCb && renderCb()
		return
	}
	loadFont(renderCb, newPath)
}

class Draw {
	draw() {
		console.log('implement me .draw()')
	}

	outline() {}

	debug(ctx) {
		ctx.fillStyle = 'blue'
		ctx.fillRect(-4, -4, 8, 8)

		// console.log(this.width)
		ctx.strokeStyle = 'purple'
		ctx.strokeRect(0, -10, this.width || 40, 10)
		if (this.path) {
			const bb = this.path.getBoundingBox()
			// console.log(bb);
			ctx.strokeStyle = 'red'
			ctx.strokeRect(bb.x1, bb.y1, bb.x2 - bb.x1, bb.y2 - bb.y1)
		}

		// TODO add y bounds
	}

	moveTo(x, y) {
		this.x = x
		this.y = y
	}

	positionY(semitones) {
		this.offsetY = this.unitsToY(semitones)
	}

	unitsToY(units) {
		return (-units / 2 / 4) * getFontSize()
	}
}

class Stave extends Draw {
	constructor(width) {
		super()
		this.size = getFontSize() // TODO global
		this.x = 0
		this.y = 0
		this.width = width || 100
	}

	draw(ctx) {
		const { width, size } = this

		ctx.strokeStyle = '#000'
		ctx.lineWidth = getFontSize() / 32 // 1.3

		// 5 lines
		const spaces = 4 // TODO global
		for (let i = 0; i <= spaces; i++) {
			const ty = (-i / spaces) * size
			ctx.beginPath()
			ctx.moveTo(0, ty)
			ctx.lineTo(width, ty)
			ctx.stroke()
		}

		// this.debug(ctx);
	}
}

class Line extends Draw {
	constructor(x0, y0, x1, y1) {
		super()
		this.x = x0
		this.y = y0
		this.x1 = x1
		this.y1 = y1
	}

	draw(ctx) {
		ctx.beginPath()
		ctx.lineWidth = getFontSize() / 24 // 1.4
		ctx.moveTo(this.x, this.y)
		ctx.lineTo(this.x1, this.y1)
		ctx.stroke()
	}
}

// Arbitrary canvas path drawn via a callback function.
// Used for complex shapes like curly braces.
class Path extends Draw {
	constructor(drawFn) {
		super()
		this._drawFn = drawFn
	}

	draw(ctx) {
		this._drawFn(ctx)
	}
}

var glyphCache = {}

function cacheGet(key, loader) {
	if (!(key in glyphCache)) {
		glyphCache[key] = loader()
	}

	return glyphCache[key]
}

// todo clear the cache when font sizes invalides

function glyphWidthGet(char, fontSize) {
	var key = char + ':width:' + fontSize
	return cacheGet(key, () => {
		// Look up the glyph object directly by codepoint to avoid the
		// stringToGlyphs → layout.scripts shaping pipeline, which crashes
		// on fonts missing GSUB/GPOS tables (e.g. Leipzig, Petaluma).
		var font = window.smuflFont
		var glyph = font.charToGlyph(char)
		var scale = fontSize / font.unitsPerEm
		return (glyph.advanceWidth || 0) * scale
	})
}

function glyphPathGet(char, fontSize) {
	var key = char + ':path:' + fontSize
	return cacheGet(key, () => {
		var font = window.smuflFont
		var glyph = font.charToGlyph(char)
		return glyph.getPath(0, 0, fontSize)
	})
}

class Glyph extends Draw {
	constructor(char, adjustY) {
		super()

		this.name = char
		this.char = getCode(char)
		this.fontSize = getFontSize() // * (0.8 + Math.random() * 0.4);
		this.width = glyphWidthGet(this.char, this.fontSize)

		// TODO: can package only predefined fonts symbols
		// this get cached instead on every draw
		this.path = glyphPathGet(this.char, this.fontSize)

		// const bb = this.path.getBoundingBox()
		// // bounds and width may be different!
		// if (this.width !== bb.x2)
		// 	console.log(this.name, 'bb', bb, 'width', this.width, this.path.toPathData())

		// this.padLeft = this.width;
		if (adjustY) this.positionY(adjustY)
	}

	draw(ctx) {
		ctx.fillStyle = '#000'

		// Grace notes are drawn at reduced scale
		if (this._graceScale && this._graceScale !== 1) {
			ctx.save()
			ctx.scale(this._graceScale, this._graceScale)
			this.path.draw(ctx)
			ctx.restore()
		} else {
			this.path.draw(ctx)
		}

		if (window._debug_glyph) this.debug(ctx)
	}
}

const Clef = Glyph

/**
 * Clefs
 */

class TrebleClef extends Clef {
	constructor() {
		super('gClef', 2)
	}
}

class BassClef extends Clef {
	constructor() {
		super('fClef', 6)
	}
}

class AltoClef extends Clef {
	constructor() {
		super('cClef', 4)
	}
}

/**
 * Time signatures
 */
class TimeSignature extends Glyph {
	constructor(x = 0, y) {
		super('timeSig' + x, y)
	}
}

const clefOffsetMap = {
	treble: 0,
	bass: -2,
	alto: -1,
	tenor: 1,
}

/**
 * Key Signature
 */
class KeySignature extends Draw {
	constructor(accidentals, clef) {
		super()
		// eg. ['f#', 'c#', 'g#', 'd#', 'a#', 'e#', 'b#']
		//     ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb']
		this.accidentals = accidentals
		this.width = 0  // default: C major has no accidentals

		// magic numbers
		const key_sharps_pos = [8, 5, 9, 6, 3, 7, 4]
		const key_flats_pos = [4, 7, 3, 6, 2, 5, 1]

		const first = accidentals && accidentals[0]
		if (!first) return

		let positions = first.charAt(1) === '#' ? key_sharps_pos : key_flats_pos

		// only arrangement exception
		if (positions === key_sharps_pos && clef === 'tenor') {
			positions[0] -= 7
			positions[2] -= 7
		}

		this.sharps = this.accidentals.map((v, l) => {
			const pos = positions[l] + (clefOffsetMap[clef] || 0)

			const sharp = new Accidental(first.charAt(1), pos)
			sharp.moveTo(l * sharp.width, 0)
			// sharp._debug = true;
			return sharp
		})

		if (this.sharps.length)
			this.width = this.sharps.length * this.sharps[0].width
	}

	draw(ctx) {
		if (this.sharps) this.sharps.forEach((s) => Drawing._draw(ctx, s))
	}
}

class Sharp extends Glyph {
	constructor(name, pos) {
		super('accidentalSharp', pos)
	}
}

class Flat extends Glyph {
	constructor(name, pos) {
		super('accidentalFlat', pos)
	}
}

class Natural extends Glyph {
	constructor(name, pos) {
		super('accidentalNatural', pos)
	}
}

class DoubleSharp extends Glyph {
	constructor(name, pos) {
		super('accidentalDoubleSharp', pos)
	}
}

class Accidental extends Glyph {
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
				: name === 'v'
				? 'accidentalDoubleFlat'
				: '',
			pos
		)

		// super('accidental' + name[0].toUpperCase() + , pos)
	}
}

class Ledger extends Draw {
	constructor(start, end, noteheadWidth) {
		super()
		const from = Math.min(start, end)
		const to = Math.max(start, end)
		this.positionY(from)
		this.to = to - from
		this.fontSize = getFontSize()
		this.noteheadWidth = noteheadWidth || this.fontSize * 0.3
		// Overhang: ~1/3 of notehead width on each side
		this.overhang = this.noteheadWidth * 0.33
		this.width = this.noteheadWidth + this.overhang * 2
	}

	draw(ctx) {
		var x0 = -this.overhang
		var x1 = this.noteheadWidth + this.overhang

		ctx.lineWidth = this.fontSize / 32   // match staff line thickness
		ctx.strokeStyle = '#000'

		for (let i = 0; i < this.to; i += 2) {
			ctx.beginPath()
			ctx.moveTo(x0, this.unitsToY(i))
			ctx.lineTo(x1, this.unitsToY(i))
			ctx.stroke()
		}
	}
}

// TODO generalized as vertical lines?
class Stem extends Draw {
	constructor(start, len) {
		super()
		// this.name = 'stem';
		this.positionY(start)
		this.len = len || 7
	}

	draw(ctx) {
		var scale = this._graceScale || 1
		ctx.beginPath()
		ctx.lineWidth = (getFontSize() / 30) * scale
		ctx.moveTo(0, 0)
		ctx.lineTo(0, this.unitsToY(this.len))
		ctx.stroke()

		// Acciaccatura slash: diagonal line through the stem
		if (this._slash) {
			var fs = getFontSize()
			var slashLen = fs * 0.25 * scale
			// Position the slash roughly 1/3 up the stem
			var stemPixels = this.unitsToY(this.len)
			var slashY = stemPixels * 0.35
			ctx.beginPath()
			ctx.lineWidth = (fs / 24) * scale
			ctx.moveTo(-slashLen * 0.6, slashY - slashLen * 0.5)
			ctx.lineTo(slashLen * 0.6, slashY + slashLen * 0.5)
			ctx.stroke()
		}
	}
}

// Barline styles (from NWC BarStyle constants):
// 0=Single, 1=Double, 2=SectionOpen, 3=SectionClose,
// 4=LocalOpen, 5=LocalClose, 6=MasterOpen, 7=MasterClose, 8=Hidden
class Barline extends Draw {
	constructor(start, len, style) {
		super()
		this.len = len || 8
		this.style = style || 0
	}

	draw(ctx) {
		const fs = getFontSize()
		const thinLw = fs / 30
		const thickLw = fs / 8
		const gap = fs / 10
		const top = 0
		const bot = this.unitsToY(this.len)
		const dotR = fs / 12
		// Dots are placed at 1/3 and 2/3 of the staff height
		const dotY1 = top + (bot - top) * 0.37
		const dotY2 = top + (bot - top) * 0.63

		switch (this.style) {
		case 8: // Hidden
			break

		case 1: // Double — two thin lines
			ctx.beginPath()
			ctx.lineWidth = thinLw
			ctx.moveTo(-gap, top)
			ctx.lineTo(-gap, bot)
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo(0, top)
			ctx.lineTo(0, bot)
			ctx.stroke()
			break

		case 2: // SectionOpen — thick then thin (heavy-light)
			ctx.beginPath()
			ctx.lineWidth = thickLw
			ctx.moveTo(0, top)
			ctx.lineTo(0, bot)
			ctx.stroke()
			ctx.beginPath()
			ctx.lineWidth = thinLw
			ctx.moveTo(gap + thickLw / 2, top)
			ctx.lineTo(gap + thickLw / 2, bot)
			ctx.stroke()
			break

		case 3: // SectionClose — thin then thick (light-heavy, final barline)
			ctx.beginPath()
			ctx.lineWidth = thinLw
			ctx.moveTo(-gap - thickLw / 2, top)
			ctx.lineTo(-gap - thickLw / 2, bot)
			ctx.stroke()
			ctx.beginPath()
			ctx.lineWidth = thickLw
			ctx.moveTo(0, top)
			ctx.lineTo(0, bot)
			ctx.stroke()
			break

		case 4: // LocalOpen — thick + thin + dots (repeat start)
		case 6: // MasterOpen — same visual
			ctx.beginPath()
			ctx.lineWidth = thickLw
			ctx.moveTo(0, top)
			ctx.lineTo(0, bot)
			ctx.stroke()
			ctx.beginPath()
			ctx.lineWidth = thinLw
			ctx.moveTo(gap + thickLw / 2, top)
			ctx.lineTo(gap + thickLw / 2, bot)
			ctx.stroke()
			ctx.beginPath()
			ctx.arc(gap + thickLw / 2 + gap + dotR, dotY1, dotR, 0, Math.PI * 2)
			ctx.fill()
			ctx.beginPath()
			ctx.arc(gap + thickLw / 2 + gap + dotR, dotY2, dotR, 0, Math.PI * 2)
			ctx.fill()
			break

		case 5: // LocalClose — dots + thin + thick (repeat end)
		case 7: // MasterClose — same visual
			ctx.beginPath()
			ctx.arc(-gap - thickLw / 2 - gap - dotR, dotY1, dotR, 0, Math.PI * 2)
			ctx.fill()
			ctx.beginPath()
			ctx.arc(-gap - thickLw / 2 - gap - dotR, dotY2, dotR, 0, Math.PI * 2)
			ctx.fill()
			ctx.beginPath()
			ctx.lineWidth = thinLw
			ctx.moveTo(-gap - thickLw / 2, top)
			ctx.lineTo(-gap - thickLw / 2, bot)
			ctx.stroke()
			ctx.beginPath()
			ctx.lineWidth = thickLw
			ctx.moveTo(0, top)
			ctx.lineTo(0, bot)
			ctx.stroke()
			break

		default: // Single (0) or fallback
			ctx.beginPath()
			ctx.lineWidth = thinLw
			ctx.moveTo(0, top)
			ctx.lineTo(0, bot)
			ctx.stroke()
			break
		}
	}
}

class Dot extends Glyph {
	constructor(pos) {
		super('augmentationDot', pos)
		this.offsetX = getFontSize() * 0.18
	}
}

/**
 * Maps NWC dynamic text strings (e.g. 'mf', 'pp') to SMuFL pre-composed
 * glyph names.  For strings without a pre-composed glyph, we compose from
 * individual letter glyphs.
 */
const DYNAMIC_GLYPH_MAP = {
	ppp: 'dynamicPPP',
	pp:  'dynamicPP',
	p:   'dynamicPiano',
	mp:  'dynamicMP',
	mf:  'dynamicMF',
	f:   'dynamicForte',
	ff:  'dynamicFF',
	fff: 'dynamicFFF',
	fp:  'dynamicFP',
	sf:  'dynamicSF',
	sfz: 'dynamicSFZ',
	pf:  'dynamicPF',
}

// Individual letter map for composing unknown dynamics from parts.
const DYNAMIC_LETTER_MAP = {
	p: 'dynamicPiano',
	m: 'dynamicMezzo',
	f: 'dynamicForte',
	r: 'dynamicRinforzando',
	s: 'dynamicSforzando',
	z: 'dynamicZ',
	n: 'dynamicNiente',
}

/**
 * A dynamic marking rendered using SMuFL glyphs from the music font.
 * Uses a pre-composed glyph if available, otherwise composes from
 * individual letter glyphs placed side by side.
 */
class DynamicMarking extends Draw {
	constructor(dynamicText, adjustY) {
		super()
		this.dynamicText = dynamicText || 'mf'
		this.fontSize = getFontSize()
		if (adjustY) this.positionY(adjustY)

		// Try pre-composed glyph first
		const precomposed = DYNAMIC_GLYPH_MAP[this.dynamicText]
		if (precomposed && fontMap[precomposed]) {
			const char = getCode(precomposed)
			this._glyphs = [{ char, path: glyphPathGet(char, this.fontSize), width: glyphWidthGet(char, this.fontSize), x: 0 }]
			this.width = this._glyphs[0].width
		} else {
			// Compose from individual letters
			this._glyphs = []
			var x = 0
			for (const ch of this.dynamicText) {
				const glyphName = DYNAMIC_LETTER_MAP[ch]
				if (!glyphName || !fontMap[glyphName]) continue
				const char = getCode(glyphName)
				const w = glyphWidthGet(char, this.fontSize)
				const path = glyphPathGet(char, this.fontSize)
				this._glyphs.push({ char, path, width: w, x })
				x += w
			}
			this.width = x
		}
	}

	draw(ctx) {
		ctx.fillStyle = '#000'
		for (const g of this._glyphs) {
			ctx.save()
			ctx.translate(g.x, 0)
			g.path.draw(ctx)
			ctx.restore()
		}
	}
}

/**
 * Maps note-level articulation flags to SMuFL glyph names.
 */
const ARTICULATION_GLYPH_MAP = {
	staccato: 'articulationStaccato',
	accent: 'articulationAccent',
	tenuto: 'articulationTenuto',
	marcato: 'articulationMarcato',
	staccatissimo: 'articulationStaccatissimo',
	fermata: 'fermataAbove',
}

/**
 * A single articulation mark drawn using a SMuFL glyph.
 * Positioned above or below the notehead.
 */
class ArticulationMark extends Draw {
	constructor(articulationType, adjustY) {
		super()
		this.articulationType = articulationType
		this.fontSize = getFontSize()
		if (adjustY) this.positionY(adjustY)

		const glyphName = ARTICULATION_GLYPH_MAP[articulationType]
		if (glyphName && fontMap[glyphName]) {
			this.char = getCode(glyphName)
			this.path = glyphPathGet(this.char, this.fontSize)
			this.width = glyphWidthGet(this.char, this.fontSize)
		} else {
			this.char = null
			this.path = null
			this.width = 0
		}
	}

	draw(ctx) {
		if (this.path) {
			ctx.fillStyle = '#000'
			this.path.draw(ctx)
		}
	}
}

/**
 * A hairpin (crescendo/diminuendo) wedge drawn with canvas lines.
 * Spans from the token X position to a specified end X.
 * The wedge opens left-to-right for crescendo, right-to-left for decrescendo.
 */
class Hairpin extends Draw {
	constructor(style, spanWidth, adjustY) {
		super()
		this.style = style  // 'Crescendo' or 'Decrescendo'/'Diminuendo'
		this.spanWidth = spanWidth || getFontSize() * 3
		this.width = this.spanWidth
		this.fontSize = getFontSize()
		if (adjustY) this.positionY(adjustY)
	}

	draw(ctx) {
		var fs = this.fontSize
		var halfOpen = fs / 8   // half-height of the open end (~1 staff space total)
		var lw = fs / 24
		var w = this.spanWidth

		ctx.beginPath()
		ctx.lineWidth = lw
		ctx.strokeStyle = '#000'

		if (this.style === 'Crescendo') {
			// Point on the left, opening to the right
			ctx.moveTo(0, 0)
			ctx.lineTo(w, -halfOpen)
			ctx.moveTo(0, 0)
			ctx.lineTo(w, halfOpen)
		} else {
			// Opening on the left, point on the right (decresc/dimin)
			ctx.moveTo(0, -halfOpen)
			ctx.lineTo(w, 0)
			ctx.moveTo(0, halfOpen)
			ctx.lineTo(w, 0)
		}
		ctx.stroke()
	}
}

/**
 * Volta bracket (1st/2nd ending) drawn with canvas lines.
 * A horizontal bracket with an optional downward hook on the right end,
 * and ending number text (e.g., "1.", "2.") at the top left.
 */
class VoltaBracket extends Draw {
	constructor(text, spanWidth, closed, adjustY) {
		super()
		this.text = text || '1.'
		this.spanWidth = spanWidth || getFontSize() * 5
		this.width = this.spanWidth
		this.closed = closed  // whether the right side has a downward hook
		this.fontSize = getFontSize()
		if (adjustY) this.positionY(adjustY)
	}

	draw(ctx) {
		var fs = this.fontSize
		var lw = fs / 24
		var hookH = fs * 0.35  // height of the vertical hooks
		var w = this.spanWidth
		var textSize = Math.round(fs * 0.35)

		ctx.strokeStyle = '#000'
		ctx.lineWidth = lw

		// Left vertical hook (downward from top)
		ctx.beginPath()
		ctx.moveTo(0, hookH)
		ctx.lineTo(0, 0)

		// Horizontal line across the top
		ctx.lineTo(w, 0)

		// Right vertical hook (only if closed)
		if (this.closed) {
			ctx.lineTo(w, hookH)
		}
		ctx.stroke()

		// Ending number text
		ctx.fillStyle = '#000'
		ctx.font = textSize + 'px ' + getMusicTextFamily()
		ctx.textAlign = 'left'
		ctx.fillText(this.text, lw + this.fontSize * 0.07, textSize * 0.9)
	}
}

/**
 * Triplet/tuplet bracket with numeral drawn above or below a group of notes.
 * A horizontal bracket with small hooks on each end and a centered "3".
 * When numeralOnly=true, draws just the centered numeral without bracket lines.
 */
class TupletBracket extends Draw {
	constructor(numeral, spanWidth, below, numeralOnly) {
		super()
		this.numeral = numeral || '3'
		this.spanWidth = spanWidth || getFontSize() * 2
		this.width = this.spanWidth
		this.below = below || false
		this.numeralOnly = numeralOnly || false
		this.fontSize = getFontSize()
	}

	draw(ctx) {
		var fs = this.fontSize
		var lw = fs / 30
		var w = this.spanWidth
		var textSize = Math.round(fs * 0.32)
		var midX = w / 2

		if (!this.numeralOnly) {
			// Full bracket: hooks + lines + gap for numeral
			var hookH = fs * 0.15 * (this.below ? -1 : 1)
			var textW = ctx.measureText ? textSize * 0.6 : 6
			var gapHalf = textW * 0.8

			ctx.strokeStyle = '#000'
			ctx.lineWidth = lw

			// Left portion: hook + line up to gap
			ctx.beginPath()
			ctx.moveTo(0, hookH)
			ctx.lineTo(0, 0)
			ctx.lineTo(midX - gapHalf, 0)
			ctx.stroke()

			// Right portion: gap to end + hook
			ctx.beginPath()
			ctx.moveTo(midX + gapHalf, 0)
			ctx.lineTo(w, 0)
			ctx.lineTo(w, hookH)
			ctx.stroke()
		}

		// Centered numeral
		ctx.fillStyle = '#000'
		ctx.font = 'italic ' + textSize + 'px ' + getMusicTextFamily()
		ctx.textAlign = 'center'
		ctx.fillText(this.numeral, midX, this.below ? -textSize * 0.3 : textSize * 0.35)
	}
}

class Beam extends Draw {
	constructor(startY, endY, startX, endX, count = 1) {
		super()
		this.startY = startY
		this.endY = endY
		this.startX = startX
		this.endX = endX
		this.count = count
	}

	draw(ctx) {
		var scale = this._graceScale || 1
		// Standard engraving: beam thickness = 0.5 staff spaces = getFontSize()/8
		// Beam separation (gap between beams) = 0.25 staff spaces = getFontSize()/16
		// Center-to-center = thickness + gap = 0.75 staff spaces = 3*getFontSize()/16
		const beamThickness = (getFontSize() / 8) * scale
		const beamSpacing = (getFontSize() * 3 / 16) * scale
		// Stems-up: additional beams stack downward (toward noteheads) → positive offset.
		// Stems-down: additional beams stack upward (toward noteheads) → negative offset.
		const dir = this.stemUp === false ? -1 : 1
		const baseOffset = (this._beamOffset || 0) * beamSpacing * dir

		ctx.fillStyle = '#000'
		for (let i = 0; i < this.count; i++) {
			const offsetY = baseOffset + i * beamSpacing * dir
			const y1 = this.unitsToY(this.startY) + offsetY
			const y2 = this.unitsToY(this.endY) + offsetY
			// Draw a filled parallelogram — constant vertical thickness
			// regardless of beam angle. Top edge runs from (startX, y1)
			// to (endX, y2); bottom edge is offset by beamThickness.
			ctx.beginPath()
			ctx.moveTo(this.startX, y1)
			ctx.lineTo(this.endX, y2)
			ctx.lineTo(this.endX, y2 + beamThickness)
			ctx.lineTo(this.startX, y1 + beamThickness)
			ctx.closePath()
			ctx.fill()
		}
	}
}

class Text extends Draw {
	constructor(text, position, opts) {
		super()
		if (!text) {
			console.log('NO TEXT', text)
		}
		this.text = text || ''
		this.positionY(-position || 0)

		// .font .textAlign
		if (opts) Object.assign(this, opts)
	}

	draw(ctx) {
		ctx.font = this.font || ('italic bold ' + Math.round(getFontSize() * 0.43) + 'px ' + getMusicTextFamily())
		if (this.textAlign) ctx.textAlign = this.textAlign
		ctx.fillText(this.text, 0, 0)
	}
}

class Tie extends Draw {
	/**
	 * @param {Draw} start - Start notehead glyph
	 * @param {Draw} end - End notehead glyph
	 * @param {number} direction - 1 = below (arc down), -1 = above (arc up)
	 */
	constructor(start, end, direction) {
		super()
		var fontSize = getFontSize()
		var d = direction || 1
		var gap = fontSize * TIE_X_GAP
		var yOff = fontSize * TIE_Y_OFFSET * d

		// Anchor just past the notehead edges — "never touch the noteheads"
		var x1 = start.x + start.width + gap
		var y1 = start.y + (start.offsetY || 0) + yOff
		var x2 = end.x - gap
		var y2 = end.y + (end.offsetY || 0) + yOff

		this.size = fontSize
		this.x = x1
		this.y = y1
		this.endx = x2
		this.endy = y2
		this.direction = d
		this.width = this.endx - this.x

		// Proportional arc height — short ties are round, long ties flatten
		this.arcHeight = computeArcHeight(
			this.width, fontSize,
			TIE_HEIGHT_K, TIE_HEIGHT_D, TIE_HEIGHT_MIN, TIE_HEIGHT_MAX
		) * d
		this.thickness = fontSize * TIE_THICKNESS * d
	}

	draw(ctx) {
		ctx.fillStyle = '#000'
		ctx.beginPath()

		var w = this.width
		var dy = this.endy - this.y
		var h = this.arcHeight
		var t = this.thickness

		// Cubic bezier control points at 1/3 and 2/3 for natural curve
		var cp1x = w * 0.33
		var cp2x = w * 0.67
		// Interpolate dy along control points for cross-pitch ties
		var cp1dy = dy * 0.33
		var cp2dy = dy * 0.67

		// Outer curve (full arc height)
		ctx.moveTo(0, 0)
		ctx.bezierCurveTo(cp1x, h + cp1dy, cp2x, h + cp2dy, w, dy)
		// Inner curve (reduced height — taper: 0 thickness at endpoints,
		// max thickness at midpoint)
		ctx.bezierCurveTo(cp2x, (h - t) + cp2dy, cp1x, (h - t) + cp1dy, 0, 0)
		ctx.fill()
	}
}

class Slur extends Draw {
	/**
	 * Slur connects different pitches for phrasing / articulation.
	 * Thinner and more open than ties, anchored at notehead centre.
	 *
	 * @param {Draw} start - Start notehead glyph
	 * @param {Draw} end - End notehead glyph
	 * @param {number} direction - 1 = below, -1 = above
	 */
	constructor(start, end, direction) {
		super()
		var fontSize = getFontSize()
		var d = direction || 1
		var yOff = fontSize * SLUR_Y_OFFSET * d

		// Slurs anchor at notehead centre (not edges like ties)
		var x1 = start.x + start.width / 2
		var y1 = start.y + (start.offsetY || 0) + yOff
		var x2 = end.x + end.width / 2
		var y2 = end.y + (end.offsetY || 0) + yOff

		this.size = fontSize
		this.x = x1
		this.y = y1
		this.endx = x2
		this.endy = y2
		this.direction = d
		this.width = this.endx - this.x

		// Slur height — flatter, more open than ties
		this.arcHeight = computeArcHeight(
			this.width, fontSize,
			SLUR_HEIGHT_K, SLUR_HEIGHT_D, SLUR_HEIGHT_MIN, SLUR_HEIGHT_MAX
		) * d
		this.thickness = fontSize * SLUR_THICKNESS * d
	}

	draw(ctx) {
		ctx.fillStyle = '#000'
		ctx.beginPath()

		var w = this.width
		var dy = this.endy - this.y
		var h = this.arcHeight
		var t = this.thickness

		// Cubic bezier control points at 1/3 and 2/3
		var cp1x = w * 0.33
		var cp2x = w * 0.67
		var cp1dy = dy * 0.33
		var cp2dy = dy * 0.67

		// Outer curve
		ctx.moveTo(0, 0)
		ctx.bezierCurveTo(cp1x, h + cp1dy, cp2x, h + cp2dy, w, dy)
		// Inner curve (taper)
		ctx.bezierCurveTo(cp2x, (h - t) + cp2dy, cp1x, (h - t) + cp1dy, 0, 0)
		ctx.fill()
	}
}

/**
 * A partial tie arc for cross-system ties.
 * 'trailing' mode: starts at a note and curves off to the right edge.
 * 'leading' mode: curves in from the left edge to a note.
 */
class PartialTie extends Draw {
	constructor(noteGlyph, arcWidth, mode, direction) {
		super()
		this.mode = mode  // 'trailing' or 'leading'
		var fontSize = getFontSize()
		var d = direction || 1
		this.size = fontSize
		this.direction = d
		var yOff = fontSize * TIE_Y_OFFSET * d

		// Proportional arc height (same formula as full Tie)
		this.arcHeight = computeArcHeight(
			arcWidth, fontSize,
			TIE_HEIGHT_K, TIE_HEIGHT_D, TIE_HEIGHT_MIN, TIE_HEIGHT_MAX
		) * d
		this.thickness = fontSize * TIE_THICKNESS * d

		var noteY = noteGlyph.y + (noteGlyph.offsetY || 0) + yOff
		if (mode === 'trailing') {
			// Start at the note, arc curves rightward
			this.x = noteGlyph.x + noteGlyph.width + fontSize * TIE_X_GAP
			this.y = noteY
			this.width = arcWidth
		} else {
			// End at the note, arc curves leftward from system start
			this.x = noteGlyph.x - fontSize * TIE_X_GAP - arcWidth
			this.y = noteY
			this.width = arcWidth
		}
		this.endx = this.x + this.width
		this.endy = this.y  // same pitch, same Y
	}

	draw(ctx) {
		ctx.fillStyle = '#000'
		var w = this.width
		var h = this.arcHeight
		var t = this.thickness

		ctx.beginPath()
		if (this.mode === 'trailing') {
			// Biased right — steeper near the note, flatter toward system edge
			var cp1x = w * 0.25
			var cp2x = w * 0.60
			ctx.moveTo(0, 0)
			ctx.bezierCurveTo(cp1x, h, cp2x, h, w, 0)
			ctx.bezierCurveTo(cp2x, h - t, cp1x, h - t, 0, 0)
		} else {
			// Biased left — steeper near the note, flatter toward system start
			var cp1x = w * 0.40
			var cp2x = w * 0.75
			ctx.moveTo(w, 0)
			ctx.bezierCurveTo(cp2x, h, cp1x, h, 0, 0)
			ctx.bezierCurveTo(cp1x, h - t, cp2x, h - t, w, 0)
		}
		ctx.fill()
	}
}

class Drawing {
	constructor(ctx) {
		this.set = new Set()

		ctx.font = `${getFontSize()}px ${getMusicTextFamily()}`
		ctx.textBaseline = 'alphabetic' // alphabetic  bottom top
		ctx.fillStyle = '#000'
	}

	add(el) {
		this.set.add(el)
	}

	remove(el) {
		this.set.delete(el)
	}

	static _draw(ctx, el, viewportWidth, viewportOffsetX, viewportHeight, viewportOffsetY) {
		if (el instanceof Draw) {
			// Viewport culling — skip elements entirely outside the visible area.
			// The margin scales with font size so that large zoom levels don't
			// clip oversized glyphs / staves.  Most elements never set `height`,
			// so we fall back to 4× font size (covers a full staff + ledger lines).
			var margin = getFontSize() * 4
			var elW = el.width || margin
			var elH = el.height || margin

			// Horizontal
			if (el.x > viewportOffsetX + viewportWidth + margin) return
			if (el.x + elW < viewportOffsetX - margin) return
			// Vertical
			var elY = el.y + (el.offsetY || 0)
			if (elY > viewportOffsetY + viewportHeight + margin) return
			if (elY + elH < viewportOffsetY - margin) return

			ctx.save()
			ctx.translate(el.x, el.y)
			ctx.translate(el.offsetX || 0, el.offsetY || 0)
			el.draw(ctx)

			if (el._text) {
				ctx.font = '8px ' + getMusicTextFamily()
				ctx.fillText(el._text, 0, 50)
			}

			if (el._debug) {
				el.debug(ctx)
			}
			ctx.restore()
		} else {
			console.log('Element', el, 'not a draw element')
		}
	}

	draw(ctx) {
		// Convert screen-space viewport bounds to score-space for culling.
		// quickDraw() applies ctx.scale(zoom) so drawing coordinates are in
		// score-space, but scrollLeft/clientWidth are in screen pixels.
		const zoom = getZoomLevel()
		const _scoreElm = document.getElementById('score')
		const viewportWidth = (_scoreElm?.clientWidth || 800) / zoom
		const viewportOffsetX = (_scoreElm?.scrollLeft || 0) / zoom
		const viewportHeight = (_scoreElm?.clientHeight || 600) / zoom
		const viewportOffsetY = (_scoreElm?.scrollTop || 0) / zoom

		// Restore default font/baseline — canvas resets wipe context state
		// (e.g. after resizeToFit()), so re-apply on every draw pass.
		ctx.font = `${getFontSize()}px ${getMusicTextFamily()}`
		ctx.textBaseline = 'alphabetic'
		ctx.fillStyle = '#000'

		ctx.save()
		for (const el of this.set) {
			Drawing._draw(ctx, el, viewportWidth, viewportOffsetX, viewportHeight, viewportOffsetY)
		}
		ctx.restore()
	}
}

// TODO find namespace

const Claire = {
	Drawing,
	Draw,
	Stave,
	Glyph,
	TrebleClef,
	BassClef,
	AltoClef,
	TimeSignature,
	KeySignature,
	Accidental,
	Sharp,
	Flat,
	Natural,
	DoubleSharp,
	Stem,
	Barline,
	Dot,
	DynamicMarking,
	ArticulationMark,
	Hairpin,
	VoltaBracket,
	TupletBracket,
	Ledger,
	Text,
	Line,
	Path,
	Tie,
	Slur,
	PartialTie,
}

Object.assign(Claire, { Drawing, setup, Claire, resize, resizeToFit, changeFont })
Object.assign(window, Claire)

export { Drawing, setup, Claire, resize, resizeToFit, Stem, Glyph, Tie, Slur, PartialTie, Beam, DynamicMarking, ArticulationMark, Hairpin, VoltaBracket, TupletBracket, changeFont, getCode, glyphPathGet }
