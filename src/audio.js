/**
 * audio.js — Bridge between NWC interpreter output and soundfont-engine.
 *
 * Converts interpreted score tokens (name, octave, accidentalValue, tickValue,
 * durValue, tie) into the NoteEvent[] format expected by MidiScheduler, then
 * provides a PlaybackController with play/pause/stop/seek/progress.
 */

import { SoundFontEngine, MidiScheduler } from '../vendor/soundfont-engine/src/index.js'
import { interpret } from './interpreter.js'
import { buildPlaybackSegments } from './playback-order.js'

// ── Pitch helpers ──────────────────────────────────────────────────────────

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACC_DELTA = { '#': 1, b: -1, n: 0, x: 2, v: -2 }

// ── Dynamic velocity mapping (NWC 2.75 spec defaults) ──────────────────────
// Values are MIDI velocities (0-127) normalized to 0.0-1.0 range.

export const DYNAMIC_VELOCITY = {
	ppp: 10 / 127,
	pp:  30 / 127,
	p:   45 / 127,
	mp:  60 / 127,
	mf:  75 / 127,
	f:   92 / 127,
	ff:  108 / 127,
	fff: 127 / 127,
}

const DEFAULT_VELOCITY = DYNAMIC_VELOCITY.mf

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
 * Assign a MIDI channel (0-15) for each staff.
 * Each staff gets its own channel to avoid noteOff collisions between staves.
 * Channel 9 is reserved for GM percussion — non-percussion staves skip it.
 * If a staff's NWC channel is 9, it gets channel 9 for correct drum sounds.
 *
 * @param {Array} staves - Score staves array
 * @returns {number[]} - MIDI channel per staff index
 */
function assignChannels(staves) {
	const channels = []
	let nextCh = 0
	for (let si = 0; si < staves.length; si++) {
		const nwcCh = staves[si].channel ?? 0
		if (nwcCh === 9) {
			// Percussion staff — always use GM drum channel 9
			channels.push(9)
		} else {
			// Skip channel 9 for melodic staves
			if (nextCh === 9) nextCh = 10
			channels.push(Math.min(nextCh, 15))
			if (nextCh < 15) nextCh++
		}
	}
	return channels
}

/**
 * Walk all staves and build a flat, time-sorted NoteEvent array suitable for
 * MidiScheduler.load().
 *
 * Uses buildPlaybackSegments() to follow repeat/volta/flow structure instead
 * of a simple linear scan. Each segment is a tick range of the score; repeated
 * sections produce multiple segments with overlapping tick ranges.
 *
 * @param {object} data - The interpreted score data (data.score.staves[].tokens)
 * @returns {{ notes: NoteEvent[], duration: number, channels: number[], segments: Array }}
 */
export function buildNoteEvents(data) {
	const staves = data.score.staves
	const notes = []

	// Resolve tempo: default 120 BPM quarter note. Walk stave 0 for the first
	// Tempo token; if there are mid-score tempo changes we'll track them.
	const tempoMap = buildTempoMap(staves)

	// Assign MIDI channels: each staff gets its own channel, skipping ch9
	// for non-percussion staves to avoid GM drum kit sounds.
	const channels = assignChannels(staves)

	// Build the playback order as tick-range segments
	const segments = buildPlaybackSegments(staves)

	// Accumulated playback time offset (seconds) from previous segments
	let playbackOffset = 0

	for (const seg of segments) {
		const segStartSec = ticksToSeconds(seg.startTick, tempoMap)
		const segEndSec = ticksToSeconds(seg.endTick, tempoMap)
		const segDuration = segEndSec - segStartSec

		for (let si = 0; si < staves.length; si++) {
			const tokens = staves[si].tokens
			const channel = channels[si]
			const transpose = staves[si].transposition || 0

			// Find the running velocity at the start of this segment by scanning
			// all Dynamic tokens before the segment start tick
			let velocity = DEFAULT_VELOCITY
			for (let ti = 0; ti < tokens.length; ti++) {
				if (tokens[ti].tickValue >= seg.startTick) break
				if (tokens[ti].type === 'Dynamic' && tokens[ti].dynamic) {
					velocity = DYNAMIC_VELOCITY[tokens[ti].dynamic] ?? velocity
				}
			}

			// Track which tokens have been consumed by tie extension within this segment
			const tieConsumed = new Set()

			for (let ti = 0; ti < tokens.length; ti++) {
				const tok = tokens[ti]
				if (tok.tickValue == null) continue
				if (tok.tickValue < seg.startTick) continue
				if (tok.tickValue >= seg.endTick) break

				// Update velocity when encountering dynamic markings
				if (tok.type === 'Dynamic' && tok.dynamic) {
					velocity = DYNAMIC_VELOCITY[tok.dynamic] ?? velocity
					continue
				}

				if (tok.type !== 'Note' && tok.type !== 'Chord') continue

				// Skip if already consumed by tie extension from an earlier note
				if (tieConsumed.has(ti)) continue

				const tickStart = tok.tickValue
				const durValue = tok.durValue
				if (durValue == null) continue

				// Accumulate duration through tied notes WITHIN this segment.
				// Ties don't cross segment boundaries (repeat boundaries break ties).
				let totalDur = typeof durValue === 'number' ? durValue : durValue.value()
				if (tok.tie) {
					let next = findNextTiedInSegment(tokens, ti, seg.endTick)
					while (next !== -1) {
						tieConsumed.add(next)
						const nt = tokens[next]
						if (nt.durValue) {
							totalDur += typeof nt.durValue === 'number' ? nt.durValue : nt.durValue.value()
						}
						if (nt.tie) {
							next = findNextTiedInSegment(tokens, next, seg.endTick)
						} else {
							next = -1
						}
					}
				}

				// Map score ticks to playback seconds via the segment offset
				const noteSec = ticksToSeconds(tickStart, tempoMap)
				const startSec = playbackOffset + (noteSec - segStartSec)
				const noteEndTick = tickStart + totalDur
				const endSec = playbackOffset + (ticksToSeconds(Math.min(noteEndTick, seg.endTick), tempoMap) - segStartSec)
				const durationSec = endSec - startSec

				if (tok.type === 'Note') {
					if (tok.name == null) continue
					const midi = toMidi(tok.name, tok.octave, tok.accidentalValue) + transpose
					notes.push({
						midi,
						time: startSec,
						duration: durationSec,
						velocity,
						channel,
						staffIndex: si,
						tokenIndex: ti,
						token: tok,
					})
				} else if (tok.type === 'Chord' && tok.notes) {
					// Each child note has its own resolved accidentalValue from the
					// interpreter.  The parent chord token copies the first child's
					// name/octave but NOT accidentalValue, so we must use child notes
					// exclusively to get correct MIDI pitches.
					for (const n of tok.notes) {
						if (n.name == null) continue
						if (n.tieEnd && !tok.tie) continue  // only skip tieEnd if not part of a new tie chain
						const midi = toMidi(n.name, n.octave, n.accidentalValue) + transpose
						notes.push({
							midi,
							time: startSec,
							duration: durationSec,
							velocity,
							channel,
							staffIndex: si,
							tokenIndex: ti,
							token: tok,
							noteRef: n,
						})
					}
				}
			}
		}

		playbackOffset += segDuration
	}

	// Sort by time (required by scheduler)
	notes.sort((a, b) => a.time - b.time || a.midi - b.midi)

	const duration = notes.reduce((mx, n) => Math.max(mx, n.time + n.duration), 0)
	return { notes, duration, channels, segments }
}

// ── Tie merging helpers ────────────────────────────────────────────────────

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

/**
 * Like findNextTied, but constrains the search to within the segment's tick range.
 * Returns -1 if the next tied note is beyond segEndTick (tie broken at boundary).
 */
function findNextTiedInSegment(tokens, idx, segEndTick) {
	const tok = tokens[idx]
	if (!tok.tie) return -1
	for (let j = idx + 1; j < tokens.length; j++) {
		const t = tokens[j]
		if (t.type === 'Note' || t.type === 'Chord') {
			if (t.tickValue >= segEndTick) return -1  // beyond segment
			if (t.tieEnd) return j
			return -1
		}
	}
	return -1
}

// ── Tempo map ──────────────────────────────────────────────────────────────

/**
 * Build a tempo map: array of { tick, bpm } sorted by tick.
 * Tick values are in whole-note units (matching tickValue from interpreter).
 * BPM is normalized to quarter-note BPM regardless of the displayed beat unit.
 */
export function buildTempoMap(staves) {
	const entries = []

	// Scan all staves for Tempo tokens (they usually appear on stave 0)
	for (const stave of staves) {
		for (const tok of stave.tokens) {
			if (tok.type === 'Tempo') {
				// tok.duration = BPM value (beats per minute of the displayed beat unit)
				// tok.beatDuration = beat unit in whole-note fractions (0.25 = quarter, 0.5 = half, etc.)
				// Convert to quarter-note BPM: if displayed as half=60, that's quarter=120.
				const rawBpm = tok.duration || 120
				const beatDur = tok.beatDuration || 0.25  // default to quarter
				const quarterBpm = rawBpm * (beatDur / 0.25)
				const tick = tok.tickValue ?? 0
				entries.push({ tick, bpm: quarterBpm })
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
export function ticksToSeconds(tick, tempoMap) {
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
		this._onNoteOn = null
		this._onNoteOff = null
		this._speed = 1

		// Solo/mute state per staff
		// _soloStaves: Set of staff indices with solo enabled (empty = no solo = all play)
		// _muteStaves: Set of staff indices that are muted
		this._soloStaves = new Set()
		this._muteStaves = new Set()
		this._allNotes = []   // unfiltered notes from last load
		this._scoreData = null // last loaded score data
	}

	/** Register a callback for time updates: fn(currentTime, duration) */
	onTime(fn) { this._onTime = fn }

	/** Register a callback for playback end */
	onEnd(fn) { this._onEnd = fn }

	/** Register a callback for play/pause state changes: fn(playing) */
	onStateChange(fn) { this._onStateChange = fn }

	/** Register a callback for note-on events: fn(noteEvent) */
	onNoteOn(fn) { this._onNoteOn = fn }

	/** Register a callback for note-off events: fn(noteEvent) */
	onNoteOff(fn) { this._onNoteOff = fn }

	// ── Solo / Mute ───────────────────────────────────────────────────────

	/** Solo a staff index — only soloed staves will play. */
	setSolo(staffIndex, enabled) {
		if (enabled) this._soloStaves.add(staffIndex)
		else this._soloStaves.delete(staffIndex)
	}

	/** Mute a staff index — muted staves won't play. */
	setMute(staffIndex, enabled) {
		if (enabled) this._muteStaves.add(staffIndex)
		else this._muteStaves.delete(staffIndex)
	}

	/** Check if a staff is soloed. */
	isSoloed(staffIndex) { return this._soloStaves.has(staffIndex) }

	/** Check if a staff is muted. */
	isMuted(staffIndex) { return this._muteStaves.has(staffIndex) }

	/** Get all soloed staff indices. */
	get soloStaves() { return this._soloStaves }

	/** Get all muted staff indices. */
	get muteStaves() { return this._muteStaves }

	/** Clear all solo/mute state. */
	clearSoloMute() {
		this._soloStaves.clear()
		this._muteStaves.clear()
	}

	/**
	 * Filter notes based on current solo/mute state.
	 * - If any staves are soloed, only those staves play (mute is ignored for soloed).
	 * - Otherwise, muted staves are excluded.
	 */
	_filterNotes(notes) {
		const hasSolo = this._soloStaves.size > 0
		return notes.filter(n => {
			if (hasSolo) return this._soloStaves.has(n.staffIndex)
			return !this._muteStaves.has(n.staffIndex)
		})
	}

	/**
	 * Re-load the scheduler with filtered notes based on current solo/mute.
	 * Preserves playback position if currently playing.
	 */
	async _reloadFiltered() {
		if (!this._scheduler || this._allNotes.length === 0) return
		const wasPlaying = this.playing
		const pos = this.currentTime
		const filtered = this._filterNotes(this._allNotes)
		this._scheduler.load({ notes: filtered })
		if (wasPlaying) {
			this._scheduler.seek(pos)
			this._scheduler.play()
		}
	}

	get playing() { return this._scheduler?.playing ?? false }
	get currentTime() { return this._scheduler?.currentTime ?? 0 }
	get duration() { return this._scheduler?.duration ?? 0 }

	/** Current playback speed multiplier (1 = normal). */
	get speed() { return this._speed }
	set speed(value) { this.setSpeed(value) }

	/** Set playback speed multiplier. Clamped to [0.1, 4]. */
	setSpeed(speed) {
		this._speed = Math.max(0.1, Math.min(4, speed))
		this._scheduler?.setSpeed(this._speed)
	}

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

		this._scheduler.on('noteOn', (note) => {
			this._onNoteOn?.(note)
		})

		this._scheduler.on('noteOff', (note) => {
			this._onNoteOff?.(note)
		})

		this._scheduler.on('end', () => {
			this._onStateChange?.(false)
			this._onEnd?.()
		})

		this._initialized = true

		// Apply any speed set before init
		if (this._speed !== 1) {
			this._scheduler.setSpeed(this._speed)
		}

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
		const { notes, channels } = buildNoteEvents(data)
		this._allNotes = notes
		this._scoreData = data

		// Send GM program change for each staff's instrument before playback.
		// This sets the correct instrument sound per channel.
		const staves = data.score.staves
		for (let si = 0; si < staves.length; si++) {
			const ch = channels[si]
			const program = staves[si].patchName ?? 0
			this._engine.programChange(ch, program)
		}
		const filtered = this._filterNotes(notes)
		this._scheduler.load({ notes: filtered })
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
