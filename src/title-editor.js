/**
 * Click-to-edit for the title block (title, author, lyricist), in the style
 * of Sibelius / MuseScore: hovering a text outlines it, clicking opens a text
 * box over it.  Enter or clicking away applies the change, Escape cancels.
 * Empty fields show a placeholder on hover so they can be filled in.
 *
 * Everything here is DOM overlay; the canvas (and PDF export) only ever
 * shows the committed text.
 */

const PLACEHOLDERS = { title: 'Title', author: 'Composer / arranger', lyricist: 'Lyricist' }

// Glyph extent around the baseline, as a fraction of the font size
const ASCENT = 0.85
const DESCENT = 0.25
// Extra hit margin around each text (score px)
const HIT_PAD = 4

/** Font size in px from a CSS font string like "italic bold 24px Times". */
function fontPx(font) {
	const m = /(\d+(?:\.\d+)?)px/.exec(font || '')
	return m ? parseFloat(m[1]) : 12
}

/** Text shown for a field: its text, or the placeholder when empty. */
function displayText(f) {
	return f.text || PLACEHOLDERS[f.field] || f.field
}

/**
 * Score-space box { left, top, right, bottom } of a title field.
 * @param {function(string, string): number} measure - (text, font) → width
 */
function fieldBox(f, measure) {
	const width = measure(displayText(f), f.font)
	const px = fontPx(f.font)
	const left = f.align === 'center' ? f.x - width / 2 : f.align === 'right' ? f.x - width : f.x
	return { left: left, top: f.y - px * ASCENT, right: left + width, bottom: f.y + px * DESCENT }
}

/** The field under score-space point (x, y), or null. */
function hitTestFields(fields, x, y, measure) {
	for (const f of fields) {
		const b = fieldBox(f, measure)
		if (x >= b.left - HIT_PAD && x <= b.right + HIT_PAD && y >= b.top - HIT_PAD && y <= b.bottom + HIT_PAD) return f
	}
	return null
}

/** Same font, with its px size multiplied by `scale` (for on-screen zoom). */
function scaleFont(font, scale) {
	return font.replace(/(\d+(?:\.\d+)?)px/, (_, px) => `${(parseFloat(px) * scale).toFixed(2)}px`)
}

class TitleEditor {
	/**
	 * @param {object} opts
	 * @param {HTMLElement} opts.scoreElm - scrolling score container
	 * @param {function(): HTMLCanvasElement} opts.getCanvas
	 * @param {function(): number} opts.getZoom
	 * @param {function(): Array} opts.getFields - title fields of the current layout
	 * @param {function(string, string)} opts.onCommit - (field, newText)
	 */
	constructor({ scoreElm, getCanvas, getZoom, getFields, onCommit }) {
		this.scoreElm = scoreElm
		this.getCanvas = getCanvas
		this.getZoom = getZoom
		this.getFields = getFields
		this.onCommit = onCommit
		this.editing = null // { field, input }

		this._measureCtx = document.createElement('canvas').getContext('2d')
		this.measure = (text, font) => {
			this._measureCtx.font = font
			return this._measureCtx.measureText(text).width
		}

		this.hoverBox = document.createElement('div')
		this.hoverBox.className = 'title-hover'
		document.body.appendChild(this.hoverBox)

		scoreElm.addEventListener('pointermove', (e) => this._onHover(e))
		scoreElm.addEventListener('pointerleave', () => this._showHover(null))
		scoreElm.addEventListener('scroll', () => {
			this._showHover(null)
			if (this.editing) this._position(this.editing.field, this.editing.input)
		})
	}

	/** Score-space point under a pointer event, or null off the canvas. */
	_scorePoint(e) {
		const canvas = this.getCanvas()
		if (!canvas) return null
		const rect = canvas.getBoundingClientRect()
		const zoom = this.getZoom()
		return {
			x: (e.clientX - rect.left + this.scoreElm.scrollLeft) / zoom,
			y: (e.clientY - rect.top + this.scoreElm.scrollTop) / zoom,
		}
	}

	_fieldAt(e) {
		const p = this._scorePoint(e)
		return p ? hitTestFields(this.getFields(), p.x, p.y, this.measure) : null
	}

	/** Viewport rect of a field's box. */
	_screenRect(f) {
		const b = fieldBox(f, this.measure)
		const rect = this.getCanvas().getBoundingClientRect()
		const zoom = this.getZoom()
		const toX = (x) => rect.left + x * zoom - this.scoreElm.scrollLeft
		const toY = (y) => rect.top + y * zoom - this.scoreElm.scrollTop
		return { left: toX(b.left), top: toY(b.top), right: toX(b.right), bottom: toY(b.bottom) }
	}

	_onHover(e) {
		if (this.editing) return
		this._showHover(this._fieldAt(e))
	}

	_showHover(f) {
		const box = this.hoverBox
		this.scoreElm.style.cursor = f ? 'text' : ''
		if (!f) {
			box.style.display = 'none'
			return
		}
		const r = this._screenRect(f)
		const pad = HIT_PAD * this.getZoom()
		Object.assign(box.style, {
			display: 'block',
			left: `${r.left - pad}px`,
			top: `${r.top - pad}px`,
			width: `${r.right - r.left + pad * 2}px`,
			height: `${r.bottom - r.top + pad * 2}px`,
			font: scaleFont(f.font, this.getZoom()),
			textAlign: f.align,
		})
		box.textContent = f.text ? '' : displayText(f)
		box.classList.toggle('empty', !f.text)
	}

	/**
	 * Handle a click on the score: start editing the field under it.
	 * @returns {boolean} true if the click was used
	 */
	handleClick(e) {
		const f = this._fieldAt(e)
		if (!f) return false
		this.edit(f)
		return true
	}

	/** Open the in-place text box for a title field. */
	edit(f) {
		this.finish(true)
		this._showHover(null)
		const input = document.createElement('input')
		input.type = 'text'
		input.className = 'title-edit'
		input.value = f.text
		input.placeholder = PLACEHOLDERS[f.field] || ''
		input.setAttribute('aria-label', `Edit ${PLACEHOLDERS[f.field] || f.field}`)
		document.body.appendChild(input)
		this.editing = { field: f, input }
		this._position(f, input)

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') this.finish(true)
			else if (e.key === 'Escape') this.finish(false)
			e.stopPropagation() // keep score shortcuts (e.g. space to play) out
		})
		input.addEventListener('blur', () => this.finish(true))
		input.focus()
		input.select()
	}

	_position(f, input) {
		const r = this._screenRect(f)
		const zoom = this.getZoom()
		// Wide enough to type into; anchored like the text (centered titles
		// grow both ways, right-aligned credits grow to the left)
		const width = Math.max(r.right - r.left, 240 * zoom) + 16
		const left = f.align === 'center' ? (r.left + r.right) / 2 - width / 2
			: f.align === 'right' ? r.right - width + 8 : r.left - 8
		Object.assign(input.style, {
			left: `${left}px`,
			top: `${r.top - 4}px`,
			width: `${width}px`,
			height: `${r.bottom - r.top + 8}px`,
			font: scaleFont(f.font, zoom),
			textAlign: f.align,
		})
	}

	/** Close the text box, applying the text if `apply` and it changed. */
	finish(apply) {
		const editing = this.editing
		if (!editing) return
		this.editing = null
		const { field, input } = editing
		const value = input.value.trim()
		input.remove()
		if (apply && value !== field.text) this.onCommit(field.field, value)
	}
}

export { TitleEditor, fieldBox, hitTestFields, fontPx, scaleFont, PLACEHOLDERS }
