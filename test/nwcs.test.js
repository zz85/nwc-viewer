import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'

globalThis.window = { utils: {} }
globalThis.Zlib = { Inflate: class { decompress() { return new Uint8Array() } } }

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')

describe('NWC Parser - nwcs directory', () => {
	const nwcFiles = readdirSync('nwcs').filter(f => f.endsWith('.nwc'))

	nwcFiles.forEach(file => {
		test(`parses ${file} without error`, () => {
			const contents = readFileSync(`nwcs/${file}`)
			expect(() => decodeNwcArrayBuffer(contents)).not.toThrow()
		})
	})
})
