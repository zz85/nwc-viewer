/* this file cares about laying out beams */
import { Stem, Glyph } from '../drawing.js'

let drawing, data

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
		stave.tokens.forEach(handleBeamTokens)
	})
}

export { layoutBeaming }
