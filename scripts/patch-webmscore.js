#!/usr/bin/env bun
// Patch webmscore for Bun / Node 18+ compatibility.
// The Emscripten WASM loader inside webmscore.nodejs.cjs uses fetch() for
// the WASM binary, which fails under Bun (fetch doesn't accept bare paths).
// Fix: pre-supply wasmBinary via fs.readFileSync so it skips the fetch path.

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const file = join(import.meta.dir, '../node_modules/webmscore/webmscore.nodejs.cjs')

let src
try {
	src = readFileSync(file, 'utf-8')
} catch {
	// webmscore not installed, skip
	process.exit(0)
}

const needle = `getPreloadedPackage(remotePackageName) {
            const buf = require('fs').readFileSync(remotePackageName).buffer;
            return buf
        }
    }`

const replacement = `getPreloadedPackage(remotePackageName) {
            const buf = require('fs').readFileSync(remotePackageName).buffer;
            return buf
        },
        // Pre-supply WASM binary so Emscripten skips fetch() (fixes Bun / Node 18+)
        wasmBinary: require('fs').readFileSync(
            require('path').join(__dirname, 'webmscore.lib.wasm')
        ),
    }`

if (src.includes('wasmBinary:')) {
	console.log('[postinstall] webmscore already patched, skipping.')
	process.exit(0)
}

if (!src.includes(needle)) {
	console.error('[postinstall] webmscore patch target not found — version may have changed.')
	process.exit(1)
}

writeFileSync(file, src.replace(needle, replacement))
console.log('[postinstall] webmscore patched for Bun/Node 18+ WASM loading.')
