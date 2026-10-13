#!/usr/bin/env bun
// Check a score the way Notably reads it: bun scripts/compose/check-score.js <file> [--clash 8] [--all]
//
// Loads the file with the viewer's own parser, interpreter and playback note
// builder, then reports:
//   - structure: staves, bars, and bars that don't line up across staves
//     (in playback time and in display time)
//   - range: notes outside the instrument's usual range (by GM patch)
//   - clashes: semitone clashes (minor 2nd / major 7th / minor 9th) between
//     notes sounding together for at least an 8th (--clash 16 for a 16th),
//     within a part or between parts. Passing tones are short, so a sustained
//     semitone clash is almost always a wrong note or a bad voicing.
// Exits 1 if the structure is broken.

import { readFileSync } from 'fs'

const args = process.argv.slice(2)
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--clash')
if (!file) {
	console.error('usage: check-score.js <file.nwctxt|file.nwc> [--clash 8|16|4] [--all]')
	process.exit(2)
}
const clashArg = args.indexOf('--clash')
const clashUnit = clashArg >= 0 ? +args[clashArg + 1] : 8
const showAll = args.includes('--all')

// The viewer modules expect a browser; keep their logging quiet
globalThis.window = globalThis.window || { ctx: null, canvas: null }
const log = console.log
console.log = console.warn = () => {}
const root = new URL('../../', import.meta.url).pathname
const { decodeNwcArrayBuffer } = await import(root + 'src/nwc.js')
const { interpret } = await import(root + 'src/interpreter.js')
const { buildNoteEvents } = await import(root + 'src/audio.js')

const bytes = readFileSync(file)
const data = decodeNwcArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
interpret(data)
const { notes } = buildNoteEvents(data)
console.log = log

const value = (f) => (f?.value ? f.value() : f ?? 0)
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const nameOf = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1)
const staves = data.score.staves
let broken = false

// --- Structure -------------------------------------------------------------------
const barlines = staves.map(s => s.tokens.filter(t => t.type === 'Barline'))
log(`${data.info?.title || file}: ${staves.length} staves, ${Math.max(...barlines.map(b => b.length)) + 1} bars`)
const counts = new Set(barlines.map(b => b.length))
if (counts.size > 1) {
	broken = true
	log(`  ✗ staves have different bar counts: ${staves.map((s, i) => `${s.staff_name}=${barlines[i].length + 1}`).join(', ')}`)
}
let misaligned = 0
for (let k = 0; k < Math.min(...barlines.map(b => b.length)); k++) {
	const ticks = barlines.map(b => value(b[k].tickValue))
	const tabs = barlines.map(b => value(b[k].tabValue))
	if (ticks.some(t => Math.abs(t - ticks[0]) > 1e-9) || tabs.some(t => Math.abs(t - tabs[0]) > 1e-9)) {
		if (misaligned++ < 5) log(`  ✗ barline ${k + 1} out of line: ticks ${ticks.join(' / ')}, display ${tabs.join(' / ')}`)
		broken = true
	}
}
if (!misaligned && counts.size === 1) log('  ✓ every staff has the same bars, aligned')

// Bar.beat label from playback time (first staff's barlines)
const barStarts = [0, ...barlines[0].map(t => value(t.tickValue))]
const timeSig = staves[0].tokens.find(t => t.type === 'TimeSignature')
const beatLen = 1 / (timeSig?.beat || 4)
function where(tick) {
	let b = 0
	while (b + 1 < barStarts.length && barStarts[b + 1] <= tick + 1e-9) b++
	return `${b + 1}.${Math.floor((tick - barStarts[b]) / beatLen + 1e-9) + 1}`
}

// --- Ranges (sounding pitch, by GM patch) --------------------------------------------
const RANGES = {
	0: ['Piano', 21, 108], 6: ['Harpsichord', 29, 89], 19: ['Organ', 36, 96], 24: ['Guitar', 40, 83], 25: ['Guitar', 40, 83],
	40: ['Violin', 55, 105], 41: ['Viola', 48, 88], 42: ['Cello', 36, 81], 43: ['Double bass', 28, 67], 46: ['Harp', 24, 103],
	56: ['Trumpet', 54, 86], 57: ['Trombone', 40, 77], 58: ['Tuba', 26, 65], 60: ['Horn', 35, 77],
	64: ['Soprano sax', 56, 88], 65: ['Alto sax', 49, 81], 66: ['Tenor sax', 44, 76], 67: ['Baritone sax', 36, 69],
	68: ['Oboe', 58, 93], 69: ['English horn', 52, 84], 70: ['Bassoon', 34, 76], 71: ['Clarinet', 50, 94], 72: ['Piccolo', 74, 108],
	73: ['Flute', 60, 96], 74: ['Recorder', 72, 98],
}
staves.forEach((s, si) => {
	const ns = notes.filter(e => e.staffIndex === si)
	if (!ns.length) return
	const lo = Math.min(...ns.map(e => e.midi)), hi = Math.max(...ns.map(e => e.midi))
	const range = RANGES[s.patchName]
	let line = `  ${s.staff_name}: ${ns.length} notes, ${nameOf(lo)}–${nameOf(hi)}`
	if (range) {
		const out = ns.filter(e => e.midi < range[1] || e.midi > range[2])
		line += out.length
			? ` ✗ ${out.length} outside the ${range[0]}'s ${nameOf(range[1])}–${nameOf(range[2])}, e.g. ${nameOf(out[0].midi)} at ${where(value(out[0].token.tickValue))}`
			: ` (within the ${range[0]}'s ${nameOf(range[1])}–${nameOf(range[2])})`
	}
	log(line)
})

// --- Clashes ----------------------------------------------------------------------------
const minOverlap = 1 / clashUnit
const sounding = notes
	.filter(e => !e.token?.grace)
	.map(e => {
		const start = value(e.token.tickValue)
		return { midi: e.midi, staff: e.staffIndex, start, end: start + value(e.token.durValue) }
	})
	.sort((a, b) => a.start - b.start)
const clashes = new Map()
for (let i = 0; i < sounding.length; i++) {
	const a = sounding[i]
	for (let j = i + 1; j < sounding.length && sounding[j].start < a.end; j++) {
		const b = sounding[j]
		const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start)
		const ic = Math.abs(a.midi - b.midi) % 12
		if (overlap + 1e-9 < minOverlap || (ic !== 1 && ic !== 11)) continue
		const at = where(Math.max(a.start, b.start))
		const [lo, hi] = a.midi < b.midi ? [a, b] : [b, a]
		const parts = lo.staff === hi.staff ? staves[lo.staff].staff_name : `${staves[hi.staff].staff_name} / ${staves[lo.staff].staff_name}`
		const key = `${at} ${nameOf(hi.midi)}–${nameOf(lo.midi)} ${parts}`
		clashes.set(key, (clashes.get(key) || 0) + 1)
	}
}
if (!clashes.size) log(`  ✓ no semitone clashes lasting an ${clashUnit === 8 ? '8th' : '1/' + clashUnit} or more`)
else {
	log(`  ! ${clashes.size} semitone clashes lasting 1/${clashUnit} or more (bar.beat, upper–lower, parts):`)
	;[...clashes.keys()].slice(0, showAll ? Infinity : 40).forEach(k => log('    ' + k))
	if (!showAll && clashes.size > 40) log(`    … ${clashes.size - 40} more (--all)`)
}

process.exit(broken ? 1 : 0)
