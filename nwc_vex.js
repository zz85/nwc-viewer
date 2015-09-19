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

		ACCIDENTALS_VEX = {
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
				// console.log(token);

				var accidental = ACCIDENTALS_VEX[token.accidental];
				var pos = token.name + '/' + token.octave;



				var dur = token.duration + '';
				var dots = (token.dots ? 'ddd'.slice(-token.dots) : '');

				var key =  token.type == 'Rest' ? 'R/5' : pos;

				console.log(key, dur, dots, token.accidental);
				var note = new Vex.Flow.StaveNote({
					keys: [
						// "C" + token.accidental + "/4"
							key
					],
					duration: dur + dots,
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