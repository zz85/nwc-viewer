/**
 * view3d.js — the 3D notation view. The score, engraved in scroll layout by
 * the normal typesetter, is replayed into vector records (vector-recorder.js)
 * and extruded into a three.js scene (stage.js); during playback a light per
 * voice hops from notehead to notehead.
 *
 * main.js imports this lazily the first time the view is opened, so the 2D
 * viewer never loads three.js. Audio stays with main.js's PlaybackController:
 * this view only follows its clock.
 */
import { patchOpentype, recordElements, buildScoreMeshes } from './vector-recorder.js'
import { NotationStage } from './stage.js'
import { buildOnsets } from './onsets.js'
import { buildNoteEvents } from '../audio.js'
import { getFontSize, getMusicTextFamily, getShowHiddenItems } from '../constants.js'

/** Stage options the view exposes, with their defaults (see NotationStage.opts). */
export const VIEW3D_DEFAULTS = {
	view: 'cinema', theme: 'cinema', zoom: 1, bounce: 1,
	bloom: true, dof: true, trail: true, shadows: true, fx: false,
	litMode: 'fade', restMode: 'glide', headFinish: 'satin', paperFinish: 'matte',
}

export class View3D {
	/**
	 * @param {HTMLElement} container - element the WebGL canvas fills
	 * @param {object} [opts]
	 * @param {object} [opts.options] - initial stage options (VIEW3D_DEFAULTS keys)
	 * @param {() => number} [opts.getSpeed] - playback speed, for clock extrapolation
	 * @param {(view: string) => void} [opts.onViewChange] - camera view changed by a canvas click
	 */
	constructor(container, { options = {}, getSpeed = () => 1, onViewChange } = {}) {
		patchOpentype(window.opentype)
		this.container = container
		this.stage = new NotationStage(container)
		this.stage.onViewChange = view => onViewChange?.(view)
		this._getSpeed = getSpeed
		this._measureCtx = document.createElement('canvas').getContext('2d')
		this.clock = { time: 0, audioTime: 0, audioAt: 0, playing: false }
		this._visible = false
		this._raf = 0
		this._lastFrame = 0
		this._frame = this._frame.bind(this)
		for (const [key, value] of Object.entries({ ...VIEW3D_DEFAULTS, ...options })) this.setOption(key, value)
	}

	setOption(key, value) {
		if (key === 'view') this.stage.setView(value)
		else if (key === 'theme') this.stage.setTheme(value)
		else this.stage.setOption(key, value)
	}

	/**
	 * Rebuild the scene from the current layout (window.drawing, which must be
	 * a scroll layout) and the score's note events.
	 * @param {object} data - score data, already interpreted and laid out
	 * @param {(staffIndex: number) => boolean} [isAudible] - staves that light up
	 */
	rebuild(data, isAudible) {
		const t0 = performance.now()
		const showHidden = getShowHiddenItems()
		const elements = [...window.drawing.set].filter(el => !el.isTitleBlock && (!el.hidden || showHidden))
		const fontSize = getFontSize()
		const records = recordElements(elements, this._measureCtx, { font: `${fontSize}px ${getMusicTextFamily()}` })
		const built = buildScoreMeshes(records, { fontSize, materials: this.stage.materials })
		const t1 = performance.now()

		// Repeat-unrolled playback times, the same ones the scheduler plays
		const { notes } = buildNoteEvents(data)
		const hits = []
		for (const n of notes) {
			if (!isAudible || isAudible(n.staffIndex)) hits.push({ time: n.time, staff: n.staffIndex, token: n.token })
		}
		const perStaff = buildOnsets(hits, built.heads, data.score.staves.length)
		this.stage.setScore(built, perStaff)
		this.stage.setTitle(data.info?.title || '')

		const onsets = perStaff.reduce((sum, list) => sum + list.length, 0)
		console.log(`[3d] record + mesh ${(t1 - t0).toFixed(0)}ms, total ${(performance.now() - t0).toFixed(0)}ms, ${elements.length} elements, ${built.heads.size} noteheads, ${onsets} onsets`)
		window.__render3DComplete = { ts: Date.now(), elements: elements.length, heads: built.heads.size, onsets }
	}

	// ── Clock (driven by PlaybackController callbacks) ──

	/** Scheduler time report (about every 46 ms while playing). */
	onTime(t) {
		this.clock.audioTime = t
		this.clock.audioAt = performance.now()
	}

	setPlaying(playing, t) {
		this.clock.playing = playing
		if (t != null) this.seek(t)
	}

	seek(t) {
		this.clock.time = this.clock.audioTime = Math.max(0, t || 0)
		this.clock.audioAt = performance.now()
	}

	// ── Visibility / render loop ──

	show() {
		if (this._visible) return
		this._visible = true
		this.stage.resize()
		this._lastFrame = performance.now()
		this._raf = requestAnimationFrame(this._frame)
	}

	hide() {
		this._visible = false
		cancelAnimationFrame(this._raf)
	}

	_frame(now) {
		if (!this._visible) return
		this._raf = requestAnimationFrame(this._frame)
		const dt = (now - this._lastFrame) / 1000
		this._lastFrame = now
		const c = this.clock
		if (c.playing) {
			// Extrapolate between scheduler time reports; never more than 150 ms ahead
			const est = c.audioTime + Math.min(0.15, (now - c.audioAt) / 1000 * this._getSpeed())
			c.time = Math.abs(est - c.time) > 0.25 ? est : Math.max(c.time, est)
		}
		this.stage.update(c.time, dt, c.playing)
	}
}
