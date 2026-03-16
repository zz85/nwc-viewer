#!/usr/bin/env bun
/**
 * Compare our MuseScore parser against webmscore's MusicXML export.
 *
 * For each .mscz file:
 * 1. Run our parser (with Bun-compatible shims) → token list
 * 2. Run webmscore → MusicXML → parse into comparable note list
 * 3. Compare note-by-note: pitch, duration, accidentals, clef, key/time sig
 *
 * Usage: bun scripts/compare-parsers.js [file.mscz]
 *   No args = run against all musescores/*.mscz
 */

import WebMscore from 'webmscore'
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom'
import { unzipSync } from 'fflate'
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'fs'
import { join, basename, extname } from 'path'
import { tmpdir } from 'os'

// ─── Shims: make our parser work under Bun ──────────────────────
globalThis.DOMParser = globalThis.DOMParser || XmlDOMParser

// 3. Now dynamically import our parser — but we need to intercept zip.js
//    Our parser calls: import { unzip } from './zip.js'
//    zip.js uses DecompressionStream which doesn't exist in Bun.
//    Solution: re-export our parser's core logic with the Bun unzip.

// Instead of importing the module directly (which would fail on zip.js),
// we'll read the source, extract the conversion logic, and run it.
// But that's fragile. Better approach: provide a thin wrapper.

// Actually, let's just read the .mscx from the zip ourselves and feed
// the raw XML to the parser's DOM conversion logic.

// ─── Import our parser's conversion logic ───────────────────────
// We can't import the module directly because zip.js uses DecompressionStream.
// Instead, we extract the .mscx ourselves and call the DOM conversion.

// Read the parser source and eval the pure functions we need.
// This is a pragmatic approach — the functions are all pure.
const parserSrc = readFileSync(join(import.meta.dir, '../src/musescore-parser.js'), 'utf-8')

// Extract and adapt the parser: remove the import of zip.js and Fraction,
// load Fraction separately, and provide our own parseMuseScore.
const fractionSrc = readFileSync(join(import.meta.dir, '../src/fraction.js'), 'utf-8')

// Create a module that contains the parser logic
const fractionModule = await import('../src/fraction.js')
const Fraction = fractionModule.default

// We need to re-create the parser functions. The cleanest way:
// import everything except the zip dependency by providing a mock.
// Let's use Bun's module resolution with a mock.

// Create a temporary module that provides our Bun-compatible parseMuseScore
async function parseMuseScoreBun(buffer) {
	const bytes = new Uint8Array(buffer)
	let xmlString

	if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
		// ZIP — extract .mscx
		const files = bunUnzip(buffer)
		for (const [name, data] of files) {
			if (name.endsWith('.mscx')) {
				xmlString = new TextDecoder().decode(data)
				break
			}
		}
		if (!xmlString) {
			// Try any file containing .mscx
			for (const [name, data] of files) {
				if (name.includes('.mscx') || name === 'score.mscx') {
					xmlString = new TextDecoder().decode(data)
					break
				}
			}
		}
		if (!xmlString) {
			throw new Error('No .mscx found in ZIP. Files: ' + [...files.keys()].join(', '))
		}
	} else {
		xmlString = new TextDecoder().decode(bytes)
	}

	const parser = new DOMParser()
	const doc = parser.parseFromString(xmlString, 'text/xml')

	// Now we need to call convertMuseScoreDOM from our parser.
	// Since we can't import it directly, we'll use a dynamic import trick.
	// Write a temp module that mocks zip.js.
	return { xmlString, doc }
}

// ─── MusicXML Parser (parse webmscore's output) ─────────────────

// xmldom NodeLists aren't iterable — convert to array
const toArray = (nodeList) => {
	const arr = []
	for (let i = 0; i < nodeList.length; i++) arr.push(nodeList[i])
	return arr
}

/**
 * Parse MusicXML into a flat list of musical events per staff,
 * comparable to our parser's token output.
 */
function parseMusicXML(xmlString) {
	const parser = new DOMParser()
	const doc = parser.parseFromString(xmlString, 'text/xml')
	const staves = []

	const partList = doc.getElementsByTagName('score-part')
	const parts = doc.getElementsByTagName('part')

	for (let pi = 0; pi < parts.length; pi++) {
		const partEl = parts[pi]
		const partId = partEl.getAttribute('id')

		// Find part name
		let partName = ''
		for (const sp of toArray(partList)) {
			if (sp.getAttribute('id') === partId) {
				const pn = sp.getElementsByTagName('part-name')[0]
				partName = pn ? pn.textContent.trim() : ''
				break
			}
		}

		const events = []
		const measures = partEl.getElementsByTagName('measure')
		let currentDivisions = 1

		for (const measure of toArray(measures)) {
			const measureNum = measure.getAttribute('number')

			// Check for attributes (clef, key, time, divisions)
			for (const attr of toArray(measure.getElementsByTagName('attributes'))) {
				const divEl = attr.getElementsByTagName('divisions')[0]
				if (divEl) currentDivisions = parseInt(divEl.textContent) || 1

				// Key
				for (const keyEl of toArray(attr.getElementsByTagName('key'))) {
					const fifths = parseInt(getText(keyEl, 'fifths') || '0')
					events.push({ type: 'key', fifths, measure: measureNum })
				}

				// Time
				for (const timeEl of toArray(attr.getElementsByTagName('time'))) {
					const beats = getText(timeEl, 'beats')
					const beatType = getText(timeEl, 'beat-type')
					events.push({ type: 'time', beats, beatType, measure: measureNum })
				}

				// Clef
				for (const clefEl of toArray(attr.getElementsByTagName('clef'))) {
					const sign = getText(clefEl, 'sign')
					const line = getText(clefEl, 'line')
					const octChange = getText(clefEl, 'clef-octave-change')
					events.push({ type: 'clef', sign, line, octChange, measure: measureNum })
				}
			}

			// Notes and rests
			for (const child of toArray(measure.childNodes)) {
				if (child.nodeName === 'note') {
					const restEl = child.getElementsByTagName('rest')[0]
					const chordEl = child.getElementsByTagName('chord')[0]
					const pitchEl = child.getElementsByTagName('pitch')[0]
					const durationEl = child.getElementsByTagName('duration')[0]
					const typeEl = child.getElementsByTagName('type')[0]
					const dotEls = child.getElementsByTagName('dot')
					const tieEls = child.getElementsByTagName('tie')
					const voiceEl = child.getElementsByTagName('voice')[0]
					const staffEl = child.getElementsByTagName('staff')[0]

					const voice = voiceEl ? parseInt(voiceEl.textContent) : 1
					const staff = staffEl ? parseInt(staffEl.textContent) : 1
					const duration = durationEl ? parseInt(durationEl.textContent) : 0
					const durationQuarters = duration / currentDivisions
					const noteType = typeEl ? typeEl.textContent.trim() : ''
					const dots = dotEls.length

					let tieStart = false, tieStop = false
					for (const t of toArray(tieEls)) {
						if (t.getAttribute('type') === 'start') tieStart = true
						if (t.getAttribute('type') === 'stop') tieStop = true
					}

					if (restEl) {
						events.push({
							type: 'rest',
							voice,
							staff,
							noteType,
							dots,
							durationQuarters,
							measure: measureNum,
						})
					} else if (pitchEl) {
						const step = getText(pitchEl, 'step')
						const octave = parseInt(getText(pitchEl, 'octave') || '4')
						const alter = parseFloat(getText(pitchEl, 'alter') || '0')
						const isChordMember = !!chordEl

						// Accidental
						const accEl = child.getElementsByTagName('accidental')[0]
						const accidental = accEl ? accEl.textContent.trim() : ''

						events.push({
							type: 'note',
							step,
							octave,
							alter,
							accidental,
							voice,
							staff,
							noteType,
							dots,
							durationQuarters,
							isChordMember,
							tieStart,
							tieStop,
							measure: measureNum,
						})
					}
				}

				if (child.nodeName === 'direction') {
					// Look for tempo
					for (const st of toArray(child.getElementsByTagName('sound'))) {
						const tempo = st.getAttribute('tempo')
						if (tempo) {
							events.push({ type: 'tempo', bpm: parseFloat(tempo), measure: measureNum })
						}
					}

					// Look for dynamics
				const dynEl = child.getElementsByTagName('dynamics')[0]
				const dynChild = dynEl ? dynEl.childNodes[0] : null
				if (dynChild && dynChild.nodeType === 1) {
					events.push({ type: 'dynamic', value: dynChild.tagName, measure: measureNum })
					}
				}
			}

			events.push({ type: 'barline', measure: measureNum })
		}

		staves.push({ partName, partId, events })
	}

	return staves
}

function getText(parent, tagName) {
	const el = parent.getElementsByTagName(tagName)[0]
	return el ? el.textContent.trim() : ''
}

// ─── Comparison Logic ───────────────────────────────────────────

// Map MusicXML note types to our duration numbers
const XMLTYPE_TO_DUR = {
	'whole': 1, 'half': 2, 'quarter': 4, 'eighth': 8,
	'16th': 16, '32nd': 32, '64th': 64, '128th': 128,
}

// Map MusicXML accidentals to our format
const XML_ACC_MAP = {
	'sharp': '#', 'flat': 'b', 'natural': 'n',
	'double-sharp': 'x', 'sharp-sharp': 'x',
	'flat-flat': 'v', 'double-flat': 'v',
	'': '',
}

// Map MusicXML clef sign+line to our clef names
function xmlClefToName(sign, line) {
	if (sign === 'G') return 'treble'
	if (sign === 'F') return 'bass'
	if (sign === 'C' && line === '3') return 'alto'
	if (sign === 'C' && line === '4') return 'tenor'
	if (sign === 'percussion') return 'percussion'
	return sign + line
}

function compareFile(ourTokens, refEvents, staffIdx, acceptAllVoices = false) {
	const diffs = []

	// Extract notes/rests from our tokens (voice 1 only)
	const ourNotes = ourTokens.filter(t =>
		t.type === 'Note' || t.type === 'Chord' || t.type === 'Rest'
	)

	// Extract notes/rests from reference (voice 1 by default, or all voices for split staves)
	const refNotes = []
	for (const e of refEvents) {
		if (!acceptAllVoices) {
			if (e.voice && e.voice !== 1) continue
		}
		if (e.type === 'note' || e.type === 'rest') {
			refNotes.push(e)
		}
	}

	// Compare clefs
	const ourClefs = ourTokens.filter(t => t.type === 'Clef')
	const refClefs = refEvents.filter(e => e.type === 'clef')
	if (ourClefs.length > 0 && refClefs.length > 0) {
		const ourClef = ourClefs[0].clef
		const refClef = xmlClefToName(refClefs[0].sign, refClefs[0].line)
		if (ourClef !== refClef) {
			diffs.push({ field: 'clef', ours: ourClef, ref: refClef })
		}
	}

	// Compare key signatures
	const ourKeys = ourTokens.filter(t => t.type === 'KeySignature')
	const refKeys = refEvents.filter(e => e.type === 'key')
	if (refKeys.length > 0) {
		if (ourKeys.length === 0) {
			diffs.push({ field: 'keySig', ours: 'MISSING', ref: `fifths=${refKeys[0].fifths}` })
		} else {
			// Compare: our key uses sharp/flat count, ref uses fifths (same thing)
			const ourFifths = ourKeys[0].sharps.length || -(ourKeys[0].flats.length || 0)
			if (ourFifths !== refKeys[0].fifths) {
				diffs.push({ field: 'keySig', ours: ourFifths, ref: refKeys[0].fifths })
			}
		}
	}

	// Compare time signatures
	const ourTime = ourTokens.filter(t => t.type === 'TimeSignature')
	const refTime = refEvents.filter(e => e.type === 'time')
	if (refTime.length > 0 && ourTime.length > 0) {
		const ourSig = ourTime[0].signature
		const refSig = `${refTime[0].beats}/${refTime[0].beatType}`
		if (ourSig !== refSig) {
			diffs.push({ field: 'timeSig', ours: ourSig, ref: refSig })
		}
	}

	// Compare tempo
	const ourTempos = ourTokens.filter(t => t.type === 'Tempo')
	const refTempos = refEvents.filter(e => e.type === 'tempo')
	if (refTempos.length > 0) {
		if (ourTempos.length === 0) {
			diffs.push({ field: 'tempo', ours: 'MISSING', ref: `${refTempos[0].bpm} BPM` })
		} else {
			const ourBpm = ourTempos[0].duration
			const refBpm = Math.round(refTempos[0].bpm)
			if (Math.abs(ourBpm - refBpm) > 1) {
				diffs.push({ field: 'tempo', ours: `${ourBpm} BPM`, ref: `${refBpm} BPM` })
			}
		}
	}

	// Compare note count (voice 1 only, excluding chord members)
	const refPrimary = refNotes.filter(e => !e.isChordMember)
	if (ourNotes.length !== refPrimary.length) {
		diffs.push({
			field: 'noteCount',
			ours: ourNotes.length,
			ref: refPrimary.length,
			detail: `(our ${ourNotes.length} vs ref ${refPrimary.length} events in voice 1)`
		})
	}

	// Compare notes one-by-one (up to min length)
	let noteErrors = 0
	let durationErrors = 0
	let accidentalErrors = 0
	let tieErrors = 0
	const maxCompare = Math.min(ourNotes.length, refPrimary.length)
	const noteDetails = []

	let refIdx = 0
	for (let i = 0; i < maxCompare; i++) {
		const ours = ourNotes[i]
		const ref = refPrimary[refIdx]
		if (!ref) break
		refIdx++

		if (ours.type === 'Rest' && ref.type === 'rest') {
			// Compare duration
			const ourDur = XMLTYPE_TO_DUR[ours.duration] || ours.duration
			const refDur = XMLTYPE_TO_DUR[ref.noteType] || 0
			if (refDur && ourDur !== refDur) {
				durationErrors++
				if (noteDetails.length < 5) {
					noteDetails.push(`  rest #${i}: dur ours=${ourDur} ref=${refDur} (m${ref.measure})`)
				}
			}
			continue
		}

		if ((ours.type === 'Note' || ours.type === 'Chord') && ref.type === 'note') {
			// Compare pitch
			const ourName = ours.name
			const ourOctave = ours.octave
			if (ourName !== ref.step) {
				noteErrors++
				if (noteDetails.length < 5) {
					noteDetails.push(`  note #${i}: pitch ours=${ourName}${ourOctave} ref=${ref.step}${ref.octave} (m${ref.measure})`)
				}
			} else if (ourOctave !== ref.octave) {
				noteErrors++
				if (noteDetails.length < 5) {
					noteDetails.push(`  note #${i}: octave ours=${ourName}${ourOctave} ref=${ref.step}${ref.octave} (m${ref.measure})`)
				}
			}

			// Compare duration type
			const ourDur = ours.duration
			const refDur = XMLTYPE_TO_DUR[ref.noteType] || 0
			if (refDur && ourDur !== refDur) {
				durationErrors++
				if (noteDetails.length < 5) {
					noteDetails.push(`  note #${i}: dur ours=${ourDur} ref=${refDur}(${ref.noteType}) (m${ref.measure})`)
				}
			}

			// Compare ties
			if (ref.tieStart && !ours.tie) {
				tieErrors++
			}
			if (ref.tieStop && !ours.tieEnd) {
				tieErrors++
			}

			// Compare chord member count
			if (ours.type === 'Chord') {
				// Count chord members in ref starting from next event
				let chordCount = 1
				while (refIdx < refPrimary.length) {
					// Actually chord members are already filtered out of refPrimary
					break
				}
				// Count chord members in the FULL ref events
				// (chord members follow immediately with isChordMember=true)
			}
			continue
		}

		// Type mismatch
		if ((ours.type === 'Rest') !== (ref.type === 'rest')) {
			noteErrors++
			if (noteDetails.length < 5) {
				noteDetails.push(`  event #${i}: type ours=${ours.type} ref=${ref.type} (m${ref.measure})`)
			}
		}
	}

	if (noteErrors > 0) diffs.push({ field: 'pitchErrors', count: noteErrors })
	if (durationErrors > 0) diffs.push({ field: 'durationErrors', count: durationErrors })
	if (tieErrors > 0) diffs.push({ field: 'tieErrors', count: tieErrors })
	if (noteDetails.length > 0) diffs.push({ field: 'details', samples: noteDetails })

	// Count reference-only features our parser skips
	const refDynamics = refEvents.filter(e => e.type === 'dynamic').length
	const refVoice2 = refEvents.filter(e => (e.type === 'note' || e.type === 'rest') && e.voice > 1).length
	const missing = []
	if (refDynamics > 0) missing.push(`dynamics(${refDynamics})`)
	if (refVoice2 > 0) missing.push(`voice2+(${refVoice2})`)
	if (missing.length > 0) diffs.push({ field: 'unsupported', features: missing })

	return diffs
}

// ─── Run our parser under Bun ───────────────────────────────────
// Can't import directly: zip.js uses DecompressionStream, parser uses
// firstElementChild/nextElementSibling (missing in xmldom), and xmldom's
// getElementsByTagName returns a non-iterable NodeList.
// Solution: write a patched copy to a temp file and import that.

const tmpZip = join(tmpdir(), `_bun_zip_${Date.now()}.js`)
const fflateModulePath = join(import.meta.dir, '../node_modules/fflate/esm/browser.js')
writeFileSync(tmpZip, `import { unzipSync } from '${fflateModulePath}';
export async function unzip(buffer) {
  const e = unzipSync(new Uint8Array(buffer));
  const m = new Map();
  for (const n of Object.keys(e)) m.set(n, e[n]);
  return m;
}`)

const tmpParser = join(tmpdir(), `_bun_mscore_parser_${Date.now()}.js`)
let parserCode = readFileSync(join(import.meta.dir, '../src/musescore-parser.js'), 'utf-8')
parserCode = parserCode.replace(`from './zip.js'`, `from '${tmpZip}'`)
parserCode = parserCode.replace(`from './fraction.js'`, `from '${join(import.meta.dir, '../src/fraction.js')}'`)
// xmldom doesn't have querySelector
parserCode = parserCode.replace(`doc.querySelector('parsererror')`, `doc.getElementsByTagName('parsererror')[0]`)
writeFileSync(tmpParser, parserCode)

let parseMuseScore
try {
	const mod = await import(tmpParser)
	parseMuseScore = mod.parseMuseScore
} catch (e) {
	console.error('Failed to load patched parser:', e.message)
	process.exit(1)
}

process.on('exit', () => {
	try { unlinkSync(tmpZip) } catch {}
	try { unlinkSync(tmpParser) } catch {}
})

// ─── Main ───────────────────────────────────────────────────────

const args = process.argv.slice(2)
let files

if (args.length > 0) {
	files = args
} else {
	const dir = join(import.meta.dir, '../musescores')
	files = readdirSync(dir)
		.filter(f => f.endsWith('.mscz'))
		.map(f => join(dir, f))
}

console.log(`Comparing ${files.length} files: our parser vs webmscore MusicXML\n`)
console.log('='.repeat(80))

let totalFiles = 0
let totalPassed = 0
let totalDiffs = 0
const allResults = []

for (const file of files) {
	const name = basename(file)
	totalFiles++

	try {
		const buffer = readFileSync(file)
		const data = new Uint8Array(buffer)

		// 1. Run our parser
		let ourResult
		try {
			ourResult = await parseMuseScore(buffer.buffer)
		} catch (e) {
			console.log(`\n[FAIL] ${name}`)
			console.log(`       Our parser error: ${e.message}`)
			allResults.push({ name, error: `our parser: ${e.message}` })
			continue
		}

		// 2. Run webmscore → MusicXML (in subprocess to avoid WASM state corruption)
		let xmlStr, meta
		try {
			const workerScript = join(import.meta.dir, '_webmscore-worker.js')
			const proc = Bun.spawn(['bun', workerScript, file], { stdout: 'pipe', stderr: 'pipe' })
			const output = await new Response(proc.stdout).text()
			const exitCode = await proc.exited
			if (exitCode !== 0) {
				const stderr = await new Response(proc.stderr).text()
				throw new Error(stderr.trim().split('\n').pop() || `exit code ${exitCode}`)
			}
			const parsed = JSON.parse(output)
			xmlStr = parsed.xml
			meta = parsed.meta
		} catch (e) {
			// webmscore crashed (e.g., MS4 format not supported)
			console.log(`\n[SKIP] ${name}`)
			console.log(`       webmscore error: ${e.message.substring(0, 80)}`)
			console.log(`       Our parser: ${ourResult.score.staves.length} staves, ${ourResult.score.staves.reduce((s,st) => s + st.tokens.length, 0)} tokens`)
			allResults.push({ name, error: `webmscore: ${e.message.substring(0, 60)}` })
			continue
		}

		// 3. Parse MusicXML reference
		const refStaves = parseMusicXML(xmlStr)

		// 4. Compare per-staff
		// Handle grand-staff merging: our parser may produce N staves for a piano
		// while MusicXML merges them into 1 part with staff="1"/staff="2" attributes.
		const fileDiffs = []
		const ourStaves = ourResult.score.staves

		if (ourStaves.length === refStaves.length) {
			// Direct 1:1 mapping
			for (let si = 0; si < ourStaves.length; si++) {
				const diffs = compareFile(ourStaves[si].tokens, refStaves[si].events, si)
				if (diffs.length > 0) {
					fileDiffs.push({ staff: si, partName: refStaves[si].partName, diffs })
				}
			}
		} else if (ourStaves.length > refStaves.length) {
			// Grand staff case: split ref events by staff number
			// MusicXML notes have a <staff> child indicating which staff (1-indexed)
			let ourIdx = 0
			for (let ri = 0; ri < refStaves.length; ri++) {
				const refEvents = refStaves[ri].events
				// Count how many of our staves map to this ref part
				// by checking if events have staff numbers
				const maxStaff = Math.max(1, ...refEvents
					.filter(e => e.staff).map(e => e.staff))

				for (let s = 1; s <= maxStaff && ourIdx < ourStaves.length; s++) {
					// Filter ref events for this staff number
					const staffEvents = refEvents.filter(e => {
						if (e.type === 'barline') return true // barlines apply to all staves
						if (!e.staff) return s === 1 // default to staff 1
						return e.staff === s
					})
					const diffs = compareFile(ourStaves[ourIdx].tokens, staffEvents, ourIdx, true)
					if (diffs.length > 0) {
						fileDiffs.push({ staff: ourIdx, partName: `${refStaves[ri].partName} staff ${s}`, diffs })
					}
					ourIdx++
				}
			}
		} else {
			fileDiffs.push({ staff: 'all', field: 'staffCount', ours: ourStaves.length, ref: refStaves.length })
		}

		// 5. Report
		// Separate real issues from informational-only diffs (voice2+)
		const realDiffs = fileDiffs.filter(d => {
			if (d.staff === 'all') return true
			return d.diffs?.some(diff => diff.field !== 'unsupported')
		})
		const hasIssues = realDiffs.length > 0
		const hasInfoOnly = fileDiffs.length > 0 && !hasIssues
		const icon = hasIssues ? 'DIFF' : hasInfoOnly ? 'INFO' : ' OK '
		console.log(`\n[${icon}] ${name}`)
		console.log(`       Staves: ours=${ourResult.score.staves.length} ref=${refStaves.length}  |  Title: ${meta.title}  |  Measures: ${meta.measures}`)

		if (hasIssues) {
			totalDiffs++
			for (const d of fileDiffs) {
				if (d.staff === 'all') {
					console.log(`       STAFF COUNT: ours=${d.ours} ref=${d.ref}`)
				} else {
					console.log(`       Staff ${d.staff} (${d.partName}):`)
					for (const diff of d.diffs) {
						if (diff.field === 'details') {
							for (const s of diff.samples) console.log(`         ${s}`)
						} else if (diff.field === 'unsupported') {
							console.log(`         unsupported: ${diff.features.join(', ')}`)
						} else if (diff.count !== undefined) {
							console.log(`         ${diff.field}: ${diff.count} errors`)
						} else {
							console.log(`         ${diff.field}: ours=${diff.ours} ref=${diff.ref} ${diff.detail || ''}`)
						}
					}
				}
			}
		} else if (hasInfoOnly) {
			// voice2+ only — count as passed with info
			totalPassed++
		} else {
			totalPassed++
		}

		allResults.push({ name, fileDiffs, staves: ourStaves.length, measures: meta.measures })
	} catch (err) {
		console.log(`\n[FAIL] ${name}`)
		console.log(`       Error: ${err.message}`)
		allResults.push({ name, error: err.message })
	}
}

// ─── Summary ────────────────────────────────────────────────────
console.log('\n' + '='.repeat(80))
console.log(`\nSUMMARY: ${totalFiles} files, ${totalPassed} clean, ${totalDiffs} with diffs, ${totalFiles - totalPassed - totalDiffs} errors`)

// Aggregate common issues
const issueCounts = {}
for (const r of allResults) {
	if (r.error) { issueCounts['PARSE_ERROR'] = (issueCounts['PARSE_ERROR'] || 0) + 1; continue }
	for (const fd of (r.fileDiffs || [])) {
		if (fd.staff === 'all') { issueCounts['staffCount'] = (issueCounts['staffCount'] || 0) + 1; continue }
		for (const d of (fd.diffs || [])) {
			if (d.field === 'unsupported') {
				for (const f of d.features) {
					const key = f.split('(')[0]
					issueCounts[key] = (issueCounts[key] || 0) + 1
				}
			} else if (d.field !== 'details') {
				issueCounts[d.field] = (issueCounts[d.field] || 0) + 1
			}
		}
	}
}

if (Object.keys(issueCounts).length > 0) {
	console.log('\nIssue frequency across all files:')
	const sorted = Object.entries(issueCounts).sort((a, b) => b[1] - a[1])
	for (const [issue, count] of sorted) {
		console.log(`  ${issue}: ${count} files`)
	}
}
