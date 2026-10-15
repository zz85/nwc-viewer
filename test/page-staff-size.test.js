import { describe, test, expect } from 'bun:test'

// Minimal mocks for the import chain (typeset → drawing → loaders → DOM)
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null }
globalThis.document = globalThis.document || {
	getElementById: () => mockElement,
	body: mockElement,
}
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const { setFontSize, getFontSize, getFontSizeSetting, setEngravingFontSize, DEFAULT_FONT_SIZE } = await import('../src/constants.js')
const { fileStaffSizePt } = await import('../src/layout/typeset.js')

describe('staff size setting and engraving size', () => {
	test('the setting sets the size in use', () => {
		setFontSize(32)
		expect(getFontSize()).toBe(32)
		expect(getFontSizeSetting()).toBe(32)
		setFontSize(DEFAULT_FONT_SIZE)
	})

	test('layout can engrave at another size without changing the setting', () => {
		setFontSize(DEFAULT_FONT_SIZE)
		setEngravingFontSize(16 * 96 / 72)
		expect(getFontSize()).toBeCloseTo(21.33, 2)
		expect(getFontSizeSetting()).toBe(DEFAULT_FONT_SIZE)
		setEngravingFontSize(4) // clamped like the setting
		expect(getFontSize()).toBe(12)
		setFontSize(DEFAULT_FONT_SIZE)
	})
})

describe('file staff size', () => {
	const of = (staffSize) => fileStaffSizePt({ score: { staffSize } })

	test("the file's NWC staff size, in points", () => {
		expect(of(11)).toBe(11)
		expect(of(26)).toBe(26)
	})

	test('16 pt (NWC default) when missing or implausible', () => {
		expect(of(undefined)).toBe(16)
		expect(of(0)).toBe(16)
		expect(of(26964)).toBe(16)
	})
})
