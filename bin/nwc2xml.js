#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { convertNWCToMusicXML } from '../lib/nwc2xml/index.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
	console.log(`
Usage: nwc2xml <input.nwc> [output.xml]

Converts NWC files to MusicXML format.

Arguments:
  input.nwc   Input NWC file
  output.xml  Output XML file (optional, defaults to input.xml)

Options:
  -h, --help  Show this help message

Examples:
  nwc2xml song.nwc
  nwc2xml song.nwc output.xml
`);
	process.exit(args.length === 0 ? 1 : 0);
}

const input = args[0];
const output = args[1] || input.replace(/\.nwc$/i, '.xml');

try {
	const data = readFileSync(input);
	const xml = convertNWCToMusicXML(data);
	writeFileSync(output, xml);
	console.log(`Converted ${input} -> ${output}`);
} catch (e) {
	console.error(`Error: ${e.message}`);
	process.exit(1);
}
