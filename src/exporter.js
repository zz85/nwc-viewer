/**********************
 *
 *   Exporters
 *
 **********************/

function exportLilypond() {
	/* Exports absolute pitches for now */
	var ly = ''

	interpret(data)

	const lily_accidentals = { b: 'es', '#': 'is', n: '', x: 'isis', v: 'eses' }

	var selectedStave = scoreManager.getSelectedStaff()

	selectedStave.tokens.forEach((token) => {
		if (token.type === 'Note') {
			ly += token.name.toLowerCase()
			var octave = token.octave - 2
			if (token.accidentalValue) {
				ly += lily_accidentals[token.accidentalValue]
			}

			if (octave < 0) {
				ly += Array(Math.abs(octave)).fill(',').join('')
			} else {
				ly += Array(octave).fill("'").join('')
			}

			ly += token.duration
			ly += Array(token.dots).fill('.').join('')
			ly += ' '
		}

		if (token.type === 'Barline') {
			ly += '| '
		}

		if (token.type === 'KeySignature') {
			console.log(token)
			// ly += `\\key ${token.signature}`
		}

		if (token.type === 'TimeSignature') {
			console.log(token)
			ly += `\\key ${token.group}/${token.beat} `
		}

		if (token.type === 'Clef') {
			ly += `\\clef ${token.clef} `
		}
	})

	console.log(ly)
	return ly
}

function exportAbc() {
	// ABC references
	// http://trillian.mit.edu/~jc/music/abc/doc/ABCprimer.html
	// http://abcnotation.com/wiki/abc:standard:v2.1#rests

	var abc = []
	interpret(data)

	abc.push('X: 1') // reference number

	var { title, author } = data.info || {}
	if (title) abc.push(`T: ${title}`) // title
	if (title) abc.push(`C: ${author}`) // composer
	abc.push(`N: Generated from Notably`) // notes

	//

	data.score.staves[0].tokens
		.filter((token) => token.type === 'TimeSignature')
		.some((token) => {
			abc.push(`M:${token.group}/${token.beat}`) // Meter
			return true
		})

	// hardcode tempo first
	abc.push('Q:1/4=100')

	data.score.staves[0].tokens
		.filter((token) => token.type === 'Tempo')
		.some((token) => {
			// abc.push(`Q:1/${token.note}=${token.duration}`) // Tempo
			abc.push(`Q:1/4=${token.duration}`) // Tempo

			return true
		})

	abc.push('L: 1') // default note length
	// N: // comments
	// K: Key

	const abc_accidentals = { b: '_', '#': '^', n: '=' }

	data.score.staves.forEach((stave, v) => {
		var tmp = ''

		tmp += `\n[V:${v}]\n`
		stave.tokens.forEach((token) => {
			if (token.type === 'Note') {
				if (token.accidentalValue) {
					tmp += abc_accidentals[token.accidentalValue]
				}

				tmp += token.name.toLowerCase()
				var octave = token.octave - 4

				if (octave < 0) {
					tmp += Array(Math.abs(octave)).fill(',').join('')
				} else {
					tmp += Array(octave).fill("'").join('')
				}

				// tmp += '1/' + token.duration
				// tmp += Array(token.dots).fill('.').join('')
				tmp += token.durValue.toString()
				tmp += ' '
			}

			if (token.type === 'Barline') {
				tmp += '|\n'
			}

			if (token.type === 'Rest') {
				tmp += `z${token.durValue.toString()} `
			}

			// if (token.type === 'KeySignature') {
			// 	console.log(token);
			// 	// ly += `\\key ${token.signature}`
			// }

			if (token.type === 'TimeSignature') {
				tmp += `M:${token.group}/${token.beat}\n` // Meter
			}
		})

		abc.push(tmp)
	})

	abc = abc.join('\n')
	console.log('abc', abc)

	return abc
}

export { exportLilypond, exportAbc }
