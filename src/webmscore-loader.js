/**
 * Lazy loader for the vendored WebMscore WASM library.
 *
 * WebMscore (~3MB WASM + ~17MB data) is only loaded when needed — i.e.,
 * when the user opens a MuseScore file with the WebMscore pipeline enabled.
 *
 * Usage:
 *   const score = await loadWebMscoreScore(arrayBuffer, filename)
 *   const musicxml = await score.saveXml()
 *   score.destroy()
 */

let loadPromise = null
let loaded = false

/**
 * Ensure the WebMscore library is loaded. Loads the script tag on first call,
 * then waits for WebMscore.ready. Subsequent calls return immediately.
 */
export async function ensureWebMscore() {
	if (loaded && window.WebMscore) return window.WebMscore

	if (!loadPromise) {
		loadPromise = new Promise((resolve, reject) => {
			// Check if already loaded (e.g., by a <script> tag in HTML)
			if (window.WebMscore) {
				loaded = true
				resolve(window.WebMscore)
				return
			}

			// Dynamically inject the script
			const script = document.createElement('script')
			script.src = 'vendor/webmscore/webmscore.js'
			script.onload = () => {
				if (window.WebMscore) {
					loaded = true
					resolve(window.WebMscore)
				} else {
					reject(new Error('WebMscore script loaded but WebMscore global not found'))
				}
			}
			script.onerror = () => {
				loadPromise = null
				reject(new Error('Failed to load vendor/webmscore/webmscore.js'))
			}
			document.head.appendChild(script)
		})
	}

	return loadPromise
}

/**
 * Load a MuseScore file and export as MusicXML string.
 *
 * @param {ArrayBuffer} buffer — the .mscz or .mscx file bytes
 * @param {string} filename — used to detect format (mscz vs mscx)
 * @returns {Promise<string>} — MusicXML XML string
 */
export async function exportMusicXML(buffer, filename) {
	const WebMscore = await ensureWebMscore()

	const ext = filename.split('.').pop().toLowerCase()
	const format = ext === 'mscz' ? 'mscz' : 'mscx'

	const data = new Uint8Array(buffer)
	const score = await WebMscore.load(format, data)

	try {
		const xml = await score.saveXml()
		return xml
	} finally {
		score.destroy()
	}
}

/**
 * Check whether WebMscore is available (already loaded or loadable).
 */
export function isWebMscoreAvailable() {
	return !!window.WebMscore || loaded
}
