// Shared NWC Parser - can be used by both viewer and converter
// Exports parsed data in a neutral format

export { parseNWC, NWCFile, NWCStaff } from './nwc2xml/parser.js';
export { BinaryReader } from './nwc2xml/reader.js';
export * from './nwc2xml/constants.js';
