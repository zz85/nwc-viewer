/**
 * transport-timeline.js — where each bar and section falls in playback time,
 * for the transport: the "Bar 12 of 36 · Chorus" readout, the scrub bar's
 * chapters and the bar-by-bar keys.
 *
 * Repeats and jumps are unrolled exactly as buildNoteEvents plays them, so a
 * repeated bar appears once per pass and times line up with the scheduler.
 */
import { buildTempoMap, ticksToSeconds } from './audio.js'
import { buildPlaybackSegments } from './playback-order.js'

const DURATIONAL = { Note: 1, Chord: 1, Rest: 1, RestChord: 1 }
// Barline styles (BarStyle in lib/nwc2xml/constants.js) that do not mark a section
const PLAIN_BARLINES = new Set([0, 8])  // Single, Hidden
const MAX_SECTIONS = 16
const MIN_SECTION_SHARE = 0.025  // sections shorter than this share of the piece merge into the previous one

/**
 * Bar starts of a staff, numbered like the engraved bar numbers: a barline
 * starts a bar only after notes or rests, so ":||:" counts once and a
 * closing barline after the last note starts nothing.
 */
function barStarts(tokens) {
	const starts = [{ tick: 0, bar: 1, style: null }]
	let sawContent = false
	for (const tok of tokens) {
		if (DURATIONAL[tok.type]) sawContent = true
		else if (tok.type === 'Barline' && sawContent && tok.tickValue != null) {
			sawContent = false
			starts.push({ tick: tok.tickValue, bar: starts.length + 1, style: tok.barline ?? 0 })
		}
	}
	if (!sawContent && starts.length > 1) starts.pop()  // closing barline
	return starts
}

/**
 * Section heading from a Text token: bold staff text (NWC's StaffBold font,
 * index 1) or an all-caps word ("CHORUS", "CODA"). Performance notes such as
 * "ad lib." or "Tenor solo" and verse numbers ("1.") are not headings.
 * "CHORUS  " → "Chorus".
 */
function sectionLabel(tok) {
	const s = String(tok.text || '').replace(/\s+/g, ' ').trim()
	if (s.length < 2 || s.length > 24 || /^\d+\.?$/.test(s) || tok.Visibility === 'Never') return ''
	const caps = s === s.toUpperCase() && /[A-Z]{3}/.test(s)
	if (!caps && tok.font !== 1) return ''
	return caps ? s.charAt(0) + s.slice(1).toLowerCase() : s
}

/** First written tempo: { bpm, beat } with beat in whole notes (0.25 = quarter). */
function firstTempo(staves) {
	let best = null
	for (const st of staves) {
		for (const tok of st.tokens) {
			if (tok.type === 'Tempo' && tok.duration && (best == null || (tok.tickValue ?? 0) < (best.tickValue ?? 0))) best = tok
		}
	}
	return best ? { bpm: best.duration, beat: best.beatDuration || 0.25, written: true } : { bpm: 120, beat: 0.25, written: false }
}

/**
 * @param {object} data - interpreted score data
 * @param {object} [opts]
 * @param {number} [opts.duration] - playback length in seconds (defaults to the end of the last segment)
 * @returns {{ bars: Array<{time, bar, tick}>, sections: Array<{time, end, bar, label}>, barCount: number, duration: number, tempo: {bpm, beat, written} }}
 */
export function buildTimeline(data, { duration } = {}) {
	const staves = data?.score?.staves || []
	const ref = staves.find(st => st.tokens?.some(t => DURATIONAL[t.type] && t.tickValue != null))
	const empty = { bars: [], sections: [], barCount: 0, duration: duration || 0, tempo: firstTempo(staves) }
	if (!ref) return empty

	const starts = barStarts(ref.tokens)
	const tempoMap = buildTempoMap(staves)
	const segments = buildPlaybackSegments(staves)
	const bars = []
	const cuts = []  // section boundaries in playback order
	let offset = 0
	segments.forEach((seg, si) => {
		const segStart = ticksToSeconds(seg.startTick, tempoMap)
		const at = tick => offset + ticksToSeconds(tick, tempoMap) - segStart
		// The bar the segment starts in (a jump may land mid-bar)
		let i = 0
		while (i + 1 < starts.length && starts[i + 1].tick <= seg.startTick + 1e-9) i++
		for (let first = true; i < starts.length && starts[i].tick < seg.endTick - 1e-9; i++, first = false) {
			const b = starts[i]
			const tick = Math.max(b.tick, seg.startTick)
			const entry = { time: at(tick), bar: b.bar, tick }
			bars.push(entry)
			// A new pass (repeat, jump) or a section barline starts a section
			if (first ? si > 0 : b.style != null && !PLAIN_BARLINES.has(b.style)) cuts.push(entry)
		}
		offset += ticksToSeconds(seg.endTick, tempoMap) - segStart
	})
	if (!bars.length) return empty
	const total = duration || offset

	// Section labels: short text at the start of the section's bar ("CHORUS")
	const texts = []
	for (const st of staves) {
		for (const tok of st.tokens) {
			const label = tok.type === 'Text' && tok.tickValue != null && sectionLabel(tok)
			if (label) texts.push({ tick: tok.tickValue, label })
		}
	}
	const labelAt = tick => texts.find(t => t.tick >= tick - 1e-6 && t.tick <= tick + 0.125 + 1e-6)?.label || ''

	let sections = [bars[0], ...cuts.filter(c => c.time > 1e-6)].map(c => ({ time: c.time, bar: c.bar, label: labelAt(c.tick) }))
	// Merge sections too short to click
	const merged = []
	for (const s of sections) {
		const prev = merged[merged.length - 1]
		if (prev && s.time - prev.time < total * MIN_SECTION_SHARE) {
			if (!prev.label) prev.label = s.label
			continue
		}
		merged.push(s)
	}
	sections = merged
	if (sections.length > MAX_SECTIONS) sections = sections.filter((s, i) => i === 0 || s.label)
	if (sections.length > MAX_SECTIONS) sections = sections.slice(0, 1)
	sections.forEach((s, i) => { s.end = i + 1 < sections.length ? sections[i + 1].time : total })

	return { bars, sections, barCount: starts[starts.length - 1].bar, duration: total, tempo: firstTempo(staves) }
}

/** Index of the last entry with .time <= t (-1 if none). */
function indexAt(list, t) {
	let lo = 0, hi = list.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (list[mid].time <= t + 1e-6) lo = mid + 1
		else hi = mid
	}
	return lo - 1
}

/** Bar and section playing at time t: { bar, section } (bar 0 / section null when there are no bars). */
export function positionAt(timeline, t) {
	const bi = indexAt(timeline.bars, t)
	const si = indexAt(timeline.sections, t)
	return { bar: bi >= 0 ? timeline.bars[bi].bar : timeline.bars[0]?.bar || 0, section: timeline.sections[Math.max(0, si)] || null }
}

/**
 * Start time of the bar n bars away from the one playing at t. Going back
 * from well inside a bar (more than `grace` seconds) first returns to its
 * start, like a media player's "previous".
 */
export function stepBars(timeline, t, n, grace = 0.4) {
	const bars = timeline.bars
	if (!bars.length) return 0
	let i = Math.max(0, indexAt(bars, t))
	if (n < 0 && t - bars[i].time > grace) n += 1
	i = Math.max(0, Math.min(bars.length - 1, i + n))
	return bars[i].time
}
