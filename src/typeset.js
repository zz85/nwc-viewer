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

class StaveCursor {
	constructor(stave, staveIndex) {
		this.tokenIndex = -1;
		this.staveIndex = staveIndex;
		this.staveX = 40;
		this.stave = stave;
		this.tokens = stave.tokens;
	}

	peek() {
		return this.tokens[this.tokenIndex + 1];
	}

	hasNext() {
		return this.tokenIndex + 1 < this.tokens.length;
	}

	next(func) {
		const tokenIndex = this.incTokenIndex();
		const token = this.tokens[tokenIndex];

		this.lastPadRight = 0;
		func(token, tokenIndex, this.staveIndex, this);
	}

	incStaveX(inc) {
		this.staveX += inc;
	}

	tokenPadRight(pad) {
		this.lastPadRight = pad;
		// this.incStaveX(pad);
	}

	posGlyph(glyph) {
		glyph.moveTo(this.staveX, getStaffY(this.staveIndex));
	}

	incTokenIndex() {
		return ++this.tokenIndex;
	}
}

const X_STRETCH = 0.5;

class TickTracker {
	constructor() {
		this.maxTicks = {}
	}

	add(token, cursor) {
		if (token.Visibility === 'hidden') return;

		const refValue = token.tabUntilValue
			// tickValue tickUntilValue tabValue
		const which = this.maxTicks[refValue];

		const x = cursor.staveX + cursor.lastPadRight * X_STRETCH || 0;
		if (!which || x > which.staveX) {
			this.maxTicks[refValue] = {
				cursor,
				staveX: x,
				token: token,
			};
		}
	}

	alignWithMax(token, cursor) {
		// console.log('alignWithMax', token, cursor);

		let moveX = cursor.staveX;

		if (cursor.lastPadRight) {
			moveX += cursor.lastPadRight * 4;
		}

		// increments staveX or align with item which already contains staveX for tabValue
		const key = token.tabValue;
		if (key && key in this.maxTicks) {
			const which = this.maxTicks[key];

			moveX = which.staveX;
		}

		cursor.staveX = moveX;
		return false
	}
}

tickTracker = new TickTracker();
absCounter = 0

function score(data) {
	drawing = new Drawing(ctx)

	const staves = data.score.staves;
	const stavePointers = staves.map((stave, staveIndex) => new StaveCursor(stave, staveIndex));

	/*
	stavePointers.forEach((cursor, staveIndex) => {
		cursor.tokens.forEach((token, tokenIndex) => {
			handleToken(token, tokenIndex, staveIndex, cursor);
		});
	});
	*/

	while (true) {
	// for (var i = 0; i < 50; i++) {
		if (!stavePointers.some(s => s.hasNext())) {
			console.log('nothing left');
			break;
		}

		var smallestTick = Infinity, smallestIndex = -1;
		stavePointers.forEach(cursor => {
			const token = cursor.peek();
			if (!token) return;
			const tick = token.tabValue || 0;

			if (tick < smallestTick) {
				smallestTick = tick;
				smallestIndex = cursor.staveIndex;
			}
		});

		if (smallestIndex > -1) {
			stavePointers[smallestIndex].next(handleToken)
		}
		else {
			console.log('no candidate!!');
		}
	}

	stavePointers.forEach((cursor, staveIndex) => {
		drawStave(cursor, staveIndex);
	});

	drawing.draw(ctx)
}

function getStaffY(staffIndex) {
	return 120 * (staffIndex + 1)
}

function drawStave(cursor, staveIndex) {
	s = new Stave(cursor.staveX + 40)
	s.moveTo(40, getStaffY(staveIndex))
	// s = new Stave(2000)
	// cursor.posGlyph(s)
	drawing.add(s)

	console.log('staveIndex', staveIndex, cursor.tokens)
}

function handleToken(token, tokenIndex, staveIndex, cursor) {
	info = tokenIndex
	info = absCounter++ + ' : ' + tokenIndex
	staveY = getStaffY(staveIndex)

	const type = token.type;

	// console.log('handleToken', token)
	tickTracker.alignWithMax(token, cursor);

	switch (type) {
		default:

			console.log('Typeset: Unhandled type - ', type); // , token
			break;

		case 'Tempo':
		case 'Dynamic':
			console.log(token);
			break;
		case 'StaffProperties':
		case 'StaffInstrument':
			// TODO infomational purposes
			break;

		case 'Clef':
			// TODO handle octave down
			// console.log('clef', token);
			switch (token.clef) {
				case 'treble':
					clef = new Claire.TrebleClef()
					break;
				case 'bass':
					clef = new Claire.BassClef()
					break;
				case 'alto':
					clef = new Claire.AltoClef()
					break;
				default:
					console.log('ERR unknown clef', token.clef)
			}
			// clef = new {
			// 	treble: Claire.TrebleClef,
			// }[token.clef]()

			cursor.posGlyph(clef)
			drawing.add(clef)
			cursor.incStaveX(clef.width * 2);
			break;

		case 'TimeSignature':
			const sig = token.signature;
			if (token.group && token.beat) {
				t = new TimeSignature(token.group, 6)
				cursor.posGlyph(t)
				drawing.add(t)

				t = new TimeSignature(token.beat, 2)
				cursor.posGlyph(t)
				drawing.add(t)

				cursor.incStaveX(t.width * 2);
			} else {
				// if (sig === 'AllaBreve')
				t = new TimeSignature('CutCommon', 4)
				cursor.posGlyph(t)
				drawing.add(t)

				cursor.incStaveX(t.width * 2);
			}

			break;
		case 'KeySignature':
			const key = new KeySignature(token.signature, token.clef);
			cursor.posGlyph(key)
			drawing.add(key)

			cursor.incStaveX(key.width * 2);
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

			if (!sym) console.log('FAIL REST', token, duration)

			s = new Glyph(sym, token.position + 4) // + 4
			cursor.posGlyph(s)
			s._text = info;
			drawing.add(s)

			cursor.incStaveX(s.width * 1);
			cursor.tokenPadRight(s.width * calculatePadding(token.durValue));
			break;

		case 'Barline':
			s = new Barline()
			cursor.posGlyph(s)
			s._text = info;
			drawing.add(s)

			cursor.tokenPadRight(10);
			break;

		case 'Chord':
			let tmp = cursor.staveX
			token.notes.forEach(note => {
				cursor.staveX = tmp
				drawForNote(note, cursor, token)
			})
			break;

		case 'Note':
			drawForNote(token, cursor, token);
			break;

		case 'Text':
		case 'PerformanceStyle':
			const text = new Text(token.text, token.position || -10)
			cursor.posGlyph(text)
			drawing.add(text);
			break;

		case 'moo':
			console.log('as', token);
			break;

	}

	tickTracker.add(token, cursor);
}

function drawForNote(token, cursor, durToken) {
	const duration = durToken.duration
	const durValue = durToken.durValue;

	if (token.accidental) {
		console.log('NOTE ACCIDENTAL', token, token.accidental);
	}

	const sym = duration < 2 ? 'noteheadWhole' :
		duration < 4 ? 'noteheadHalf' :
		'noteheadBlack'

	const relativePos = token.position + 4
	const requireStem = duration >= 2;
	const stemUp = token.Stem === 'Up' ? true :
		token.Stem === 'Down' ? false :
			token.position < 0;
	const requireFlag = duration >= 8;

	if (token.Beam) console.log('Beam', token);

	// note head
	const noteHead = new Glyph(sym, relativePos)
	cursor.posGlyph(noteHead)
	noteHead._text = info + '.' // + ':' + token.name;
	drawing.add(noteHead)
	const noteHeadWidth = noteHead.width
	let space = noteHeadWidth

	// ledger lines
	if (relativePos < 0) {
		const ledger = new Ledger((relativePos / 2 | 0) * 2, 0)
		cursor.posGlyph(ledger)
		drawing.add(ledger)
	}

	if (requireStem && !stemUp) {
		// stem down
		const stem = new Stem(relativePos - 7)
		cursor.posGlyph(stem)
		drawing.add(stem)

		let flag;
		if (requireFlag) {
			flag = new Glyph(`flag${duration}thDown`, relativePos - 7 - 0.5)
			cursor.posGlyph(flag)
			flag._text = info;
			drawing.add(flag)
			space = Math.max(space, flag.width || 0)
		}

		cursor.incStaveX(space);
	}
	else if (requireStem && stemUp) {
		cursor.incStaveX(noteHeadWidth);

		// stem up
		const stem = new Stem(relativePos)
		cursor.posGlyph(stem)
		drawing.add(stem)
		// cursor.incStaveX(stem.width);

		// Flags
		if (requireFlag) {
			flag = new Glyph(`flag${duration}thUp`, relativePos + 7)
			cursor.posGlyph(flag)
			flag._text = info;
			drawing.add(flag)
			cursor.incStaveX(flag.width);
		}

	}
	else {
		cursor.incStaveX(noteHeadWidth);
	}

	for (let i = 0; i < token.dots; i++) {
		const dot = new Dot(relativePos)
		cursor.posGlyph(dot)
		drawing.add(dot)
		cursor.incStaveX(dot.width);
	}

	var spaceMultiplier = calculatePadding(durValue || token.durValue)
	cursor.tokenPadRight(noteHead.width * 1 * spaceMultiplier);
}

function calculatePadding(durValue) {
	// TODO tweak this, consider exponential or constrains systems
	var spaceMultiplier = Math.min(Math.max(durValue.value() * 8, 1),  8);
	// use 1/8 as units
	// console.log(spaceMultiplier);

	return spaceMultiplier;
}