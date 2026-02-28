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
// buildBarlineMap
// ---------------------------------------------------------------------------
describe('buildBarlineMap', () => {
	test('no barlines — identity map', () => {
		const map = buildBarlineMap([], 100)
		expect(map.relBarXs).toEqual([])
		expect(map.measureStretchFactors).toEqual([1.0])
	})

	test('no extra space — all factors are 1.0', () => {
		const map = buildBarlineMap([100, 200, 300], 0)
		expect(map.cumulativeBarPadding).toEqual([0, 0, 0])
		map.measureStretchFactors.forEach(f => expect(f).toBe(1.0))
	})

	test('small extra space — distributed within measures', () => {
		// 3 measures: [0-100, 100-200, 200-300], natural width=300, extra=30
		// 10% extra → factor should be ~1.1 (under 1.3 cap)
		const map = buildBarlineMap([100, 200, 300], 30)
		map.measureStretchFactors.forEach(f => {
			expect(f).toBeGreaterThan(1.0)
			expect(f).toBeLessThanOrEqual(1.3)
		})
		// All extra should be absorbed by intra-measure stretch (no bar padding)
		map.cumulativeBarPadding.forEach(p => {
			expect(Math.abs(p)).toBeLessThan(0.01)
		})
	})

	test('large extra space — capped at MAX_INTRA_STRETCH, rest goes to barlines', () => {
		// 3 measures: [0-100, 100-200, 200-300], natural width=300, extra=200
		// 66% extra → uncapped factor=1.66 > 1.3 cap
		const map = buildBarlineMap([100, 200, 300], 200)
		map.measureStretchFactors.forEach(f => {
			expect(f).toBeLessThanOrEqual(1.3)
		})
		// Bar padding should be non-zero (remaining space after capping)
		const lastPadding = map.cumulativeBarPadding[map.cumulativeBarPadding.length - 1]
		expect(lastPadding).toBeGreaterThan(0)
	})

	test('measures get proportional share of extra space', () => {
		// Measure 1 = 200px, measure 2 = 100px — wider measure gets more extra
		const map = buildBarlineMap([200, 300], 30)
		// Stretch factors should be equal (proportional share means same %)
		expect(map.measureStretchFactors[0]).toBeCloseTo(map.measureStretchFactors[1], 2)
	})
})

// ---------------------------------------------------------------------------
// computeJustifyX
// ---------------------------------------------------------------------------
describe('computeJustifyX', () => {
	test('no barlines — returns relX unchanged', () => {
		const map = buildBarlineMap([], 0)
		expect(computeJustifyX(75, map)).toBe(75)
	})

	test('no extra space — returns relX unchanged', () => {
		const map = buildBarlineMap([100, 200], 0)
		expect(computeJustifyX(50, map)).toBe(50)
		expect(computeJustifyX(150, map)).toBe(150)
	})

	test('elements within a measure stay proportionally spaced', () => {
		// 2 equal measures [0-200, 200-400], extra=40
		const map = buildBarlineMap([200, 400], 40)

		// Two elements in the first measure at 100 and 112 (simulating notehead + dot)
		const x1 = computeJustifyX(100, map)
		const x2 = computeJustifyX(112, map)

		// Their gap should be stretched by the intra-measure factor, not arbitrarily
		const originalGap = 12
		const newGap = x2 - x1
		const factor = newGap / originalGap

		// Factor should be between 1.0 and 1.3 (MAX_INTRA_STRETCH)
		expect(factor).toBeGreaterThanOrEqual(1.0)
		expect(factor).toBeLessThanOrEqual(1.3)
	})

	test('elements in different measures get different offsets', () => {
		const map = buildBarlineMap([200, 400], 100)

		// Element in measure 1 at relX=100
		const x1 = computeJustifyX(100, map)
		// Element in measure 2 at relX=300 (same relative position within its measure)
		const x2 = computeJustifyX(300, map)

		// x2 should be shifted more than x1 (cumulative spacing)
		expect(x2 - 300).toBeGreaterThan(x1 - 100)
	})

	test('barline element gets correct offset', () => {
		const map = buildBarlineMap([200, 400], 40)

		// An element exactly at the first barline (x=200)
		const xAtBar = computeJustifyX(200, map)

		// Should be displaced rightward from 200
		expect(xAtBar).toBeGreaterThan(200)
	})

	test('justified positions are monotonically increasing', () => {
		const map = buildBarlineMap([150, 300, 450], 90)

		var prev = -1
		for (var x = 0; x <= 450; x += 10) {
			var jx = computeJustifyX(x, map)
			expect(jx).toBeGreaterThanOrEqual(prev)
			prev = jx
		}
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
	test('beam-like element: both endpoints get independent justification', () => {
		// Simulate a beam: el.x = first stem X, el.endX = relative distance to last stem
		const map = buildBarlineMap([200, 400], 40)

		// Beam starts at x=100 (in measure 1), ends at x=350 (in measure 2)
		const origStartX = 100
		const origEndAbsX = 350

		const justStart = computeJustifyX(origStartX, map)
		const justEnd = computeJustifyX(origEndAbsX, map)

		// The justified span should be wider than original (space was added)
		const origSpan = origEndAbsX - origStartX
		const justSpan = justEnd - justStart
		expect(justSpan).toBeGreaterThan(origSpan)
	})

	test('beam within a single measure: span scales by intra-measure factor', () => {
		const map = buildBarlineMap([300], 30)

		// Beam entirely within measure 0
		const justStart = computeJustifyX(50, map)
		const justEnd = computeJustifyX(250, map)

		const origSpan = 200
		const justSpan = justEnd - justStart

		// Should be stretched by the intra-measure factor (> 1.0, <= 1.3x)
		expect(justSpan / origSpan).toBeGreaterThan(1.0)
		expect(justSpan / origSpan).toBeLessThanOrEqual(1.3)
	})

	test('tie-like element: width recomputed from justified endpoints', () => {
		const map = buildBarlineMap([200, 400], 60)

		// Tie starts at x=80, width=140 (ends at 220 — crosses barline at 200)
		const origX = 80
		const origWidth = 140
		const origEndAbsX = origX + origWidth

		const justStart = computeJustifyX(origX, map)
		const justEnd = computeJustifyX(origEndAbsX, map)
		const justWidth = justEnd - justStart

		// Width should increase (space added at barline between start and end)
		expect(justWidth).toBeGreaterThan(origWidth)
	})

	test('beam endpoints in same measure have consistent stretch', () => {
		const map = buildBarlineMap([200, 400], 20)

		// Two beams entirely within measure 0
		const b1Start = computeJustifyX(30, map)
		const b1End = computeJustifyX(90, map)
		const b2Start = computeJustifyX(100, map)
		const b2End = computeJustifyX(180, map)

		// Both should have the same stretch factor
		const factor1 = (b1End - b1Start) / (90 - 30)
		const factor2 = (b2End - b2Start) / (180 - 100)
		expect(factor1).toBeCloseTo(factor2, 4)
	})
})
