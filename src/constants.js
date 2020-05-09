// TODO it's no longer a constant, we should find a better name for this file
let FONT_SIZE = 60 // 42

// Stave space
// 1-1.25 key 1-1.5 timesig 2 note p.42

function setFontSize(n) {
	FONT_SIZE = n
}

function getFontSize() {
	return FONT_SIZE
}

function isNode() {
	return typeof module !== 'undefined'
}

function isBrowser() {
	return typeof window !== 'undefined'
}

Object.assign(isNode() ? global : window, {
	isNode,
	isBrowser,
	FONT_SIZE,
	setFontSize,
	getFontSize,
})

export { isNode, isBrowser, FONT_SIZE, setFontSize, getFontSize }
