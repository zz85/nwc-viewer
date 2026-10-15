import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { decodeString } from '../lib/nwc2xml/reader.js'
import { parseNWC } from '../lib/nwc2xml/parser.js'

globalThis.window = globalThis.window || { ctx: null, canvas: null }
const { decodeNwcArrayBuffer } = await import('../src/nwc.js')

const decode = (bytes) => {
	const log = console.log
	console.log = () => {}
	try {
		return decodeNwcArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
	} finally {
		console.log = log
	}
}
const read = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))
const nwctxt = (body) => new TextEncoder().encode(
	`!NoteWorthyComposer(2.75)\r\n|AddStaff|Name:"S"\r\n|Clef|Type:Treble\r\n${body}\r\n!NoteWorthyComposer-End\r\n`)

describe('rest vertical offsets', () => {
	test('binary rests keep their offset (layered voices)', () => {
		// dannyboy staff 2 has rests moved below the staff to clear the other voice
		const staff = decode(read('../nwcs/dannyboy.nwc')).score.staves[2]
		const offsets = staff.tokens.filter(t => t.type === 'Rest' && t.position).map(t => t.position)
		expect(offsets).toEqual([-9, -10])
	})

	test('nwctxt VertOffset is up-positive, like Pos', () => {
		const rests = decode(nwctxt('|Rest|Dur:4th|Opts:VertOffset=4\r\n|Rest|Dur:4th|Opts:VertOffset=-6')).score.staves[0].tokens.filter(t => t.type === 'Rest')
		expect(rests.map(t => t.position)).toEqual([4, -6])
	})

	test('a rest chord rest keeps its offset', () => {
		const chord = decode(nwctxt('|RestChord|Dur:Half|Dur2:4th|Pos2:3|Opts:VertOffset=-5')).score.staves[0].tokens.find(t => t.restVoice)
		expect(chord.restVoice.position).toBe(-5)
	})
})

describe('staff size', () => {
	const parse = (path) => {
		const log = console.log
		console.log = () => {}
		try {
			return parseNWC(read(path))
		} finally {
			console.log = log
		}
	}

	test('a 2.0x file with a notation typeface string', () => {
		expect(parse('../nwcs/abelp.nwc').staffSize).toBe(13)
	})

	test('a 2.0x file without one, laid out like 1.x', () => {
		// rosfang.nwc (2.02): the staff size follows the layering flag directly
		const file = parse('../nwcs/rosfang.nwc')
		expect(file.staffSize).toBe(11)
		expect(file.fonts[0].name).toBe('Times New Roman')
	})
})

describe('blank staff names', () => {
	test('non-breaking spaces decode as spaces, not EUC-KR', () => {
		expect(decodeString(new Uint8Array([0xA0, 0xA0, 0xA0, 0xA0]))).toBe('\u00a0'.repeat(4))
	})
})
