/**
 * audio.js — Bridge between NWC interpreter output and soundfont-engine.
 *
 * Converts interpreted score tokens (name, octave, accidentalValue, tickValue,
 * durValue, tie) into the NoteEvent[] format expected by MidiScheduler, then
 * provides a PlaybackController with play/pause/stop/seek/progress.
 */

import { SoundFontEngine, MidiScheduler } from '../vendor/soundfont-engine/src/index.js'
import { interpret } from './interpreter.js'

// ── Pitch helpers ──────────────────────────────────────────────────────────

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACC_DELTA = { '#': 1, b: -1, n: 0, x: 2, v: -2 }

/**
 * Convert (name, octave, accidentalValue) → MIDI note number.
 * The interpreter's octave convention: C4 = middle C → MIDI 60.
 */
function toMidi(name, octave, accidentalValue) {
	const semi = SEMITONE[name] ?? 0
	const delta = ACC_DELTA[accidentalValue] ?? 0
	return 12 * (octave + 1) + semi + delta
}

// ── Score → NoteEvent[] conversion ─────────────────────────────────────────

/**
 * Walk all staves and build a flat, time-sorted NoteEvent array suitable for
 * MidiScheduler.load().
 *
 * @param {object} data - The interpreted score data (data.score.staves[].tokens)
 * @returns {{ notes: NoteEvent[], duration: number }}
 */
export function buildNoteEvents(data) {
	const staves = data.score.staves
	const notes = []

	// Resolve tempo: default 120 BPM quarter note. Walk stave 0 for the first
	// Tempo token; if there are mid-score tempo changes we'll track them.
	const tempoMap = buildTempoMap(staves)

	for (let si = 0; si < staves.length; si++) {
		const tokens = staves[si].tokens
		const channel = Math.min(si, 15) // cap at 16 MIDI channels

		for (let ti = 0; ti < tokens.length; ti++) {
			const tok = tokens[ti]
			if (tok.type !== 'Note' && tok.type !== 'Chord') continue

			// Skip notes that are just the tail of a tie — they don't start a new
			// sound. The tie-start note's duration will be extended below.
			if (tok.tieEnd) continue

			const tickStart = tok.tickValue
			const durValue = tok.durValue
			if (durValue == null) continue

			// Accumulate duration through tied notes
			let totalDur = typeof durValue === 'number' ? durValue : durValue.value()
			let next = findNextTied(tokens, ti)
			while (next !== -1) {
				const nt = tokens[next]
				if (nt.durValue) {
					totalDur += typeof nt.durValue === 'number' ? nt.durValue : nt.durValue.value()
				}
				next = findNextTied(tokens, next)
			}

			const startSec = ticksToSeconds(tickStart, tempoMap)
			const endSec = ticksToSeconds(tickStart + totalDur, tempoMap)
			const durationSec = endSec - startSec

			if (tok.type === 'Note') {
				if (tok.name == null) continue
				const midi = toMidi(tok.name, tok.octave, tok.accidentalValue)
				notes.push({
					midi,
					time: startSec,
					duration: durationSec,
					velocity: 0.7,
					channel,
				})
			} else if (tok.type === 'Chord' && tok.notes) {
				// Main chord voice
				if (tok.name != null) {
					const midi = toMidi(tok.name, tok.octave, tok.accidentalValue)
					notes.push({
						midi,
						time: startSec,
						duration: durationSec,
						velocity: 0.7,
						channel,
					})
				}
				// Additional chord notes
				for (const n of tok.notes) {
					if (n.name == null) continue
					if (n.tieEnd) continue
					const midi = toMidi(n.name, n.octave, n.accidentalValue)
					notes.push({
						midi,
						time: startSec,
						duration: durationSec,
						velocity: 0.7,
						channel,
					})
				}
			}
		}
	}

	// Sort by time (required by scheduler)
	notes.sort((a, b) => a.time - b.time || a.midi - b.midi)

	const duration = notes.reduce((mx, n) => Math.max(mx, n.time + n.duration), 0)
	return { notes, duration }
}

// ── Tie merging helper ─────────────────────────────────────────────────────

/**
 * Given a token index that has tie=1 (tie start), find the next token in the
 * same stave that is the tie continuation/end.
 */
function findNextTied(tokens, idx) {
	const tok = tokens[idx]
	if (!tok.tie) return -1
	// Walk forward looking for the next Note/Chord with tieEnd
	for (let j = idx + 1; j < tokens.length; j++) {
		const t = tokens[j]
		if (t.type === 'Note' || t.type === 'Chord') {
			if (t.tieEnd) return j
			return -1 // next note but not a tie end — broken tie
		}
	}
	return -1
}

// ── Tempo map ──────────────────────────────────────────────────────────────

/**
 * Build a tempo map: array of { tick, bpm } sorted by tick.
 * Tick values are in whole-note units (matching tickValue from interpreter).
 */
function buildTempoMap(staves) {
	const entries = []

	// Scan all staves for Tempo tokens (they usually appear on stave 0)
	for (const stave of staves) {
		for (const tok of stave.tokens) {
			if (tok.type === 'Tempo') {
				// tok.duration = BPM value, tok.note = beat unit
				// NWC stores tempo as quarter-note BPM regardless of tok.note
				const bpm = tok.duration || 120
				const tick = tok.tickValue ?? 0
				entries.push({ tick, bpm })
			}
		}
	}

	// Deduplicate by tick, keep last-seen BPM at each tick
	const map = new Map()
	for (const e of entries) {
		map.set(e.tick, e.bpm)
	}

	const result = Array.from(map.entries())
		.map(([tick, bpm]) => ({ tick, bpm }))
		.sort((a, b) => a.tick - b.tick)

	// Ensure there's always a default at tick 0
	if (result.length === 0 || result[0].tick > 0) {
		result.unshift({ tick: 0, bpm: 120 })
	}

	return result
}

/**
 * Convert a tick value (whole-note units) to seconds using the tempo map.
 * A quarter note = 0.25 in whole-note units, so:
 *   seconds_per_whole_note = (4 / bpm) * 60 = 240 / bpm
 */
function ticksToSeconds(tick, tempoMap) {
	let seconds = 0
	let prevTick = 0
	let bpm = tempoMap[0].bpm

	for (let i = 1; i < tempoMap.length; i++) {
		if (tempoMap[i].tick >= tick) break
		// Accumulate time in the previous tempo region
		const dt = tempoMap[i].tick - prevTick
		seconds += dt * (240 / bpm)
		prevTick = tempoMap[i].tick
		bpm = tempoMap[i].bpm
	}

	// Remaining ticks at current tempo
	seconds += (tick - prevTick) * (240 / bpm)
	return seconds
}

// ── PlaybackController ─────────────────────────────────────────────────────

const SOUNDFONT_PATH = 'soundfonts/Creative(emu10k1)8MBGMSFX.sf2'

/**
 * Manages a SoundFontEngine + MidiScheduler lifecycle and exposes a simple
 * transport API for the UI.
 *
 * Uses OxiSynth with a GM soundfont for full instrument support, falling back
 * to the built-in wavetable piano if loading fails.
 */
export class PlaybackController {
	constructor() {
		this._engine = null
		this._scheduler = null
		this._initialized = false
		this._soundfontLoaded = false
		this._onTime = null
		this._onEnd = null
		this._onStateChange = null
	}

	/** Register a callback for time updates: fn(currentTime, duration) */
	onTime(fn) { this._onTime = fn }

	/** Register a callback for playback end */
	onEnd(fn) { this._onEnd = fn }

	/** Register a callback for play/pause state changes: fn(playing) */
	onStateChange(fn) { this._onStateChange = fn }

	get playing() { return this._scheduler?.playing ?? false }
	get currentTime() { return this._scheduler?.currentTime ?? 0 }
	get duration() { return this._scheduler?.duration ?? 0 }

	async _ensureInit() {
		if (this._initialized) return

		const vendorPath = new URL(
			'../vendor/soundfont-engine/vendor',
			import.meta.url
		).href

		// Start with oxisynth for full GM instrument support
		this._engine = new SoundFontEngine({
			backend: 'oxisynth',
			vendorPath,
		})

		this._scheduler = new MidiScheduler(this._engine, {
			workletPath: new URL(
				'../vendor/soundfont-engine/src/scheduler-worklet.js',
				import.meta.url
			).href,
		})

		await this._scheduler.init()

		this._scheduler.on('time', (t) => {
			this._onTime?.(t, this._scheduler.duration)
		})

		this._scheduler.on('end', () => {
			this._onStateChange?.(false)
			this._onEnd?.()
		})

		this._initialized = true

		// Load the soundfont in the background — don't block init
		this._loadSoundfont()
	}

	async _loadSoundfont() {
		if (this._soundfontLoaded) return
		try {
			console.log('[audio] Loading soundfont:', SOUNDFONT_PATH)
			await this._engine.loadSoundFont(SOUNDFONT_PATH)
			this._soundfontLoaded = true
			console.log('[audio] Soundfont loaded successfully')
		} catch (err) {
			console.warn('[audio] Failed to load soundfont, falling back to wavetable:', err)
			this._engine.setBackend('wavetable')
		}
	}

	/**
	 * Load score data and prepare for playback.
	 * @param {object} data - Score data (will be interpreted if not already)
	 */
	async load(data) {
		await this._ensureInit()
		// Wait for soundfont if it hasn't loaded yet
		if (!this._soundfontLoaded) {
			await this._loadSoundfont()
		}
		// Ensure tokens have been interpreted (name, octave, tickValue, etc.)
		interpret(data)
		const { notes } = buildNoteEvents(data)
		this._scheduler.load({ notes })
	}

	async play() {
		await this._ensureInit()
		await this._engine.resume()
		this._scheduler.play()
		this._onStateChange?.(true)
	}

	pause() {
		this._scheduler?.pause()
		this._onStateChange?.(false)
	}

	stop() {
		this._scheduler?.stop()
		this._onStateChange?.(false)
	}

	seek(time) {
		this._scheduler?.seek(time)
	}

	dispose() {
		this._scheduler?.dispose()
		this._engine?.dispose()
		this._scheduler = null
		this._engine = null
		this._initialized = false
		this._soundfontLoaded = false
	}
}
