/**
 * midi-export.js — the score as a Standard MIDI File (type 1), as it plays.
 *
 * Built from the playback note events (buildNoteEvents in src/audio.js), so
 * the file sounds like Notably's playback: repeats, endings and jumps played
 * out, dynamics as velocities, transposing staves at sounding pitch. Times
 * stay in score time (beats), with the tempo and time signature changes in a
 * first, conductor track, so bars line up in a sequencer. Each staff is a
 * track on its own channel, with its instrument (GM program).
 */

import { buildNoteEvents, buildTempoMap } from './audio.js'

/** Ticks per quarter note. */
export const PPQ = 480

/** Whole notes (score time) → MIDI ticks. */
const toTicks = (wholeNotes) => Math.round(wholeNotes * 4 * PPQ)

/**
 * Score changes (tempo or time signature) along the played timeline: each
 * played segment starts with the value in force at its start, followed by
 * the changes inside it. `at` is in whole notes from the start of the music.
 * @param {Array<{tick:number}>} changes - by score tick, sorted
 */
function playedChanges(changes, segments) {
	const out = []
	let offset = 0
	for (const seg of segments) {
		let current = null
		for (const c of changes) if (c.tick <= seg.startTick) current = c
		if (current) out.push({ ...current, at: offset })
		for (const c of changes) {
			if (c.tick > seg.startTick && c.tick < seg.endTick) out.push({ ...c, at: offset + c.tick - seg.startTick })
		}
		offset += seg.endTick - seg.startTick
	}
	return out
}

/** Time signatures on the first staff that has any, by score tick. */
function timeSignatures(staves) {
	for (const st of staves) {
		const sigs = st.tokens
			.filter(t => t.type === 'TimeSignature' && t.group && t.beat)
			.map(t => ({ tick: t.tickValue || 0, numerator: t.group, denominator: t.beat }))
		if (sigs.length) return sigs
	}
	return []
}

/**
 * The MIDI file's content, before it is written out.
 * @param {object} data - the interpreted score (tokens with tickValue)
 * @param {object} [opts]
 * @param {(staffIndex:number) => boolean} [opts.audible] - staves to include
 *   (default: those not muted in the file)
 * @returns {{ title, tempos, timeSignatures, tracks }}
 */
export function scoreToMidi(data, { audible } = {}) {
	const staves = data.score.staves
	const heard = audible || ((si) => !staves[si]?.muted)
	const { notes, channels, segments } = buildNoteEvents(data)

	const tempos = []
	for (const t of playedChanges(buildTempoMap(staves), segments)) {
		if (tempos.length && tempos[tempos.length - 1].bpm === t.bpm) continue
		tempos.push({ at: toTicks(t.at), bpm: t.bpm })
	}
	const sigs = []
	for (const s of playedChanges(timeSignatures(staves), segments)) {
		const last = sigs[sigs.length - 1]
		if (last && last.numerator === s.numerator && last.denominator === s.denominator) continue
		sigs.push({ at: toTicks(s.at), numerator: s.numerator, denominator: s.denominator })
	}

	const tracks = []
	staves.forEach((st, si) => {
		if (!heard(si)) return
		const mine = notes.filter(n => n.staffIndex === si && n.playLength > 0)
		if (!mine.length) return
		tracks.push({
			name: st.staff_name || st.staff_label || `Staff ${si + 1}`,
			channel: channels[si],
			program: channels[si] === 9 ? null : st.patchName ?? 0,
			notes: mine.map(n => ({
				midi: n.midi,
				at: toTicks(n.playTick),
				length: Math.max(1, toTicks(n.playTick + n.playLength) - toTicks(n.playTick)),
				velocity: Math.max(1, Math.min(127, Math.round(n.velocity * 127))),
			})).filter(n => n.midi >= 0 && n.midi <= 127),
		})
	})
	return { title: data.info?.title || '', tempos, timeSignatures: sigs, tracks }
}

// ── Writing the file ──

function varLen(n) {
	const bytes = [n & 0x7f]
	while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80)
	return bytes
}

const textBytes = (s) => Array.from(new TextEncoder().encode(s))

/** One track chunk from events [{ at, order, bytes }] (sorted by time, then order). */
function trackChunk(events) {
	events.sort((a, b) => a.at - b.at || a.order - b.order)
	const body = []
	let now = 0
	for (const e of events) {
		body.push(...varLen(e.at - now), ...e.bytes)
		now = e.at
	}
	body.push(0x00, 0xff, 0x2f, 0x00) // end of track
	return [0x4d, 0x54, 0x72, 0x6b, ...uint32(body.length), ...body]
}

const uint32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
const meta = (type, data) => [0xff, type, ...varLen(data.length), ...data]

/**
 * Write a Standard MIDI File (type 1).
 * @param {{ title, tempos, timeSignatures, tracks }} midi - see scoreToMidi
 * @returns {Uint8Array}
 */
export function writeMidiFile({ title = '', tempos = [], timeSignatures: sigs = [], tracks = [] }) {
	// Conductor track: title, tempo and time signatures. At equal times the
	// time signature goes first, then the tempo.
	const conductor = []
	if (title) conductor.push({ at: 0, order: 0, bytes: meta(0x03, textBytes(title)) })
	for (const s of sigs) {
		const dd = Math.round(Math.log2(s.denominator))
		conductor.push({ at: s.at, order: 1, bytes: meta(0x58, [s.numerator, dd, 24, 8]) })
	}
	for (const t of tempos) {
		const us = Math.round(60000000 / t.bpm)
		conductor.push({ at: t.at, order: 2, bytes: meta(0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]) })
	}

	const chunks = [trackChunk(conductor)]
	for (const tr of tracks) {
		const ch = tr.channel & 0x0f
		const events = [{ at: 0, order: 0, bytes: meta(0x03, textBytes(tr.name || '')) }]
		if (tr.program != null) events.push({ at: 0, order: 1, bytes: [0xc0 | ch, tr.program & 0x7f] })
		for (const n of tr.notes) {
			// At equal times a note ends before the next one starts, so a
			// repeated pitch is struck again rather than cut short
			events.push({ at: n.at, order: 3, bytes: [0x90 | ch, n.midi, n.velocity] })
			events.push({ at: n.at + n.length, order: 2, bytes: [0x80 | ch, n.midi, 0] })
		}
		chunks.push(trackChunk(events))
	}

	const header = [0x4d, 0x54, 0x68, 0x64, ...uint32(6), 0x00, 0x01, (chunks.length >> 8) & 0xff, chunks.length & 0xff, (PPQ >> 8) & 0xff, PPQ & 0xff]
	return new Uint8Array([...header, ...chunks.flat()])
}
