import { getFontSize, getZoomLevel, getLayoutMode, getPageDimensions, getPageMargins, getPageViewMode, getMusicTextFamily, getSpacingModel, getSpringDensity, getRodSpringBalance, getDurationProportionality } from '../constants.js'
import { layoutBeaming } from './beams.js'
import { layoutTies } from './ties.js'
import { resizeToFit, DynamicMarking, ArticulationMark, Hairpin, VoltaBracket, TupletBracket, Glyph, PartialTie, getCode, glyphPathGet } from '../drawing.js'
import { CLEF_LEFT_MARGIN, AFTER_CLEF_GAP, AFTER_KEYSIG_GAP, AFTER_TIMESIG_GAP, AFTER_BARLINE_GAP, BARLINE_NOTE_EXTRA, headerGap } from '../engraving-rules.js'

// based on nwc music json representation,
// attempt to convert them to symbols to be drawn.
// also make weak attempt to lay them out

// music json -> draw symbols. interpretation? translation? engrave? typeset? layout? drawing?

/**
 * TODOs
 * - triplets
 * - dynamics
 */
const X_STRETCH = 1.0

/**
 * StaveCursor keeps score of something ?
 */
class StaveCursor {
	constructor(stave, staveIndex) {
		this.tokenIndex = -1
		this.staveIndex = staveIndex
		// Left margin: scroll mode starts one fontSize from canvas edge;
		// wrap and page modes use 0 (reflow adds its own margins).
		var leftEdge = getLayoutMode() === 'scroll' ? getFontSize() : 0
		this.lastBarline = leftEdge
		// Stave-to-clef gap (standard engraving: 0.75 staff-space).
		this.staveX = leftEdge + getFontSize() * headerGap(CLEF_LEFT_MARGIN)
		this.stave = stave
		this.tokens = stave.tokens
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
		this._afterBarline = true
	}
}

import { TickTracker } from './tick-tracker.js'

const tickTracker = new TickTracker(X_STRETCH)
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
 * Build measure geometry from final barline positions after layout/reflow.
 * Returns a flat array of { startX, endX, topY, bottomY } — one entry per
 * measure.  Uses _systemGeometry to determine vertical bounds and the left
 * edge of the first measure in each system.
 *
 * Must be called AFTER _systemGeometry is populated and all barline drawing
 * objects have their final reflowed X/Y positions.
 */
function buildMeasureGeometry(staves) {
	if (!_systemGeometry || _systemGeometry.length === 0) return []

	const tokens = staves[0]?.tokens || []
	const fs = getFontSize()

	// Collect final barline positions and match each to a system
	const barlines = []
	for (var i = 0; i < tokens.length; i++) {
		var tok = tokens[i]
		if (tok.type !== 'Barline' || !tok.drawingBarline) continue

		var bx = tok.drawingBarline.x
		var by = tok.drawingBarline.y

		// Find the system this barline belongs to (compare Y with system bounds)
		var sysIdx = 0
		for (var si = 0; si < _systemGeometry.length; si++) {
			var sys = _systemGeometry[si]
			if (by >= sys.topY - fs * 2 && by <= sys.bottomY + fs * 2) {
				sysIdx = si
				break
			}
		}

		barlines.push({ x: bx, sysIdx: sysIdx })
	}

	if (barlines.length === 0) return []

	var measures = []
	var prevBarX = -1
	var prevSysIdx = -1

	for (var bi = 0; bi < barlines.length; bi++) {
		var bar = barlines[bi]
		var sys = _systemGeometry[bar.sysIdx]

		if (bar.sysIdx !== prevSysIdx) {
			// New system — first measure starts at the system's left stave edge
			prevBarX = sys.startX
			prevSysIdx = bar.sysIdx
		}

		measures.push({
			measureIndex: bi + 1,   // 1-based measure number
			startX: prevBarX,
			endX: bar.x,
			topY: sys.topY,
			bottomY: sys.bottomY,
		})

		prevBarX = bar.x
	}

	return measures
}

/**
 * Collect note/rest/chord X positions as anchor points for justification.
 * Returns an array of X positions (absolute, in single-line coords) sorted
 * in ascending order.  Merges across ALL staves so that anchors from any
 * staff contribute to justification.  Positions within 0.5px are deduplicated.
 */
function collectAnchors(staves) {
	var anchorSet = new Set()
	for (var si = 0; si < staves.length; si++) {
		var tokens = staves[si]?.tokens || []
		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i]
			if (token.drawingNoteHead && (token.type === 'Note' || token.type === 'Chord' || token.type === 'Rest')) {
				// Round to 0.5px to deduplicate positions that are effectively
				// the same (TickTracker aligns cross-staff, but floating-point
				// rounding can produce tiny differences).
				anchorSet.add(Math.round(token.drawingNoteHead.x * 2) / 2)
			}
		}
	}
	var anchors = Array.from(anchorSet)
	anchors.sort(function(a, b) { return a - b })
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
	// Stave-to-clef gap (matches initial system start)
	let x = getFontSize() * headerGap(CLEF_LEFT_MARGIN)

	// Courtesy clef
	const clef = clefFromString(clefStr)
	clef.moveTo(x, staffY)
	elements.push(clef)
	x += clef.width + getFontSize() * headerGap(AFTER_CLEF_GAP)

	// Courtesy key signature (only if there are accidentals)
	if (accidentals && accidentals.length > 0) {
		const keySig = new KeySignature(accidentals, clefForKey)
		keySig.moveTo(x, staffY)
		elements.push(keySig)
		x += (keySig.width || 0) + getFontSize() * headerGap(AFTER_KEYSIG_GAP)
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

/**
 * Two-pass line breaking refinement.
 *
 * After the first DP pass, checks how well each system fills its target width.
 * If any non-last system fills less than REFLOW_THRESHOLD (75%), the measure
 * widths are scaled down (using the median fill ratio) and the DP is re-run.
 * This produces line breaks that match the effective post-justification widths,
 * eliminating large gaps when rod/spring balance compresses spacing.
 *
 * @param {Array} boundaries - Original measure boundary array
 * @param {Array} firstBreaks - Break positions from pass 1
 * @param {number} pageWidth - Target content width
 * @param {number} leftMargin - Left margin width
 * @param {number} singleLineWidth - Total single-line layout width
 * @returns {Array} Possibly improved break positions
 */
const REFLOW_THRESHOLD = 0.75

function reflowIfSparse(boundaries, firstBreaks, pageWidth, leftMargin, singleLineWidth) {
	if (firstBreaks.length === 0) return firstBreaks

	var breakXs = firstBreaks.map(b => b.x)
	var systemCount = breakXs.length + 1

	// Compute fill ratios for non-last systems
	var ratios = []
	for (let sysIdx = 0; sysIdx < systemCount - 1; sysIdx++) {
		var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var sysEndX = breakXs[sysIdx]
		var naturalWidth = sysEndX - sysStartX
		if (pageWidth > 0) ratios.push(naturalWidth / pageWidth)
	}

	if (ratios.length === 0) return firstBreaks

	var worstRatio = Math.min(...ratios)

	// Only reflow if fill is clearly insufficient
	if (worstRatio >= REFLOW_THRESHOLD) return firstBreaks

	// Use median ratio as scale factor — more stable than worst or mean
	var sorted = [...ratios].sort((a, b) => a - b)
	var medianRatio = sorted[Math.floor(sorted.length / 2)]
	var scale = Math.max(0.3, Math.min(medianRatio, 0.95))

	// Scale boundary X positions and re-run DP.
	// The DP sees narrower measures → packs more per line.
	var scaledBoundaries = boundaries.map(b => ({
		...b,
		x: b.x * scale,
	}))

	var newBreaks = computeSystemBreaks(scaledBoundaries, pageWidth, leftMargin)

	// Map break X positions back to original (unscaled) coordinates.
	// The boundaryIndex is still valid since both arrays have the same length.
	return newBreaks.map(brk => ({
		...brk,
		x: boundaries[brk.boundaryIndex].x,
	}))
}

// Maximum stretch factor per gap between adjacent anchors (note positions).
// Keeps note spacing from becoming unnaturally wide.
const MAX_INTRA_STRETCH = 5.0

// ---------------------------------------------------------------------------
// Spring-Rod Spacing Model
// ---------------------------------------------------------------------------
// Ross/Gould duration-to-space ratios (quarter note = 1.0).
// Based on Ted Ross "Teach Yourself the Art of Music Engraving" and
// Elaine Gould "Behind Bars" — the standard professional engraving tables.
// Doubling duration adds ~40%, not 100% (logarithmic, not linear).
const ROSS_RATIOS = [
	[1/64, 0.35], [1/32, 0.45], [1/16, 0.55], [1/8, 0.70],
	[1/4, 1.00],  [3/8, 1.15],  [1/2, 1.40],  [3/4, 1.60],
	[1/1, 1.90],  [2/1, 2.20],
]

/**
 * Look up the Ross/Gould spring width for a given duration value.
 * Returns the ideal spring length in pixels (at current font size).
 * Quarter note = 0.75 * fontSize; other durations scale per Ross table.
 */
function rossSpringWidth(durValue) {
	var val = durValue ? durValue.value() : 0.25
	var ratio = ROSS_RATIOS[ROSS_RATIOS.length - 1][1] // default to longest
	for (var i = 0; i < ROSS_RATIOS.length; i++) {
		if (val <= ROSS_RATIOS[i][0]) {
			ratio = ROSS_RATIOS[i][1]
			break
		}
	}
	// Duration proportionality: interpolate between uniform (ratio=1) and
	// the Ross/Gould ratio.  At 0 all notes get same spring; at 1 standard
	// engraving; above 1 duration differences are exaggerated.
	var prop = getDurationProportionality()
	var effectiveRatio = 1.0 + (ratio - 1.0) * prop
	// Base unit: a quarter-note spring = springDensity * fontSize.
	return effectiveRatio * getFontSize() * getSpringDensity()
}

// Minimum spring factor — prevents notes from overlapping.
const SPRING_FACTOR_MIN = 0.2
// Maximum spring factor — prevents excessive stretching.
const SPRING_FACTOR_MAX = 5.0

/**
 * Build a spring justification map for one system.
 *
 * For each note/rest anchor in the system, we know:
 * - _rod: the rigid physical width of the note unit (notehead + accidental + dots + flag)
 * - _spring: the ideal elastic gap after the note (Ross/Gould table)
 *
 * We compute a single spring factor for the entire system that compresses
 * or stretches all springs uniformly to fill the target width.
 *
 * Returns { anchors, anchorOffsets, factor } or null if insufficient data.
 */
function buildSpringMap(staves, systemStartX, systemEndX, targetWidth) {
	// Collect rod/spring data from ALL staves.  For each anchor position
	// (beat), take the max rod across staves — the widest note unit at
	// that beat determines the minimum space.  Spring uses max too so
	// the longest duration at a beat drives the gap.
	var entryMap = {}  // key: rounded anchorX → { anchorX, rod, spring }
	for (var si = 0; si < staves.length; si++) {
		var tokens = staves[si]?.tokens || []
		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i]
			if (!token.drawingNoteHead) continue
			if (token.type !== 'Note' && token.type !== 'Chord' && token.type !== 'Rest') continue
			var ax = token.drawingNoteHead.x
			if (ax < systemStartX || ax > systemEndX) continue
			// Round to 0.5px to group cross-staff positions at the same beat
			var key = Math.round((ax - systemStartX) * 2) / 2
			var rod = token._rod || 0
			var spring = token._spring || getFontSize() * 0.75
			var existing = entryMap[key]
			if (!existing) {
				entryMap[key] = { anchorX: key, rod: rod, spring: spring }
			} else {
				// Take max rod and max spring across staves at the same beat
				existing.rod = Math.max(existing.rod, rod)
				existing.spring = Math.max(existing.spring, spring)
			}
		}
	}

	// Convert to sorted array
	var entries = Object.values(entryMap)
	entries.sort(function(a, b) { return a.anchorX - b.anchorX })
	if (entries.length < 2) return null

	var totalRods = 0
	var totalSprings = 0
	for (var i = 0; i < entries.length; i++) {
		totalRods += entries[i].rod
		totalSprings += entries[i].spring
	}

	// Natural width of this system's content (from the single-line layout)
	var naturalWidth = systemEndX - systemStartX

	// How much do springs need to grow (or shrink) to reach the target?
	// factor = 1.0 means springs stay at natural size.
	// factor > 1.0 means springs stretch (system was narrower than target).
	// factor < 1.0 means springs compress (system was wider than target).
	// We solve: naturalWidth + totalSprings * (factor - 1) = targetWidth
	//   => factor = 1 + (targetWidth - naturalWidth) / totalSprings
	var factor = totalSprings > 0
		? Math.max(SPRING_FACTOR_MIN, Math.min(SPRING_FACTOR_MAX,
			1.0 + (targetWidth - naturalWidth) / totalSprings))
		: 1.0

	// Build cumulative anchor offsets.
	// For each gap between consecutive anchors:
	//   naturalGap = distance in single-line layout
	//   springPortion = the spring of the left anchor's note (clamped to gap)
	//   rodPortion = naturalGap - springPortion (the non-spring part of the gap)
	//   newGap = rodPortion + springPortion * factor
	//   offset delta = newGap - naturalGap = springPortion * (factor - 1)
	//
	// First pass: compute effective total springs (after clamping to gap size).
	// This is needed because the factor formula assumes all spring length is
	// usable, but springs wider than their gap get clamped.
	// rodSpringBalance scales the spring portion: 0 = all rigid, 1 = natural, 2 = extra elastic.
	var balance = getRodSpringBalance()
	var effectiveSprings = 0
	for (var i = 1; i < entries.length; i++) {
		var naturalGap = entries[i].anchorX - entries[i - 1].anchorX
		var sp = entries[i - 1].spring * balance
		if (sp > naturalGap) sp = naturalGap
		effectiveSprings += sp
	}
	// Include trailing gap's spring
	var lastEntry = entries[entries.length - 1]
	var trailingNatural = naturalWidth - lastEntry.anchorX
	if (trailingNatural > 0) {
		var trailSp = lastEntry.spring * balance
		if (trailSp > trailingNatural) trailSp = trailingNatural
		effectiveSprings += trailSp
	}

	// Recompute factor using effective springs
	var factor = effectiveSprings > 0
		? Math.max(SPRING_FACTOR_MIN, Math.min(SPRING_FACTOR_MAX,
			1.0 + (targetWidth - naturalWidth) / effectiveSprings))
		: 1.0

	var anchors = []
	var anchorOffsets = [0]
	anchors.push(entries[0].anchorX)
	var cumOffset = 0
	for (var i = 1; i < entries.length; i++) {
		anchors.push(entries[i].anchorX)
		var naturalGap = entries[i].anchorX - entries[i - 1].anchorX
		var springPortion = entries[i - 1].spring * balance
		// Clamp springPortion to not exceed the natural gap
		if (springPortion > naturalGap) springPortion = naturalGap
		var rodPortion = naturalGap - springPortion
		var newGap = rodPortion + springPortion * factor
		cumOffset += (newGap - naturalGap)
		anchorOffsets.push(cumOffset)
	}

	// Add a virtual end anchor at the system boundary so that the last
	// note's spring is also stretched, pushing the trailing barline to
	// the right edge of the system.
	if (trailingNatural > 0) {
		var trailingSpring = lastEntry.spring * balance
		if (trailingSpring > trailingNatural) trailingSpring = trailingNatural
		var trailingRod = trailingNatural - trailingSpring
		var trailingNew = trailingRod + trailingSpring * factor
		var endOffset = cumOffset + (trailingNew - trailingNatural)
		anchors.push(naturalWidth)
		anchorOffsets.push(endOffset)
	}

	return { anchors, anchorOffsets, factor }
}

/**
 * Compute the spring-justified X position for an element.
 * Uses the same piecewise-constant snap as computeJustifyX — elements
 * near an anchor get that anchor's offset, keeping note units rigid.
 */
function springJustifyX(relX, springMap) {
	if (!springMap) return relX
	var { anchors, anchorOffsets } = springMap
	if (!anchors || anchors.length < 2) return relX

	// Before first anchor
	if (relX <= anchors[0]) {
		return relX + anchorOffsets[0]
	}
	// After last anchor
	if (relX >= anchors[anchors.length - 1]) {
		return relX + anchorOffsets[anchors.length - 1]
	}

	// Find bracket and snap to nearest anchor's offset
	var lo = 0
	for (var i = 0; i < anchors.length - 1; i++) {
		if (relX >= anchors[i] && relX < anchors[i + 1]) {
			lo = i
			break
		}
	}
	var mid = (anchors[lo] + anchors[lo + 1]) / 2
	var offset = relX < mid ? anchorOffsets[lo] : anchorOffsets[lo + 1]
	return relX + offset
}

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
	// Rod-spring balance scales the stretch cap: 0 = no stretch (all rigid),
	// 1.0 = default (5x cap), 2.0 = very elastic (9x cap).
	var balance = getRodSpringBalance()
	var effectiveMaxStretch = 1.0 + (MAX_INTRA_STRETCH - 1.0) * balance
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
		var maxExtra = gap * (effectiveMaxStretch - 1.0)
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
	
	// Fill with opaque background rather than clearRect (which leaves transparent
	// pixels that the ink bleed shader misinterprets as solid ink).
	// In page mode, use a gray background for the areas between pages; the
	// shader detects this gray and skips ink processing there.
	ctx.save()
	ctx.setTransform(1, 0, 0, 1, 0, 0)  // reset to device pixels for full-canvas fill
	ctx.fillStyle = _pageGeometry ? '#c8c8c8' : '#ffffff'
	ctx.fillRect(0, 0, canvas.width, canvas.height)
	ctx.restore()

	ctx.save()
	// Translate by screen-space scroll offset, then scale into score-space.
	// The transform chain is: DPR (from resize) → scroll translate → zoom scale.
	ctx.translate(x || 0, y || 0)
	var zoom = getZoomLevel()
	if (zoom !== 1) ctx.scale(zoom, zoom)
	// Draw page backgrounds (in page mode) before the score elements
	if (_pageGeometry) {
		_drawPageBackgrounds(ctx, _pageGeometry)
	}
	drawing.draw(ctx)
	// Draw playback highlights on top of the score (cursor + active notes).
	// The highlighter is set externally via setPlaybackHighlighter().
	if (_playbackHighlighter) {
		_playbackHighlighter.drawHighlights(ctx, _systemGeometry, _measureGeometry)
	}
	ctx.restore()

	// Post-processing: ink bleed / print emulation
	// Pass scroll offset (scaled to device pixels) and zoom so the paper
	// texture pins to score coordinates.
	if (_inkBleedRenderer && _inkBleedRenderer.enabled) {
		var dpr = canvas.width / (parseFloat(canvas.style.width) || canvas.width)
		var scrollX = -(x || 0) * dpr  // x is -scrollLeft; negate and scale to device px
		var scrollY = -(y || 0) * dpr
		_inkBleedRenderer.render(scrollX, scrollY, getZoomLevel(), !!_pageGeometry)
	}
}

window.quickDraw = quickDraw

// Ink bleed renderer — set externally via setInkBleedRenderer().
var _inkBleedRenderer = null

function setInkBleedRenderer(renderer) {
	_inkBleedRenderer = renderer
}

// Playback highlighter reference — set by main.js to allow quickDraw to
// paint highlights after the score without a circular import.
let _playbackHighlighter = null

// Page layout geometry — set by scorePageLayout(), read by quickDraw()
// to draw page backgrounds before the score elements.
let _pageGeometry = null

// System geometry — set by all layout modes, read by quickDraw() to pass
// to the playback highlighter for full-system cursor spanning.
// Array of { topY, bottomY, startX, endX } per system in absolute canvas coordinates.
let _systemGeometry = null

// Measure geometry — set by all layout modes after _systemGeometry is built.
// Flat array of { startX, endX, topY, bottomY } per measure, for bar highlighting.
let _measureGeometry = null

/** Register the playback highlighter so quickDraw can call drawHighlights(). */
function setPlaybackHighlighter(highlighter) {
	_playbackHighlighter = highlighter
}

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
			font: lyricFontSize + 'px ' + getMusicTextFamily(),
			textAlign: 'center',
		})

			dash.moveTo(midX, thisStaveY)
			dash.offsetY = lyricOffsetY
			drawing.add(dash)
		}
	}
}

/**
 * Draw triplet/tuplet brackets and numerals above groups of triplet notes.
 * Scans each stave's tokens for notes with triplet=1 (start) through
 * triplet=3 (end) and draws a bracket or numeral spanning the group.
 *
 * Engraving rules:
 * - Numeral "3" goes on the beam/stem side of the notes (not the notehead side).
 * - Fully beamed triplets: just the numeral, no bracket (the beam groups them).
 * - Unbeamed/mixed triplets (quarters, rests): bracket + numeral.
 * - Vocal staves with lyrics: numeral above to stay clear of lyrics.
 */
function layoutTripletBrackets(drawing, staves) {
	var fs = getFontSize()

	for (var si = 0; si < staves.length; si++) {
		var tokens = staves[si].tokens
		if (!tokens) continue

		// Check if this stave has lyrics (vocal music)
		var hasLyrics = staves[si].lyrics && staves[si].lyrics.length > 0
			&& staves[si].lyrics.some(function(l) { return l && l.length > 0 })

		var i = 0
		while (i < tokens.length) {
			var token = tokens[i]
			// Look for triplet start (triplet=1)
			if ((token.type === 'Note' || token.type === 'Chord' || token.type === 'Rest') &&
				token.triplet === 1) {

				// Collect all tokens in this triplet group
				var groupTokens = [token]
				var maxScan = Math.min(tokens.length, i + 20)
				for (var j = i + 1; j < maxScan; j++) {
					var nt = tokens[j]
					if (nt.type === 'Barline') break
					if ((nt.type === 'Note' || nt.type === 'Chord' || nt.type === 'Rest') &&
						nt.triplet) {
						groupTokens.push(nt)
						if (nt.triplet === 3) break
					}
				}

				// Find start/end noteheads for positioning
				var startHead = null, endHead = null
				for (var gi = 0; gi < groupTokens.length; gi++) {
					if (groupTokens[gi].drawingNoteHead) {
						if (!startHead) startHead = groupTokens[gi].drawingNoteHead
						endHead = groupTokens[gi].drawingNoteHead
					}
				}

				if (startHead && endHead) {
					var startX = startHead.x
					var endX = endHead.x + (endHead.width || 0)
					var spanW = endX - startX
					if (spanW > 0) {
						// Determine stem direction (check majority of notes in group)
						var upCount = 0, downCount = 0
						for (var gi = 0; gi < groupTokens.length; gi++) {
							var gt = groupTokens[gi]
							if (gt.type === 'Rest') continue
							if (gt.Stem === 'Up' || gt.stem === 1) upCount++
							else if (gt.Stem === 'Down' || gt.stem === 2) downCount++
							else if ((gt.position || 0) < 0) upCount++
							else downCount++
						}
						var stemUp = upCount >= downCount

						// Check if ALL notes in the group are beamed together.
						// Fully-beamed triplets get just the numeral; others get bracket + numeral.
						var allBeamed = groupTokens.length >= 2
						for (var gi = 0; gi < groupTokens.length; gi++) {
							var gt = groupTokens[gi]
							if (gt.type === 'Rest') { allBeamed = false; break }
							if (gt.duration < 8) { allBeamed = false; break }   // quarter or longer
							if (!gt.beam) { allBeamed = false; break }          // no beam marker
						}

						// Placement: numeral goes on the STEM side (beam side).
						// Exception: vocal staves with lyrics → always above to avoid lyrics.
						var above
						if (hasLyrics) {
							above = true  // vocal music: above to clear lyrics
						} else {
							above = stemUp  // stem side: stems up → above, stems down → below
						}

						// Compute bracket position from actual note extremes,
						// not a fixed staff position.  This ensures clearance
						// when notes sit above or below the staff.
						var maxRelPos = 0, minRelPos = 8
						for (var gi = 0; gi < groupTokens.length; gi++) {
							var gt = groupTokens[gi]
							if (gt.type === 'Rest') continue
							var pos = (gt.position || 0) + 4
							if (gt.type === 'Chord' && gt.notes) {
								for (var ci = 0; ci < gt.notes.length; ci++) {
									var cp = (gt.notes[ci].position || 0) + 4
									if (cp > maxRelPos) maxRelPos = cp
									if (cp < minRelPos) minRelPos = cp
								}
							}
							if (pos > maxRelPos) maxRelPos = pos
							if (pos < minRelPos) minRelPos = pos
						}

						// Stem extent (~3.5 staff spaces = 7 half-spaces)
						// Beamed groups: numeral sits close to the beam (~0.5sp = 1 half-space pad).
						// Unbeamed groups: bracket clears the notehead + bracket hook (~1sp = 2 half-space pad).
						var stemExtent = 7
						var bracketPad = allBeamed ? 1 : 2
						var bracketPos
						if (above) {
							bracketPos = maxRelPos + stemExtent + bracketPad
							if (bracketPos < 12) bracketPos = 12  // never closer than 1 space above top line
						} else {
							bracketPos = minRelPos - stemExtent - bracketPad
							if (bracketPos > -4) bracketPos = -4  // never closer than 0 below bottom line
						}
						var below = !above
						var bracket = new TupletBracket('3', spanW, below, allBeamed)
						bracket.moveTo(startX, getStaffY(si))
						bracket.positionY(bracketPos)
						drawing.add(bracket)
					}
				}
			}
			i++
		}
	}
}

/**
 * Split ties/slurs that cross system breaks into two partial arcs.
 * Called AFTER the reflow pass has repositioned all elements.
 *
 * Detection: after reflow, a cross-system tie will have its start and end
 * on different system Y positions.  The endY will be offset by at least
 * one system height from the startY.
 *
 * systemHeight — the vertical distance of one system (top staff to bottom + gap)
 * leftEdgeX — the X coordinate of the system left edge (for leading arcs)
 * rightEdgeXs — per-system right edge X (for trailing arcs), array indexed by system
 * systemYOffsets — per-system Y offset (for mapping Y back to system index)
 */
function splitCrossSystemTies(drawing, systemHeight, interSystemGap) {
	if (systemHeight <= 0) return

	var toRemove = []
	var toAdd = []
	var fs = getFontSize()
	var arcWidth = fs * 2  // width of the partial arc

	for (var el of drawing.set) {
		// Identify Tie/Slur objects: they have endx, endy, and width properties
		if (el.endx == null || el.endy == null || el.width == null) continue
		// Skip PartialTie objects (they don't have the same structure)
		if (el instanceof PartialTie) continue

		// Detect cross-system ties/slurs.
		// Primary: use stored system index from reflow pass.
		// Fallback: Y-distance heuristic for elements without _sysIdx.
		var isCrossSystem = false
		if (el._sysIdx != null) {
			// If the end Y is on a different system, the Y shift during
			// reflow only applied the *start* system's offset to endy,
			// so the two endpoints will be far apart in Y.
			var yDiff = Math.abs(el.endy - el.y)
			isCrossSystem = yDiff > systemHeight * 0.5
		} else {
			var yDiff = Math.abs(el.endy - el.y)
			isCrossSystem = yDiff > systemHeight * 0.8
		}

		if (!isCrossSystem) continue

		// This tie/slur crosses a system break.  Replace with two partial arcs.
		toRemove.push(el)
		var tieDir = el.direction || 1

		// Trailing arc: from the start note, curving to the right
		var trailing = new PartialTie(
			{ x: el.x, y: el.y, width: 0, offsetY: 0 },
			arcWidth, 'trailing', tieDir
		)
		// Override position — the synthetic glyph produces offset anchoring;
		// we want the exact position already computed for this tie/slur.
		trailing.x = el.x
		trailing.y = el.y

		// Leading arc: curving in from the left to the end note
		var leading = new PartialTie(
			{ x: el.endx, y: el.endy, width: 0, offsetY: 0 },
			arcWidth, 'leading', tieDir
		)
		leading.x = el.endx - arcWidth
		leading.y = el.endy

		toAdd.push(trailing)
		toAdd.push(leading)
	}

	for (var i = 0; i < toRemove.length; i++) drawing.remove(toRemove[i])
	for (var i = 0; i < toAdd.length; i++) drawing.add(toAdd[i])
}

/**
 * Adjust hairpin wedge widths to span from the DynamicVariance token to the next
 * dynamic-related token or the next barline.
 */
function layoutHairpinSpans(drawing, staves) {
	for (var si = 0; si < staves.length; si++) {
		var tokens = staves[si].tokens
		if (!tokens) continue

		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i]
			if (token.type !== 'DynamicVariance' || !token.drawingHairpin) continue

			var hp = token.drawingHairpin
			var startX = hp.x
			var fs = getFontSize()
			var gap = fs * 0.3  // horizontal gap between hairpin and adjacent markings

			// Find the end point: next Dynamic, DynamicVariance, or Barline
			var endX = startX + fs * 3  // default fallback
			for (var j = i + 1; j < tokens.length; j++) {
				var nt = tokens[j]
				if (nt.type === 'Dynamic' || nt.type === 'DynamicVariance') {
					if (nt.drawingHairpin) {
						// Next item is another hairpin — end just before it
						endX = nt.drawingHairpin.x - gap
					} else if (nt.drawingDynamic) {
						// Next item is a text dynamic (p, f, etc.) — end just before it
						endX = nt.drawingDynamic.x - gap
					} else {
						endX = startX + fs * 3
					}
					break
				}
				if (nt.type === 'Barline' && nt.drawingBarline) {
					endX = nt.drawingBarline.x - gap
					break
				}
				// Track the last note/chord position as a running fallback
				if ((nt.type === 'Note' || nt.type === 'Chord') && nt.drawingNoteHead) {
					endX = nt.drawingNoteHead.x + (nt.drawingNoteHead.width || 0)
				}
			}

			var newWidth = Math.max(endX - startX, fs * 1.5)
			hp.spanWidth = newWidth
			hp.width = newWidth
		}
	}
}

/**
 * Adjust volta bracket widths to span from the Ending token to the next
 * Ending token or the next barline (whichever comes first).
 */
function layoutVoltaSpans(drawing, staves) {
	// Volta brackets should use the first staff's tokens as reference since
	// endings are typically on staff 0 only (or duplicated).
	for (var si = 0; si < staves.length; si++) {
		var tokens = staves[si].tokens
		if (!tokens) continue

		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i]
			if (token.type !== 'Ending' || !token.drawingVolta) continue

			var volta = token.drawingVolta
			var startX = volta.x

			// Find end: next Ending or next Barline (after at least one barline)
			var endX = startX + getFontSize() * 4
			var barlineCount = 0
			for (var j = i + 1; j < tokens.length; j++) {
				var nt = tokens[j]
				if (nt.type === 'Ending') {
					// Next ending bracket starts — end before it
					if (nt.drawingVolta) {
						endX = nt.drawingVolta.x - getFontSize() * 0.2
					}
					break
				}
				if (nt.type === 'Barline' && nt.drawingBarline) {
					barlineCount++
					endX = nt.drawingBarline.x
					// Check if this barline is a repeat close (style 5 or 7)
					// or section close (style 3) — those end the volta
					var bStyle = nt.barline || 0
					if (bStyle === 3 || bStyle === 5 || bStyle === 7) {
						break
					}
				}
			}

			var newWidth = Math.max(endX - startX, getFontSize() * 2)
			volta.spanWidth = newWidth
			volta.width = newWidth
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
	var extents = computeStaffExtents(staves)
	buildStaffYMap(staves, data.score.allowLayering, extents)
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
	/* Layout triplet/tuplet brackets */
	layoutTripletBrackets(drawing, staves)
	/* Layout hairpin spans (adjust width to reach the next DynamicVariance or note) */
	layoutHairpinSpans(drawing, staves)
	/* Layout volta bracket spans */
	layoutVoltaSpans(drawing, staves)

	// ---- Wrap mode: reflow into systems ----
	const isWrapMode = getLayoutMode() === 'wrap'
	const isPageMode = getLayoutMode() === 'page'

	if (isPageMode) {
		scorePageLayout(drawing, data, staves, stavePointers, ctx, canvas)
	} else if (isWrapMode) {
		scoreWrapLayout(drawing, data, staves, stavePointers, ctx, canvas)
	} else {
		scoreScrollLayout(drawing, data, staves, stavePointers, ctx, canvas)
	}
}

/**
 * Check whether a token stream ends with a barline (i.e. the last barline
 * comes after all notes/rests).  Importers such as MusicXML and MuseScore
 * emit a closing barline token at the end of the last measure; when that is
 * present the layout code should not draw an additional ending barline from
 * the staff-level `endingBar` property.
 */
function hasTrailingBarline(tokens) {
	for (var i = tokens.length - 1; i >= 0; i--) {
		var t = tokens[i].type
		if (t === 'Barline') return true
		if (t === 'Note' || t === 'Rest' || t === 'Chord' || t === 'RestChord') return false
	}
	return false
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
		var stave = staves[staveIndex]
		var ebStyle = endingBarStyles[stave.endingBar] ?? 0
		var trailing = hasTrailingBarline(stave.tokens)

		if (trailing) {
			// Token stream already ends with a barline (MusicXML/MuseScore).
			// Snap cursor back to the barline, then nudge past the thick
			// line's right edge so the stave fully covers the barline.
			cursor.staveX = cursor.lastBarline + getFontSize() / 16
		} else if (ebStyle !== 8) { // not hidden
			// NWC-style: advance cursor and place ending barline, so the
			// subsequent addStave() extends the stave lines to meet it.
			cursor.incStaveX(spacerWidth() * 2)
			var eb = new Barline(0, 8, ebStyle)
			cursor.posGlyph(eb)
			drawing.add(eb)
			// Nudge past the barline's right edge
			cursor.incStaveX(getFontSize() / 16)

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

		// Draw the final stave segment — extends to the ending barline
		// position (or to the trailing barline for imported formats).
		addStave(cursor, staveIndex)

		maxCanvasWidth = Math.max(cursor.staveX + 100, maxCanvasWidth)
	})

	// draw braces/brackets
	var lastStaveY = getStaffY(stavePointers.length - 1)
	var bottom = lastStaveY + getFontSize() * 1.5

	maxCanvasHeight = bottom + 100

	// Clear page geometry (not in page mode)
	_pageGeometry = null

	// Build system geometry (single system for scroll mode)
	var firstStaffY = getStaffY(0)
	var staveStartX = fs  // StaveCursor starts at getFontSize() in scroll mode
	_systemGeometry = [{
		topY: firstStaffY - fs,
		bottomY: lastStaveY,
		startX: staveStartX,
		endX: maxCanvasWidth,
	}]

	// Build measure geometry from barline positions
	_measureGeometry = buildMeasureGeometry(staves)

	drawBracketsAndBraces(drawing, staves, 0)
	drawStaffLabels(drawing, staves, 0)
	drawBarNumbers(drawing, staves, 0, fs, 1, 'scroll')
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
		var stave = staves[staveIndex]
		var ebStyle = endingBarStyles[stave.endingBar] ?? 0
		var trailing = hasTrailingBarline(stave.tokens)

		if (trailing) {
			cursor.staveX = cursor.lastBarline + getFontSize() / 16
		} else if (ebStyle !== 8) {
			cursor.incStaveX(spacerWidth() * 2)
			var eb = new Barline(0, 8, ebStyle)
			cursor.posGlyph(eb)
			drawing.add(eb)
			cursor.incStaveX(getFontSize() / 16)
		}

		// Final stave segment extends to the ending/trailing barline
		addStave(cursor, staveIndex)
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

	// Two-pass refinement: if systems are poorly filled (large gaps from
	// spring compression), re-run DP with scaled widths to pack more bars.
	systemBreaks = reflowIfSparse(boundaries, systemBreaks, effectivePageWidth, leftMargin, singleLineWidth)

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
		var shouldJustify = !isLastSystem
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

	// --- Build per-system spring maps (if spring-rod spacing is active) ---
	var useSpring = getSpacingModel() === 'spring'
	var systemSpringMaps = []
	if (useSpring) {
		for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
			var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
			var sysEndX = sysIdx < breakXs.length ? breakXs[sysIdx] : singleLineWidth
			var courtesyW = courtesyWidths[sysIdx]
			var contentWidth = pageWidth - courtesyW
			var isLastSystem = sysIdx === systemCount - 1
			var naturalWidth = systemNaturalWidths[sysIdx]
			var shouldJustify = !isLastSystem
			systemSpringMaps.push(shouldJustify
				? buildSpringMap(staves, sysStartX, sysEndX, contentWidth)
				: null)
		}
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

		// Choose justification function: spring-rod or legacy anchor-gap
		var springMap = useSpring ? systemSpringMaps[sysIdx] : null
		var justify = springMap
			? function(rx) { return springJustifyX(rx, springMap) }
			: function(rx) { return computeJustifyX(rx, barlineMap) }

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

			var justOrigin = justify(relOrigin) + leftMargin + courtesyW
			var justStart = justify(relStart) + leftMargin + courtesyW
			var justEnd = justify(relEnd) + leftMargin + courtesyW

			el.x = justOrigin
			el.startX = justStart - justOrigin
			el.endX = justEnd - justOrigin
		}
		// Tie elements store width = endx - startx.  Both endpoints may be
		// at different positions within the system, so recompute the width.
		else if (el.endx != null && el.width != null) {
			var origEndAbsX = el.x + el.width
			var relEnd = origEndAbsX - systemStartX

			el.x = justify(relX) + leftMargin + courtesyW
			var justEnd = justify(relEnd) + leftMargin + courtesyW
			el.width = justEnd - el.x
			el.endx = justEnd
			// Store system index for cross-system tie/slur detection
			el._sysIdx = sysIdx
		}
		else {
			el.x = justify(relX) + leftMargin + courtesyW
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
		var justifiedWidth = isLastSystem
			? naturalWidth + courtesyW : pageWidth
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

		// Draw bar number at system start
		var firstMeasure = sysIdx === 0 ? 1 : systemBreaks[sysIdx - 1].boundaryIndex + 2
		drawBarNumbers(drawing, staves, yOffset, leftMargin, firstMeasure)
	}

	// Calculate canvas dimensions for wrapped layout
	var totalHeight = systemCount * (systemHeight + interSystemGap) + firstStaffY
	maxCanvasWidth = pageWidth + leftMargin + fs
	maxCanvasHeight = totalHeight + fs * 2

	// Split ties/slurs that cross system breaks into partial arcs
	splitCrossSystemTies(drawing, systemHeight, interSystemGap)

	// Clear page geometry (not in page mode)
	_pageGeometry = null

	// Build system geometry for playback cursor spanning
	_systemGeometry = []
	for (var gi = 0; gi < systemCount; gi++) {
		var gYOffset = gi * (systemHeight + interSystemGap)
		var sysNatWidth = systemNaturalWidths[gi]
		var sysCourtW = courtesyWidths[gi]
		var isLastSys = gi === systemCount - 1
		var sysJustW = isLastSys ? sysNatWidth + sysCourtW : pageWidth
		_systemGeometry.push({
			topY: firstStaffY + gYOffset - fs,
			bottomY: lastStaffY + gYOffset,
			startX: leftMargin,
			endX: leftMargin + sysJustW,
		})
	}

	// Build measure geometry from barline positions
	_measureGeometry = buildMeasureGeometry(staves)

	drawTitleAndAuthor(drawing, data, maxCanvasWidth)
	sizeSpacerAndRender(canvas, maxCanvasWidth, maxCanvasHeight)
}

/**
 * Draw page background rectangles (white pages with drop shadows on gray).
 * Called from quickDraw() before drawing.draw(ctx).
 */
function _drawPageBackgrounds(ctx, pg) {
	var shadowOffset = 4
	var shadowColor = 'rgba(0,0,0,0.25)'

	// Viewport culling — skip pages entirely outside the visible area.
	var zoom = getZoomLevel()
	var scoreElm = document.getElementById('score')
	var viewTop = (scoreElm?.scrollTop || 0) / zoom
	var viewBottom = viewTop + (scoreElm?.clientHeight || 800) / zoom
	var viewLeft = (scoreElm?.scrollLeft || 0) / zoom
	var viewRight = viewLeft + (scoreElm?.clientWidth || 800) / zoom
	var pad = 50  // extra padding to avoid pop-in

	for (var p = 0; p < pg.pageCount; p++) {
		var pos = pg.pagePositions[p]

		if (pos.y + pg.pageHeight < viewTop - pad) continue
		if (pos.y > viewBottom + pad) continue
		if (pos.x + pg.pageWidth < viewLeft - pad) continue
		if (pos.x > viewRight + pad) continue

		// Drop shadow
		ctx.fillStyle = shadowColor
		ctx.fillRect(pos.x + shadowOffset, pos.y + shadowOffset, pg.pageWidth, pg.pageHeight)

		// White page
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(pos.x, pos.y, pg.pageWidth, pg.pageHeight)
	}
}

/**
 * Page layout — renders the score onto fixed-size pages (Letter or A4) with
 * margins, page breaks, and a PDF-viewer appearance.
 *
 * Reuses the wrap-mode horizontal line-breaking algorithm, then assigns
 * systems to pages based on available vertical space.
 */
function scorePageLayout(drawing, data, staves, stavePointers, ctx, canvas) {
	var fs = getFontSize()
	var pageDim = getPageDimensions()
	var margins = getPageMargins()

	var PAGE_W = pageDim.width
	var PAGE_H = pageDim.height
	var contentW = PAGE_W - margins.left - margins.right
	var contentH = PAGE_H - margins.top - margins.bottom

	// Calculate system height (same as wrap mode)
	var firstStaffY = getStaffY(0)
	var lastStaffY = getStaffY(staves.length - 1)
	var systemHeight = (lastStaffY - firstStaffY) + fs
	var interSystemGap = fs * 1.5
	var leftMargin = margins.left

	// --- Draw ending barlines (same as wrap mode) ---
	var endingBarStyles = [3, 7, 0, 1, 8]
	stavePointers.forEach((cursor, staveIndex) => {
		var stave = staves[staveIndex]
		var ebStyle = endingBarStyles[stave.endingBar] ?? 0
		var trailing = hasTrailingBarline(stave.tokens)

		if (trailing) {
			cursor.staveX = cursor.lastBarline + getFontSize() / 16
		} else if (ebStyle !== 8) {
			cursor.incStaveX(spacerWidth() * 2)
			var eb = new Barline(0, 8, ebStyle)
			cursor.posGlyph(eb)
			drawing.add(eb)
			cursor.incStaveX(getFontSize() / 16)
		}

		addStave(cursor, staveIndex)
	})

	var singleLineWidth = 0
	stavePointers.forEach(cursor => {
		singleLineWidth = Math.max(cursor.staveX, singleLineWidth)
	})

	// --- Horizontal line breaking (reuse wrap mode algorithm) ---
	var boundaries = collectMeasureBoundaries(staves)
	var runningState = collectRunningState(staves)

	// Estimate courtesy width
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

	var effectiveContentW = contentW - estimatedCourtesyWidth
	var systemBreaks = computeSystemBreaks(boundaries, effectiveContentW, leftMargin)

	// Two-pass refinement: same as wrap mode
	systemBreaks = reflowIfSparse(boundaries, systemBreaks, effectiveContentW, leftMargin, singleLineWidth)

	var breakXs = systemBreaks.map(b => b.x)
	var systemCount = breakXs.length + 1

	// --- Remove single-line stave segments and Path objects ---
	var toRemove = []
	for (const el of drawing.set) {
		if (el instanceof Stave || el instanceof Claire.Path) toRemove.push(el)
	}
	toRemove.forEach(s => drawing.remove(s))

	// --- Per-system courtesy widths ---
	var courtesyWidths = [0]
	for (let sysIdx = 1; sysIdx < systemCount; sysIdx++) {
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

	// --- Per-system natural widths ---
	var systemNaturalWidths = []
	for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var sysEndX = sysIdx < breakXs.length ? breakXs[sysIdx] : singleLineWidth
		systemNaturalWidths.push(sysEndX - sysStartX)
	}

	// --- Collect anchors and build per-system barline maps (same as wrap) ---
	var allAnchors = collectAnchors(staves)
	var systemBarlineMaps = []
	for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var sysEndX = sysIdx < breakXs.length ? breakXs[sysIdx] : singleLineWidth
		var naturalWidth = systemNaturalWidths[sysIdx]
		var courtesyW = courtesyWidths[sysIdx]
		var sysContentW = contentW - courtesyW
		var isLastSystem = sysIdx === systemCount - 1
		var shouldJustify = !isLastSystem
		var extraSpace = shouldJustify ? sysContentW - naturalWidth : 0

		var relBarXs = []
		for (var bi = 0; bi < boundaries.length; bi++) {
			var bx = boundaries[bi].x
			if (bx > sysStartX && bx <= sysEndX) {
				relBarXs.push(bx - sysStartX)
			}
		}

		var relAnchors = allAnchors
			.filter(ax => ax >= sysStartX && ax <= sysEndX)
			.map(ax => ax - sysStartX)

		systemBarlineMaps.push(buildBarlineMap(relBarXs, extraSpace, relAnchors))
	}

	// --- Build per-system spring maps (if spring-rod spacing is active) ---
	var useSpringPage = getSpacingModel() === 'spring'
	var systemSpringMapsPage = []
	if (useSpringPage) {
		for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
			var sysStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
			var sysEndX = sysIdx < breakXs.length ? breakXs[sysIdx] : singleLineWidth
			var courtesyW = courtesyWidths[sysIdx]
			var sysContentW = contentW - courtesyW
			var isLastSystem = sysIdx === systemCount - 1
			var naturalWidth = systemNaturalWidths[sysIdx]
			var shouldJustify = !isLastSystem
			systemSpringMapsPage.push(shouldJustify
				? buildSpringMap(staves, sysStartX, sysEndX, sysContentW)
				: null)
		}
	}

	// --- Assign systems to pages ---
	// Title/author consumes space on page 1
	var fs = getFontSize()
	var titleHeight = 0
	if (data.info?.title) titleHeight += Math.round(fs * 1.07)
	if (data.info?.author) titleHeight += Math.round(fs * 0.71)
	if (titleHeight > 0) titleHeight += Math.round(fs * 0.54)  // gap after title block

	var pages = []        // [{systemStart, systemEnd}]
	var currentPage = 0
	var currentPageY = titleHeight  // start after title on page 1
	var pageStart = 0

	for (var sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var sysH = systemHeight
		// Would this system fit on the current page?
		if (currentPageY + sysH > contentH && sysIdx > pageStart) {
			// Finish current page
			pages.push({ systemStart: pageStart, systemEnd: sysIdx - 1 })
			currentPage++
			currentPageY = 0
			pageStart = sysIdx
		}
		currentPageY += sysH + interSystemGap
	}
	// Last page
	pages.push({ systemStart: pageStart, systemEnd: systemCount - 1 })
	var pageCount = pages.length

	// --- Compute page positions based on page view mode ---
	var interPageGap = 24
	var horizontalPad = 40
	var viewMode = getPageViewMode()

	// Compute {x, y} for each page's top-left corner
	var pagePositions = new Array(pageCount)
	var totalCanvasWidth, totalCanvasHeight

	if (viewMode === 'horizontal') {
		// Left-to-right: all pages in a single horizontal row
		for (var pi = 0; pi < pageCount; pi++) {
			pagePositions[pi] = {
				x: interPageGap + pi * (PAGE_W + interPageGap),
				y: interPageGap,
			}
		}
		totalCanvasWidth = pageCount * (PAGE_W + interPageGap) + interPageGap
		totalCanvasHeight = PAGE_H + interPageGap * 2
	} else if (viewMode === 'two-up') {
		// Side-by-side pairs: 2 pages per row
		var pagesPerRow = 2
		var rowWidth = pagesPerRow * PAGE_W + (pagesPerRow + 1) * interPageGap
		for (var pi = 0; pi < pageCount; pi++) {
			var col = pi % pagesPerRow
			var row = Math.floor(pi / pagesPerRow)
			pagePositions[pi] = {
				x: interPageGap + col * (PAGE_W + interPageGap),
				y: interPageGap + row * (PAGE_H + interPageGap),
			}
		}
		totalCanvasWidth = rowWidth
		var rowCount = Math.ceil(pageCount / pagesPerRow)
		totalCanvasHeight = rowCount * (PAGE_H + interPageGap) + interPageGap
	} else if (viewMode === 'single-page') {
		// Single-page: only one page visible at a time.
		// Layout all pages at the same position (they'll be shown one at a
		// time via clipping in quickDraw). Canvas sized for one page.
		for (var pi = 0; pi < pageCount; pi++) {
			pagePositions[pi] = {
				x: horizontalPad,
				y: interPageGap + pi * (PAGE_H + interPageGap),
			}
		}
		totalCanvasWidth = PAGE_W + horizontalPad * 2
		// Size for all pages so internal layout is consistent, but the
		// viewport will be constrained to one page in quickDraw/scrolling.
		totalCanvasHeight = pageCount * (PAGE_H + interPageGap) + interPageGap
	} else {
		// 'vertical' (default): pages stacked vertically with free scrolling
		for (var pi = 0; pi < pageCount; pi++) {
			pagePositions[pi] = {
				x: horizontalPad,
				y: interPageGap + pi * (PAGE_H + interPageGap),
			}
		}
		totalCanvasWidth = PAGE_W + horizontalPad * 2
		totalCanvasHeight = pageCount * (PAGE_H + interPageGap) + interPageGap
	}

	// --- Compute per-system absolute position ---
	// systemXOffsets[i] = the X offset to add to all elements in system i
	// (relative to the default horizontalPad assumption)
	var systemYOffsets = new Array(systemCount)
	var systemXOffsets = new Array(systemCount)
	for (var pi = 0; pi < pageCount; pi++) {
		var page = pages[pi]
		var pos = pagePositions[pi]
		var pageContentY = pos.y + margins.top
		var localY = (pi === 0) ? titleHeight : 0

		for (var si = page.systemStart; si <= page.systemEnd; si++) {
			systemYOffsets[si] = pageContentY + localY
			// X offset: difference between this page's x and the default horizontalPad
			systemXOffsets[si] = pos.x - horizontalPad
			localY += systemHeight + interSystemGap
		}
	}

	// --- Reflow drawing elements ---
	for (const el of drawing.set) {
		if (el.x == null || el.y == null) continue

		let sysIdx = 0
		for (let i = 0; i < breakXs.length; i++) {
			if (el.x > breakXs[i]) sysIdx = i + 1
			else break
		}

		var systemStartX = sysIdx === 0 ? 0 : breakXs[sysIdx - 1]
		var relX = el.x - systemStartX
		var courtesyW = courtesyWidths[sysIdx]
		var barlineMap = systemBarlineMaps[sysIdx]
		var xPageShift = systemXOffsets[sysIdx]

		// Choose justification function: spring-rod or legacy anchor-gap
		var springMapP = useSpringPage ? systemSpringMapsPage[sysIdx] : null
		var justifyP = springMapP
			? function(rx) { return springJustifyX(rx, springMapP) }
			: function(rx) { return computeJustifyX(rx, barlineMap) }

		// X justification
		if (el.startX != null && el.endX != null) {
			var origStartAbsX = el.x + el.startX
			var origEndAbsX = el.x + el.endX
			var relStart = origStartAbsX - systemStartX
			var relEnd = origEndAbsX - systemStartX
			var relOrigin = el.x - systemStartX

			var justOrigin = justifyP(relOrigin) + leftMargin + courtesyW + horizontalPad + xPageShift
			var justStart = justifyP(relStart) + leftMargin + courtesyW + horizontalPad + xPageShift
			var justEnd = justifyP(relEnd) + leftMargin + courtesyW + horizontalPad + xPageShift

			el.x = justOrigin
			el.startX = justStart - justOrigin
			el.endX = justEnd - justOrigin
		} else if (el.endx != null && el.width != null) {
			var origEndAbsX = el.x + el.width
			var relEnd = origEndAbsX - systemStartX

			el.x = justifyP(relX) + leftMargin + courtesyW + horizontalPad + xPageShift
			var justEnd = justifyP(relEnd) + leftMargin + courtesyW + horizontalPad + xPageShift
			el.width = justEnd - el.x
			el.endx = justEnd
			// Store system index for cross-system tie/slur detection
			el._sysIdx = sysIdx
		} else {
			el.x = justifyP(relX) + leftMargin + courtesyW + horizontalPad + xPageShift
		}

		// Y: offset from single-line staff Y to absolute page position
		var yShift = systemYOffsets[sysIdx] - firstStaffY
		el.y = el.y + yShift

		if (el.endy != null) {
			el.endy = el.endy + yShift
		}
	}

	// --- Draw per-system stave lines, brackets, braces, labels, courtesy items ---
	for (let sysIdx = 0; sysIdx < systemCount; sysIdx++) {
		var naturalWidth = systemNaturalWidths[sysIdx]
		var isLastSystem = sysIdx === systemCount - 1
		var courtesyW = courtesyWidths[sysIdx]
		var justifiedWidth = isLastSystem
			? naturalWidth + courtesyW : contentW
		var yOffset = systemYOffsets[sysIdx] - firstStaffY
		var xBase = leftMargin + horizontalPad + systemXOffsets[sysIdx]

		for (var si = 0; si < staves.length; si++) {
			var staveEl = new Stave(justifiedWidth)
			staveEl.moveTo(xBase, getStaffY(si) + yOffset)
			drawing.add(staveEl)
		}

		// Courtesy clef + key signature
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
					elements[cei].x += xBase
					drawing.add(elements[cei])
				}
			}
		}

		drawBracketsAndBraces(drawing, staves, yOffset, xBase)
		drawStaffLabels(drawing, staves, yOffset, xBase)

		// Draw bar number at system start
		var firstMeasureP = sysIdx === 0 ? 1 : systemBreaks[sysIdx - 1].boundaryIndex + 2
		drawBarNumbers(drawing, staves, yOffset, xBase, firstMeasureP)
	}

	// --- Title and author on page 1 ---
	var page1Pos = pagePositions[0]
	var page1TopY = page1Pos.y + margins.top
	var titleCenterX = page1Pos.x + PAGE_W / 2
	var titleFs = getFontSize()
	if (data.info?.title) {
		const titleDraw = new Claire.Text(data.info.title, 0, {
			font: 'bold ' + Math.round(titleFs * 0.71) + 'px ' + getMusicTextFamily(),
			textAlign: 'center',
		})
		titleDraw.moveTo(titleCenterX, page1TopY + Math.round(titleFs * 0.36))
		drawing.add(titleDraw)
	}
	if (data.info?.author) {
		const authorDraw = new Claire.Text(data.info.author, 0, {
			font: 'italic ' + Math.round(titleFs * 0.50) + 'px ' + getMusicTextFamily(),
			textAlign: 'center',
		})
		authorDraw.moveTo(titleCenterX, page1TopY + Math.round(titleFs * 1.07))
		drawing.add(authorDraw)
	}

	// --- Footer ---
	var { copyright1, copyright2 } = data.info || {}

	// In page mode, render copyright on the canvas at the bottom of page 1
	// instead of in the DOM footer (which is used for scroll/wrap modes).
	var copyrightText = [copyright1, copyright2].filter(Boolean).join(' \u2014 ')
	if (copyrightText) {
		var copyrightDraw = new Claire.Text(copyrightText, 0, {
			font: Math.round(titleFs * 0.32) + 'px ' + getMusicTextFamily(),
			textAlign: 'center',
		})
		// Position in the bottom margin of page 1, above the page number
		copyrightDraw.moveTo(titleCenterX, page1Pos.y + PAGE_H - margins.bottom * 0.55)
		drawing.add(copyrightDraw)
	}

	// --- Page numbers ---
	var pageNumFont = Math.round(titleFs * 0.36) + 'px ' + getMusicTextFamily()
	for (var pi = 0; pi < pageCount; pi++) {
		var pos = pagePositions[pi]
		var pageNumDraw = new Claire.Text(String(pi + 1), 0, {
			font: pageNumFont,
			textAlign: 'center',
		})
		// Position at bottom center of each page, in the margin area
		pageNumDraw.moveTo(pos.x + PAGE_W / 2, pos.y + PAGE_H - margins.bottom * 0.3)
		drawing.add(pageNumDraw)
	}

	// Clear DOM footer in page mode (content is on the canvas)
	var footerEl = document.getElementById('footer')
	if (footerEl) footerEl.innerText = ''

	// --- Store page geometry for quickDraw background rendering ---
	_pageGeometry = {
		pageCount,
		pageWidth: PAGE_W,
		pageHeight: PAGE_H,
		interPageGap,
		horizontalPad,
		pagePositions,
	}
	// Expose for single-page navigation in main.js
	window._pageGeometry = _pageGeometry

	// Build system geometry for playback cursor spanning
	_systemGeometry = []
	for (var gi = 0; gi < systemCount; gi++) {
		var sysNatWidthP = systemNaturalWidths[gi]
		var sysCourtWP = courtesyWidths[gi]
		var isLastSysP = gi === systemCount - 1
		var sysJustWP = isLastSysP ? sysNatWidthP + sysCourtWP : contentW
		var sysXBase = leftMargin + horizontalPad + systemXOffsets[gi]
		// After reflow, first staff bottom line is at systemYOffsets[gi]
		_systemGeometry.push({
			topY: systemYOffsets[gi] - fs,
			bottomY: systemYOffsets[gi] + (lastStaffY - firstStaffY),
			startX: sysXBase,
			endX: sysXBase + sysJustWP,
		})
	}

	// Build measure geometry from barline positions
	_measureGeometry = buildMeasureGeometry(staves)

	// --- Canvas sizing ---
	maxCanvasWidth = totalCanvasWidth
	maxCanvasHeight = totalCanvasHeight

	// Split ties/slurs that cross system breaks into partial arcs
	splitCrossSystemTies(drawing, systemHeight, interSystemGap)

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
	var sysBarX = leftMarginOverride !== undefined ? leftMarginOverride : fs * 0.9
	var bracketX = leftMarginOverride !== undefined ? leftMarginOverride * 0.6 : fs * 0.55

	function visibleStaffY(si) {
		return getStaffY(si) + yOffset
	}

	// Collect unique visible Y positions
	var visibleYs = []
	var hasBracket = false
	for (var vi = 0; vi < staves.length; vi++) {
		var vy = visibleStaffY(vi)
		if (visibleYs.length === 0 || visibleYs[visibleYs.length - 1] !== vy) {
			visibleYs.push(vy)
		}
		if (staves[vi].bracketWithNext) hasBracket = true
	}

	// System barline: a thin vertical line at the left edge connecting the
	// top of the first staff to the bottom of the last staff.  Drawn for
	// any score with 2+ distinct visible stave positions.
	if (visibleYs.length > 1) {
		let sysTopY = visibleYs[0] - fs                  // top line of first staff
		let sysBotY = visibleYs[visibleYs.length - 1]    // bottom line of last staff
		let sysLw = fs / 14
		var sysBarline = new Claire.Path(function(ctx) {
			ctx.beginPath()
			ctx.lineWidth = sysLw
			ctx.moveTo(sysBarX, sysTopY)
			ctx.lineTo(sysBarX, sysBotY)
			ctx.stroke()
		})
		drawing.add(sysBarline)
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
	var braceChar = getCode('brace')
	for (var si = 0; si < staves.length; si++) {
		var stave = staves[si]
		if (stave.braceWithNext) {
			var endSi = si
			while (endSi < staves.length - 1 && staves[endSi].braceWithNext) {
				endSi++
			}
			let topY = visibleStaffY(si) - fs     // top line of first staff
			let botY = visibleStaffY(endSi)        // bottom line of last staff
			let braceH = botY - topY

			// Render the SMuFL brace glyph, scaled vertically to span the
			// staff group.  The glyph is measured at a reference size, then a
			// Y scale is computed to stretch it to the required height.
			var refSize = fs * 4  // reference rendering size
			var refPath = glyphPathGet(braceChar, refSize)
			var bbox = refPath.getBoundingBox()
			var designH = bbox.y2 - bbox.y1
			if (designH <= 0) {
				// Fallback if bounding box is invalid
				si = endSi
				continue
			}
			var yScale = braceH / designH
			// Keep X proportional but cap to prevent overly wide braces
			var xScale = Math.min(yScale, 1.5)

			// Position brace so its right edge (tips) sits just left of the
			// system barline / stave left edge.  LilyPond uses 0.3 sp padding.
			var braceRightEdge = bbox.x2 * xScale
			var bracePadding = fs * 0.075   // 0.3 staff-spaces
			var braceTipX = sysBarX - braceRightEdge - bracePadding

			var brace = new Claire.Path(function(ctx) {
				ctx.save()
				ctx.translate(braceTipX, topY - bbox.y1 * yScale)
				ctx.scale(xScale, yScale)
				ctx.fillStyle = '#000'
				refPath.draw(ctx)
				ctx.restore()
			})
			drawing.add(brace)

			si = endSi  // skip past the chain
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
			font: Math.round(fs * 0.6) + 'px ' + getMusicTextFamily(),
			textAlign: 'left',
		})
		labelDraw.moveTo(labelX, labelY)
		drawing.add(labelDraw)
	}
}

/**
 * Draw bar/measure numbers above the first staff.
 * In multi-system modes, draws the first measure number of each system.
 * In scroll mode, draws a number above every barline.
 *
 * @param {Drawing} drawing
 * @param {Array} staves
 * @param {number} yOffset - Y shift for this system
 * @param {number} leftMarginX - X position for the system start number
 * @param {number} firstMeasureNum - 1-based measure number of the first bar in this system
 * @param {string} [mode] - 'scroll' for every-bar numbers, otherwise system-start only
 */
function drawBarNumbers(drawing, staves, yOffset, leftMarginX, firstMeasureNum, mode) {
	var fs = getFontSize()
	var numY = getStaffY(0) + yOffset - fs * 1.1  // above the top staff
	var numFont = Math.round(fs * 0.36) + 'px ' + getMusicTextFamily()

	// Always draw the first measure number at the system start
	if (firstMeasureNum > 1) {
		var numDraw = new Claire.Text(String(firstMeasureNum), 0, {
			font: numFont,
			textAlign: 'left',
		})
		numDraw.moveTo(leftMarginX, numY)
		drawing.add(numDraw)
	}

	// In scroll mode, also draw numbers above every barline
	if (mode === 'scroll') {
		var tokens = staves[0]?.tokens || []
		// Find the last note/rest/chord — barlines after it are closing
		// barlines (e.g. SectionClose) that don't start a new measure.
		var lastNoteIdx = -1
		for (var li = tokens.length - 1; li >= 0; li--) {
			var lt = tokens[li].type
			if (lt === 'Note' || lt === 'Rest' || lt === 'Chord' || lt === 'RestChord') {
				lastNoteIdx = li
				break
			}
		}
		var barNum = 1
		for (var i = 0; i < tokens.length; i++) {
			var tok = tokens[i]
			if (tok.type !== 'Barline' || !tok.drawingBarline) continue
			if (i > lastNoteIdx) break  // trailing barline — no new measure
			barNum++
			var bx = tok.drawingBarline.x
			var barNumDraw = new Claire.Text(String(barNum), 0, {
				font: numFont,
				textAlign: 'center',
			})
			barNumDraw.moveTo(bx, numY)
			drawing.add(barNumDraw)
		}
	}
}

/**
 * Draw title and author centered above the score.
 */
function drawTitleAndAuthor(drawing, data, canvasWidth) {
	var { title, author, copyright1, copyright2 } = data.info || {}

	var middle = canvasWidth / 2
	var fs = getFontSize()
	if (title) {
		const titleDrawing = new Claire.Text(title, 0, {
			font: 'bold ' + Math.round(fs * 0.71) + 'px ' + getMusicTextFamily(),
			textAlign: 'center',
		})
		titleDrawing.moveTo(middle, Math.round(fs * 1.43))
		drawing.add(titleDrawing)
	}

	if (author) {
		const authorDrawing = new Claire.Text(author, 0, {
			font: 'italic ' + Math.round(fs * 0.50) + 'px ' + getMusicTextFamily(),
			textAlign: 'center',
		})
		authorDrawing.moveTo(middle, Math.round(fs * 2.14))
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

/**
 * Estimate per-staff content extents from token data (before full layout).
 * Returns an array of { minPos, maxPos } in NWC staff position units
 * (0 = bottom line, 8 = top line; negative = below staff, >8 = above staff).
 *
 * Estimates stem length as ~7 half-spaces from the notehead (one octave).
 * Accounts for dynamics below and tempo/flow marks above.
 */
function computeStaffExtents(staves) {
	var extents = []
	for (var si = 0; si < staves.length; si++) {
		var minPos = 0   // bottom staff line
		var maxPos = 8   // top staff line
		var tokens = staves[si].tokens || []

		for (var ti = 0; ti < tokens.length; ti++) {
			var tok = tokens[ti]

			if (tok.type === 'Note' || tok.type === 'Rest') {
				var pos = tok.position || 0
				minPos = Math.min(minPos, pos)
				maxPos = Math.max(maxPos, pos)
				// Estimate stem tip: ~7 half-spaces from notehead
				if (tok.type === 'Note') {
					var stemUp = pos < 4  // stem up if below middle line
					var stemTip = stemUp ? pos + 7 : pos - 7
					minPos = Math.min(minPos, stemTip)
					maxPos = Math.max(maxPos, stemTip)
				}
			}

			if (tok.type === 'Chord' && tok.notes) {
				var chordMin = Infinity, chordMax = -Infinity
				for (var ni = 0; ni < tok.notes.length; ni++) {
					var npos = tok.notes[ni].position || 0
					chordMin = Math.min(chordMin, npos)
					chordMax = Math.max(chordMax, npos)
				}
				if (chordMin < Infinity) {
					minPos = Math.min(minPos, chordMin)
					maxPos = Math.max(maxPos, chordMax)
					// Chord stem direction: up if lowest note is further from
					// middle line than highest; one octave from the stem-side note
					var stemUp = (4 - chordMin) >= (chordMax - 4)
					var stemTip = stemUp ? chordMax + 7 : chordMin - 7
					minPos = Math.min(minPos, stemTip)
					maxPos = Math.max(maxPos, stemTip)
				}
			}

			// Dynamics and hairpins extend below the staff
			if (tok.type === 'Dynamic' || tok.type === 'DynamicVariance') {
				minPos = Math.min(minPos, -9)
			}

			// Tempo, flow marks, and voltas extend above
			if (tok.type === 'Tempo' || tok.type === 'Flow' || tok.type === 'TempoVariance') {
				maxPos = Math.max(maxPos, 15)
			}
			if (tok.type === 'Ending') {
				maxPos = Math.max(maxPos, 16)
			}
		}

		// Account for lyrics below the staff (if present)
		var stLyrics = staves[si].lyrics
		if (stLyrics && stLyrics.length && stLyrics.some(function(l) { return l && l.length > 0 })) {
			minPos = Math.min(minPos, -10)
		}

		extents.push({ minPos: minPos, maxPos: maxPos })
	}
	return extents
}

function buildStaffYMap(staves, allowLayering, extents) {
	var fs = getFontSize()
	var halfSpace = fs / 8  // 1 NWC staff position = half a space = fontSize/8 px
	var initialOffset = fs * 4
	var layerSpacing = 0               // layered staves overlap completely
	var padding = fs * 0.6             // minimum clearance between content extents

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

		var gapPixels = 0
		if (gapHalfSpaces > 0) {
			gapPixels = gapHalfSpaces * halfSpace
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
			gapPixels = hasLyrics ? fs * 5 : fs * 2.8
		}

		// Dynamic spacing: if content extents are provided, ensure the gap
		// is large enough that content from adjacent staves doesn't overlap.
		// minPos (lowest position on staff i, negative = below staff) and
		// maxPos (highest position on staff i+1, positive = above staff)
		// are in half-space units.  The needed gap is the distance between
		// the lowest point of staff i and the highest point of staff i+1.
		if (extents && extents[i] && extents[i + 1]) {
			var contentGap = (extents[i + 1].maxPos - extents[i].minPos) * halfSpace + padding
			gapPixels = Math.max(gapPixels, contentGap)
		}

		y += gapPixels
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
	// Store staff index on the token for playback highlight lookups
	token.staffIndex = staveIndex

	// info = tokenIndex
	// info = absCounter++ + ' : ' + tokenIndex
	let info = ''
	const staveY = getStaffY(staveIndex)

	const type = token.type
	let t, s

	// console.log('handleToken', token)
	const isBarline = type === 'Barline'
	if (isBarline) {
		tickTracker.alignBarline(token, cursor)
	} else {
		tickTracker.alignWithMax(token, cursor)
	}

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
			cursor.incStaveX(clef.width + getFontSize() * headerGap(AFTER_CLEF_GAP))
			cursor._afterBarline = false
			break

		case 'TimeSignature':
			const sig = token.signature

			var name =
				sig === 'AllaBreve' ? 'CutCommon' : sig === 'Common' ? 'Common' : ''

			if (name) {
				t = new TimeSignature(name, 4)
				cursor.posGlyph(t)
				drawing.add(t)

				cursor.incStaveX(t.width + getFontSize() * headerGap(AFTER_TIMESIG_GAP))
			} else if (token.group && token.beat) {
				// Numeric time signature: stack numerator (top) and denominator (bottom)
				// Both glyphs share the same x position — they are vertically stacked.
				const numerator   = new TimeSignature(token.group, 6)   // upper staff half
				const denominator = new TimeSignature(token.beat,  2)   // lower staff half

				cursor.posGlyph(numerator)
				cursor.posGlyph(denominator)  // same x — intentionally stacked
				drawing.add(numerator)
				drawing.add(denominator)

				cursor.incStaveX(numerator.width + getFontSize() * headerGap(AFTER_TIMESIG_GAP))
			}

			cursor._afterBarline = false
			break
		case 'KeySignature':
			const key = new KeySignature(token.accidentals, token.clef)
			cursor.posGlyph(key)
			drawing.add(key)

			// Only add gap when key signature has visible accidentals;
			// C major (no accidentals, width=0) should not consume space.
			if (key.width > 0) {
				cursor.incStaveX(key.width + getFontSize() * headerGap(AFTER_KEYSIG_GAP))
			}
			cursor._afterBarline = false
			break

		case 'Rest':
			// BARLINE_NOTE_EXTRA is now absorbed into the barline's own gap,
			// so no separate _afterBarline indent is needed here.
			cursor._afterBarline = false

			var duration = token.duration
			var sym = {
				1: 'restWhole',
				2: 'restHalf',
				4: 'restQuarter',
				8: 'rest8th',
				16: 'rest16th',
				32: 'rest32nd',
				64: 'rest64th',
			}[duration]

			if (!sym) console.log('FAIL REST', token, duration)

			s = new Glyph(sym, token.position + 4) // + 4
			cursor.posGlyph(s)
			s._text = info
			drawing.add(s)
			token.drawingNoteHead = s  // reuse same field as notes for anchor collection

			cursor.incStaveX(s.width * 1)
			cursor.tokenPadRight(s.width * calculatePadding(token.durValue))

			// Record rod/spring for spring-rod model
			token._rod = s.width
			token._spring = rossSpringWidth(token.durValue)
			break

		case 'Barline':
			s = new Barline(0, 8, token.barline || 0)
			cursor.posGlyph(s)
			s._text = info
			drawing.add(s)
			token.drawingBarline = s

			// Save the X where the barline LINE was drawn (pre-gap).
			var barlineDrawnX = cursor.staveX

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
				// Draw a single continuous barline from the top of this staff
				// to the bottom of the next staff (standard grand staff engraving).
				let topY = getStaffY(staveIndex) - getFontSize()  // top line of this staff
				let botY = getStaffY(nextSi)                       // bottom line of next staff
				if (botY > topY) {
					let barX = cursor.staveX
					let lw = getFontSize() / 24
					var connPath = new Claire.Path(function(ctx) {
						ctx.beginPath()
						ctx.lineWidth = lw
						ctx.moveTo(barX, topY)
						ctx.lineTo(barX, botY)
						ctx.stroke()
					})
					drawing.add(connPath)
				}
			}

			addStave(cursor, staveIndex)
			cursor.updateBarline()
			// Total gap after barline: AFTER_BARLINE_GAP + BARLINE_NOTE_EXTRA.
			// We absorb BARLINE_NOTE_EXTRA into the barline's own cursor
			// advancement so the TickTracker registers the position where the
			// first note will actually land.  Without this, a staff with an
			// extra barline would register a position that is BARLINE_NOTE_EXTRA
			// short of where its notes sit, causing notes on other staves
			// (which align via TickTracker) to be offset to the left.
			cursor.incStaveX(getFontSize() * (AFTER_BARLINE_GAP + BARLINE_NOTE_EXTRA))

			// Dual registration: barline line position (for barline-to-barline
			// alignment) and post-gap position (for note alignment).
			tickTracker.addBarline(token, barlineDrawnX, cursor.staveX)
			break

		case 'Chord':
			// BARLINE_NOTE_EXTRA is now absorbed into the barline's own gap.
			cursor._afterBarline = false

			// --- Detect seconds and compute notehead offsets ---
			// When two chord notes are a second apart (adjacent positions),
			// one notehead must be displaced to the other side of the stem.
			// For consecutive seconds, displacements alternate (toggle).
			//
			// Algorithm (matches VexFlow/MuseScore):
			//   Stems UP:   walk bottom-to-top.  First note = default (left).
			//   Stems DOWN: walk top-to-bottom.   First note = default (right).
			//   For each note, if it's a second from the previous:
			//     toggle `displaced`.  Otherwise reset to false.
			//   Displaced notes shift: right (+1) for stems up, left (-1) for stems down.
			{
				// Stem direction must match beams.js handleChord():
				// use sum of extreme positions (average of top+bottom note).
				var sortedNotes = [...token.notes].sort((a, b) => a.position - b.position)
				var chordTopPos = sortedNotes[sortedNotes.length - 1].position
				var chordBotPos = sortedNotes[0].position
				var chordStemUp = token.Stem === 'Up' || token.stem === 1 ? true :
				                  token.Stem === 'Down' || token.stem === 2 ? false :
				                  (chordTopPos + chordBotPos < 0)
				for (var ni = 0; ni < sortedNotes.length; ni++) {
					sortedNotes[ni]._chordOffsetX = 0
				}
				var displaced = false
				var lastPos = undefined
				var displacedDir = chordStemUp ? 1 : -1
				// Stems up: walk bottom-to-top (ascending).
				// Stems down: walk top-to-bottom (descending).
				var start = chordStemUp ? 0 : sortedNotes.length - 1
				var end = chordStemUp ? sortedNotes.length : -1
				var step = chordStemUp ? 1 : -1
				for (var ni = start; ni !== end; ni += step) {
					var pos = sortedNotes[ni].position
					if (lastPos !== undefined) {
						var diff = Math.abs(pos - lastPos)
						if (diff === 1) {
							displaced = !displaced  // toggle for each second
						} else {
							displaced = false        // reset for larger intervals
						}
					}
					lastPos = pos
					if (displaced) {
						sortedNotes[ni]._chordOffsetX = displacedDir
					}
				}
			}

			let tmp = cursor.staveX
			token.notes.forEach((note) => {
				cursor.staveX = tmp
				drawForNote(note, cursor, token, true)  // skip ledger — consolidated below
				// Apply second-displacement offset to the drawn notehead
				if (note._chordOffsetX && note.drawingNoteHead) {
					var nhW = note.drawingNoteHead.width
					note.drawingNoteHead.offsetX = (note.drawingNoteHead.offsetX || 0) + note._chordOffsetX * nhW
					// Shift accidental with the notehead so it stays attached
					if (note.drawingAccidental) {
						note.drawingAccidental.offsetX += note._chordOffsetX * nhW
					}
				}
			})
			// Account for rightward-displaced noteheads in chord width.
			// If any note was shifted right (seconds), the chord needs extra width.
			var hasRightDisplacement = token.notes.some(n => n._chordOffsetX > 0)
			// Consolidated ledger lines for the chord: compute the full
			// range across all notes and create a single Ledger per side.
			cursor.staveX = tmp
			var chordPositions = token.notes.map(n => n.position + 4)
			var chordMinPos = Math.min.apply(null, chordPositions)
			var chordMaxPos = Math.max.apply(null, chordPositions)
			var chordNhWidth = (token.notes[0] && token.notes[0].drawingNoteHead)
				? token.notes[0].drawingNoteHead.width : getFontSize() * 0.3
			// Effective width: add a notehead width when seconds are displaced
			var chordEffectiveWidth = chordNhWidth + (hasRightDisplacement ? chordNhWidth : 0)
			if (chordMinPos < 0) {
				var chordLedgerStart = ((chordMinPos / 2) | 0) * 2
				if (chordLedgerStart < 0) {
					var ledgerBelow = new Ledger(chordLedgerStart, 0, chordNhWidth)
					cursor.posGlyph(ledgerBelow)
					drawing.add(ledgerBelow)
				}
			}
			if (chordMaxPos > 8) {
				var chordLedgerEnd = Math.floor(chordMaxPos / 2) * 2
				if (chordLedgerEnd >= 10) {
					var ledgerAbove = new Ledger(10, chordLedgerEnd + 2, chordNhWidth)
					cursor.posGlyph(ledgerAbove)
					drawing.add(ledgerAbove)
				}
			}
			// Set parent chord's drawingNoteHead for slur/highlight anchoring.
			// Use the first child's notehead (ties use per-child noteheads directly).
			if (token.notes.length > 0 && token.notes[0].drawingNoteHead) {
				token.drawingNoteHead = token.notes[0].drawingNoteHead
			}

			// --- Chord-level articulations (drawn once, not per child note) ---
			{
				// Use same stem direction as seconds detection and beams.js
				var chordArtStemUp = chordStemUp
				// Use the outermost note on the notehead side:
				//   stem up → articulation below → anchor to lowest note
				//   stem down → articulation above → anchor to highest note
				var artAnchorPos = chordArtStemUp ? chordMinPos : chordMaxPos
				var artNoteHead = token.notes[0] && token.notes[0].drawingNoteHead
				var artNhWidth = artNoteHead ? artNoteHead.width : chordNhWidth
				var artNhX = artNoteHead ? artNoteHead.x : tmp

				var chordArtFlags = ['staccato', 'accent', 'tenuto', 'marcato', 'staccatissimo', 'fermata']
				var chordArtOffset = 0
				for (var cai = 0; cai < chordArtFlags.length; cai++) {
					var caf = chordArtFlags[cai]
					if (!token[caf]) continue
					var cabove = caf === 'fermata' ? true : !chordArtStemUp
					var caPos = cabove
						? artAnchorPos + 2 + chordArtOffset * 2
						: artAnchorPos - 2 - chordArtOffset * 2
					if (isOnLine(caPos)) caPos += cabove ? 1 : -1
					var cam = new ArticulationMark(caf, caPos)
					cursor.posGlyph(cam)
					cam.offsetX = artNhX - cam.x + (artNhWidth - cam.width) / 2
					drawing.add(cam)
					chordArtOffset++
				}
			}
			// Widen the chord's rod when seconds cause notehead displacement
			if (hasRightDisplacement && token._rod) {
				token._rod += chordNhWidth
			}
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
				font: 'italic ' + Math.round(getFontSize() * 0.39) + 'px ' + getMusicTextFamily(),
			})
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Tempo':
			var pos = token.position !== undefined ? token.position : 11
			var text = new Text(
				`(${token.duration})`,
				-(pos + 4),
				{ font: Math.round(getFontSize() * 0.39) + 'px ' + getMusicTextFamily() }
			)
			cursor.posGlyph(text)
			drawing.add(text)
			break
		case 'Dynamic':
			var pos = token.position !== undefined ? token.position : -13
			var dynGlyph = new DynamicMarking(token.dynamic, pos + 4)
			cursor.posGlyph(dynGlyph)
			drawing.add(dynGlyph)
			token.drawingDynamic = dynGlyph
			break

		case 'DynamicVariance':
			// Hairpin wedges (crescendo/diminuendo) and text markings (rfz, sfz)
			var dvStyles = ['Crescendo', 'Decrescendo', 'Diminuendo', 'Rinforzando', 'Sforzando']
			var dvStyleName = dvStyles[token.style] || 'Crescendo'
			var dvPos = token.position !== undefined ? token.position : -13
			if (dvStyleName === 'Crescendo' || dvStyleName === 'Decrescendo' || dvStyleName === 'Diminuendo') {
				// Hairpin wedge — estimate span width based on font size
				// Real span would need the next note's X, but for initial layout
				// we use a fixed width that gets stretched during justification.
				var hpWidth = getFontSize() * 3
				var hp = new Hairpin(dvStyleName, hpWidth, dvPos + 4)
				cursor.posGlyph(hp)
				drawing.add(hp)
				// Store reference for span calculation in post-layout
				token.drawingHairpin = hp
			} else {
				// Rinforzando / Sforzando — render as dynamic text
				var dynText = dvStyleName === 'Rinforzando' ? 'rfz' : 'sfz'
				var dvGlyph = new DynamicMarking(dynText, dvPos + 4)
				cursor.posGlyph(dvGlyph)
				drawing.add(dvGlyph)
			}
			break

		case 'Ending':
			// Volta brackets (1st/2nd endings).
			// token.repeat is a bitmask: bit 0 = ending 1, bit 1 = ending 2, etc.
			// token.style controls the bracket appearance.
			var endingNums = []
			for (var ebi = 0; ebi < 8; ebi++) {
				if (token.repeat & (1 << ebi)) endingNums.push(ebi + 1)
			}
			var endingText = endingNums.join(', ') + '.'
			// Style: 0 = open (no right hook), 1 = closed (right hook)
			var endingClosed = token.style === 1
			var voltaWidth = getFontSize() * 4  // initial width, adjusted during reflow
			var voltaPos = 12  // above the staff
			var volta = new VoltaBracket(endingText, voltaWidth, endingClosed, voltaPos + 4)
			cursor.posGlyph(volta)
			drawing.add(volta)
			token.drawingVolta = volta
			break

		case 'Flow':
			// Flow directions: Coda, Segno, Fine, D.C., D.S., etc.
			// These are placed above the staff at the current X position.
			// They do NOT advance the cursor — they are non-spacing markers
			// that sit above the note/barline at the same beat position.
			var flowStyles = ['Coda', 'Segno', 'Fine', 'To Coda', 'D.C.', 'D.C. al Coda', 'D.C. al Fine', 'D.S.', 'D.S. al Coda', 'D.S. al Fine']
			var flowStyleName = flowStyles[token.style] || 'Coda'
			var flowPos = token.position !== undefined ? token.position : 11
			if (flowStyleName === 'Coda' || flowStyleName === 'Segno') {
				// Render as SMuFL glyph
				var flowGlyphName = flowStyleName === 'Coda' ? 'coda' : 'segno'
				var flowGlyph = new Glyph(flowGlyphName, flowPos + 4)
				cursor.posGlyph(flowGlyph)
				drawing.add(flowGlyph)
			} else {
				// Render as italic text
				var flowText = new Text(flowStyleName, -(flowPos + 4), {
					font: 'bold italic ' + Math.round(getFontSize() * 0.39) + 'px ' + getMusicTextFamily(),
				})
				cursor.posGlyph(flowText)
				drawing.add(flowText)
			}
			break

		case 'TempoVariance':
			// Fermata, breath marks, caesura, rit., accel., etc.
			var tvStyles = ['Breath Mark', 'Caesura', 'Fermata', 'Accelerando', 'Allargando', 'Rallentando', 'Ritardando', 'Ritenuto', 'Rubato', 'Stringendo']
			var tvStyleName = tvStyles[token.style] || 'Fermata'
			var tvPos = token.position !== undefined ? token.position : 11
			if (tvStyleName === 'Fermata') {
				var fermGlyph = new ArticulationMark('fermata', tvPos + 4)
				cursor.posGlyph(fermGlyph)
				drawing.add(fermGlyph)
			} else if (tvStyleName === 'Breath Mark') {
				// Render as a comma-like mark above the staff
				var breathText = new Text(',', -(tvPos + 4), {
					font: 'bold ' + Math.round(getFontSize() * 0.6) + 'px ' + getMusicTextFamily(),
				})
				cursor.posGlyph(breathText)
				drawing.add(breathText)
			} else {
				// Text-based tempo variance (rit., accel., rall., etc.)
				var tvTextMap = {
					'Accelerando': 'accel.',
					'Allargando': 'allarg.',
					'Rallentando': 'rall.',
					'Ritardando': 'rit.',
					'Ritenuto': 'riten.',
					'Rubato': 'rubato',
					'Stringendo': 'string.',
					'Caesura': '//',
				}
				var tvDisplayText = tvTextMap[tvStyleName] || tvStyleName
				var tvText = new Text(tvDisplayText, -(tvPos + 4), {
					font: 'italic ' + Math.round(getFontSize() * 0.39) + 'px ' + getMusicTextFamily(),
				})
				cursor.posGlyph(tvText)
				drawing.add(tvText)
			}
			break

		case 'moo':
			console.log('as', token)
			break
	}

	// Barlines handle their own TickTracker registration via addBarline()
	// inside the switch case above (dual pre-gap / post-gap registration).
	if (!isBarline) {
		tickTracker.add(token, cursor)
	}
}

function drawForNote(token, cursor, durToken, skipLedger) {
	// Use the individual note's duration if available (split-stem chords),
	// otherwise fall back to the chord/token-level duration.
	const duration = token.duration || durToken.duration
	const durValue = durToken.durValue

	// Grace note detection — grace notes are drawn at ~60% size with reduced spacing
	const isGrace = !!(token.grace || durToken.grace)
	const graceScale = isGrace ? 0.6 : 1.0

	const sym =
		duration < 2
			? 'noteheadWhole'
			: duration < 4
			? 'noteheadHalf'
			: 'noteheadBlack'

	const relativePos = token.position + 4

	// BARLINE_NOTE_EXTRA is now absorbed into the barline's own gap,
	// so no separate _afterBarline indent is needed here.
	cursor._afterBarline = false

	if (token.accidental) {
		var acc = new Accidental(token.accidental, relativePos)
		// Accidentals hang to the left of the notehead via offsetX.
		// No cursor advance — the rod captures accidental width for the
		// spring-rod model, which prevents collisions with the previous note.
		// This keeps all noteheads at the same X within chords.
		cursor.posGlyph(acc)
		acc.offsetX = -acc.width * 1.2 * graceScale
		if (isGrace) acc._graceScale = graceScale
		drawing.add(acc)
		// Store reference for tie/slur collision avoidance
		token.drawingAccidental = acc
	}

	// note head
	const noteHead = new Glyph(sym, relativePos)
	cursor.posGlyph(noteHead)
	if (isGrace) {
		noteHead._graceScale = graceScale
		// Scale stored width to match visual size — beams.js and ties.js
		// use noteHead.width for stem X and tie center calculations.
		noteHead.width *= graceScale
	}
	drawing.add(noteHead)
	const noteHeadWidth = noteHead.width

	// ledger lines (skip when called from chord — chord handles them consolidated)
	if (!skipLedger) {
		if (relativePos < 0) {
			const ledgerStart = ((relativePos / 2) | 0) * 2
			if (ledgerStart < 0) {
				const ledger = new Ledger(ledgerStart, 0, noteHeadWidth)
				cursor.posGlyph(ledger)
				drawing.add(ledger)
			}
		} else if (relativePos > 8) {
			const ledgerEnd = Math.floor(relativePos / 2) * 2
			if (ledgerEnd >= 10) {
				const ledger = new Ledger(10, ledgerEnd + 2, noteHeadWidth)
				cursor.posGlyph(ledger)
				drawing.add(ledger)
			}
		}
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

			var lyricFont = lyricFontSize + 'px ' + getMusicTextFamily()
			var text = new Text(displayText, 0, {
				font: lyricFont,
				textAlign: 'left',
			})
			cursor.posGlyph(text)
			text.offsetY = lyricOffsetY
			drawing.add(text)

			// Measure lyric text width for spring-rod spacing.
			// The rod of a note should be at least as wide as its lyric
			// so syllables don't overlap when springs compress.
			var ctx = window.ctx
			if (ctx) {
				ctx.save()
				ctx.font = lyricFont
				token._lyricWidth = ctx.measureText(displayText).width
				ctx.restore()
			}
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

	// --- Articulation glyphs ---
	// Articulations are placed on the notehead side (opposite the stem):
	//   stem up → articulation below,  stem down → articulation above.
	// Multiple articulations stack outward from the notehead.
	// Staff-line avoidance: nudge into the nearest space so dots aren't hidden.
	// For chords, articulations are drawn once at the chord level (not per child note).
	if (!skipLedger) {
	var articulationFlags = ['staccato', 'accent', 'tenuto', 'marcato', 'staccatissimo', 'fermata']
	var artOffset = 0
	for (var ai = 0; ai < articulationFlags.length; ai++) {
		var artFlag = articulationFlags[ai]
		if (!token[artFlag] && !(durToken && durToken[artFlag])) continue
		// Place above if stem down, below if stem up (standard engraving).
		// Fermata always goes above.
		var above = artFlag === 'fermata' ? true : !stemUp
		var artPos = above
			? relativePos + 2 + artOffset * 2
			: relativePos - 2 - artOffset * 2
		// Avoid landing on a staff line (e.g. staccato dot would be invisible)
		if (isOnLine(artPos)) artPos += above ? 1 : -1
		var artMark = new ArticulationMark(artFlag, artPos)
		cursor.posGlyph(artMark)
		// Align with the notehead: cursor has advanced past it,
		// so pull back to noteHead.x and center within the notehead width.
		artMark.offsetX = noteHead.x - artMark.x + (noteHeadWidth - artMark.width) / 2
		drawing.add(artMark)
		artOffset++
	}
	}

	// cursor.incStaveX(spacerWidth())
	cursor.tokenPadRight(spacerWidth())

	// Account for stem width on notes that will have stems
	const stemBuffer = hasStem ? spacerWidth() * 2 : 0

	// Grace notes get minimal padding — they should be tight against the next note
	if (isGrace) {
		cursor.tokenPadRight(spacerWidth() * 0.5)
	} else {
		var spaceMultiplier = calculatePadding(durValue || token.durValue)
		cursor.tokenPadRight(noteHead.width * spaceMultiplier + stemBuffer)
	}

	// --- Record rod (rigid width) and spring (elastic gap) for spring-rod model ---
	// Rod = physical width of the note unit that cannot be compressed.
	// Spring = ideal duration-proportional gap after the note.
	// For chords, durToken is the parent chord; rod accumulates across children
	// but we take the max since chord notes share horizontal space.
	var accWidth = token.accidental ? (acc.width * 1.2 * graceScale) : 0
	var dotTotalWidth = 0
	for (let di = 0; di < token.dots; di++) dotTotalWidth += getFontSize() * 0.15
	var flagExtraWidth = (hasStem && hasFlag && stemUp) ? spacerWidth() : 0
	var thisRod = accWidth + noteHeadWidth + dotTotalWidth + flagExtraWidth

	// If this note carries a lyric syllable, the rod must be at least as
	// wide as the text so adjacent syllables don't overlap when springs
	// compress.  Add a small gap (half spacerWidth) for breathing room.
	var lyricW = token._lyricWidth || 0
	if (lyricW > 0) {
		thisRod = Math.max(thisRod, lyricW + spacerWidth() * 0.5)
	}

	// For chords (durToken !== token), take the max rod across child notes
	if (durToken !== token) {
		durToken._rod = Math.max(durToken._rod || 0, thisRod)
	} else {
		durToken._rod = thisRod
	}
	if (!isGrace) {
		durToken._spring = rossSpringWidth(durValue || token.durValue)
	} else {
		// Grace notes: duration-proportional spring scaled to 40% — tight
		// but not fixed, so different grace-note durations still get
		// slightly different spacing.
		durToken._spring = rossSpringWidth(durValue || token.durValue) * 0.4
	}
}

function isOnLine(pos) {
	return pos % 2 == 0
}

function calculatePadding(durValue) {
	// Improved spacing: logarithmic scale for better visual balance
	// Whole notes get more space, shorter notes get proportionally less
	const duration = durValue.value()
	
	// Base spacing on note duration with diminishing returns.
	// Scale by springDensity / 1.5 so the density slider affects both
	// the spring model and the legacy model proportionally.
	const densityScale = getSpringDensity() / 1.5
	// sqrt(quarter * 16) = 2.0 is our "quarter baseline".  Proportionality
	// interpolates between uniform (quarterBaseline) and the actual sqrt value.
	const rawSpacing = Math.sqrt(duration * 16)
	const quarterBaseline = 2.0   // sqrt(0.25 * 16)
	const prop = getDurationProportionality()
	const baseSpacing = (quarterBaseline + (rawSpacing - quarterBaseline) * prop) * densityScale
	
	// Clamp between reasonable bounds
	const clamped = Math.min(Math.max(baseSpacing, 0.5), 10)

	// Apply rod/spring balance so it affects line breaking (not just justification).
	// Rod portion (1.0) = minimum readable spacing (one notehead width of gap).
	// Spring portion = anything above 1.0, scaled by balance.
	// balance=0: tight (rod-only), balance=1: standard, balance>1: extra wide.
	const balance = getRodSpringBalance()
	const rodMin = Math.min(clamped, 1.0)
	const springExtra = Math.max(0, clamped - 1.0)
	return rodMin + springExtra * balance
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

export { score, computeSystemBreaks, dpOptimalBreaks, computeBadness, buildBarlineMap, computeJustifyX, setPlaybackHighlighter, setInkBleedRenderer, reflowIfSparse }
