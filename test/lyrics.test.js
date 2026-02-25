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

	test('splits on semicolons', () => {
		const tokens = tokenizeLyrics('a;b;c ')
		expect(tokens).toEqual(['a;', 'b;', 'c'])
	})

	test('splits on semicolons without trailing space', () => {
		const tokens = tokenizeLyrics('a;b;c')
		expect(tokens).toEqual(['a;', 'b;', 'c'])
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

	test('handles multiple spaces', () => {
		const tokens = tokenizeLyrics('test 1  2    3 ')
		expect(tokens).toEqual(['test', '1', '2', '3'])
	})

	test('handles complex lyrics with trailing space', () => {
		const tokens = tokenizeLyrics('Glo-ry to the King ')
		expect(tokens).toEqual(['Glo-', 'ry', 'to', 'the', 'King'])
	})

	test('handles trailing word without trailing space', () => {
		const tokens = tokenizeLyrics('hello world')
		expect(tokens).toEqual(['hello', 'world'])
	})
})
