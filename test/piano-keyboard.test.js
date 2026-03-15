import { describe, test, expect } from 'bun:test'

// Minimal DOM mocks — must be set up BEFORE any imports
const _created = []
globalThis.document = globalThis.document || {}
// Ensure createElement is always available as a real function
globalThis.document.createElement = (tag) => {
	const el = {
		style: { cssText: '' },
		className: '',
		dataset: {},
		title: '',
		tagName: tag.toUpperCase(),
		children: [],
		appendChild(child) { this.children.push(child) },
		remove() {},
	}
	_created.push(el)
	return el
}
globalThis.document.getElementById = globalThis.document.getElementById || (() => ({
	style: {},
	appendChild(child) {},
	insertBefore(child, ref) {},
	get parentElement() { return this },
}))
globalThis.document.body = globalThis.document.body || globalThis.document.getElementById()
globalThis.window = globalThis.window || { devicePixelRatio: 1 }

const { PianoKeyboard } = await import('../src/piano-keyboard.js')

const mockContainer = {
	style: {},
	children: [],
	appendChild(child) { this.children.push(child) },
	insertBefore(child, ref) { this.children.push(child) },
	get parentElement() { return this },
}

describe('PianoKeyboard', () => {
	test('constructs with 88 keys (A0-C8)', () => {
		const kb = new PianoKeyboard(mockContainer)
		expect(kb._keys.size).toBe(88)
		// A0 = MIDI 21, C8 = MIDI 108
		expect(kb._keys.has(21)).toBe(true)
		expect(kb._keys.has(108)).toBe(true)
		expect(kb._keys.has(20)).toBe(false)
		expect(kb._keys.has(109)).toBe(false)
	})

	test('noteOn highlights a key and noteOff un-highlights it', () => {
		const kb = new PianoKeyboard(mockContainer)
		kb.noteOn({ midi: 60, staffIndex: 0 })
		expect(kb._activeNotes.has(60)).toBe(true)
		expect(kb._activeNotes.get(60).size).toBe(1)

		kb.noteOff({ midi: 60, staffIndex: 0 })
		expect(kb._activeNotes.has(60)).toBe(false)
	})

	test('multiple staves can activate the same key', () => {
		const kb = new PianoKeyboard(mockContainer)
		kb.noteOn({ midi: 60, staffIndex: 0 })
		kb.noteOn({ midi: 60, staffIndex: 1 })
		expect(kb._activeNotes.get(60).size).toBe(2)

		kb.noteOff({ midi: 60, staffIndex: 0 })
		expect(kb._activeNotes.get(60).size).toBe(1)

		kb.noteOff({ midi: 60, staffIndex: 1 })
		expect(kb._activeNotes.has(60)).toBe(false)
	})

	test('ignores notes outside 88-key range', () => {
		const kb = new PianoKeyboard(mockContainer)
		kb.noteOn({ midi: 10, staffIndex: 0 })
		kb.noteOn({ midi: 120, staffIndex: 0 })
		expect(kb._activeNotes.size).toBe(0)
	})

	test('clear() removes all active notes', () => {
		const kb = new PianoKeyboard(mockContainer)
		kb.noteOn({ midi: 60, staffIndex: 0 })
		kb.noteOn({ midi: 64, staffIndex: 1 })
		kb.noteOn({ midi: 67, staffIndex: 2 })
		expect(kb._activeNotes.size).toBe(3)

		kb.clear()
		expect(kb._activeNotes.size).toBe(0)
	})

	test('toggle() switches visibility', () => {
		const kb = new PianoKeyboard(mockContainer)
		expect(kb.visible).toBe(true)

		const r1 = kb.toggle()
		expect(r1).toBe(false)
		expect(kb.visible).toBe(false)

		const r2 = kb.toggle()
		expect(r2).toBe(true)
		expect(kb.visible).toBe(true)
	})

	test('white and black key counts are correct', () => {
		const kb = new PianoKeyboard(mockContainer)
		let whiteCount = 0
		let blackCount = 0
		for (const [midi] of kb._keys) {
			const pc = midi % 12
			const isBlack = [1, 3, 6, 8, 10].includes(pc)
			if (isBlack) blackCount++
			else whiteCount++
		}
		expect(whiteCount).toBe(52) // 52 white keys on 88-key piano
		expect(blackCount).toBe(36) // 36 black keys on 88-key piano
	})

	test('noteOn with missing staffIndex defaults to 0', () => {
		const kb = new PianoKeyboard(mockContainer)
		kb.noteOn({ midi: 60 })
		expect(kb._activeNotes.get(60).has(0)).toBe(true)

		kb.noteOff({ midi: 60 })
		expect(kb._activeNotes.has(60)).toBe(false)
	})
})
