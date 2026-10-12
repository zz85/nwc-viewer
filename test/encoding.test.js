import { describe, test, expect } from 'bun:test'

const { looksLikeWestern, looksLikeEUCKR, looksLikeShiftJIS, looksLikeGBK, looksLikeCyrillic, decodeBytes } = await import('../src/nwc.js')

describe('Encoding detection', () => {
	describe('looksLikeWestern', () => {
		test('returns false for pure ASCII', () => {
			expect(looksLikeWestern(new Uint8Array([0x48, 0x69]))).toBe(false)
		})

		test('returns true for isolated accented letter (é + ASCII)', () => {
			expect(looksLikeWestern(new Uint8Array([0x70, 0xE9, 0x64]))).toBe(true)
		})

		test('returns true for two adjacent Latin letters (çã)', () => {
			expect(looksLikeWestern(new Uint8Array([0x69, 0xE7, 0xE3, 0x6F]))).toBe(true)
		})

		test('returns false for EUC-KR Hangul pair (아 = 0xBE 0xC6)', () => {
			expect(looksLikeWestern(new Uint8Array([0xBE, 0xC6]))).toBe(false)
		})

		test('returns false for runs of 3+ high bytes (Cyrillic word)', () => {
			expect(looksLikeWestern(new Uint8Array([0xEC, 0xE8, 0xF0]))).toBe(false)
		})

		test('returns false for bytes unused in Western text (Shift-JIS lead 0x82)', () => {
			expect(looksLikeWestern(new Uint8Array([0x82, 0x40]))).toBe(false)
		})
	})

	describe('looksLikeEUCKR', () => {
		test('returns false for pure ASCII', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]))).toBe(false)
		})

		test('returns false for empty array', () => {
			expect(looksLikeEUCKR(new Uint8Array([]))).toBe(false)
		})

		test('returns true for valid EUC-KR byte pair (0xBE 0xC6 = 아)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0xBE, 0xC6]))).toBe(true)
		})

		test('returns true for EUC-KR with ASCII prefix', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x41, 0xBE, 0xC6]))).toBe(true)
		})

		test('returns true for multiple valid EUC-KR pairs', () => {
			expect(looksLikeEUCKR(new Uint8Array([0xBE, 0xC6, 0xB9, 0xF6, 0xC1, 0xF6]))).toBe(true)
		})

		test('returns true for trail byte in lowercase range (0x61-0x7A)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x81, 0x61]))).toBe(true)
		})

		test('returns true for trail byte in uppercase range (0x41-0x5A)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x81, 0x41]))).toBe(true)
		})

		test('returns false for invalid trail byte 0x30', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x81, 0x30]))).toBe(false)
		})

		test('returns false for dangling lead byte', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x41, 0xBE]))).toBe(false)
		})

		test('returns false for trail byte 0x40 (below valid range)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x81, 0x40]))).toBe(false)
		})

		test('returns false for trail byte 0x5B (gap between ranges)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x81, 0x5B]))).toBe(false)
		})

		test('returns false for trail byte 0x7B (above lowercase range)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x81, 0x7B]))).toBe(false)
		})

		test('returns false for lead byte 0x80 (below valid range)', () => {
			expect(looksLikeEUCKR(new Uint8Array([0x80]))).toBe(false)
		})
	})

	describe('looksLikeShiftJIS', () => {
		test('returns false for pure ASCII', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]))).toBe(false)
		})

		test('returns false for empty array', () => {
			expect(looksLikeShiftJIS(new Uint8Array([]))).toBe(false)
		})

		test('returns true for half-width katakana (0xA1-0xDF)', () => {
			// 0xB1 = ア (half-width katakana A)
			expect(looksLikeShiftJIS(new Uint8Array([0xB1]))).toBe(true)
		})

		test('returns true for multiple half-width katakana', () => {
			// アイウ = 0xB1 0xB2 0xB3
			expect(looksLikeShiftJIS(new Uint8Array([0xB1, 0xB2, 0xB3]))).toBe(true)
		})

		test('returns true for double-byte with lead 0x81-0x9F', () => {
			// 0x82 0x40 = valid Shift-JIS (note: NOT valid EUC-KR since 0x40 trail is rejected)
			expect(looksLikeShiftJIS(new Uint8Array([0x82, 0x40]))).toBe(true)
		})

		test('returns true for double-byte with lead 0xE0-0xFC', () => {
			// 0xE0 0x40 = valid Shift-JIS
			expect(looksLikeShiftJIS(new Uint8Array([0xE0, 0x40]))).toBe(true)
		})

		test('returns true for trail byte 0x7E (upper boundary)', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x82, 0x7E]))).toBe(true)
		})

		test('returns true for trail byte 0x80 (second range start)', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x82, 0x80]))).toBe(true)
		})

		test('returns true for trail byte 0xFC (upper boundary)', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x82, 0xFC]))).toBe(true)
		})

		test('returns false for invalid trail byte 0x7F', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x82, 0x7F]))).toBe(false)
		})

		test('returns false for trail byte 0xFD (above valid range)', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x82, 0xFD]))).toBe(false)
		})

		test('returns false for lead byte 0xA0 (not in any valid range)', () => {
			// 0xA0 is below 0xA1 (not half-width katakana) and not in lead range
			expect(looksLikeShiftJIS(new Uint8Array([0xA0]))).toBe(false)
		})

		test('returns false for dangling lead byte at end', () => {
			expect(looksLikeShiftJIS(new Uint8Array([0x82]))).toBe(false)
		})

		test('returns false for lead 0xFD (above valid lead range)', () => {
			// 0xFD is > 0xFC and not in 0xA1-0xDF
			expect(looksLikeShiftJIS(new Uint8Array([0xFD, 0x40]))).toBe(false)
		})

		test('returns true for mixed half-width katakana and double-byte', () => {
			// Half-width ア (0xB1) + double-byte 0x82 0x40
			expect(looksLikeShiftJIS(new Uint8Array([0xB1, 0x82, 0x40]))).toBe(true)
		})
	})

	describe('looksLikeGBK', () => {
		test('returns false for pure ASCII', () => {
			expect(looksLikeGBK(new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]))).toBe(false)
		})

		test('returns false for empty array', () => {
			expect(looksLikeGBK(new Uint8Array([]))).toBe(false)
		})

		test('returns true for lead 0x81 trail 0x40 (widest valid pair)', () => {
			expect(looksLikeGBK(new Uint8Array([0x81, 0x40]))).toBe(true)
		})

		test('returns true for lead 0xFE trail 0xFE (upper boundary)', () => {
			expect(looksLikeGBK(new Uint8Array([0xFE, 0xFE]))).toBe(true)
		})

		test('returns true for trail byte 0x7E (first range upper boundary)', () => {
			expect(looksLikeGBK(new Uint8Array([0xB0, 0x7E]))).toBe(true)
		})

		test('returns true for trail byte 0x80 (second range start)', () => {
			expect(looksLikeGBK(new Uint8Array([0xB0, 0x80]))).toBe(true)
		})

		test('returns false for trail byte 0x7F (gap between ranges)', () => {
			expect(looksLikeGBK(new Uint8Array([0xB0, 0x7F]))).toBe(false)
		})

		test('returns false for trail byte 0x3F (below valid range)', () => {
			expect(looksLikeGBK(new Uint8Array([0xB0, 0x3F]))).toBe(false)
		})

		test('returns false for trail byte 0xFF (above valid range)', () => {
			expect(looksLikeGBK(new Uint8Array([0xB0, 0xFF]))).toBe(false)
		})

		test('returns false for lead byte 0x80 (below valid range)', () => {
			expect(looksLikeGBK(new Uint8Array([0x80]))).toBe(false)
		})

		test('returns false for dangling lead byte', () => {
			expect(looksLikeGBK(new Uint8Array([0xB0]))).toBe(false)
		})
	})

	describe('looksLikeCyrillic', () => {
		test('returns false for pure ASCII', () => {
			expect(looksLikeCyrillic(new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]))).toBe(false)
		})

		test('returns false for empty array', () => {
			expect(looksLikeCyrillic(new Uint8Array([]))).toBe(false)
		})

		test('returns true for bytes in Cyrillic range 0xC0-0xFF (at least 2)', () => {
			// "Ад" in Windows-1251: 0xC0 0xE4
			expect(looksLikeCyrillic(new Uint8Array([0xC0, 0xE4]))).toBe(true)
		})

		test('returns true for longer Cyrillic string', () => {
			// "Привет" in Windows-1251: 0xCF 0xF0 0xE8 0xE2 0xE5 0xF2
			expect(looksLikeCyrillic(new Uint8Array([0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2]))).toBe(true)
		})

		test('returns true when Cyrillic bytes dominate over other high bytes', () => {
			// Mostly 0xC0+ with one 0x80-0xBF byte (e.g. 0xA0 = non-breaking space)
			expect(looksLikeCyrillic(new Uint8Array([0xC0, 0xE4, 0xA0, 0xF0, 0xE8]))).toBe(true)
		})

		test('returns false when non-Cyrillic high bytes dominate', () => {
			// Majority below 0xC0
			expect(looksLikeCyrillic(new Uint8Array([0x80, 0x81, 0x82, 0xC0]))).toBe(false)
		})

		test('returns false for bytes only in 0x80-0xBF range', () => {
			expect(looksLikeCyrillic(new Uint8Array([0x80, 0x90, 0xA0, 0xB0]))).toBe(false)
		})

		test('returns false for single high byte (avoids false positives)', () => {
			// A single 0xE9 should not trigger Cyrillic (could be Windows-1252 'é')
			expect(looksLikeCyrillic(new Uint8Array([0x63, 0x61, 0x66, 0xE9]))).toBe(false)
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
			expect(decodeBytes(new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]))).toBe('Hello')
		})

		test('decodes valid UTF-8 correctly', () => {
			// "한" in UTF-8: 0xED 0x95 0x9C
			expect(decodeBytes(new Uint8Array([0xED, 0x95, 0x9C]))).toBe('한')
		})

		test('prefers UTF-8 over EUC-KR when input is valid UTF-8', () => {
			// "가" in UTF-8: 0xEA 0xB0 0x80
			expect(decodeBytes(new Uint8Array([0xEA, 0xB0, 0x80]))).toBe('가')
		})

		test('decodes EUC-KR Korean text (아 = 0xBE 0xC6)', () => {
			expect(decodeBytes(new Uint8Array([0xBE, 0xC6]))).toBe('아')
		})

		test('decodes multi-syllable EUC-KR (아버지)', () => {
			expect(decodeBytes(new Uint8Array([0xBE, 0xC6, 0xB9, 0xF6, 0xC1, 0xF6]))).toBe('아버지')
		})

		test('decodes EUC-KR mixed with ASCII', () => {
			expect(decodeBytes(new Uint8Array([0x41, 0xBE, 0xC6]))).toBe('A아')
		})

		test('decodes Shift-JIS when EUC-KR trail is invalid (0x82 0x40)', () => {
			// 0x82 0x40 is not valid EUC-KR (trail 0x40) but is valid Shift-JIS
			// In Shift-JIS this is a specific character
			const result = decodeBytes(new Uint8Array([0x82, 0x40]))
			// Just verify it doesn't fall through to Windows-1252
			expect(result).not.toBe('\x82@')
		})

		test('decodes a run of Shift-JIS half-width katakana (ｱｲｳ)', () => {
			// 0xB1 0xB2 0xB3: a run of 3 high bytes rules out Western; EUC-KR
			// fails on the dangling third byte, Shift-JIS accepts single-byte kana
			expect(decodeBytes(new Uint8Array([0xB1, 0xB2, 0xB3]))).toBe('ｱｲｳ')
		})

		test('treats a lone 0xB1 as Windows-1252 (±), not half-width katakana', () => {
			expect(decodeBytes(new Uint8Array([0x31, 0xB1, 0x32]))).toBe('1±2')
		})

		test('decodes GBK Chinese text when EUC-KR and Shift-JIS fail', () => {
			// 0xFD 0x80: EUC-KR rejects trail 0x80, Shift-JIS rejects lead 0xFD,
			// Western rejects the adjacent pair (0x80 is not a Latin letter),
			// GBK accepts lead 0x81-0xFE with trail 0x80-0xFE
			const bytes = new Uint8Array([0xFD, 0x80])
			expect(decodeBytes(bytes)).toBe(new TextDecoder('gbk').decode(bytes))
		})

		test('decodes Cyrillic text with odd-length pattern', () => {
			// "Привет мир" - has space breaking CJK pairing, fails EUC-KR/Shift-JIS/GBK
			const bytes = new Uint8Array([0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2, 0x20, 0xEC, 0xE8, 0xF0])
			expect(decodeBytes(bytes)).toBe('Привет мир')
		})

		test('falls back to Windows-1252 for accented Latin text', () => {
			// "café" in Windows-1252: 0x63 0x61 0x66 0xE9
			expect(decodeBytes(new Uint8Array([0x63, 0x61, 0x66, 0xE9]))).toBe('café')
		})

		test('decodes Windows-1252 euro sign (0x80)', () => {
			// 0x80 is below all CJK lead ranges and fails Cyrillic check
			expect(decodeBytes(new Uint8Array([0x80, 0x32, 0x30]))).toBe('\u20AC20')
		})

		test('decodes Western text Gymnopédie No.1 as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0x47, 0x79, 0x6D, 0x6E, 0x6F, 0x70, 0xE9, 0x64, 0x69, 0x65, 0x20, 0x4E, 0x6F, 0x2E, 0x31]))).toBe('Gymnopédie No.1')
		})

		test('decodes Western text Copyright © 1998 as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0x43, 0x6F, 0x70, 0x79, 0x72, 0x69, 0x67, 0x68, 0x74, 0x20, 0xA9, 0x20, 0x31, 0x39, 0x39, 0x38]))).toBe('Copyright © 1998')
		})

		test('decodes Western text Père Noël as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0x50, 0xE8, 0x72, 0x65, 0x20, 0x4E, 0x6F, 0xEB, 0x6C]))).toBe('Père Noël')
		})

		test('decodes Western text Müller as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0x4D, 0xFC, 0x6C, 0x6C, 0x65, 0x72]))).toBe('Müller')
		})

		test('decodes Western text Conceição as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0x43, 0x6F, 0x6E, 0x63, 0x65, 0x69, 0xE7, 0xE3, 0x6F]))).toBe('Conceição')
		})

		test('decodes Western text Arcadelt (1504–1568) as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0x41, 0x72, 0x63, 0x61, 0x64, 0x65, 0x6C, 0x74, 0x20, 0x28, 0x31, 0x35, 0x30, 0x34, 0x96, 0x31, 0x35, 0x36, 0x38, 0x29]))).toBe('Arcadelt (1504–1568)')
		})

		test('decodes Western text «Noël» as Windows-1252', () => {
			expect(decodeBytes(new Uint8Array([0xAB, 0x4E, 0x6F, 0xEB, 0x6C, 0xBB]))).toBe('«Noël»')
		})

		test('accepts plain Array input', () => {
			expect(decodeBytes([0x48, 0x65, 0x6C, 0x6C, 0x6F])).toBe('Hello')
		})
	})
})
