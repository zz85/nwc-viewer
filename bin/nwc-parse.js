#!/usr/bin/env node

import { readFileSync } from 'fs';
import { decodeNwcArrayBuffer } from '../src/nwc.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
	console.log(`
Usage: nwc-parse [options] <file.nwc>

Options:
  -h, --help     Show this help message
  -j, --json     Output as JSON (default)
  -p, --pretty   Pretty print JSON output

Examples:
  nwc-parse file.nwc
  nwc-parse --pretty file.nwc
`);
	process.exit(0);
}

const pretty = args.includes('-p') || args.includes('--pretty');
const filePath = args.find(arg => !arg.startsWith('-'));

if (!filePath) {
	console.error('Error: No file specified');
	process.exit(1);
}

try {
	const buffer = readFileSync(filePath);
	const data = decodeNwcArrayBuffer(buffer.buffer);
	console.log(JSON.stringify(data, null, pretty ? 2 : 0));
} catch (err) {
	console.error('Error:', err.message);
	process.exit(1);
}
