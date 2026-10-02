import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'

const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')

// Files whose staves legitimately disagree on barline times: different
// barline layouts per staff, deliberate offsets (echo staves), or authoring
// quirks. Every other sample must keep its visible staves in step.
const KNOWN_UNALIGNED = new Set([
	'albadag.nwc', 'beetadag.nwc', 'dannyboy.nwc', 'handacis-16.nwc', 'handmesscrv-31-lift.nwc',
	'hdn_cr05-amazd.nwc', 'hoxmas2001-2.nwc', 'lachiop43.nwc', 'liszthr2.nwc', 'mend_fingcovez-fc-parts.nwc',
	'moresuno.nwc', 'n_cavern_p.nwc', 'n_caverns1.nwc', 'ovegmont.nwc', 'penflight.nwc', 'perposui.nwc',
	'test.nwc', 'tullplay.nwc', 'tulltaab.nwc',
])

const files = [
	...readdirSync('samples').filter(f => f.endsWith('.nwc')).map(f => 'samples/' + f),
	...readdirSync('nwcs').filter(f => f.endsWith('.nwc')).map(f => 'nwcs/' + f),
].filter(f => !KNOWN_UNALIGNED.has(f.split('/').pop()))

function barTimes(stave) {
	return stave.tokens.filter(t => t.type === 'Barline').map(t => +t.tickValue)
}

describe('Cross-staff timing', () => {
	for (const file of files) {
		test(`${file}: barlines fall at the same time on every visible staff`, () => {
			const log = console.log
			console.log = () => {}
			let data
			try {
				data = decodeNwcArrayBuffer(readFileSync(file))
				interpret(data)
			} finally {
				console.log = log
			}
			const staves = data.score.staves.filter(s => !s.hidden)
			const ref = barTimes(staves[0])
			for (const stave of staves.slice(1)) {
				const bars = barTimes(stave)
				const n = Math.min(bars.length, ref.length)
				for (let k = 0; k < n; k++) {
					if (Math.abs(bars[k] - ref[k]) > 1e-6) {
						throw new Error(`${stave.staff_name}: barline ${k + 1} at ${bars[k]} vs ${ref[k]}`)
					}
				}
			}
			expect(staves.length).toBeGreaterThan(0)
		})
	}
})
