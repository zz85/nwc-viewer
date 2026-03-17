/**
 * Unit tests for the MusicXML importer.
 *
 * Tests the core conversion logic: pitch parsing, clef mapping, duration,
 * key signatures, barlines, chord assembly, direction parsing, and format detection.
 *
 * Pure-logic functions are re-implemented locally to avoid browser API
 * dependencies (DOMParser, DecompressionStream). Integration tests that
 * parse real .musicxml files are in a separate section using xmldom.
 */

import { describe, it, expect } from 'bun:test'
import { DOMParser } from '@xmldom/xmldom'
import Fraction from '../src/fraction.js'
import {
	DURATION_MAP, DURATION_FRACTIONS,
	CLEF_PITCH_OFFSETS, NOTE_INDEX, ACCIDENTAL_STRINGS,
	computePosition, buildKeySigToken,
	makeDurationFraction, setTiming, makeBarline, makeWholeBarRest,
	xmlText, xmlInt, xmlFloat, directChildren, toArray,
} from '../src/music-import-utils.js'

// ---------------------------------------------------------------------------
// MusicXML-specific constants (duplicated from musicxml-import.js)
// ---------------------------------------------------------------------------

const CLEF_SIGN_MAP = {
	'G2': 'treble',
	'F4': 'bass',
	'C3': 'alto',
	'C4': 'tenor',
	'C1': 'alto',
	'C2': 'alto',
	'C5': 'bass',
	'percussion': 'percussion',
}

const ALTER_TO_ACCIDENTAL = { '-2': 'v', '-1': 'b', '0': '', '1': '#', '2': 'x' }

// ---------------------------------------------------------------------------
// Test helper: parse XML string
// ---------------------------------------------------------------------------

function parseXml(xmlStr) {
	const parser = new DOMParser()
	return parser.parseFromString(xmlStr, 'text/xml')
}

function getEl(xmlStr) {
	return parseXml(xmlStr).documentElement
}

// ===================================================================
// Pitch Parsing
// ===================================================================

describe('MusicXML Pitch Parsing', () => {
	it('parses C4 natural', () => {
		const step = 'C', alter = 0, octave = 4
		const position = computePosition(step, octave, 'treble', 0)
		const accidental = ALTER_TO_ACCIDENTAL[String(alter)]
		expect(step).toBe('C')
		expect(octave).toBe(4)
		expect(accidental).toBe('')
		expect(position).toBe(-6)  // C4 on treble clef
	})

	it('parses C#4 (alter=1)', () => {
		const step = 'C', alter = 1, octave = 4
		const accidental = ALTER_TO_ACCIDENTAL[String(alter)]
		expect(accidental).toBe('#')
		const position = computePosition(step, octave, 'treble', 0)
		expect(position).toBe(-6)  // same staff position as C4
	})

	it('parses Bb3 (alter=-1)', () => {
		const step = 'B', alter = -1, octave = 3
		const accidental = ALTER_TO_ACCIDENTAL[String(alter)]
		expect(accidental).toBe('b')
		const position = computePosition(step, octave, 'treble', 0)
		// B3 = diatonic 27, treble offset = 34, pos = 27-34 = -7
		expect(position).toBe(-7)
	})

	it('parses F##5 (alter=2)', () => {
		const step = 'F', alter = 2, octave = 5
		const accidental = ALTER_TO_ACCIDENTAL[String(alter)]
		expect(accidental).toBe('x')
		const position = computePosition(step, octave, 'treble', 0)
		// F5 = diatonic 38, treble offset = 34, pos = 38-34 = 4
		expect(position).toBe(4)
	})

	it('parses Ebb2 (alter=-2)', () => {
		const step = 'E', alter = -2, octave = 2
		const accidental = ALTER_TO_ACCIDENTAL[String(alter)]
		expect(accidental).toBe('v')
		const position = computePosition(step, octave, 'treble', 0)
		// E2 = diatonic 16, treble offset = 34, pos = 16-34 = -18
		expect(position).toBe(-18)
	})

	it('computes position on bass clef', () => {
		// C3 on bass clef should be position 1 (one ledger line above middle)
		const position = computePosition('C', 3, 'bass', 0)
		expect(position).toBe(-1)  // C3 = diatonic 21, bass offset = 22, pos = -1
	})

	it('computes position on alto clef', () => {
		// C4 on alto clef: middle of staff = position 0
		const position = computePosition('C', 4, 'alto', 0)
		expect(position).toBe(0)
	})

	it('computes position on tenor clef', () => {
		// A3 on tenor clef: middle of staff
		const position = computePosition('A', 3, 'tenor', 0)
		expect(position).toBe(0)
	})
})

// ===================================================================
// Clef Mapping
// ===================================================================

describe('MusicXML Clef Mapping', () => {
	it('maps G line 2 to treble', () => {
		expect(CLEF_SIGN_MAP['G2']).toBe('treble')
	})

	it('maps F line 4 to bass', () => {
		expect(CLEF_SIGN_MAP['F4']).toBe('bass')
	})

	it('maps C line 3 to alto', () => {
		expect(CLEF_SIGN_MAP['C3']).toBe('alto')
	})

	it('maps C line 4 to tenor', () => {
		expect(CLEF_SIGN_MAP['C4']).toBe('tenor')
	})

	it('maps percussion to percussion', () => {
		expect(CLEF_SIGN_MAP['percussion']).toBe('percussion')
	})

	it('maps octave-change clef (8va)', () => {
		// From MusicXML: <clef-octave-change>1</clef-octave-change>
		// Our code maps this to octave=1
		const octChange = 1
		const octave = octChange === 1 ? 1 : octChange === -1 ? 2 : 0
		expect(octave).toBe(1)
	})

	it('maps octave-change clef (8vb)', () => {
		const octChange = -1
		const octave = octChange === 1 ? 1 : octChange === -1 ? 2 : 0
		expect(octave).toBe(2)
	})
})

// ===================================================================
// Duration Parsing
// ===================================================================

describe('MusicXML Duration Parsing', () => {
	it('maps type strings to numeric durations', () => {
		expect(DURATION_MAP['whole']).toBe(1)
		expect(DURATION_MAP['half']).toBe(2)
		expect(DURATION_MAP['quarter']).toBe(4)
		expect(DURATION_MAP['eighth']).toBe(8)
		expect(DURATION_MAP['16th']).toBe(16)
		expect(DURATION_MAP['32nd']).toBe(32)
	})

	it('creates undotted fraction', () => {
		const frac = makeDurationFraction('quarter', 0)
		expect(frac.value()).toBe(0.25)
	})

	it('creates single-dotted fraction', () => {
		const frac = makeDurationFraction('quarter', 1)
		expect(frac.value()).toBe(0.375)  // 3/8
	})

	it('creates double-dotted fraction', () => {
		const frac = makeDurationFraction('quarter', 2)
		expect(frac.value()).toBe(0.4375)  // 7/16
	})

	it('handles whole note duration', () => {
		const frac = makeDurationFraction('whole', 0)
		expect(frac.value()).toBe(1.0)
	})

	it('handles unknown type gracefully', () => {
		const frac = makeDurationFraction('bogus', 0)
		expect(frac.value()).toBe(0.25)  // defaults to quarter
	})
})

// ===================================================================
// Key Signature
// ===================================================================

describe('MusicXML Key Signature', () => {
	it('fifths=0 → C major', () => {
		const token = buildKeySigToken(0, 'treble', 0)
		expect(token.key).toBe('C')
		expect(token.sharps).toEqual([])
		expect(token.flats).toEqual([])
	})

	it('fifths=1 → G major (1 sharp)', () => {
		const token = buildKeySigToken(1, 'treble', 0)
		expect(token.key).toBe('G')
		expect(token.sharps).toEqual(['F'])
	})

	it('fifths=-2 → Bb major (2 flats)', () => {
		const token = buildKeySigToken(-2, 'treble', 0)
		expect(token.key).toBe('Bb')
		expect(token.flats).toEqual(['B', 'E'])
	})

	it('fifths=7 → C# major (7 sharps)', () => {
		const token = buildKeySigToken(7, 'treble', 0)
		expect(token.key).toBe('C#')
		expect(token.sharps.length).toBe(7)
	})

	it('fifths=-7 → Cb major (7 flats)', () => {
		const token = buildKeySigToken(-7, 'treble', 0)
		expect(token.key).toBe('Cb')
		expect(token.flats.length).toBe(7)
	})
})

// ===================================================================
// Barline Mapping
// ===================================================================

describe('MusicXML Barline Mapping', () => {
	it('creates a basic barline', () => {
		const tick = new Fraction(4, 4)
		const tab = new Fraction(4, 4)
		const token = makeBarline(0, tick, tab)
		expect(token.type).toBe('Barline')
		expect(token.barline).toBe(0)
		expect(token.tickValue).toBe(1.0)
	})

	it('creates a double barline', () => {
		const tick = new Fraction(0, 1)
		const tab = new Fraction(0, 1)
		const token = makeBarline(1, tick, tab)
		expect(token.barline).toBe(1)
	})

	it('creates a section close barline', () => {
		const tick = new Fraction(0, 1)
		const tab = new Fraction(0, 1)
		const token = makeBarline(3, tick, tab)
		expect(token.barline).toBe(3)
	})

	it('creates a repeat open barline', () => {
		const tick = new Fraction(0, 1)
		const tab = new Fraction(0, 1)
		const token = makeBarline(4, tick, tab)
		expect(token.barline).toBe(4)
	})

	it('creates a repeat close barline', () => {
		const tick = new Fraction(0, 1)
		const tab = new Fraction(0, 1)
		const token = makeBarline(5, tick, tab)
		expect(token.barline).toBe(5)
	})
})

// ===================================================================
// XML Helper Functions
// ===================================================================

describe('XML Helper Functions', () => {
	it('xmlText extracts text content', () => {
		const el = getEl('<root><title>Hello World</title></root>')
		expect(xmlText(el, 'title')).toBe('Hello World')
	})

	it('xmlText returns empty string for missing element', () => {
		const el = getEl('<root><other>X</other></root>')
		expect(xmlText(el, 'title')).toBe('')
	})

	it('xmlInt parses integer', () => {
		const el = getEl('<root><fifths>-3</fifths></root>')
		expect(xmlInt(el, 'fifths', 0)).toBe(-3)
	})

	it('xmlInt returns default for missing element', () => {
		const el = getEl('<root></root>')
		expect(xmlInt(el, 'fifths', 99)).toBe(99)
	})

	it('directChildren filters by tag name', () => {
		const el = getEl('<root><a/><b/><a/><c><a/></c></root>')
		const result = directChildren(el, 'a')
		expect(result.length).toBe(2)  // doesn't include nested <a/>
	})
})

// ===================================================================
// Timing Functions
// ===================================================================

describe('Timing Functions', () => {
	it('setTiming advances counters', () => {
		const tick = new Fraction(0, 1)
		const tab = new Fraction(0, 1)
		const token = {}
		const dur = new Fraction(1, 4)
		setTiming(token, dur, tick, tab)

		expect(token.tickValue).toBe(0)
		expect(token.tabValue).toBe(0)
		expect(token.tabUntilValue).toBe(0.25)
		expect(tick.value()).toBe(0.25)
	})

	it('makeWholeBarRest uses time signature duration', () => {
		const tick = new Fraction(0, 1)
		const tab = new Fraction(0, 1)
		const token = makeWholeBarRest(3, 4, tick, tab)

		expect(token.type).toBe('Rest')
		expect(token.duration).toBe(1)
		expect(token.tickValue).toBe(0)
		expect(token.tabUntilValue).toBe(0.75)  // 3/4 measure
	})
})

// ===================================================================
// Format Detection (testing logic, not the actual function since it
// needs ArrayBuffer which is straightforward)
// ===================================================================

describe('MusicXML Format Detection Logic', () => {
	it('detects <score-partwise> as MusicXML', () => {
		const head = '<?xml version="1.0"?><score-partwise version="4.0">'
		expect(head.includes('<score-partwise')).toBe(true)
	})

	it('detects <score-timewise> as MusicXML', () => {
		const head = '<?xml version="1.0"?><score-timewise version="4.0">'
		expect(head.includes('<score-timewise')).toBe(true)
	})

	it('rejects <museScore> as not MusicXML', () => {
		const head = '<?xml version="1.0"?><museScore version="3.02">'
		const isMusicXML = head.includes('<score-partwise') || head.includes('<score-timewise')
		expect(isMusicXML).toBe(false)
	})

	it('identifies .musicxml extension', () => {
		const filename = 'test.musicxml'
		expect(filename.toLowerCase().endsWith('.musicxml')).toBe(true)
	})

	it('identifies .mxl extension', () => {
		const filename = 'test.mxl'
		expect(filename.toLowerCase().endsWith('.mxl')).toBe(true)
	})
})

// ===================================================================
// Chord Assembly
// ===================================================================

describe('Chord Assembly', () => {
	it('single note stays as Note type', () => {
		// Simulate a single note
		const token = { type: 'Note', position: 0, name: 'C', octave: 4, duration: 4 }
		expect(token.type).toBe('Note')
	})

	it('second note with chord converts to Chord type', () => {
		// Simulate the chord assembly logic
		const prevToken = {
			type: 'Note', position: -6, name: 'C', octave: 4,
			accidental: '', accidentalValue: undefined,
			duration: 4, dots: 0, tie: 0, tieEnd: 0,
			slur: 0, beam: 0, stem: 0, triplet: 0,
			staccato: 0, accent: 0, grace: 0, tenuto: 0,
			lyricSyllable: 0,
		}

		const newNote = {
			position: -3, name: 'E', octave: 4,
			accidental: '', accidentalValue: undefined,
			duration: 4, dots: 0, tie: 0, tieEnd: 0,
			slur: 0, beam: 0, stem: 0, triplet: 0,
			staccato: 0, accent: 0, grace: 0, tenuto: 0,
		}

		// This is the chord assembly logic from handleNote
		const existingNote = { ...prevToken }
		delete existingNote.lyricSyllable
		delete existingNote.type

		prevToken.type = 'Chord'
		prevToken.notes = [existingNote, newNote]
		prevToken.notes.sort((a, b) => a.position - b.position)
		prevToken.chords = prevToken.notes.length

		const lowest = prevToken.notes[0]
		prevToken.position = lowest.position
		prevToken.name = lowest.name

		expect(prevToken.type).toBe('Chord')
		expect(prevToken.chords).toBe(2)
		expect(prevToken.notes[0].name).toBe('C')  // C4 lower
		expect(prevToken.notes[1].name).toBe('E')  // E4 higher
	})

	it('third note adds to existing Chord', () => {
		const chord = {
			type: 'Chord',
			position: -6, name: 'C', octave: 4,
			accidental: '', accidentalValue: undefined,
			notes: [
				{ position: -6, name: 'C', octave: 4 },
				{ position: -3, name: 'E', octave: 4 },
			],
			chords: 2,
		}

		const newNote = { position: -1, name: 'G', octave: 4 }
		chord.notes.push(newNote)
		chord.notes.sort((a, b) => a.position - b.position)
		chord.chords = chord.notes.length

		expect(chord.chords).toBe(3)
		expect(chord.notes[2].name).toBe('G')
	})

	it('sorts chord notes by position (low to high)', () => {
		const notes = [
			{ position: 2, name: 'G' },
			{ position: -6, name: 'C' },
			{ position: -3, name: 'E' },
		]
		notes.sort((a, b) => a.position - b.position)
		expect(notes[0].name).toBe('C')
		expect(notes[1].name).toBe('E')
		expect(notes[2].name).toBe('G')
	})
})

// ===================================================================
// Direction Parsing (unit tests for the mapping logic)
// ===================================================================

describe('Direction Mapping', () => {
	it('maps dynamics tag names to style numbers', () => {
		const DYNAMIC_STYLE_MAP = {
			'ppp': 0, 'pp': 1, 'p': 2, 'mp': 3,
			'mf': 4, 'f': 5, 'ff': 6, 'fff': 7,
		}
		expect(DYNAMIC_STYLE_MAP['mf']).toBe(4)
		expect(DYNAMIC_STYLE_MAP['ff']).toBe(6)
		expect(DYNAMIC_STYLE_MAP['p']).toBe(2)
	})

	it('maps beat-unit to duration number', () => {
		expect(DURATION_MAP['quarter']).toBe(4)
		expect(DURATION_MAP['eighth']).toBe(8)
		expect(DURATION_MAP['half']).toBe(2)
	})

	it('detects flow direction text patterns', () => {
		expect(/d\.?\s*c\.?\s*al\s*coda/i.test('D.C. al Coda')).toBe(true)
		expect(/d\.?\s*s\.?\s*al\s*fine/i.test('D.S. al Fine')).toBe(true)
		expect(/d\.?\s*c\.?\s*al\s*fine/i.test('D.C. al Fine')).toBe(true)
	})
})

// ===================================================================
// Integration: Full MusicXML Parse (using xmldom for Bun)
// ===================================================================

// Provide xmldom DOMParser globally for the parser module
globalThis.DOMParser = globalThis.DOMParser || DOMParser

describe('Full MusicXML Parse — Simple Scale', () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Test Scale</work-title></work>
  <identification>
    <creator type="composer">Test Composer</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`

	// We need to import the parser function — but it uses browser DOMParser and zip.js
	// So we use a patched import approach similar to musescore-parser tests.
	// For now, test via direct DOM manipulation matching the parser's logic.

	it('parses score header', () => {
		const doc = parseXml(xml)
		const root = doc.documentElement
		expect(root.tagName).toBe('score-partwise')
		expect(xmlText(root, 'work-title')).toBe('Test Scale')

		const idEl = root.getElementsByTagName('identification')[0]
		const creators = idEl.getElementsByTagName('creator')
		let composer = ''
		for (let i = 0; i < creators.length; i++) {
			if (creators[i].getAttribute('type') === 'composer') {
				composer = creators[i].textContent.trim()
			}
		}
		expect(composer).toBe('Test Composer')
	})

	it('parses part list', () => {
		const doc = parseXml(xml)
		const scorePartEls = doc.getElementsByTagName('score-part')
		expect(scorePartEls.length).toBe(1)
		expect(scorePartEls[0].getAttribute('id')).toBe('P1')
		expect(xmlText(scorePartEls[0], 'part-name')).toBe('Piano')
	})

	it('parses attributes (clef, key, time)', () => {
		const doc = parseXml(xml)
		const attrs = doc.getElementsByTagName('attributes')[0]
		expect(xmlInt(attrs, 'divisions', 1)).toBe(1)

		const keyEl = attrs.getElementsByTagName('key')[0]
		expect(xmlInt(keyEl, 'fifths', 0)).toBe(0)

		const timeEl = attrs.getElementsByTagName('time')[0]
		expect(xmlInt(timeEl, 'beats', 4)).toBe(4)
		expect(xmlInt(timeEl, 'beat-type', 4)).toBe(4)

		const clefEl = attrs.getElementsByTagName('clef')[0]
		expect(xmlText(clefEl, 'sign')).toBe('G')
		expect(xmlText(clefEl, 'line')).toBe('2')
	})

	it('parses four quarter notes', () => {
		const doc = parseXml(xml)
		const noteEls = doc.getElementsByTagName('note')
		expect(noteEls.length).toBe(4)

		const pitches = []
		for (let i = 0; i < noteEls.length; i++) {
			const pitchEl = noteEls[i].getElementsByTagName('pitch')[0]
			pitches.push(xmlText(pitchEl, 'step'))
		}
		expect(pitches).toEqual(['C', 'D', 'E', 'F'])
	})
})

describe('Full MusicXML Parse — Chord and Tie', () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
        <tie type="start"/>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
        <tie type="stop"/>
      </note>
    </measure>
  </part>
</score-partwise>`

	it('detects chord member via <chord/>', () => {
		const doc = parseXml(xml)
		const noteEls = doc.getElementsByTagName('note')
		expect(noteEls.length).toBe(3)

		// Second note has <chord/>
		const hasChord = noteEls[1].getElementsByTagName('chord').length > 0
		expect(hasChord).toBe(true)

		// First and third don't
		expect(noteEls[0].getElementsByTagName('chord').length).toBe(0)
		expect(noteEls[2].getElementsByTagName('chord').length).toBe(0)
	})

	it('detects ties', () => {
		const doc = parseXml(xml)
		const noteEls = doc.getElementsByTagName('note')

		// First note: tie start
		const tie1 = noteEls[0].getElementsByTagName('tie')
		let start1 = false, stop1 = false
		for (let i = 0; i < tie1.length; i++) {
			if (tie1[i].getAttribute('type') === 'start') start1 = true
			if (tie1[i].getAttribute('type') === 'stop') stop1 = true
		}
		expect(start1).toBe(true)
		expect(stop1).toBe(false)

		// Third note: tie stop
		const tie3 = noteEls[2].getElementsByTagName('tie')
		let start3 = false, stop3 = false
		for (let i = 0; i < tie3.length; i++) {
			if (tie3[i].getAttribute('type') === 'start') start3 = true
			if (tie3[i].getAttribute('type') === 'stop') stop3 = true
		}
		expect(start3).toBe(false)
		expect(stop3).toBe(true)
	})
})

describe('Full MusicXML Parse — Dynamics and Tempo', () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction>
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>120</per-minute>
          </metronome>
        </direction-type>
        <sound tempo="120"/>
      </direction>
      <direction>
        <direction-type>
          <dynamics><mf/></dynamics>
        </direction-type>
      </direction>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>`

	it('parses metronome tempo', () => {
		const doc = parseXml(xml)
		const metronome = doc.getElementsByTagName('metronome')[0]
		expect(xmlText(metronome, 'beat-unit')).toBe('quarter')
		expect(xmlText(metronome, 'per-minute')).toBe('120')
	})

	it('parses dynamics', () => {
		const doc = parseXml(xml)
		const dynamics = doc.getElementsByTagName('dynamics')[0]
		const dynChild = dynamics.childNodes
		let dynName = ''
		for (let i = 0; i < dynChild.length; i++) {
			if (dynChild[i].nodeType === 1) {
				dynName = dynChild[i].tagName
				break
			}
		}
		expect(dynName).toBe('mf')
	})

	it('parses sound tempo attribute', () => {
		const doc = parseXml(xml)
		const sound = doc.getElementsByTagName('sound')[0]
		expect(sound.getAttribute('tempo')).toBe('120')
	})
})

describe('Full MusicXML Parse — Articulations', () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <notations>
          <articulations>
            <staccato/>
            <accent/>
          </articulations>
        </notations>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <notations>
          <fermata/>
        </notations>
      </note>
    </measure>
  </part>
</score-partwise>`

	it('detects staccato and accent', () => {
		const doc = parseXml(xml)
		const noteEls = doc.getElementsByTagName('note')
		const notations = noteEls[0].getElementsByTagName('notations')[0]
		const arts = notations.getElementsByTagName('articulations')[0]
		expect(arts.getElementsByTagName('staccato').length).toBe(1)
		expect(arts.getElementsByTagName('accent').length).toBe(1)
	})

	it('detects fermata', () => {
		const doc = parseXml(xml)
		const noteEls = doc.getElementsByTagName('note')
		const notations = noteEls[1].getElementsByTagName('notations')[0]
		expect(notations.getElementsByTagName('fermata').length).toBe(1)
	})
})

// ===================================================================
// End-to-End: Import via the actual parser (patched for Bun)
// ===================================================================

describe('End-to-End MusicXML Import', () => {
	// Dynamically import the parser with mocked zip.js
	let parseMusicXML

	const setup = async () => {
		if (parseMusicXML) return

		const { writeFileSync, unlinkSync } = await import('fs')
		const { join } = await import('path')
		const { tmpdir } = await import('os')
		const { readFileSync } = await import('fs')

		// Create a mock zip.js for Bun
		const tmpZip = join(tmpdir(), `_bun_zip_mxml_${Date.now()}.js`)
		const fflateModulePath = join(import.meta.dir, '../node_modules/fflate/esm/browser.js')
		writeFileSync(tmpZip, `import { unzipSync } from '${fflateModulePath}';
export async function unzip(buffer) {
  const e = unzipSync(new Uint8Array(buffer));
  const m = new Map();
  for (const n of Object.keys(e)) m.set(n, e[n]);
  return m;
}`)

		// Patch the parser source
		const tmpParser = join(tmpdir(), `_bun_mxml_parser_${Date.now()}.js`)
		let parserCode = readFileSync(join(import.meta.dir, '../src/musicxml-import.js'), 'utf-8')
		parserCode = parserCode.replace(`from './zip.js'`, `from '${tmpZip}'`)
		parserCode = parserCode.replace(`from './fraction.js'`, `from '${join(import.meta.dir, '../src/fraction.js')}'`)
		parserCode = parserCode.replace(`from './music-import-utils.js'`, `from '${join(import.meta.dir, '../src/music-import-utils.js')}'`)
		// Fix music-import-utils.js Fraction import path too
		let utilsCode = readFileSync(join(import.meta.dir, '../src/music-import-utils.js'), 'utf-8')
		const tmpUtils = join(tmpdir(), `_bun_import_utils_${Date.now()}.js`)
		utilsCode = utilsCode.replace(`from './fraction.js'`, `from '${join(import.meta.dir, '../src/fraction.js')}'`)
		writeFileSync(tmpUtils, utilsCode)
		parserCode = parserCode.replace(new RegExp(`from '${join(import.meta.dir, '../src/music-import-utils.js').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `from '${tmpUtils}'`)
		// xmldom doesn't have querySelector — replace ternary with direct getElementsByTagName
		parserCode = parserCode.replace(
			/const errorEl = doc\.querySelector\s*\?\s*doc\.querySelector\('parsererror'\)\s*:\s*doc\.getElementsByTagName\('parsererror'\)\[0\]/,
			`const errorEl = doc.getElementsByTagName('parsererror')[0]`
		)
		writeFileSync(tmpParser, parserCode)

		try {
			const mod = await import(tmpParser)
			parseMusicXML = mod.parseMusicXML
		} catch (e) {
			console.error('Failed to load patched MusicXML parser:', e)
			throw e
		}

		// Cleanup on exit
		process.on('exit', () => {
			try { unlinkSync(tmpZip) } catch {}
			try { unlinkSync(tmpParser) } catch {}
			try { unlinkSync(tmpUtils) } catch {}
		})
	}

	it('parses a simple C major scale', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Scale Test</work-title></work>
  <identification><creator type="composer">Tester</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')

		expect(result._source).toBe('musicxml')
		expect(result.info.title).toBe('Scale Test')
		expect(result.info.author).toBe('Tester')
		expect(result.score.staves.length).toBe(1)

		const staff = result.score.staves[0]
		expect(staff.staff_name).toBe('Piano')

		const notes = staff.tokens.filter(t => t.type === 'Note')
		expect(notes.length).toBe(4)
		expect(notes.map(n => n.name)).toEqual(['C', 'D', 'E', 'F'])
		expect(notes.map(n => n.octave)).toEqual([4, 4, 4, 4])
		expect(notes.map(n => n.duration)).toEqual([4, 4, 4, 4])

		// Verify timing advances correctly
		expect(notes[0].tickValue).toBe(0)
		expect(notes[1].tickValue).toBe(0.25)
		expect(notes[2].tickValue).toBe(0.5)
		expect(notes[3].tickValue).toBe(0.75)

		// Verify initial tokens exist
		const clef = staff.tokens.find(t => t.type === 'Clef')
		expect(clef.clef).toBe('treble')

		const keySig = staff.tokens.find(t => t.type === 'KeySignature')
		expect(keySig.key).toBe('C')

		const timeSig = staff.tokens.find(t => t.type === 'TimeSignature')
		expect(timeSig.signature).toBe('4/4')
	})

	it('parses chords correctly', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const staff = result.score.staves[0]

		const chords = staff.tokens.filter(t => t.type === 'Chord')
		expect(chords.length).toBe(1)

		const chord = chords[0]
		expect(chord.chords).toBe(3)
		expect(chord.notes.length).toBe(3)
		// Sorted by position (low to high)
		expect(chord.notes[0].name).toBe('C')
		expect(chord.notes[1].name).toBe('E')
		expect(chord.notes[2].name).toBe('G')
	})

	it('parses ties correctly', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration><type>half</type>
        <tie type="start"/>
      </note>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration><type>half</type>
        <tie type="stop"/>
      </note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const notes = result.score.staves[0].tokens.filter(t => t.type === 'Note')
		expect(notes.length).toBe(2)
		expect(notes[0].tie).toBe(1)
		expect(notes[0].tieEnd).toBe(0)
		expect(notes[1].tie).toBe(0)
		expect(notes[1].tieEnd).toBe(1)
	})

	it('parses dynamics and tempo', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction>
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type>
        <sound tempo="120"/>
      </direction>
      <direction>
        <direction-type><dynamics><mf/></dynamics></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const tokens = result.score.staves[0].tokens

		const tempo = tokens.find(t => t.type === 'Tempo')
		expect(tempo).toBeDefined()
		expect(tempo.duration).toBe(120)
		expect(tempo.note).toBe(4)  // quarter
		// beatDuration must be in whole-note fractions (0.25 = quarter)
		// NOT NWC duration codes (4), or audio playback will be 16x too fast
		expect(tempo.beatDuration).toBe(0.25)

		const dynamic = tokens.find(t => t.type === 'Dynamic')
		expect(dynamic).toBeDefined()
		expect(dynamic.dynamic).toBe('mf')
	})

	it('parses key signature with sharps', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>3</fifths></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>3</duration><type>half</type><dot/></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const keySig = result.score.staves[0].tokens.find(t => t.type === 'KeySignature')
		expect(keySig.key).toBe('A')
		expect(keySig.sharps).toEqual(['F', 'C', 'G'])

		const timeSig = result.score.staves[0].tokens.find(t => t.type === 'TimeSignature')
		expect(timeSig.signature).toBe('3/4')
	})

	it('parses bass clef correctly', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Cello</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const clef = result.score.staves[0].tokens.find(t => t.type === 'Clef')
		expect(clef.clef).toBe('bass')

		const notes = result.score.staves[0].tokens.filter(t => t.type === 'Note')
		expect(notes[0].name).toBe('C')
		expect(notes[0].octave).toBe(3)
		// C3 on bass clef: position = 21 - 22 = -1
		expect(notes[0].position).toBe(-1)
	})

	it('handles rest tokens', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const tokens = result.score.staves[0].tokens
		const noteAndRest = tokens.filter(t => t.type === 'Note' || t.type === 'Rest')
		expect(noteAndRest.length).toBe(4)
		expect(noteAndRest[0].type).toBe('Note')
		expect(noteAndRest[1].type).toBe('Rest')
		expect(noteAndRest[2].type).toBe('Note')
		expect(noteAndRest[3].type).toBe('Rest')

		// Timing should advance through rests
		expect(noteAndRest[0].tickValue).toBe(0)
		expect(noteAndRest[1].tickValue).toBe(0.25)
		expect(noteAndRest[2].tickValue).toBe(0.5)
		expect(noteAndRest[3].tickValue).toBe(0.75)
	})

	it('handles whole-measure rest', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><rest/><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const rests = result.score.staves[0].tokens.filter(t => t.type === 'Rest')
		expect(rests.length).toBe(1)
		expect(rests[0].duration).toBe(1)  // whole note
		// Duration value should be 4/4 = 1.0
		expect(rests[0].tabUntilValue - rests[0].tabValue).toBeCloseTo(1.0)
	})

	it('inserts default initial tokens when missing', async () => {
		await setup()
		// No attributes at all
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const tokens = result.score.staves[0].tokens

		// Should have auto-inserted clef, keysig, timesig
		expect(tokens.find(t => t.type === 'Clef')).toBeDefined()
		expect(tokens.find(t => t.type === 'KeySignature')).toBeDefined()
		expect(tokens.find(t => t.type === 'TimeSignature')).toBeDefined()

		const clef = tokens.find(t => t.type === 'Clef')
		expect(clef.clef).toBe('treble')  // default
	})

	it('handles accidentals (sharps and flats)', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><alter>2</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><alter>-2</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const notes = result.score.staves[0].tokens.filter(t => t.type === 'Note')
		expect(notes[0].accidental).toBe('#')
		expect(notes[0].name).toBe('C')
		expect(notes[1].accidental).toBe('b')
		expect(notes[1].name).toBe('B')
		expect(notes[2].accidental).toBe('x')
		expect(notes[2].name).toBe('F')
		expect(notes[3].accidental).toBe('v')
		expect(notes[3].name).toBe('E')
	})

	it('handles dotted notes', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><type>quarter</type><dot/></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		const notes = result.score.staves[0].tokens.filter(t => t.type === 'Note')
		expect(notes[0].dots).toBe(1)
		expect(notes[0].duration).toBe(4)  // quarter
		expect(notes[1].dots).toBe(0)
		expect(notes[1].duration).toBe(8)  // eighth
		expect(notes[2].dots).toBe(0)
		expect(notes[2].duration).toBe(2)  // half
	})

	it('handles multi-staff (grand staff) parts', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>whole</type><staff>1</staff><voice>1</voice></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><type>whole</type><staff>2</staff><voice>5</voice></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		expect(result.score.staves.length).toBe(2)

		// Staff 1 (treble)
		const staff1 = result.score.staves[0]
		const clef1 = staff1.tokens.find(t => t.type === 'Clef')
		expect(clef1.clef).toBe('treble')
		const notes1 = staff1.tokens.filter(t => t.type === 'Note')
		expect(notes1.length).toBe(1)
		expect(notes1[0].name).toBe('E')
		expect(notes1[0].octave).toBe(5)

		// Staff 2 (bass)
		const staff2 = result.score.staves[1]
		const clef2 = staff2.tokens.find(t => t.type === 'Clef')
		expect(clef2.clef).toBe('bass')
		const notes2 = staff2.tokens.filter(t => t.type === 'Note')
		expect(notes2.length).toBe(1)
		expect(notes2[0].name).toBe('C')
		expect(notes2[0].octave).toBe(3)
	})

	it('handles multi-voice with backup/forward', async () => {
		await setup()
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>whole</type><voice>1</voice></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type><voice>2</voice></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>half</type><voice>2</voice></note>
    </measure>
  </part>
</score-partwise>`

		const result = await parseMusicXML(xml, 'test.musicxml')
		expect(result.score.staves.length).toBe(1)
		const notes = result.score.staves[0].tokens.filter(t => t.type === 'Note')
		// Should have all 3 notes (voice 1 + voice 2)
		expect(notes.length).toBe(3)
		expect(notes[0].name).toBe('E')  // voice 1: whole
		expect(notes[1].name).toBe('C')  // voice 2: half
		expect(notes[2].name).toBe('D')  // voice 2: half

		// Voice 2 notes should start at tick 0 (after backup)
		expect(notes[1].tickValue).toBe(0)
		expect(notes[2].tickValue).toBe(0.5)
	})
})

// ===================================================================
// Round-Trip Integration: Parse real .musicxml files from nwc2xml output
// (skipped in CI — nwc2xml/ is gitignored)
// ===================================================================

import { existsSync } from 'fs'
import { join as joinPath } from 'path'

const ROUND_TRIP_DIR = joinPath(import.meta.dir, '../nwc2xml/js/test-output')
const hasRoundTripData = existsSync(ROUND_TRIP_DIR)

const describeRoundTrip = hasRoundTripData ? describe : describe.skip

describeRoundTrip('Round-Trip Integration — NWC to MusicXML files', () => {
	let parseMusicXML

	const setup = async () => {
		if (parseMusicXML) return

		const { writeFileSync, unlinkSync, readFileSync } = await import('fs')
		const { join } = await import('path')
		const { tmpdir } = await import('os')

		const tmpZip = join(tmpdir(), `_bun_zip_rt_${Date.now()}.js`)
		const fflateModulePath = join(import.meta.dir, '../node_modules/fflate/esm/browser.js')
		writeFileSync(tmpZip, `import { unzipSync } from '${fflateModulePath}';
export async function unzip(buffer) {
  const e = unzipSync(new Uint8Array(buffer));
  const m = new Map();
  for (const n of Object.keys(e)) m.set(n, e[n]);
  return m;
}`)

		const tmpParser = join(tmpdir(), `_bun_mxml_rt_${Date.now()}.js`)
		let parserCode = readFileSync(join(import.meta.dir, '../src/musicxml-import.js'), 'utf-8')
		parserCode = parserCode.replace(`from './zip.js'`, `from '${tmpZip}'`)
		parserCode = parserCode.replace(`from './fraction.js'`, `from '${join(import.meta.dir, '../src/fraction.js')}'`)
		parserCode = parserCode.replace(`from './music-import-utils.js'`, `from '${join(import.meta.dir, '../src/music-import-utils.js')}'`)

		let utilsCode = readFileSync(join(import.meta.dir, '../src/music-import-utils.js'), 'utf-8')
		const tmpUtils = join(tmpdir(), `_bun_utils_rt_${Date.now()}.js`)
		utilsCode = utilsCode.replace(`from './fraction.js'`, `from '${join(import.meta.dir, '../src/fraction.js')}'`)
		writeFileSync(tmpUtils, utilsCode)

		parserCode = parserCode.replace(
			`from '${join(import.meta.dir, '../src/music-import-utils.js')}'`,
			`from '${tmpUtils}'`
		)
		parserCode = parserCode.replace(
			/const errorEl = doc\.querySelector\s*\?\s*doc\.querySelector\('parsererror'\)\s*:\s*doc\.getElementsByTagName\('parsererror'\)\[0\]/,
			`const errorEl = doc.getElementsByTagName('parsererror')[0]`
		)
		writeFileSync(tmpParser, parserCode)

		const mod = await import(tmpParser)
		parseMusicXML = mod.parseMusicXML

		process.on('exit', () => {
			try { unlinkSync(tmpZip) } catch {}
			try { unlinkSync(tmpParser) } catch {}
			try { unlinkSync(tmpUtils) } catch {}
		})
	}

	it('parses abelp.xml (large multi-staff score) without errors', async () => {
		await setup()
		const { readFileSync } = await import('fs')
		const { join } = await import('path')
		const xmlPath = join(import.meta.dir, '../nwc2xml/js/test-output/abelp.xml')
		const xmlStr = readFileSync(xmlPath, 'utf-8')

		const result = await parseMusicXML(xmlStr, 'abelp.xml')

		expect(result._source).toBe('musicxml')
		expect(result.score.staves.length).toBeGreaterThan(0)

		// Every staff should have tokens
		for (const staff of result.score.staves) {
			expect(staff.tokens.length).toBeGreaterThan(0)
			// Should have at least a clef and keysig
			expect(staff.tokens.some(t => t.type === 'Clef')).toBe(true)
			expect(staff.tokens.some(t => t.type === 'KeySignature')).toBe(true)
		}

		// Notes should have valid timing
		const notes = result.score.staves[0].tokens.filter(t => t.type === 'Note' || t.type === 'Chord')
		if (notes.length > 0) {
			expect(notes[0].tickValue).toBeDefined()
			expect(typeof notes[0].tickValue).toBe('number')
			expect(notes[0].name).toBeDefined()
		}
	})

	it('parses 5 random files without throwing', async () => {
		await setup()
		const { readFileSync, readdirSync } = await import('fs')
		const { join } = await import('path')
		const testDir = join(import.meta.dir, '../nwc2xml/js/test-output')
		const files = readdirSync(testDir).filter(f => f.endsWith('.xml')).slice(0, 5)

		for (const file of files) {
			const xmlStr = readFileSync(join(testDir, file), 'utf-8')
			const result = await parseMusicXML(xmlStr, file)

			expect(result._source).toBe('musicxml')
			expect(result.score.staves.length).toBeGreaterThan(0)
			// No assertion on exact values — just that it doesn't throw
		}
	})
})
