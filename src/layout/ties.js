/* this deals with drawing ties */
import { Tie } from '../drawing.js'

let drawing, data

function layoutTies(_drawing, _data) {
	drawing = _drawing
	data = _data
	const staves = data.score.staves
	
	staves.forEach((stave) => {
		const notes = stave.tokens.filter(token => token.type === 'Note' || token.type === 'Chord')
		
		for (let i = 0; i < notes.length; i++) {
			const note = notes[i]
			
			if (note.tie) {
				const start = note.drawingNoteHead
				if (!start) continue
				
				// Find the next note with tieEnd
				for (let j = i + 1; j < notes.length; j++) {
					const nextNote = notes[j]
					if (nextNote.tieEnd && nextNote.position === note.position) {
						const end = nextNote.drawingNoteHead
						if (end) {
							const tie = new Tie(start, end)
							drawing.add(tie)
							break
						}
					}
				}
			}
		}
	})

	layoutSlurs()
}

function layoutSlurs() {
	const staves = data.score.staves
	
	staves.forEach((stave) => {
		const notes = stave.tokens.filter(token => token.type === 'Note' || token.type === 'Chord')
		
		for (let i = 0; i < notes.length; i++) {
			const note = notes[i]
			
			if (note.slur === 1) {
				const start = note.drawingNoteHead
				if (!start) continue
				
				// Find the next note with slur end
				for (let j = i + 1; j < notes.length; j++) {
					const nextNote = notes[j]
					if (nextNote.slur === 2) {
						const end = nextNote.drawingNoteHead
						if (end) {
							const tie = new Tie(start, end)
							drawing.add(tie)
							break
						}
					}
				}
			}
		}
	})
}

export { layoutTies }
