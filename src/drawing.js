import './constants.js'
import { ajax } from './loaders.js'
import { getFontSize } from './constants.js'

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
}

const getCode = (name) => String.fromCharCode(parseInt(fontMap[name], 16))

function setupCanvas() {
	var canvas = document.createElement('canvas')
	var ctx = canvas.getContext('2d')

	window.ctx = ctx
	window.canvas = canvas
	return canvas
}

function resizeToFit() {
	var score = document.getElementById('score')
	const bb = score.getBoundingClientRect()

	// TODO take min of canvas size vs bb heigh
	// resize(bb.width, bb.height)
	resize(score.clientWidth - 20, score.clientHeight - 20)
}

function resize(width, height) {
	var dpr = window.devicePixelRatio

	width = width || 800
	height = height || 800

	canvas.width = width * dpr
	canvas.height = height * dpr
	canvas.style.width = width
	canvas.style.height = height

	ctx.scale(dpr, dpr)
}

/* opentype.js loading */
function setup(render, path, ok) {
	if (notableLoaded) {
		render()
		return
	}

	path = path || 'vendor/bravura-1.211/'

	const canvas = setupCanvas()
	loadFont(render, path)
	ok && ok(canvas)
	return canvas
}

var notableLoaded = false

function loadFont(cb, path) {
	ajax(`${path}otf/Bravura.otf`, (buffer) => {
		var font = window.opentype.parse(buffer)
		// if (err) return console.log('Error, font cannot be loaded', err)

		notableLoaded = true
		window.smuflFont = font
		cb && cb()
	})
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
		return window.smuflFont.getAdvanceWidth(char, fontSize)
	})
}

function glyphPathGet(char, fontSize) {
	var key = char + ':path:' + fontSize
	return cacheGet(key, () => {
		return window.smuflFont.getPath(char, 0, 0, fontSize)
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

		this.path.draw(ctx)

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

		// magic numbers
		const key_sharps_pos = [8, 5, 9, 6, 3, 7, 4]
		const key_flats_pos = [4, 7, 3, 6, 2, 5, 1]

		const first = accidentals[0]
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
	constructor(start, end) {
		super()
		const from = Math.min(start, end)
		const to = Math.max(start, end)
		this.positionY(from)
		this.to = to - from
		this.width = 18
	}

	draw(ctx) {
		for (let i = 0; i < this.to; i += 2) {
			ctx.beginPath()
			ctx.moveTo(-4, this.unitsToY(i))
			ctx.lineTo(this.width, this.unitsToY(i))
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
		ctx.beginPath()
		ctx.lineWidth = getFontSize() / 30 // 1.2
		ctx.moveTo(0, 0)
		ctx.lineTo(0, this.unitsToY(this.len))
		ctx.stroke()
	}
}

class Barline extends Draw {
	constructor(start, len) {
		super()
		this.len = len || 8
	}

	draw(ctx) {
		ctx.beginPath()
		ctx.lineWidth = getFontSize() / 30 // 1.2
		ctx.moveTo(0, 0)
		ctx.lineTo(0, this.unitsToY(this.len))
		ctx.stroke()
	}
}

class Dot extends Glyph {
	constructor(pos) {
		super('textAugmentationDot', pos)
		this.offsetX = 5
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
		ctx.font = this.font || 'italic bold 12px arial'
		if (this.textAlign) ctx.textAlign = this.textAlign
		ctx.fillText(this.text, 0, 0)
	}
}

class Tie extends Draw {
	constructor(start, end) {
		super()
		var x1 = start.x + start.width / 2
		var y1 = start.y
		var x2 = end.x + end.width / 2
		var y2 = end.y

		this.size = getFontSize() // TODO global
		this.x = x1
		this.y = y1
		this.endx = x2
		this.endy = y2
		this.height = getFontSize() * 0.5

		this.width = this.endx - this.x
	}

	draw(ctx) {
		ctx.strokeStyle = '#000'
		ctx.lineWidth = getFontSize() / 32

		ctx.beginPath()

		ctx.moveTo(0, 0)
		var mx = this.width / 2
		var my = this.height
		var x2 = this.width
		var y2 = this.endy - this.y

		// ctx.lineTo(mx, my);
		// ctx.lineTo(x2, y2);
		// ctx.stroke()

		// ctx.rect(0, 0, this.width, this.height)
		// ctx.fill();

		// ctx.quadraticCurveTo(mx, my, x2, y2)
		// ctx.stroke()

		ctx.quadraticCurveTo(mx, my - getFontSize() / 10, x2, y2)
		ctx.quadraticCurveTo(mx, my, 0, 0)
		ctx.fill()

		// var ratio = 0.2
		// ctx.bezierCurveTo(x2 * ratio, my * 0.5 , x2 * (1 - ratio), my * 0.5, x2, y2)
		// ctx.stroke()

		// this.debug(ctx);
	}
}

class Drawing {
	constructor(ctx) {
		this.set = new Set()

		ctx.font = `${getFontSize()}px Bravura`
		ctx.textBaseline = 'alphabetic' // alphabetic  bottom top
	}

	add(el) {
		this.set.add(el)
	}

	remove(el) {
		this.set.delete(el)
	}

	static _draw(ctx, el, viewportWidth, viewportOffsetX) {
		if (el instanceof Draw) {
			// TODO run quick check aabb bounds here to reduce rendering costs
			if (el.x > viewportOffsetX + viewportWidth + 200) return
			if (el.x + el.w < viewportOffsetX - 200) return

			ctx.save()
			ctx.translate(el.x, el.y)
			ctx.translate(el.offsetX || 0, el.offsetY || 0)
			el.draw(ctx)

			if (el._text) {
				ctx.font = '8px arial'
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
		const viewportWidth = scoreElm.clientWidth
		const viewportOffsetX = scoreElm.scrollLeft

		ctx.save()
		for (const el of this.set) {
			Drawing._draw(ctx, el, viewportWidth, viewportOffsetX)
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
	Ledger,
	Text,
	Line,
	Tie,
}

Object.assign(Claire, { Drawing, setup, Claire, resize, resizeToFit })
Object.assign(window, Claire)

export { Drawing, setup, Claire, resize, resizeToFit }
