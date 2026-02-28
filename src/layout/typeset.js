import { getFontSize, getZoomLevel } from '../constants.js'
import { layoutBeaming } from './beams.js'
import { layoutTies } from './ties.js'
import { resizeToFit } from '../drawing.js'

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

/**
 * StaveCursor keeps score of something ?
 */
class StaveCursor {
	constructor(stave, staveIndex) {
		this.tokenIndex = -1
		this.staveIndex = staveIndex
		this.staveX = getFontSize() // 60
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

	/* assign padding to previous token */
	tokenPadRight(pad) {
		this.lastPadRight = pad
		// this.incStaveX(pad);
	}

	/* position a drawing object to the current x position of this cursor */
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

/**
 * Aligns tokens by their time values.
 * The tokens that uses the most space
 * determines where other tokens should
 * align
 */
class TickTracker {
	constructor() {
		this.reset()
	}

	reset() {
		this.maxTicks = {}
	}

	add(token, cursor) {
		if (token.Visibility === 'hidden') return

		const refValue = token.tabUntilValue
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

/* Rerenders all drawing objects */
function quickDraw(dataOrContext, x, y) {
	const ctx = dataOrContext?.getContext ? dataOrContext.getContext() : window.ctx
	const canvas = dataOrContext?.getCanvas ? dataOrContext.getCanvas() : window.canvas
	
	if (!ctx || !canvas) {
		console.warn('quickDraw called without valid context')
		return
	}
	
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.save()
	// Translate by screen-space scroll offset, then scale into score-space.
	// The transform chain is: DPR (from resize) → scroll translate → zoom scale.
	ctx.translate(x || 0, y || 0)
	var zoom = getZoomLevel()
	if (zoom !== 1) ctx.scale(zoom, zoom)
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

function score(dataOrContext) {
	// Support both legacy data object and new MusicContext
	const data = dataOrContext.getData ? dataOrContext.getData() : dataOrContext
	const ctx = dataOrContext.getContext ? dataOrContext.getContext() : window.ctx
	const canvas = dataOrContext.getCanvas ? dataOrContext.getCanvas() : window.canvas
	
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	window.drawing = drawing = new Drawing(ctx)

	const staves = data.score.staves
	currentStaves = staves
	currentAllowLayering = data.score.allowLayering !== false
	buildStaffYMap(staves, data.score.allowLayering)
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

	tickTracker.reset()

	// Safety limit: total token count × 2 is a generous upper bound.
	// An infinite spin means no cursor advanced; break and warn rather than hang.
	const totalTokens = stavePointers.reduce((n, c) => n + c.tokens.length, 0)
	let layoutIterations = 0
	const maxIterations = Math.max(totalTokens * 2, 100)

	while (true) {
		if (++layoutIterations > maxIterations) {
			console.warn(`Layout loop exceeded ${maxIterations} iterations — aborting to prevent hang`)
			break
		}

		if (!stavePointers.some((s) => s.hasNext())) {
			console.log('nothing left')
			break
		}

		/* position stuff of the same tab value to the furthest */
		var smallestTick = Infinity,
			smallestIndex = -1
		stavePointers.forEach((cursor) => {
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
			break
		}
	}

	window.maxCanvasWidth = 100
	window.maxCanvasHeight = 100

	// TODO draw stave for every bar

	console.log('stavePointers', stavePointers)

	/* Layout Beams */
	layoutBeaming(drawing, data)
	/* Layout Ties */
	layoutTies(drawing, data)

	/* Layout staves */
	stavePointers.forEach((cursor, staveIndex) => {
		addStave(cursor, staveIndex)
		maxCanvasWidth = Math.max(cursor.staveX + 100, maxCanvasWidth)
	})

	// draw braces/brackets
	var lastStaveY = getStaffY(stavePointers.length - 1)
	var bottom = lastStaveY + getFontSize() * 1.5

	maxCanvasHeight = bottom + 100

	// Render bracket/brace connectors between grouped staves.
	// All drawn as Path objects at position (0,0) using absolute coordinates,
	// because Drawing._draw() applies ctx.translate(el.x, el.y) before calling
	// el.draw() — using Line would double-apply the position.
	var fs = getFontSize()
	var bracketX = fs * 0.08
	var braceX = fs * 0.04

	// Collect visible staff Y positions (deduplicate layered staves at same Y)
	var visibleYs = []
	for (var vi = 0; vi < staves.length; vi++) {
		var vy = getStaffY(vi)
		if (visibleYs.length === 0 || visibleYs[visibleYs.length - 1] !== vy) {
			visibleYs.push(vy)
		}
	}

	// Draw a system bracket when there are multiple visible staves
	if (visibleYs.length > 1) {
		let topY = visibleYs[0] - fs
		let botY = visibleYs[visibleYs.length - 1]
		let hookLen = fs * 0.25
		let lw = fs / 12
		var sysBracket = new Claire.Path(function(ctx) {
			ctx.beginPath()
			ctx.lineWidth = lw
			ctx.moveTo(bracketX + hookLen, topY)
			ctx.lineTo(bracketX, topY)
			ctx.lineTo(bracketX, botY)
			ctx.lineTo(bracketX + hookLen, botY)
			ctx.stroke()
		})
		drawing.add(sysBracket)
	}

	// Draw per-group braces for explicit braceWithNext flags
	for (var si = 0; si < staves.length; si++) {
		var stave = staves[si]
		if (stave.braceWithNext) {
			var endSi = si
			while (endSi < staves.length - 1 && staves[endSi].braceWithNext) {
				endSi++
			}
			let topY = getStaffY(si) - fs * 0.15
			let botY = getStaffY(endSi) + fs * 1.05
			let braceH = botY - topY
			let midY = topY + braceH / 2
			let curveW = fs * 0.5
			let bLw = fs / 18
			var brace = new Claire.Path(function(ctx) {
				ctx.beginPath()
				ctx.lineWidth = bLw
				ctx.moveTo(braceX + curveW, topY)
				ctx.bezierCurveTo(braceX + curveW * 0.2, topY + braceH * 0.1,
					braceX + curveW * 0.4, midY - braceH * 0.05,
					braceX, midY)
				ctx.bezierCurveTo(braceX + curveW * 0.4, midY + braceH * 0.05,
					braceX + curveW * 0.2, botY - braceH * 0.1,
					braceX + curveW, botY)
				ctx.stroke()
			})
			drawing.add(brace)
		}
	}

	var { title, author, copyright1, copyright2 } = data.info || {}

	// Use canvas width (set after resize) for centering — not window.innerWidth
	// which can differ in headless/embedded contexts.
	var middle = maxCanvasWidth / 2
	if (title) {
		const titleDrawing = new Claire.Text(title, 0, {
			font: "bold 20px Arial, 'Segoe UI', sans-serif",
			textAlign: 'center',
		}) // italic bold
		titleDrawing.moveTo(middle, 40)
		drawing.add(titleDrawing)
	}

	if (author) {
		const authorDrawing = new Claire.Text(author, 0, {
			font: "italic 14px Arial, 'Segoe UI', sans-serif",
			textAlign: 'center',
		}) // italic bold
		authorDrawing.moveTo(middle, 60)
		drawing.add(authorDrawing)
	}
	footer.innerText = copyright1 + '\n' + copyright2

	// Size the invisible_canvas spacer BEFORE rendering so the browser can
	// clamp scrollLeft / scrollTop to the new content bounds (e.g. after zoom
	// changes the score dimensions).  The spacer dimensions are in screen-space
	// (score-space × zoom) so the scrollbar range matches the zoomed extent.
	var invisible_canvas = document.getElementById('invisible_canvas')
	var scoreElm = document.getElementById('score')
	var zoom = getZoomLevel()
	invisible_canvas.style.width = `${maxCanvasWidth * zoom}px`
	invisible_canvas.style.height = `${Math.max(
		maxCanvasHeight * zoom,
		scoreElm.clientHeight
	)}px`

	// Virtual rendering: keep the canvas at viewport size and let the
	// invisible_canvas spacer provide the scrollable area.  On each scroll
	// frame quickDraw() re-renders only the visible portion via
	// ctx.translate() + viewport culling in Drawing._draw().
	if (canvas) {
		resizeToFit()
	}

	// Draw the visible portion of the score, offset by the current scroll
	// position (now correctly clamped by the spacer resize above).
	quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
}

// Computed Y positions for each stave, respecting WithNextStaff flags.
// Built once per score() call; consumed by getStaffY().
var staffYMap = []
var currentStaves = [] // reference to current staves array for handleToken
var currentAllowLayering = true // file-level allowLayering flag

function buildStaffYMap(staves, allowLayering) {
	var fs = getFontSize()
	var initialOffset = fs * 4
	var intraGroupSpacing = fs * 1.8   // tighter spacing within a bracket/brace group
	var interGroupSpacing = fs * 5     // wider gap between groups for lyrics
	var layerSpacing = 0               // layered staves overlap completely

	staffYMap = []
	var y = initialOffset
	for (var i = 0; i < staves.length; i++) {
		staffYMap[i] = y
		var stave = staves[i]
		if ((stave.layerWithNext || stave.bracketWithNext) && allowLayering !== false) {
			y += layerSpacing
		} else if (stave.bracketWithNext || stave.braceWithNext || stave.connectBarsWithNext) {
			y += intraGroupSpacing
		} else if (i < staves.length - 1) {
			y += interGroupSpacing
		}
	}
}

function getStaffY(staffIndex) {
	if (staffIndex >= 0 && staffIndex < staffYMap.length) {
		return staffYMap[staffIndex]
	}
	// Fallback for out-of-range (shouldn't happen)
	return getFontSize() * 4 + getFontSize() * 2.6 * staffIndex
}

function addStave(cursor, staveIndex) {
	const width = cursor.staveX - cursor.lastBarline
	const s = new Stave(width)
	s.moveTo(cursor.lastBarline, getStaffY(staveIndex))
	drawing.add(s)
}

function spacerWidth() {
	return getFontSize() * 0.25
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

	let clef

	switch (type) {
		default:
			console.log('Typeset: Unhandled type - ', type) // , token
			break
		case 'StaffProperties':
		case 'StaffInstrument':
			// TODO infomational purposes
			break

		case 'Clef':
			clef = clefFromString(token.clef)
			cursor.posGlyph(clef)
			drawing.add(clef)
			cursor.incStaveX(clef.width + spacerWidth())
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
				// Numeric time signature: stack numerator (top) and denominator (bottom)
				// Both glyphs share the same x position — they are vertically stacked.
				const numerator   = new TimeSignature(token.group, 6)   // upper staff half
				const denominator = new TimeSignature(token.beat,  2)   // lower staff half

				cursor.posGlyph(numerator)
				cursor.posGlyph(denominator)  // same x — intentionally stacked
				drawing.add(numerator)
				drawing.add(denominator)

				cursor.incStaveX(numerator.width + spacerWidth() * 2)
			}

			break
		case 'KeySignature':
			const key = new KeySignature(token.accidentals, token.clef)
			cursor.posGlyph(key)
			drawing.add(key)

			cursor.incStaveX(key.width + spacerWidth())
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

			// Connect barlines to next staff if flagged, or if staves are layered
			// (layered grand staves implicitly share barlines, matching NWC Viewer)
			var staveData = currentStaves[staveIndex]
			var shouldConnect = staveData && staveIndex < currentStaves.length - 1 && (
				staveData.connectBarsWithNext ||
				((staveData.layerWithNext || staveData.bracketWithNext) && currentAllowLayering)
			)
			if (shouldConnect) {
				// Find the next non-layered staff (skip staves at the same Y)
				var nextSi = staveIndex + 1
				while (nextSi < currentStaves.length - 1 && getStaffY(nextSi) === getStaffY(staveIndex)) {
					nextSi++
				}
				let thisY = getStaffY(staveIndex) + getFontSize() // bottom of this staff
				let nextY = getStaffY(nextSi)                    // top of next visible staff
				if (nextY > thisY) {
					let barX = cursor.staveX
					let lw = getFontSize() / 24
					var connPath = new Claire.Path(function(ctx) {
						ctx.beginPath()
						ctx.lineWidth = lw
						ctx.moveTo(barX, thisY)
						ctx.lineTo(barX, nextY)
						ctx.stroke()
					})
					drawing.add(connPath)
				}
			}

			addStave(cursor, staveIndex)
			cursor.updateBarline()
			cursor.incStaveX(spacerWidth() * 1)
			// cursor.tokenPadRight(spacerWidth())
			// 10
			break

		case 'Chord':
			let tmp = cursor.staveX
			token.notes.forEach((note) => {
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
			// Fixed position: always above the top staff line to avoid colliding with lyrics
			var text = new Text(token.text, -13, {
				font: "italic 11px Arial, 'Segoe UI', sans-serif",
			})
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Tempo':
			// Fixed position: above the staff, slightly offset right of the barline
			var text = new Text(
				`(${token.duration})`,
				-15,
				{ font: "11px Arial, 'Segoe UI', sans-serif" }
			)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Dynamic':
			// Fixed position: below the bottom staff line
			var text = new Text(token.dynamic, 9, {
				font: "italic bold 12px Arial, 'Segoe UI', sans-serif",
			})
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
			: duration < 4
			? 'noteheadHalf'
			: 'noteheadBlack'

	const relativePos = token.position + 4

	if (token.accidental) {
		var acc = new Accidental(token.accidental, relativePos)
		cursor.posGlyph(acc)
		acc.offsetX = -acc.width * 1.2
		drawing.add(acc)
	}

	// note head
	const noteHead = new Glyph(sym, relativePos)
	cursor.posGlyph(noteHead)
	// noteHead._text = info + '.' // + ':' + token.name;
	drawing.add(noteHead)
	const noteHeadWidth = noteHead.width

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

	token.drawingNoteHead = noteHead

	if (token.text) {
		var pos = 10
		var text = new Text(token.text, pos, {
			font: "12px Arial, 'Segoe UI', sans-serif",
			textAlign: 'center',
		})
		cursor.posGlyph(text)
		drawing.add(text)
	}

	/*

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
	*/

	cursor.incStaveX(noteHeadWidth)

	// Determine if note will have stem up with flag
	const hasStem = duration >= 2
	const hasFlag = duration >= 8 && (!token.beam || token.beam === 0)
	const stemUp = token.Stem === 'Up' || token.stem === 1 ? true :
	               token.Stem === 'Down' || token.stem === 2 ? false :
	               token.position < 0
	
	// If stem up with flag, add small space before dot
	if (hasStem && hasFlag && stemUp) {
		cursor.incStaveX(spacerWidth())
	}

	for (let i = 0; i < token.dots; i++) {
		var adjust = isOnLine(relativePos) ? 1 : 0
		const dot = new Dot(relativePos + adjust - 0.2)
		cursor.posGlyph(dot)
		drawing.add(dot)
		cursor.incStaveX(dot.width)
	}

	// cursor.incStaveX(spacerWidth())
	cursor.tokenPadRight(spacerWidth())

	// Account for stem width on notes that will have stems
	const stemBuffer = hasStem ? spacerWidth() * 2 : 0

	var spaceMultiplier = calculatePadding(durValue || token.durValue)
	cursor.tokenPadRight(noteHead.width * spaceMultiplier + stemBuffer)
}

function isOnLine(pos) {
	return pos % 2 == 0
}

function calculatePadding(durValue) {
	// Improved spacing: logarithmic scale for better visual balance
	// Whole notes get more space, shorter notes get proportionally less
	const duration = durValue.value()
	
	// Base spacing on note duration with diminishing returns
	const baseSpacing = Math.sqrt(duration * 16)
	
	// Clamp between reasonable bounds
	return Math.min(Math.max(baseSpacing, 0.5), 10)
}

function clefFromString(str) {
	switch (str) {
		case 'treble':
			return new Claire.TrebleClef()
		case 'bass':
			return new Claire.BassClef()
		case 'alto':
			return new Claire.AltoClef()
		case 'percussion':
		default:
			console.log('ERR unknown clef', str)
			return new Claire.AltoClef()
	}
}

export { score }
