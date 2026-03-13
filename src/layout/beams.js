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

function drawBeamGroup(group) {
	if (group.length < 2) return

	// Detect grace note beam group (all notes in group are grace)
	const isGraceGroup = group.every(t => t.grace)
	const graceScale = isGraceGroup ? 0.6 : 1.0

	// Use the stored stem direction from the NWC file if available.
	// stem: 1 = up, 2 = down.  Fall back to average-position heuristic.
	// Grace notes: stems almost always point up.
	let stemUp
	if (isGraceGroup) {
		stemUp = true
	} else if (group[0].stem === 1) {
		stemUp = true
	} else if (group[0].stem === 2) {
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

	// 1. Determine beam slope from first-to-last note interval.
	//    Clamp to a maximum of 1 staff space (2 half-space units) to
	//    prevent excessively angled beams on large pitch intervals.
	//    Non-monotonic pitch contours (e.g. up-down-up) use a flat beam.
	const first = noteData[0]
	const last = noteData[noteData.length - 1]
	const firstX = first.x
	const lastX = last.x
	const xSpan = lastX - firstX || 1

	const MAX_BEAM_SLOPE = 2  // 1 staff space = 2 half-space units

	let slope = last.position - first.position  // positive = ascending

	// Detect non-monotonic contour: if any intermediate note breaks the
	// overall direction, flatten the beam to horizontal.
	if (noteData.length > 2 && slope !== 0) {
		const ascending = slope > 0
		for (let ni = 1; ni < noteData.length - 1; ni++) {
			const delta = noteData[ni].position - first.position
			// A note on the wrong side of the starting pitch
			if ((ascending && delta < 0) || (!ascending && delta > 0)) {
				slope = 0
				break
			}
		}
	}

	// Clamp slope magnitude so stems don't extend excessively
	if (slope > MAX_BEAM_SLOPE) slope = MAX_BEAM_SLOPE
	else if (slope < -MAX_BEAM_SLOPE) slope = -MAX_BEAM_SLOPE

	// 2. Find the optimal beam offset that satisfies all minimum stem lengths.
	//    With a fixed slope, the beam line is:
	//      beamPos(x) = beamBase + slope * (x - firstX) / xSpan
	//    where beamBase is the beam position at the first note's X.
	//
	//    For stems-up: need beamPos(x_i) >= p_i + minStemLen_i for all notes
	//      → beamBase >= p_i + minStemLen_i - slope * t_i
	//      → beamBase = max over all notes
	//
	//    For stems-down: need beamPos(x_i) <= p_i - minStemLen_i for all notes
	//      → beamBase <= p_i - minStemLen_i - slope * t_i
	//      → beamBase = min over all notes

	let beamBase
	if (stemUp) {
		beamBase = -Infinity
		for (const nd of noteData) {
			const t = (nd.x - firstX) / xSpan
			var minStem = computeStemLength(nd.position, stemUp, nd.chordSpan, totalBeamCount)
			if (isGraceGroup) minStem = Math.min(minStem, 5)
			const needed = nd.position + minStem - slope * t
			if (needed > beamBase) beamBase = needed
		}
	} else {
		beamBase = Infinity
		for (const nd of noteData) {
			const t = (nd.x - firstX) / xSpan
			var minStem = computeStemLength(nd.position, stemUp, nd.chordSpan, totalBeamCount)
			if (isGraceGroup) minStem = Math.min(minStem, 5)
			const needed = nd.position - minStem - slope * t
			if (needed < beamBase) beamBase = needed
		}
	}

	const beamStartPos = beamBase
	const beamEndPos = beamBase + slope

	// 3. Draw stems and beams.
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
		if (isGraceGroup) stem._graceScale = graceScale
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
	if (isGraceGroup) primaryBeam._graceScale = graceScale
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
		if (isGraceGroup) subBeam._graceScale = graceScale
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

	const isGrace = !!token.grace
	const graceScale = isGrace ? 0.6 : 1.0

	// Grace notes: stems almost always point up.
	const stemUp = isGrace ? true
		: token.Stem === 'Up' || token.stem === 1
			? true
			: token.Stem === 'Down' || token.stem === 2
			? false
			: topNote.position + bottomNote.position < 0

	const anchorNote = stemUp ? bottomNote : topNote
	const notehead = anchorNote.drawingNoteHead
	if (!notehead) return

	const relativePos = anchorNote.position + 4
	const chordSpan = topNote.position - bottomNote.position
	const stemLen = isGrace ? 5 + chordSpan
		: computeStemLength(anchorNote.position, stemUp, chordSpan, 0)
	const requireFlag = duration >= 8

	if (!stemUp) {
		const stem = new Stem(relativePos - stemLen, stemLen)
		if (isGrace) { stem._graceScale = graceScale; stem._slash = true }
		stem.moveTo(notehead.x, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thDown`, relativePos - stemLen - 0.5)
			if (isGrace) flag._graceScale = graceScale
			flag.moveTo(notehead.x, notehead.y)
			drawing.add(flag)
		}
	} else {
		const stem = new Stem(relativePos, stemLen)
		if (isGrace) { stem._graceScale = graceScale; stem._slash = true }
		stem.moveTo(notehead.x + notehead.width, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thUp`, relativePos + stemLen)
			if (isGrace) flag._graceScale = graceScale
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

	const isGrace = !!token.grace
	const graceScale = isGrace ? 0.6 : 1.0

	// Grace notes: stems almost always point up (standard engraving).
	const stemUp = isGrace ? true
		: token.Stem === 'Up' || token.stem === 1
			? true
			: token.Stem === 'Down' || token.stem === 2
			? false
			: token.position < 0

	const relativePos = token.position + 4
	// Grace notes: ~5 half-spaces stem (shorter than the standard 7).
	const stemLen = isGrace ? 5
		: computeStemLength(token.position, stemUp, 0, 0)
	const requireFlag = duration >= 8

	if (!stemUp) {
		const stem = new Stem(relativePos - stemLen, stemLen)
		if (isGrace) { stem._graceScale = graceScale; stem._slash = true }
		stem.moveTo(notehead.x, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thDown`, relativePos - stemLen - 0.5)
			if (isGrace) flag._graceScale = graceScale
			flag.moveTo(notehead.x, notehead.y)
			drawing.add(flag)
		}
	} else {
		const stem = new Stem(relativePos, stemLen)
		if (isGrace) { stem._graceScale = graceScale; stem._slash = true }
		stem.moveTo(notehead.x + notehead.width, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thUp`, relativePos + stemLen)
			if (isGrace) flag._graceScale = graceScale
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

export { layoutBeaming, computeBeamLayout, groupBeamableNotes, computeStemLength }
