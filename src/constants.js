// TODO it's no longer a constant, we should find a better name for this file
let FONT_SIZE = 28

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
// 'wrap' breaks measures into systems that fit the available page/canvas width;
// 'page' renders on fixed-size pages (Letter/A4) like a PDF viewer.
let layoutMode = 'wrap'

function setLayoutMode(mode) {
	if (mode === 'scroll' || mode === 'wrap' || mode === 'page') layoutMode = mode
}

function getLayoutMode() {
	return layoutMode
}

// Page size for 'page' layout mode (dimensions at 96 DPI).
const PAGE_SIZES = {
	letter: { width: 816, height: 1056, label: 'Letter (8.5×11")' },
	a4:     { width: 794, height: 1123, label: 'A4 (210×297mm)' },
}

let pageSize = 'letter'

function setPageSize(size) {
	if (size in PAGE_SIZES) pageSize = size
}

function getPageSize() {
	return pageSize
}

// Page orientation — 'portrait' uses the page as-is; 'landscape' swaps width/height.
let pageOrientation = 'portrait'

function setPageOrientation(orient) {
	if (orient === 'portrait' || orient === 'landscape') pageOrientation = orient
}

function getPageOrientation() {
	return pageOrientation
}

function getPageDimensions() {
	const base = PAGE_SIZES[pageSize]
	if (pageOrientation === 'landscape') {
		return { width: base.height, height: base.width, label: base.label }
	}
	return base
}

// Page margins (in score-space px at 96 DPI)
const PAGE_MARGINS = { top: 72, bottom: 72, left: 72, right: 72 }

function getPageMargins() {
	return PAGE_MARGINS
}

// Music font selection — which SMuFL-compliant font to use for engraving.
// Each entry maps a display name to its OTF file path and optional companion
// text font CSS family name (loaded via @font-face in index.html).
// Fonts without a dedicated text companion fall back to serif.
const MUSIC_FONTS = {
	bravura:    { label: 'Bravura',    path: 'vendor/bravura-1.211/otf/Bravura.otf', textFamily: 'BravuraText' },
	petaluma:   { label: 'Petaluma',   path: 'vendor/fonts/Petaluma.otf',             textFamily: 'PetalumaText' },
	leland:     { label: 'Leland',     path: 'vendor/fonts/Leland.otf',               textFamily: 'LelandText' },
	sebastian:  { label: 'Sebastian',  path: 'vendor/fonts/Sebastian.otf',            textFamily: 'SebastianText' },
	goldenage:  { label: 'Golden Age', path: 'vendor/fonts/GoldenAge.otf',            textFamily: null },
	leipzig:    { label: 'Leipzig',    path: 'vendor/fonts/Leipzig.otf',              textFamily: null },
	maestro:    { label: 'Finale Maestro',   path: 'vendor/fonts/FinaleMaestro.otf',   textFamily: 'FinaleMaestroText' },
	broadway:   { label: 'Finale Broadway',  path: 'vendor/fonts/FinaleBroadway.otf',  textFamily: 'FinaleBroadwayText' },
	ash:        { label: 'Finale Ash',       path: 'vendor/fonts/FinaleAsh.otf',       textFamily: 'FinaleAshText' },
	engraver:   { label: 'Finale Engraver',  path: 'vendor/fonts/FinaleEngraver.otf',  textFamily: null },
	jazz:       { label: 'Finale Jazz',      path: 'vendor/fonts/FinaleJazz.otf',      textFamily: 'FinaleJazzText' },
	legacy:     { label: 'Finale Legacy',    path: 'vendor/fonts/FinaleLegacy.otf',    textFamily: null },
}

// Fallback stack used when a music font has no companion text font.
const TEXT_FONT_FALLBACK = "serif"

let musicFont = 'bravura'

function setMusicFont(id) {
	if (id in MUSIC_FONTS) musicFont = id
}

function getMusicFont() {
	return musicFont
}

function getMusicFontPath() {
	return MUSIC_FONTS[musicFont].path
}

/**
 * Returns the CSS font-family string for text elements (lyrics, titles, etc.)
 * that should match the current music font's style.
 */
function getMusicTextFamily() {
	const tf = MUSIC_FONTS[musicFont].textFamily
	return tf ? `'${tf}', ${TEXT_FONT_FALLBACK}` : TEXT_FONT_FALLBACK
}

// Spacing model — 'current' uses the legacy sqrt-based spacing with anchor
// gap stretching; 'spring' uses Ross/Gould-based spring-rod justification
// where each note has a rigid rod (physical width) and an elastic spring
// (duration-proportional gap) that compresses or stretches to fill the system.
let spacingModel = 'spring'

function setSpacingModel(m) {
	if (m === 'current' || m === 'spring') spacingModel = m
}

function getSpacingModel() {
	return spacingModel
}

// Spacing density — controls the base spring unit multiplier.
// Quarter-note spring = rossRatio * fontSize * springDensity.
// Default 1.5: tighter at ~0.5, looser at ~3.0.
// Also scales the legacy model's sqrt-based padding proportionally.
let springDensity = 1.5

function setSpringDensity(n) {
	springDensity = Math.max(0.5, Math.min(3.0, n))
}

function getSpringDensity() {
	return springDensity
}

// Rod-spring balance — controls what fraction of each inter-note gap is
// treated as elastic spring vs rigid rod during justification.
// At 0.0 all gaps are rigid (no stretching); at 1.0 (default) springs are
// at full Ross/Gould values; above 1.0 springs dominate even more.
let rodSpringBalance = 1.0

function setRodSpringBalance(n) {
	rodSpringBalance = Math.max(0.0, Math.min(2.0, n))
}

function getRodSpringBalance() {
	return rodSpringBalance
}

// Duration proportionality — how much note duration affects horizontal spacing.
// At 0 (visual): all notes get the same spring width regardless of duration.
// At 1 (default): standard Ross/Gould engraving ratios (quarter = 1.0, half ≈ 1.4).
// At 2 (timing): exaggerated duration differences approaching linear.
// Interpolates: effectiveRatio = 1 + (rossRatio - 1) * proportionality
let durationProportionality = 1.0

function setDurationProportionality(n) {
	durationProportionality = Math.max(0.0, Math.min(2.0, n))
}

function getDurationProportionality() {
	return durationProportionality
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
	setSpacingModel,
	getSpacingModel,
	setSpringDensity,
	getSpringDensity,
	setRodSpringBalance,
	getRodSpringBalance,
	setDurationProportionality,
	getDurationProportionality,
	setZoomLevel,
	getZoomLevel,
	ZOOM_MIN,
	ZOOM_MAX,
	setLayoutMode,
	getLayoutMode,
	PAGE_SIZES,
	setPageSize,
	getPageSize,
	setPageOrientation,
	getPageOrientation,
	getPageDimensions,
	getPageMargins,
	MUSIC_FONTS,
	setMusicFont,
	getMusicFont,
	getMusicFontPath,
	getMusicTextFamily,
})

export {
	isNode, isBrowser,
	FONT_SIZE, setFontSize, getFontSize,
	setSpacingModel, getSpacingModel,
	setSpringDensity, getSpringDensity,
	setRodSpringBalance, getRodSpringBalance,
	setDurationProportionality, getDurationProportionality,
	setZoomLevel, getZoomLevel, ZOOM_MIN, ZOOM_MAX,
	setLayoutMode, getLayoutMode,
	PAGE_SIZES, setPageSize, getPageSize,
	setPageOrientation, getPageOrientation,
	getPageDimensions, getPageMargins,
	MUSIC_FONTS, setMusicFont, getMusicFont, getMusicFontPath, getMusicTextFamily,
}
