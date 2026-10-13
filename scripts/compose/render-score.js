#!/usr/bin/env node
// Render a score in Notably to PNG, to look at it:
//   node scripts/compose/render-score.js <file> [--out score.png] [--mode wrap|page|scroll]
//        [--width 1280] [--height 3000] [--hidden]
// Serves the repo on a free local port, opens the viewer in headless Chromium,
// loads the file and saves the score canvas. --hidden turns on "Show hidden
// items". Prints the page errors, if any.
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { extname, join, resolve } from 'path'
import { createRequire } from 'module'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`)
	return i >= 0 ? args[i + 1] : fallback
}
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!file) {
	console.error('usage: render-score.js <file> [--out score.png] [--mode wrap|page|scroll] [--width 1280] [--height 3000] [--hidden]')
	process.exit(2)
}
const root = resolve(new URL('../../', import.meta.url).pathname)
const out = opt('out', file.replace(/\.[^.]+$/, '') + '.png')
const mode = opt('mode', 'wrap')
const width = +opt('width', 1280)
const height = +opt('height', 3000)

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
	let path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
	if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
	if (!path.startsWith(root) || !existsSync(path)) {
		res.writeHead(404)
		return res.end()
	}
	res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' })
	res.end(readFileSync(path))
})
await new Promise(ok => server.listen(0, '127.0.0.1', ok))
const base = `http://127.0.0.1:${server.address().port}/`

const { chromium } = createRequire(join(root, 'package.json'))('playwright')
const browser = await chromium.launch()
try {
	const page = await (await browser.newContext({ viewport: { width, height } })).newPage()
	const errors = []
	page.on('pageerror', e => errors.push(e.message))
	await page.goto(base)
	await page.evaluate((m) => {
		localStorage.clear()
		localStorage.setItem('nwc_layout_mode', m)
		localStorage.setItem('nwc_page_view_mode', 'vertical')
		localStorage.setItem('nwc_piano_visible', 'false')
	}, mode)
	await page.goto(base)
	await page.waitForFunction(() => typeof window.processData === 'function')
	await page.waitForTimeout(1500)
	const bytes = Array.from(readFileSync(file))
	await page.evaluate(([b, name]) => {
		window.__renderComplete = null
		window.processData(new Uint8Array(b), name)
	}, [bytes, file.split('/').pop()])
	await page.waitForFunction(() => window.__renderComplete != null, null, { timeout: 30000 })
	if (args.includes('--hidden')) {
		await page.evaluate(async () => {
			const c = await import('/src/constants.js')
			c.setShowHiddenItems(true)
			window.__renderComplete = null
			window.rerender()
		})
		await page.waitForFunction(() => window.__renderComplete != null, null, { timeout: 30000 })
	}
	await page.waitForTimeout(500)
	const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
	writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'))
	console.log(`wrote ${out}`)
	if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '))
} finally {
	await browser.close()
	server.close()
}
