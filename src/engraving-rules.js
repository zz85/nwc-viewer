/**
 * Engraving rules for professional music notation rendering.
 *
 * All dimensional values are expressed as fractions of fontSize unless
 * otherwise noted.  The layout and drawing code multiplies these by
 * getFontSize() at render time.
 *
 * Tie height uses linear interpolation on the normalized span
 * (width / fontSize):
 *
 *     height = clamp(K * normalizedWidth + D, min, max) * fontSize
 *
 * This gives short ties a round arc and long ties a flatter profile.
 */

// ── Tie constants ──────────────────────────────────────────────────

/** Slope for tie height interpolation. */
export const TIE_HEIGHT_K = 0.04

/** Y-intercept for tie height interpolation. */
export const TIE_HEIGHT_D = 0.16

/** Minimum tie height (fraction of fontSize). */
export const TIE_HEIGHT_MIN = 0.15

/** Maximum tie height (fraction of fontSize). */
export const TIE_HEIGHT_MAX = 0.55

/**
 * Horizontal gap between the notehead edge and the tie endpoint.
 * "A tie begins just to the right of the first notehead and ends
 * just to the left of the second.  It should never touch the noteheads."
 */
export const TIE_X_GAP = 0.1

/**
 * Vertical offset from the notehead centre toward the curve direction.
 * Pushes the tie anchor slightly above or below the notehead centre
 * so the arc originates from the notehead edge, not the middle.
 */
export const TIE_Y_OFFSET = 0.15

/**
 * Tie thickness at the midpoint (fraction of fontSize).
 * The shape tapers to zero at both endpoints.
 */
export const TIE_THICKNESS = 0.10

// ── Slur constants ─────────────────────────────────────────────────

/** Slope for slur height interpolation (flatter than ties). */
export const SLUR_HEIGHT_K = 0.03

/** Y-intercept for slur height interpolation. */
export const SLUR_HEIGHT_D = 0.18

/** Minimum slur height (fraction of fontSize). */
export const SLUR_HEIGHT_MIN = 0.18

/** Maximum slur height (fraction of fontSize). */
export const SLUR_HEIGHT_MAX = 0.60

/**
 * Vertical offset from the notehead centre for slur anchors.
 * Larger than ties because slurs sit further from the note —
 * at least half a staff space from the notehead edge.
 */
export const SLUR_Y_OFFSET = 0.30

/**
 * Slur thickness at the midpoint (fraction of fontSize).
 * Slightly thinner than ties but still clearly visible.
 */
export const SLUR_THICKNESS = 0.08

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
 */
export const ACCIDENTAL_CLEARANCE = 0.15

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
