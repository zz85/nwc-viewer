/**
 * playback-order.js — Builds the playback segment sequence for repeat-aware playback.
 *
 * Walks the score structure (barlines, endings, flow directions) and produces
 * an ordered list of tick-range segments representing the actual playback order.
 *
 * NWC playback rules (from NWC 2.75 spec):
 * - Local repeats: repeat N times (default 2), no special endings
 * - Master repeats: repeat with special endings (volta brackets)
 * - Flow directions: D.C., D.S., Coda, Segno, Fine, To Coda
 * - After D.C./D.S.: master repeats disabled, only default (D) endings taken
 * - Master repeats re-enabled after To Coda
 * - Local repeats always execute, even after D.C./D.S.
 */

// Barline style constants (from BarStyle enum in lib/nwc2xml/constants.js)
const LOCAL_OPEN  = 4
const LOCAL_CLOSE = 5
const MASTER_OPEN = 6
const MASTER_CLOSE = 7

// Flow direction style constants (from FlowStyle enum)
const FLOW_CODA      = 0
const FLOW_SEGNO     = 1
const FLOW_FINE      = 2
const FLOW_TO_CODA   = 3
const FLOW_DA_CAPO   = 4
const FLOW_DC_AL_CODA = 5
const FLOW_DC_AL_FINE = 6
const FLOW_DAL_SEGNO  = 7
const FLOW_DS_AL_CODA = 8
const FLOW_DS_AL_FINE = 9

/**
 * Collect structural markers from all staves, deduplicate by tick + type.
 * Returns sorted array of markers.
 */
function collectMarkers(staves) {
	const seen = new Map()  // key → marker (dedup)

	for (const staff of staves) {
		for (const tok of staff.tokens) {
			const tick = tok.tickValue
			if (tick == null) continue

			if (tok.type === 'Barline' && tok.barline >= LOCAL_OPEN) {
				const key = `bar:${tick}:${tok.barline}`
				if (!seen.has(key)) {
					seen.set(key, {
						tick,
						kind: 'barline',
						barline: tok.barline,
						repeat: tok.repeat || 2,
					})
				}
			} else if (tok.type === 'Ending') {
				const key = `end:${tick}:${tok.repeat}`
				if (!seen.has(key)) {
					seen.set(key, {
						tick,
						kind: 'ending',
						bits: tok.repeat || 0,
						style: tok.style || 0,
					})
				}
			} else if (tok.type === 'Flow') {
				const key = `flow:${tick}:${tok.style}`
				if (!seen.has(key)) {
					seen.set(key, {
						tick,
						kind: 'flow',
						style: tok.style || 0,
					})
				}
			}
		}
	}

	const markers = [...seen.values()]

	// Sort by tick. Within the same tick:
	// endings before barlines (so we can check endings before hitting MasterRepeatClose)
	// flow directions last (they redirect after the barline)
	const kindOrder = { ending: 0, barline: 1, flow: 2 }
	markers.sort((a, b) => a.tick - b.tick || (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9))

	return markers
}

/**
 * Get the maximum tick value across all staves (end of score).
 */
function getMaxTick(staves) {
	let maxTick = 0
	for (const staff of staves) {
		for (const tok of staff.tokens) {
			if (tok.tickValue != null) {
				let end = tok.tickValue
				if (tok.durValue) {
					end += typeof tok.durValue === 'number' ? tok.durValue : tok.durValue.value()
				}
				if (end > maxTick) maxTick = end
			}
		}
	}
	return maxTick
}

/**
 * Build the playback segment sequence.
 *
 * Walks the structural markers (barlines, endings, flow directions) following
 * NWC's playback rules to produce an ordered list of tick-range segments.
 *
 * @param {Array} staves - The score staves (interpreted, with tickValues)
 * @returns {Array<{startTick: number, endTick: number}>} Segments in playback order
 */
export function buildPlaybackSegments(staves) {
	const markers = collectMarkers(staves)
	const maxTick = getMaxTick(staves)

	if (markers.length === 0 || maxTick === 0) {
		return [{ startTick: 0, endTick: maxTick }]
	}

	const segments = []
	let pos = 0          // index into markers array
	let segStart = 0     // tick where current segment began

	// State tracking
	const localStack = []  // stack of { markerIdx, count, target }
	let masterState = null // { markerIdx, iteration, maxIter, openTick }
	let dcPerformed = false
	let masterDisabled = false

	// Find landmark ticks for flow directions
	let segnoTick = null
	let codaTick = null
	for (const m of markers) {
		if (m.kind === 'flow' && m.style === FLOW_SEGNO && segnoTick === null) segnoTick = m.tick
		if (m.kind === 'flow' && m.style === FLOW_CODA && codaTick === null) codaTick = m.tick
	}

	// Safety counter to prevent infinite loops
	let safety = 0
	const MAX_ITERATIONS = 50000

	while (pos < markers.length && safety++ < MAX_ITERATIONS) {
		const m = markers[pos]

		if (m.kind === 'barline') {
			switch (m.barline) {
				case LOCAL_OPEN: {
					localStack.push({ markerIdx: pos, count: 0 })
					pos++
					break
				}

				case LOCAL_CLOSE: {
					if (localStack.length > 0) {
						const local = localStack[localStack.length - 1]
						local.count++
						const target = m.repeat || 2  // repeat count is on the CLOSE marker
						if (local.count < target) {
							// Close current segment up to (but not including) this barline's tick
							// Actually, include everything up to the close barline
							if (segStart < m.tick) {
								segments.push({ startTick: segStart, endTick: m.tick })
							}
							// Jump back to after the open barline
							const openMarker = markers[local.markerIdx]
							segStart = openMarker.tick
							pos = local.markerIdx + 1
							continue // don't increment pos
						} else {
							localStack.pop()
						}
					}
					pos++
					break
				}

				case MASTER_OPEN: {
					if (!masterDisabled) {
						// Determine max iterations from endings that follow
						const maxIter = findMasterMaxIterations(markers, pos)
						masterState = {
							markerIdx: pos,
							iteration: 1,
							maxIter,
							openTick: m.tick,
						}
					}
					pos++
					break
				}

				case MASTER_CLOSE: {
					if (masterState && !masterDisabled) {
						if (masterState.iteration < masterState.maxIter) {
							// Close current segment
							if (segStart < m.tick) {
								segments.push({ startTick: segStart, endTick: m.tick })
							}
							// Next iteration
							masterState.iteration++
							segStart = masterState.openTick
							pos = masterState.markerIdx + 1
							continue
						} else {
							masterState = null
						}
					}
					pos++
					break
				}

				default:
					pos++
			}
		} else if (m.kind === 'ending') {
			const iteration = masterState ? masterState.iteration : 1
			let match = false

			if (dcPerformed && masterDisabled) {
				// After D.C./D.S.: only take default ending (bit 7)
				match = !!(m.bits & 0x80)
			} else {
				// Normal: check if this ending's bitmask includes the current iteration
				match = !!(m.bits & (1 << (iteration - 1)))
			}

			if (!match) {
				// This ending doesn't apply — skip to the next matching ending
				// or to the MasterRepeatClose
				if (segStart < m.tick) {
					segments.push({ startTick: segStart, endTick: m.tick })
				}
				const skipTarget = findNextEndingOrMasterClose(markers, pos, iteration, dcPerformed && masterDisabled)
				if (skipTarget !== -1) {
					segStart = markers[skipTarget].tick
					pos = skipTarget
					continue
				} else {
					// No matching ending found — just continue
					pos++
				}
			} else {
				// This ending matches — play through it
				pos++
			}
		} else if (m.kind === 'flow') {
			switch (m.style) {
				case FLOW_DA_CAPO:
				case FLOW_DC_AL_CODA:
				case FLOW_DC_AL_FINE: {
					if (!dcPerformed) {
						// Close current segment
						if (segStart <= m.tick) {
							segments.push({ startTick: segStart, endTick: m.tick })
						}
						dcPerformed = true
						masterDisabled = true
						// Jump to beginning
						segStart = 0
						pos = 0
						continue
					}
					pos++
					break
				}

				case FLOW_DAL_SEGNO:
				case FLOW_DS_AL_CODA:
				case FLOW_DS_AL_FINE: {
					if (!dcPerformed && segnoTick !== null) {
						// Close current segment
						if (segStart <= m.tick) {
							segments.push({ startTick: segStart, endTick: m.tick })
						}
						dcPerformed = true
						masterDisabled = true
						// Jump to Segno
						segStart = segnoTick
						pos = findMarkerAtTick(markers, segnoTick)
						if (pos === -1) pos = 0
						continue
					}
					pos++
					break
				}

				case FLOW_TO_CODA: {
					if (dcPerformed && codaTick !== null) {
						// Close current segment
						if (segStart <= m.tick) {
							segments.push({ startTick: segStart, endTick: m.tick })
						}
						// Re-enable master repeats after To Coda
						masterDisabled = false
						// Jump to Coda
						segStart = codaTick
						pos = findMarkerAtTick(markers, codaTick)
						if (pos === -1) pos = markers.length // end
						continue
					}
					pos++
					break
				}

				case FLOW_FINE: {
					if (dcPerformed) {
						// Stop playback — close final segment
						if (segStart <= m.tick) {
							segments.push({ startTick: segStart, endTick: m.tick })
						}
						return segments
					}
					pos++
					break
				}

				default:
					// Segno/Coda markers are just landmarks, skip
					pos++
			}
		} else {
			pos++
		}
	}

	// Final segment: from last segStart to end of score
	if (segStart < maxTick) {
		segments.push({ startTick: segStart, endTick: maxTick })
	}

	return segments
}

/**
 * Determine the maximum number of iterations for a master repeat section
 * by scanning endings between MasterOpen and the next MasterOpen (or end).
 * Scans PAST MasterClose because endings 2+ appear after the close barline.
 * If no endings found, defaults to 2.
 */
function findMasterMaxIterations(markers, masterOpenIdx) {
	let maxEnding = 0

	for (let i = masterOpenIdx + 1; i < markers.length; i++) {
		const m = markers[i]
		// Stop at next MasterOpen (start of a new repeat section)
		if (m.kind === 'barline' && m.barline === MASTER_OPEN) break
		if (m.kind === 'ending') {
			for (let bit = 0; bit < 7; bit++) {
				if (m.bits & (1 << bit)) {
					maxEnding = Math.max(maxEnding, bit + 1)
				}
			}
		}
	}

	// If we found endings, the max iterations is the highest ending number
	if (maxEnding > 0) return maxEnding

	// No endings — default to 2 iterations (simple repeat)
	return 2
}

/**
 * Find the next ending that matches the current iteration (or MasterRepeatClose),
 * starting from the marker after `fromIdx`.
 *
 * Returns the marker index to jump to, or -1 if not found.
 */
function findNextEndingOrMasterClose(markers, fromIdx, iteration, useDefault) {
	for (let i = fromIdx + 1; i < markers.length; i++) {
		const m = markers[i]
		if (m.kind === 'barline' && m.barline === MASTER_CLOSE) {
			// Jump to the marker AFTER the MasterRepeatClose
			// Look for an ending right after it
			if (i + 1 < markers.length && markers[i + 1].kind === 'ending') {
				return i + 1
			}
			return i
		}
		if (m.kind === 'ending') {
			let match = false
			if (useDefault) {
				match = !!(m.bits & 0x80)
			} else {
				match = !!(m.bits & (1 << (iteration - 1)))
			}
			if (match) return i
		}
	}
	return -1
}

/**
 * Find the first marker at or after the given tick.
 * Returns marker index, or -1 if not found.
 */
function findMarkerAtTick(markers, tick) {
	for (let i = 0; i < markers.length; i++) {
		if (markers[i].tick >= tick) return i
	}
	return -1
}

// Export internals for testing
export { collectMarkers, getMaxTick, findMasterMaxIterations }
