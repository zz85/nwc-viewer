import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

const { convertNWCToMusicXML } = await import('../lib/nwc2xml/index.js')

// Beam values per part and voice, in document order. Layered staves merge
// into one part with several voices whose beam groups interleave.
function beamSequences(xml) {
	const seqs = []
	for (const part of xml.split('<part id=').slice(1)) {
		const byVoice = {}
		for (const note of part.split('<note').slice(1)) {
			const beam = note.match(/<beam number="1">\s*(\w+)/)
			// Chord members repeat their chord's beam; count each chord once
			if (!beam || /<chord\s*\/>/.test(note)) continue
			const voice = (note.match(/<voice>\s*(\d+)/) || [])[1] || '1'
			;(byVoice[voice] ??= []).push(beam[1])
		}
		seqs.push(...Object.values(byVoice))
	}
	return seqs
}

describe('NWC → MusicXML beams', () => {
	for (const file of ['nwcs/bachairg.nwc', 'samples/WeThreeKingsOfOrientAre.nwc']) {
		test(`${file}: every beam group is begin, continue*, end`, () => {
			const orig = console.log
			console.log = () => {}
			const xml = convertNWCToMusicXML(readFileSync(file))
			console.log = orig
			const seqs = beamSequences(xml)
			expect(seqs.flat().length).toBeGreaterThan(0)
			for (const seq of seqs) {
				let open = false
				for (const t of seq) {
					if (t === 'begin') { expect(open).toBe(false); open = true }
					else if (t === 'continue') expect(open).toBe(true)
					else if (t === 'end') { expect(open).toBe(true); open = false }
				}
				expect(open).toBe(false)
			}
		})
	}
})
