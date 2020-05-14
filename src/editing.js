/**********************
 *
 *   Editing
 *
 **********************/

var sampleTokens = [
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
]

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

var selectedY = 0
var selectedDuration = 4
class ScoreManager {
	constructor() {
		this.selectStaffIndex = 0
		// select note token?
	}

	newScore() {
		this.setData(blankScore())
	}

	setData(score) {
		this.score = score

		var staves = this.getStaves()
		this.selectStaffIndex = staves.length - 1

		// hack
		window.data = this.score
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
		var staves = this.getStaves()
		this.selectStaffIndex++
		staves.splice(this.selectStaffIndex, 0, newStaff())
	}

	getSelectedStaff() {
		var staves = this.getStaves()
		return staves[this.selectStaffIndex]
	}

	getTokens() {
		return this.getSelectedStaff().tokens
	}
}

document.getElementById('new_staff').onclick = () => {
	scoreManager.addStaff()

	rerender()
}

window.scoreManager = new ScoreManager()

function localStorageLoad() {
	var data = JSON.parse(localStorage.lastStave)
	scoreManager.setData(data)
	rerender()
}

function localStorageSave() {
	const saving = JSON.stringify(scoreManager.getData())
	console.log(saving)
	localStorage.lastStave = saving
}

var selectedToken = () => {
	// TODO search last note
	var tokens = scoreManager.getTokens()
	return tokens[tokens.length - 1]
}

var appendToken = (token) => {
	scoreManager.getTokens().push(token)
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
		selectedToken().position++
	}
	if (key === 'ArrowDown') {
		// selectedY--;
		// console.log('selectedY', selectedY)
		selectedToken().position--
	}

	var selected = selectedToken()
	if (key === 'ArrowLeft') {
		console.log(selected.duration)
		selected.duration *= 2
	}
	if (key === 'ArrowRight') {
		console.log(selected.duration)
		selected.duration /= 2
	}

	if (key === '#') {
		selectedToken().accidental = '#'
	}

	if (key === 'b') {
		selectedToken().accidental = 'b'
	}

	if (key === 'n') {
		selectedToken().accidental = 'n'
	}

	if (key === '.') {
		selectedToken().dots++
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
		var tokens = scoreManager.getTokens()
		tokens.splice(tokens.length - 1, 1)
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
