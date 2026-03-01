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

	test('splits on whitespace', () => {
		const tokens = tokenizeLyrics('hello world ')
		expect(tokens).toEqual(['hello', 'world'])
	})

	test('handles multiple spaces', () => {
		const tokens = tokenizeLyrics('test 1  2    3 ')
		expect(tokens).toEqual(['test', '1', '2', '3'])
	})

	test('handles complex lyrics', () => {
		const tokens = tokenizeLyrics('Glo-ry to the King ')
		expect(tokens).toEqual(['Glo-', 'ry', 'to', 'the', 'King'])
	})

	test('handles trailing word without trailing space', () => {
		const tokens = tokenizeLyrics('hello world')
		expect(tokens).toEqual(['hello', 'world'])
	})

	// --- Hyphen / divider edge cases ---

	test('leading hyphen is skipped (NWC continuation prefix)', () => {
		const tokens = tokenizeLyrics('-test')
		expect(tokens).toEqual(['test'])
	})

	test('bare hyphen between spaces is skipped', () => {
		// "word -next" — the hyphen after space is a leading divider, skipped
		const tokens = tokenizeLyrics('word -next')
		expect(tokens).toEqual(['word', 'next'])
	})

	test('just a hyphen produces no tokens', () => {
		const tokens = tokenizeLyrics('-')
		expect(tokens).toEqual([])
	})

	test('consecutive hyphens in word', () => {
		// "a--b" — first hyphen attached to "a", second is a leading divider skipped
		const tokens = tokenizeLyrics('a--b')
		expect(tokens).toEqual(['a-', 'b'])
	})

	test('multi-syllable word with hyphens', () => {
		const tokens = tokenizeLyrics('re-con-ciled')
		expect(tokens).toEqual(['re-', 'con-', 'ciled'])
	})

	test('exclamation does not eat next character', () => {
		const tokens = tokenizeLyrics('Hark! The')
		expect(tokens).toEqual(['Hark!', 'The'])
	})

	test('comma does not eat next character', () => {
		const tokens = tokenizeLyrics('sing, Glo-ry')
		expect(tokens).toEqual(['sing,', 'Glo-', 'ry'])
	})

	test('full hymn line', () => {
		const tokens = tokenizeLyrics('Hark! The Her-ald An-gels sing,')
		expect(tokens).toEqual(['Hark!', 'The', 'Her-', 'ald', 'An-', 'gels', 'sing,'])
	})

	test('multiline lyrics (newline as whitespace)', () => {
		const tokens = tokenizeLyrics('sing,\nGlo-ry')
		expect(tokens).toEqual(['sing,', 'Glo-', 'ry'])
	})

	test('ending with divider', () => {
		const tokens = tokenizeLyrics('sing,')
		expect(tokens).toEqual(['sing,'])
	})

	test('ending with hyphen (continuation)', () => {
		const tokens = tokenizeLyrics('Glo-')
		expect(tokens).toEqual(['Glo-'])
	})
})
