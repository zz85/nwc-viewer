import { describe, test, expect, beforeEach } from 'bun:test'
import { readFileSync } from 'fs'

// Minimal localStorage for src/drafts.js
const store = new Map()
globalThis.localStorage = {
	getItem: (k) => (store.has(k) ? store.get(k) : null),
	setItem: (k, v) => store.set(k, String(v)),
	removeItem: (k) => store.delete(k),
}

const { buildSaveFile, isNoteWorthy } = await import('../src/save.js')
const { getDraft, getDraftPayload, saveEdit, clearDraft } = await import('../src/drafts.js')
const { parseNWC } = await import('../lib/nwc2xml/parser.js')

const read = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))
const trio = read('../samples/HappyBirthdayTrio.nwctxt')

describe('buildSaveFile', () => {
	test('.nwctxt keeps the original text apart from the edit', async () => {
		const file = await buildSaveFile('nwctxt', trio, { title: 'Happy Birthday, Sam!' })
		const original = new TextDecoder().decode(trio)
		expect(file.ext).toBe('nwctxt')
		expect(file.data).toBe(original.replace('Title:"Happy Birthday"', 'Title:"Happy Birthday, Sam!"'))
	})

	test('.nwc from an old binary file reads back with the edit', async () => {
		const file = await buildSaveFile('nwc', read('../samples/carenot.nwc'), { lyricist: 'Anon.' })
		const back = parseNWC(file.data)
		expect(back.version).toBe(0x024B)
		expect(back.lyricist).toBe('Anon.')
		expect(back.staffs.length).toBe(parseNWC(read('../samples/carenot.nwc')).staffs.length)
	})

	test('MusicXML carries the edited title', async () => {
		const file = await buildSaveFile('musicxml', trio, { title: 'Sam & Co' })
		expect(file.data).toContain('<work-title>Sam &amp; Co</work-title>')
		expect(file.data).toContain('<part-name>Oboe</part-name>')
	})

	test('other sources are refused', async () => {
		const midi = new TextEncoder().encode('MThd....')
		expect(isNoteWorthy(midi)).toBe(false)
		await expect(buildSaveFile('nwc', midi, {})).rejects.toThrow('NoteWorthy')
	})
})

describe('drafts', () => {
	beforeEach(() => store.clear())

	test('keeps edits with the file bytes until cleared', () => {
		saveEdit('trio.nwctxt', trio, 'title', 'One')
		saveEdit('trio.nwctxt', trio, 'author', 'Two')
		expect(getDraft('trio.nwctxt', trio).edits).toEqual({ title: 'One', author: 'Two' })
		expect(getDraftPayload('trio.nwctxt')).toEqual(trio)
		clearDraft('trio.nwctxt')
		expect(getDraft('trio.nwctxt', trio)).toBe(null)
	})

	test('a different file with the same name gets no edits', () => {
		saveEdit('song.nwc', trio, 'title', 'One')
		expect(getDraft('song.nwc', read('../samples/carenot.nwc'))).toBe(null)
	})
})
