
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

ajax('samples/anongs.nwc', processData);
// ajax('samples/adohn.nwc', processData);

function tokensToNotes(notes, token) {

}

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	vex2(data);
}

function vex2() {
	// Create an SVG renderer and attach it to the DIV element named "boo".
	var vf = new Vex.Flow.Factory({renderer: {elementId: 'easyscore'}});
	var score = vf.EasyScore();
	var system = vf.System({
		// debugFormatter: true
	});


	var staves = data.score.staves;
	staves.map((stave, i) => {
		tokens = stave.tokens;

		var clef;
		tokens.some((token) => {
			if (token.type == 'Clef') {
				clef = token.clef;
				return true;
			}
		});

		var timeSig;
		tokens.some((token) => {
			if (token.type == 'TimeSignature') {
				timeSig = token.group + '/' + token.beat;
				console.log('time sig', timeSig)
				return true;
			}
		});

		var notes = [];
		tokens.forEach(function(token) {
			if (token.type == 'Note'
				|| token.type == 'Rest'
				) {

				var accidental = token.accidental
				// ACCIDENTALS_VEX[token.accidental];
				var pos = token.name + accidental + token.octave;

				var dur = token.duration + '';
				var dots = '';
				//(token.dots ? 'ddd'.slice(-token.dots) : '');
				var key =  token.type == 'Rest' ? 'R5' : pos;
				var rest = token.type == 'Rest' ? 'r' : '';
				// rest = '';

				var note = key + '/' + dur + dots + rest;
				// console.log(note)

				notes.push(note)
				return;

				// var d = token.dots;
				// while (d--) {
				// 	note.addDotToAll();
				// }

			}
		});

		var notes = notes.slice(0, 10).join(', ');
		console.log('notes', i, clef, notes);

		if (i > 0) return;
		// system.addStave({
		// 	voices: [
		// 		score.voice(score.notes(notes))
		// 	]
		// }).addClef(clef).addTimeSignature(timeSig);

	})

	system.addStave({
		voices: [
			score.voice(score.notes(
				// 'C#4/h, C#4'
				'B3/4, D4/2, E4/4, F4/4, G4/8, F4/4, E4/2, C4/4, A3/4'
			))
		]
	  })
	  .addClef('treble').addTimeSignature('3/4')
	  
	// system.addStave({
	// 	voices: [
	// 		score.voice(score.notes('C#1/q, B2, A2/8, B2, C#3, D3'))
	// 	]
	// }).addClef('bass').addTimeSignature('4/4');

	system.addConnector()

	vf.draw();

	Object.assign(window, { score, system, vf })
}