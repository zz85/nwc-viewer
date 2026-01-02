import { describe, test, expect } from 'bun:test'

describe('NWC Constants', () => {
	test('exports NwcConstants', async () => {
		const { NwcConstants } = await import('../src/nwc_constants.js')
		expect(NwcConstants).toBeDefined()
	})

	test('NwcConstants has ObjLabels', async () => {
		const { NwcConstants } = await import('../src/nwc_constants.js')
		expect(NwcConstants.ObjLabels).toBeDefined()
		expect(Array.isArray(NwcConstants.ObjLabels)).toBe(true)
	})

	test('NwcConstants has DynamicLevels', async () => {
		const { NwcConstants } = await import('../src/nwc_constants.js')
		expect(NwcConstants.DynamicLevels).toBeDefined()
	})

	test('NwcConstants has PerformanceStyle', async () => {
		const { NwcConstants } = await import('../src/nwc_constants.js')
		expect(NwcConstants.PerformanceStyle).toBeDefined()
	})

	test('exports FontStyles', async () => {
		const { FontStyles } = await import('../src/nwc_constants.js')
		expect(FontStyles).toBeDefined()
		expect(Array.isArray(FontStyles)).toBe(true)
	})
})

describe('Token Parsers', () => {
	test('exports TokenParsers object', async () => {
		const { TokenParsers } = await import('../src/nwc_parser.js')
		expect(TokenParsers).toBeDefined()
		expect(typeof TokenParsers).toBe('object')
	})

	test('TokenParsers has clef parser (0)', async () => {
		const { TokenParsers } = await import('../src/nwc_parser.js')
		expect(typeof TokenParsers[0]).toBe('function')
	})

	test('TokenParsers has key signature parser (1)', async () => {
		const { TokenParsers } = await import('../src/nwc_parser.js')
		expect(typeof TokenParsers[1]).toBe('function')
	})

	test('TokenParsers has barline parser (2)', async () => {
		const { TokenParsers } = await import('../src/nwc_parser.js')
		expect(typeof TokenParsers[2]).toBe('function')
	})

	test('TokenParsers has note parser (8)', async () => {
		const { TokenParsers } = await import('../src/nwc_parser.js')
		expect(typeof TokenParsers[8]).toBe('function')
	})

	test('TokenParsers has rest parser (9)', async () => {
		const { TokenParsers } = await import('../src/nwc_parser.js')
		expect(typeof TokenParsers[9]).toBe('function')
	})
})
