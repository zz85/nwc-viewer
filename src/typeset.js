import { FONT_SIZE } from './constants.js'

// based on nwc music json representation,
// attempt to convert them to symbols to be drawn.
// also make weak attempt to lay them out

// music json -> draw symbols. interpretation? translation? engrave? typeset? layout? drawing?

/**
 * TODOs
 * - triplets
 * - dynamics
 */
const X_STRETCH = 0.5

class StaveCursor {
	constructor(stave, staveIndex) {
		this.tokenIndex = -1
		this.staveIndex = staveIndex
		this.staveX = 60
		this.stave = stave
		this.tokens = stave.tokens
		this.lastBarline = 40
	}

	peek() {
		return this.tokens[this.tokenIndex + 1]
	}

	hasNext() {
		return this.tokenIndex + 1 < this.tokens.length
	}

	next(func) {
		const tokenIndex = this.incTokenIndex()
		const token = this.tokens[tokenIndex]

		this.lastPadRight = 0
		func(token, tokenIndex, this.staveIndex, this)
	}

	incStaveX(inc) {
		this.staveX += inc
	}

	tokenPadRight(pad) {
		this.lastPadRight = pad
		// this.incStaveX(pad);
	}

	posGlyph(glyph) {
		glyph.moveTo(this.staveX, getStaffY(this.staveIndex))
	}

	incTokenIndex() {
		return ++this.tokenIndex
	}

	updateBarline() {
		this.lastBarline = this.staveX
	}
}

class TickTracker {
	constructor() {
		this.maxTicks = {}
	}

	add(token, cursor) {
		if (token.Visibility === 'hidden') return

		const refValue = token.tabUntilValue
		// tickValue tickUntilValue tabValue
		const which = this.maxTicks[refValue]

		const x = cursor.staveX + cursor.lastPadRight * X_STRETCH || 0
		if (!which || x > which.staveX) {
			this.maxTicks[refValue] = {
				cursor,
				staveX: x,
				token: token,
			}
		}
	}

	alignWithMax(token, cursor) {
		// console.log('alignWithMax', token, cursor);

		let moveX = cursor.staveX

		if (cursor.lastPadRight) {
			moveX += cursor.lastPadRight * 4
		}

		// increments staveX or align with item which already contains staveX for tabValue
		const key = token.tabValue
		if (key && key in this.maxTicks) {
			const which = this.maxTicks[key]

			moveX = which.staveX
		}

		cursor.staveX = moveX
		return false
	}
}

const tickTracker = new TickTracker()
let absCounter = 0
let drawing // placeholder for drawing system
let info // running debug info

function quickDraw(data, x, y) {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.save()
	ctx.translate(x, y)
	drawing.draw(ctx)
	ctx.restore()
}

window.quickDraw = quickDraw

window.everyStaveTokens = () => {
	const staves = data.score.staves

	const tokens = staves.reduce((vals, stave) => {
		return [...vals, ...stave.tokens]
	}, [])

	return tokens
}

function score(data) {
	var ctx = window.ctx
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	drawing = new Drawing(ctx)

	const staves = data.score.staves
	const stavePointers = staves.map(
		(stave, staveIndex) => new StaveCursor(stave, staveIndex)
	)

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
			console.log('nothing left')
			break
		}

		var smallestTick = Infinity,
			smallestIndex = -1
		stavePointers.forEach(cursor => {
			const token = cursor.peek()
			if (!token) return
			const tick = token.tabValue || 0

			if (tick < smallestTick) {
				smallestTick = tick
				smallestIndex = cursor.staveIndex
			}
		})

		if (smallestIndex > -1) {
			stavePointers[smallestIndex].next(handleToken)
		} else {
			console.log('no candidate!!')
		}
	}

	window.maxCanvasWidth = 100
	window.maxCanvasHeight = 100

	// TODO draw stave for every bar

	console.log('stavePointers', stavePointers)
	// draw staves

	stavePointers.forEach((cursor, staveIndex) => {
		addStave(cursor, staveIndex)
		maxCanvasWidth = Math.max(cursor.staveX + 100, maxCanvasWidth)
	})

	// draw braces
	var bottom = getStaffY(stavePointers.length - 1) - FONT_SIZE * 0.5
	drawing.add(new Line(20, getStaffY(-1), 20, bottom))

	maxCanvasHeight = bottom + 100

	var { title, author, copyright1, copyright2 } = data.info || {}
	var middle = window.innerWidth / 2
	if (title) {
		const titleDrawing = new Claire.Text(title, 0, {
			font: '20px arial',
			textAlign: 'center',
		}) // italic bold
		titleDrawing.moveTo(middle, 40)
		drawing.add(titleDrawing)
	}

	if (author) {
		const authorDrawing = new Claire.Text(author, 0, {
			font: 'italic 14px arial',
			textAlign: 'center',
		}) // italic bold
		authorDrawing.moveTo(middle, 60)
		drawing.add(authorDrawing)
	}

	if (copyright1) {
		const authorDrawing = new Claire.Text(copyright1, 0, {
			font: '10px arial',
			textAlign: 'center',
		}) // italic bold
		authorDrawing.moveTo(middle, bottom + 80)
		drawing.add(authorDrawing)
	}

	if (copyright2) {
		const authorDrawing = new Claire.Text(copyright2, 0, {
			font: '10px arial',
			textAlign: 'center',
		}) // italic bold
		authorDrawing.moveTo(middle, bottom + 90)
		drawing.add(authorDrawing)
	}

	drawing.draw(ctx)

	// TODO move this out of this function

	var invisible_canvas = document.getElementById('invisible_canvas')
	invisible_canvas.style.width = `${maxCanvasWidth}px`
	invisible_canvas.style.height = `${Math.max(
		maxCanvasHeight,
		document.getElementById('score').clientHeight
	)}px`

	// https://stackoverflow.com/questions/21064101/understanding-offsetwidth-clientwidth-scrollwidth-and-height-respectively
}

function getStaffY(staffIndex) {
	return FONT_SIZE * 4 + FONT_SIZE * 2.6 * staffIndex
	// 120 100
}

function addStave(cursor, staveIndex) {
	const width = cursor.staveX - cursor.lastBarline
	const s = new Stave(width)
	s.moveTo(cursor.lastBarline, getStaffY(staveIndex))
	drawing.add(s)

	console.log('staveIndex', staveIndex, cursor.tokens)
}

function handleToken(token, tokenIndex, staveIndex, cursor) {
	// info = tokenIndex
	// info = absCounter++ + ' : ' + tokenIndex
	let info = ''
	const staveY = getStaffY(staveIndex)

	const type = token.type
	let t, s

	// console.log('handleToken', token)
	tickTracker.alignWithMax(token, cursor)

	switch (type) {
		default:
			console.log('Typeset: Unhandled type - ', type) // , token
			break
		case 'StaffProperties':
		case 'StaffInstrument':
			// TODO infomational purposes
			break

		case 'Clef':
			// TODO handle octave down
			// console.log('clef', token);
			let clef
			switch (token.clef) {
				case 'treble':
					clef = new Claire.TrebleClef()
					break
				case 'bass':
					clef = new Claire.BassClef()
					break
				case 'alto':
					clef = new Claire.AltoClef()
					break
				case 'percussion':
				default:
					console.log('ERR unknown clef', token.clef)
					clef = new Claire.AltoClef()
					break
			}
			// clef = new {
			// 	treble: Claire.TrebleClef,
			// }[token.clef]()

			cursor.posGlyph(clef)
			drawing.add(clef)
			cursor.incStaveX(clef.width * 2)
			break

		case 'TimeSignature':
			const sig = token.signature

			var name =
				sig === 'AllaBreve' ? 'CutCommon' : sig === 'Common' ? 'Common' : ''

			if (name) {
				t = new TimeSignature(name, 4)
				cursor.posGlyph(t)
				drawing.add(t)

				cursor.incStaveX(t.width * 2)
			} else if (token.group && token.beat) {
				t = new TimeSignature(token.group, 6)
				cursor.posGlyph(t)
				drawing.add(t)

				t = new TimeSignature(token.beat, 2)
				cursor.posGlyph(t)
				drawing.add(t)

				cursor.incStaveX(t.width * 2)
			}

			break
		case 'KeySignature':
			const key = new KeySignature(token.accidentals, token.clef)
			cursor.posGlyph(key)
			drawing.add(key)

			cursor.incStaveX(key.width * 2)
			break

		case 'Rest':
			var duration = token.duration
			var sym = {
				1: 'restWhole',
				2: 'restHalf',
				4: 'restQuarter',
				8: 'rest8th',
				16: 'rest16th',
			}[duration]

			if (!sym) console.log('FAIL REST', token, duration)

			s = new Glyph(sym, token.position + 4) // + 4
			cursor.posGlyph(s)
			s._text = info
			drawing.add(s)

			cursor.incStaveX(s.width * 1)
			cursor.tokenPadRight(s.width * calculatePadding(token.durValue))
			break

		case 'Barline':
			s = new Barline()
			cursor.posGlyph(s)
			s._text = info
			drawing.add(s)

			addStave(cursor, staveIndex)
			cursor.updateBarline()
			cursor.tokenPadRight(10)
			break

		case 'Chord':
			let tmp = cursor.staveX
			token.notes.forEach(note => {
				cursor.staveX = tmp
				drawForNote(note, cursor, token)
			})
			break

		case 'Note':
			drawForNote(token, cursor, token)
			break
		case 'Text':
			var pos = token.position !== undefined ? token.position : -11
			var text = new Text(token.text, pos)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'PerformanceStyle':
			var pos = token.position !== undefined ? token.position : -11
			var text = new Text(token.text, pos)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Tempo':
			var pos = token.position !== undefined ? token.position : -15
			var text = new Text(
				// `${token.note} = ${token.duration}`
				`(${token.duration})`,
				pos
			)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Dynamic':
			var pos = token.position !== undefined ? token.position : 7
			var text = new Text(token.dynamic, pos)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'moo':
			console.log('as', token)
			break
	}

	tickTracker.add(token, cursor)
}

function drawForNote(token, cursor, durToken) {
	const duration = durToken.duration
	const durValue = durToken.durValue

	const sym =
		duration < 2
			? 'noteheadWhole'
			: duration < 4 ? 'noteheadHalf' : 'noteheadBlack'

	const relativePos = token.position + 4
	const requireStem = duration >= 2
	const stemUp =
		token.Stem === 'Up'
			? true
			: token.Stem === 'Down' ? false : token.position < 0

	// TODO refactor flag drawing!!
	const requireFlag = duration >= 8

	if (token.accidental) {
		var acc = new Accidental(token.accidental, relativePos)
		cursor.posGlyph(acc)
		acc.offsetX = -acc.width * 1.2
		drawing.add(acc)
	}

	// if (token.Beam) console.log('Beam', token);

	// note head
	const noteHead = new Glyph(sym, relativePos)
	cursor.posGlyph(noteHead)
	// noteHead._text = info + '.' // + ':' + token.name;
	drawing.add(noteHead)
	const noteHeadWidth = noteHead.width
	let space = noteHeadWidth

	// ledger lines
	if (relativePos < 0) {
		const ledger = new Ledger(((relativePos / 2) | 0) * 2, 0)
		cursor.posGlyph(ledger)
		drawing.add(ledger)
	} else if (relativePos > 8) {
		const ledger = new Ledger((((relativePos + 1) / 2) | 0) * 2, 8)
		cursor.posGlyph(ledger)
		drawing.add(ledger)
	}

	if (token.text) {
		var pos = 10
		var text = new Text(token.text, pos, {
			font: '12px arial',
			textAlign: 'center',
		})
		cursor.posGlyph(text)
		drawing.add(text)
	}

	if (requireStem && !stemUp) {
		// stem down
		const stem = new Stem(relativePos - 7)
		cursor.posGlyph(stem)
		drawing.add(stem)

		let flag
		if (requireFlag) {
			flag = new Glyph(`flag${duration}thDown`, relativePos - 7 - 0.5)
			cursor.posGlyph(flag)
			flag._text = info
			drawing.add(flag)
			space = Math.max(space, flag.width || 0)
		}

		cursor.incStaveX(space)
	} else if (requireStem && stemUp) {
		cursor.incStaveX(noteHeadWidth)

		let flag

		// stem up
		const stem = new Stem(relativePos)
		cursor.posGlyph(stem)
		drawing.add(stem)
		// cursor.incStaveX(stem.width);

		// Flags
		if (requireFlag) {
			flag = new Glyph(`flag${duration}thUp`, relativePos + 7)
			cursor.posGlyph(flag)
			flag._text = info
			drawing.add(flag)
			cursor.incStaveX(flag.width)
		}
	} else {
		cursor.incStaveX(noteHeadWidth)
	}

	for (let i = 0; i < token.dots; i++) {
		var adjust = isOnLine(relativePos) ? 1 : 0
		const dot = new Dot(relativePos + adjust - 0.2)
		cursor.posGlyph(dot)
		drawing.add(dot)
		cursor.incStaveX(dot.width)
	}

	var spaceMultiplier = calculatePadding(durValue || token.durValue)
	cursor.tokenPadRight(noteHead.width * 1 * spaceMultiplier)
}

function isOnLine(pos) {
	return pos % 2 == 0
}

function calculatePadding(durValue) {
	// TODO tweak this, consider exponential or constrains systems
	var spaceMultiplier = Math.min(Math.max(durValue.value() * 8, 1), 8)
	// use 1/8 as units
	// console.log(spaceMultiplier);

	return spaceMultiplier
}

export { score }
