/* this file cares about laying out beams */
import { Stem, Glyph, Beam } from '../drawing.js'

let drawing, data

/**
 * Pure function: given an array of duration values (8, 16, 32, ...),
 * compute the primary beam count and which notes need sub-beams.
 *
 * Returns { primaryBeamCount, subBeams } where subBeams is an array of
 * { index, extraBeams, stubStartIdx, stubEndIdx } describing each partial
 * beam segment to draw.
 */
function computeBeamLayout(durations) {
	if (durations.length < 2) return { primaryBeamCount: 0, subBeams: [] }

	const minDuration = Math.min(...durations)
	const primaryBeamCount = Math.floor(Math.log2(minDuration / 4))
	const subBeams = []

	// For each beam level beyond the primary, find contiguous runs of notes
	// at that level and emit one segment per run (avoids double-drawing).
	const maxBeams = Math.floor(Math.log2(Math.max(...durations) / 4))
	for (let level = primaryBeamCount + 1; level <= maxBeams; level++) {
		// Walk through notes, collecting runs at this level
		let runStart = -1
		for (let i = 0; i <= durations.length; i++) {
			const noteBeams = i < durations.length
				? Math.floor(Math.log2(durations[i] / 4))
				: 0
			if (noteBeams >= level) {
				if (runStart === -1) runStart = i
			} else {
				if (runStart !== -1) {
					const runEnd = i - 1
					if (runStart === runEnd) {
						// Isolated note — stub toward nearest neighbor
						const prevIdx = runStart > 0 ? runStart - 1 : null
						const nextIdx = runStart < durations.length - 1 ? runStart + 1 : null
						subBeams.push({
							level,
							startIdx: runStart,
							endIdx: runStart,
							stub: true,
							neighborIdx: nextIdx !== null ? nextIdx : prevIdx
						})
					} else {
						// Run of 2+ notes — full beam across the run
						subBeams.push({
							level,
							startIdx: runStart,
							endIdx: runEnd,
							stub: false
						})
					}
					runStart = -1
				}
			}
		}
	}

	return { primaryBeamCount, subBeams }
}

function groupBeamableNotes(tokens) {
	const groups = []
	let currentGroup = []

	for (const token of tokens) {
		const isBeamable = (token.type === 'Note' || token.type === 'Chord') && 
		                   token.duration >= 8 && 
		                   token.drawingNoteHead

		if (!isBeamable) {
			if (currentGroup.length > 0) {
				groups.push(currentGroup)
			}
			currentGroup = []
			continue
		}

		// Use beam markers from NWC file
		// NWC binary: beam 1 = first (start), 2 = middle (continue), 3 = last (end)
		if (token.beam === 1) {
			// Start new beam group
			if (currentGroup.length > 0) {
				groups.push(currentGroup)
			}
			currentGroup = [token]
		} else if (token.beam === 3) {
			// End beam group (last note)
			currentGroup.push(token)
			if (currentGroup.length > 0) {
				groups.push(currentGroup)
			}
			currentGroup = []
		} else if (token.beam === 2) {
			// Middle - continue current group
			currentGroup.push(token)
		} else {
			// beam === 0 or undefined means no beam - standalone note
			if (currentGroup.length > 0) {
				groups.push(currentGroup)
			}
			currentGroup = []
		}
	}

	if (currentGroup.length > 0) {
		groups.push(currentGroup)
	}

	return groups
}

/**
 * Compute the standard stem length for a note, accounting for:
 * - Base octave rule: 3.5 staff spaces = 7 half-space units
 * - Chord span: extra length to cover all chord noteheads
 * - Extra beams: 32nd notes (3 beams) and finer need longer stems
 * - Ledger line notes: stem must reach at least the middle staff line
 *
 * Coordinate system: position increases UPWARD (higher pitch).
 *   position > 0 = above middle line, position < 0 = below middle line.
 *   Top staff line = +4, bottom staff line = -4.
 *
 * @param {number} position - Note position in half-spaces from middle line (0 = middle)
 * @param {boolean} stemUp - Whether stem goes up (toward higher position values)
 * @param {number} chordSpan - Distance between top/bottom chord notes in half-spaces
 * @param {number} beamCount - Number of beam lines the stem must accommodate
 * @returns {number} Stem length in half-space units
 */
function computeStemLength(position, stemUp, chordSpan, beamCount) {
	// Base: 3.5 staff spaces = 7 half-space units (the "octave rule")
	var stemLen = 7 + chordSpan

	// Extra beam lines beyond 1 need extra stem length.
	// Each additional beam line needs ~1 staff space (2 half-space units) of room.
	if (beamCount > 1) {
		stemLen += (beamCount - 1) * 2
	}

	// Ledger line rule: stem must reach at least the middle staff line (position 0).
	// Staff spans position -4 (bottom line) to +4 (top line).
	if (stemUp) {
		// Stem tip goes upward (toward larger position values).
		// For notes on ledger lines BELOW the staff (position < -4),
		// the stem must be long enough to reach the middle line (position 0).
		if (position < -4) {
			var needed = -position  // distance from position to 0
			if (needed > stemLen) stemLen = needed
		}
	} else {
		// Stem tip goes downward (toward smaller position values).
		// For notes on ledger lines ABOVE the staff (position > 4),
		// the stem must be long enough to reach the middle line (position 0).
		if (position > 4) {
			var needed = position  // distance from position to 0
			if (needed > stemLen) stemLen = needed
		}
	}

	return stemLen
}

/**
 * Determine if the beam pitch contour is non-monotonic (e.g., up-down-up or zigzag),
 * in which case the beam should be horizontal.
 * Monotonic = all positions go in one direction (ascending or descending) or stay flat.
 */
function isNonMonotonic(positions) {
	if (positions.length <= 2) return false
	var firstDir = 0
	for (var i = 1; i < positions.length; i++) {
		var diff = positions[i] - positions[i - 1]
		if (diff === 0) continue
		var dir = diff > 0 ? 1 : -1
		if (firstDir === 0) {
			firstDir = dir
		} else if (dir !== firstDir) {
			return true
		}
	}
	return false
}

function drawBeamGroup(group) {
	if (group.length < 2) return

	// Use the stored stem direction from the NWC file if available.
	// stem: 1 = up, 2 = down.  Fall back to average-position heuristic.
	const firstStemDir = group[0].stem
	let stemUp
	if (firstStemDir === 1) {
		stemUp = true
	} else if (firstStemDir === 2) {
		stemUp = false
	} else {
		const avgPosition = group.reduce((sum, token) => {
			if (token.type === 'Chord') {
				const notes = token.notes
				const avg = notes.reduce((s, n) => s + n.position, 0) / notes.length
				return sum + avg
			}
			return sum + token.position
		}, 0) / group.length
		stemUp = avgPosition >= 0
	}

	// Compute beam count from durations
	const durations = group.map(t => t.duration)
	const { primaryBeamCount, subBeams } = computeBeamLayout(durations)
	const totalBeamCount = Math.max(primaryBeamCount, 1)

	// Gather note positions and X coordinates for each note in the group.
	const noteData = group.map(token => {
		const notehead = token.drawingNoteHead
		if (!notehead) return null

		let position, chordSpan = 0
		if (token.type === 'Chord') {
			const notes = token.notes
			const topNote = notes.reduce((a, b) => a.position > b.position ? a : b)
			const bottomNote = notes.reduce((a, b) => a.position < b.position ? a : b)
			position = stemUp ? bottomNote.position : topNote.position
			chordSpan = topNote.position - bottomNote.position
		} else {
			position = token.position
		}

		const x = stemUp ? notehead.x + notehead.width : notehead.x
		const y = notehead.y

		return {
			x, y, position, chordSpan,
			duration: token.duration
		}
	}).filter(Boolean)

	if (noteData.length < 2) return

	// === Beam placement algorithm (engraving guidelines) ===
	//
	// Coordinate system: `position` increases UPWARD (higher pitch).
	//   position > 0 = above middle line, position < 0 = below middle line.
	//   Top staff line = +4, bottom staff line = -4.
	//   `relativePos = position + 4` shifts so bottom line = 0.
	//   `unitsToY(relativePos)` maps larger relativePos to higher on screen.
	//
	// For stems-up, the beam sits ABOVE the noteheads (at the tip of stems going up).
	//   beamPos = position + stemLen  (toward larger position = higher)
	// For stems-down, the beam sits BELOW the noteheads (at the tip of stems going down).
	//   beamPos = position - stemLen  (toward smaller position = lower)

	// 1. Compute the "natural" beam position at each outer note using anchor stem logic.
	//    Anchor = note farthest from the middle line → gets standard octave-length stem.
	const positions = noteData.map(d => d.position)
	const first = noteData[0]
	const last = noteData[noteData.length - 1]

	// Each note gets at least the standard stem length
	const firstStemLen = computeStemLength(first.position, stemUp, first.chordSpan, totalBeamCount)
	const lastStemLen = computeStemLength(last.position, stemUp, last.chordSpan, totalBeamCount)

	let beamStartPos, beamEndPos
	if (stemUp) {
		beamStartPos = first.position + firstStemLen
		beamEndPos = last.position + lastStemLen
	} else {
		beamStartPos = first.position - firstStemLen
		beamEndPos = last.position - lastStemLen
	}

	// 2. Horizontal beam for non-monotonic contours (up-down-up, etc.)
	if (isNonMonotonic(positions)) {
		// Set beam to horizontal at the more extreme position (farther from noteheads)
		if (stemUp) {
			// Stems up: beam is above → use the HIGHER (larger) value
			const beamPos = Math.max(beamStartPos, beamEndPos)
			beamStartPos = beamPos
			beamEndPos = beamPos
		} else {
			// Stems down: beam is below → use the LOWER (smaller) value
			const beamPos = Math.min(beamStartPos, beamEndPos)
			beamStartPos = beamPos
			beamEndPos = beamPos
		}
	}

	// 3. Slant limiting: max 1 staff space = 2 half-space units between outer notes.
	const MAX_SLANT = 2  // 1 staff space in half-space units
	const slant = beamEndPos - beamStartPos
	if (Math.abs(slant) > MAX_SLANT) {
		// Keep the anchor (note farthest from middle) fixed, adjust the other end.
		const midSlant = slant > 0 ? MAX_SLANT : -MAX_SLANT
		const firstDist = Math.abs(first.position)
		const lastDist = Math.abs(last.position)
		if (firstDist >= lastDist) {
			beamEndPos = beamStartPos + midSlant
		} else {
			beamStartPos = beamEndPos - midSlant
		}
	}

	// 4. Enforce minimum stem lengths for all notes in the group.
	//    Minimum: 2.5 staff spaces (5 units) if beam is outside staff,
	//             3 staff spaces (6 units) if beam is within staff.
	const firstX = first.x
	const lastX = last.x
	const xSpan = lastX - firstX || 1

	// Check all notes and push the beam outward if any stem is too short.
	for (let pass = 0; pass < 2; pass++) {
		for (let i = 0; i < noteData.length; i++) {
			const nd = noteData[i]
			const t = (nd.x - firstX) / xSpan
			const beamPosAtNote = beamStartPos + (beamEndPos - beamStartPos) * t
			// Stem length = distance from notehead to beam, always positive
			const actualStemLen = stemUp
				? beamPosAtNote - nd.position   // beam is above (larger pos)
				: nd.position - beamPosAtNote   // beam is below (smaller pos)

			// The beam position in half-spaces from middle line:
			// within staff = between -4 and +4
			const beamInStaff = beamPosAtNote >= -4 && beamPosAtNote <= 4

			const minStemLen = beamInStaff ? 6 : 5  // 3 spaces or 2.5 spaces
			const minWithChord = minStemLen + nd.chordSpan
			const minRequired = Math.max(minWithChord, computeStemLength(nd.position, stemUp, nd.chordSpan, totalBeamCount))

			if (actualStemLen < minRequired) {
				const deficit = minRequired - actualStemLen
				if (stemUp) {
					// Push beam higher (larger position)
					beamStartPos += deficit
					beamEndPos += deficit
				} else {
					// Push beam lower (smaller position)
					beamStartPos -= deficit
					beamEndPos -= deficit
				}
			}
		}
	}

	// 5. Now draw stems and beams.
	//    Each note's stem runs from its notehead to the beam line.
	const stemDataFinal = noteData.map((nd, i) => {
		const t = (nd.x - firstX) / xSpan
		const beamPosAtNote = beamStartPos + (beamEndPos - beamStartPos) * t
		const relativePos = nd.position + 4

		// stemLen = distance from note to beam (always positive)
		const stemLen = stemUp
			? beamPosAtNote - nd.position
			: nd.position - beamPosAtNote

		return { x: nd.x, y: nd.y, relativePos, stemLen, beamPosAtNote }
	})

	// Draw stems — each intermediate stem touches the beam line exactly
	stemDataFinal.forEach(data => {
		// Stem always draws upward from `start` by `len` (via unitsToY which goes up).
		// Stem-up: start at notehead (relativePos), draws up by stemLen → reaches beam
		// Stem-down: start at (relativePos - stemLen), draws up by stemLen → reaches notehead
		const stemY = stemUp ? data.relativePos : data.relativePos - data.stemLen
		const stem = new Stem(stemY, data.stemLen)
		stem.moveTo(data.x, data.y)
		drawing.add(stem)
	})

	// Convert beam positions to relativePos coordinates for the Beam class
	const beamStartRelative = beamStartPos + 4
	const beamEndRelative = beamEndPos + 4

	const firstStem = stemDataFinal[0]
	const lastStem = stemDataFinal[stemDataFinal.length - 1]

	const primaryBeam = new Beam(beamStartRelative, beamEndRelative, 0, lastStem.x - firstStem.x, primaryBeamCount)
	primaryBeam.stemUp = stemUp
	primaryBeam.moveTo(firstStem.x, firstStem.y)
	drawing.add(primaryBeam)

	// Draw sub-beams (partial/full segments for finer-duration notes).
	const totalX = lastStem.x - firstStem.x || 1
	for (const seg of subBeams) {
		let segStartX, segEndX
		if (seg.stub) {
			// Isolated fine note — 40% stub toward nearest neighbor
			const curr = noteData[seg.startIdx]
			const neighbor = noteData[seg.neighborIdx]
			if (!neighbor) continue
			const gap = neighbor.x - curr.x
			segStartX = curr.x - firstStem.x
			segEndX = segStartX + gap * 0.4
		} else {
			// Full sub-beam across a run of fine notes
			segStartX = noteData[seg.startIdx].x - firstStem.x
			segEndX = noteData[seg.endIdx].x - firstStem.x
		}

		// Interpolate Y along the primary beam line
		const segStartRatio = segStartX / totalX
		const segEndRatio = segEndX / totalX
		const segStartY = beamStartRelative + (beamEndRelative - beamStartRelative) * segStartRatio
		const segEndY = beamStartRelative + (beamEndRelative - beamStartRelative) * segEndRatio

		const subBeam = new Beam(segStartY, segEndY, segStartX, segEndX, 1)
		subBeam.stemUp = stemUp
		subBeam._beamOffset = seg.level
		subBeam.moveTo(firstStem.x, firstStem.y)
		drawing.add(subBeam)
	}
}

var beam_handler = {
	Chord: handleChord,
	Note: handleNote,
}

function handleChord(token) {
	const duration = token.duration
	if (duration < 2) return

	// Find top and bottom notes
	const notes = token.notes
	if (!notes || notes.length === 0) return
	
	const topNote = notes.reduce((a, b) => a.position > b.position ? a : b)
	const bottomNote = notes.reduce((a, b) => a.position < b.position ? a : b)

	const stemUp =
		token.Stem === 'Up' || token.stem === 1
			? true
			: token.Stem === 'Down' || token.stem === 2
			? false
			: topNote.position + bottomNote.position < 0

	const anchorNote = stemUp ? bottomNote : topNote
	const notehead = anchorNote.drawingNoteHead
	if (!notehead) return

	const relativePos = anchorNote.position + 4
	const chordSpan = topNote.position - bottomNote.position
	// Standalone chords: beamCount=0 (extra beam length only applies in beam groups)
	const stemLen = computeStemLength(anchorNote.position, stemUp, chordSpan, 0)
	const requireFlag = duration >= 8

	if (!stemUp) {
		const stem = new Stem(relativePos - stemLen, stemLen)
		stem.moveTo(notehead.x, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thDown`, relativePos - stemLen - 0.5)
			flag.moveTo(notehead.x, notehead.y)
			drawing.add(flag)
		}
	} else {
		const stem = new Stem(relativePos, stemLen)
		stem.moveTo(notehead.x + notehead.width, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thUp`, relativePos + stemLen)
			flag.moveTo(notehead.x + notehead.width, notehead.y)
			drawing.add(flag)
		}
	}
}

function handleNote(token) {
	const duration = token.duration
	if (duration < 2) return

	const notehead = token.drawingNoteHead
	if (!notehead) return

	const stemUp =
		token.Stem === 'Up' || token.stem === 1
			? true
			: token.Stem === 'Down' || token.stem === 2
			? false
			: token.position < 0

	const relativePos = token.position + 4
	// Standalone notes: beamCount=0 (extra beam length only applies in beam groups)
	const stemLen = computeStemLength(token.position, stemUp, 0, 0)
	const requireFlag = duration >= 8

	if (!stemUp) {
		const stem = new Stem(relativePos - stemLen, stemLen)
		stem.moveTo(notehead.x, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thDown`, relativePos - stemLen - 0.5)
			flag.moveTo(notehead.x, notehead.y)
			drawing.add(flag)
		}
	} else {
		const stem = new Stem(relativePos, stemLen)
		stem.moveTo(notehead.x + notehead.width, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thUp`, relativePos + stemLen)
			flag.moveTo(notehead.x + notehead.width, notehead.y)
			drawing.add(flag)
		}
	}
}

function handleBeamTokens(token) {
	var func = beam_handler[token.type]
	if (!func) return

	func(token)
}

function layoutBeaming(_drawing, _data) {
	drawing = _drawing
	data = _data
	const staves = data.score.staves
	
	staves.forEach((stave) => {
		// Group beamable notes
		const beamGroups = groupBeamableNotes(stave.tokens)
		
		// Only beam groups with 2+ notes
		const actualBeamGroups = beamGroups.filter(group => group.length >= 2)
		const beamedTokens = new Set(actualBeamGroups.flat())
		
		// Draw beam groups
		actualBeamGroups.forEach(drawBeamGroup)
		
		// Draw individual stems/flags for non-beamed notes
		stave.tokens.forEach(token => {
			if (!beamedTokens.has(token)) {
				handleBeamTokens(token)
			}
		})
	})
}

export { layoutBeaming, computeBeamLayout, groupBeamableNotes, computeStemLength, isNonMonotonic }
