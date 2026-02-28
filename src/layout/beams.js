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
		// beam: 1 = start, 2 = end, 3 = middle, 0 or undefined = no beam
		if (token.beam === 1) {
			// Start new beam group
			if (currentGroup.length > 0) {
				groups.push(currentGroup)
			}
			currentGroup = [token]
		} else if (token.beam === 2) {
			// End beam group
			currentGroup.push(token)
			if (currentGroup.length > 0) {
				groups.push(currentGroup)
			}
			currentGroup = []
		} else if (token.beam === 3) {
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

	// Calculate stem endpoints for each note
	const stemData = group.map(token => {
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

		const relativePos = position + 4
		const stemLen = 7 + chordSpan
		const x = stemUp ? notehead.x + notehead.width : notehead.x
		const y = notehead.y

		return {
			x,
			y,
			relativePos,
			stemLen,
			duration: token.duration
		}
	}).filter(Boolean)

	if (stemData.length < 2) return

	// Draw stems
	stemData.forEach(data => {
		const stemY = stemUp ? data.relativePos : data.relativePos - data.stemLen
		const stem = new Stem(stemY, data.stemLen)
		stem.moveTo(data.x, data.y)
		drawing.add(stem)
	})

	// Draw beams using computeBeamLayout to avoid double-drawing sub-beams.
	const durations = stemData.map(d => d.duration)
	const { primaryBeamCount, subBeams } = computeBeamLayout(durations)
	const firstStem = stemData[0]
	const lastStem = stemData[stemData.length - 1]

	const startY = stemUp ? firstStem.relativePos + firstStem.stemLen : firstStem.relativePos - firstStem.stemLen
	const endY = stemUp ? lastStem.relativePos + lastStem.stemLen : lastStem.relativePos - lastStem.stemLen

	const primaryBeam = new Beam(startY, endY, 0, lastStem.x - firstStem.x, primaryBeamCount)
	primaryBeam.stemUp = stemUp
	primaryBeam.moveTo(firstStem.x, firstStem.y)
	drawing.add(primaryBeam)

	// Draw sub-beams (partial/full segments for finer-duration notes).
	const totalX = lastStem.x - firstStem.x || 1
	for (const seg of subBeams) {
		let segStartX, segEndX
		if (seg.stub) {
			// Isolated fine note — 60% stub toward nearest neighbor
			const curr = stemData[seg.startIdx]
			const neighbor = stemData[seg.neighborIdx]
			if (!neighbor) continue
			const gap = neighbor.x - curr.x
			segStartX = curr.x - firstStem.x
			segEndX = segStartX + gap * 0.4
		} else {
			// Full sub-beam across a run of fine notes
			segStartX = stemData[seg.startIdx].x - firstStem.x
			segEndX = stemData[seg.endIdx].x - firstStem.x
		}

		// Interpolate Y along the primary beam line
		const segStartRatio = segStartX / totalX
		const segEndRatio = segEndX / totalX
		const segStartY = startY + (endY - startY) * segStartRatio
		const segEndY = startY + (endY - startY) * segEndRatio

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
	const stemLen = 7 + chordSpan
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
	const requireFlag = duration >= 8

	if (!stemUp) {
		const stem = new Stem(relativePos - 7)
		stem.moveTo(notehead.x, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thDown`, relativePos - 7 - 0.5)
			flag.moveTo(notehead.x, notehead.y)
			drawing.add(flag)
		}
	} else {
		const stem = new Stem(relativePos)
		stem.moveTo(notehead.x + notehead.width, notehead.y)
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thUp`, relativePos + 7)
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

export { layoutBeaming, computeBeamLayout, groupBeamableNotes }
