/**
 * Save the open score with the edits made in the viewer, as NoteWorthy text
 * (.nwctxt), NoteWorthy Composer 2.75 (.nwc) or MusicXML.
 *
 * The source must be a NoteWorthy file (.nwc / .nwz / .nwctxt): saving works
 * from its original bytes.  If the file already holds nwctxt (.nwctxt and
 * 2.75 files), only the edited SongInfo fields change and the rest is kept
 * byte for byte; older binary files are converted to nwctxt.
 */
import { parseNWC } from '../lib/nwc2xml/parser.js'
import { toMusicXML } from '../lib/nwc2xml/writer.js'
import { writeNWCTxt, extractNWCTxt, patchSongInfo, toNWC275 } from '../lib/nwc2xml/nwctxt-writer.js'
import { deflate } from './pdf-writer.js'

const SAVE_FORMATS = {
	nwctxt: { ext: 'nwctxt', type: 'text/plain;charset=utf-8', label: 'NoteWorthy text (.nwctxt)' },
	nwc: { ext: 'nwc', type: 'application/octet-stream', label: 'NoteWorthy Composer (.nwc)' },
	musicxml: { ext: 'musicxml', type: 'application/vnd.recordare.musicxml+xml', label: 'MusicXML (.musicxml)' },
}

// Viewer info keys → NWCFile / SongInfo keys
const INFO_KEYS = { title: 'title', author: 'author', lyricist: 'lyricist',
	copyright1: 'copyright1', copyright2: 'copyright2', comments: 'comment' }

const head = (bytes, n) => String.fromCharCode(...bytes.subarray(0, n))

/** Whether bytes are a NoteWorthy file this module can save from. */
function isNoteWorthy(payload) {
	const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload)
	const h = head(bytes, 5)
	return h === '[NWZ]' || h === '[Note' || h === '!Note'
}

async function inflate(bytes) {
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
	return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Edits in NWCFile field names: { title: 'x' } → { title: 'x' }, comments → comment. */
function fileFields(edits) {
	const out = {}
	for (const [key, value] of Object.entries(edits)) if (INFO_KEYS[key]) out[INFO_KEYS[key]] = value
	return out
}

/** The score as nwctxt with `edits` applied. */
async function nwcText(bytes, edits) {
	const plain = head(bytes, 5) === '[NWZ]' ? await inflate(bytes.subarray(6)) : bytes
	const original = extractNWCTxt(plain)
	if (original) return patchSongInfo(original, fileFields(edits))
	return writeNWCTxt(Object.assign(parseNWC(bytes), fileFields(edits)))
}

/**
 * Build the file to save.
 * @param {'nwctxt'|'nwc'|'musicxml'} format
 * @param {ArrayBuffer|Uint8Array} payload - original file bytes
 * @param {object} edits - edited viewer info fields, e.g. { title: 'New' }
 * @returns {Promise<{ data: string|Uint8Array, ext: string, type: string }>}
 */
async function buildSaveFile(format, payload, edits) {
	const spec = SAVE_FORMATS[format]
	if (!spec) throw new Error(`unknown format: ${format}`)
	const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload)
	if (!isNoteWorthy(bytes)) throw new Error('saving is only available for NoteWorthy files (.nwc, .nwctxt) so far')

	let data
	if (format === 'musicxml') data = toMusicXML(Object.assign(parseNWC(bytes), fileFields(edits)))
	else {
		const text = await nwcText(bytes, edits)
		data = format === 'nwc' ? await toNWC275(text, deflate) : text
	}
	return { data, ext: spec.ext, type: spec.type }
}

export { buildSaveFile, isNoteWorthy, SAVE_FORMATS }
