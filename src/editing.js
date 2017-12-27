/**********************
 *
 *   Editing
 *
 **********************/

selectedStave = {
	tokens: [
		// { type: 'Clef', clef: 'treble' },
		// {"type":"KeySignature","signature":"Bb"},
		// {"type":"TimeSignature","group":6, beat: 8},

		{ type: 'Clef', clef: 'treble' },
		{"type":"Note","position":0,"duration":4, accidental: 'n'},
		{ type: 'Clef', clef: 'bass' },
		{"type":"Note","position":0,"duration":4, accidental: 'b'},
		{ type: 'Clef', clef: 'alto' },
		{"type":"Note","position":0,"duration":4, accidental: '#'},
		// { type: 'Clef', clef: 'tenor' },
		// {"type":"Note","position":0,"duration":4},

	]
}

selectedIndex = 0;
selectedY = 0
selectedDuration = 4

blank = {
	score: {
		staves: [
			selectedStave
		]
	}
}

load = () => {
	selectedStave = JSON.parse(localStorage.lastStave)
}

save = () => {
	const saving = JSON.stringify(selectedStave)
	console.log(saving)
	localStorage.lastStave = saving
}

lastToken = () => {
	// TODO search last note
	tokens = selectedStave.tokens;
	return tokens[tokens.length - 1]
}

appendToken = (token) => {
	selectedStave.tokens.push(token)
}

/**********************
 *
 *   Key Bindings
 *
 **********************/

window.addEventListener('keydown', (e) => {
	console.log('keypressed', e);
	const key = e.key; // code
	if (key === 'Tab') {
		appendToken({ type: 'Barline' })
	}
	if (key === 'ArrowUp') {
		// selectedY++;
		// console.log('selectedY', selectedY)
		lastToken().position ++;
	}
	if (key === 'ArrowDown') {
		// selectedY--;
		// console.log('selectedY', selectedY)
		lastToken().position --;
	}

	if (key === 'ArrowLeft') {
		lastToken().duration *= 2;
	}
	if (key === 'ArrowRight') {
		lastToken().duration /= 2;
	}

	if (key === '#') {
		lastToken().accidental = '#'
	}

	if (key === 'b') {
		lastToken().accidental = 'b'
	}

	if (key === 'n') {
		lastToken().accidental = 'n'
	}

	if (key === '.') {
		lastToken().dots++;
	}

	if (key === 'Enter') {
		appendToken(
			{
				type: "Note",
				position: 0,
				duration: 4,
				dots: 0
			}
		)
	}

	if (key === 'Backspace') {
		selectedStave.tokens.splice(selectedStave.tokens.length - 1, 1)
	}

	rerender();
	e.preventDefault();
})