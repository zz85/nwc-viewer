/**
 * Shareable links.
 *
 *   ?song=<name>               a built-in sample (samples/ or nwcs/)
 *   #score=<data>&name=<file>  the score itself, deflated and base64url
 *                              encoded, for files that aren't hosted (opened
 *                              from disk, or edited)
 *
 * The score goes in the fragment so it never reaches the server and isn't
 * limited by request-line lengths.
 */
import { deflate } from './pdf-writer.js'

async function inflate(bytes) {
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
	return new Uint8Array(await new Response(stream).arrayBuffer())
}

function toBase64Url(bytes) {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
	const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

/** URL that opens a built-in sample. */
function sampleLink(base, name) {
	const url = new URL(base)
	url.search = new URLSearchParams({ song: name }).toString()
	url.hash = ''
	return url.toString()
}

/**
 * URL that carries the score itself: the original file bytes plus any edits
 * ({ title: ... }), so it opens exactly as shared whatever the format.
 */
async function embeddedLink(base, bytes, name, edits) {
	const url = new URL(base)
	url.search = ''
	const params = { score: toBase64Url(await deflate(bytes)), name }
	if (edits && Object.keys(edits).length) params.edits = JSON.stringify(edits)
	url.hash = new URLSearchParams(params).toString()
	return url.toString()
}

/**
 * What a URL asks to open: { song } for a sample, { bytes, name, edits } for
 * an embedded score, or null.
 */
async function readLink(href) {
	const url = new URL(href)
	const song = url.searchParams.get('song')
	if (song) return { song }
	const hash = new URLSearchParams(url.hash.slice(1))
	const score = hash.get('score')
	if (!score) return null
	let edits = {}
	try {
		edits = JSON.parse(hash.get('edits') || '{}')
	} catch {
		// a damaged edits part still opens the score
	}
	return { bytes: await inflate(fromBase64Url(score)), name: hash.get('name') || 'shared.nwctxt', edits }
}

export { sampleLink, embeddedLink, readLink }
