
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
ajax('samples/WakenChristianChildren.nwc', processData);

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

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	// console.log(JSON.stringify(data.score.staves[1].tokens.slice(0, 20), 0, 0));
	
	// data = test_data;
	// data = test_dot_quaver;

	interpret(data)

	setup(() => {
		score(data)
	})	
}
