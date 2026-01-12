import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')

describe('NWC Parser', () => {
	describe('decodeNwcArrayBuffer', () => {
		test('parses v1.55 file (jem001.nwc)', () => {
			const contents = readFileSync('samples/jem001.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(data).toBeDefined()
			expect(data.header).toBeDefined()
			expect(data.header.version).toBe(1.55)
		})

		test('parses v1.75 file (anongs.nwc)', () => {
			const contents = readFileSync('samples/anongs.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(data.header.version).toBe(1.75)
			expect(data.score.staves.length).toBe(6)
			expect(data.score.staves[0].tokens.length).toBe(167)
		})

		test('parses v1.75 file (adohn.nwc)', () => {
			const contents = readFileSync('samples/adohn.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(data.header.version).toBe(1.75)
			expect(data.score.staves.length).toBe(4)
			expect(data.score.staves[0].tokens.length).toBe(232)
		})

		test('parses v1.75 file (carenot.nwc)', () => {
			const contents = readFileSync('samples/carenot.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(data.header.version).toBe(1.75)
			expect(data.score).toBeDefined()
		})

		test('parses v1.75 file (bwv140-2.nwc)', () => {
			const contents = readFileSync('samples/bwv140-2.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(data.header.version).toBe(1.75)
		})

		test('returns header with company and product', () => {
			const contents = readFileSync('samples/carenot.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(data.header.company).toBeDefined()
			expect(data.header.product).toBeDefined()
		})

		test('returns score with staves array', () => {
			const contents = readFileSync('samples/carenot.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			expect(Array.isArray(data.score.staves)).toBe(true)
			expect(data.score.staves.length).toBeGreaterThan(0)
		})

		test('staves contain tokens', () => {
			const contents = readFileSync('samples/carenot.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			const firstStave = data.score.staves[0]
			expect(Array.isArray(firstStave.tokens)).toBe(true)
			expect(firstStave.tokens.length).toBeGreaterThan(0)
		})

		test('tokens have type property', () => {
			const contents = readFileSync('samples/carenot.nwc')
			const data = decodeNwcArrayBuffer(contents)
			
			const tokens = data.score.staves[0].tokens
			tokens.forEach(token => {
				expect(token.type).toBeDefined()
			})
		})
	})
})
