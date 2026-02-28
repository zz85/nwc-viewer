// TODO it's no longer a constant, we should find a better name for this file
let FONT_SIZE = 60 // 42

// Stave space
// 1-1.25 key 1-1.5 timesig 2 note p.42

function setFontSize(n) {
	// Clamp to a safe range: below ~12 px, glyphs become unreadable and line
	// widths degenerate; 0 or negative causes division-by-zero / infinite loops.
	// Above ~240 px, a single staff barely fits a screen — further zoom is
	// unlikely to be useful.
	FONT_SIZE = Math.max(12, Math.min(240, n))
}

function getFontSize() {
	return FONT_SIZE
}

// Layout mode — 'scroll' renders all measures on one infinite horizontal line;
// 'wrap' breaks measures into systems that fit the available page/canvas width.
let layoutMode = 'wrap'

function setLayoutMode(mode) {
	if (mode === 'scroll' || mode === 'wrap') layoutMode = mode
}

function getLayoutMode() {
	return layoutMode
}

// Visual zoom level — applied as a canvas transform in quickDraw().
// This does NOT trigger a re-layout; it simply scales the rendered output.
// Use setFontSize() to change the actual music engraving size (requires re-layout).
let zoomLevel = 1.0
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4.0

function setZoomLevel(n) {
	zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n))
}

function getZoomLevel() {
	return zoomLevel
}

function isNode() {
	return typeof module !== 'undefined'
}

function isBrowser() {
	return typeof window !== 'undefined'
}

Object.assign(!isBrowser() ? global : window, {
	isNode,
	isBrowser,
	FONT_SIZE,
	setFontSize,
	getFontSize,
	setZoomLevel,
	getZoomLevel,
	ZOOM_MIN,
	ZOOM_MAX,
	setLayoutMode,
	getLayoutMode,
})

export {
	isNode, isBrowser,
	FONT_SIZE, setFontSize, getFontSize,
	setZoomLevel, getZoomLevel, ZOOM_MIN, ZOOM_MAX,
	setLayoutMode, getLayoutMode,
}
