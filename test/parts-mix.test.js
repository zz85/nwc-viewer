import { describe, test, expect } from 'bun:test'

globalThis.window = globalThis.window || { ctx: null, canvas: null }
const { PlaybackController } = await import('../src/audio.js')

// A controller with a fake synth: records channel volume (CC 7) and programs
function controller(staves) {
	const p = new PlaybackController()
	const sent = { volume: {}, program: {} }
	p._engine = {
		controlChange: (ch, cc, v) => { if (cc === 7) sent.volume[ch] = v },
		programChange: (ch, program) => { sent.program[ch] = program },
	}
	p._initialized = true
	p._channels = staves.map((_, si) => si)
	p._programs = staves.map((st, si) => [si, st.patchName ?? 0])
	p.setFileMuted(staves)
	return { p, sent }
}

describe('Parts mix', () => {
	const staves = [{ patchName: 40 }, { patchName: 0 }, { patchName: 0, muted: true }]

	test('mute, and turning a file-muted staff back on', () => {
		const { p } = controller(staves)
		expect([0, 1, 2].map(si => p.isHeard(si))).toEqual([true, true, false])
		p.setMute(0, true)
		expect(p.isHeard(0)).toBe(false)
		expect(p.muteOn(0)).toBe(true)
		p.setMute(2, false) // the file mutes it; the user turns it on
		expect(p.isHeard(2)).toBe(true)
		p.setMute(2, true)
		expect(p.isHeard(2)).toBe(false)
	})

	test('solo: only soloed staves are heard; their mutes come back after', () => {
		const { p } = controller(staves)
		p.setMute(0, true)
		p.setSolo(1, true)
		expect([0, 1, 2].map(si => p.isHeard(si))).toEqual([false, true, false])
		p.setSolo(0, true)
		expect(p.isHeard(0)).toBe(true) // soloed, though muted
		p.setSolo(0, false)
		p.setSolo(1, false)
		expect([0, 1, 2].map(si => p.isHeard(si))).toEqual([false, true, false])
	})

	test('a staff level scales its channel volume with the master volume', () => {
		const { p, sent } = controller(staves)
		p.setVolume(0.8)
		p.setStaffLevel(1, 0.5)
		expect(sent.volume[0]).toBe(Math.round(0.8 * 127))
		expect(sent.volume[1]).toBe(Math.round(0.8 * 0.5 * 127))
		expect(p.staffLevel(1)).toBe(0.5)
	})

	test('an instrument choice is sent at once and kept for the next load', () => {
		const { p, sent } = controller(staves)
		p.setStaffProgram(0, 73)
		expect(sent.program[0]).toBe(73)
		expect(p.programOf(0, staves)).toBe(73)
		expect(p.programOf(1, staves)).toBe(0)
	})

	test('a new score forgets the mix', () => {
		const { p } = controller(staves)
		p.setMute(0, true)
		p.setSolo(1, true)
		p.setStaffLevel(1, 0.2)
		p.setStaffProgram(0, 73)
		p.resetParts()
		expect([0, 1].map(si => p.isHeard(si))).toEqual([true, true])
		expect(p.staffLevel(1)).toBe(1)
		expect(p.programOf(0, staves)).toBe(40)
	})
})
