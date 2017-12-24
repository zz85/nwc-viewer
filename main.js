
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
 *   Exporters
 *
 **********************/

exportLilypond = () => {
	/* Exports absolute pitches for now */
	var ly = '';

	interpret(data)

	const lily_accidentals = {b: 'es', '#': 'is', n: '', x: 'isis', v: 'eses'}

	selectedStave.tokens.forEach(token => {
		if (token.type === 'Note') {
			ly += token.name.toLowerCase()
			var octave = token.octave - 2;
			if (token.accidentalValue) {
				ly += lily_accidentals[token.accidentalValue]
			}

			if (octave < 0) {
				ly += Array(Math.abs(octave)).fill(',').join('')
			}
			else {
				ly += Array(octave).fill('\'').join('')
			}

			ly += token.duration
			ly += Array(token.dots).fill('.').join('')
			ly += ' '
		}

		if (token.type === 'Barline') {
			ly += '| '
		}

		if (token.type === 'KeySignature') {
			console.log(token);
			// ly += `\\key ${token.signature}`
		}

		if (token.type === 'TimeSignature') {
			console.log(token);
			ly += `\\key ${token.group}/${token.beat} `
		}

		if (token.type === 'Clef') {
			ly += `\\clef ${token.clef} `
		}
	});

	console.log(ly);
	return ly
}

exportAbc = () => {
	// http://trillian.mit.edu/~jc/music/abc/doc/ABCprimer.html

	var abc = [];
	interpret(data)

	abc.push('X: 1'); // reference number

	var { title, author } = data.info || {};
	if (title) abc.push(`T: ${title}`); // title
	if (title) abc.push(`C: ${author}`); // composer
	abc.push(`N: Generated from Notably`); // notes

	//

	data.score.staves[0].tokens
		.filter(token => token.type === 'TimeSignature')
		.some(token => {
			abc.push(`M:${token.group}/${token.beat}`) // Meter
			return true;
		})

	data.score.staves[0].tokens
		.filter(token => token.type === 'Tempo')
		.some(token => {

			// abc.push(`Q:1/${token.note}=${token.duration}`) // Tempo
			abc.push('Q:1/8=200');

			return true;
		})

	abc.push('L: 1'); // default note length
	// N: // comments
	// K: Key

	const abc_accidentals = {b: '_', '#': '^', n: '='}

	data.score.staves.forEach((stave, v) => {
		var tmp = '';

		tmp += `\n[V:${v}]\n`;
		stave.tokens.forEach(token => {
			if (token.type === 'Note') {
				if (token.accidentalValue) {
					tmp += abc_accidentals[token.accidentalValue]
				}

				tmp += token.name.toLowerCase()
				var octave = token.octave - 4;

				if (octave < 0) {
					tmp += Array(Math.abs(octave)).fill(',').join('')
				}
				else {
					tmp += Array(octave).fill('\'').join('')
				}

				// tmp += '1/' + token.duration
				// tmp += Array(token.dots).fill('.').join('')
				tmp += token.durValue.toString();
				tmp += ' '
			}

			if (token.type === 'Barline') {
				tmp += '|\n'
			}


			// if (token.type === 'KeySignature') {
			// 	console.log(token);
			// 	// ly += `\\key ${token.signature}`
			// }

			// if (token.type === 'TimeSignature') {
			// 	console.log(token);
			// 	ly += `\\key ${token.group}/${token.beat} `
			// }

			// if (token.type === 'Clef') {
			// 	ly += `\\clef ${token.clef} `
			// }
		});

		abc.push(tmp);
	});

	abc = abc.join('\n');
	console.log('abc', abc);

	return abc;
}

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
// ajax('samples/AveMariaArcadelt.nwc', processData);
// ajax('samples/WeThreeKingsOfOrientAre.nwc', processData)

// v2.02?
// ajax('samples/AChildThisDayIsBorn.nwc', processData);
ajax('samples/WhatChildIsThis.nwc', processData);
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


