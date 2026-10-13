import { describe, test, expect } from 'bun:test'

// Mock browser globals needed by drawing.js → loaders.js import chain
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null }
globalThis.document = globalThis.document || { getElementById: () => mockElement, body: mockElement }
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const { Drawing, Stem } = await import('../src/drawing.js')
const { setShowHiddenItems } = await import('../src/constants.js')

// Records the colour and opacity each stroke is drawn with
function recordingCtx() {
	const strokes = []
	const ctx = {
		font: '', textBaseline: '', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
		_stack: [],
		save() { this._stack.push([this.fillStyle, this.strokeStyle, this.globalAlpha]) },
		restore() { [this.fillStyle, this.strokeStyle, this.globalAlpha] = this._stack.pop() },
		translate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, fill() {},
		stroke() { strokes.push({ color: this.strokeStyle, alpha: this.globalAlpha }) },
	}
	return { ctx, strokes }
}

function drawStems(hiddenFlags) {
	const { ctx, strokes } = recordingCtx()
	const drawing = new Drawing(ctx)
	for (const hidden of hiddenFlags) {
		drawing.markHidden = hidden
		const stem = new Stem(20)
		stem.moveTo(10, 10)
		drawing.add(stem)
	}
	drawing.markHidden = false
	drawing.draw(ctx, { x: 0, y: 0, width: 1000, height: 1000 })
	return strokes
}

describe('Show hidden items', () => {
	test('markHidden marks added elements hidden', () => {
		const drawing = new Drawing(recordingCtx().ctx)
		drawing.markHidden = true
		const a = new Stem(20)
		drawing.add(a)
		drawing.markHidden = false
		const b = new Stem(20)
		drawing.add(b)
		expect(a.hidden).toBe(true)
		expect(b.hidden).toBeFalsy()
	})

	test('hidden elements are skipped by default', () => {
		setShowHiddenItems(false)
		expect(drawStems([false, true]).length).toBe(1)
	})

	test('with the setting on they are drawn as faint ghosts, others stay black', () => {
		setShowHiddenItems(true)
		try {
			const [visible, ghost] = drawStems([false, true])
			expect(visible).toEqual({ color: '#000', alpha: 1 })
			expect(ghost.color).not.toBe('#000')
			expect(ghost.alpha).toBeLessThan(1)
		} finally {
			setShowHiddenItems(false)
		}
	})
})
