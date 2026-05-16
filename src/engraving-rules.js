/**
 * Engraving rules for professional music notation rendering.
 *
 * All dimensional values are expressed as fractions of fontSize unless
 * otherwise noted.  The layout and drawing code multiplies these by
 * getFontSize() at render time.  fontSize = 4 staff-spaces.
 *
 * Tie/slur height uses linear interpolation on the normalized span
 * (width / fontSize):
 *
 *     height = clamp(K * normalizedWidth + D, min, max) * fontSize
 *
 * This gives short ties a round arc and long ties a flatter profile.
 *
 * Reference values (staff-spaces):
 *   MuseScore 4: tieMidWidth=0.21, tieMinShoulder=0.30, tieMaxShoulder=2.0
 *   LilyPond:    tie ratio=0.333, height-limit=1.0; slur ratio=0.25, height-limit=2.0
 */

// ── Tie constants ──────────────────────────────────────────────────

/** Slope for tie height interpolation. */
export const TIE_HEIGHT_K = 0.06

/** Y-intercept for tie height interpolation. */
export const TIE_HEIGHT_D = 0.06

/** Minimum tie height (fraction of fontSize).  0.08 = 0.32 sp. */
export const TIE_HEIGHT_MIN = 0.08

/** Maximum tie height (fraction of fontSize).  0.45 = 1.80 sp. */
export const TIE_HEIGHT_MAX = 0.45

/**
 * Horizontal gap between the notehead edge and the tie endpoint.
 * 0.06 = 0.24 sp (LilyPond note-head-gap = 0.20 sp).
 */
export const TIE_X_GAP = 0.06

/**
 * Vertical offset from the notehead centre toward the curve direction.
 * Pushes the tie anchor slightly above or below the notehead centre
 * so the arc originates from the notehead edge, not the middle.
 */
export const TIE_Y_OFFSET = 0.10

/**
 * Tie thickness at the midpoint (fraction of fontSize).
 * 0.055 = 0.22 sp (MuseScore tieMidWidth = 0.21 sp).
 * The shape tapers to zero at both endpoints.
 */
export const TIE_THICKNESS = 0.055

// ── Slur constants ─────────────────────────────────────────────────

/** Slope for slur height interpolation. */
export const SLUR_HEIGHT_K = 0.05

/** Y-intercept for slur height interpolation. */
export const SLUR_HEIGHT_D = 0.08

/** Minimum slur height (fraction of fontSize).  0.10 = 0.40 sp. */
export const SLUR_HEIGHT_MIN = 0.10

/** Maximum slur height (fraction of fontSize).  0.50 = 2.00 sp. */
export const SLUR_HEIGHT_MAX = 0.50

/**
 * Vertical offset from the notehead centre for slur anchors.
 * Larger than ties because slurs sit further from the note.
 * 0.18 = 0.72 sp.
 */
export const SLUR_Y_OFFSET = 0.18

/**
 * Slur thickness at the midpoint (fraction of fontSize).
 * 0.045 = 0.18 sp.  Slightly thinner than ties.
 */
export const SLUR_THICKNESS = 0.045

// ── System header spacing ──────────────────────────────────────────
// Gaps between elements at the start of each system (clef, key sig,
// time sig).  All fractions of fontSize (= 4 staff-spaces).
// Effective gap = constant * HEADER_SPACING_MULTIPLIER.

/**
 * Global multiplier for all system header gaps.
 * 1.0 = tight/professional (MuseScore-calibrated defaults).
 * 1.25 = relaxed.  Range: 0.75 – 1.5.
 */
export let HEADER_SPACING_MULTIPLIER = 1.15

export function setHeaderSpacingMultiplier(v) {
	HEADER_SPACING_MULTIPLIER = Math.max(0.75, Math.min(1.5, v))
}

/**
 * Left margin before the clef glyph (from system edge / barline).
 * Base 0.19 = 0.75 sp (MuseScore: 0.75, OSMD: 0.50).
 */
export const CLEF_LEFT_MARGIN = 0.19

/**
 * Gap after the clef, before the key signature (or time signature
 * when no key signature is present).
 * Base 0.20 = 0.80 sp (LilyPond: 0.82, MuseScore: 0.75).
 */
export const AFTER_CLEF_GAP = 0.20

/**
 * Gap after the key signature, before the time signature (or first
 * note when no time signature follows).
 * Base 0.25 = 1.00 sp (MuseScore: 1.00, LilyPond: 1.15).
 */
export const AFTER_KEYSIG_GAP = 0.25

/**
 * Gap after the time signature, before the first note/rest.
 * Base 0.56 = 2.25 sp (LilyPond: 2.00, MuseScore: 2.50).
 */
export const AFTER_TIMESIG_GAP = 0.56

/**
 * Gap after a barline before the next element (key sig, time sig, etc.).
 * Base 0.31 = 1.25 sp (MuseScore: keyBarlineDistance=1.0,
 * timesigBarlineDistance=0.5).
 * Covers accidental clearance (~0.36 fontSize overhang).
 *
 * In the layout engine, BARLINE_NOTE_EXTRA is added on top of this gap
 * inside the barline's own cursor advancement (not as a separate indent
 * on the next note).  The TickTracker performs dual registration:
 *   - barlineTicks[T] = barline line position (pre-gap) — for matching
 *     barlines on other staves to stack vertically.
 *   - maxTicks[T] = post-gap cursor position — so notes on every staff
 *     land past all barline gaps at a given time.
 */
export const AFTER_BARLINE_GAP = 0.31

/**
 * Extra indent for the first note/rest/chord after a barline.
 * Absorbed into the barline's own cursor gap (added to AFTER_BARLINE_GAP)
 * so the TickTracker post-gap position already includes this offset.
 * Total note gap = 0.31 + 0.19 = 0.50 = 2.0 sp.
 *
 * Key/time signatures after a barline do NOT get this extra indent —
 * they clear the _afterBarline flag without adding the gap.
 */
export const BARLINE_NOTE_EXTRA = 0.19

/**
 * Get effective header gap (base * multiplier).
 */
export function headerGap(base) {
	return base * HEADER_SPACING_MULTIPLIER
}

// ── Collision avoidance ────────────────────────────────────────────

/**
 * If the arc peak is within this fraction of a line-spacing from a
 * staff line, it is nudged into the nearest space.
 */
export const STAFF_LINE_THRESHOLD = 0.15

/**
 * How far to nudge the arc peak away from a staff line (fraction of
 * line-spacing).
 */
export const STAFF_LINE_NUDGE = 0.25

/**
 * Extra arc height added when the tie path would collide with an
 * accidental glyph on the destination note (fraction of fontSize).
 * 0.12 = 0.48 sp.
 */
export const ACCIDENTAL_CLEARANCE = 0.12

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Compute proportional arc height for a tie or slur.
 *
 * @param {number} span     Horizontal width of the curve in pixels.
 * @param {number} fontSize Current music font size in pixels.
 * @param {number} K        Interpolation slope.
 * @param {number} D        Interpolation intercept.
 * @param {number} min      Minimum height factor.
 * @param {number} max      Maximum height factor.
 * @returns {number} Arc height in pixels (always positive).
 */
export function computeArcHeight(span, fontSize, K, D, min, max) {
	const normalised = Math.abs(span) / fontSize
	const factor = Math.min(max, Math.max(min, K * normalised + D))
	return factor * fontSize
}

/**
 * Check whether a Y coordinate sits on (or very close to) a staff
 * line and, if so, nudge it into the nearest space.
 *
 * Staff lines are at staffY + i * lineSpacing for i in [0..4].
 *
 * @param {number} peakY     The Y coordinate of the arc peak.
 * @param {number} staffY    The Y coordinate of the top staff line.
 * @param {number} fontSize  Current music font size.
 * @param {number} direction 1 (arc below) or -1 (arc above).
 * @returns {number} Adjusted peakY.
 */
export function avoidStaffLine(peakY, staffY, fontSize, direction) {
	const lineSpacing = fontSize / 4
	const threshold = lineSpacing * STAFF_LINE_THRESHOLD
	for (let i = 0; i < 5; i++) {
		const lineY = staffY + i * lineSpacing
		if (Math.abs(peakY - lineY) < threshold) {
			return peakY + direction * lineSpacing * STAFF_LINE_NUDGE
		}
	}
	return peakY
}
