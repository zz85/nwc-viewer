import { getFontSize, getZoomLevel, getLayoutMode } from '../constants.js'
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
		this.staveX = getLayoutMode() === 'wrap' ? 0 : getFontSize()
		this.stave = stave
		this.tokens = stave.tokens
		this.lastBarline = getLayoutMode() === 'wrap' ? 0 : getFontSize()
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

/**
 * Collects barline X positions from the first staff to identify measure boundaries.
 * Returns an array of { x, tokenIndex, systemBreak } for each barline.
 */
function collectMeasureBoundaries(staves) {
	// Use the first stave (index 0) as the reference for measure boundaries.
	// All staves share the same barline positions due to TickTracker alignment.
	const tokens = staves[0]?.tokens || []
	const boundaries = []
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token.type === 'Barline' && token.drawingBarline) {
			boundaries.push({
				x: token.drawingBarline.x,
				tokenIndex: i,
				systemBreak: !!token.systemBreak,
			})
		}
	}
	return boundaries
}

/**
 * Collect note/rest/chord X positions as anchor points for justification.
 * Returns an array of X positions (absolute, in single-line coords) sorted
 * in ascending order.  These are the points between which extra space
 * should be distributed — elements at the same anchor position move together.
 */
function collectAnchors(staves) {
	const tokens = staves[0]?.tokens || []
	const anchors = []
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token.drawingNoteHead && (token.type === 'Note' || token.type === 'Chord' || token.type === 'Rest')) {
			anchors.push(token.drawingNoteHead.x)
		}
	}
	return anchors
}

/**
 * For each staff, tracks the running clef and key signature at each barline.
 * Returns an array (per staff) of { clef, accidentals, clefForKey } representing
 * the state after all tokens up to each barline boundary.
 *
 * boundaryTokenIndices — array of token indices from stave[0] where barlines occur.
 *   We use the *count* of barlines seen (not absolute indices) since different
 *   staves may have different token indices for the same barline.
 */
function collectRunningState(staves) {
	// For each staff, walk its tokens and record the clef/key state at each barline.
	const statePerStaff = []
	for (let si = 0; si < staves.length; si++) {
		const tokens = staves[si].tokens || []
		let currentClef = 'treble'
		let currentAccidentals = []
		let currentClefForKey = 'treble'
		const stateAtBarlines = []

		for (let ti = 0; ti < tokens.length; ti++) {
			const token = tokens[ti]
			if (token.type === 'Clef') {
				currentClef = token.clef || 'treble'
				currentClefForKey = currentClef
			} else if (token.type === 'KeySignature') {
				currentAccidentals = token.accidentals || []
				if (token.clef) currentClefForKey = token.clef
			} else if (token.type === 'Barline') {
				stateAtBarlines.push({
					clef: currentClef,
					accidentals: currentAccidentals.slice(),
					clefForKey: currentClefForKey,
				})
			}
		}
		statePerStaff.push(stateAtBarlines)
	}
	return statePerStaff
}

/**
 * Creates courtesy clef and key signature drawing objects for a given staff
 * at a given position.  Returns { elements, totalWidth } where elements is
 * an array of Draw objects and totalWidth is the horizontal space consumed.
 */
function createCourtesyItems(clefStr, accidentals, clefForKey, staffY) {
	const elements = []
	let x = 0

	// Courtesy clef
	const clef = clefFromString(clefStr)
	clef.moveTo(x, staffY)
	elements.push(clef)
	x += clef.width + spacerWidth()

	// Courtesy key signature (only if there are accidentals)
	if (accidentals && accidentals.length > 0) {
		const keySig = new KeySignature(accidentals, clefForKey)
		keySig.moveTo(x, staffY)
		elements.push(keySig)
		x += (keySig.width || 0) + spacerWidth()
	}

	return { elements, totalWidth: x }
}

/**
 * Given measure boundaries and an available width, decide which barlines are
 * system break points using dynamic programming to minimize total "badness"
 * across all systems (Knuth-Plass style).
 *
 * Breaks only occur at barlines.  Explicit NWC systemBreak flags act as
 * forced breaks that partition the problem into independent segments.
 *
 * Badness for a system = ((actual_width - ideal_width) / ideal_width)^2
 * This penalizes both overfull and underfull lines, with quadratic growth
 * to strongly discourage very short or very long lines.
 *
 * Returns an array of break objects: { x, boundaryIndex, systemIndex }
 */
function computeSystemBreaks(boundaries, pageWidth, leftMargin) {
	if (boundaries.length === 0) return []

	// Split boundaries into segments divided by forced breaks.
	// Each segment is solved independently via DP, then results are merged.
	const forcedBreakIndices = []
	for (let i = 0; i < boundaries.length; i++) {
		if (boundaries[i].systemBreak && i < boundaries.length - 1) {
			forcedBreakIndices.push(i)
		}
	}

	// Build segments: each segment is a range [startIdx, endIdx] of boundaries
	// that must be broken optimally within, bounded by forced breaks.
	const segments = []
	let segStart = 0
	for (const fbi of forcedBreakIndices) {
		segments.push({ start: segStart, end: fbi })
		segStart = fbi + 1
	}
	// Final segment from last forced break to end
	segments.push({ start: segStart, end: boundaries.length - 1 })

	const allBreaks = []
	let systemIndex = 0

	for (const seg of segments) {
		const segBreaks = dpOptimalBreaks(boundaries, seg.start, seg.end, pageWidth)

		for (const bi of segBreaks) {
			allBreaks.push({ x: boundaries[bi].x, boundaryIndex: bi, systemIndex })
			systemIndex++
		}

		// If this segment ended at a forced break, add that break too
		if (forcedBreakIndices.includes(seg.end)) {
			allBreaks.push({
				x: boundaries[seg.end].x,
				boundaryIndex: seg.end,
				systemIndex,
			})
			systemIndex++
		}
	}

	return allBreaks
}

/**
 * DP solver for optimal line breaks within a contiguous range of boundaries.
 *
 * Given boundaries[start..end], find the set of break indices that minimizes
 * total badness.  A "break at index i" means the system ends at boundaries[i]
 * and a new system begins after it.
 *
 * Returns an array of boundary indices where breaks should occur (NOT including
 * `end`, which is the final boundary of the segment — no break after the last
 * measure).
 */
function dpOptimalBreaks(boundaries, start, end, pageWidth) {
	const n = end - start + 1 // number of boundaries in this segment
	if (n <= 1) return []

	// measureWidths[i] = width of measure i (from previous boundary to this one)
	// For i=0, the "previous boundary" is the start of the score (x=0 or the
	// preceding forced-break X).
	const prevX = start > 0 ? boundaries[start - 1].x : 0
	const measureWidths = []
	for (let i = start; i <= end; i++) {
		const fromX = i === start ? prevX : boundaries[i - 1].x
		measureWidths.push(boundaries[i].x - fromX)
	}

	// dp[i] = minimum total badness for laying out measures 0..i
	// choice[i] = the index of the last break before i (or -1 for start of segment)
	const INF = 1e18
	const dp = new Array(n).fill(INF)
	const choice = new Array(n).fill(-1)

	for (let i = 0; i < n; i++) {
		// Try putting measures j+1..i on one system (break after j, or j=-1 for start)
		let lineWidth = 0
		for (let j = i; j >= 0; j--) {
			lineWidth += measureWidths[j]

			// If this single line is way too wide (>2x page), stop looking further back
			if (lineWidth > pageWidth * 2.5 && j < i) break

			const badness = computeBadness(lineWidth, pageWidth, i === n - 1)
			const prevCost = j > 0 ? dp[j - 1] : 0

			if (prevCost + badness < dp[i]) {
				dp[i] = prevCost + badness
				choice[i] = j > 0 ? j - 1 : -1
			}
		}
	}

	// Trace back to find break points
	const breaks = []
	let idx = choice[n - 1]
	while (idx >= 0) {
		breaks.push(start + idx)
		idx = choice[idx]
	}
	breaks.reverse()

	return breaks
}

/**
 * Compute badness (penalty) for a system line of a given width relative to
 * the target page width.
 *
 * - Underfull lines: quadratic penalty based on how much empty space remains.
 * - Overfull lines: steep penalty (we strongly avoid overflow).
 * - The last line of a segment is penalized less for being underfull (it's
 *   natural for the final system to be shorter).
 */
function computeBadness(lineWidth, pageWidth, isLastLine) {
	const ratio = lineWidth / pageWidth

	if (ratio > 1.0) {
		// Overfull — steep penalty to avoid overflow
		return (ratio - 1.0) * (ratio - 1.0) * 100
	}

	// Underfull — quadratic penalty on the shortfall
	const shortfall = 1.0 - ratio
	if (isLastLine) {
		// Last line is allowed to be slightly shorter, but orphan lines
		// (very short last systems) should still be strongly discouraged.
		return shortfall * shortfall * 5
	}
	return shortfall * shortfall * 10
}

// Maximum stretch factor per gap between adjacent anchors (note positions).
// Keeps note spacing from becoming unnaturally wide.
const MAX_INTRA_STRETCH = 5.0

/**
 * Build a justification map for one system using anchor points.
 *
 * Anchors are note/rest X positions within the system — the natural spacing
 * points.  Extra space is distributed at anchor gaps (between consecutive
 * notes) so that elements belonging to the same note unit (head, stem,
 * dot, accidental, beam endpoint) all receive the same offset and stay
 * together.
 *
 * relBarXs — barline positions relative to system start
 * extraSpace — total extra px to distribute
 * anchors — sorted array of note/rest X positions relative to system start
 *
 * Returns { anchors, anchorOffsets, relBarXs, barlineOffsets }
 */
function buildBarlineMap(relBarXs, extraSpace, anchors) {
	// Degenerate cases
	if (extraSpace <= 0 || (anchors || []).length < 2) {
		return {
			anchors: anchors || [],
			anchorOffsets: (anchors || []).map(() => 0),
			relBarXs,
			barlineOffsets: relBarXs.map(() => 0),
		}
	}

	// Phase 1: compute per-gap ideal extra, capped at MAX_INTRA_STRETCH.
	// A "gap" is the space between two consecutive anchors.
	var gaps = []
	for (var i = 1; i < anchors.length; i++) {
		gaps.push(anchors[i] - anchors[i - 1])
	}
	var totalGapWidth = gaps.reduce((s, g) => s + g, 0) || 1

	var usedByStretch = 0
	var gapExtras = []
	for (var i = 0; i < gaps.length; i++) {
		var gap = gaps[i]
		if (gap <= 0) {
			gapExtras.push(0)
			continue
		}
		var idealExtra = extraSpace * (gap / totalGapWidth)
		var maxExtra = gap * (MAX_INTRA_STRETCH - 1.0)
		var actual = Math.min(idealExtra, maxExtra)
		gapExtras.push(actual)
		usedByStretch += actual
	}

	// Phase 2: remaining space goes to barline padding.
	var remainingSpace = extraSpace - usedByStretch
	var totalBarSpan = relBarXs.length > 0 ? (relBarXs[relBarXs.length - 1] || 1) : 1
	var barlineOffsets = relBarXs.map(function(bx) {
		return remainingSpace * (bx / totalBarSpan)
	})

	// Build cumulative anchor offsets (how much each anchor shifts right).
	// Anchor 0 gets offset 0 (it's the system start reference).
	// Anchor i gets the sum of gapExtras[0..i-1].
	var anchorOffsets = [0]
	var cumExtra = 0
	for (var i = 0; i < gapExtras.length; i++) {
		cumExtra += gapExtras[i]
		anchorOffsets.push(cumExtra)
	}

	return { anchors, anchorOffsets, relBarXs, barlineOffsets }
}

/**
 * Compute the justified X position for an element at original relX
 * within a system, given the barline map from buildBarlineMap.
 *
 * Uses piecewise-constant offsets: each element snaps to the offset of
 * its nearest anchor.  This keeps note units (head, stem, dot, beam
 * endpoint, accidental) rigid — they all share the same anchor and
 * therefore the same offset.  The jump between offsets happens at the
 * midpoint between consecutive anchors, so barlines and other
 * inter-note elements land on a reasonable offset too.
 *
 * Returns the new X position (relative to system left edge).
 */
function computeJustifyX(relX, barlineMap) {
	var { anchors, anchorOffsets, relBarXs, barlineOffsets } = barlineMap

	if (!anchors || anchors.length < 2) {
		// No anchors — fall back to barline-only padding
		if (relBarXs && relBarXs.length > 0) {
			var bIdx = -1
			for (var i = 0; i < relBarXs.length; i++) {
				if (relX >= relBarXs[i]) bIdx = i
				else break
			}
			return relX + (bIdx >= 0 ? barlineOffsets[bIdx] : 0)
		}
		return relX
	}

	// Elements before the first anchor get anchor 0's offset.
	if (relX <= anchors[0]) {
		return relX + anchorOffsets[0] + barlinePadAt(relX, relBarXs, barlineOffsets)
	}
	// Elements after the last anchor get the last anchor's offset.
	if (relX >= anchors[anchors.length - 1]) {
		return relX + anchorOffsets[anchors.length - 1] + barlinePadAt(relX, relBarXs, barlineOffsets)
	}

	// Find the bracket: the two anchors surrounding relX.
	var lo = 0
	for (var i = 0; i < anchors.length - 1; i++) {
		if (relX >= anchors[i] && relX < anchors[i + 1]) {
			lo = i
			break
		}
	}

	// Snap to nearest anchor's offset (piecewise-constant).
	// The jump between offsets[lo] and offsets[lo+1] occurs at the
	// midpoint of the gap, so note-unit elements clustered near their
	// anchor all receive the same offset.
	var gapStart = anchors[lo]
	var gapEnd = anchors[lo + 1]
	var mid = (gapStart + gapEnd) / 2
	var offset = relX < mid ? anchorOffsets[lo] : anchorOffsets[lo + 1]

	return relX + offset + barlinePadAt(relX, relBarXs, barlineOffsets)
}

/**
 * Get the cumulative barline padding at a given relX.
 */
function barlinePadAt(relX, relBarXs, barlineOffsets) {
	if (!relBarXs || relBarXs.length === 0) return 0
	var bIdx = -1
	for (var i = 0; i < relBarXs.length; i++) {
		if (relX >= relBarXs[i]) bIdx = i
		else break
	}
	return bIdx >= 0 ? barlineOffsets[bIdx] : 0
}

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

/**
 * Draw lyric continuation dashes between syllables of the same word.
 * Scans each stave's tokens for notes whose lyric text ends in '-' and
 * draws a centered dash between that note and the next lyric-bearing note.
 */
function layoutLyricDashes(drawing, staves) {
	var fs = getFontSize()
	var lyricFontSize = Math.round(fs * 0.38)

	for (var si = 0; si < staves.length; si++) {
		var tokens = staves[si].tokens
		if (!tokens) continue

		// Compute lyric Y offset for this stave (same logic as drawForNote)
		var thisStaveY = getStaffY(si)
		var nextStaveY = null
		for (var nsi = si + 1; nsi < staves.length; nsi++) {
			if (getStaffY(nsi) !== thisStaveY) {
				nextStaveY = getStaffY(nsi)
				break
			}
		}
		var lyricOffsetY
		if (nextStaveY !== null) {
			var gap = nextStaveY - thisStaveY
			lyricOffsetY = gap / 2 - fs / 2
		} else {
			lyricOffsetY = fs * 1.5
		}

		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i]
			// Only notes/chords with a hyphen-terminated lyric
			if (!token.text || !token.text.endsWith('-')) continue
			if (!token.drawingNoteHead) continue

			// Find the next note/chord with a drawingNoteHead (the next lyric target)
			var nextHead = null
			for (var j = i + 1; j < tokens.length; j++) {
				var nt = tokens[j]
				if (nt.drawingNoteHead && (nt.type === 'Note' || nt.type === 'Chord' || nt.type === 'Rest')) {
					nextHead = nt.drawingNoteHead
					break
				}
			}
			if (!nextHead) continue

			var startX = token.drawingNoteHead.x + (token.drawingNoteHead.width || 0)
			var endX = nextHead.x
			if (endX <= startX) continue

			var midX = (startX + endX) / 2

			var dash = new Text('-', 0, {
				font: lyricFontSize + "px Arial, 'Segoe UI', sans-serif",
				textAlign: 'center',
			})
			dash.moveTo(midX, thisStaveY)
			dash.offsetY = lyricOffsetY
			drawing.add(dash)
		}
	}
}

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
	/* Layout lyric continuation dashes (hyphens between syllables) */
	layoutLyricDashes(drawing, staves)

	// ---- Wrap mode: reflow into systems ----
	const isWrapMode = getLayoutMode() === 'wrap'

	if (isWrapMode) {
		scoreWrapLayout(drawing, data, staves, stavePointers, ctx, canvas)
	} else {
		scoreScrollLayout(drawing, data, staves, stavePointers, ctx, canvas)
	}
}

/**
 * Original single-line (scroll) layout — draws staves, brackets, braces, labels,
 * title/author, and sizes the spacer for horizontal scrolling.
 */
function scoreScrollLayout(drawing, data, staves, stavePointers, ctx, canvas) {
	var fs = getFontSize()

	/* Layout staves */
	// endingBar staff property → BarStyle mapping
	var endingBarStyles = [3, 7, 0, 1, 8] // SectionClose, MasterClose, Single, Double, Hidden
	stavePointers.forEach((cursor, staveIndex) => {
		addStave(cursor, staveIndex)

		// Draw the staff-level ending barline after the last measure
		var stave = staves[staveIndex]
		var ebStyle = endingBarStyles[stave.endingBar] ?? 0
		if (ebStyle !== 8) { // not hidden
			cursor.incStaveX(spacerWidth() * 2)
			var eb = new Barline(0, 8, ebStyle)
			cursor.posGlyph(eb)
			drawing.add(eb)

			// Connect ending barline between staves if appropriate
			// Skip if lyrics exist between staves (same logic as regular barlines)
			var hasEndLyrics = false
			for (var elsi = staveIndex; elsi < staves.length - 1; elsi++) {
				if (elsi > staveIndex && getStaffY(elsi) !== getStaffY(staveIndex)) break
				var elLyrics = staves[elsi].lyrics
				if (elLyrics && elLyrics.length && elLyrics.some(function(l) { return l && l.length > 0 })) {
					hasEndLyrics = true
					break
				}
			}
			var shouldConnectEnd = stave && !hasEndLyrics && staveIndex < staves.length - 1 && (
				stave.connectBarsWithNext ||
				((stave.layerWithNext || stave.bracketWithNext) && currentAllowLayering)
			)
			if (shouldConnectEnd) {
				var nextSi = staveIndex + 1
				while (nextSi < staves.length - 1 && getStaffY(nextSi) === getStaffY(staveIndex)) {
					nextSi++
				}
				let thisY = getStaffY(staveIndex) + getFontSize()
				let nextY = getStaffY(nextSi)
				if (nextY > thisY) {
					let barX = cursor.staveX
					let lw = ebStyle === 3 || ebStyle === 5 || ebStyle === 7
						? getFontSize() / 8 : getFontSize() / 24
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
		}

		maxCanvasWidth = Math.max(cursor.staveX + 100, maxCanvasWidth)
	})

	// draw braces/brackets
	var lastStaveY = getStaffY(stavePointers.length - 1)
	var bottom = lastStaveY + getFontSize() * 1.5

	maxCanvasHeight = bottom + 100

	drawBracketsAndBraces(drawing, staves, 0)
	drawStaffLabels(drawing, staves, 0)
	drawTitleAndAuthor(drawing, data, maxCanvasWidth)
	sizeSpacerAndRender(canvas, maxCanvasWidth, maxCanvasHeight)
}

/**
 * Multi-system (wrap) layout — reflows the single-line layout into wrapped
 * systems that fit the available canvas/page width.
 */
function scoreWrapLayout(drawing, data, staves, stavePointers, ctx, canvas) {
	var fs = getFontSize()
	var scoreElm = document.getElementById('score')

	// Determine the available page width (in score-space, before zoom).
	// Use the viewport width minus small margins.
	var zoom = getZoomLevel()
	var pageWidth = (scoreElm?.clientWidth || 800) / zoom - fs * 1.5

	// Calculate system height: distance from top of first stave to bottom
	// of last stave, plus some padding.
	var firstStaffY = getStaffY(0)
	var lastStaffY = getStaffY(staves.length - 1)
	var systemHeight = (lastStaffY - firstStaffY) + fs  // top-of-first to bottom-of-last

	var leftMargin = fs * 0.9  // space for brackets/braces/labels
	var interSystemGap = fs * 1.5  // vertical gap between systems

	// First, draw the ending barline on each stave in the single-line layout
	// (so it gets reflowed with everything else).
	var endingBarStyles = [3, 7, 0, 1, 8]
	stavePointers.forEach((cursor, staveIndex) => {
		// Add the final stave segment
		addStave(cursor, staveIndex)

		var stave = staves[staveIndex]
		var ebStyle = endingBarStyles[stave.endingBar] ?? 0
		if (ebStyle !== 8) {
			cursor.incStaveX(spacerWidth() * 2)
			var eb = new Barline(0, 8, ebStyle)
			cursor.posGlyph(eb)
			drawing.add(eb)
		}
	})

	// Track the single-line total width before reflow
	var singleLineWidth = 0
	stavePointers.forEach(cursor => {
		singleLineWidth = Math.max(cursor.staveX, singleLineWidth)
	})

	// Collect measure boundaries from barline positions on the first stave
	var boundaries = collectMeasureBoundaries(staves)

	// --- Collect running clef/key state for courtesy items ---
	var runningState = collectRunningState(staves)

	// Estimate courtesy width before computing breaks.  Systems > 0 will have
	// courtesy clef + key signature at the start, reducing the available width
	// for actual music content.  Use the state at the first barline as a
	// representative estimate (clef/key rarely changes mid-piece).
	var estimatedCourtesyWidth = 0
	if (boundaries.length > 0) {
		for (let si = 0; si < staves.length; si++) {
			var state = runningState[si][0]
			if (!state) continue
			var { totalWidth } = createCourtesyItems(
				state.clef, state.accidentals, state.clefForKey, 0
			)
			estimatedCourtesyWidth = Math.max(estimatedCourtesyWidth, totalWidth)
		}
		estimatedCourtesyWidth += spacerWidth()
	}

	// Compute system breaks using reduced page width that accounts for
	// courtesy items on systems > 0.
	var effectivePageWidth = pageWidth - estimatedCourtesyWidth
	var systemBreaks = computeSystemBreaks(boundaries, effectivePageWidth, leftMargin)

	// Build the break X list for the reflow
	var breakXs = systemBreaks.map(b => b.x)
	var systemCount = breakXs.length + 1

	// --- Remove single-line stave segments and Path objects (they'll be redrawn per-system) ---
	// Stave segments from the inline layout need to be redrawn per-system.
	// Path objects (barline connectors, etc.) use absolute coordinates in their
	// draw callbacks, so they can't be repositioned — remove and let per-system
	// bracket/brace drawing handle connectors.
	var toRemove = []
	for (const el of drawing.set) {
		if (el instanceof Stave || el instanceof Claire.Path) toRemove.push(el)
	}
	toRemove.forEach(s => drawing.remove(s))

	// For each system break, determine the exact courtesy width needed.
	var courtesyWidths = [0] // system 0: no courtesy
	for (let sysIdx = 1; sysIdx < systemCount; sysIdx++) {
		// The break before this system is breakXs[sysIdx-1], corresponding
		// to boundary index systemBreaks[sysIdx-1].boundaryIndex.
		// The running state at that boundary tells us the active clef/key.
		var breakBoundaryIdx = systemBreaks[sysIdx - 1].boundaryIndex
		var maxCourtesyWidth = 0
		for (let si = 0; si < staves.length; si++) {
			var state = runningState[si][breakBoundaryIdx]
			if (!state) continue
			var { totalWidth } = createCourtesyItems(
				state.clef, state.accidentals, state.clefForKey, 0
			)
			maxCourtesyWidth = Math.max(maxCourtesyWidth, totalWidth)
		}
		courtesyWidths.push(maxCourtesyWidth + spacerWidth())
	}

	// --- Compute per-system natural widths ---
	var systemNaturalWidths = []
	for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var sysEndX = sysIdx < breakXs.length ? breakXs[sysIdx] : singleLineWidth
		systemNaturalWidths.push(sysEndX - sysStartX)
	}

	// --- Collect all note/rest anchor positions (single-line coords) ---
	var allAnchors = collectAnchors(staves)

	// --- Build per-system barline maps for measure-level justification ---
	// Extra space is distributed both between and within measures:
	// - Within each measure, spacing between notes is stretched by up to
	//   MAX_INTRA_STRETCH so the score fills out evenly.
	// - Any remaining space that exceeds the cap is added at barline boundaries.
	var systemBarlineMaps = []
	for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var sysEndX = sysIdx < breakXs.length ? breakXs[sysIdx] : singleLineWidth
		var naturalWidth = systemNaturalWidths[sysIdx]
		var courtesyW = courtesyWidths[sysIdx]
		var contentWidth = pageWidth - courtesyW
		var isLastSystem = sysIdx === systemCount - 1
		var shouldJustify = !isLastSystem || (naturalWidth / contentWidth > 0.2)
		var extraSpace = shouldJustify ? contentWidth - naturalWidth : 0

		// Collect barline X positions within this system (relative to sysStartX)
		var relBarXs = []
		for (var bi = 0; bi < boundaries.length; bi++) {
			var bx = boundaries[bi].x
			if (bx > sysStartX && bx <= sysEndX) {
				relBarXs.push(bx - sysStartX)
			}
		}

		// Collect anchor positions within this system (relative to sysStartX)
		var relAnchors = allAnchors
			.filter(ax => ax >= sysStartX && ax <= sysEndX)
			.map(ax => ax - sysStartX)

		systemBarlineMaps.push(buildBarlineMap(relBarXs, extraSpace, relAnchors))
	}

	// --- Reflow all existing drawing elements into systems with justification ---
	for (const el of drawing.set) {
		// Skip elements without position (shouldn't happen, but be safe)
		if (el.x == null || el.y == null) continue

		// Determine which system this element belongs to based on original X
		let sysIdx = 0
		for (let i = 0; i < breakXs.length; i++) {
			if (el.x > breakXs[i]) sysIdx = i + 1
			else break
		}

		// Compute relative X within this system
		var systemStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var relX = el.x - systemStartX
		var courtesyW = courtesyWidths[sysIdx]
		var barlineMap = systemBarlineMaps[sysIdx]

		// Beam elements store relative startX/endX from their moveTo origin.
		// Both endpoints need independent justification so the beam spans
		// correctly after stretching.  Sub-beams may have non-zero startX.
		if (el.startX != null && el.endX != null) {
			// Recover absolute X positions of both beam endpoints
			var origStartAbsX = el.x + el.startX
			var origEndAbsX = el.x + el.endX
			var relStart = origStartAbsX - systemStartX
			var relEnd = origEndAbsX - systemStartX
			// Also justify the beam origin (el.x) itself
			var relOrigin = el.x - systemStartX

			var justOrigin = computeJustifyX(relOrigin, barlineMap) + leftMargin + courtesyW
			var justStart = computeJustifyX(relStart, barlineMap) + leftMargin + courtesyW
			var justEnd = computeJustifyX(relEnd, barlineMap) + leftMargin + courtesyW

			el.x = justOrigin
			el.startX = justStart - justOrigin
			el.endX = justEnd - justOrigin
		}
		// Tie elements store width = endx - startx.  Both endpoints may be
		// at different positions within the system, so recompute the width.
		else if (el.endx != null && el.width != null) {
			var origEndAbsX = el.x + el.width
			var relEnd = origEndAbsX - systemStartX

			el.x = computeJustifyX(relX, barlineMap) + leftMargin + courtesyW
			var justEnd = computeJustifyX(relEnd, barlineMap) + leftMargin + courtesyW
			el.width = justEnd - el.x
			el.endx = justEnd
		}
		else {
			el.x = computeJustifyX(relX, barlineMap) + leftMargin + courtesyW
		}

		// Shift Y: add the system's vertical offset
		var yShift = sysIdx * (systemHeight + interSystemGap)
		el.y = el.y + yShift

		// For Tie objects, also shift the absolute end-Y coordinate
		if (el.endy != null) {
			el.endy = el.endy + yShift
		}
	}

	// --- Draw per-system stave lines, brackets, braces, labels, and courtesy items ---
	for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var naturalWidth = systemNaturalWidths[sysIdx]
		var isLastSystem = sysIdx === systemCount - 1
		var courtesyW = courtesyWidths[sysIdx]
		var contentWidth = pageWidth - courtesyW
		var fillRatio = naturalWidth / contentWidth
		var justifiedWidth = (!isLastSystem || fillRatio > 0.2)
			? pageWidth : naturalWidth + courtesyW
		var yOffset = sysIdx * (systemHeight + interSystemGap)

		for (var si = 0; si < staves.length; si++) {
			var staveEl = new Stave(justifiedWidth)
			staveEl.moveTo(leftMargin, getStaffY(si) + yOffset)
			drawing.add(staveEl)
		}

		// Draw courtesy clef + key signature for systems after the first
		if (sysIdx > 0) {
			var breakBoundaryIdx = systemBreaks[sysIdx - 1].boundaryIndex
			for (var si = 0; si < staves.length; si++) {
				var state = runningState[si][breakBoundaryIdx]
				if (!state) continue
				var { elements } = createCourtesyItems(
					state.clef, state.accidentals, state.clefForKey,
					getStaffY(si) + yOffset
				)
				for (var cei = 0; cei < elements.length; cei++) {
					// Position courtesy items after the left margin
					elements[cei].x += leftMargin
					drawing.add(elements[cei])
				}
			}
		}

		// Draw brackets, braces, and labels for each system
		drawBracketsAndBraces(drawing, staves, yOffset, leftMargin)
		drawStaffLabels(drawing, staves, yOffset, leftMargin)
	}

	// Calculate canvas dimensions for wrapped layout
	var totalHeight = systemCount * (systemHeight + interSystemGap) + firstStaffY
	maxCanvasWidth = pageWidth + leftMargin + fs
	maxCanvasHeight = totalHeight + fs * 2

	drawTitleAndAuthor(drawing, data, maxCanvasWidth)
	sizeSpacerAndRender(canvas, maxCanvasWidth, maxCanvasHeight)
}

/**
 * Draw orchestral brackets and per-group braces at a given Y offset.
 * Brackets span from the first to last visible stave in each bracketWithNext
 * chain.  When allowLayering is on, adjacent bracket groups that are layered
 * onto the same Y are merged into one visual bracket spanning all of them.
 * Braces are drawn for chains of staves linked by braceWithNext.
 * Used once per system in wrap mode, once total in scroll mode.
 */
function drawBracketsAndBraces(drawing, staves, yOffset, leftMarginOverride) {
	var fs = getFontSize()
	var bracketX = leftMarginOverride !== undefined ? leftMarginOverride * 0.6 : fs * 0.55
	var braceX = leftMarginOverride !== undefined ? leftMarginOverride * 0.4 : fs * 0.35

	function visibleStaffY(si) {
		return getStaffY(si) + yOffset
	}

	// Collect unique visible Y positions for the system bracket.
	// A system bracket is drawn when there are multiple distinct visible stave
	// positions AND at least one bracketWithNext flag is set.
	var visibleYs = []
	var hasBracket = false
	for (var vi = 0; vi < staves.length; vi++) {
		var vy = visibleStaffY(vi)
		if (visibleYs.length === 0 || visibleYs[visibleYs.length - 1] !== vy) {
			visibleYs.push(vy)
		}
		if (staves[vi].bracketWithNext) hasBracket = true
	}

	if (hasBracket && visibleYs.length > 1) {
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

	// Draw per-group braces for braceWithNext chains
	for (var si = 0; si < staves.length; si++) {
		var stave = staves[si]
		if (stave.braceWithNext) {
			var endSi = si
			while (endSi < staves.length - 1 && staves[endSi].braceWithNext) {
				endSi++
			}
			let topY = visibleStaffY(si) - fs * 0.15
			let botY = visibleStaffY(endSi) + fs * 1.05
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
}

/**
 * Draw staff labels to the left of each visible stave.
 */
function drawStaffLabels(drawing, staves, yOffset, leftMarginOverride) {
	var fs = getFontSize()
	for (var li = 0; li < staves.length; li++) {
		var label = staves[li].staff_label || ''
		if (!label) continue
		// Skip duplicate labels for layered staves at the same Y
		if (li > 0 && getStaffY(li) === getStaffY(li - 1)) continue
		var labelY = getStaffY(li) + yOffset - fs * 0.5 // vertically centered on staff
		var labelX = leftMarginOverride !== undefined ? leftMarginOverride * 0.05 : fs * 0.05
		var labelDraw = new Claire.Text(label, 0, {
			font: Math.round(fs * 0.6) + "px Arial, 'Segoe UI', sans-serif",
			textAlign: 'left',
		})
		labelDraw.moveTo(labelX, labelY)
		drawing.add(labelDraw)
	}
}

/**
 * Draw title and author centered above the score.
 */
function drawTitleAndAuthor(drawing, data, canvasWidth) {
	var { title, author, copyright1, copyright2 } = data.info || {}

	var middle = canvasWidth / 2
	if (title) {
		const titleDrawing = new Claire.Text(title, 0, {
			font: "bold 20px Arial, 'Segoe UI', sans-serif",
			textAlign: 'center',
		})
		titleDrawing.moveTo(middle, 40)
		drawing.add(titleDrawing)
	}

	if (author) {
		const authorDrawing = new Claire.Text(author, 0, {
			font: "italic 14px Arial, 'Segoe UI', sans-serif",
			textAlign: 'center',
		})
		authorDrawing.moveTo(middle, 60)
		drawing.add(authorDrawing)
	}
	var footerEl = document.getElementById('footer')
	if (footerEl) footerEl.innerText = (copyright1 || '') + '\n' + (copyright2 || '')
}

/**
 * Size the invisible_canvas spacer and trigger the initial render.
 */
function sizeSpacerAndRender(canvas, canvasWidth, canvasHeight) {
	var invisible_canvas = document.getElementById('invisible_canvas')
	var scoreElm = document.getElementById('score')
	var zoom = getZoomLevel()
	invisible_canvas.style.width = `${canvasWidth * zoom}px`
	invisible_canvas.style.height = `${Math.max(
		canvasHeight * zoom,
		scoreElm.clientHeight
	)}px`

	if (canvas) {
		resizeToFit()
	}

	quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
}

// Computed Y positions for each stave, respecting WithNextStaff flags.
// Built once per score() call; consumed by getStaffY().
var staffYMap = []
var currentStaves = [] // reference to current staves array for handleToken
var currentAllowLayering = true // file-level allowLayering flag

function buildStaffYMap(staves, allowLayering) {
	var fs = getFontSize()
	var halfSpace = fs / 8  // 1 NWC staff position = half a space = fontSize/8 px
	var initialOffset = fs * 4
	var layerSpacing = 0               // layered staves overlap completely

	staffYMap = []
	var y = initialOffset
	for (var i = 0; i < staves.length; i++) {
		staffYMap[i] = y
		if (i >= staves.length - 1) continue
		var stave = staves[i]
		var nextStave = staves[i + 1]

		// Layered staves collapse to the same Y position.
		// layerWithNext is the explicit flag; bracketWithNext also triggers
		// layering when the file-level allowLayering is true (SATB choral scores).
		if ((stave.layerWithNext || stave.bracketWithNext) && allowLayering !== false) {
			y += layerSpacing
			continue
		}

		// Compute spacing from boundaries.
		// boundaryBottom = how far below the bottom staff line (positive, in half-spaces)
		// boundaryTop = how far above the top staff line (negative, in half-spaces)
		// Inter-stave gap = boundaryBottom[i] + |boundaryTop[i+1]|
		var botBound = stave.boundaryBottom || 0
		var topBound = nextStave.boundaryTop || 0
		// boundaryTop is stored as negative, so negate to get positive distance
		var gapHalfSpaces = botBound + Math.abs(topBound)

		if (gapHalfSpaces > 0) {
			y += gapHalfSpaces * halfSpace
		} else {
			// Fallback when boundaries are not set (both 0):
			// Use wider spacing if lyrics exist between these staves
			var hasLyrics = false
			for (var li = i; li >= 0; li--) {
				if (li < i && staffYMap[li] !== staffYMap[i]) break
				var stLyrics = staves[li].lyrics
				if (stLyrics && stLyrics.length && stLyrics.some(function(l) { return l && l.length > 0 })) {
					hasLyrics = true
					break
				}
			}
			y += hasLyrics ? fs * 5 : fs * 2.8
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
			token.drawingNoteHead = s  // reuse same field as notes for anchor collection

			cursor.incStaveX(s.width * 1)
			cursor.tokenPadRight(s.width * calculatePadding(token.durValue))
			break

		case 'Barline':
			s = new Barline(0, 8, token.barline || 0)
			cursor.posGlyph(s)
			s._text = info
			drawing.add(s)
			token.drawingBarline = s

			// Connect barlines to next staff if flagged
			// bracketWithNext or layerWithNext cause connection when allowLayering is on;
			// connectBarsWithNext always causes connection.
			// BUT skip connection when lyrics exist between the staves — the
			// barline would draw across the lyrics text which looks wrong.
			var staveData = currentStaves[staveIndex]
			var hasLyricsBetween = false
			if (staveData) {
				// Check if any staff at the current Y position (including layered) has lyrics
				for (var lsi = staveIndex; lsi < currentStaves.length - 1; lsi++) {
					if (lsi > staveIndex && getStaffY(lsi) !== getStaffY(staveIndex)) break
					var stLyrics = currentStaves[lsi].lyrics
					if (stLyrics && stLyrics.length && stLyrics.some(function(l) { return l && l.length > 0 })) {
						hasLyricsBetween = true
						break
					}
				}
			}
			var shouldConnect = staveData && !hasLyricsBetween && staveIndex < currentStaves.length - 1 && (
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
			// token.position is user-facing NWC convention (positive=above, 0=center).
			// Convert to rendering coords: pass -(pos + 4) so Text's internal
			// negation yields positionY(pos + 4)  — same mapping notes use.
			var pos = token.position !== undefined ? token.position : 11
			var text = new Text(token.text, -(pos + 4))
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'PerformanceStyle':
			var pos = token.position !== undefined ? token.position : 9
			var text = new Text(token.text, -(pos + 4), {
				font: "italic 11px Arial, 'Segoe UI', sans-serif",
			})
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Tempo':
			var pos = token.position !== undefined ? token.position : 11
			var text = new Text(
				`(${token.duration})`,
				-(pos + 4),
				{ font: "11px Arial, 'Segoe UI', sans-serif" }
			)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Dynamic':
			var pos = token.position !== undefined ? token.position : -13
			var text = new Text(token.dynamic, -(pos + 4), {
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
	// Use the individual note's duration if available (split-stem chords),
	// otherwise fall back to the chord/token-level duration.
	const duration = token.duration || durToken.duration
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
		// Strip trailing hyphens for display — NWC draws hyphens as dashes
		// centered between note positions, not on the syllable text itself.
		var displayText = token.text.replace(/-$/, '')
		if (displayText) {
			var lyricFontSize = Math.round(getFontSize() * 0.38)

			// Compute lyric Y to center in the gap between this staff and the
			// next non-layered staff below it.
			var staveIndex = cursor.staveIndex
			var thisStaveY = getStaffY(staveIndex)
			var nextStaveY = null
			for (var nsi = staveIndex + 1; nsi < currentStaves.length; nsi++) {
				if (getStaffY(nsi) !== thisStaveY) {
					nextStaveY = getStaffY(nsi)
					break
				}
			}
			var lyricOffsetY
			if (nextStaveY !== null) {
				// Center in the gap: midpoint between bottom of this staff and
				// top of next staff.  Bottom line = staveY, top line of next = nextStaveY - fs.
				var gap = nextStaveY - thisStaveY
				lyricOffsetY = gap / 2 - getFontSize() / 2
			} else {
				// No staff below — fall back to fixed offset
				lyricOffsetY = getFontSize() * 1.5
			}

			var text = new Text(displayText, 0, {
				font: lyricFontSize + "px Arial, 'Segoe UI', sans-serif",
				textAlign: 'left',
			})
			cursor.posGlyph(text)
			text.offsetY = lyricOffsetY
			drawing.add(text)
		}
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

export { score, computeSystemBreaks, dpOptimalBreaks, computeBadness, buildBarlineMap, computeJustifyX }
