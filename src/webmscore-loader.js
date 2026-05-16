/**
 * Lazy loader for the vendored WebMscore WASM library.
 *
 * WebMscore (~3MB WASM + ~17MB data) is only loaded when needed — i.e.,
 * when the user opens a MuseScore file with the WebMscore pipeline enabled.
 *
 * Hardened with:
 * - Load timeout (default 30s) to prevent indefinite hangs
 * - Script tag cleanup on failure (no orphaned DOM elements)
 * - Retry support (state resets on failure so next call retries)
 * - Empty output detection in exportMusicXML
 * - Safe score.destroy() in finally blocks
 *
 * Usage:
 *   const xml = await exportMusicXML(arrayBuffer, filename)
 */

const DEFAULT_TIMEOUT_MS = 30000

let loadPromise = null
let loaded = false
let scriptEl = null

/**
 * Ensure the WebMscore library is loaded. Loads the script tag on first call,
 * then waits for the global to appear. Subsequent calls return immediately.
 *
 * @param {number} [timeoutMs=30000] — maximum time to wait for load
 * @returns {Promise<Object>} — the WebMscore global
 */
export async function ensureWebMscore(timeoutMs = DEFAULT_TIMEOUT_MS) {
	if (loaded && window.WebMscore) return window.WebMscore

	if (!loadPromise) {
		loadPromise = new Promise((resolve, reject) => {
			// Check if already loaded (e.g., by a <script> tag in HTML)
			if (window.WebMscore) {
				loaded = true
				resolve(window.WebMscore)
				return
			}

			let timer = null

			function cleanup() {
				if (timer) { clearTimeout(timer); timer = null }
				if (scriptEl && scriptEl.parentNode) {
					scriptEl.parentNode.removeChild(scriptEl)
				}
				scriptEl = null
				loadPromise = null  // allow retry on next call
			}

			// Timeout to prevent indefinite hangs
			timer = setTimeout(() => {
				cleanup()
				reject(new Error(
					`WebMscore load timed out after ${timeoutMs}ms. ` +
					'The WASM library may be too large for the current network, or the file may be missing.'
				))
			}, timeoutMs)

			// Dynamically inject the script
			scriptEl = document.createElement('script')
			scriptEl.src = 'vendor/webmscore/webmscore.js'
			scriptEl.onload = () => {
				if (timer) { clearTimeout(timer); timer = null }
				if (window.WebMscore) {
					loaded = true
					resolve(window.WebMscore)
				} else {
					cleanup()
					reject(new Error(
						'WebMscore script loaded but WebMscore global not found. ' +
						'The vendor file may be corrupt or incompatible.'
					))
				}
			}
			scriptEl.onerror = () => {
				cleanup()
				reject(new Error(
					'Failed to load vendor/webmscore/webmscore.js. ' +
					'Ensure the WebMscore WASM library is vendored at vendor/webmscore/.'
				))
			}
			document.head.appendChild(scriptEl)
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
	let score
	try {
		score = await WebMscore.load(format, data)
	} catch (err) {
		throw new Error(`WebMscore failed to load "${filename}": ${err.message}`)
	}

	try {
		const xml = await score.saveXml()
		if (!xml || xml.trim().length === 0) {
			throw new Error(
				`WebMscore produced empty MusicXML output for "${filename}". ` +
				'The file may use an unsupported MuseScore version or format.'
			)
		}
		return xml
	} finally {
		try { score.destroy() } catch (_) { /* ignore destroy errors */ }
	}
}

/**
 * Check whether WebMscore is available (already loaded).
 */
export function isWebMscoreAvailable() {
	return !!window.WebMscore || loaded
}

/**
 * Reset the loader state. Useful for recovery after errors or for testing.
 * Removes the injected script tag if present and clears all cached state,
 * so the next ensureWebMscore() call will attempt a fresh load.
 */
export function resetWebMscore() {
	if (loadPromise) loadPromise = null
	loaded = false
	if (scriptEl && scriptEl.parentNode) {
		scriptEl.parentNode.removeChild(scriptEl)
	}
	scriptEl = null
}
