import { describe, test, expect } from 'bun:test'

// Minimal mocks for the import chain (typeset → drawing → loaders → DOM)
const mockElement = { onchange: null, onclick: null, click() {}, ondragover: null, ondrop: null }
globalThis.document = globalThis.document || {
	getElementById: () => mockElement,
	body: mockElement,
}
globalThis.window = globalThis.window || { ctx: null, canvas: null }
globalThis.XMLHttpRequest = globalThis.XMLHttpRequest || class { open() {} send() {} }

const {
	computeSystemBreaks,
	dpOptimalBreaks,
	computeBadness,
	buildBarlineMap,
	computeJustifyX,
} = await import('../src/layout/typeset.js')

// ---------------------------------------------------------------------------
// computeBadness
// ---------------------------------------------------------------------------
describe('computeBadness', () => {
	test('exact fit returns 0', () => {
		expect(computeBadness(500, 500, false)).toBe(0)
	})

	test('overfull lines have steep penalty', () => {
		const b = computeBadness(600, 500, false) // 20% overfull
		expect(b).toBeGreaterThan(1)
	})

	test('underfull lines have moderate penalty', () => {
		const b = computeBadness(400, 500, false) // 20% underfull
		expect(b).toBeGreaterThan(0)
	})

	test('overfull is penalized more than underfull at same ratio', () => {
		const over = computeBadness(600, 500, false) // +20%
		const under = computeBadness(400, 500, false) // -20%
		expect(over).toBeGreaterThan(under)
	})

	test('last line is penalized less for being underfull', () => {
		const normal = computeBadness(300, 500, false)
		const last = computeBadness(300, 500, true)
		expect(last).toBeLessThan(normal)
	})

	test('last line exact fit is still 0', () => {
		expect(computeBadness(500, 500, true)).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// dpOptimalBreaks
// ---------------------------------------------------------------------------
describe('dpOptimalBreaks', () => {
	test('single measure — no break needed', () => {
		const boundaries = [{ x: 300 }]
		const breaks = dpOptimalBreaks(boundaries, 0, 0, 500)
		expect(breaks).toEqual([])
	})

	test('two measures that fit — no break', () => {
		const boundaries = [{ x: 200 }, { x: 400 }]
		const breaks = dpOptimalBreaks(boundaries, 0, 1, 500)
		expect(breaks).toEqual([])
	})

	test('four even measures on pageWidth=250 — breaks into 2 systems', () => {
		// Measures at 100, 200, 300, 400 — each 100px wide
		// pageWidth=250 → 2 measures per system is optimal (200px each)
		const boundaries = [{ x: 100 }, { x: 200 }, { x: 300 }, { x: 400 }]
		const breaks = dpOptimalBreaks(boundaries, 0, 3, 250)
		expect(breaks.length).toBe(1)
		expect(breaks[0]).toBe(1) // break after boundary index 1 (x=200)
	})

	test('six even measures on pageWidth=350 — prefers 3+3 over 4+2', () => {
		const boundaries = Array.from({ length: 6 }, (_, i) => ({ x: (i + 1) * 100 }))
		const breaks = dpOptimalBreaks(boundaries, 0, 5, 350)
		// Should break into 2 systems of 3 measures (300px each)
		expect(breaks.length).toBe(1)
		expect(breaks[0]).toBe(2) // after 3rd measure
	})

	test('uneven measures — DP balances better than greedy', () => {
		// 4 measures: 200, 150, 150, 100 — total 600
		// pageWidth=350 → greedy would do [200+150=350, 150+100=250]
		// DP should also find that or [200+150, 150+100] = equal split
		const boundaries = [{ x: 200 }, { x: 350 }, { x: 500 }, { x: 600 }]
		const breaks = dpOptimalBreaks(boundaries, 0, 3, 350)
		expect(breaks.length).toBe(1)
		// Should break after boundary 1 (x=350) → system 1 = 350px, system 2 = 250px
		expect(breaks[0]).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// computeSystemBreaks (with forced NWC systemBreak flags)
// ---------------------------------------------------------------------------
describe('computeSystemBreaks', () => {
	test('no boundaries — no breaks', () => {
		expect(computeSystemBreaks([], 500, 50)).toEqual([])
	})

	test('all measures fit — no breaks', () => {
		const boundaries = [{ x: 100 }, { x: 200 }, { x: 300 }]
		const breaks = computeSystemBreaks(boundaries, 500, 50)
		expect(breaks).toEqual([])
	})

	test('forced systemBreak is always respected', () => {
		const boundaries = [
			{ x: 100, systemBreak: false },
			{ x: 200, systemBreak: true },
			{ x: 300, systemBreak: false },
			{ x: 400, systemBreak: false },
		]
		const breaks = computeSystemBreaks(boundaries, 1000, 50)
		// Even though everything fits in 1000px, the forced break should appear
		const breakXs = breaks.map(b => b.x)
		expect(breakXs).toContain(200)
	})

	test('auto-breaks when content exceeds pageWidth', () => {
		// 8 measures, 100px each — pageWidth 350
		const boundaries = Array.from({ length: 8 }, (_, i) => ({
			x: (i + 1) * 100,
			systemBreak: false,
		}))
		const breaks = computeSystemBreaks(boundaries, 350, 50)
		expect(breaks.length).toBeGreaterThan(0)
		// All break X values should be valid barline positions
		breaks.forEach(b => {
			expect(boundaries.some(bd => bd.x === b.x)).toBe(true)
		})
	})
})

// ---------------------------------------------------------------------------
// buildBarlineMap (anchor-based)
// ---------------------------------------------------------------------------
describe('buildBarlineMap', () => {
	test('no anchors — returns zero offsets', () => {
		const map = buildBarlineMap([100, 200], 50)
		expect(map.anchorOffsets).toEqual([])
		expect(map.barlineOffsets).toEqual([0, 0])
	})

	test('fewer than 2 anchors — returns zero offsets', () => {
		const map = buildBarlineMap([100, 200], 50, [50])
		expect(map.anchorOffsets).toEqual([0])
		expect(map.barlineOffsets).toEqual([0, 0])
	})

	test('no extra space — all offsets are 0', () => {
		const map = buildBarlineMap([100, 200, 300], 0, [30, 70, 130, 170, 230, 270])
		map.anchorOffsets.forEach(o => expect(o).toBe(0))
		map.barlineOffsets.forEach(o => expect(o).toBe(0))
	})

	test('extra space is distributed across anchor gaps', () => {
		// 4 anchors at 0, 100, 200, 300 — 3 equal gaps of 100
		// extra = 30 → each gap gets 10 extra
		const anchors = [0, 100, 200, 300]
		const map = buildBarlineMap([300], 30, anchors)
		// First anchor offset is 0
		expect(map.anchorOffsets[0]).toBe(0)
		// Each subsequent anchor gets 10 more offset
		expect(map.anchorOffsets[1]).toBeCloseTo(10, 1)
		expect(map.anchorOffsets[2]).toBeCloseTo(20, 1)
		expect(map.anchorOffsets[3]).toBeCloseTo(30, 1)
	})

	test('gaps are capped at MAX_INTRA_STRETCH, remainder goes to barlines', () => {
		// 2 anchors at 0 and 10, gap = 10
		// MAX_INTRA_STRETCH = 5.0, so maxExtra = 10 * 4.0 = 40
		// extra = 100 → only 40 absorbed by stretch, 60 to barlines
		const anchors = [0, 10]
		const map = buildBarlineMap([100], 100, anchors)
		expect(map.anchorOffsets[1]).toBe(40) // 10 * (5.0 - 1.0)
		expect(map.barlineOffsets[0]).toBeCloseTo(60, 1)
	})

	test('unequal gaps get proportional share', () => {
		// Gap 1 = 100, Gap 2 = 200. totalGap = 300, extra = 30
		// Gap 1 ideal = 30*(100/300) = 10, Gap 2 ideal = 30*(200/300) = 20
		const anchors = [0, 100, 300]
		const map = buildBarlineMap([300], 30, anchors)
		expect(map.anchorOffsets[0]).toBe(0)
		expect(map.anchorOffsets[1]).toBeCloseTo(10, 1)
		expect(map.anchorOffsets[2]).toBeCloseTo(30, 1)
	})

	test('zero-width gaps get 0 extra', () => {
		// Two anchors at same position (e.g. chord notes)
		const anchors = [0, 0, 100]
		const map = buildBarlineMap([100], 20, anchors)
		expect(map.anchorOffsets[0]).toBe(0)
		expect(map.anchorOffsets[1]).toBe(0) // zero gap, zero extra
		expect(map.anchorOffsets[2]).toBeCloseTo(20, 1)
	})
})

// ---------------------------------------------------------------------------
// computeJustifyX (anchor-based)
// ---------------------------------------------------------------------------
describe('computeJustifyX', () => {
	test('no anchors — returns relX unchanged', () => {
		const map = buildBarlineMap([], 0)
		expect(computeJustifyX(75, map)).toBe(75)
	})

	test('no extra space — returns relX unchanged', () => {
		const map = buildBarlineMap([100, 200], 0, [50, 150])
		expect(computeJustifyX(50, map)).toBe(50)
		expect(computeJustifyX(150, map)).toBe(150)
	})

	test('element at anchor position gets exact anchor offset', () => {
		const anchors = [0, 100, 200, 300]
		const map = buildBarlineMap([300], 30, anchors)
		// Anchor at 100 should get offset ~10
		const jx = computeJustifyX(100, map)
		expect(jx).toBeCloseTo(110, 1)
	})

	test('element between anchors snaps to nearest anchor offset', () => {
		const anchors = [0, 100, 200]
		const map = buildBarlineMap([200], 20, anchors)
		// Offset at anchor 0 = 0, offset at anchor 1 = 10
		// Element at 40 (closer to anchor 0) should get anchor 0's offset = 0
		const jxNear0 = computeJustifyX(40, map)
		expect(jxNear0).toBeCloseTo(40, 1) // offset 0

		// Element at 60 (closer to anchor 1) should get anchor 1's offset = 10
		const jxNear1 = computeJustifyX(60, map)
		expect(jxNear1).toBeCloseTo(70, 1) // offset 10
	})

	test('element before first anchor gets first anchor offset', () => {
		const anchors = [50, 150]
		const map = buildBarlineMap([200], 20, anchors)
		// Element at x=10 (before first anchor at 50) gets anchorOffsets[0] = 0
		const jx = computeJustifyX(10, map)
		expect(jx).toBeCloseTo(10, 1) // offset 0 + barlinePad
	})

	test('element after last anchor gets last anchor offset', () => {
		const anchors = [50, 150]
		const map = buildBarlineMap([200], 20, anchors)
		// Element at x=180 (after last anchor at 150) gets anchorOffsets[1]
		const jx = computeJustifyX(180, map)
		const lastOffset = map.anchorOffsets[map.anchorOffsets.length - 1]
		expect(jx).toBeGreaterThanOrEqual(180 + lastOffset)
	})

	test('justified positions are monotonically non-decreasing', () => {
		const anchors = [0, 50, 120, 200, 280, 350]
		const map = buildBarlineMap([150, 350], 60, anchors)

		var prev = -Infinity
		for (var x = 0; x <= 350; x += 1) {
			var jx = computeJustifyX(x, map)
			expect(jx).toBeGreaterThanOrEqual(prev)
			prev = jx
		}
	})

	test('note-unit elements near same anchor get identical offset (rigid)', () => {
		// Two elements close together on the same side of the midpoint
		// between anchors [100, 200] — both snap to anchor 100's offset.
		const anchors = [0, 100, 200, 300]
		const map = buildBarlineMap([300], 30, anchors)

		// Notehead at 100, stem at 115, dot at 125 — all closer to anchor 100
		// than to anchor 200 (midpoint is 150)
		const xHead = computeJustifyX(100, map)
		const xStem = computeJustifyX(115, map)
		const xDot = computeJustifyX(125, map)

		// All should get anchor 100's offset, preserving original gaps
		expect(xStem - xHead).toBe(15) // stem - head gap preserved
		expect(xDot - xHead).toBe(25)  // dot - head gap preserved
	})
})

// ---------------------------------------------------------------------------
// DP balancing — orphan last lines
// ---------------------------------------------------------------------------
describe('DP avoids orphan last lines', () => {
	test('8 even measures prefer 4+4 over 7+1', () => {
		// 8 measures each 100px wide, pageWidth=450
		// 4+4 = 400px each (shortfall 0.11) vs 7+1 = 700+100
		const boundaries = Array.from({ length: 8 }, (_, i) => ({
			x: (i + 1) * 100,
			systemBreak: false,
		}))
		const breaks = computeSystemBreaks(boundaries, 450, 50)
		// Should produce 1 break, splitting into two roughly equal halves
		expect(breaks.length).toBe(1)
		// The last system should have at least 3 measures (not an orphan)
		const lastSystemStart = breaks[breaks.length - 1].x
		const lastSystemMeasures = boundaries.filter(b => b.x > lastSystemStart).length
		expect(lastSystemMeasures).toBeGreaterThanOrEqual(3)
	})

	test('9 even measures prefer 5+4 or 4+5 over 8+1', () => {
		const boundaries = Array.from({ length: 9 }, (_, i) => ({
			x: (i + 1) * 100,
			systemBreak: false,
		}))
		const breaks = computeSystemBreaks(boundaries, 550, 50)
		expect(breaks.length).toBe(1)
		const lastSystemStart = breaks[breaks.length - 1].x
		const lastSystemMeasures = boundaries.filter(b => b.x > lastSystemStart).length
		expect(lastSystemMeasures).toBeGreaterThanOrEqual(3)
	})

	test('last line badness is higher than before for very short lines', () => {
		// A line at 20% fill should still have significant penalty
		const shortLineBadness = computeBadness(100, 500, true) // 80% shortfall
		expect(shortLineBadness).toBeGreaterThan(1) // should be strongly penalized
	})
})

// ---------------------------------------------------------------------------
// Beam/tie endpoint justification
// ---------------------------------------------------------------------------
describe('beam and tie endpoint justification', () => {
	test('beam endpoints at different anchors: span widens', () => {
		// Beam starts at anchor x=100, ends at anchor x=350
		const anchors = [0, 50, 100, 150, 200, 250, 300, 350, 400]
		const map = buildBarlineMap([200, 400], 40, anchors)

		const justStart = computeJustifyX(100, map)
		const justEnd = computeJustifyX(350, map)

		// The justified span should be wider than original (space was added between anchors)
		const origSpan = 350 - 100
		const justSpan = justEnd - justStart
		expect(justSpan).toBeGreaterThan(origSpan)
	})

	test('beam within a single measure: span stretches across anchors', () => {
		// Beam at two different anchor positions
		const anchors = [0, 50, 100, 150, 200, 250, 300]
		const map = buildBarlineMap([300], 30, anchors)

		const justStart = computeJustifyX(50, map)
		const justEnd = computeJustifyX(250, map)

		const origSpan = 200
		const justSpan = justEnd - justStart

		// Should be stretched (different anchors → different offsets)
		expect(justSpan).toBeGreaterThan(origSpan)
	})

	test('tie-like element: width grows when endpoints are at different anchors', () => {
		// Tie start at anchor 50, end near anchor 250
		const anchors = [0, 50, 100, 150, 200, 250, 300, 350, 400]
		const map = buildBarlineMap([200, 400], 60, anchors)

		const origX = 50
		const origWidth = 200
		const origEndAbsX = origX + origWidth // 250

		const justStart = computeJustifyX(origX, map)
		const justEnd = computeJustifyX(origEndAbsX, map)
		const justWidth = justEnd - justStart

		// Width should increase (space added between anchors)
		expect(justWidth).toBeGreaterThan(origWidth)
	})

	test('beam endpoints in same anchor half get same offset (rigid)', () => {
		const anchors = [0, 100, 200, 300, 400]
		const map = buildBarlineMap([200, 400], 20, anchors)

		// Two elements both closer to anchor 0 (within [0, 50) midpoint)
		const b1Start = computeJustifyX(10, map)
		const b1End = computeJustifyX(40, map)

		// Gap should be preserved exactly (both get anchor 0's offset)
		expect(b1End - b1Start).toBe(30)
	})
})

// ---------------------------------------------------------------------------
// Last-line barline alignment
// ---------------------------------------------------------------------------
describe('last system final barline alignment', () => {
	test('justified last system: final barline aligns to page edge', () => {
		// Simulate a last system that fills > 20% of contentWidth.
		// Natural width = 400, pageWidth = 500 → fillRatio = 0.8 → should justify.
		// The last barline is at relX = 400 (natural end of content).
		// After justification, it should land at contentWidth = 500.
		const naturalWidth = 400
		const contentWidth = 500
		const extraSpace = contentWidth - naturalWidth // 100

		// Anchors evenly spaced across the system
		const anchors = [0, 50, 100, 150, 200, 250, 300, 350, 400]
		const relBarXs = [200, 400]

		const map = buildBarlineMap(relBarXs, extraSpace, anchors)

		// The last barline (at relX = 400) is also the last anchor.
		// Its justified position should be naturalWidth + totalOffset = contentWidth.
		const justifiedEnd = computeJustifyX(400, map)
		expect(justifiedEnd).toBeCloseTo(contentWidth, 0)
	})

	test('unjustified last system: stave width matches natural width', () => {
		// Natural width = 90, pageWidth = 500 → fillRatio = 0.18 → should NOT justify.
		// extraSpace = 0, so barline stays at its natural position.
		const naturalWidth = 90
		const extraSpace = 0

		const anchors = [0, 30, 60, 90]
		const relBarXs = [45, 90]

		const map = buildBarlineMap(relBarXs, extraSpace, anchors)

		const justifiedEnd = computeJustifyX(90, map)
		expect(justifiedEnd).toBe(90) // no shift
	})

	test('justified system: total anchor offset equals extraSpace absorbed', () => {
		// When all extra space can be absorbed by anchor gaps (no cap overflow),
		// the last anchor's offset should equal the full extraSpace.
		const anchors = [0, 100, 200, 300]
		const extraSpace = 30 // 10% of total gap span (300) — well under cap
		const map = buildBarlineMap([300], extraSpace, anchors)

		const lastOffset = map.anchorOffsets[map.anchorOffsets.length - 1]
		// With no barline overflow, last anchor offset should be ~ extraSpace
		expect(lastOffset).toBeCloseTo(extraSpace, 1)
	})

	test('justified system with barline overflow: anchor + barline offsets sum correctly', () => {
		// Tiny anchor gap that caps quickly, forcing overflow to barlines.
		const anchors = [0, 10]
		const extraSpace = 100
		const map = buildBarlineMap([100], extraSpace, anchors)

		// At the last barline (relX = 100, which is after last anchor),
		// the total shift should be anchorOffset + barlinePad.
		const justifiedBarline = computeJustifyX(100, map)
		const totalShift = justifiedBarline - 100
		// anchorOffset for last anchor + barlineOffset at barline 100
		const anchorShift = map.anchorOffsets[map.anchorOffsets.length - 1]
		const barShift = map.barlineOffsets[map.barlineOffsets.length - 1]
		expect(totalShift).toBeCloseTo(anchorShift + barShift, 1)
		expect(totalShift).toBeCloseTo(extraSpace, 1)
	})
})
