import { describe, test, expect } from 'bun:test'
import { fieldBox, hitTestFields, fontPx, scaleFont } from '../src/title-editor.js'

// 10 score px per character, whatever the font
const measure = (text) => text.length * 10

const title = { field: 'title', text: 'Happy', x: 400, y: 50, align: 'center', font: 'bold 20px Times' }
const author = { field: 'author', text: 'Trad.', x: 700, y: 80, align: 'right', font: '10px Times' }
const lyricist = { field: 'lyricist', text: '', x: 100, y: 80, align: 'left', font: '10px Times' }

describe('fieldBox', () => {
	test('centered text spans both sides of its anchor', () => {
		expect(fieldBox(title, measure)).toEqual({ left: 375, top: 33, right: 425, bottom: 55 })
	})

	test('right-aligned text ends at its anchor', () => {
		const b = fieldBox(author, measure)
		expect(b.right).toBe(700)
		expect(b.left).toBe(650)
	})

	test('empty field is sized by its placeholder', () => {
		const b = fieldBox(lyricist, measure)
		expect(b.left).toBe(100)
		expect(b.right).toBe(100 + 'Lyricist'.length * 10)
	})
})

describe('hitTestFields', () => {
	const fields = [title, author, lyricist]

	test('finds the field under the point', () => {
		expect(hitTestFields(fields, 400, 45, measure)).toBe(title)
		expect(hitTestFields(fields, 690, 78, measure)).toBe(author)
		expect(hitTestFields(fields, 110, 78, measure)).toBe(lyricist)
	})

	test('misses outside every box', () => {
		expect(hitTestFields(fields, 400, 200, measure)).toBe(null)
		expect(hitTestFields(fields, 500, 50, measure)).toBe(null)
	})
})

describe('font helpers', () => {
	test('reads and scales the px size', () => {
		expect(fontPx('italic bold 24px "Times New Roman"')).toBe(24)
		expect(scaleFont('italic bold 24px Times', 1.5)).toBe('italic bold 36.00px Times')
	})
})
