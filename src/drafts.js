/**
 * Unsaved changes, kept in localStorage until the score is saved.
 *
 * Each draft holds the original file bytes plus the edits made to it
 * ({ title: 'New title', ... }), keyed by file name, so a reload or
 * reopening the same file brings the changes back.  Files opened from disk
 * can be restored too, since their bytes are stored with the edits.
 */

const DRAFTS_KEY = 'nwc_drafts'
const LAST_DOC_KEY = 'nwc_last_doc'

function toBase64(bytes) {
	let binary = ''
	const CHUNK = 0x8000
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
	}
	return btoa(binary)
}

function fromBase64(str) {
	const binary = atob(str)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

function toBytes(payload) {
	return payload instanceof Uint8Array ? payload : new Uint8Array(payload)
}

function readAll() {
	try {
		return JSON.parse(localStorage.getItem(DRAFTS_KEY)) || {}
	} catch {
		return {}
	}
}

/** Store all drafts, dropping the oldest ones if over the storage quota. */
function writeAll(drafts) {
	const byAge = Object.keys(drafts).sort((a, b) => drafts[a].updated - drafts[b].updated)
	for (;;) {
		try {
			localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
			return true
		} catch {
			if (byAge.length <= 1) return false
			delete drafts[byAge.shift()]
		}
	}
}

/**
 * Edits saved for a file, or null.  A draft only applies to the same file
 * contents it was made on; a different file with the same name gets none.
 * @returns {{ edits: object, updated: number } | null}
 */
function getDraft(name, payload) {
	const draft = readAll()[name]
	if (!draft) return null
	if (payload && draft.payload !== toBase64(toBytes(payload))) return null
	return { edits: draft.edits || {}, updated: draft.updated }
}

/** Original bytes of a file that has a draft (to reopen it), or null. */
function getDraftPayload(name) {
	const draft = readAll()[name]
	return draft ? fromBase64(draft.payload) : null
}

/**
 * Record an edit to a file's draft.
 * @returns {boolean} false if the browser refused to store it
 */
function saveEdit(name, payload, field, value) {
	const drafts = readAll()
	const draft = drafts[name] || { payload: toBase64(toBytes(payload)), edits: {} }
	draft.edits[field] = value
	draft.updated = Date.now()
	drafts[name] = draft
	return writeAll(drafts)
}

function clearDraft(name) {
	const drafts = readAll()
	if (!(name in drafts)) return
	delete drafts[name]
	writeAll(drafts)
}

/** Name of the document open last time (restored on startup if it has a draft). */
function getLastDoc() {
	return localStorage.getItem(LAST_DOC_KEY)
}

function setLastDoc(name) {
	try {
		localStorage.setItem(LAST_DOC_KEY, name)
	} catch {
		// storage full or unavailable; restoring is best effort
	}
}

export { getDraft, getDraftPayload, saveEdit, clearDraft, getLastDoc, setLastDoc, toBase64, fromBase64 }
