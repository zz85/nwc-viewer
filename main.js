
/**********************
 *
 *   Loading Helpers
 *
 **********************/

function ajax(url, callback) {
	var oReq = new XMLHttpRequest();
	oReq.open('GET', url, true);
	oReq.responseType = 'arraybuffer';

	oReq.onload = function(oEvent) {
		console.log('ajax done for ', url);
		var arrayBuffer = oReq.response;
		callback(arrayBuffer);
	};

	oReq.send();
}

// TODO Drag and Drop, File Opener

/**********************
 *
 *   Entry
 *
 **********************/

 // For testing purposes
setTimeout(() => {
	// data = blank
	// data = test_data;
	// data = test_dot_quaver;

	// setup(rerender);
});

// v1.7 nwc
// ajax('samples/anongs.nwc', processData);
// ajax('samples/adohn.nwc', processData);
// ajax('samples/bwv140-2.nwc', processData);
// ajax('samples/carenot.nwc', processData);

// v2.75
ajax('samples/AveMariaArcadelt.nwc', processData);
// ajax('samples/WeThreeKingsOfOrientAre.nwc', processData)

// v2.02?
// ajax('samples/AChildThisDayIsBorn.nwc', processData);
// ajax('samples/WhatChildIsThis.nwc', processData);
// ajax('samples/WakenChristianChildren.nwc', processData);

// ajax('samples/canon.nwc', processData);
// ajax('samples/prelude.nwc', processData);

test_data = {
	score: {
		staves: [
			{ tokens: [
				{"type":"Clef","clef":"treble","octave":0},
				{"type":"KeySignature","signature":"Bb"},
				{"type":"TimeSignature","signature":"AllaBreve"},
				{"type":"Rest","position":0,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-1","position":-1,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-2","position":-2,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-1","position":-1,"duration":4,"dots":0},
				{"type":"Barline"},
				{"type":"Note","Dur":"4th","Pos":"-3","Opts":"Slur=Downward","position":-3,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-2","Opts":"Slur=Downward,Lyric=Never","position":-2,"duration":4,"dots":0},
				{"type":"Note","Dur":"Half","Pos":"-1","position":-1,"duration":2,"dots":0},
				{"type":"Barline"},
				{"type":"Note","Dur":"4th","Pos":"-1","position":-1,"duration":4,"dots":0},
			] },
			{ tokens: [
				{"type":"Clef","clef":"bass","octave":0},
				{"type":"KeySignature","signature":"Bb"},
				{"type":"TimeSignature","signature":"AllaBreve"},
				{"type":"Note","Dur":"4th","Pos":"-3","position":-3,"duration":4,"dots":0},
				{"type":"Rest","position":0,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-6","position":-6,"duration":4,"dots":0},
				{"type":"Barline"},
				{"type":"Note","Dur":"Half","Pos":"-3","position":-3,"duration":2,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-5","Opts":"Slur=Downward","position":-5,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-4","Opts":"Lyric=Never","position":-4,"duration":4,"dots":0},
				{"type":"Barline"},
				{"type":"Note","Dur":"4th","Pos":"-3","position":-3,"duration":4,"dots":0},
				{"type":"Note","Dur":"4th","Pos":"-3","position":-3,"duration":4,"dots":0},
				{"type":"Note","Dur":"Half","Pos":"-3","position":-3,"duration":2,"dots":0},
			] },
		]
	}
}

test_dot_quaver = {
	score: {
		staves: [
			{
				tokens: [
					{"type":"Barline"},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
					{"type":"Barline"},
				]
			},
			{
				tokens: [
					{"type":"Barline"},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":1},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":8,"dots":0},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
					{"type":"Note","Dur":"4th","Pos":"-4","position":-4,"duration":4,"dots":0},
					{"type":"Barline"},
				]
			},
		]
	}
}

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

play = () => {
	// Select a timbre that sounds like a piano.
	var inst = new Instrument({ wave: 'piano', detune: 0 });

	inst.on('noteon', e => console.log('noteon', e))
	inst.on('noteoff', e => console.log('noteoff', e))

	// The song below is written in ABC notation.  More on abc
	// notation can be found at http://abcnotation.com/.
	var song = exportAbc()

	// Play a song from a string in ABC notation.
	inst.play(song, () => {
		console.log('(Done playing.)');
	});
}

rerender = () => {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	interpret(data)
	score(data)
	// exportLilypond()
}

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	// console.log(JSON.stringify(data.score.staves[1].tokens.slice(0, 20), 0, 0));
	setup(rerender);
}


