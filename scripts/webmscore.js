#!/usr/bin/env bun
/**
 * webmscore CLI utility — load MuseScore files and extract data via libmscore WASM.
 *
 * Usage:
 *   bun scripts/webmscore.js <file.mscz> [command]
 *
 * Commands:
 *   info       Show score metadata (default)
 *   xml        Export MusicXML to stdout
 *   midi       Export MIDI to file
 *   svg <n>    Export SVG for page n (0-indexed) to stdout
 *   parts      List parts/excerpts
 *   all        Export MusicXML + MIDI + SVG to files alongside the source
 */

import WebMscore from 'webmscore'
import { readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join, extname } from 'path'

// ── Format detection ────────────────────────────────────────────
const FORMAT_MAP = {
	'.mscz': 'mscz', '.mscx': 'mscx',
	'.mxl': 'mxl', '.musicxml': 'musicxml', '.xml': 'xml',
	'.mid': 'midi', '.midi': 'midi', '.kar': 'kar',
}

// ── CLI args ────────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
	console.log(`Usage: bun scripts/webmscore.js <file> [command]

Commands:
  info       Score metadata (default)
  xml        Export MusicXML to stdout
  midi       Export MIDI to <name>.mid
  svg [n]    Export SVG page n (default 0) to stdout
  parts      List parts/excerpts
  all        Export MusicXML + MIDI + all SVG pages to files`)
	process.exit(0)
}

const filePath = args[0]
const command = args[1] || 'info'
const ext = extname(filePath).toLowerCase()
const format = FORMAT_MAP[ext]

if (!format) {
	console.error(`Unsupported format: ${ext}`)
	process.exit(1)
}

// ── Init ────────────────────────────────────────────────────────
await WebMscore.ready

const data = readFileSync(filePath)
const score = await WebMscore.load(format, new Uint8Array(data))
const base = basename(filePath, ext)
const dir = dirname(filePath)

// ── Commands ────────────────────────────────────────────────────
switch (command) {
	case 'info': {
		const meta = await score.metadata()
		const npages = await score.npages()
		console.log(`Title:      ${meta.title}`)
		console.log(`Composer:   ${meta.composer}`)
		console.log(`Pages:      ${npages}`)
		console.log(`Measures:   ${meta.measures}`)
		console.log(`Duration:   ${Math.floor(meta.duration / 60)}m ${Math.round(meta.duration % 60)}s`)
		console.log(`Time Sig:   ${meta.timesig}`)
		console.log(`Key Sig:    ${meta.keysig}`)
		console.log(`Tempo:      ${meta.tempoText || (meta.tempo ? `${Math.round(meta.tempo * 60)} BPM` : '—')}`)
		console.log(`Has Lyrics: ${meta.hasLyrics}`)
		console.log(`Parts:      ${meta.parts.map(p => p.name).join(', ')}`)
		console.log(`Format Ver: ${meta.fileVersion}`)
		break
	}

	case 'xml': {
		const xml = await score.saveXml()
		const out = typeof xml === 'string' ? xml : new TextDecoder().decode(xml)
		process.stdout.write(out)
		break
	}

	case 'midi': {
		const midi = await score.saveMidi()
		const outPath = join(dir, `${base}.mid`)
		writeFileSync(outPath, midi)
		console.error(`Wrote: ${outPath} (${(midi.length / 1024).toFixed(1)} KB)`)
		break
	}

	case 'svg': {
		const pageIdx = parseInt(args[2] || '0')
		const npages = await score.npages()
		if (pageIdx < 0 || pageIdx >= npages) {
			console.error(`Page ${pageIdx} out of range (0-${npages - 1})`)
			process.exit(1)
		}
		const svg = await score.saveSvg(pageIdx, true)
		process.stdout.write(svg)
		break
	}

	case 'parts': {
		const meta = await score.metadata()
		console.log('Parts:')
		meta.parts.forEach((p, i) => {
			console.log(`  ${i}: ${p.name} (${p.instrumentName}, MIDI program ${p.program})`)
		})
		if (meta.excerpts?.length) {
			console.log('\nExcerpts:')
			meta.excerpts.forEach(e => {
				console.log(`  id=${e.id}: ${e.title} — parts: ${e.parts.map(p => p.name).join(', ')}`)
			})
		}
		break
	}

	case 'all': {
		// MusicXML
		const xml = await score.saveXml()
		const xmlPath = join(dir, `${base}.musicxml`)
		writeFileSync(xmlPath, xml)
		console.log(`MusicXML: ${xmlPath} (${(xml.length / 1024).toFixed(1)} KB)`)

		// MIDI
		const midi = await score.saveMidi()
		const midPath = join(dir, `${base}.mid`)
		writeFileSync(midPath, midi)
		console.log(`MIDI:     ${midPath} (${(midi.length / 1024).toFixed(1)} KB)`)

		// SVG pages
		const npages = await score.npages()
		for (let i = 0; i < npages; i++) {
			const svg = await score.saveSvg(i, true)
			const svgPath = join(dir, `${base}-page${i + 1}.svg`)
			writeFileSync(svgPath, svg)
			console.log(`SVG p${i + 1}:   ${svgPath}`)
		}
		break
	}

	default:
		console.error(`Unknown command: ${command}`)
		process.exit(1)
}

score.destroy()
