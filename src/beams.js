/* this file cares about laying out beams */

var beam_handler = {
	Chord: handleChord,
	Note: handleNote,
}

function handleChord(token) {}

function handleNote(token) {
	console.log('handle note')

	const duration = token.duration
	const requireStem = duration >= 2

	if (!requireStem) return

	const stemUp =
		token.Stem === 'Up'
			? true
			: token.Stem === 'Down' ? false : token.position < 0

	// TODO refactor flag drawing!!
	const requireFlag = duration >= 8
	const relativePos = token.position + 4
	var notehead = token.drawingNoteHead

	if (requireStem && !stemUp) {
		// stem down
		const stem = new Stem(relativePos - 7)
		stem.moveTo(notehead.x, notehead.y) /* TODO move to constrain rule */
		drawing.add(stem)

		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thDown`, relativePos - 7 - 0.5)
			flag.moveTo(notehead.x, notehead.y)
			drawing.add(flag)
		}
	} else if (requireStem && stemUp) {
		// stem up
		const stem = new Stem(relativePos)
		stem.moveTo(notehead.x + notehead.width, notehead.y)
		drawing.add(stem)

		// Flags
		if (requireFlag) {
			var flag = new Glyph(`flag${duration}thUp`, relativePos + 7)
			flag.moveTo(notehead.x + notehead.width, notehead.y)
			drawing.add(flag)
		}
	}

	// !?!
	// if (token.Beam) console.log('Beam', token);

	if (token.stem) console.log('stem', token)
}

function handleBeamTokens(token) {
	var func = beam_handler[token.type]
	if (!func) return

	func(token)
}

function layoutBeaming() {
	const staves = data.score.staves
	staves.forEach(stave => {
		stave.tokens.forEach(handleBeamTokens)
	})
}

export { layoutBeaming }
