import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { sampleLink, embeddedLink, readLink } from '../src/share.js'

const base = 'https://example.org/nwc-viewer/?old=1#x'
const trio = new Uint8Array(readFileSync(new URL('../samples/HappyBirthdayTrio.nwctxt', import.meta.url)))

describe('share links', () => {
	test('sample links name the song', async () => {
		const link = sampleLink(base, 'HappyBirthdayTrio.nwctxt')
		expect(link).toBe('https://example.org/nwc-viewer/?song=HappyBirthdayTrio.nwctxt')
		expect(await readLink(link)).toEqual({ song: 'HappyBirthdayTrio.nwctxt' })
	})

	test('embedded links carry the file and its edits', async () => {
		const link = await embeddedLink(base, trio, 'trio.nwctxt', { title: 'Sam & Co' })
		expect(link.startsWith('https://example.org/nwc-viewer/#score=')).toBe(true)
		// Compressed: much shorter than the file itself
		expect(link.length).toBeLessThan(trio.length)
		const opened = await readLink(link)
		expect(opened.name).toBe('trio.nwctxt')
		expect(opened.edits).toEqual({ title: 'Sam & Co' })
		expect(opened.bytes).toEqual(trio)
	})

	test('plain URLs ask for nothing', async () => {
		expect(await readLink('https://example.org/nwc-viewer/')).toBe(null)
	})
})
