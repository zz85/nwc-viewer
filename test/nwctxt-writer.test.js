import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { deflateSync } from 'zlib'
import { parseNWC } from '../lib/nwc2xml/parser.js'
import { parseNWCTxt } from '../lib/nwc2xml/nwctxt-parser.js'
import { writeNWCTxt, extractNWCTxt, patchSongInfo, toNWC275 } from '../lib/nwc2xml/nwctxt-writer.js'
import { ObjType } from '../lib/nwc2xml/constants.js'

const read = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))

// What a reader of the file sees: per staff, the object types and their
// main musical fields
function summary(file) {
	return file.staffs.map(staff => ({
		name: staff.name,
		patch: staff.patchName,
		lyrics: staff.lyrics.filter(l => l.length).map(l => l.join('').replace(/\n/g, '\r')),
		objects: staff.objects.filter(o => o.type !== ObjType.MPC && o.type !== ObjType.Instrument).map(o => {
			const s = { type: o.type }
			if (o.getDuration) Object.assign(s, { dur: o.getDuration(), dt: o.getDurationType() })
			if (o.type === ObjType.Note) Object.assign(s, { pos: o.pos || 0, acc: o.getAccidental() })
			if (o.children?.length) s.pitches = o.children.map(n => n.pos || 0).sort()
			if (o.type === ObjType.KeySig) s.alter = o.getChromAlter()
			if (o.type === ObjType.BarLine) s.style = o.getStyle()
			return s
		}),
	}))
}

describe('writeNWCTxt', () => {
	for (const sample of ['carenot.nwc', 'WhatChildIsThis.nwc', 'bwv140-2.nwc', 'jem001.nwc']) {
		test(`${sample}: binary → nwctxt → parse keeps the music`, () => {
			const original = parseNWC(read(`../samples/${sample}`))
			const text = writeNWCTxt(original)
			expect(text.startsWith('!NoteWorthyComposer(2.75)\r\n')).toBe(true)
			expect(text.endsWith('!NoteWorthyComposer-End\r\n')).toBe(true)
			expect(summary(parseNWCTxt(text))).toEqual(summary(original))
		})
	}

	test('song info and staff settings are written', () => {
		const text = writeNWCTxt(parseNWC(read('../samples/WhatChildIsThis.nwc')))
		expect(text).toContain('|SongInfo|Title:"What Child is this?"')
		expect(text).toMatch(/\|AddStaff\|Name:"[^"]+"/)
		expect(text).toMatch(/\|StaffInstrument\|Patch:\d+/)
	})

	test('blank lyric syllables survive as underscores', () => {
		const file = parseNWC(read('../samples/carenot.nwc'))
		// A blank binary syllable is its separator plus a space
		file.staffs[0].lyrics = [['One', '  ', ' two']]
		const text = writeNWCTxt(file)
		expect(text).toContain('Text:"One _ two\\r\\n"')
		expect(text).toContain('UnderscoreAsSpace:Y')
		expect(parseNWCTxt(text).staffs[0].lyrics[0]).toEqual(['One', '  ', ' two'])
	})
})

describe('nwctxt parser fixes', () => {
	const parse = (body) => parseNWCTxt(`!NoteWorthyComposer(2.75)\r\n|AddStaff|Name:"S"\r\n${body}\r\n!NoteWorthyComposer-End`)

	test('key signatures are note bitmasks like the binary format', () => {
		const key = parse('|Key|Signature:Bb,Eb').staffs[0].objects[0]
		expect(key.getFifths()).toBe(-2)
		// index 0 = A ... 6 = G
		expect(key.getChromAlter()).toEqual([0, -1, 0, 0, -1, 0, 0])
		expect(parse('|Key|Signature:F#,C#,G#').staffs[0].objects[0].getChromAlter()).toEqual([0, 0, 1, 0, 0, 1, 1])
	})

	test('channels are stored 0-based', () => {
		expect(parse('|StaffProperties|Channel:10').staffs[0].channel).toBe(9)
	})
})

describe('patchSongInfo', () => {
	const text = '!NoteWorthyComposer(2.75)\r\n|SongInfo|Title:"Old"|Author:"A \\| B"|Lyricist:""\r\n|AddStaff|Name:"S"\r\n'

	test('replaces only the edited fields', () => {
		const out = patchSongInfo(text, { title: 'New "quoted" title' })
		expect(out).toBe(text.replace('Title:"Old"', 'Title:"New \\"quoted\\" title"'))
		expect(parseNWCTxt(out).title).toBe('New "quoted" title')
		expect(parseNWCTxt(out).author).toBe('A | B')
	})

	test('adds fields that are missing', () => {
		expect(patchSongInfo(text, { comment: 'Hi' })).toContain('|Lyricist:""|Comments:"Hi"')
	})
})

describe('extractNWCTxt / toNWC275', () => {
	test('reads the text out of a 2.75 binary', () => {
		const bytes = read('../samples/AveMariaArcadelt.nwc')
		const { inflateSync } = require('zlib')
		const text = extractNWCTxt(new Uint8Array(inflateSync(bytes.subarray(6))))
		expect(text.startsWith('!NoteWorthyComposer(2.75)')).toBe(true)
	})

	test('wraps nwctxt as a 2.75 file the parser reads back', async () => {
		const text = readFileSync(new URL('../samples/HappyBirthdayTrio.nwctxt', import.meta.url), 'utf8')
		const nwc = await toNWC275(patchSongInfo(text, { title: 'Happy Birthday, Sam!' }), (b) => new Uint8Array(deflateSync(b)))
		expect(String.fromCharCode(...nwc.subarray(0, 5))).toBe('[NWZ]')
		const file = parseNWC(nwc)
		expect(file.version).toBe(0x024B)
		expect(file.title).toBe('Happy Birthday, Sam!')
		expect(file.staffs.map(s => s.name)).toEqual(['Oboe', 'Viola', 'Double Bass'])
	})
})
