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

// Black key X offset within an octave (relative to octave left edge, in white-key-width units).
// An octave has 7 white keys. Black keys sit between white keys but aren't evenly centered —
// real pianos offset them slightly toward the left of each gap.
//   C#: between C and D  → ~0.55
//   D#: between D and E  → ~1.65
//   F#: between F and G  → ~3.55
//   G#: between G and A  → ~4.55
//   A#: between A and B  → ~5.6
const BLACK_KEY_OFFSETS = {
	1: 0.9,   // C#
	3: 2.0,   // D#
	6: 3.9,   // F#
	8: 4.9,   // G#
	10: 5.95, // A#
}

// Key dimensions
const WHITE_KEY_W = 14   // px
const WHITE_KEY_H = 70   // px
const BLACK_KEY_W = 9    // px
const BLACK_KEY_H = 44   // px (≈63% of white key height)

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
		// Wrapper — flex-shrink:0 so it doesn't collapse
		this._el = document.createElement('div')
		this._el.id = 'piano-keyboard'
		this._el.style.cssText = `
			display: flex;
			justify-content: center;
			height: ${WHITE_KEY_H + 4}px;
			background: #2a2a2a;
			border-top: 2px solid #444;
			user-select: none;
			overflow: hidden;
			flex-shrink: 0;
			padding: 2px 0;
		`

		// Inner container — sized to exactly fit all white keys; positioned relative
		// so black keys can be absolutely placed within it.
		const whiteCount = this._countWhiteKeys()
		const totalW = whiteCount * WHITE_KEY_W

		const inner = document.createElement('div')
		inner.style.cssText = `
			position: relative;
			width: ${totalW}px;
			height: ${WHITE_KEY_H}px;
			flex-shrink: 0;
		`

		// Pass 1: lay out white keys
		let wIdx = 0
		for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
			const pc = midi % 12
			if (IS_BLACK[pc]) continue

			const key = document.createElement('div')
			key.dataset.midi = midi
			key.title = midiToNoteName(midi)
			key.className = 'piano-key piano-key-white'
			key.style.cssText = `
				position: absolute;
				left: ${wIdx * WHITE_KEY_W}px;
				top: 0;
				width: ${WHITE_KEY_W - 1}px;
				height: ${WHITE_KEY_H}px;
				background: #f8f8f8;
				border: 1px solid #aaa;
				border-top: none;
				border-radius: 0 0 3px 3px;
				box-sizing: border-box;
				z-index: 1;
				transition: background 0.05s;
			`
			inner.appendChild(key)
			this._keys.set(midi, key)
			wIdx++
		}

		// Pass 2: overlay black keys using per-octave offsets
		for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
			const pc = midi % 12
			if (!IS_BLACK[pc]) continue

			// Find which octave this note is in and compute absolute X.
			// Strategy: count white keys to the left of this octave's C,
			// then use the BLACK_KEY_OFFSETS table.
			const octaveC = midi - pc          // MIDI of C in this octave

			let centerX
			if (octaveC >= MIDI_LOW) {
				const cWhiteIdx = this._whiteIndexOf(octaveC)
				centerX = (cWhiteIdx + BLACK_KEY_OFFSETS[pc]) * WHITE_KEY_W
			} else {
				// Partial first octave — C is below our range.
				// Count white keys from MIDI_LOW to figure out offset.
				// The offset is BLACK_KEY_OFFSETS[pc] minus the number of white keys
				// between octaveC and MIDI_LOW, all in white-key-width units.
				let whitesBelowRange = 0
				for (let m = octaveC; m < MIDI_LOW; m++) {
					if (!IS_BLACK[m % 12]) whitesBelowRange++
				}
				centerX = (BLACK_KEY_OFFSETS[pc] - whitesBelowRange) * WHITE_KEY_W
			}

			const leftPx = centerX - BLACK_KEY_W / 2

			const key = document.createElement('div')
			key.dataset.midi = midi
			key.title = midiToNoteName(midi)
			key.className = 'piano-key piano-key-black'
			key.style.cssText = `
				position: absolute;
				left: ${Math.round(leftPx)}px;
				top: 0;
				width: ${BLACK_KEY_W}px;
				height: ${BLACK_KEY_H}px;
				background: linear-gradient(to bottom, #2a2a2a, #111);
				border: 1px solid #000;
				border-top: none;
				border-radius: 0 0 3px 3px;
				box-sizing: border-box;
				box-shadow: 0 2px 3px rgba(0,0,0,0.5);
				z-index: 10;
				transition: background 0.05s;
			`
			inner.appendChild(key)
			this._keys.set(midi, key)
		}

		this._el.appendChild(inner)
		this._container.appendChild(this._el)
	}

	/** Count total white keys in range. */
	_countWhiteKeys() {
		let n = 0
		for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
			if (!IS_BLACK[midi % 12]) n++
		}
		return n
	}

	/**
	 * Return the white-key index (0-based from MIDI_LOW) for a given MIDI note.
	 * Returns -1 if the note is below MIDI_LOW or is a black key.
	 */
	_whiteIndexOf(midi) {
		if (midi < MIDI_LOW) return -1
		let idx = 0
		for (let m = MIDI_LOW; m < midi; m++) {
			if (!IS_BLACK[m % 12]) idx++
		}
		return idx
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
			el.style.background = IS_BLACK[pc] ? '#1a1a1a' : '#f8f8f8'
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
			el.style.background = isBlack ? '#1a1a1a' : '#f8f8f8'
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
