import { describe, test, expect } from 'bun:test'

// Test that all source files can be parsed without syntax errors
describe('Syntax Validation', () => {
	test('fraction.js has valid syntax', async () => {
		const mod = await import('../src/fraction.js')
		expect(mod.default).toBeDefined()
	})

	test('lyrics.js has valid syntax', async () => {
		const mod = await import('../src/lyrics.js')
		expect(mod.default).toBeDefined()
	})

	test('nwc_constants.js has valid syntax', async () => {
		const mod = await import('../src/nwc_constants.js')
		expect(mod.NwcConstants).toBeDefined()
		expect(mod.FontStyles).toBeDefined()
	})

	test('nwc_parser.js has valid syntax', async () => {
		const mod = await import('../src/nwc_parser.js')
		expect(mod.TokenParsers).toBeDefined()
	})

	test('nwc.js has valid syntax', async () => {
		globalThis.window = {}
		globalThis.Zlib = { Inflate: class { decompress() { return new Uint8Array() } } }
		const mod = await import('../src/nwc.js')
		expect(mod.decodeNwcArrayBuffer).toBeDefined()
	})

	test('interpreter.js has valid syntax', async () => {
		globalThis.window = { utils: {} }
		const mod = await import('../src/interpreter.js')
		expect(mod.interpret).toBeDefined()
	})

	test('exporter.js has valid syntax', async () => {
		globalThis.window = { data: { score: { staves: [] } } }
		const mod = await import('../src/exporter.js')
		expect(mod.exportAbc).toBeDefined()
		expect(mod.exportLilypond).toBeDefined()
	})

	test('editing.js has valid syntax', async () => {
		// Mock DOM elements
		globalThis.document = {
			getElementById: () => ({ onclick: null })
		}
		globalThis.window = { scoreManager: { addStaff: () => {} } }
		globalThis.rerender = () => {}
		const mod = await import('../src/editing.js')
		expect(mod.blank).toBeDefined()
	})
})
