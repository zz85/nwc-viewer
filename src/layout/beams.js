/* this file cares about laying out beams */
import { Stem, Glyph, Beam } from '../drawing.js'

let drawing, data

function groupBeamableNotes(tokens) {
	const groups = []
	let currentGroup = []

	for (const token of tokens) {
		const isBeamable = (token.type === 'Note' || token.type === 'Chord') && 
		                   token.duration >= 8 && 
		                   token.drawingNoteHead

		if (isBeamable) {
			currentGroup.push(token)
		} else {
			if (currentGroup.length > 1) {
				groups.push(currentGroup)
			}
			currentGroup = []
		}
	}

	if (currentGroup.length > 1) {
		groups.push(currentGroup)
	}

	return groups
}

function drawBeamGroup(group) {
	if (group.length < 2) return

	// Determine stem direction for the group
	const avgPosition = group.reduce((sum, token) => {
		if (token.type === 'Chord') {
			const notes = token.notes
			const avg = notes.reduce((s, n) => s + n.position, 0) / notes.length
			return sum + avg
		}
		return sum + token.position
	}, 0) / group.length

	const stemUp = avgPosition >= 0

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

	// Draw beams
	const beamCount = Math.floor(Math.log2(stemData[0].duration / 4))
	const firstStem = stemData[0]
	const lastStem = stemData[stemData.length - 1]

	const startY = stemUp ? firstStem.relativePos + firstStem.stemLen : firstStem.relativePos - firstStem.stemLen
	const endY = stemUp ? lastStem.relativePos + lastStem.stemLen : lastStem.relativePos - lastStem.stemLen

	const beam = new Beam(startY, endY, firstStem.x, lastStem.x, beamCount)
	beam.moveTo(firstStem.x, firstStem.y)
	drawing.add(beam)
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
		const beamedTokens = new Set(beamGroups.flat())
		
		// Draw beam groups
		beamGroups.forEach(drawBeamGroup)
		
		// Draw individual stems/flags only for non-beamed notes
		stave.tokens.forEach(token => {
			if (!beamedTokens.has(token)) {
				handleBeamTokens(token)
			}
		})
	})
}

export { layoutBeaming }
