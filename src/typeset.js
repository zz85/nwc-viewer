// based on nwc music json representation,
// attempt to convert them to symbols to be drawn.
// also make weak attempt to lay them out

// music json -> draw symbols. interpretation? translation? engrave? typeset? layout? drawing?

/**
 * TODOs
 * - accidentals
 * - key signatures
 * - triplets
 * - dynamics
 */

function score(data) {
	let info

	drawing = new Drawing(ctx)

	// eachStave(data.score.staves[0], 0)
	data.score.staves.forEach(eachStave)

	drawing.draw(ctx)
}

function eachStave(stave, i) {
	tokens = stave.tokens

	staveY = 120 * (i + 1)
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

			case 'StaffProperties':
			case 'StaffInstrument':
				// TODO infomational purposes
				break;

			case 'Clef':
				console.log('clef', token);
				switch (token.clef) {
					case 'treble':
						clef = new Claire.TrebleClef()
						break;
					case 'bass':
						clef = new Claire.BassClef()
						break;
					default:
						console.log('ERR unknown clef', token.clef)
				}
				// clef = new {
				// 	treble: Claire.TrebleClef,
				// }[token.clef]()

				clef.moveTo(staveX, staveY)
				drawing.add(clef)
				staveX += clef.width * 2
				break;

			case 'TimeSignature':
				const sig = token.signature;
				if (token.group && token.beat) {
					t = new TimeSignature(token.group, 6)
					t.moveTo(staveX, staveY)
					drawing.add(t)

					t = new TimeSignature(token.beat, 2)
					t.moveTo(staveX, staveY)
					drawing.add(t)

					staveX += t.width * 2
				} else {
					// if (sig === 'AllaBreve')
					t = new TimeSignature('CutCommon', 4)
					t.moveTo(staveX, staveY)
					drawing.add(t)

					staveX += t.width * 2
				}

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

				s = new Glyph(sym, token.position + 4) // + 4
				s.moveTo(staveX, staveY)
				s._text = info;
				drawing.add(s)

				staveX += s.width * 2
				break;

			case 'Barline':
				s = new Barline()
				s.moveTo(staveX, staveY)
				s._text = info;
				drawing.add(s)

				staveX += 10
				break;

			case 'Chord':
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

		const relativePos = token.position + 4

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
}


