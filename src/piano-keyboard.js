/**
 * piano-keyboard.js — Visual piano keyboard that highlights keys during playback.
 *
 * Renders an 88-key (A0–C8) piano as a DOM element using HTML/CSS.
 * Keys light up on noteOn/noteOff events from the PlaybackController.
 */

// ── Constants ──────────────────────────────────────────────────────────────

// Piano range: A0 (MIDI 21) to C8 (MIDI 108) = 88 keys
const MIDI_LOW = 21
const MIDI_HIGH = 108

// Which pitch classes are black keys (0=C, 1=C#, ... 11=B)
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]

// Staff colors for highlighting (up to 16 staves)
const STAFF_COLORS = [
	'#4285f4', // blue
	'#ea4335', // red
	'#34a853', // green
	'#fbbc04', // yellow
	'#ff6d01', // orange
	'#46bdc6', // teal
	'#9334e6', // purple
	'#e91e63', // pink
	'#00bcd4', // cyan
	'#8bc34a', // light green
	'#ff5722', // deep orange
	'#607d8b', // blue grey
	'#795548', // brown
	'#9e9e9e', // grey
	'#cddc39', // lime
	'#3f51b5', // indigo
]

// ── PianoKeyboard class ────────────────────────────────────────────────────

export class PianoKeyboard {
	/**
	 * @param {HTMLElement} container - Parent element to append the keyboard to
	 */
	constructor(container) {
		this._container = container
		this._keys = new Map()        // midi → DOM element
		this._activeNotes = new Map() // midi → Set of {staffIndex} for multi-voice tracking
		this._visible = true

		this._build()
	}

	// ── DOM construction ──────────────────────────────────────────────────

	_build() {
		// Wrapper
		this._el = document.createElement('div')
		this._el.id = 'piano-keyboard'
		this._el.style.cssText = `
			display: flex;
			position: relative;
			height: 80px;
			background: #222;
			border-top: 1px solid #444;
			user-select: none;
			overflow-x: auto;
			overflow-y: hidden;
			flex-shrink: 0;
		`

		// Inner container for keys (allows horizontal scrolling)
		const inner = document.createElement('div')
		inner.style.cssText = `
			display: flex;
			position: relative;
			height: 100%;
			margin: 0 auto;
		`

		// Build white keys first, then overlay black keys
		const whiteKeys = []
		const blackKeys = []

		for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
			const pc = midi % 12
			const isBlack = IS_BLACK[pc]

			const key = document.createElement('div')
			key.dataset.midi = midi
			key.title = midiToNoteName(midi)

			if (isBlack) {
				key.className = 'piano-key piano-key-black'
				key.style.cssText = `
					width: 10px;
					height: 52px;
					background: #222;
					border: 1px solid #111;
					border-radius: 0 0 2px 2px;
					position: absolute;
					z-index: 2;
					transition: background 0.06s;
				`
				blackKeys.push({ midi, key })
			} else {
				key.className = 'piano-key piano-key-white'
				key.style.cssText = `
					width: 16px;
					height: 78px;
					background: #f8f8f8;
					border: 1px solid #bbb;
					border-radius: 0 0 3px 3px;
					position: relative;
					z-index: 1;
					flex-shrink: 0;
					transition: background 0.06s;
				`
				whiteKeys.push({ midi, key })
			}

			this._keys.set(midi, key)
		}

		// Append white keys to inner
		for (const { key } of whiteKeys) {
			inner.appendChild(key)
		}

		// Position black keys over the white keys.
		// Black key sits between two white keys — positioned at the right edge
		// of the preceding white key.
		let whiteIndex = 0
		const WHITE_WIDTH = 16
		for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
			const pc = midi % 12
			if (!IS_BLACK[pc]) {
				whiteIndex++
				continue
			}
			// Black key is positioned overlapping the boundary between two white keys
			const leftPx = whiteIndex * WHITE_WIDTH - 5
			const keyEl = this._keys.get(midi)
			keyEl.style.left = leftPx + 'px'
			inner.appendChild(keyEl)
		}

		this._el.appendChild(inner)
		this._container.appendChild(this._el)
	}

	// ── Note events ───────────────────────────────────────────────────────

	/**
	 * Highlight a key when a note starts.
	 * @param {object} noteEvent - NoteEvent with .midi and .staffIndex
	 */
	noteOn(noteEvent) {
		const { midi, staffIndex } = noteEvent
		if (midi < MIDI_LOW || midi > MIDI_HIGH) return

		if (!this._activeNotes.has(midi)) {
			this._activeNotes.set(midi, new Set())
		}
		this._activeNotes.get(midi).add(staffIndex ?? 0)

		this._updateKeyColor(midi)
	}

	/**
	 * Un-highlight a key when a note stops.
	 * @param {object} noteEvent - NoteEvent with .midi and .staffIndex
	 */
	noteOff(noteEvent) {
		const { midi, staffIndex } = noteEvent
		if (midi < MIDI_LOW || midi > MIDI_HIGH) return

		const active = this._activeNotes.get(midi)
		if (active) {
			active.delete(staffIndex ?? 0)
			if (active.size === 0) this._activeNotes.delete(midi)
		}

		this._updateKeyColor(midi)
	}

	/** Clear all active highlights. */
	clear() {
		this._activeNotes.clear()
		for (const [midi, el] of this._keys) {
			const pc = midi % 12
			el.style.background = IS_BLACK[pc] ? '#222' : '#f8f8f8'
		}
	}

	// ── Key coloring ──────────────────────────────────────────────────────

	_updateKeyColor(midi) {
		const el = this._keys.get(midi)
		if (!el) return

		const active = this._activeNotes.get(midi)
		const pc = midi % 12
		const isBlack = IS_BLACK[pc]

		if (!active || active.size === 0) {
			el.style.background = isBlack ? '#222' : '#f8f8f8'
			return
		}

		// Use the color of the first (lowest index) active staff
		const staffIdx = Math.min(...active)
		const color = STAFF_COLORS[staffIdx % STAFF_COLORS.length]
		el.style.background = color
	}

	// ── Visibility ────────────────────────────────────────────────────────

	show() {
		this._visible = true
		this._el.style.display = 'flex'
	}

	hide() {
		this._visible = false
		this._el.style.display = 'none'
	}

	toggle() {
		if (this._visible) this.hide()
		else this.show()
		return this._visible
	}

	get visible() { return this._visible }

	// ── Cleanup ───────────────────────────────────────────────────────────

	dispose() {
		this.clear()
		this._el.remove()
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToNoteName(midi) {
	const name = NOTE_NAMES[midi % 12]
	const octave = Math.floor(midi / 12) - 1
	return name + octave
}
