
/**********************
 *
 *   Helpers
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


setTimeout(() => {
	data = blank
	setup(rerender);
});

exportLilypond = () => {
	var ly = '';

	interpret(data)
	selectedStave.tokens.forEach(t => {
		if (t.type === 'Note') {
			// console.log(t);
			ly += t.name.toLowerCase()
			var octave = t.octave - 2;
			if (t.accidentalValue) {
				ly += {b: 'es', '#': 'is', n: ''}[t.accidentalValue]
			}

			if (octave < 0) {
				ly += Array(Math.abs(octave)).fill(',').join('')
			}
			else {
				ly += Array(octave).fill('\'').join('')
			}

			ly += t.duration
			ly += Array(t.dots).fill('.').join('')
			ly += ' '
			// ly += `${t.name.toLowerCase()}`

		}
	});

	console.log(ly);
}

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

selectedStave = {
	tokens: [
		// { type: 'Clef', clef: 'treble' },
		// {"type":"KeySignature","signature":"Bb"},
		// {"type":"TimeSignature","group":6, beat: 8},

		{ type: 'Clef', clef: 'treble' },
		{"type":"Note","position":0,"duration":4},
		{ type: 'Clef', clef: 'bass' },
		{"type":"Note","position":0,"duration":4},
		{ type: 'Clef', clef: 'alto' },
		{"type":"Note","position":0,"duration":4},
		// { type: 'Clef', clef: 'tenor' },
		// {"type":"Note","position":0,"duration":4},

	]
}

// localStorage.lastStave = JSON.stringify(selectedStave)
// {"tokens":[{"type":"Clef","clef":"treble","tickValue":0,"tabValue":0,"tickUntilValue":0,"tabUntilValue":0.25},{"type":"KeySignature","signature":"Bb","tickValue":0,"tabValue":0.25,"clef":"treble","clefOffset":0,"tickUntilValue":0,"tabUntilValue":0.5},{"type":"TimeSignature","group":6,"beat":8,"tickValue":0,"tabValue":0.5,"tickUntilValue":0,"tabUntilValue":0.75,"duration":null},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":0,"tabValue":0.75,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":0.125,"tabUntilValue":0.875},{"type":"Barline","tickValue":0.125,"tabValue":0.875,"tickUntilValue":0.125,"tabUntilValue":1.125},{"type":"Note","position":-3,"duration":4,"dots":0,"tickValue":0.125,"tabValue":1.125,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":0.375,"tabUntilValue":1.375},{"type":"Note","position":-3,"duration":8,"dots":0,"tickValue":0.375,"tabValue":1.375,"name":"G","octave":3,"accidentalValue":"#","durValue":{"numerator":1,"denominator":8},"tickUntilValue":0.5,"tabUntilValue":1.5,"accidental":"#"},{"type":"Note","position":-2,"duration":4,"dots":0,"tickValue":0.5,"tabValue":1.5,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":0.75,"tabUntilValue":1.75},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":0.75,"tabValue":1.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":0.875,"tabUntilValue":1.875},{"type":"Barline","tickValue":0.875,"tabValue":1.875,"tickUntilValue":0.875,"tabUntilValue":2.125},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":0.875,"tabValue":2.125,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":1.125,"tabUntilValue":2.375},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":1.125,"tabValue":2.375,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":1.25,"tabUntilValue":2.5},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":1.25,"tabValue":2.5,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":1.5,"tabUntilValue":2.75},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":1.5,"tabValue":2.75,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":1.625,"tabUntilValue":2.875},{"type":"Barline","tickValue":1.625,"tabValue":2.875,"tickUntilValue":1.625,"tabUntilValue":3.125},{"type":"Note","position":-4,"duration":4,"dots":0,"tickValue":1.625,"tabValue":3.125,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":1.875,"tabUntilValue":3.375},{"type":"Note","position":-2,"duration":8,"dots":0,"tickValue":1.875,"tabValue":3.375,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":2,"tabUntilValue":3.5},{"type":"Note","position":-4,"duration":4,"dots":0,"tickValue":2,"tabValue":3.5,"name":"F","octave":3,"accidentalValue":"n","durValue":{"numerator":1,"denominator":4},"tickUntilValue":2.25,"tabUntilValue":3.75,"accidental":"n"},{"type":"Note","position":-2,"duration":8,"dots":0,"tickValue":2.25,"tabValue":3.75,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":2.375,"tabUntilValue":3.875},{"type":"Barline","tickValue":2.375,"tabValue":3.875,"tickUntilValue":2.375,"tabUntilValue":4.125},{"type":"Note","position":-3,"duration":4,"dots":1,"tickValue":2.375,"tabValue":4.125,"name":"G","octave":3,"durValue":{"numerator":3,"denominator":8},"tickUntilValue":2.75,"tabUntilValue":4.5},{"type":"Note","position":-3,"duration":8,"dots":0,"tickValue":2.75,"tabValue":4.5,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":2.875,"tabUntilValue":4.625},{"type":"Note","position":-2,"duration":8,"dots":0,"tickValue":2.875,"tabValue":4.625,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":3,"tabUntilValue":4.75},{"type":"Note","position":-1,"duration":8,"dots":0,"tickValue":3,"tabValue":4.75,"name":"B","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":3.125,"tabUntilValue":4.875},{"type":"Barline","tickValue":3.125,"tabValue":4.875,"tickUntilValue":3.125,"tabUntilValue":5.125},{"type":"Note","position":0,"duration":4,"dots":0,"tickValue":3.125,"tabValue":5.125,"name":"C","octave":4,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":3.375,"tabUntilValue":5.375},{"type":"Note","position":-3,"duration":8,"dots":0,"tickValue":3.375,"tabValue":5.375,"name":"G","octave":3,"accidentalValue":"#","durValue":{"numerator":1,"denominator":8},"tickUntilValue":3.5,"tabUntilValue":5.5,"accidental":"#"},{"type":"Note","position":-2,"duration":4,"dots":0,"tickValue":3.5,"tabValue":5.5,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":3.75,"tabUntilValue":5.75},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":3.75,"tabValue":5.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":3.875,"tabUntilValue":5.875},{"type":"Barline","tickValue":3.875,"tabValue":5.875,"tickUntilValue":3.875,"tabUntilValue":6.125},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":3.875,"tabValue":6.125,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":4.125,"tabUntilValue":6.375},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":4.125,"tabValue":6.375,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":4.25,"tabUntilValue":6.5},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":4.25,"tabValue":6.5,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":4.5,"tabUntilValue":6.75},{"type":"Note","position":-7,"duration":8,"dots":0,"tickValue":4.5,"tabValue":6.75,"name":"C","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":4.625,"tabUntilValue":6.875},{"type":"Barline","tickValue":4.625,"tabValue":6.875,"tickUntilValue":4.625,"tabUntilValue":7.125},{"type":"Note","position":-4,"duration":4,"dots":0,"tickValue":4.625,"tabValue":7.125,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":4.875,"tabUntilValue":7.375},{"type":"Note","position":-6,"duration":8,"dots":0,"tickValue":4.875,"tabValue":7.375,"name":"D","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":5,"tabUntilValue":7.5},{"type":"Note","position":-3,"duration":4,"dots":0,"tickValue":5,"tabValue":7.5,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":5.25,"tabUntilValue":7.75},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":5.25,"tabValue":7.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":5.375,"tabUntilValue":7.875},{"type":"Barline","tickValue":5.375,"tabValue":7.875,"tickUntilValue":5.375,"tabUntilValue":8.125},{"type":"Note","position":-5,"duration":4,"dots":1,"tickValue":5.375,"tabValue":8.125,"name":"E","octave":3,"durValue":{"numerator":3,"denominator":8},"tickUntilValue":5.75,"tabUntilValue":8.5},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":5.75,"tabValue":8.5,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":6,"tabUntilValue":8.75},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":6,"tabValue":8.75,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":6.125,"tabUntilValue":8.875},{"type":"Barline","tickValue":6.125,"tabValue":8.875,"tickUntilValue":6.125,"tabUntilValue":9.125},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":6.125,"tabValue":9.125,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":6.375,"tabUntilValue":9.375},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":6.375,"tabValue":9.375,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":6.5,"tabUntilValue":9.5},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":6.5,"tabValue":9.5,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":6.625,"tabUntilValue":9.625},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":6.625,"tabValue":9.625,"name":"F","octave":3,"accidentalValue":"n","durValue":{"numerator":1,"denominator":8},"tickUntilValue":6.75,"tabUntilValue":9.75,"accidental":"n"},{"type":"Note","position":-6,"duration":8,"dots":0,"tickValue":6.75,"tabValue":9.75,"name":"D","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":6.875,"tabUntilValue":9.875},{"type":"Barline","tickValue":6.875,"tabValue":9.875,"tickUntilValue":6.875,"tabUntilValue":10.125},{"type":"Note","position":-7,"duration":4,"dots":0,"tickValue":6.875,"tabValue":10.125,"name":"C","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":7.125,"tabUntilValue":10.375},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":7.125,"tabValue":10.375,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":7.25,"tabUntilValue":10.5},{"type":"Note","position":-2,"duration":4,"dots":0,"tickValue":7.25,"tabValue":10.5,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":7.5,"tabUntilValue":10.75},{"type":"Note","position":-7,"duration":8,"dots":0,"tickValue":7.5,"tabValue":10.75,"name":"C","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":7.625,"tabUntilValue":10.875},{"type":"Barline","tickValue":7.625,"tabValue":10.875,"tickUntilValue":7.625,"tabUntilValue":11.125},{"type":"Note","position":-6,"duration":4,"dots":0,"tickValue":7.625,"tabValue":11.125,"name":"D","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":7.875,"tabUntilValue":11.375},{"type":"Note","position":-3,"duration":8,"dots":0,"tickValue":7.875,"tabValue":11.375,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":8,"tabUntilValue":11.5},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":8,"tabValue":11.5,"name":"F","octave":3,"accidentalValue":"n","durValue":{"numerator":1,"denominator":8},"tickUntilValue":8.125,"tabUntilValue":11.625,"accidental":"n"},{"type":"Note","position":-5,"duration":8,"dots":0,"tickValue":8.125,"tabValue":11.625,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":8.25,"tabUntilValue":11.75},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":8.25,"tabValue":11.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":8.375,"tabUntilValue":11.875},{"type":"Barline","tickValue":8.375,"tabValue":11.875,"tickUntilValue":8.375,"tabUntilValue":12.125},{"type":"Note","position":-3,"duration":4,"dots":0,"tickValue":8.375,"tabValue":12.125,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":8.625,"tabUntilValue":12.375},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":8.625,"tabValue":12.375,"name":"F","octave":3,"accidentalValue":"n","durValue":{"numerator":1,"denominator":8},"tickUntilValue":8.75,"tabUntilValue":12.5,"accidental":"n"},{"type":"Note","position":-4,"duration":4,"dots":0,"tickValue":8.75,"tabValue":12.5,"name":"F","octave":3,"accidentalValue":"b","durValue":{"numerator":1,"denominator":4},"tickUntilValue":9,"tabUntilValue":12.75,"accidental":"b"},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":9,"tabValue":12.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":9.125,"tabUntilValue":12.875},{"type":"Barline","tickValue":9.125,"tabValue":12.875,"tickUntilValue":9.125,"tabUntilValue":13.125},{"type":"Note","position":-3,"duration":4,"dots":0,"tickValue":9.125,"tabValue":13.125,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":9.375,"tabUntilValue":13.375},{"type":"Note","position":-3,"duration":8,"dots":0,"tickValue":9.375,"tabValue":13.375,"name":"G","octave":3,"accidentalValue":"#","durValue":{"numerator":1,"denominator":8},"tickUntilValue":9.5,"tabUntilValue":13.5,"accidental":"#"},{"type":"Note","position":-2,"duration":4,"dots":0,"tickValue":9.5,"tabValue":13.5,"name":"A","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":9.75,"tabUntilValue":13.75},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":9.75,"tabValue":13.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":9.875,"tabUntilValue":13.875},{"type":"Barline","tickValue":9.875,"tabValue":13.875,"tickUntilValue":9.875,"tabUntilValue":14.125},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":9.875,"tabValue":14.125,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":10.125,"tabUntilValue":14.375},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":10.125,"tabValue":14.375,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":10.25,"tabUntilValue":14.5},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":10.25,"tabValue":14.5,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":10.5,"tabUntilValue":14.75},{"type":"Note","position":-7,"duration":8,"dots":0,"tickValue":10.5,"tabValue":14.75,"name":"C","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":10.625,"tabUntilValue":14.875},{"type":"Barline","tickValue":10.625,"tabValue":14.875,"tickUntilValue":10.625,"tabUntilValue":15.125},{"type":"Note","position":-4,"duration":4,"dots":0,"tickValue":10.625,"tabValue":15.125,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":10.875,"tabUntilValue":15.375},{"type":"Note","position":-6,"duration":8,"dots":0,"tickValue":10.875,"tabValue":15.375,"name":"D","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":11,"tabUntilValue":15.5},{"type":"Note","position":-3,"duration":4,"dots":0,"tickValue":11,"tabValue":15.5,"name":"G","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":11.25,"tabUntilValue":15.75},{"type":"Note","position":-4,"duration":8,"dots":0,"tickValue":11.25,"tabValue":15.75,"name":"F","octave":3,"durValue":{"numerator":1,"denominator":8},"tickUntilValue":11.375,"tabUntilValue":15.875},{"type":"Barline","tickValue":11.375,"tabValue":15.875,"tickUntilValue":11.375,"tabUntilValue":16.125},{"type":"Note","position":-5,"duration":4,"dots":1,"tickValue":11.375,"tabValue":16.125,"name":"E","octave":3,"durValue":{"numerator":3,"denominator":8},"tickUntilValue":11.75,"tabUntilValue":16.5},{"type":"Note","position":-5,"duration":4,"dots":0,"tickValue":11.75,"tabValue":16.5,"name":"E","octave":3,"durValue":{"numerator":1,"denominator":4},"tickUntilValue":12,"tabUntilValue":16.75}]}
// selectedStave = JSON.parse(localStorage.lastStave)
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

window.addEventListener('keydown', (e) => {
	console.log('keypressed', e);
	const key = e.key; // code
	if (key === 'Tab') {
		selectedStave.tokens.push({"type":"Barline"})
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
		selectedStave.tokens.push(
			{
				"type":"Note",
				"position":0,
				"duration":4,
				"dots":0
			}
		)
	}

	if (key === 'Backspace') {
		selectedStave.tokens.splice(selectedStave.tokens.length - 1, 1)
	}

	rerender();
	e.preventDefault();
})

rerender = () => {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	interpret(data)
	score(data)
	exportLilypond()
}

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	// console.log(JSON.stringify(data.score.staves[1].tokens.slice(0, 20), 0, 0));
	
	// data = test_data;
	// data = test_dot_quaver;

	data = blank
	setup(rerender);	
}


