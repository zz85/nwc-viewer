import { describe, test, expect } from 'bun:test'

const { looksLikeEUCKR, decodeBytes } = await import('../src/nwc.js')

describe('Encoding detection (EUC-KR / CP949)', () => {
	describe('looksLikeEUCKR', () => {
		test('returns false for pure ASCII', () => {
			const bytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]) // "Hello"
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false for empty array', () => {
			expect(looksLikeEUCKR(new Uint8Array([]))).toBe(false)
		})

		test('returns true for valid EUC-KR byte pair (0xBE 0xC6 = 아)', () => {
			// 0xBE is a valid lead byte (0x81-0xFE)
			// 0xC6 is a valid trail byte (0x81-0xFE)
			const bytes = new Uint8Array([0xBE, 0xC6])
			expect(looksLikeEUCKR(bytes)).toBe(true)
		})

		test('returns true for EUC-KR with ASCII prefix', () => {
			// "A" + Korean syllable
			const bytes = new Uint8Array([0x41, 0xBE, 0xC6])
			expect(looksLikeEUCKR(bytes)).toBe(true)
		})

		test('returns true for multiple valid EUC-KR pairs', () => {
			// 아버지 in EUC-KR: 0xBE 0xC6, 0xB9 0xF6, 0xC1 0xF6
			const bytes = new Uint8Array([0xBE, 0xC6, 0xB9, 0xF6, 0xC1, 0xF6])
			expect(looksLikeEUCKR(bytes)).toBe(true)
		})

		test('returns true for trail byte in lowercase letter range (0x61-0x7A)', () => {
			// Lead 0x81 + trail 0x61 (valid CP949 extension)
			const bytes = new Uint8Array([0x81, 0x61])
			expect(looksLikeEUCKR(bytes)).toBe(true)
		})

		test('returns true for trail byte in uppercase letter range (0x41-0x5A)', () => {
			// Lead 0x81 + trail 0x41 (valid CP949 extension)
			const bytes = new Uint8Array([0x81, 0x41])
			expect(looksLikeEUCKR(bytes)).toBe(true)
		})

		test('returns false for unpaired high byte (invalid trail)', () => {
			// 0x81 is a valid lead byte, but 0x30 (digit '0') is not a valid trail
			const bytes = new Uint8Array([0x81, 0x30])
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false for high byte at end of array (no trail byte)', () => {
			const bytes = new Uint8Array([0x41, 0xBE]) // "A" then dangling lead
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false for Windows-1252 characters (e.g. accented Latin)', () => {
			// "café" in Windows-1252: 0x63 0x61 0x66 0xE9
			// 0xE9 is a valid lead byte but there's no following byte that qualifies
			const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xE9])
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false for lone high byte 0x80 (below EUC-KR lead range)', () => {
			// 0x80 is NOT in the lead byte range 0x81-0xFE
			const bytes = new Uint8Array([0x80])
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false when trail byte is 0x40 (just below valid range)', () => {
			// 0x81 is a valid lead but 0x40 is not in any valid trail range
			const bytes = new Uint8Array([0x81, 0x40])
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false when trail byte is 0x5B (between uppercase and lowercase ranges)', () => {
			const bytes = new Uint8Array([0x81, 0x5B])
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})

		test('returns false when trail byte is 0x7B (just above lowercase range)', () => {
			const bytes = new Uint8Array([0x81, 0x7B])
			expect(looksLikeEUCKR(bytes)).toBe(false)
		})
	})

	describe('decodeBytes', () => {
		test('returns empty string for null input', () => {
			expect(decodeBytes(null)).toBe('')
		})

		test('returns empty string for empty array', () => {
			expect(decodeBytes(new Uint8Array([]))).toBe('')
		})

		test('decodes pure ASCII correctly', () => {
			const bytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F])
			expect(decodeBytes(bytes)).toBe('Hello')
		})

		test('decodes valid UTF-8 correctly', () => {
			// "한" in UTF-8: 0xED 0x95 0x9C
			const bytes = new Uint8Array([0xED, 0x95, 0x9C])
			expect(decodeBytes(bytes)).toBe('한')
		})

		test('decodes EUC-KR Korean text (아 = 0xBE 0xC6)', () => {
			const bytes = new Uint8Array([0xBE, 0xC6])
			expect(decodeBytes(bytes)).toBe('아')
		})

		test('decodes multi-syllable EUC-KR (아버지)', () => {
			const bytes = new Uint8Array([0xBE, 0xC6, 0xB9, 0xF6, 0xC1, 0xF6])
			expect(decodeBytes(bytes)).toBe('아버지')
		})

		test('decodes EUC-KR mixed with ASCII', () => {
			// "A아" - ASCII 'A' followed by EUC-KR '아'
			const bytes = new Uint8Array([0x41, 0xBE, 0xC6])
			expect(decodeBytes(bytes)).toBe('A아')
		})

		test('falls back to Windows-1252 for accented Latin text', () => {
			// "café" in Windows-1252: 0x63 0x61 0x66 0xE9
			const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xE9])
			expect(decodeBytes(bytes)).toBe('café')
		})

		test('decodes Windows-1252 special characters (euro sign)', () => {
			// 0x80 = euro sign in Windows-1252; 0x80 is below the EUC-KR lead
			// range (0x81-0xFE) so it cannot be mistaken for Korean
			const bytes = new Uint8Array([0x80, 0x32, 0x30])
			expect(decodeBytes(bytes)).toBe('\u20AC20')
		})

		test('accepts plain Array input', () => {
			const arr = [0x48, 0x65, 0x6C, 0x6C, 0x6F]
			expect(decodeBytes(arr)).toBe('Hello')
		})

		test('accepts plain Array with EUC-KR bytes', () => {
			const arr = [0xBE, 0xC6]
			expect(decodeBytes(arr)).toBe('아')
		})

		test('prefers UTF-8 over EUC-KR when input is valid UTF-8', () => {
			// "가" in UTF-8: 0xEA 0xB0 0x80
			// This sequence is also parseable as EUC-KR but UTF-8 should win
			const bytes = new Uint8Array([0xEA, 0xB0, 0x80])
			expect(decodeBytes(bytes)).toBe('가')
		})
	})
})
