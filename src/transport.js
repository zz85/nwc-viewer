/**
 * transport.js — the playback bar along the bottom of the score, laid out
 * like a video player's: play/pause, back to start, time and position, a
 * scrub bar split into the score's sections, volume, speed and fullscreen.
 * While the music plays and the pointer rests, it fades away.
 *
 * It draws and reports; main.js owns playback (PlaybackController) and
 * persistence.
 */
import { positionAt } from './transport-timeline.js'

const IDLE_MS = 2500
const GAP_PX = 3  // between scrub bar sections

export function formatTime(sec) {
	if (!isFinite(sec) || sec < 0) sec = 0
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return m + ':' + String(s).padStart(2, '0')
}

// Beat unit (whole notes) → note symbol for the tempo readout
const BEAT_SYMBOLS = { 0.125: '♪', 0.1875: '♪.', 0.25: '♩', 0.375: '♩.', 0.5: '𝅗𝅥', 0.75: '𝅗𝅥.', 1: '𝅝' }

export class Transport {
	/**
	 * @param {HTMLElement} root - #transport
	 * @param {object} handlers
	 * @param {() => void} handlers.onToggle - play / pause
	 * @param {() => void} handlers.onRestart - back to the start
	 * @param {(t: number) => void} handlers.onSeek - scrubbed to t seconds
	 * @param {(volume: number, muted: boolean) => void} handlers.onVolume
	 * @param {(speed: number) => void} handlers.onSpeed
	 */
	constructor(root, { onToggle, onRestart, onSeek, onVolume, onSpeed }) {
		this.root = root
		this._h = { onToggle, onRestart, onSeek, onVolume, onSpeed }
		const $ = id => root.querySelector('#' + id)
		this.el = {
			play: $('play'), restart: $('restart'), time: $('playback_time'), where: $('playback_where'),
			scrub: $('scrub'), track: $('scrub_track'), knob: $('scrub_knob'), tip: $('scrub_tip'),
			mute: $('mute'), volume: $('volume'), speedChip: $('speed_chip'), speedPop: $('speed_pop'),
			speedSlider: $('speed_slider'), speedInput: $('speed_input'), tempo: $('speed_tempo'), full: $('fullscreen'),
		}
		this.timeline = { bars: [], sections: [], barCount: 0, duration: 0, tempo: { bpm: 120, beat: 0.25, written: false } }
		this.time = 0
		this.playing = false
		this.volume = 0.8
		this.muted = false
		this.speed = 1
		this._scrubbing = false
		this._lastActivity = performance.now()

		this.el.play.onclick = () => this._h.onToggle()
		this.el.restart.onclick = () => this._h.onRestart()
		this._bindScrub()
		this._bindVolume()
		this._bindSpeed()
		this._bindFullscreen()
		this._bindIdle()
		this._renderSections()
		this.setTime(0)
	}

	// ── State from the app ──

	/** Bars, sections and tempo of the current score (transport-timeline.js). */
	setTimeline(timeline) {
		this.timeline = timeline
		this._renderSections()
		this._renderTempo()
		this.setTime(Math.min(this.time, timeline.duration))
	}

	get duration() { return this.timeline.duration }

	setTime(t) {
		this.time = Math.max(0, t || 0)
		const dur = this.duration
		if (!this._scrubbing) this._renderPosition(this.time)
		this.el.time.textContent = formatTime(this._scrubbing ? this._scrubTime : this.time) + ' / ' + formatTime(dur)
	}

	setPlaying(playing) {
		this.playing = playing
		this.el.play.classList.toggle('playing', playing)
		const label = playing ? 'Pause (Space)' : 'Play (Space)'
		this.el.play.setAttribute('aria-label', label)
		this.el.play.title = label
		this.el.play.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play')
		this.wake()
	}

	setVolume(volume, muted) {
		this.volume = Math.max(0, Math.min(1, volume))
		this.muted = !!muted
		this.el.volume.value = this.muted ? 0 : this.volume
		const icon = this.muted || this.volume === 0 ? '#i-mute' : this.volume < 0.5 ? '#i-vol-low' : '#i-vol'
		this.el.mute.querySelector('use').setAttribute('href', icon)
		const label = this.muted ? 'Unmute (M)' : 'Mute (M)'
		this.el.mute.setAttribute('aria-label', label)
		this.el.mute.title = label
	}

	setSpeed(speed) {
		this.speed = speed
		const text = (Math.round(speed * 100) / 100) + '×'
		this.el.speedChip.textContent = text
		this.el.speedChip.classList.toggle('changed', Math.abs(speed - 1) > 1e-6)
		this.el.speedSlider.value = Math.min(speed, +this.el.speedSlider.max)
		this.el.speedInput.value = Math.round(speed * 100) / 100
		for (const b of this.el.speedPop.querySelectorAll('[data-speed]')) b.classList.toggle('active', Math.abs(+b.dataset.speed - speed) < 1e-6)
		this._renderTempo()
	}

	toggleMute() {
		this._h.onVolume(this.volume || 0.8, !this.muted)
	}

	toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen?.()
		else document.documentElement.requestFullscreen?.()
	}

	/** Show the bar again (pointer moved, key pressed, state changed). */
	wake() {
		this._lastActivity = performance.now()
		this.root.classList.remove('idle')
	}

	// ── Scrub bar ──

	_renderSections() {
		const { sections, duration } = this.timeline
		const list = sections.length ? sections : [{ time: 0, end: duration || 1, label: '' }]
		this.el.track.replaceChildren(...list.map(s => {
			const seg = document.createElement('div')
			seg.className = 't-section'
			seg.style.flexGrow = String(Math.max(1e-3, s.end - s.time))
			const fill = document.createElement('div')
			fill.className = 't-fill'
			seg.appendChild(fill)
			return seg
		}))
		this._sections = list
		this.el.scrub.setAttribute('aria-valuemax', String(Math.round(duration)))
	}

	_renderPosition(t) {
		const segs = this.el.track.children
		this._sections.forEach((s, i) => {
			const f = s.end > s.time ? Math.max(0, Math.min(1, (t - s.time) / (s.end - s.time))) : 0
			segs[i].firstChild.style.width = f * 100 + '%'
		})
		this.el.knob.style.left = this._xAt(t) + 'px'
		const pos = positionAt(this.timeline, t)
		const where = this.timeline.bars.length
			? `Bar ${pos.bar} of ${this.timeline.barCount}` + (pos.section?.label ? ' · ' + pos.section.label : '')
			: ''
		this.el.where.textContent = where
		this.el.scrub.setAttribute('aria-valuenow', String(Math.round(t)))
		this.el.scrub.setAttribute('aria-valuetext', formatTime(t) + (where ? ', ' + where : ''))
	}

	/** x (px, relative to the scrub bar) of time t, skipping the gaps between sections. */
	_xAt(t) {
		const segs = this.el.track.children
		const base = this.el.scrub.getBoundingClientRect().left
		for (let i = 0; i < this._sections.length; i++) {
			const s = this._sections[i], r = segs[i].getBoundingClientRect()
			if (t <= s.end || i === this._sections.length - 1) {
				const f = s.end > s.time ? Math.max(0, Math.min(1, (t - s.time) / (s.end - s.time))) : 0
				return r.left - base + f * r.width
			}
		}
		return 0
	}

	/** Time at a client x on the scrub bar. */
	_timeAt(clientX) {
		const segs = this.el.track.children
		for (let i = 0; i < this._sections.length; i++) {
			const s = this._sections[i], r = segs[i].getBoundingClientRect()
			if (clientX <= r.right + GAP_PX / 2 || i === this._sections.length - 1) {
				const f = r.width > 0 ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0
				return s.time + f * (s.end - s.time)
			}
		}
		return 0
	}

	_bindScrub() {
		const scrub = this.el.scrub, tip = this.el.tip
		const showTip = (clientX, t) => {
			const pos = positionAt(this.timeline, t)
			const parts = [pos.section?.label, this.timeline.bars.length ? 'Bar ' + pos.bar : '', formatTime(t)].filter(Boolean)
			tip.textContent = parts.join(' · ')
			tip.hidden = false
			const r = scrub.getBoundingClientRect()
			const half = tip.offsetWidth / 2
			tip.style.left = Math.max(half, Math.min(r.width - half, clientX - r.left)) + 'px'
		}
		scrub.addEventListener('pointermove', e => {
			if (!this.duration) return
			const t = this._timeAt(e.clientX)
			showTip(e.clientX, t)
			if (this._scrubbing) {
				this._scrubTime = t
				this._renderPosition(t)
				this.el.time.textContent = formatTime(t) + ' / ' + formatTime(this.duration)
			}
		})
		scrub.addEventListener('pointerleave', () => { if (!this._scrubbing) tip.hidden = true })
		scrub.addEventListener('pointerdown', e => {
			if (!this.duration || e.button !== 0) return
			scrub.setPointerCapture(e.pointerId)
			this._scrubbing = true
			scrub.classList.add('scrubbing')
			this._scrubTime = this._timeAt(e.clientX)
			this._renderPosition(this._scrubTime)
			showTip(e.clientX, this._scrubTime)
		})
		const end = e => {
			if (!this._scrubbing) return
			this._scrubbing = false
			scrub.classList.remove('scrubbing')
			if (e.type === 'pointerup') tip.hidden = !scrub.matches(':hover')
			this.time = this._scrubTime
			this._h.onSeek(this._scrubTime)
		}
		scrub.addEventListener('pointerup', end)
		scrub.addEventListener('pointercancel', end)
		// Keyboard on the focused bar: Home / End (arrows are bar steps, app-wide)
		scrub.addEventListener('keydown', e => {
			if (e.key === 'Home') { this._h.onSeek(0); e.preventDefault() }
			else if (e.key === 'End') { this._h.onSeek(Math.max(0, this.duration - 0.05)); e.preventDefault() }
		})
		new ResizeObserver(() => this._renderPosition(this.time)).observe(scrub)
	}

	// ── Volume: icon toggles mute; the slider opens on hover or focus ──

	_bindVolume() {
		this.el.mute.onclick = () => this.toggleMute()
		this.el.volume.addEventListener('input', () => {
			const v = +this.el.volume.value
			this._h.onVolume(v > 0 ? v : this.volume, v === 0)
		})
	}

	// ── Speed: chip + popover with presets, slider and an exact value ──

	/** A button that opens a popover above the bar; one popover at a time. */
	_bindPop(button, pop) {
		this._pops ||= []
		const open = show => {
			if (show) this.closePops()
			pop.hidden = !show
			button.setAttribute('aria-expanded', String(show))
			button.classList.toggle('open', show)
			if (show) this.wake()
		}
		this._pops.push(() => open(false))
		button.onclick = e => { e.stopPropagation(); open(pop.hidden) }
		pop.addEventListener('click', e => e.stopPropagation())
		document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) open(false) })
	}

	closePops() {
		for (const close of this._pops || []) close()
	}

	get popOpen() {
		return [...this.root.querySelectorAll('.t-pop')].some(p => !p.hidden)
	}

	_bindSpeed() {
		const pop = this.el.speedPop
		this._bindPop(this.el.speedChip, pop)
		const settings = this.root.querySelector('#playback_settings'), settingsPop = this.root.querySelector('#playback_pop')
		if (settings && settingsPop) this._bindPop(settings, settingsPop)
		pop.addEventListener('click', e => {
			const b = e.target.closest('[data-speed]')
			if (b) this._h.onSpeed(+b.dataset.speed)
		})
		this.el.speedSlider.addEventListener('input', () => this._h.onSpeed(+this.el.speedSlider.value))
		this.el.speedInput.addEventListener('change', () => {
			const n = parseFloat(this.el.speedInput.value)
			if (isFinite(n) && n > 0) this._h.onSpeed(n)
			else this.setSpeed(this.speed)
		})
	}

	_renderTempo() {
		const { bpm, beat, written } = this.timeline.tempo
		const sym = BEAT_SYMBOLS[beat] || '♩'
		const now = Math.round(bpm * this.speed)
		if (!written) this.el.tempo.textContent = Math.abs(this.speed - 1) < 1e-6 ? '' : `${Math.round(this.speed * 100)}% of the written speed`
		else if (Math.abs(this.speed - 1) < 1e-6) this.el.tempo.textContent = `${sym} = ${bpm}`
		else this.el.tempo.textContent = `${sym} = ${now}  (written ${bpm})`
	}

	// ── Fullscreen ──

	_bindFullscreen() {
		if (!document.documentElement.requestFullscreen) { this.el.full.hidden = true; return }
		this.el.full.onclick = () => this.toggleFullscreen()
		document.addEventListener('fullscreenchange', () => {
			const on = !!document.fullscreenElement
			this.el.full.querySelector('use').setAttribute('href', on ? '#i-exit-full' : '#i-full')
			const label = on ? 'Exit full screen (F)' : 'Full screen (F)'
			this.el.full.setAttribute('aria-label', label)
			this.el.full.title = label
		})
	}

	// ── Fade while playing and the pointer rests ──

	_bindIdle() {
		const wake = () => this.wake()
		document.addEventListener('pointermove', wake, { passive: true })
		document.addEventListener('pointerdown', wake, { passive: true })
		document.addEventListener('keydown', wake)
		setInterval(() => {
			if (!this.playing || this.root.classList.contains('idle')) return
			if (performance.now() - this._lastActivity < IDLE_MS) return
			if (this.root.matches(':hover') || this.popOpen || this._scrubbing || this.root.querySelector(':focus-visible')) return
			this.root.classList.add('idle')
		}, 250)
	}
}
