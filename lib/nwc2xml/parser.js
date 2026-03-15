// NWC File Parser
import { BinaryReader } from './reader.js';
import { NWC_HEADER, NWZ_HEADER, NWC_Version, ObjType, isValidVersion } from './constants.js';
import { createObject, NoteCMObj, RestCMObj } from './objects.js';

// Resolve zlib for Node.js ESM (createRequire is sync-safe, unlike dynamic import)
let _zlib = null;
try {
  if (typeof Bun !== 'undefined') {
    _zlib = require('zlib');
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    const { createRequire } = await import('module');
    _zlib = createRequire(import.meta.url)('zlib');
  }
} catch { /* browser or other env */ }

export class NWCStaff {
  constructor(file) {
    this.file = file;
    this.name = ''; this.label = ''; this.group = '';
    this.channel = 0; this.patchName = 0; this.endingBar = 0;
    this.objects = []; this.lyrics = [];
    this.transposition = 0;
    // WithNextStaff grouping flags
    this.bracketWithNext = false;
    this.braceWithNext = false;
    this.connectBarsWithNext = false;
    this.layerWithNext = false;
    // Vertical sizing
    this.boundaryTop = 0; this.boundaryBottom = 0; this.lines = 5;
    // Staff color (0=Default, 1=Red, 2=Green, 3=Blue)
    this.color = 0;
  }

  getDivisions() {
    let div = 1;
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const lcm = (a, b) => a * b / gcd(a, b);
    const process = obj => {
      if (obj.getDivision) div = lcm(div, obj.getDivision());
      if (obj.children) obj.children.forEach(process);
    };
    this.objects.forEach(process);
    return div;
  }
}

export class NWCFile {
  constructor() {
    this.version = 0; this.title = ''; this.author = ''; this.lyricist = '';
    this.copyright1 = ''; this.copyright2 = ''; this.comment = '';
    this.measureStart = 1; this.staffs = [];
    this.allowLayering = true;
  }
}

import { parseNWCTxt } from './nwctxt-parser.js';

export function parseNWC(buffer) {
  let data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  
  // Check for compressed format
  const header = String.fromCharCode(...data.slice(0, 5));
  
  if (header === NWZ_HEADER) {
    data = decompress(data.slice(6));
  }
  
  const r = new BinaryReader(data);
  
  // Verify header
  const hdr = String.fromCharCode(...r.readBytes(NWC_HEADER.length));
  if (hdr !== NWC_HEADER) throw new Error('Invalid NWC file header');
  
  // Skip variable-length zero padding between header and version.
  // Some files have extra 0x00 bytes here; the old parser used readUntilNonZero().
  while (!r.eof() && r.buffer[r.pos] === 0) r.skip(1);
  
  const file = new NWCFile();
  file.version = r.readInt16();
  if (!isValidVersion(file.version)) throw new Error(`Unsupported NWC version: ${file.version.toString(16)}`);
  
  // V275 (0x24b) has embedded NWCTXT - find and parse it.
  // The embedded text is Windows-1252 encoded (not UTF-8), so we must use that
  // decoder to correctly handle non-ASCII characters (accented letters, ©, etc.).
  if (file.version === NWC_Version.V275) {
    const str = new TextDecoder('windows-1252').decode(data);
    const idx = str.indexOf('!NoteWorthyComposer(');
    if (idx >= 0) return parseNWCTxt(str.substring(idx));
  }
  
  // After version: 1 unknown byte, then variable zero padding, then two
  // NUL-terminated strings (user, unknown).  The old parser used
  // readBytes(1) + readUntilNonZero() + readString() for each field.
  r.skip(1); // 1 unknown byte
  while (!r.eof() && r.buffer[r.pos] === 0) r.skip(1); // skip zero padding
  file.user = r.readStringNul();
  while (!r.eof() && r.buffer[r.pos] === 0) r.skip(1); // skip zero padding
  r.readStringNul(); // unknown string
  while (!r.eof() && r.buffer[r.pos] === 0) r.skip(1); // skip zero padding
  r.readInt16(); // info header (e.g. 0x18 for NWC2)
  
  file.title = r.readStringNul();
  file.author = r.readStringNul();
  if (file.version >= NWC_Version.V200) file.lyricist = r.readStringNul();
  file.copyright1 = r.readStringNul();
  file.copyright2 = r.readStringNul();
  file.comment = r.readStringNul();
  
  r.skip(2); // extend/spacing
  r.skip(5); // unknown
  r.skip(1); // measure numbers
  r.skip(1); // unknown
  file.measureStart = r.readInt16();
  
  if (file.version >= NWC_Version.V130) {
    r.readStringSpace(); r.readStringSpace(); r.readStringSpace(); r.readStringSpace(); // margins
  }
  r.skip(1); // mirror margin
  r.skip(2); // btUnknown5
  
  if (file.version > NWC_Version.V130) {
    r.skip(32); // group visibility
    file.allowLayering = !!r.readUint8();
  }
  // Notation typeface only for V200+
  if (file.version >= NWC_Version.V200) {
    r.readStringNul(); // notation typeface
  }
  r.readInt16(); // staff height
  
  // Font info
  let fontCount = 0;
  if (file.version > NWC_Version.V130) fontCount = file.version <= NWC_Version.V170 ? 10 : 12;
  for (let i = 0; i < fontCount; i++) { r.readStringNul(); r.skip(4); }
  // Some V170 files have 12 fonts
  if (file.version === NWC_Version.V170) {
    const pos = r.tell();
    const ch = r.readUint8();
    r.seek(pos);
    if (ch !== 0 && ch !== 0xFF) {
      for (let i = 0; i < 2; i++) { r.readStringNul(); r.skip(4); }
    }
  }
  
  r.skip(1); // title page info
  r.skip(1); // staff labels
  r.skip(2); // start page no
  if (file.version >= NWC_Version.V200) {
    r.skip(1); // V200+ has an extra byte before staff count (value varies: 0x00 or 0xFF)
  }
  // V205 has 13 extra bytes before staff count
  if (file.version >= NWC_Version.V205) r.skip(13);
  const staffCount = r.readInt16();
  
  for (let i = 0; i < staffCount; i++) {
    const staff = loadStaff(r, file);
    file.staffs.push(staff);
  }
  
  return file;
}

function loadStaff(r, file) {
  const staff = new NWCStaff(file);
  staff.name = r.readStringNul();
  if (file.version >= NWC_Version.V200) {
    staff.label = r.readStringNul();
    r.readStringNul(); // instName
    if (file.version >= NWC_Version.V205) r.readStringNul(); // extra string in V205
  }
  staff.group = r.readStringNul();
  
  // V205 has different staff data structure - use marker-based parsing
  if (file.version >= NWC_Version.V205) {
    // Skip to 0xff marker, then parse from there (matching nwc.js)
    r.readUntil(0xff);
    r.skip(1); // 0xff
    r.skip(7); // lowersize, skip, lines, layer, volume, skip, pan
    r.skip(3); // non-1.7 skip
    r.skip(2); // unknown
    const numLyric = r.readInt16();
    const noLyrics = r.readInt16();
    
    if (numLyric > 0 && noLyrics > 0 && noLyrics < 100) {
      r.skip(5); // lyricsOption(2) + skip(3)
      for (let i = 0; i < noLyrics && !r.eof(); i++) {
        const blockSize = r.readInt16();
        if (blockSize > 0 && blockSize < 10000) {
          r.skip(2); // lyric size
          const start = r.tell();
          r.skip(2); // reserved
          const syllables = [];
          while (!r.eof()) {
            const s = r.readStringNul();
            if (!s) break;
            syllables.push(s);
          }
          staff.lyrics.push(syllables);
          r.seek(start + blockSize);
        }
      }
      r.skip(1); // unknown after lyrics
    }
    
    r.skip(1); // unknown
    r.skip(1); // color
    r.readInt16(); // objCount (unreliable in V205, ignore it)
    
    // Load objects until we hit a staff header or end of file
    // Staff headers start with printable strings, objects start with type byte 0-23
    function loadWithChildren205(r, staff) {
      const obj = loadObject(r, staff);
      if (obj && (obj instanceof NoteCMObj || obj instanceof RestCMObj)) {
        for (let j = 0; j < obj.count; j++) {
          const child = loadWithChildren205(r, staff);
          if (child) obj.children.push(child);
        }
      }
      return obj;
    }
    
    while (!r.eof()) {
      const peekType = r.buffer[r.pos];
      // Stop if we hit what looks like a staff name (printable ASCII starting with letter)
      if (peekType >= 0x41 && peekType <= 0x7a) break;
      // Stop if type is invalid
      if (peekType > 23) break;
      
      const obj = loadWithChildren205(r, staff);
      if (obj) staff.objects.push(obj);
    }
    return staff;
  }
  
  // Staff info - exact byte layout per version (matching C++ structs)
  staff.endingBar = r.readUint8();
  r.skip(1); // muted
  r.skip(1); // reserved1
  staff.channel = r.readUint8();
  r.skip(1); // reserved2
  r.skip(1); // playback device
  r.skip(1); // reserved3
  r.skip(1); // select patch bank
  r.skip(3); // reserved4[3]
  staff.patchName = r.readUint8();
  
  // V155+ adds reserved5 (1 byte) after patchName
  if (file.version >= NWC_Version.V155) r.skip(1);
  // V200+ adds defaultDynamicVelocity[8] after reserved5
  if (file.version >= NWC_Version.V200) r.skip(8);
  
  // Staff visual type — pre-V200 encodes staff grouping in this byte:
  //   0 = Standard, 1 = Upper Grand Staff, 2 = Lower Grand Staff, 3 = Orchestral
  // V200+ moved to explicit withNext bitmask (style byte becomes independent).
  var staffType = r.readUint8();
  r.skip(1); // second style byte (reserved / padding)
  staff.boundaryTop = r.readInt16();
  staff.boundaryBottom = r.readInt16();
  
  // V175+ adds lines (1 byte) after vertical size lower
  if (file.version >= NWC_Version.V175) staff.lines = r.readUint8();
  
  var withNext = r.readUint16();
  
  if (file.version < NWC_Version.V200) {
    // Pre-V200: derive connection flags from staff type
    // Upper Grand Staff (1) → brace + connected bars with next staff
    // Orchestral (3) → bracket with next staff
    if (staffType === 1) {
      staff.braceWithNext = true;
      staff.connectBarsWithNext = true;
    } else if (staffType === 3) {
      staff.bracketWithNext = true;
    }
  } else {
    // V200+: explicit bitmask in withNext field
    staff.bracketWithNext = !!(withNext & 0x01);
    staff.braceWithNext = !!(withNext & 0x02);
    staff.connectBarsWithNext = !!(withNext & 0x04);
    staff.layerWithNext = !!(withNext & 0x08);
  }
  
  // V150+ adds transposition (2 bytes, signed — semitones above/below written pitch)
  if (file.version >= NWC_Version.V150) staff.transposition = r.readInt16();
  else staff.transposition = 0;
  
  r.skip(2); // part volume
  r.skip(2); // stereo pan
  
  // Version-specific ending before numLyric:
  // V130: reserved6(1) + color(1) + numLyric(2)
  // V150: reserved6(1) + color(1) + numLyric(2)
  // V155: reserved6(1) + color(1) + numLyric(2)
  // V170: color(1) + reserved6(2) + numLyric(2)
  // V175+: color(1) + alignSyllable(2) + numLyric(2)
  if (file.version <= NWC_Version.V155) {
    r.skip(1); // reserved6
    staff.color = r.readUint8() & 3;
  } else {
    staff.color = r.readUint8() & 3;
    r.skip(2); // reserved6 (V170) or alignSyllable (V175+)
  }
  
  let numLyric = r.readInt16();
  // Handle corrupted numLyric (0xCDCD)
  if ((numLyric & 0xFFFF) === 0xCDCD) numLyric = 0;
  
  // V150+ reads alignment(2) + staffOffset(2) if numLyric > 0
  if (numLyric > 0 && file.version >= NWC_Version.V150) r.skip(4);
  
  // Load lyrics
  for (let i = 0; i < numLyric; i++) {
    const blockSize = r.readInt16();
    if (blockSize > 0) {
      r.skip(2); // lyric size
      const start = r.tell(); // save position AFTER lyric size
      r.skip(2); // reserved
      const syllables = [];
      while (true) {
        const s = r.readStringNul();
        if (!s) break;
        syllables.push(s);
      }
      staff.lyrics.push(syllables);
      r.seek(start + blockSize);
    } else {
      staff.lyrics.push([]);
    }
  }
  
  // Load objects
  if (numLyric > 0) r.skip(2); // unknown
  r.skip(2); // unknown
  let objCount = r.readInt16();
  
  // V150+ subtracts 2 from object count (not just V200+)
  if (file.version > NWC_Version.V150) objCount -= 2;
  
  function loadWithChildren(r, staff) {
    const obj = loadObject(r, staff);
    if (obj && (obj instanceof NoteCMObj || obj instanceof RestCMObj)) {
      for (let j = 0; j < obj.count; j++) {
        const child = loadWithChildren(r, staff);
        if (child) obj.children.push(child);
      }
    }
    return obj;
  }
  
  for (let i = 0; i < objCount; i++) {
    const obj = loadWithChildren(r, staff);
    if (obj) staff.objects.push(obj);
  }
  
  // Check if we need to read 2 more objects (when last object was NoteCM/RestCM)
  // This handles a quirk where the -2 subtraction is incorrect for some staffs
  if (file.version > NWC_Version.V150 && !r.eof() && staff.objects.length > 0) {
    const lastObj = staff.objects[staff.objects.length - 1];
    const hasChildren = lastObj instanceof NoteCMObj || lastObj instanceof RestCMObj;
    if (hasChildren) {
      // Check if next bytes look like valid object types (0-18)
      const nextType = r.buffer[r.tell()] | (r.buffer[r.tell() + 1] << 8);
      if (nextType >= 0 && nextType <= 18) {
        // Try to read 2 more objects
        for (let i = 0; i < 2 && !r.eof(); i++) {
          const pos = r.tell();
          const peekType = r.buffer[pos] | (r.buffer[pos + 1] << 8);
          if (peekType < 0 || peekType > 18) break;
          
          const obj = loadObject(r, staff);
          if (obj) {
            staff.objects.push(obj);
            if (obj instanceof NoteCMObj || obj instanceof RestCMObj) {
              for (let j = 0; j < obj.count; j++) {
                const child = loadObject(r, staff);
                if (child) obj.children.push(child);
              }
            }
          }
        }
      }
    }
  }
  
  return staff;
}

function loadObject(r, staff) {
  // V205+ uses 1-byte type + 1-byte skip, older versions use 2-byte type (int16)
  const version = staff.file?.version || 0;
  const type = version >= NWC_Version.V205 ? r.readUint8() : r.readInt16();
  if (version >= NWC_Version.V205) r.skip(1); // skip byte after type
  
  const obj = createObject(type, staff);
  if (!obj) throw new Error(`Unknown object type: ${type} at ${r.tell().toString(16)}`);
  obj.load(r);
  return obj;
}

function decompress(data) {
  // Use pre-resolved zlib for Bun / Node.js
  if (_zlib) {
    return new Uint8Array(_zlib.inflateSync(Buffer.from(data)));
  }
  // Browser - use Zlib from inflate.js (already loaded)
  if (typeof Zlib !== 'undefined' && Zlib.Inflate) {
    const inflate = new Zlib.Inflate(data);
    return inflate.decompress();
  }
  // Browser - use pako if available
  if (typeof globalThis.pako !== 'undefined') {
    return globalThis.pako.inflate(data);
  }
  throw new Error('No decompression library available');
}
