import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')

describe('NWC Sample Files Regression', () => {
	const sampleFiles = readdirSync('samples').filter(f => f.endsWith('.nwc'))

	sampleFiles.forEach(file => {
		test(`parses ${file} without throwing`, () => {
			const contents = readFileSync(`samples/${file}`)
			expect(decodeNwcArrayBuffer(contents)).toBeDefined()
		})
	})

	// Snapshot tests against known JSON outputs
	const jsonFiles = readdirSync('samples/json').filter(f => f.endsWith('.json'))

	jsonFiles.forEach(jsonFile => {
		const nwcFile = jsonFile.replace('.json', '.nwc')
		if (!sampleFiles.includes(nwcFile)) return

		test(`${nwcFile} matches snapshot`, () => {
			const contents = readFileSync(`samples/${nwcFile}`)
			const data = decodeNwcArrayBuffer(contents)
			const expected = JSON.parse(readFileSync(`samples/json/${jsonFile}`, 'utf-8'))

			// Compare key structural elements
			expect(data.header.version).toBe(expected.header.version)
			expect(data.score.staves.length).toBe(expected.score.staves.length)

			// Compare token counts per stave
			data.score.staves.forEach((stave, i) => {
				expect(stave.tokens.length).toBe(expected.score.staves[i].tokens.length)
			})
		})
	})
})
