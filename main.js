
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

setup(() => {
	score(data)
})

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	// vex2(data);
}

let info

// based on nwc music json representation,
// attempt to convert them to symbols to be drawn.
// also make weak attempt to lay them out

// music json -> draw symbols. interpretation? translation? engrave? typeset? layout? drawing?

function score(data) {
	drawing = new Drawing(ctx)

	tokens = data.score.staves[0].tokens

	staveY = 160
	staveX = 40

	s = new Stave(2000)
	s.moveTo(staveX, staveY)
	drawing.add(s)

	console.log(tokens)

	tokens.forEach((token, i) => {
		const type = token.type;
		info = i
		// console.log(token)

		switch (type) {
			default:
				console.log(type)

				break;

			case 'Clef':
				// switch (token.clef) {
				// 	case 'treble':
				// 		clef = new Claire.TrebleClef()
				// 	default:
				// 		console.log('ERR unknown clef', token.clef)
				// }
				clef = new {
					treble: Claire.TrebleClef,
				}[token.clef]()

				clef.moveTo(staveX, staveY)
				drawing.add(clef)
				staveX += clef.width * 2
				break;

			case 'TimeSignature':
				t = new TimeSignature(token.group, 6)
				t.moveTo(staveX, staveY)
				drawing.add(t)

				t = new TimeSignature(token.beat, 2)
				t.moveTo(staveX, staveY)
				drawing.add(t)

				staveX += t.width * 2
				break;

			case 'Rest':
				duration = token.duration
				sym = {
					1: 'restWhole',
					2: 'restHalf',
					4: 'restQuarter',
					8: 'rest8th',
					16: 'rest16th'
				}[duration]

				if (!sym) console.log('FAIL REST', duration)

				s = new Glyph(sym, token.position + 3) // + 4
				s.moveTo(staveX, staveY)
				s._text = info;
				drawing.add(s)

				staveX += s.width
				break;

			case 'Barline':
				s = new Barline()
				s.moveTo(staveX, staveY)
				s._text = info;
				drawing.add(s)

				staveX += 10
				break;

			case 'Chord':
				console.log('chord', token);
				let tmp = staveX
				token.notes.forEach(note => {
					staveX = tmp
					drawForNote(note)
				})
				break;

			case 'Note':
				drawForNote(token)
				break;

		}
	})

	function drawForNote(token) {
		duration = token.duration
		sym = duration < 2 ? 'noteheadWhole' :
			duration < 4 ? 'noteheadHalf' :
			'noteheadBlack'

		const relativePos = token.position - 2;

		s = new Glyph(sym, relativePos)
		s.moveTo(staveX, staveY)
		s._text = info + ':' + token.name;
		drawing.add(s)

		if (relativePos < 0) {
			ledger = new Ledger((relativePos / 2 | 0) * 2, 0)
			ledger.moveTo(staveX, staveY)
			drawing.add(ledger)
		}

		staveX += s.width

		// Flags
		if (duration >= 8) {
			stem = new Glyph(`flag${duration}thUp`, relativePos + 7)
			stem.moveTo(staveX, staveY)
			stem._text = info;
			drawing.add(stem)
		}

		// staveX += s.width

		// Stem
		if (duration >= 2) {
			stem = new Stem(relativePos)
			stem.moveTo(staveX, staveY)
			drawing.add(stem)
		}

		for (let i = 0; i < token.dots; i++) {
			const dot = new Dot(relativePos)
			dot.moveTo(staveX, staveY)
			drawing.add(dot)
			staveX += dot.width
		}

		staveX += s.width * 1
	}

	drawing.draw(ctx)
}


