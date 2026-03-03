/**
 * playback-highlight.js — Single-canvas playback visuals: highlights active
 * notes, draws a position cursor, and auto-scrolls the viewport.
 *
 * Instead of a separate overlay canvas, this integrates into the existing
 * score canvas render pass.  During playback, a rAF loop calls quickDraw()
 * each frame; after the score is painted, drawHighlights(ctx) is called to
 * paint highlights and cursor on top.
 */

import { getFontSize, getZoomLevel, getLayoutMode } from './constants.js'
import { buildTempoMap, ticksToSeconds } from './audio.js'

// ── Highlight colors ───────────────────────────────────────────────────────

const HIGHLIGHT_COLOR = 'rgba(255, 235, 59, 0.5)'     // translucent yellow overlay (highlighter pen)
const GLOW_COLOR = 'rgba(30, 120, 255, 0.35)'        // soft blue glow
const GLOW_RADIUS_FACTOR = 2.5                        // glow radius = noteWidth * factor
const CURSOR_COLOR = 'rgba(30, 120, 255, 0.4)'        // vertical cursor line
const CURSOR_WIDTH = 2                                 // px in score-space

// ── PlaybackHighlighter ────────────────────────────────────────────────────

export class PlaybackHighlighter {
	/**
	 * @param {HTMLElement} scoreContainer - The #score div that holds the canvas
	 */
	constructor(scoreContainer) {
		this._container = scoreContainer
		this._rafId = null
		this._running = false
		this._paused = false  // true when paused (highlights stay visible)

		// Active notes: Set of token objects currently sounding
		this._activeTokens = new Set()

		// Time → position index for cursor placement
		this._timeIndex = []       // sorted by time: [{time, x, y}]

		// Current playback time (updated ~46ms from scheduler)
		this._currentTime = 0

		// Highlight style: 'colored' or 'glow'
		this._style = 'colored'

		// Auto-scroll: enabled by default
		this._autoScrollEnabled = true
	}

	// ── Score data binding ─────────────────────────────────────────────────

	/**
	 * Build the time→position index from the current score data.
	 * Must be called after layout (interpret + score) so that tokens have
	 * drawingNoteHead with final x/y positions.
	 *
	 * @param {object} data - The score data object (data.score.staves)
	 */
	setScore(data) {
		const staves = data.score?.staves
		if (!staves || staves.length === 0) {
			this._timeIndex = []
			return
		}

		const tempoMap = buildTempoMap(staves)
		const index = []

		for (let si = 0; si < staves.length; si++) {
			const tokens = staves[si].tokens
			if (!tokens) continue
			for (let ti = 0; ti < tokens.length; ti++) {
				const tok = tokens[ti]
				if (tok.type !== 'Note' && tok.type !== 'Chord') continue
				if (tok.tickValue == null) continue

				// For Chord tokens, child notes have drawingNoteHead but the
				// parent may not.  Use the first child's head as fallback.
				let head = tok.drawingNoteHead
				if (!head && tok.type === 'Chord' && tok.notes) {
					for (const n of tok.notes) {
						if (n.drawingNoteHead) { head = n.drawingNoteHead; break }
					}
				}
				if (!head) continue

				const time = ticksToSeconds(tok.tickValue, tempoMap)
				index.push({
					time,
					x: head.x + (head.offsetX || 0),
					y: head.y + (head.offsetY || 0),
				})
			}
		}

		// Sort by time, then x (for stable cursor interpolation)
		index.sort((a, b) => a.time - b.time || a.x - b.x)

		// Deduplicate identical times — keep the leftmost x (stave 0)
		const deduped = []
		for (let i = 0; i < index.length; i++) {
			if (i > 0 && index[i].time === index[i - 1].time) continue
			deduped.push(index[i])
		}

		this._timeIndex = deduped
	}

	// ── Event handlers ─────────────────────────────────────────────────────

	/**
	 * Called when a note starts sounding.
	 * @param {object} noteEvent - The NoteEvent with .token reference
	 */
	onNoteOn(noteEvent) {
		if (noteEvent.token) {
			this._activeTokens.add(noteEvent.token)
		}
	}

	/**
	 * Called when a note stops sounding.
	 * @param {object} noteEvent - The NoteEvent with .token reference
	 */
	onNoteOff(noteEvent) {
		if (noteEvent.token) {
			this._activeTokens.delete(noteEvent.token)
		}
	}

	/**
	 * Update the current playback time (for cursor position).
	 * @param {number} time - Current time in seconds
	 */
	updateTime(time) {
		this._currentTime = time
	}

	// ── Style ──────────────────────────────────────────────────────────────

	/**
	 * Set the highlight rendering style.
	 * @param {'colored' | 'glow'} style
	 */
	setHighlightStyle(style) {
		this._style = style === 'glow' ? 'glow' : 'colored'
	}

	/** Toggle between 'colored' and 'glow' styles. Returns the new style. */
	toggleStyle() {
		this._style = this._style === 'colored' ? 'glow' : 'colored'
		return this._style
	}

	// ── Auto-scroll ───────────────────────────────────────────────────────

	/** Toggle auto-scroll on/off. Returns the new state. */
	toggleAutoScroll() {
		this._autoScrollEnabled = !this._autoScrollEnabled
		return this._autoScrollEnabled
	}

	/** Whether auto-scroll is currently enabled. */
	get autoScrollEnabled() { return this._autoScrollEnabled }

	// ── Render loop ────────────────────────────────────────────────────────

	/** Whether the highlighter is actively running (for quickDraw to check). */
	get active() { return this._running }

	/** Start the playback render loop. */
	start() {
		if (this._running) return
		this._running = true
		this._paused = false
		this._tick()
	}

	/** Stop the render loop and clear highlights on next paint. */
	stop() {
		this._running = false
		this._paused = false
		if (this._rafId != null) {
			cancelAnimationFrame(this._rafId)
			this._rafId = null
		}
		this._activeTokens.clear()
		// Repaint once without highlights to clear them
		this._repaintScore()
	}

	/** Pause the render loop but keep highlights visible (frozen in place). */
	pause() {
		this._running = false
		this._paused = true
		if (this._rafId != null) {
			cancelAnimationFrame(this._rafId)
			this._rafId = null
		}
		// Repaint once to show the frozen highlights
		this._repaintScore()
	}

	_tick() {
		if (!this._running) return
		this._repaintScore()
		if (this._autoScrollEnabled) this._autoScroll()
		this._rafId = requestAnimationFrame(() => this._tick())
	}

	/** Trigger a quickDraw repaint of the score canvas. */
	_repaintScore() {
		const scoreElm = this._container
		if (typeof window.quickDraw === 'function') {
			window.quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
		}
	}

	// ── Drawing (called from quickDraw after score is painted) ─────────────

	/**
	 * Draw highlights and cursor onto the score canvas context.
	 * This is called from quickDraw() after drawing.draw(ctx), while the
	 * score-space transform (scroll + zoom) is still active.
	 *
	 * @param {CanvasRenderingContext2D} ctx - The score canvas context
	 */
	drawHighlights(ctx) {
		if (!this._running && !this._paused) return

		// Draw position cursor
		this._drawCursor(ctx)

		// Draw active note highlights
		this._drawNoteHighlights(ctx)
	}

	// ── Cursor drawing ─────────────────────────────────────────────────────

	/**
	 * Draw a vertical position cursor at the interpolated X for the current time.
	 */
	_drawCursor(ctx) {
		const pos = this._getCursorPosition(this._currentTime)
		if (!pos) return

		const fs = getFontSize()

		// Draw a vertical line spanning the system height around the cursor Y
		const topY = pos.y - fs * 1.5
		const botY = pos.y + fs * 2

		ctx.save()
		ctx.strokeStyle = CURSOR_COLOR
		ctx.lineWidth = CURSOR_WIDTH
		ctx.beginPath()
		ctx.moveTo(pos.x, topY)
		ctx.lineTo(pos.x, botY)
		ctx.stroke()
		ctx.restore()
	}

	/**
	 * Binary-search the time index to find the cursor X/Y for a given time.
	 * Interpolates linearly between adjacent index entries.
	 */
	_getCursorPosition(time) {
		const idx = this._timeIndex
		if (idx.length === 0) return null

		// Before first note
		if (time <= idx[0].time) {
			return { x: idx[0].x, y: idx[0].y }
		}
		// After last note
		if (time >= idx[idx.length - 1].time) {
			return { x: idx[idx.length - 1].x, y: idx[idx.length - 1].y }
		}

		// Binary search for the interval containing `time`
		let lo = 0, hi = idx.length - 1
		while (lo < hi - 1) {
			const mid = (lo + hi) >> 1
			if (idx[mid].time <= time) lo = mid
			else hi = mid
		}

		const a = idx[lo]
		const b = idx[hi]
		const dt = b.time - a.time
		if (dt <= 0) return { x: a.x, y: a.y }

		const t = (time - a.time) / dt

		// Only interpolate X within the same system (same Y range).
		// If Y jumps (different system), snap to the closer entry.
		const yDiff = Math.abs(b.y - a.y)
		const fs = getFontSize()
		if (yDiff > fs * 3) {
			// Cross-system boundary — snap to whichever is closer in time
			return t < 0.5 ? { x: a.x, y: a.y } : { x: b.x, y: b.y }
		}

		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t,
		}
	}

	// ── Note highlight drawing ─────────────────────────────────────────────

	_drawNoteHighlights(ctx) {
		if (this._activeTokens.size === 0) return

		ctx.save()

		for (const token of this._activeTokens) {
			if (token.type === 'Chord' && token.notes) {
				// Highlight all noteheads in the chord
				for (const note of token.notes) {
					if (note.drawingNoteHead) {
						this._drawSingleHighlight(ctx, note.drawingNoteHead)
					}
				}
				// Also highlight the main chord notehead if it exists
				if (token.drawingNoteHead) {
					this._drawSingleHighlight(ctx, token.drawingNoteHead)
				}
			} else if (token.drawingNoteHead) {
				this._drawSingleHighlight(ctx, token.drawingNoteHead)
			}
		}

		ctx.restore()
	}

	/**
	 * Draw a single notehead highlight at the glyph's position.
	 * Uses a translucent overlay rectangle (like a highlighter pen) so the
	 * original black notehead shows through.
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {object} glyph - A Glyph drawing object with x, y, offsetX, offsetY, path, width
	 */
	_drawSingleHighlight(ctx, glyph) {
		if (!glyph || glyph.x == null || glyph.y == null) return

		const x = glyph.x + (glyph.offsetX || 0)
		const y = glyph.y + (glyph.offsetY || 0)
		const w = glyph.width || getFontSize() * 0.3
		const fs = getFontSize()

		ctx.save()
		ctx.translate(x, y)

		if (this._style === 'glow') {
			// Glow / halo effect: draw a blurred circle behind the notehead
			const r = w * GLOW_RADIUS_FACTOR
			ctx.save()
			ctx.filter = `blur(${r * 0.4}px)`
			ctx.beginPath()
			ctx.arc(w / 2, 0, r, 0, Math.PI * 2)
			ctx.fillStyle = GLOW_COLOR
			ctx.fill()
			ctx.restore()
		}

		// Translucent overlay rectangle — like a highlighter pen.
		// Slightly larger than the notehead so the highlight is clearly visible.
		const pad = w * 0.3
		const rectH = fs * 0.35   // tall enough to cover the notehead
		ctx.fillStyle = HIGHLIGHT_COLOR
		ctx.beginPath()
		const rx = -pad
		const ry = -rectH / 2
		const rw = w + pad * 2
		const rh = rectH
		const radius = Math.min(rh / 2, 4)
		// Rounded rectangle
		ctx.moveTo(rx + radius, ry)
		ctx.lineTo(rx + rw - radius, ry)
		ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius)
		ctx.lineTo(rx + rw, ry + rh - radius)
		ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh)
		ctx.lineTo(rx + radius, ry + rh)
		ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius)
		ctx.lineTo(rx, ry + radius)
		ctx.quadraticCurveTo(rx, ry, rx + radius, ry)
		ctx.closePath()
		ctx.fill()

		ctx.restore()
	}

	// ── Auto-scroll ────────────────────────────────────────────────────────

	_autoScroll() {
		const pos = this._getCursorPosition(this._currentTime)
		if (!pos) return

		const scoreElm = this._container
		const zoom = getZoomLevel()

		if (getLayoutMode() === 'wrap') {
			// In wrap mode, scroll vertically to keep the active system visible.
			const screenY = pos.y * zoom
			const viewTop = scoreElm.scrollTop
			const viewHeight = scoreElm.clientHeight
			const margin = viewHeight * 0.25

			if (screenY < viewTop + margin || screenY > viewTop + viewHeight - margin) {
				scoreElm.scrollTo({
					top: screenY - viewHeight * 0.35,
					behavior: 'smooth',
				})
			}
		} else {
			// In scroll mode, scroll horizontally to keep the cursor visible.
			const screenX = pos.x * zoom
			const viewLeft = scoreElm.scrollLeft
			const viewWidth = scoreElm.clientWidth
			const leftBound = viewWidth * 0.2
			const rightBound = viewWidth * 0.7

			const relX = screenX - viewLeft
			if (relX < leftBound || relX > rightBound) {
				scoreElm.scrollTo({
					left: screenX - viewWidth * 0.35,
					behavior: 'smooth',
				})
			}
		}
	}

	// ── Disposal ───────────────────────────────────────────────────────────

	dispose() {
		this.stop()
		this._timeIndex = []
		this._activeTokens.clear()
	}
}
