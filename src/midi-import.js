/**
 * midi-import.js — Convert Standard MIDI Files to the internal score format.
 *
 * Uses SpessaSynth's BasicMIDI parser (already bundled) for binary SMF parsing,
 * then converts the raw MIDI events into the { header, info, score } structure
 * that the interpreter, layout engine, and playback pipeline expect.
 *
 * ## Quantization approach
 *
 * Grid-snap quantization at a configurable resolution (default: 16th note).
 * Note start times and durations are snapped to the nearest grid position.
 * Dotted rhythms and triplets are detected.  Notes spanning barlines are
 * split with ties.
 *
 * ## Known limitations / future work
 *
 * - **Adaptive quantization**: A multi-pass algorithm that tries multiple grid
 *   levels and picks the best fit per note would handle rubato/live recordings
 *   better.  Not implemented yet — the grid-snap approach works well for
 *   sequencer-exported MIDI.
 * - **Expression parsing**: Dynamic tokens from velocity changes, sustain pedal
 *   (CC64), program change → instrument assignment per staff could be extracted
 *   from the MIDI data but are not wired yet.
 * - **Percussion staff**: Channel 10 should use percussion clef and GM drum map.
 * - **Voice splitting**: Multiple voices in one MIDI track are not separated.
 * - **Tuplets beyond triplets**: Quintuplets, septuplets, etc. not detected.
 */

import {
	BasicMIDI,
	midiMessageTypes,
} from '../vendor/soundfont-engine/vendor/spessasynth/spessasynth_core.bundle.js'

// ── Constants ──────────────────────────────────────────────────────────────

// MIDI semitone → { name, accidental } for sharp and flat spelling.
// For white keys the accidental is always '' (natural implied).
// For black keys, sharp spelling uses the note below + '#',
// flat spelling uses the note above + 'b'.
// We never produce Cb, Fb, E#, B# — those only appear in exotic key sigs
// (C# major, Cb major) which we handle separately.
const SHARP_SPELLING = [
	// 0    1     2    3     4    5    6     7    8     9    10    11
	{ n: 'C', a: '' }, { n: 'C', a: '#' }, { n: 'D', a: '' }, { n: 'D', a: '#' },
	{ n: 'E', a: '' }, { n: 'F', a: '' }, { n: 'F', a: '#' }, { n: 'G', a: '' },
	{ n: 'G', a: '#' }, { n: 'A', a: '' }, { n: 'A', a: '#' }, { n: 'B', a: '' },
]
const FLAT_SPELLING = [
	// 0    1     2    3     4    5    6     7    8     9    10    11
	{ n: 'C', a: '' }, { n: 'D', a: 'b' }, { n: 'D', a: '' }, { n: 'E', a: 'b' },
	{ n: 'E', a: '' }, { n: 'F', a: '' }, { n: 'G', a: 'b' }, { n: 'G', a: '' },
	{ n: 'A', a: 'b' }, { n: 'A', a: '' }, { n: 'B', a: 'b' }, { n: 'B', a: '' },
]

// White key semitones (for quick identification)
const WHITE_KEY_SEMITONES = new Set([0, 2, 4, 5, 7, 9, 11])

// Key sig: fifths value → { key, accidentals[] } (for the interpreter's setKeySignature)
const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
const FLAT_KEYS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']

const SHARP_KEY_ACCIDENTALS = {
	C: [], G: ['F'], D: ['F', 'C'], A: ['F', 'C', 'G'],
	E: ['F', 'C', 'G', 'D'], B: ['F', 'C', 'G', 'D', 'A'],
	'F#': ['F', 'C', 'G', 'D', 'A', 'E'], 'C#': ['F', 'C', 'G', 'D', 'A', 'E', 'B'],
}
const FLAT_KEY_ACCIDENTALS = {
	C: [], F: ['B'], Bb: ['B', 'E'], Eb: ['B', 'E', 'A'],
	Ab: ['B', 'E', 'A', 'D'], Db: ['B', 'E', 'A', 'D', 'G'],
	Gb: ['B', 'E', 'A', 'D', 'G', 'C'], Cb: ['B', 'E', 'A', 'D', 'G', 'C', 'F'],
}

// Semitone value for each note name (same as audio.js SEMITONE)
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// Map from note letter to diatonic index (C=0 .. B=6)
const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

// Clef pitch offsets (must match interpreter.js CLEF_PITCH_OFFSETS)
const CLEF_OFFSETS = { treble: 34, bass: 22, alto: 28, tenor: 26 }

// GM program names (for staff names when importing MIDI)
const GM_PROGRAMS = [
	'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano',
	'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord',
	'Clavinet', 'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
	'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer', 'Drawbar Organ',
	'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ',
	'Accordion', 'Harmonica', 'Tango Accordion', 'Acoustic Guitar (nylon)',
	'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
	'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar',
	'Guitar Harmonics', 'Acoustic Bass', 'Electric Bass (finger)',
	'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2',
	'Synth Bass 1', 'Synth Bass 2', 'Violin', 'Viola', 'Cello', 'Contrabass',
	'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
	'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1',
	'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Choir',
	'Orchestra Hit', 'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
	'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
	'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe',
	'English Horn', 'Bassoon', 'Clarinet', 'Piccolo', 'Flute', 'Recorder',
	'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
	'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)',
	'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)',
	'Lead 7 (fifths)', 'Lead 8 (bass + lead)', 'Pad 1 (new age)',
	'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
	'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)',
	'Pad 8 (sweep)', 'FX 1 (rain)', 'FX 2 (soundtrack)',
	'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)',
	'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
	'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe',
	'Fiddle', 'Shanai', 'Tinkle Bell', 'Agogo', 'Steel Drums',
	'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum',
	'Reverse Cymbal', 'Guitar Fret Noise', 'Breath Noise', 'Seashore',
	'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
]

// ── MIDI event extraction ──────────────────────────────────────────────────

/**
 * Extract structured data from a parsed BasicMIDI object.
 * Returns { notesByChannel, meta } where meta contains tempo/keySig/timeSig/
 * trackNames/programChanges.
 */
function extractMidiData(midi) {
	const meta = {
		tempoChanges: [],      // [{ tick, bpm }]
		timeSignatures: [],    // [{ tick, numerator, denominator }]
		keySignatures: [],     // [{ tick, key, mode }]  key = fifths (-7..7), mode = 0 major / 1 minor
		trackNames: [],        // [{ trackIndex, name }]
		programChanges: [],    // [{ tick, channel, program }]
		lyrics: [],            // [{ tick, text }]
	}

	// Per-channel note tracking
	const pendingNotes = new Map()  // key: `${channel}-${midiNote}` → { startTick, velocity, channel, midiNote }
	const notesByChannel = {}       // channel → [{ midiNote, startTick, durationTick, velocity }]

	for (let ti = 0; ti < midi.tracks.length; ti++) {
		const track = midi.tracks[ti]
		if (track.name) {
			meta.trackNames.push({ trackIndex: ti, name: track.name })
		}

		for (const event of track.events) {
			const statusHi = event.statusByte & 0xF0
			const channel = event.statusByte & 0x0F

			if (statusHi === midiMessageTypes.noteOn && event.data[1] > 0) {
				// Note On
				const key = `${channel}-${event.data[0]}`
				// If there's already a pending note, close it first
				if (pendingNotes.has(key)) {
					const pending = pendingNotes.get(key)
					const dur = event.ticks - pending.startTick
					if (dur > 0) {
						if (!notesByChannel[pending.channel]) notesByChannel[pending.channel] = []
						notesByChannel[pending.channel].push({
							midiNote: pending.midiNote,
							startTick: pending.startTick,
							durationTick: dur,
							velocity: pending.velocity,
						})
					}
				}
				pendingNotes.set(key, {
					startTick: event.ticks,
					velocity: event.data[1],
					channel,
					midiNote: event.data[0],
				})
			} else if (statusHi === midiMessageTypes.noteOff ||
				(statusHi === midiMessageTypes.noteOn && event.data[1] === 0)) {
				// Note Off
				const key = `${channel}-${event.data[0]}`
				const pending = pendingNotes.get(key)
				if (pending) {
					const dur = event.ticks - pending.startTick
					if (dur > 0) {
						if (!notesByChannel[pending.channel]) notesByChannel[pending.channel] = []
						notesByChannel[pending.channel].push({
							midiNote: pending.midiNote,
							startTick: pending.startTick,
							durationTick: dur,
							velocity: pending.velocity,
						})
					}
					pendingNotes.delete(key)
				}
			} else if (statusHi === midiMessageTypes.programChange) {
				meta.programChanges.push({
					tick: event.ticks,
					channel,
					program: event.data[0],
				})
			} else if (event.statusByte === 0xFF) {
				// Meta events — statusByte is 0xFF, first data byte is meta type
				// SpessaSynth stores meta events with statusByte = metaType directly
				// (not 0xFF), so we check the event.statusByte against known meta types
			}

			// SpessaSynth encodes meta events differently: the statusByte IS the
			// meta event type (0x51 for tempo, 0x58 for time sig, etc.), not 0xFF.
			if (event.statusByte === midiMessageTypes.setTempo) {
				// Tempo: 3 bytes → microseconds per beat
				const data = event.data
				const uspb = (data[0] << 16) | (data[1] << 8) | data[2]
				meta.tempoChanges.push({
					tick: event.ticks,
					bpm: 60000000 / uspb,
				})
			} else if (event.statusByte === midiMessageTypes.timeSignature) {
				const num = event.data[0]
				const denom = Math.pow(2, event.data[1])
				meta.timeSignatures.push({
					tick: event.ticks,
					numerator: num,
					denominator: denom,
				})
			} else if (event.statusByte === midiMessageTypes.keySignature) {
				// key = signed byte (fifths), mode = 0 major / 1 minor
				const fifths = event.data[0] > 127 ? event.data[0] - 256 : event.data[0]
				meta.keySignatures.push({
					tick: event.ticks,
					key: fifths,
					mode: event.data[1] || 0,
				})
			} else if (event.statusByte === midiMessageTypes.lyric) {
				const decoder = new TextDecoder('utf-8', { fatal: false })
				meta.lyrics.push({
					tick: event.ticks,
					text: decoder.decode(event.data),
				})
			} else if (event.statusByte === midiMessageTypes.trackName && !track.name) {
				const decoder = new TextDecoder('utf-8', { fatal: false })
				const name = decoder.decode(event.data)
				if (name) {
					meta.trackNames.push({ trackIndex: ti, name })
				}
			}
		}
	}

	// Close any unclosed notes (e.g., MIDI file without proper noteOff at end)
	for (const [, pending] of pendingNotes) {
		if (!notesByChannel[pending.channel]) notesByChannel[pending.channel] = []
		notesByChannel[pending.channel].push({
			midiNote: pending.midiNote,
			startTick: pending.startTick,
			durationTick: 1,  // minimal duration
			velocity: pending.velocity,
		})
	}

	// Sort notes within each channel by start tick, then by MIDI note
	for (const ch of Object.keys(notesByChannel)) {
		notesByChannel[ch].sort((a, b) => a.startTick - b.startTick || a.midiNote - b.midiNote)
	}

	// Ensure default tempo if none found
	if (meta.tempoChanges.length === 0) {
		meta.tempoChanges.push({ tick: 0, bpm: 120 })
	}
	meta.tempoChanges.sort((a, b) => a.tick - b.tick)

	// Default time sig if none found
	if (meta.timeSignatures.length === 0) {
		meta.timeSignatures.push({ tick: 0, numerator: 4, denominator: 4 })
	}
	meta.timeSignatures.sort((a, b) => a.tick - b.tick)

	return { notesByChannel, meta }
}

// ── Quantization ───────────────────────────────────────────────────────────

/**
 * Candidate durations as fractions of a whole note.
 * Each entry: { ticks (at ppq=480), duration, dots, triplet, fraction }
 * The fraction is numerator/denominator of a whole note.
 */
function buildDurationTable(ppq) {
	// ppq = ticks per quarter note
	const whole = ppq * 4
	const candidates = []

	// Standard durations: 1, 2, 4, 8, 16, 32, 64
	const durations = [1, 2, 4, 8, 16, 32, 64]
	for (const d of durations) {
		const baseTicks = whole / d
		// Plain
		candidates.push({
			ticks: baseTicks,
			duration: d,
			dots: 0,
			triplet: false,
		})
		// Dotted (1.5x)
		if (d <= 32) {
			candidates.push({
				ticks: baseTicks * 1.5,
				duration: d,
				dots: 1,
				triplet: false,
			})
		}
		// Double-dotted (1.75x)
		if (d <= 16) {
			candidates.push({
				ticks: baseTicks * 1.75,
				duration: d,
				dots: 2,
				triplet: false,
			})
		}
		// Triplet (2/3x)
		if (d >= 2 && d <= 32) {
			candidates.push({
				ticks: baseTicks * 2 / 3,
				duration: d,
				dots: 0,
				triplet: true,
			})
		}
	}

	// Sort by ticks descending (longest first) for matching
	candidates.sort((a, b) => b.ticks - a.ticks)
	return candidates
}

/**
 * Snap a tick count to the nearest valid musical duration.
 * Returns { duration, dots, triplet, quantizedTicks }.
 */
function quantizeDuration(rawTicks, durationTable) {
	let best = null
	let bestDist = Infinity

	for (const cand of durationTable) {
		const dist = Math.abs(rawTicks - cand.ticks)
		if (dist < bestDist) {
			bestDist = dist
			best = cand
		}
	}

	return best || { duration: 4, dots: 0, triplet: false, ticks: durationTable[0]?.ticks || 480 }
}

/**
 * Snap a start tick to the nearest grid position.
 * @param {number} tick - Raw tick value
 * @param {number} gridSize - Grid resolution in ticks (e.g., ppq/4 for 16th notes)
 * @returns {number} Quantized tick
 */
function quantizeStartTick(tick, gridSize) {
	return Math.round(tick / gridSize) * gridSize
}

// ── MIDI note ↔ staff position conversion ──────────────────────────────────

/**
 * Determine the appropriate clef for a set of notes based on median pitch.
 */
function detectClef(notes) {
	if (notes.length === 0) return 'treble'
	const sorted = notes.map(n => n.midiNote).sort((a, b) => a - b)
	const median = sorted[Math.floor(sorted.length / 2)]
	if (median < 48) return 'bass'       // Below C3
	if (median < 60) return 'bass'       // Below C4
	return 'treble'
}

/**
 * Convert a MIDI note number to { name, octave, accidental, position } for a
 * given clef and key signature context.
 *
 * The "position" is the NWC staff position where:
 *   position + CLEF_PITCH_OFFSET = absolute diatonic pitch index
 *   negative = below middle line, positive = above middle line
 *
 * The accidental field is the EXPLICIT accidental to write on the note:
 *   '' = no accidental (note is natural in this key, or key sig provides it)
 *   '#' = sharp needed (not provided by key sig)
 *   'b' = flat needed (not provided by key sig)
 *   'n' = natural sign needed (cancels a key sig sharp/flat)
 *
 * Key signature interaction:
 *   - If a note's pitch matches the key sig (e.g., F# in G major), no explicit
 *     accidental is needed — the interpreter resolves it from the key sig.
 *   - If a note needs a sharp/flat NOT in the key sig, we write it explicitly.
 *   - If a white key is sharpened/flatted by the key sig but we want the natural
 *     pitch, we write 'n' to cancel.
 *
 * Spelling convention:
 *   - Sharp keys (G, D, A, E, B, F#, C#) and C major: use sharp spelling for
 *     black keys (C#, D#, F#, G#, A#)
 *   - Flat keys (F, Bb, Eb, Ab, Db, Gb, Cb): use flat spelling for black keys
 *     (Db, Eb, Gb, Ab, Bb)
 */
function midiToStaffPosition(midiNote, clef, keySigSharps, keySigFlats) {
	const octave = Math.floor(midiNote / 12) - 1  // MIDI 60 = C4, octave = 4
	const semitone = midiNote % 12

	// Choose sharp or flat spelling.
	// C major (no sharps, no flats) defaults to sharp spelling — this is the
	// standard convention and avoids confusing enharmonics like Gb in C major.
	const useFlats = keySigFlats.length > 0 && keySigSharps.length === 0
	const spelling = useFlats ? FLAT_SPELLING[semitone] : SHARP_SPELLING[semitone]
	let name = spelling.n
	let accidental = spelling.a

	// Now reconcile with the key signature.
	// The key sig tells the interpreter which notes are automatically altered.
	// We only need an explicit accidental when the note DIFFERS from what the
	// key sig provides.

	const isWhiteKey = WHITE_KEY_SEMITONES.has(semitone)

	if (isWhiteKey) {
		// This is a natural pitch.  If the key sig sharpens or flats this note,
		// we need an explicit natural sign to cancel it.
		if (keySigSharps.includes(name) || keySigFlats.includes(name)) {
			accidental = 'n'
		} else {
			accidental = ''
		}
	} else {
		// This is a black key.  Check if the key sig already provides this alteration.
		if (accidental === '#' && keySigSharps.includes(name)) {
			// Key sig already sharpens this note — no explicit accidental needed
			accidental = ''
		} else if (accidental === 'b' && keySigFlats.includes(name)) {
			// Key sig already flats this note — no explicit accidental needed
			accidental = ''
		}
		// Otherwise keep the explicit '#' or 'b'
	}

	// Compute staff position.
	// absPitch = diatonic pitch index (C0=0, D0=1, ..., B0=6, C1=7, ...)
	// position = absPitch - clefOffset (negative = below middle line)
	const absPitch = octave * 7 + NOTE_INDEX[name]
	const clefOffset = CLEF_OFFSETS[clef] || CLEF_OFFSETS.treble
	const position = absPitch - clefOffset

	return { name, octave, accidental, position }
}

// ── Score building ─────────────────────────────────────────────────────────

/**
 * Get the key signature properties from a MIDI key signature event.
 * @param {number} fifths  — -7..7 (sharps positive, flats negative)
 * @returns {{ key, sharps, flats, sharpNames, flatNames }}
 */
function fifthsToKeySig(fifths) {
	if (fifths >= 0) {
		const key = SHARP_KEYS[fifths] || 'C'
		const sharpNames = SHARP_KEY_ACCIDENTALS[key] || []
		return {
			key,
			sharps: sharpNames,
			flats: [],
		}
	} else {
		const key = FLAT_KEYS[-fifths] || 'C'
		const flatNames = FLAT_KEY_ACCIDENTALS[key] || []
		return {
			key,
			sharps: [],
			flats: flatNames,
		}
	}
}

/**
 * Split notes at measure boundaries and produce tied notes.
 * A note that extends past a barline becomes two (or more) tied notes.
 *
 * @param {number} startTick - Quantized start tick
 * @param {number} endTick - startTick + quantized duration ticks
 * @param {number} midiNote - For identification
 * @param {object} timeSigInfo - { ticksPerMeasure, ... }
 * @param {object} durationTable - For re-quantizing split durations
 * @returns {Array<{ startTick, durationTicks, tieStart, tieEnd }>}
 */
function splitAtBarlines(startTick, endTick, timeSigInfo, durationTable) {
	const { ticksPerMeasure } = timeSigInfo
	const segments = []

	let remaining = endTick - startTick
	let currentStart = startTick

	while (remaining > 0) {
		// Find next barline after currentStart
		const measureStart = Math.floor(currentStart / ticksPerMeasure) * ticksPerMeasure
		const nextBarline = measureStart + ticksPerMeasure

		const available = nextBarline - currentStart
		const segDuration = Math.min(remaining, available)

		segments.push({
			startTick: currentStart,
			durationTicks: segDuration,
		})

		currentStart += segDuration
		remaining -= segDuration
	}

	// Set tie flags
	for (let i = 0; i < segments.length; i++) {
		segments[i].tieStart = i < segments.length - 1 ? 1 : 0
		segments[i].tieEnd = i > 0 ? 1 : 0
	}

	return segments
}

/**
 * Group simultaneous notes into chords.
 * @param {Array} notes - Sorted by startTick
 * @returns {Array<{ startTick, notes: Array }>}  where each group has same startTick
 */
function groupSimultaneousNotes(notes) {
	const groups = []
	let i = 0
	while (i < notes.length) {
		const tick = notes[i].startTick
		const group = []
		while (i < notes.length && notes[i].startTick === tick) {
			group.push(notes[i])
			i++
		}
		groups.push({ startTick: tick, notes: group })
	}
	return groups
}

/**
 * Apply standard beaming rules based on time signature.
 * Modifies tokens in place, setting the `beam` property.
 */
function applyBeaming(tokens, ppq, timeSigNumerator, timeSigDenominator) {
	// Beat duration in ticks
	const beatTicks = ppq * 4 / timeSigDenominator

	// Collect runs of beamable notes (8th notes and shorter)
	let runStart = -1
	for (let i = 0; i <= tokens.length; i++) {
		const tok = tokens[i]
		const isBeamable = tok && (tok.type === 'Note' || tok.type === 'Chord') && tok.duration >= 8

		if (isBeamable) {
			if (runStart === -1) runStart = i
		} else {
			if (runStart !== -1 && i - runStart >= 2) {
				// We have a run of 2+ beamable notes — apply beaming
				// Break at beat boundaries
				let beamGroupStart = runStart
				for (let j = runStart; j < i; j++) {
					const beatOfCurrent = Math.floor((tokens[j]._quantizedTick || 0) / beatTicks)
					const beatOfNext = j + 1 < i
						? Math.floor((tokens[j + 1]._quantizedTick || 0) / beatTicks)
						: -1

					if (beatOfCurrent !== beatOfNext || j + 1 === i) {
						// End of beat group or end of run
						const groupLen = j - beamGroupStart + 1
						if (groupLen >= 2) {
							for (let k = beamGroupStart; k <= j; k++) {
								if (k === beamGroupStart) tokens[k].beam = 1      // first
								else if (k === j) tokens[k].beam = 3              // end
								else tokens[k].beam = 2                           // middle
							}
						}
						beamGroupStart = j + 1
					}
				}
			}
			runStart = -1
		}
	}
}

/**
 * Fill gaps between note groups with rest tokens.
 * @param {Array} noteGroups - Sorted by startTick, each { startTick, endTick, tokens }
 * @param {number} totalTicks - Total duration in ticks (last note end)
 * @param {object} durationTable - Duration candidates
 * @param {number} ppq - Ticks per quarter note
 * @returns {Array} Rest tokens to insert
 */
function generateRests(noteGroups, totalTicks, durationTable, ppq) {
	const rests = []
	let currentTick = 0

	for (const group of noteGroups) {
		if (group.startTick > currentTick) {
			const gap = group.startTick - currentTick
			const restTokens = ticksToRests(currentTick, gap, durationTable, ppq)
			rests.push(...restTokens)
		}
		currentTick = Math.max(currentTick, group.endTick)
	}

	return rests
}

/**
 * Convert a gap of ticks into one or more rest tokens.
 */
function ticksToRests(startTick, gapTicks, durationTable, ppq) {
	const rests = []
	let remaining = gapTicks
	let tick = startTick

	while (remaining > 0) {
		// Find the largest duration that fits
		let best = null
		for (const cand of durationTable) {
			if (cand.ticks <= remaining + 1 && !cand.triplet) {
				best = cand
				break  // durationTable is sorted descending
			}
		}
		if (!best) break  // Shouldn't happen

		rests.push({
			type: 'Rest',
			position: 0,
			duration: best.duration,
			dots: best.dots,
			triplet: 0,
			_quantizedTick: tick,
		})

		const usedTicks = best.ticks
		tick += usedTicks
		remaining -= usedTicks

		// Safety: if remaining is very small (rounding error), stop
		if (remaining < ppq / 32) break
	}

	return rests
}

/**
 * Build tokens for one staff from a list of notes.
 */
function buildStaffTokens(notes, clef, keySig, timeSigs, tempos, ppq, durationTable, totalTicks) {
	const tokens = []

	// Key sig info for accidental spelling
	const keySigSharps = keySig.sharps || []
	const keySigFlats = keySig.flats || []

	// Initial clef
	tokens.push({
		type: 'Clef',
		clef: clef,
		octave: 0,
	})

	// Initial key signature
	tokens.push({
		type: 'KeySignature',
		key: keySig.key,
		sharps: keySigSharps,
		flats: keySigFlats.map(f => f + 'b'),  // Format: ['Bb', 'Eb', ...]
		accidentals: keySig.key === 'C' ? ['C'] : undefined,
	})

	// Fix flat format: the interpreter expects lowercase letter + accidental, e.g. 'Bb'
	// Actually looking at the interpreter: setKeySignature takes array like ['Bb', 'Eb']
	// or like ['f#', 'c#'] — the charAt(0).toUpperCase() + charAt(1) form
	// Let me match the NWC format: flats are like ['Bb', 'Eb'] and sharps like ['F', 'C']
	// Wait — looking at nwc.js adaptObject: token.flats = flatNames, token.sharps = sharpNames
	// where sharpNames are from bitmapToNotes() which returns 'A','B', etc.
	// Then in the interpreter: sharps['A'] => ['f#', 'c#', 'g#'] etc. uses token.key to
	// look up the full accidental list.  So the .key field is what matters most.

	// Initial time signature
	const firstTimeSig = timeSigs[0] || { numerator: 4, denominator: 4 }
	tokens.push({
		type: 'TimeSignature',
		signature: `${firstTimeSig.numerator}/${firstTimeSig.denominator}`,
		group: firstTimeSig.numerator,
		beat: firstTimeSig.denominator,
	})

	// Initial tempo (only on first staff typically, but we include it)
	const firstTempo = tempos[0] || { bpm: 120 }
	tokens.push({
		type: 'Tempo',
		duration: Math.round(firstTempo.bpm),
		note: 'Quarter',
		position: 0,
		placement: 'bestFit',
	})

	// Quantize and sort notes
	const gridSize = ppq / 4  // 16th note grid
	const quantizedNotes = notes.map(n => {
		const qStart = quantizeStartTick(n.startTick, gridSize)
		const qDur = quantizeDuration(n.durationTick, durationTable)
		return {
			...n,
			quantizedStart: qStart,
			quantizedDuration: qDur,
		}
	})

	// Group simultaneous quantized notes
	const sorted = quantizedNotes.sort((a, b) => a.quantizedStart - b.quantizedStart || a.midiNote - b.midiNote)
	const groups = groupSimultaneousNotes(sorted.map(n => ({ ...n, startTick: n.quantizedStart })))

	// Build time sig info for barline splitting
	const ticksPerMeasure = ppq * 4 * firstTimeSig.numerator / firstTimeSig.denominator
	const timeSigInfo = { ticksPerMeasure }

	// Track barline positions for insertion
	const barlineTicks = new Set()

	// Build note/chord tokens + collect barline positions
	const noteTokenGroups = []  // { startTick, endTick, tokens[] }

	for (const group of groups) {
		const groupTokens = []
		let groupEndTick = group.startTick

		if (group.notes.length === 1) {
			// Single note
			const n = group.notes[0]
			const qDur = n.quantizedDuration
			const endTick = n.quantizedStart + qDur.ticks
			const segments = splitAtBarlines(n.quantizedStart, endTick, timeSigInfo, durationTable)

			for (const seg of segments) {
				const segDur = quantizeDuration(seg.durationTicks, durationTable)
				const pos = midiToStaffPosition(n.midiNote, clef, keySigSharps, keySigFlats)

				groupTokens.push({
					type: 'Note',
					position: pos.position,
					duration: segDur.duration,
					dots: segDur.dots,
					accidental: pos.accidental,
					tie: seg.tieStart,
					tieEnd: seg.tieEnd,
					slur: 0,
					beam: 0,
					stem: 0,
					triplet: segDur.triplet ? 1 : 0,  // simplified: mark first of triplet group
					staccato: 0,
					accent: 0,
					grace: 0,
					tenuto: 0,
					_quantizedTick: seg.startTick,
				})

				groupEndTick = Math.max(groupEndTick, seg.startTick + segDur.ticks)
			}
		} else {
			// Chord — multiple notes at same tick
			const n0 = group.notes[0]
			const qDur = n0.quantizedDuration
			const endTick = n0.quantizedStart + qDur.ticks
			const segments = splitAtBarlines(n0.quantizedStart, endTick, timeSigInfo, durationTable)

			for (const seg of segments) {
				const segDur = quantizeDuration(seg.durationTicks, durationTable)
				const childNotes = group.notes.map(n => {
					const pos = midiToStaffPosition(n.midiNote, clef, keySigSharps, keySigFlats)
					return {
						position: pos.position,
						accidental: pos.accidental,
						tie: seg.tieStart,
						tieEnd: seg.tieEnd,
						slur: 0,
						beam: 0,
						stem: 0,
						staccato: 0,
						accent: 0,
						grace: 0,
						tenuto: 0,
					}
				})

				const chordToken = {
					type: 'Chord',
					position: childNotes[0].position,
					duration: segDur.duration,
					dots: segDur.dots,
					accidental: childNotes[0].accidental,
					tie: seg.tieStart,
					tieEnd: seg.tieEnd,
					slur: 0,
					beam: 0,
					stem: 0,
					triplet: segDur.triplet ? 1 : 0,
					staccato: 0,
					accent: 0,
					grace: 0,
					tenuto: 0,
					notes: childNotes,
					chords: childNotes.length,
					_quantizedTick: seg.startTick,
				}

				groupTokens.push(chordToken)
				groupEndTick = Math.max(groupEndTick, seg.startTick + segDur.ticks)
			}
		}

		noteTokenGroups.push({
			startTick: group.startTick,
			endTick: groupEndTick,
			tokens: groupTokens,
		})
	}

	// Generate rests for gaps
	const restTokens = generateRests(noteTokenGroups, totalTicks, durationTable, ppq)

	// Merge note tokens and rest tokens, sort by tick
	const allMusicTokens = []
	for (const g of noteTokenGroups) {
		allMusicTokens.push(...g.tokens)
	}
	allMusicTokens.push(...restTokens)
	allMusicTokens.sort((a, b) => (a._quantizedTick || 0) - (b._quantizedTick || 0))

	// Insert barlines at measure boundaries
	const finalTokens = []
	let lastBarline = -1

	for (const tok of allMusicTokens) {
		const tick = tok._quantizedTick || 0
		const measure = Math.floor(tick / ticksPerMeasure)

		// Insert barlines for any measures we've crossed
		while (lastBarline < measure - 1) {
			lastBarline++
			if (lastBarline > 0) {
				finalTokens.push({ type: 'Barline', barline: 0 })
			}
		}
		if (measure > lastBarline && measure > 0) {
			lastBarline = measure
			finalTokens.push({ type: 'Barline', barline: 0 })
		}

		finalTokens.push(tok)
	}

	// Add all initial tokens then music tokens
	const result = [...tokens, ...finalTokens]

	// Apply beaming
	applyBeaming(result, ppq, firstTimeSig.numerator, firstTimeSig.denominator)

	// Clean up internal-only properties
	for (const tok of result) {
		delete tok._quantizedTick
	}

	return result
}

/**
 * Determine staff assignment strategy based on MIDI format.
 * Type 0: one track → split by channel
 * Type 1: multiple tracks → one staff per track (with notes)
 */
function assignStaves(midi, notesByChannel, meta) {
	const staves = []

	if (midi.format === 0 || Object.keys(notesByChannel).length <= 16) {
		// Split by MIDI channel
		const channels = Object.keys(notesByChannel).map(Number).sort((a, b) => a - b)

		for (const ch of channels) {
			const notes = notesByChannel[ch]
			if (!notes || notes.length === 0) continue

			// Find track name and program for this channel
			const progChange = meta.programChanges.find(p => p.channel === ch)
			const program = progChange ? progChange.program : 0
			const trackName = meta.trackNames.find(t => t.trackIndex > 0)  // skip conductor

			let name
			if (ch === 9) {
				name = 'Percussion'
			} else if (trackName && channels.length === 1) {
				name = trackName.name
			} else {
				name = GM_PROGRAMS[program] || `Channel ${ch + 1}`
			}

			staves.push({
				channel: ch,
				name,
				program,
				notes,
			})
		}
	}

	return staves
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Decode a Standard MIDI File ArrayBuffer into the internal score format.
 *
 * @param {ArrayBuffer} arrayBuffer - Raw .mid file bytes
 * @param {string} [filename=''] - Original filename for metadata
 * @returns {object} Score data in { header, info, score: { staves } } format
 */
export function decodeMidiArrayBuffer(arrayBuffer, filename = '') {
	// Parse binary MIDI using SpessaSynth
	const midi = BasicMIDI.fromArrayBuffer(arrayBuffer, filename)

	const ppq = midi.timeDivision
	if (!ppq || ppq <= 0) {
		throw new Error('MIDI file has invalid or SMPTE time division (not supported)')
	}

	// Extract structured data
	const { notesByChannel, meta } = extractMidiData(midi)

	// Build duration lookup table
	const durationTable = buildDurationTable(ppq)

	// Determine key signature
	const keySigEvent = meta.keySignatures[0]
	const keySig = keySigEvent ? fifthsToKeySig(keySigEvent.key) : fifthsToKeySig(0)

	// Assign staves
	const staffAssignments = assignStaves(midi, notesByChannel, meta)

	if (staffAssignments.length === 0) {
		throw new Error('MIDI file contains no note data')
	}

	// Find total duration in ticks
	let totalTicks = 0
	for (const sa of staffAssignments) {
		for (const n of sa.notes) {
			const end = n.startTick + n.durationTick
			if (end > totalTicks) totalTicks = end
		}
	}
	// Round up to next measure boundary
	const firstTimeSig = meta.timeSignatures[0] || { numerator: 4, denominator: 4 }
	const ticksPerMeasure = ppq * 4 * firstTimeSig.numerator / firstTimeSig.denominator
	totalTicks = Math.ceil(totalTicks / ticksPerMeasure) * ticksPerMeasure

	// Build staves
	const staves = staffAssignments.map((sa, idx) => {
		const clef = detectClef(sa.notes)
		const staffTokens = buildStaffTokens(
			sa.notes, clef, keySig, meta.timeSignatures, meta.tempoChanges,
			ppq, durationTable, totalTicks
		)

		return {
			staff_name: sa.name,
			staff_label: '',
			group_name: 'Standard',
			channel: sa.channel,
			bracketWithNext: false,
			braceWithNext: false,
			connectBarsWithNext: idx < staffAssignments.length - 1,
			layerWithNext: false,
			boundaryTop: 0,
			boundaryBottom: 0,
			endingBar: 0,
			lines: 5,
			lyrics: [],
			tokens: staffTokens,
		}
	})

	// Extract title from filename
	const title = filename
		? filename.replace(/\.(mid|midi|MID|MIDI)$/, '').replace(/[_-]/g, ' ')
		: 'MIDI Import'

	return {
		header: {
			version: 0,
			company: '[MIDI Import]',
			product: '[Notably]',
		},
		info: {
			title,
			author: '',
			lyricist: '',
			copyright1: '',
			copyright2: '',
			comments: `Imported from MIDI (format ${midi.format}, ${ppq} PPQ, ${staffAssignments.length} staves)`,
		},
		score: {
			allowLayering: false,
			staves,
		},
	}
}

/**
 * Check if an ArrayBuffer contains a MIDI file by examining magic bytes.
 * @param {ArrayBuffer} buf
 * @returns {boolean}
 */
export function isMidiFile(buf) {
	if (!buf || buf.byteLength < 4) return false
	const view = new Uint8Array(buf, 0, 4)
	// MThd = 0x4D 0x54 0x68 0x64
	return view[0] === 0x4D && view[1] === 0x54 && view[2] === 0x68 && view[3] === 0x64
}

// Export internals for testing
export {
	extractMidiData,
	buildDurationTable,
	quantizeDuration,
	quantizeStartTick,
	detectClef,
	midiToStaffPosition,
	fifthsToKeySig,
	splitAtBarlines,
	groupSimultaneousNotes,
	applyBeaming,
	generateRests,
	ticksToRests,
	buildStaffTokens,
	assignStaves,
}
