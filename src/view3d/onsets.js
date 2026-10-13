/**
 * onsets.js — groups playback note events into the onset lists the 3D stage
 * animates (one entry per distinct time, holding the noteheads it lights).
 * No three.js here, so it can be unit tested.
 */

// Per-token ids for de-duplicating hits, kept off the score's own tokens
const tokenIds = new WeakMap()
let nextTokenId = 0
const tokenId = token => {
	if (!tokenIds.has(token)) tokenIds.set(token, nextTokenId++)
	return tokenIds.get(token)
}

/**
 * Build onset groups from (time, staffIndex, token) hits.
 *
 * Without byTrack: one group per staff, coloured by staff index.
 * With byTrack: noteheads carry their source MIDI track (`_track`), and each
 * staff is split into one group per (staff, track) — every group gets its own
 * voice lanes and is coloured by track, so a piano reduction keeps the
 * per-track colours of the multi-staff layout.
 *
 * Returns an array of onset lists; each list has `.staff` and `.color`.
 * @param {Array<{time:number, staff:number, token:object}>} hits
 * @param {Map} heads - drawing element → head info (from buildScoreMeshes)
 * @param {number} staffCount
 * @param {{byTrack?: boolean}} [opts]
 */
export function buildOnsets(hits, heads, staffCount, { byTrack = false } = {}) {
	const groups = new Map() // key → list
	const order = []
	const group = (staff, track) => {
		const key = byTrack ? staff + ':' + track : String(staff)
		let g = groups.get(key)
		if (!g) {
			g = []
			g.staff = staff
			g.color = byTrack ? track : staff
			groups.set(key, g)
			order.push(g)
		}
		return g
	}
	if (!byTrack) for (let si = 0; si < staffCount; si++) group(si, 0) // stable staff order
	const seen = new Set()
	hits = [...hits].sort((a, b) => a.time - b.time)
	for (const { time, staff, token } of hits) {
		const key = staff + ':' + time.toFixed(4) + ':' + tokenId(token)
		if (seen.has(key)) continue
		seen.add(key)
		const parts = token.type === 'Chord' && token.notes
			? token.notes.map(n => [n.drawingNoteHead, n._track])
			: [[token.drawingNoteHead, token._track]]
		const byGroup = new Map()
		for (const [el, trk] of parts) {
			const h = el && heads.get(el)
			if (!h) continue
			const g = group(staff, trk ?? 0)
			if (!byGroup.has(g)) byGroup.set(g, [])
			byGroup.get(g).push(h)
		}
		for (const [list, hs] of byGroup) {
			const last = list[list.length - 1]
			if (last && Math.abs(last.time - time) < 1e-3) { for (const h of hs) if (!last.heads.includes(h)) last.heads.push(h) }
			else list.push({ time, heads: hs })
		}
	}
	for (const l of order) l.sort((a, b) => a.time - b.time)
	// colours by track index; keep groups ordered by staff then colour
	if (byTrack) order.sort((a, b) => a.staff - b.staff || a.color - b.color)
	return order
}
