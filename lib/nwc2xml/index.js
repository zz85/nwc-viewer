// Main entry point for NWC to MusicXML conversion
export { parseNWC, NWCFile, NWCStaff } from './parser.js';
export { toMusicXML } from './writer.js';
export * from './constants.js';

import { parseNWC } from './parser.js';
import { toMusicXML } from './writer.js';

/**
 * Convert NWC buffer to MusicXML string
 * @param {ArrayBuffer|Uint8Array} buffer - NWC file contents
 * @returns {string} MusicXML string
 */
export function convertNWCToMusicXML(buffer) {
  const nwcFile = parseNWC(buffer);
  return toMusicXML(nwcFile);
}

// Default export for convenience
export default { parseNWC, toMusicXML, convertNWCToMusicXML };
