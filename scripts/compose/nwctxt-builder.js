// Build NoteWorthy Composer text (.nwctxt) scores from code.
//
//   const score = new Score({ title: 'Song', key: 'D', time: '3/4' })
//   const vln = score.addStaff({ name: 'Violin', clef: 'treble', patch: 40 })
//   vln.bar(tempo(84), dyn('mp'), n('B4', '4'), n('A4', '4'), n('D5', '4'))
//   vln.bar(n('A4 C#5', '2'), n('A4', '8.'), n('A4', '16'))
//   writeFileSync('song.nwctxt', score.toNwctxt())
//
// Pitches are scientific names (C4 = middle C; '#', 'b', 'x', 'bb'); a
// string of several pitches is a chord. Durations: '1' '2' '4' '8' '16'
// '32' '64', with '.'/'..' for dots and 't' for a triplet member (three in
// a row make a group), 'bar' for a whole-bar rest. The builder works out
// staff positions, accidentals (per bar and staff position, against the key
// signature), beams within each beat and triplet brackets, and throws if a
// bar doesn't add up to the time signature.

const LETTERS = 'CDEFGAB'
const ACCIDENTAL = { 1: '#', [-1]: 'b', 0: 'n', 2: 'x', [-2]: 'v' }
// Staff position 0 is the middle line: B4 (treble), D3 (bass), C4 (alto), A3 (tenor)
const CLEF_REF = { treble: ['B', 4], bass: ['D', 3], alto: ['C', 4], tenor: ['A', 3] }
const CLEF_NAME = { treble: 'Treble', bass: 'Bass', alto: 'Alto', tenor: 'Tenor' }
const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const MAJOR_KEYS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 }
const RELATIVE_MAJOR = { a: 'C', e: 'G', b: 'D', 'f#': 'A', 'c#': 'E', 'g#': 'B', 'd#': 'F#', d: 'F', g: 'Bb', c: 'Eb', f: 'Ab', bb: 'Db', eb: 'Gb' }
const DUR_NAME = { 1: 'Whole', 2: 'Half', 4: '4th', 8: '8th', 16: '16th', 32: '32nd', 64: '64th' }
const MIDI_STEP = [0, 2, 4, 5, 7, 9, 11]

// --- Fractions ---------------------------------------------------------------
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a))
class Q {
	constructor(n, d = 1) {
		const g = gcd(n, d) || 1
		this.n = n / g * Math.sign(d)
		this.d = Math.abs(d) / g
	}
	add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d) }
	mul(o) { return new Q(this.n * o.n, this.d * o.d) }
	eq(o) { return this.n === o.n && this.d === o.d }
	lt(o) { return this.n * o.d < o.n * this.d }
	floorDiv(o) { return Math.floor((this.n * o.d) / (o.n * this.d)) }
	isMultipleOf(o) { return (this.n * o.d) % (o.n * this.d) === 0 }
	toString() { return `${this.n}/${this.d}` }
}

// --- Pitches -------------------------------------------------------------------
/** 'C#5' → { letter: 'C', alter: 1, octave: 5 } */
export function parsePitch(p) {
	const m = /^([A-G])(bb|b|#|x)?(-?\d+)$/.exec(p)
	if (!m) throw new Error(`bad pitch: ${p}`)
	const alter = { bb: -2, b: -1, '#': 1, x: 2 }[m[2]] || 0
	return { letter: m[1], alter, octave: +m[3] }
}

export function midi(p) {
	const { letter, alter, octave } = parsePitch(p)
	return (octave + 1) * 12 + MIDI_STEP[LETTERS.indexOf(letter)] + alter
}

/** Move a pitch by whole octaves. */
export function octave(p, by = 1) {
	const { letter, alter, octave: o } = parsePitch(p)
	return letter + ({ 1: '#', [-1]: 'b', 2: 'x', [-2]: 'bb' }[alter] || '') + (o + by)
}

/** Key signature: 'D' (major), 'b' (minor, lower case) or a sharps(+)/flats(-) count. */
export function keyAlterations(key) {
	let count = typeof key === 'number' ? key : MAJOR_KEYS[key] ?? MAJOR_KEYS[RELATIVE_MAJOR[key]]
	if (count == null) throw new Error(`unknown key: ${key}`)
	const alter = {}
	if (count > 0) SHARPS.slice(0, count).forEach(l => (alter[l] = 1))
	if (count < 0) SHARPS.slice().reverse().slice(0, -count).forEach(l => (alter[l] = -1))
	return alter
}

function keySignatureField(alter) {
	const names = Object.entries(alter).map(([l, a]) => l + (a > 0 ? '#' : 'b'))
	const order = Object.values(alter)[0] > 0 ? SHARPS : SHARPS.slice().reverse()
	names.sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]))
	return names.length ? names.join(',') : 'C'
}

// --- Events --------------------------------------------------------------------
/** Note or chord. flags: slur (to the next note), tie, stac, acc, ten, marc, grace, stem: 'Up'|'Down' */
export function n(pitches, dur, flags = {}) {
	const list = Array.isArray(pitches) ? pitches : pitches.split(/\s+/).filter(Boolean)
	return { pitches: list, dur, ...flags }
}
/** Rest. dur 'bar' writes NWC's whole (full-bar) rest. */
export function r(dur, flags = {}) {
	return { pitches: [], dur, ...flags }
}
/** Several notes of one duration: seq('A4 B4 C#5', '16', { slur: true }) */
export function seq(notes, dur, flags = {}) {
	return notes.split(/\s+/).filter(Boolean).map(p => n(p, dur, flags))
}
/** A raw nwctxt object line placed before the next note, e.g. '|Dynamic|Style:f|Pos:-8' */
export function raw(line) {
	return { raw: line }
}
export const dyn = (style, pos = -8) => raw(`|Dynamic|Style:${style}|Pos:${pos}`)
export const tempo = (bpm, pos = 12) => raw(`|Tempo|Tempo:${bpm}|Pos:${pos}`)
export const perf = (style, pos = 9) => raw(`|PerformanceStyle|Style:${style}|Pos:${pos}`)
export const text = (s, font = 'StaffBold', pos = 15) => raw(`|Text|Text:"${String(s).replace(/"/g, '\\"')}"|Font:${font}|Pos:${pos}`)
export const fermata = (pos = 9) => raw(`|TempoVariance|Style:Fermata|Pause:8|Pos:${pos}`)
export const tempoVar = (style, pos = 10) => raw(`|TempoVariance|Style:${style}|Pos:${pos}`)
export const hairpin = (style = 'Crescendo', pos = -8) => raw(`|DynamicVariance|Style:${style}|Pos:${pos}`)
export const pedal = (down = true, pos = -10) => raw(`|SustainPedal|${down ? '' : 'Status:Released|'}Pos:${pos}`)

function durValue(d, barLength) {
	if (d === 'bar') return barLength
	const m = /^(\d+)(\.{0,2})(t?)$/.exec(d)
	if (!m || !DUR_NAME[m[1]]) throw new Error(`bad duration: ${d}`)
	let v = new Q(1, +m[1])
	if (m[2] === '.') v = v.mul(new Q(3, 2))
	if (m[2] === '..') v = v.mul(new Q(7, 4))
	if (m[3]) v = v.mul(new Q(2, 3))
	return v
}

function durField(d, extra) {
	if (d === 'bar') return ['Whole']
	const m = /^(\d+)(\.{0,2})(t?)$/.exec(d)
	const parts = [DUR_NAME[m[1]]]
	if (m[2] === '.') parts.push('Dotted')
	if (m[2] === '..') parts.push('DblDotted')
	return parts.concat(extra)
}

// --- Staves and score ------------------------------------------------------------
export class Staff {
	constructor(score, opts) {
		this.score = score
		this.opts = { clef: 'treble', patch: 0, trans: 0, ...opts }
		this.bars = []
	}

	/** Add a bar; items are events, arrays of events, or raw() objects. */
	bar(...items) {
		this.bars.push(items.flat(Infinity))
		return this
	}

	position(p) {
		const { letter, octave: o } = parsePitch(p)
		const [refLetter, refOctave] = CLEF_REF[this.opts.clef]
		return o * 7 + LETTERS.indexOf(letter) - (refOctave * 7 + LETTERS.indexOf(refLetter))
	}

	render(doubleAfter) {
		const { barLength, beat } = this.score
		const keyAlter = this.score.keyAlter
		const lines = []
		this.bars.forEach((bar, bi) => {
			const label = `${this.opts.name} bar ${bi + 1}`
			// Start time of each event, bar length check
			let t = new Q(0)
			const starts = bar.map(e => {
				if (e.raw) return null
				const s = t
				// Grace notes take no time in the bar
				if (!e.grace) t = t.add(durValue(e.dur, barLength))
				return s
			})
			if (!t.eq(barLength)) throw new Error(`${label}: lasts ${t}, expected ${barLength}`)

			// Beams: consecutive notes shorter than the beat, within one beat
			const beam = new Map()
			let group = []
			const flush = () => {
				if (group.length >= 2) group.forEach((i, k) => beam.set(i, k === 0 ? 'First' : k === group.length - 1 ? 'End' : ''))
				group = []
			}
			bar.forEach((e, i) => {
				if (e.raw) return
				const d = durValue(e.dur, barLength)
				const beamable = e.pitches.length && d.lt(new Q(1, 4)) && e.dur !== 'bar' && !e.nobeam && !e.grace
				if (!beamable) return flush()
				if (group.length && starts[group[0]].floorDiv(beat) !== starts[i].floorDiv(beat)) flush()
				group.push(i)
				if (starts[i].add(d).isMultipleOf(beat)) flush()
			})
			flush()

			// Triplet brackets: every three triplet members in a row
			const triplet = new Map()
			let run = []
			bar.forEach((e, i) => {
				if (e.raw || !/t$/.test(e.dur)) return
				run.push(i)
				if (run.length === 3) {
					triplet.set(run[0], 'Triplet=First').set(run[1], 'Triplet').set(run[2], 'Triplet=End')
					run = []
				}
			})
			if (run.length) throw new Error(`${label}: incomplete triplet`)

			const state = {} // staff position → alteration in force this bar
			bar.forEach((e, i) => {
				if (e.raw) return lines.push(e.raw)
				const flags = []
				if (triplet.has(i)) flags.push(triplet.get(i))
				for (const [k, word] of [['slur', 'Slur'], ['grace', 'Grace'], ['stac', 'Staccato'], ['acc', 'Accent'], ['ten', 'Tenuto'], ['marc', 'Marcato']]) {
					if (e[k]) flags.push(word)
				}
				const opts = []
				if (e.stem) opts.push(`Stem=${e.stem}`)
				if (beam.has(i)) opts.push(beam.get(i) ? `Beam=${beam.get(i)}` : 'Beam')
				if (e.fermata) opts.push('Fermata')
				const optField = opts.length ? `|Opts:${opts.join(',')}` : ''
				const dur = `Dur:${durField(e.dur, flags).join(',')}`
				if (!e.pitches.length) return lines.push(`|Rest|${dur}${optField}`)
				const sorted = e.pitches.slice().sort((a, b) => this.position(a) - this.position(b))
				const pos = sorted.map(p => {
					const { letter, alter } = parsePitch(p)
					const at = this.position(p)
					const current = state[at] ?? (keyAlter[letter] || 0)
					state[at] = alter
					return (current !== alter ? ACCIDENTAL[alter] : '') + at + (e.tie ? '^' : '')
				}).join(',')
				lines.push(`|${sorted.length > 1 ? 'Chord' : 'Note'}|${dur}|Pos:${pos}${optField}`)
			})
			if (bi < this.bars.length - 1) lines.push(doubleAfter.has(bi + 1) ? '|Bar|Style:Double' : '|Bar')
		})
		return lines
	}
}

export class Score {
	/**
	 * @param {object} opts
	 *   title, author, lyricist, key ('D', 'b', or ±count), time ('3/4'),
	 *   staffSize (pt), labels ('First System' | 'None' | ...)
	 */
	constructor(opts = {}) {
		this.opts = { title: '', author: '', lyricist: '', key: 'C', time: '4/4', staffSize: 16, labels: 'First System', ...opts }
		const [num, den] = this.opts.time.split('/').map(Number)
		this.barLength = new Q(num, den)
		// Beaming unit: the dotted beat in compound time (6/8, 9/8, 12/8), else one beat
		this.beat = den === 8 && num % 3 === 0 ? new Q(3, 8) : new Q(1, den)
		this.keyAlter = keyAlterations(this.opts.key)
		this.staves = []
		this.doubleBars = new Set()
	}

	/**
	 * @param {object} opts name, label, abbr, clef ('treble'|'bass'|'alto'|'tenor'),
	 *   octaveShift ('Octave Up'|'Octave Down'), patch (GM program, 0-based),
	 *   trans (semitones, e.g. -12 for double bass), withNext ('Brace'|'Bracket'),
	 *   connectBars (bar lines run to the next staff)
	 */
	addStaff(opts) {
		const staff = new Staff(this, opts)
		this.staves.push(staff)
		return staff
	}

	/** Double barline after bar number `bar` (1-based). */
	doubleBarAfter(...bars) {
		bars.forEach(b => this.doubleBars.add(b))
		return this
	}

	toNwctxt() {
		const counts = new Set(this.staves.map(s => s.bars.length))
		if (counts.size > 1) throw new Error(`staves have different bar counts: ${this.staves.map(s => `${s.opts.name}=${s.bars.length}`).join(', ')}`)
		const q = s => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
		const o = this.opts
		const out = [
			'!NoteWorthyComposer(2.75)',
			`|SongInfo|Title:${q(o.title)}|Author:${q(o.author)}|Lyricist:${q(o.lyricist)}|Copyright1:""|Copyright2:""`,
			`|PgSetup|StaffSize:${o.staffSize}|Zoom:4|TitlePage:Y|JustifyVertically:Y|PrintSystemSepMark:N|ExtendLastSystem:N|DurationPadding:Y|PageNumbers:0|StaffLabels:${o.labels}|BarNumbers:Plain|StartingBar:1`,
			'|Font|Style:StaffItalic|Typeface:"Times New Roman"|Size:10|Bold:Y|Italic:Y|CharSet:0',
			'|Font|Style:StaffBold|Typeface:"Times New Roman"|Size:8|Bold:Y|Italic:N|CharSet:0',
			'|Font|Style:StaffLyric|Typeface:"Times New Roman"|Size:7|Bold:N|Italic:N|CharSet:0',
			'|Font|Style:PageTitleText|Typeface:"Times New Roman"|Size:24|Bold:Y|Italic:N|CharSet:0',
			'|Font|Style:PageText|Typeface:"Times New Roman"|Size:12|Bold:N|Italic:N|CharSet:0',
			'|Font|Style:PageSmallText|Typeface:"Times New Roman"|Size:8|Bold:N|Italic:N|CharSet:0',
			'|PgMargins|Left:1.27|Top:1.27|Right:1.27|Bottom:1.27|Mirror:N',
		]
		const key = keySignatureField(this.keyAlter)
		this.staves.forEach((s, i) => {
			const so = s.opts
			const withNext = [so.withNext, so.connectBars && 'ConnectBars'].filter(Boolean).join(',')
			out.push(
				`|AddStaff|Name:${q(so.name || `Staff ${i + 1}`)}` + (so.label != null ? `|Label:${q(so.label)}|LabelAbbr:${q(so.abbr || '')}` : '') + '|Group:"Standard"',
				`|StaffProperties|EndingBar:Section Close|Visible:Y|BoundaryTop:14|BoundaryBottom:14|Lines:5${withNext ? `|WithNextStaff:${withNext}` : ''}|Color:Default`,
				`|StaffProperties|Muted:N|Volume:127|StereoPan:64|Device:0|Channel:${(so.channel ?? i) + 1}`,
				`|StaffInstrument|Name:${q(so.instrument || so.name || '')}|Patch:${so.patch}|Trans:${so.trans}|DynVel:10,30,45,60,75,92,108,127`,
				`|Clef|Type:${CLEF_NAME[so.clef]}` + (so.octaveShift ? `|OctaveShift:${so.octaveShift}` : ''),
				`|Key|Signature:${key}`,
				`|TimeSig|Signature:${o.time}`,
				...s.render(this.doubleBars),
			)
		})
		out.push('!NoteWorthyComposer-End')
		return out.join('\r\n') + '\r\n'
	}
}
