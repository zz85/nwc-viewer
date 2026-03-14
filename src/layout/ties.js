/**
 * Tie and slur layout.
 *
 * Professional engraving rules implemented:
 *
 * 1. Direction:
 *    - Ties/slurs opposite the stem (stems up -> arc below, stems down -> arc above).
 *    - Slurs with mixed stem directions: always above.
 *    - Chord ties: outer notes curve outward, inner notes follow nearest outer.
 *
 * 2. Anchoring:
 *    - Ties begin just right of first notehead, end just left of second.
 *    - Slurs anchor at notehead centre.
 *
 * 3. Collision avoidance:
 *    - Arc peak nudged off staff lines into the nearest space.
 *    - Arc height increased when the end note has an accidental.
 *
 * 4. Visual distinction:
 *    - Ties use the Tie class (thicker, rounder).
 *    - Slurs use the Slur class (thinner, more open).
 */
import { Tie, Slur } from '../drawing.js'
import { getFontSize } from '../constants.js'
import { avoidStaffLine, ACCIDENTAL_CLEARANCE } from '../engraving-rules.js'

let drawing, data

// -- Direction helpers ---------------------------------------------------

/**
 * Determine whether a token's stem points up.
 * Returns true (stems up), false (stems down), or undefined (ambiguous).
 */
function isStemUp(token) {
	if (token.Stem === 'Up' || token.stem === 1) return true
	if (token.Stem === 'Down' || token.stem === 2) return false
	if (token.type === 'Chord' && token.notes && token.notes.length > 0) {
		const positions = token.notes.map(n => n.position)
		return (Math.min(...positions) + Math.max(...positions)) < 0
	}
	return undefined
}

/**
 * Standard tie/slur direction from stem direction.
 * Stems up -> arc below (1).  Stems down -> arc above (-1).
 */
function getTieDirection(token, childNote) {
	let stemUp = isStemUp(token)
	if (stemUp === undefined) {
		// Single note fallback: position < 0 = above middle line = stems up
		const pos = childNote ? childNote.position : (token.position || 0)
		stemUp = pos < 0
	}
	return stemUp ? 1 : -1
}

/**
 * Chord-aware tie direction following the inner/outer rule:
 *
 *   - Top note (highest pitch = most negative position): curves above (-1)
 *   - Bottom note (lowest pitch = most positive position): curves below (1)
 *   - Inner notes: follow the nearest outer note's direction
 *
 * Falls back to stem-based direction for single notes or chords where
 * only one note is tied.
 */
function getChordTieDirection(token, childNote) {
	if (!childNote || token.type !== 'Chord' || !token.notes || token.notes.length < 2) {
		return getTieDirection(token, childNote)
	}

	// Collect all tied notes in this chord
	const tiedPositions = token.notes
		.filter(n => n.tie || n.tieEnd)
		.map(n => n.position)

	// If only one note is tied, fall back to stem-based
	if (tiedPositions.length < 2) {
		return getTieDirection(token, childNote)
	}

	const sorted = [...tiedPositions].sort((a, b) => a - b)
	const pos = childNote.position
	const topPos = sorted[sorted.length - 1]      // most positive = highest on staff
	const bottomPos = sorted[0]                    // most negative = lowest on staff

	// Top note -> above
	if (pos === topPos) return -1
	// Bottom note -> below
	if (pos === bottomPos) return 1
	// Inner note -> follow nearest outer
	const distToTop = Math.abs(pos - topPos)
	const distToBottom = Math.abs(pos - bottomPos)
	return distToTop <= distToBottom ? -1 : 1
}

// -- Collision avoidance -------------------------------------------------

/**
 * Check whether the end note of a tie has a drawn accidental that the
 * tie arc might collide with.  Returns an adjusted arc height boost
 * (in pixels, signed by direction) to clear it, or 0 if no collision.
 */
function accidentalClearance(endToken, endChildNote, direction, fontSize) {
	// Check child note or parent token for a drawn accidental
	const target = endChildNote || endToken
	if (!target || !target.drawingAccidental) return 0

	// The accidental hangs to the left of the notehead -- the tie
	// approaches from the left, so the arc path may pass through it.
	// Increase the arc height to clear.
	return fontSize * ACCIDENTAL_CLEARANCE * direction
}

/**
 * Scan intermediate notes between two endpoints and compute the minimum
 * arc height needed so the curve clears all notes in between.
 *
 * For a phrase like D-G-F# with the slur from D to F#, the G sits
 * between them and may protrude into the arc path.  This function
 * detects that and returns the necessary arc height (signed by direction).
 *
 * @param {Array}  entries   Flat note-entry list.
 * @param {number} startIdx  Index of the arc start entry.
 * @param {number} endIdx    Index of the arc end entry.
 * @param {object} arcObj    The Tie/Slur object (has x, y, endx, endy, arcHeight, direction).
 * @param {number} direction 1 (below) or -1 (above).
 * @param {number} fontSize  Current font size in pixels.
 * @returns {number} Additional arc height to add (signed by direction), or 0.
 */
function intermediateNoteClearance(entries, startIdx, endIdx, arcObj, direction, fontSize) {
	if (endIdx - startIdx < 2) return 0  // no intermediate notes

	const startX = arcObj.x
	const startY = arcObj.y
	const endX = arcObj.endx
	const spanW = endX - startX
	if (spanW <= 0) return 0

	const endY = arcObj.endy
	// At least two staff spaces of clearance above/below the notehead.
	// One staff space = fontSize / 4; we use 0.5 * fontSize = 2 staff spaces.
	const padding = fontSize * 0.5
	let maxNeeded = 0

	for (let k = startIdx + 1; k < endIdx; k++) {
		const mid = entries[k]
		if (!mid.glyph) continue

		const noteX = mid.glyph.x + (mid.glyph.width || 0) / 2
		const noteY = mid.glyph.y + (mid.glyph.offsetY || 0)

		// Where is this note relative to the span?
		const fraction = (noteX - startX) / spanW
		if (fraction <= 0.03 || fraction >= 0.97) continue  // too close to endpoints

		// Y on the straight line from start to end at this X
		const lineY = startY + (endY - startY) * fraction

		// Signed intrusion: positive means note extends into the arc space
		let intrusion
		if (direction > 0) {
			// Arc below: note protrudes if its Y is below the line
			intrusion = noteY - lineY
		} else {
			// Arc above: note protrudes if its Y is above the line
			intrusion = lineY - noteY
		}

		if (intrusion <= 0) continue  // note is on the safe side

		// The arc shape at this fraction (parabolic approximation of bezier).
		// Peaks at 1.0 at the midpoint, 0 at the endpoints.
		const arcFraction = 4 * fraction * (1 - fraction)
		if (arcFraction < 0.1) continue  // too close to edge, skip

		// How much total arc height is needed so the curve at this X
		// clears the note with padding?
		const neededHeight = (intrusion + padding) / arcFraction
		if (neededHeight > maxNeeded) {
			maxNeeded = neededHeight
		}
	}

	// If the current arc height is already sufficient, return 0
	const currentHeight = Math.abs(arcObj.arcHeight)
	if (maxNeeded <= currentHeight) return 0

	// Return the additional height needed (signed by direction)
	return (maxNeeded - currentHeight) * direction
}

// -- Main layout ---------------------------------------------------------

function layoutTies(_drawing, _data) {
	drawing = _drawing
	data = _data
	const staves = data.score.staves
	const fontSize = getFontSize()

	staves.forEach((stave, staveIndex) => {
		// Staff Y for collision avoidance.  Derived from the first note's
		// glyph -- glyph.y is the Y of the top staff line for that staff.
		let staffY = null

		// Build a flat list of tie-able note entries from all tokens.
		// For Chord tokens, each child note becomes a separate entry so
		// per-note chord ties work correctly.
		const entries = []
		for (const token of stave.tokens) {
			if (token.type === 'Note') {
				if (!token.drawingNoteHead) continue
				if (staffY === null) staffY = token.drawingNoteHead.y
				entries.push({
					position: token.position,
					glyph: token.drawingNoteHead,
					tie: token.tie,
					tieEnd: token.tieEnd,
					slur: token.slur,
					token: token,
				})
			} else if (token.type === 'Chord' && token.notes) {
				for (const child of token.notes) {
					if (!child.drawingNoteHead) continue
					if (staffY === null) staffY = child.drawingNoteHead.y
					entries.push({
						position: child.position,
						glyph: child.drawingNoteHead,
						// Tie can be on the child note itself, or inherited from parent
						tie: child.tie || token.tie,
						tieEnd: child.tieEnd || token.tieEnd,
						// Slurs are on the parent chord, not individual notes
						slur: token.slur,
						token: token,
						childNote: child,
					})
				}
			}
		}

		// --- Draw ties ---
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (!entry.tie) continue

			const start = entry.glyph
			// Use chord inner/outer rule for direction
			const direction = getChordTieDirection(entry.token, entry.childNote)

			// Search forward for matching tie-end at the same position
			for (let j = i + 1; j < entries.length; j++) {
				const next = entries[j]
				if (next.tieEnd && next.position === entry.position) {
					const end = next.glyph
					if (end) {
						const tie = new Tie(start, end, direction)

						// Collision avoidance: intermediate note clearance
						const intBoost = intermediateNoteClearance(
							entries, i, j, tie, direction, fontSize
						)
						if (intBoost !== 0) {
							tie.arcHeight += intBoost
						}

						// Collision avoidance: staff-line nudge
						if (staffY !== null) {
							const peakY = tie.y + tie.arcHeight
							const adjusted = avoidStaffLine(peakY, staffY, fontSize, direction)
							if (adjusted !== peakY) {
								tie.arcHeight += (adjusted - peakY)
							}
						}

						// Collision avoidance: accidental clearance
						const accBoost = accidentalClearance(
							next.token, next.childNote, direction, fontSize
						)
						if (accBoost !== 0) {
							tie.arcHeight += accBoost
						}

						drawing.add(tie)
						break
					}
				}
				// If we find a non-tieEnd note at the same position, stop
				// (the tie chain is broken)
				if (!next.tieEnd && next.position === entry.position) {
					break
				}
			}
		}

		// --- Draw slurs ---
		// Slurs connect between noteheads regardless of position matching.
		// For chords, use the outer note (opposite side from stem) as anchor.
		// De-duplicate: only process one slur-start per parent token.
		const slurProcessed = new Set()
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (entry.slur !== 1) continue
			// Avoid duplicates from chord child entries sharing same parent
			if (slurProcessed.has(entry.token)) continue
			slurProcessed.add(entry.token)

			const start = getSlurAnchor(entry.token)
			if (!start) continue

			// Find the slur end (slur === 2)
			let endToken = null
			let endAnchor = null
			let endIdx = -1
			for (let j = i + 1; j < entries.length; j++) {
				const next = entries[j]
				if (next.slur !== 2) continue
				if (slurProcessed.has(next.token) && next.token !== entry.token) continue

				endToken = next.token
				endAnchor = getSlurAnchor(next.token)
				endIdx = j
				break
			}

			if (!endAnchor) continue

			// Direction: mixed stem directions -> always above
			const startStemUp = isStemUp(entry.token)
			const endStemUp = isStemUp(endToken)
			let direction
			if (startStemUp !== undefined && endStemUp !== undefined && startStemUp !== endStemUp) {
				// Mixed stem directions: almost always above
				direction = -1
			} else {
				direction = getTieDirection(entry.token, entry.childNote)
			}

			const slur = new Slur(start, endAnchor, direction)

			// Collision avoidance: intermediate note clearance
			if (endIdx > i + 1) {
				const intBoost = intermediateNoteClearance(
					entries, i, endIdx, slur, direction, fontSize
				)
				if (intBoost !== 0) {
					slur.arcHeight += intBoost
				}
			}

			// Collision avoidance: staff-line nudge for slur peak
			if (staffY !== null) {
				const peakY = slur.y + slur.arcHeight
				const adjusted = avoidStaffLine(peakY, staffY, fontSize, direction)
				if (adjusted !== peakY) {
					slur.arcHeight += (adjusted - peakY)
				}
			}

			drawing.add(slur)
		}
	})
}

/**
 * Get the best notehead glyph for a slur anchor point.
 * For single notes, it's the note's drawingNoteHead.
 * For chords, pick the note on the opposite side from the stem
 * (top note for stems-up, bottom note for stems-down).
 */
function getSlurAnchor(token) {
	if (token.type === 'Note') {
		return token.drawingNoteHead
	}
	if (token.type === 'Chord' && token.notes && token.notes.length > 0) {
		// Determine stem direction
		let stemUp = isStemUp(token)
		if (stemUp === undefined) {
			const positions = token.notes.map(n => n.position)
			stemUp = (Math.min(...positions) + Math.max(...positions)) < 0
		}
		// Pick outer note: stems up -> use top note (most negative position);
		// stems down -> use bottom note (most positive position)
		const sorted = [...token.notes].sort((a, b) => a.position - b.position)
		const anchor = stemUp ? sorted[sorted.length - 1] : sorted[0]
		return anchor.drawingNoteHead || token.notes[0].drawingNoteHead
	}
	return null
}

export { layoutTies }
