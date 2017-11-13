function vex() {
	// http://www.vexflow.com/docs/tutorial.html
	var canvas = document.getElementById('canvas');
	var renderer = new Vex.Flow.Renderer(canvas,
		Vex.Flow.Renderer.Backends.CANVAS);

	var LEFT_PADDING = 50;
	var WIDTH = canvas.width;
	var STAFF_HEIGHT = 100;

	var ctx = renderer.getContext();

	var staves = data.score.staves;


	canvas.height = staves.length * STAFF_HEIGHT;
	for (var s = 0; s < staves.length; s++) {
		//
		var tokens = staves[s].tokens;
		// console.log(tokens);

		var stave = new Vex.Flow.Stave(LEFT_PADDING, STAFF_HEIGHT * s, WIDTH);
		stave.setContext(ctx);

		// TODO delimit sections via clefs?
		tokens.some(function(token) {
			if (token.type == 'Clef') {
				console.log(token);
				stave.addClef(token.clef);
				return true;
			}
		});



		// Create the notes
		var notes = [
			// // A quarter-note C.
			// new Vex.Flow.StaveNote({ keys: ["c/4"], duration: "q" }),

			// // A quarter-note D.
			// new Vex.Flow.StaveNote({ keys: ["d/4"], duration: "q" }),

			// // A quarter-note rest. Note that the key (b/4) specifies the vertical
			// // position of the rest.
			// new Vex.Flow.StaveNote({ keys: ["b/4"], duration: "qr" }),

			// // A C-Major chord.
			// new Vex.Flow.StaveNote({ keys: ["c/4", "e/4", "g/4"], duration: "q" })
		];

		var ACCIDENTALS_VEX = {
			'': '',
			'#': '#',
			'##': '##',
			'b': 'b',
			'bb': 'bb',
			'n': 'n'
		}

		var voice;
		var limit = 0;
		tokens.forEach(function(token) {
			if (token.type == 'Note'
				|| token.type == 'Rest'
				) {
				limit++;
				// if (limit > 10) return;
				if (token.accidental) console.log(token.accidental);

				var accidental = ACCIDENTALS_VEX[token.accidental];
				var pos = token.name + '/' + token.octave;

				var dur = token.duration + '';
				var dots = '';
				//(token.dots ? 'ddd'.slice(-token.dots) : '');
				var key =  token.type == 'Rest' ? 'R/5' : pos;
				var rest = token.type == 'Rest' ? 'r' : '';
				// rest = '';

				// console.log(key, dur, dots, token.accidental);
				var note = new Vex.Flow.StaveNote({
					keys: [
						// "C" + token.accidental + "/4"
							key
					],
					duration: dur + dots + rest,
					// dots: token.dots,
					// clef: "bass"
				});

				if (token.type === 'Note' && accidental)
					note.addAccidental(0, new Vex.Flow.Accidental(accidental));

				var d = token.dots;
				while (d--) {
					note.addDotToAll();
				}

				notes.push(note);
			}

			if (token.type == 'Barline') {
				notes.push(
					new Vex.Flow.BarNote()
				);
			}

			if (token.type == 'TimeSignature') {
				console.log(token);
				stave.addTimeSignature(token.signature);

				voice = new Vex.Flow.Voice({
					num_beats: token.group,
					beat_value: token.beat,
					resolution: Vex.Flow.RESOLUTION,
				});
			}
		});

		stave.draw();
		voice.setStrict(false);
		// voice.mode = Vex.Flow.Voice.Mode.SOFT;
		// voice.mode = Vex.Flow.Voice.Mode.FULL;

		// Add notes to voice
		voice.addTickables(notes);

		// Format and justify the notes to 500 pixels
		var formatter = new Vex.Flow.Formatter().
			joinVoices([voice]).format([voice], WIDTH);

		// Render voice
		voice.draw(ctx, stave);

	}
}

/**
 * Easy score
 */

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
				'B3/4, D4/2, E4/4, F4/4 | G4/8'
			))
		]
	  })
	  .addClef('treble').addTimeSignature('4/4')
	  
	// system.addStave({
	// 	voices: [
	// 		score.voice(score.notes('C#1/q, B2, A2/8, B2, C#3, D3'))
	// 	]
	// }).addClef('bass').addTimeSignature('4/4');

	system.addConnector()

	vf.draw();

	Object.assign(window, { score, system, vf })
}