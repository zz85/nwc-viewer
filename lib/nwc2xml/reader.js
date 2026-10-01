// Binary reader with little-endian support
export class BinaryReader {
  constructor(buffer) {
    // Ensure we have a plain Uint8Array with its own ArrayBuffer
    if (buffer instanceof ArrayBuffer) {
      this.buffer = new Uint8Array(buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      // Copy to new Uint8Array to avoid offset issues with Node Buffer
      this.buffer = new Uint8Array(buffer.length);
      this.buffer.set(buffer);
    } else {
      this.buffer = new Uint8Array(buffer);
    }
    this.view = new DataView(this.buffer.buffer);
    this.pos = 0;
  }

  get length() { return this.buffer.length; }
  get remaining() { return this.length - this.pos; }
  eof() { return this.pos >= this.length; }
  tell() { return this.pos; }
  seek(pos) { this.pos = pos; }
  skip(n) { this.pos += n; }

  readUint8() { return this.buffer[this.pos++]; }
  readInt8() { return this.view.getInt8(this.pos++); }
  readUint16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  readInt16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  readUint32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  readBytes(n) { const b = this.buffer.slice(this.pos, this.pos + n); this.pos += n; return b; }

  readUntil(byte) {
    while (this.pos < this.length && this.buffer[this.pos] !== byte) this.pos++;
  }

  readStringNul() {
    const start = this.pos;
    while (this.pos < this.length && this.buffer[this.pos] !== 0) this.pos++;
    const bytes = this.buffer.slice(start, this.pos);
    this.pos++; // skip NUL
    return decodeString(bytes);
  }

  readStringSpace() {
    const start = this.pos;
    while (this.pos < this.length && this.buffer[this.pos] !== 0 && this.buffer[this.pos] > 32) this.pos++;
    const bytes = this.buffer.slice(start, this.pos);
    this.pos++; // skip terminator (space or NUL)
    return decodeString(bytes);
  }
}

const _td_utf8  = new TextDecoder('utf-8', { fatal: true });
const _td_euckr = new TextDecoder('euc-kr');
const _td_sjis  = new TextDecoder('shift-jis');
const _td_gbk   = new TextDecoder('gbk');
const _td_w1252 = new TextDecoder('windows-1252');

// Windows-1251 manual decoder (not all runtimes support it via TextDecoder)
const _w1251_map = '\u0402\u0403\u201A\u0453\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\uFFFD\u2122\u0459\u203A\u045A\u045C\u045B\u045F\u00A0\u040E\u045E\u0408\u00A4\u0490\u00A6\u00A7\u0401\u00A9\u0404\u00AB\u00AC\u00AD\u00AE\u0407\u00B0\u00B1\u0406\u0456\u0491\u00B5\u00B6\u00B7\u0451\u2116\u0454\u00BB\u0458\u0405\u0455\u0457';
function decodeWindows1251(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) result += String.fromCharCode(b);
    else if (b >= 0xC0) result += String.fromCharCode(0x0410 + (b - 0xC0));
    else result += _w1251_map[b - 0x80];
  }
  return result;
}

// Windows-1252 (Western): isolated high bytes between ASCII, or at most two
// adjacent Latin letters. Checked before CJK, whose trail ranges also match
// "é" + ASCII letter. See src/nwc.js looksLikeWestern.
function isWesternHighByte(b) {
  if (b >= 0xA0) return true;
  return b === 0x80 || b === 0x85 || b === 0x8A || b === 0x8C || b === 0x8E ||
    (b >= 0x91 && b <= 0x97) || b === 0x99 || b === 0x9A || b === 0x9C ||
    b === 0x9E || b === 0x9F;
}

function looksLikeWestern(bytes) {
  let high = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) continue;
    high++;
    if (!isWesternHighByte(b)) return false;
    let run = 1;
    while (i + run < bytes.length && bytes[i + run] >= 0x80) run++;
    if (run > 2) return false;
    if (run === 2) {
      if (b < 0xC0 || bytes[i + 1] < 0xC0) return false;
      high++;
      i++;
    }
  }
  return high > 0;
}

// EUC-KR / CP949: lead 0x81-0xFE, trail 0x41-0x5A | 0x61-0x7A | 0x81-0xFE.
function looksLikeEUCKR(bytes) {
  let high = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) continue;
    high++;
    if (b >= 0x81 && b <= 0xFE && i + 1 < bytes.length) {
      const n = bytes[i + 1];
      if ((n >= 0x41 && n <= 0x5A) ||
          (n >= 0x61 && n <= 0x7A) ||
          (n >= 0x81 && n <= 0xFE)) {
        i++;
        continue;
      }
    }
    return false;
  }
  return high > 0;
}

// Shift-JIS / CP932: lead 0x81-0x9F | 0xE0-0xFC, trail 0x40-0x7E | 0x80-0xFC.
// Also allows single-byte half-width katakana 0xA1-0xDF.
function looksLikeShiftJIS(bytes) {
  let high = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) continue;
    high++;
    if (b >= 0xA1 && b <= 0xDF) continue;
    if (((b >= 0x81 && b <= 0x9F) || (b >= 0xE0 && b <= 0xFC)) && i + 1 < bytes.length) {
      const n = bytes[i + 1];
      if ((n >= 0x40 && n <= 0x7E) || (n >= 0x80 && n <= 0xFC)) {
        i++;
        continue;
      }
    }
    return false;
  }
  return high > 0;
}

// GBK / CP936: lead 0x81-0xFE, trail 0x40-0x7E | 0x80-0xFE.
function looksLikeGBK(bytes) {
  let high = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) continue;
    high++;
    if (b >= 0x81 && b <= 0xFE && i + 1 < bytes.length) {
      const n = bytes[i + 1];
      if ((n >= 0x40 && n <= 0x7E) || (n >= 0x80 && n <= 0xFE)) {
        i++;
        continue;
      }
    }
    return false;
  }
  return high > 0;
}

// Windows-1251 (Cyrillic): high bytes predominantly in 0xC0-0xFF, at least 2.
function looksLikeCyrillic(bytes) {
  let cyrillic = 0, other = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) continue;
    if (b >= 0xC0 && b <= 0xFF) cyrillic++;
    else other++;
  }
  return cyrillic > 1 && cyrillic >= other * 2;
}

function decodeString(bytes) {
  try {
    return _td_utf8.decode(bytes);
  } catch {
    if (looksLikeWestern(bytes)) return _td_w1252.decode(bytes);
    if (looksLikeEUCKR(bytes)) return _td_euckr.decode(bytes);
    if (looksLikeShiftJIS(bytes)) return _td_sjis.decode(bytes);
    if (looksLikeGBK(bytes)) return _td_gbk.decode(bytes);
    if (looksLikeCyrillic(bytes)) return decodeWindows1251(bytes);
    return _td_w1252.decode(bytes);
  }
}
