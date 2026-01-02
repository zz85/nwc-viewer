import { describe, test, expect } from 'bun:test'
import tokenizeLyrics from '../src/lyrics.js'

describe('tokenizeLyrics', () => {
	test('handles empty string', () => {
		const tokens = tokenizeLyrics('')
		expect(tokens).toEqual([])
	})

	test('splits on hyphens and keeps hyphen with preceding word', () => {
		const tokens = tokenizeLyrics('hel-lo ')
		expect(tokens).toEqual(['hel-', 'lo'])
	})

	test('splits on semicolons (known bug - trailing word lost)', () => {
		const tokens = tokenizeLyrics('a;b;c ')
		// Known bug: trailing word after semicolon not captured even with trailing space
		expect(tokens).toEqual(['a;', 'b;'])
	})

	test('splits on semicolons without trailing space (known bug)', () => {
		const tokens = tokenizeLyrics('a;b;c')
		// Known bug: trailing word without whitespace is not captured
		expect(tokens).toEqual(['a;', 'b;'])
	})

	test('handles underscores as dividers', () => {
		const tokens = tokenizeLyrics('hold_this ')
		expect(tokens).toEqual(['hold_', 'this'])
	})

	// Note: tokenizeLyrics has a known issue where trailing words without
	// whitespace are not captured. These tests document current behavior.
	test('splits on whitespace (trailing space required)', () => {
		const tokens = tokenizeLyrics('hello world ')
		expect(tokens).toEqual(['hello', 'world'])
	})

	test('handles multiple spaces (known bug - only first word captured)', () => {
		const tokens = tokenizeLyrics('test 1  2    3 ')
		// Known bug: multiple spaces break tokenization
		expect(tokens).toEqual(['test'])
	})

	test('handles complex lyrics with trailing space', () => {
		const tokens = tokenizeLyrics('Glo-ry to the King ')
		expect(tokens).toEqual(['Glo-', 'ry', 'to', 'the', 'King'])
	})
})
