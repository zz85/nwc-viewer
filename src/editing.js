/**********************
 *
 *   Editing
 *
 **********************/

var selectedStave = {
	tokens: [
		// { type: 'Clef', clef: 'treble' },
		// {"type":"KeySignature","signature":"Bb"},
		{ type: 'TimeSignature', group: 6, beat: 8 },

		{ type: 'Clef', clef: 'treble' },
		{ type: 'Note', position: 0, duration: 4, accidental: 'n' },
		{ type: 'Clef', clef: 'bass' },
		{ type: 'Note', position: 0, duration: 4, accidental: 'b' },
		{ type: 'Clef', clef: 'alto' },
		{ type: 'Note', position: 0, duration: 4, accidental: '#' },
		// { type: 'Clef', clef: 'tenor' },
		// {"type":"Note","position":0,"duration":4},
	],
}

var selectedIndex = 0
var selectedY = 0
var selectedDuration = 4

var blank = blankScore()

function blankScore() {
	return {
		score: {
			staves: [newStaff()],
		},
	}
}

function newStaff() {
	return {
		tokens: [
			{ type: 'Clef', clef: 'treble' },
			{ type: 'TimeSignature', group: 4, beat: 4 },
		],
	}
}

class ScoreManager {
	constructor(score) {
		this.setData(score)
		this.selectStaffIndex = 0
	}

	newScore() {
		this.setData(blankScore())
	}

	setData(score) {
		this.score = score

		// hack
		window.data = this.score
		// data = _data;
		window.data = score
	}

	getData() {
		return this.score
	}

	getScore() {
		return this.getData().score
	}

	getStaves() {
		return this.getScore().staves
	}

	addStaff() {
		this.getStaves().splice(this.selectStaffIndex, 0, newStaff())
	}

	getSelectStaff() {
		// return this.score.score[this.selectStaffIndex]
	}
}

document.getElementById('new_staff').onclick = () => {
	scoreManager.addStaff()
}

window.scoreManager = new ScoreManager()

var load = () => {
	selectedStave = JSON.parse(localStorage.lastStave)
}

var save = () => {
	const saving = JSON.stringify(selectedStave)
	console.log(saving)
	localStorage.lastStave = saving
}

var lastToken = () => {
	// TODO search last note
	var tokens = selectedStave.tokens
	return tokens[tokens.length - 1]
}

var appendToken = (token) => {
	selectedStave.tokens.push(token)
}

/**********************
 *
 *   Key Bindings
 *
 **********************/

function handleKeyDown(e) {
	console.log('keypressed', e)
	const key = e.key // code
	if (key === 'Tab') {
		appendToken({ type: 'Barline' })
	}
	if (key === 'ArrowUp') {
		// selectedY++;
		// console.log('selectedY', selectedY)
		lastToken().position++
	}
	if (key === 'ArrowDown') {
		// selectedY--;
		// console.log('selectedY', selectedY)
		lastToken().position--
	}

	var selected = lastToken()
	if (key === 'ArrowLeft') {
		console.log(selected.duration)
		selected.duration *= 2
	}
	if (key === 'ArrowRight') {
		console.log(selected.duration)
		selected.duration /= 2
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
		lastToken().dots++
	}

	if (key === 'Enter') {
		appendToken({
			type: 'Note',
			position: 0,
			duration: 4,
			dots: 0,
		})
	}

	if (key === 'Backspace') {
		selectedStave.tokens.splice(selectedStave.tokens.length - 1, 1)
	}

	rerender()
	e.preventDefault()
}

window.activateEdit = function () {
	window.addEventListener('keydown', handleKeyDown)
}

window.deactivateEdit = function () {
	window.removeEventListener('keydown', handleKeyDown)
}

export { blank }
