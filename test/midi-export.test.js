import { describe, test, expect } from 'bun:test'

globalThis.window = globalThis.window || { ctx: null, canvas: null }
const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')
const { scoreToMidi, writeMidiFile, PPQ } = await import('../src/midi-export.js')

function decoded(lines) {
	const log = console.log
	console.log = () => {}
	try {
		const data = decodeNwcArrayBuffer(new TextEncoder().encode(['!NoteWorthyComposer(2.75)', ...lines, '!NoteWorthyComposer-End'].join('\r\n')).buffer)
		interpret(data)
		return data
	} finally {
		console.log = log
	}
}

/** A small Standard MIDI File reader: header and tracks of { at, bytes }. */
function readMidi(bytes) {
	let p = 0
	const u32 = () => (bytes[p++] << 24 | bytes[p++] << 16 | bytes[p++] << 8 | bytes[p++]) >>> 0
	const u16 = () => bytes[p++] << 8 | bytes[p++]
	const vlq = () => { let n = 0, b; do { b = bytes[p++]; n = n << 7 | b & 0x7f } while (b & 0x80); return n }
	const tag = () => String.fromCharCode(...bytes.slice(p, (p += 4)))
	expect(tag()).toBe('MThd')
	expect(u32()).toBe(6)
	const header = { format: u16(), trackCount: u16(), division: u16() }
	const tracks = []
	for (let t = 0; t < header.trackCount; t++) {
		expect(tag()).toBe('MTrk')
		const end = u32() + p
		const events = []
		let at = 0
		while (p < end) {
			at += vlq()
			const status = bytes[p++]
			if (status === 0xff) {
				const type = bytes[p++], len = vlq()
				events.push({ at, meta: type, data: Array.from(bytes.slice(p, (p += len))) })
			} else {
				const n = (status & 0xf0) === 0xc0 ? 1 : 2
				events.push({ at, status, data: Array.from(bytes.slice(p, (p += n))) })
			}
		}
		tracks.push(events)
	}
	return { header, tracks }
}

const notesOf = (events) => {
	const on = events.filter(e => (e.status & 0xf0) === 0x90)
	return on.map(e => {
		const off = events.find(o => (o.status & 0xf0) === 0x80 && o.data[0] === e.data[0] && o.at > e.at)
		return { at: e.at, pitch: e.data[0], length: off.at - e.at, velocity: e.data[1] }
	})
}
const text = (data) => new TextDecoder().decode(new Uint8Array(data))

// Two staves in 3/4 at 90 bpm; the first bar is repeated, then a triplet
// and a tempo change. The bass is a transposing staff (sounds an octave down).
const score = [
	'|SongInfo|Title:"Test"|Author:""',
	'|AddStaff|Name:"Flute"', '|StaffInstrument|Patch:73|Trans:0',
	'|Clef|Type:Treble', '|TimeSig|Signature:3/4', '|Tempo|Tempo:90|Pos:12',
	'|Bar|Style:MasterRepeatOpen', '|Dynamic|Style:f|Pos:-8', '|Note|Dur:4th|Pos:-6', '|Note|Dur:4th|Pos:-5', '|Note|Dur:4th|Pos:-4', '|Bar|Style:MasterRepeatClose',
	'|Note|Dur:8th,Triplet=First|Pos:-6', '|Note|Dur:8th,Triplet|Pos:-5', '|Note|Dur:8th,Triplet=End|Pos:-4', '|Tempo|Tempo:60|Pos:12', '|Note|Dur:Half|Pos:-3',
	'|AddStaff|Name:"Bass"', '|StaffInstrument|Patch:43|Trans:-12',
	'|Clef|Type:Bass', '|TimeSig|Signature:3/4',
	'|Bar|Style:MasterRepeatOpen', '|Note|Dur:Half,Dotted|Pos:-4', '|Bar|Style:MasterRepeatClose',
	'|Note|Dur:Half,Dotted|Pos:-4',
	'|AddStaff|Name:"Silent"', '|StaffProperties|Muted:Y', '|Clef|Type:Treble', '|TimeSig|Signature:3/4',
	'|Bar|Style:MasterRepeatOpen', '|Note|Dur:Half,Dotted|Pos:0', '|Bar|Style:MasterRepeatClose', '|Note|Dur:Half,Dotted|Pos:0',
]

describe('MIDI export', () => {
	const midi = readMidi(writeMidiFile(scoreToMidi(decoded(score))))
	const [conductor, flute, bass] = midi.tracks

	test('a type 1 file: conductor track and one track per heard staff', () => {
		expect(midi.header).toEqual({ format: 1, trackCount: 3, division: PPQ })
		expect(text(conductor.find(e => e.meta === 0x03).data)).toBe('Test')
		expect(text(flute.find(e => e.meta === 0x03).data)).toBe('Flute')
		expect(text(bass.find(e => e.meta === 0x03).data)).toBe('Bass')
	})

	test('instruments as program changes, each staff on its own channel', () => {
		const program = (track) => track.find(e => (e.status & 0xf0) === 0xc0)
		expect(program(flute).data).toEqual([73])
		expect(program(bass).data).toEqual([43])
		expect(program(flute).status & 0x0f).not.toBe(program(bass).status & 0x0f)
	})

	test('repeats are played out, in score time', () => {
		const q = PPQ
		// C4 D4 E4 twice, then a C D E triplet and a half-note F4
		expect(notesOf(flute).map(n => [n.at, n.pitch, n.length])).toEqual([
			[0, 60, q], [q, 62, q], [2 * q, 64, q],
			[3 * q, 60, q], [4 * q, 62, q], [5 * q, 64, q],
			[6 * q, 60, q / 3], [6 * q + q / 3, 62, q / 3], [6 * q + 2 * q / 3, 64, q / 3],
			[7 * q, 65, 2 * q],
		])
	})

	test('transposing staves at sounding pitch', () => {
		// written G2 (bass clef, 4 steps below the middle line D3), sounding an octave down
		expect(notesOf(bass).map(n => [n.at, n.pitch, n.length])).toEqual([[0, 31, 3 * PPQ], [3 * PPQ, 31, 3 * PPQ], [6 * PPQ, 31, 3 * PPQ]])
	})

	test('dynamics as velocities', () => {
		expect(new Set(notesOf(flute).slice(0, 6).map(n => n.velocity)).size).toBe(1)
		expect(notesOf(flute)[0].velocity).toBeGreaterThan(80)
	})

	test('tempo and time signature in the conductor track', () => {
		const tempos = conductor.filter(e => e.meta === 0x51).map(e => [e.at, Math.round(60000000 / (e.data[0] << 16 | e.data[1] << 8 | e.data[2]))])
		expect(tempos).toEqual([[0, 90], [7 * PPQ, 60]])
		const sig = conductor.find(e => e.meta === 0x58)
		expect(sig.at).toBe(0)
		expect(sig.data.slice(0, 2)).toEqual([3, 2])
	})

	test('a muted staff is left out', () => {
		expect(midi.tracks.some(t => t.some(e => e.meta === 0x03 && text(e.data) === 'Silent'))).toBe(false)
	})
})
