/* this deals with drawing ties and slurs */
import { Tie } from '../drawing.js'

let drawing, data

/**
 * Determine tie/slur arc direction from stem direction.
 * Returns 1 (below / downward arc) or -1 (above / upward arc).
 *
 * Standard engraving rule:
 *   stems up  → tie curves below  → direction = 1
 *   stems down → tie curves above → direction = -1
 */
function getTieDirection(token, childNote) {
	let stemUp
	if (token.Stem === 'Up' || token.stem === 1) {
		stemUp = true
	} else if (token.Stem === 'Down' || token.stem === 2) {
		stemUp = false
	} else if (token.type === 'Chord' && token.notes && token.notes.length > 0) {
		// For chords without explicit stem: use outer note positions
		const positions = token.notes.map(n => n.position)
		stemUp = (Math.min(...positions) + Math.max(...positions)) < 0
	} else {
		// Single note: position < 0 = below middle line = stems up
		const pos = childNote ? childNote.position : (token.position || 0)
		stemUp = pos < 0
	}
	return stemUp ? 1 : -1
}

function layoutTies(_drawing, _data) {
	drawing = _drawing
	data = _data
	const staves = data.score.staves
	
	staves.forEach((stave) => {
		// Build a flat list of tie-able note entries from all tokens.
		// For Chord tokens, each child note becomes a separate entry so
		// per-note chord ties work correctly.
		const entries = []
		for (const token of stave.tokens) {
			if (token.type === 'Note') {
				if (!token.drawingNoteHead) continue
				entries.push({
					position: token.position,
					glyph: token.drawingNoteHead,
					tie: token.tie,
					tieEnd: token.tieEnd,
					slur: token.slur,
					token: token,
				})
			} else if (token.type === 'Chord' && token.notes) {
				for (const child of token.notes) {
					if (!child.drawingNoteHead) continue
					entries.push({
						position: child.position,
						glyph: child.drawingNoteHead,
						// Tie can be on the child note itself, or inherited from parent
						tie: child.tie || token.tie,
						tieEnd: child.tieEnd || token.tieEnd,
						// Slurs are on the parent chord, not individual notes
						slur: token.slur,
						token: token,
						childNote: child,
					})
				}
			}
		}

		// --- Draw ties ---
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (!entry.tie) continue

			const start = entry.glyph
			const direction = getTieDirection(entry.token, entry.childNote)

			// Search forward for matching tie-end at the same position
			for (let j = i + 1; j < entries.length; j++) {
				const next = entries[j]
				if (next.tieEnd && next.position === entry.position) {
					const end = next.glyph
					if (end) {
						drawing.add(new Tie(start, end, direction))
						break
					}
				}
				// If we find a non-tieEnd note at the same position, stop
				// (the tie chain is broken)
				if (!next.tieEnd && next.position === entry.position) {
					break
				}
			}
		}

		// --- Draw slurs ---
		// Slurs connect between noteheads regardless of position matching.
		// For chords, use the outer note (opposite side from stem) as anchor.
		// De-duplicate: only process one slur-start per parent token.
		const slurProcessed = new Set()
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (entry.slur !== 1) continue
			// Avoid duplicates from chord child entries sharing same parent
			if (slurProcessed.has(entry.token)) continue
			slurProcessed.add(entry.token)

			const start = getSlurAnchor(entry.token)
			if (!start) continue
			const direction = getTieDirection(entry.token, entry.childNote)

			// Find the slur end (slur === 2)
			for (let j = i + 1; j < entries.length; j++) {
				const next = entries[j]
				if (next.slur !== 2) continue
				if (slurProcessed.has(next.token) && next.token !== entry.token) continue

				const end = getSlurAnchor(next.token)
				if (end) {
					drawing.add(new Tie(start, end, direction))
					break
				}
			}
		}
	})
}

/**
 * Get the best notehead glyph for a slur anchor point.
 * For single notes, it's the note's drawingNoteHead.
 * For chords, pick the note on the opposite side from the stem
 * (top note for stems-up, bottom note for stems-down).
 */
function getSlurAnchor(token) {
	if (token.type === 'Note') {
		return token.drawingNoteHead
	}
	if (token.type === 'Chord' && token.notes && token.notes.length > 0) {
		// Determine stem direction
		let stemUp
		if (token.Stem === 'Up' || token.stem === 1) stemUp = true
		else if (token.Stem === 'Down' || token.stem === 2) stemUp = false
		else {
			const positions = token.notes.map(n => n.position)
			stemUp = (Math.min(...positions) + Math.max(...positions)) < 0
		}
		// Pick outer note: stems up → use top note; stems down → use bottom note
		const sorted = [...token.notes].sort((a, b) => a.position - b.position)
		const anchor = stemUp ? sorted[sorted.length - 1] : sorted[0]
		return anchor.drawingNoteHead || token.notes[0].drawingNoteHead
	}
	return null
}

export { layoutTies }
