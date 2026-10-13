import { describe, test, expect } from 'bun:test'

globalThis.window = globalThis.window || { ctx: null, canvas: null }
const { decodeNwcArrayBuffer } = await import('../src/nwc.js')
const { interpret } = await import('../src/interpreter.js')

const value = (f) => (f?.value ? f.value() : f)

// Two staves in 2/4; the top one changes clef mid-bar twice (as in The
// Entertainer's endings) and changes key at a barline
const score = [
	'!NoteWorthyComposer(2.75)',
	'|AddStaff|Name:"Top"', '|Clef|Type:Treble', '|TimeSig|Signature:2/4',
	'|Note|Dur:4th|Pos:0', '|Note|Dur:4th|Pos:1', '|Bar',
	'|Note|Dur:8th|Pos:0', '|Clef|Type:Treble|OctaveShift:Octave Up', '|Note|Dur:8th|Pos:1', '|Note|Dur:4th|Pos:2', '|Bar',
	'|Key|Signature:F#', '|Note|Dur:4th|Pos:0', '|Clef|Type:Treble', '|Note|Dur:4th|Pos:1', '|Bar',
	'|Note|Dur:Half|Pos:0',
	'|AddStaff|Name:"Bottom"', '|Clef|Type:Bass', '|TimeSig|Signature:2/4',
	'|Note|Dur:4th|Pos:0', '|Note|Dur:4th|Pos:1', '|Bar',
	'|Note|Dur:4th|Pos:0', '|Note|Dur:4th|Pos:1', '|Bar',
	'|Note|Dur:4th|Pos:0', '|Note|Dur:4th|Pos:1', '|Bar',
	'|Note|Dur:Half|Pos:0',
	'!NoteWorthyComposer-End',
].join('\r\n')

function decoded() {
	const log = console.log
	console.log = () => {}
	try {
		const data = decodeNwcArrayBuffer(new TextEncoder().encode(score).buffer)
		interpret(data)
		return data
	} finally {
		console.log = log
	}
}

describe('mid-piece clef and key changes', () => {
	test('do not shift a staff against the others', () => {
		const [top, bottom] = decoded().score.staves
		const bars = (st) => st.tokens.filter(t => t.type === 'Barline').map(t => value(t.tabValue))
		expect(bars(top)).toEqual(bars(bottom))
		// The last notes start together too
		const last = (st) => value(st.tokens.filter(t => t.type === 'Note').at(-1).tabValue)
		expect(last(top)).toBe(last(bottom))
	})

	test('a mid-bar clef sits at the time of the note after it', () => {
		const [top] = decoded().score.staves
		const i = top.tokens.findIndex(t => t.type === 'Clef' && t.octave)
		expect(value(top.tokens[i].tabValue)).toBe(value(top.tokens[i + 1].tabValue))
	})
})
