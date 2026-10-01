// NWCTXT Parser for NWC 2.75+ files
//
// NWC 2.75 binaries embed the song as nwctxt, so every 2.75 file goes through
// this parser. Objects mirror the binary classes in objects.js — same fields,
// same encodings, same methods — so src/nwc.js adaptObject() and writer.js can
// treat both sources identically. Positions are stored negated (binary
// convention: positive = below) because consumers negate them back.
import { NWCFile, NWCStaff } from './parser.js';
import { ObjType, Accidental, NoteAttr, DurationType } from './constants.js';

// Extract everything after the first colon in a field string.
// Using indexOf instead of split(':')[1] to correctly handle values that
// contain colons (e.g. URLs in copyright fields, tempo text, etc.).
function fieldValue(f) {
  const idx = f.indexOf(':');
  return idx === -1 ? '' : f.substring(idx + 1);
}

// Unquote a nwctxt string value and resolve backslash escapes.
function unquote(v) {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v.replace(/\\(.)/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' })[c] ?? c);
}

// Split a "|Type|Key:Value|..." line on '|' outside quoted strings, honouring
// backslash escapes so text containing '|' or '"' stays intact.
function splitFields(line) {
  const parts = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) { cur += c + line[++i]; continue; }
    if (c === '"') inQuote = !inQuote;
    if (c === '|' && !inQuote) { if (cur) parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur) parts.push(cur);
  return parts;
}

// Look up a style name case-insensitively, ignoring spaces and accents
// (files write "DCalFine" for DCAlFine, "Piu mosso" for Più mosso, ...).
function styleIndex(names, value, fallback = 0) {
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f\s.]/g, '').toLowerCase();
  const v = norm(value);
  const idx = names.findIndex(n => norm(n) === v);
  return idx === -1 ? fallback : idx;
}

const VISIBILITY = ['Default', 'Always', 'TopStaff', 'SingleStaff', 'MultiStaff', 'Never'];
const ACCIDENTALS = { '#': Accidental.Sharp, 'b': Accidental.Flat, 'n': Accidental.Natural, 'x': Accidental.SharpSharp, 'v': Accidental.FlatFlat };
const DUR_MAP = { Whole: 0, Half: 1, '4th': 2, '8th': 3, '16th': 4, '32nd': 5, '64th': 6 };
// Binary TextObj font byte order
const TEXT_FONTS = ['StaffItalic', 'StaffBold', 'StaffLyric', 'PageTitleText', 'PageText', 'PageSmallText',
  'User1', 'User2', 'User3', 'User4', 'User5', 'User6', 'StaffSymbols'];
const DYNAMIC_STYLES = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
const DYNVAR_STYLES = ['Crescendo', 'Decrescendo', 'Diminuendo', 'Rinforzando', 'Sforzando'];
const TEMPVAR_STYLES = ['Breath Mark', 'Caesura', 'Fermata', 'Accelerando', 'Allargando', 'Rallentando',
  'Ritardando', 'Ritenuto', 'Rubato', 'Stringendo'];
const PERFORM_STYLES = ['Ad Libitum', 'Animato', 'Cantabile', 'Con brio', 'Dolce', 'Espressivo',
  'Grazioso', 'Legato', 'Maestoso', 'Marcato', 'Meno mosso', 'Poco a poco', 'Più mosso', 'Semplice',
  'Simile', 'Solo', 'Sostenuto', 'Sotto Voce', 'Staccato', 'Subito', 'Tenuto', 'Tutti', 'Volta Subito'];
const FLOW_STYLES = ['Coda', 'Segno', 'Fine', 'ToCoda', 'DaCapo', 'DCAlCoda', 'DCAlFine', 'DalSegno', 'DSAlCoda', 'DSAlFine'];
const BAR_STYLES = ['Single', 'Double', 'SectionOpen', 'SectionClose', 'LocalRepeatOpen', 'LocalRepeatClose',
  'MasterRepeatOpen', 'MasterRepeatClose', 'Transparent'];
// StaffProperties EndingBar → staff.endingBar index (see typeset endingBarStyles)
const ENDING_BARS = ['Section Close', 'Master Repeat Close', 'Single', 'Double', 'Open (hidden)'];
const CLEF_TYPES = ['Treble', 'Bass', 'Alto', 'Tenor', 'Percussion'];
// Binary 2-bit fields: beam 1=first 2=middle 3=end; slur 1=start 2=end 3=middle
const BEAM_FIRST = 1, BEAM_MID = 2, BEAM_END = 3;
const SLUR_START = 1, SLUR_END = 2, SLUR_MID = 3;

class NWCTxtObj {
  constructor(type, staff) {
    this.type = type; this.staff = staff; this.children = [];
    this.visible = 0; this.pos = 0; this.placement = 0;
  }
  // Fields shared by most objects: Pos (user convention, stored negated) and Visibility.
  parseCommon(f) {
    if (f.startsWith('Pos:')) this.pos = -(parseInt(fieldValue(f)) || 0);
    else if (f.startsWith('Visibility:')) this.visible = Math.max(0, VISIBILITY.indexOf(fieldValue(f)));
  }
  parse(fields) { for (const f of fields) this.parseCommon(f); }
}

class ClefTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Clef, s); this.clefType = 0; this.octaveShift = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Type:')) this.clefType = Math.max(0, CLEF_TYPES.indexOf(fieldValue(f)));
      // Binary encoding: 0 = none, 1 = Octave Up, 2 = Octave Down
      else if (f.startsWith('OctaveShift:')) {
        const v = fieldValue(f);
        this.octaveShift = v.includes('Up') ? 1 : v.includes('Down') ? 2 : 0;
      } else this.parseCommon(f);
    }
  }
}

class KeySigTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.KeySig, s); this.sharp = 0; this.flat = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Signature:')) {
        const sig = fieldValue(f);
        this.sharp = (sig.match(/#/g) || []).length;
        this.flat = (sig.match(/b/g) || []).length;
      } else this.parseCommon(f);
    }
  }
  getFifths() { return this.sharp - this.flat; }
  getChromAlter() {
    const ca = new Array(7).fill(0);
    const sharpOrder = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
    const flatOrder = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F
    for (let i = 0; i < this.sharp; i++) ca[sharpOrder[i]] = 1;
    for (let i = 0; i < this.flat; i++) ca[flatOrder[i]] = -1;
    return ca;
  }
}

class TimeSigTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.TimeSig, s); this.beats = 4; this.beatValue = 4; this.style = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Signature:')) {
        const sig = fieldValue(f);
        if (sig === 'Common') { this.beats = 4; this.beatValue = 4; this.style = 1; }
        else if (sig === 'AllaBreve') { this.beats = 2; this.beatValue = 2; this.style = 2; }
        else {
          const m = sig.match(/(\d+)\/(\d+)/);
          if (m) { this.beats = parseInt(m[1]); this.beatValue = parseInt(m[2]); }
        }
      } else this.parseCommon(f);
    }
  }
  getBeatType() { return this.beatValue; }
}

class BarLineTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.BarLine, s); this.style = 0; this.repeatCount = 2; this._sysBreak = false; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Style:')) this.style = styleIndex(BAR_STYLES, fieldValue(f));
      else if (f.startsWith('Repeat:')) this.repeatCount = parseInt(fieldValue(f)) || 2;
      else if (f.startsWith('SysBreak:')) this._sysBreak = fieldValue(f) === 'Y';
      else this.parseCommon(f);
    }
  }
  getStyle() { return this.style; }
  systemBreak() { return this._sysBreak; }
}

class EndingTxtObj extends NWCTxtObj {
  // style: low byte = endings bitmask (bit n-1 = ending n, bit 7 = default "D"),
  // high byte = 1 for a closed bracket
  constructor(s) { super(ObjType.Ending, s); this.style = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Endings:')) {
        for (const e of fieldValue(f).split(',')) {
          if (e === 'D') this.style |= 0x80;
          else if (+e >= 1 && +e <= 7) this.style |= 1 << (+e - 1);
        }
      } else if (f.startsWith('ClosedBracket:')) {
        if (fieldValue(f) === 'Y') this.style |= 0x100;
      } else this.parseCommon(f);
    }
  }
}

class InstrumentTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Instrument, s); this.name = ''; this.patch = 0; this.transposition = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Name:')) this.name = unquote(fieldValue(f));
      else if (f.startsWith('Patch:')) this.patch = parseInt(fieldValue(f)) || 0;
      else if (f.startsWith('Trans:')) this.transposition = parseInt(fieldValue(f)) || 0;
      else this.parseCommon(f);
    }
  }
}

class TempoTxtObj extends NWCTxtObj {
  // base uses the binary encoding: 0 Eighth, 1 Eighth Dotted, 2 Quarter,
  // 3 Quarter Dotted, 4 Half, 5 Half Dotted
  constructor(s) { super(ObjType.Tempo, s); this.value = 120; this.base = 2; this.text = ''; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Tempo:')) this.value = parseInt(fieldValue(f)) || 120;
      else if (f.startsWith('Base:')) {
        const b = fieldValue(f);
        const note = b.includes('Eighth') ? 0 : b.includes('Half') ? 4 : 2;
        this.base = note + (b.includes('Dotted') ? 1 : 0);
      } else if (f.startsWith('Text:')) this.text = unquote(fieldValue(f));
      else this.parseCommon(f);
    }
  }
  getTempoNote() { return ['eighth', 'quarter', 'half'][Math.floor(this.base / 2)] || 'quarter'; }
  isDotted() { return this.base % 2 === 1; }
  getSpeed() { return this.value; }
}

class DynamicTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Dynamic, s); this.style = 4; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Style:')) this.style = styleIndex(DYNAMIC_STYLES, fieldValue(f), 4);
      else this.parseCommon(f);
    }
  }
  getStyleName() { return DYNAMIC_STYLES[this.style] || 'mf'; }
}

// Objects whose only payload is a named style: DynamicVariance, TempoVariance,
// PerformanceStyle, Flow.
class StyledTxtObj extends NWCTxtObj {
  constructor(type, s, names) { super(type, s); this.style = 0; this.delay = 0; this._names = names; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Style:')) this.style = styleIndex(this._names, fieldValue(f));
      else if (f.startsWith('Pause:')) this.delay = parseInt(fieldValue(f)) || 0;
      else this.parseCommon(f);
    }
  }
}

class FlowTxtObj extends StyledTxtObj {
  constructor(s) { super(ObjType.FlowDir, s, FLOW_STYLES); }
  moveBeforeMeasure() { return this.style === FLOW_STYLES.indexOf('ToCoda'); }
}

class PedalTxtObj extends NWCTxtObj {
  // style: 0 = Down, 1 = Released
  constructor(s) { super(ObjType.Pedal, s); this.style = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Status:')) this.style = fieldValue(f) === 'Released' ? 1 : 0;
      else this.parseCommon(f);
    }
  }
}

class TextTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Text, s); this.text = ''; this.font = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Text:')) this.text = unquote(fieldValue(f));
      else if (f.startsWith('Font:')) this.font = Math.max(0, TEXT_FONTS.indexOf(fieldValue(f)));
      else this.parseCommon(f);
    }
  }
}

class SpacerTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Spacer, s); this.width = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Width:')) this.width = parseInt(fieldValue(f)) || 0;
      else this.parseCommon(f);
    }
  }
}

// --- Durational objects ---------------------------------------------------

// Parse a Dur/Dur2 value ("8th,Dotted,Staccato,Slur,Triplet=First") into
// { duration, dots, triplet, attr, slurFlag } using binary encodings.
function parseDur(value) {
  const r = { duration: 2, dots: 0, triplet: 0, attr: 0, slurFlag: false };
  const parts = value.split(',');
  r.duration = DUR_MAP[parts[0]] ?? 2;
  for (const p of parts.slice(1)) {
    if (p === 'Dotted') r.dots = 1;
    else if (p === 'DblDotted') r.dots = 2;
    else if (p === 'Triplet=First') r.triplet = DurationType.TriStart;
    else if (p === 'Triplet') r.triplet = DurationType.TriCont;
    else if (p === 'Triplet=End') r.triplet = DurationType.TriStop;
    else if (p === 'Slur') r.slurFlag = true;
    else if (p === 'Grace') r.attr |= NoteAttr.Grace;
    else if (p === 'Staccato') r.attr |= NoteAttr.Staccato;
    else if (p === 'Staccatissimo') r.attr |= NoteAttr.Staccatissimo;
    else if (p === 'Accent') r.attr |= NoteAttr.Accent;
    else if (p === 'Tenuto') r.attr |= NoteAttr.Tenuto;
    else if (p === 'Marcato') r.attr |= NoteAttr.Marcato;
  }
  return r;
}

// Parse Opts ("Stem=Up,Beam=First,Slur=Upward,Lyric=Never,Crescendo") into
// attribute bits plus a lyric-syllable code (0 Default, 1 Always, 2 Never).
function parseOpts(value) {
  let attr = 0, lyricSyllable = 0, offset = 0;
  for (const o of value.split(',')) {
    const [k, v] = o.split('=');
    if (k === 'Stem') attr |= v === 'Up' ? NoteAttr.StemUp : v === 'Down' ? NoteAttr.StemDown : 0;
    else if (k === 'Beam') attr |= (v === 'First' ? BEAM_FIRST : v === 'End' ? BEAM_END : BEAM_MID) * NoteAttr.BeamBeg;
    else if (k === 'Slur') attr |= v === 'Downward' ? NoteAttr.SlurDirDown : NoteAttr.SlurDirUp;
    else if (k === 'Tie') attr |= v === 'Downward' ? NoteAttr.TieDirDown : NoteAttr.TieDirUp;
    else if (k === 'Lyric') lyricSyllable = v === 'Always' ? 1 : v === 'Never' ? 2 : 0;
    else if (k === 'VertOffset') offset = parseInt(v) || 0;
    else if (k === 'Crescendo') attr |= NoteAttr.Crescendo;
    else if (k === 'Diminuendo') attr |= NoteAttr.Diminuendo;
    else if (k === 'Sforzando') attr |= NoteAttr.Sforzando;
    else if (k === 'Fermata') attr |= NoteAttr.Fermata;
  }
  return { attr, lyricSyllable, offset };
}

// Parse one note position ("#-5^", "3x", "b-2") → { pos, accidental, tie }
function parsePitch(str) {
  const m = str.match(/^([#bnxv]?)(-?\d+)[^\^]*(\^?)/);
  if (!m) return null;
  return { pos: -parseInt(m[2]), accidental: ACCIDENTALS[m[1]] ?? Accidental.Normal, tie: m[3] === '^' };
}

function durationTicks(duration, dots, triplet, div) {
  let d = div / (1 << duration);
  if (dots === 2) d += d / 4;
  else if (dots === 1) d += d / 2;
  if (triplet) d = d * 2 / 3;
  return Math.round(d * 4);
}

function durationDivision(duration, dots, triplet) {
  let d = 1 << duration;
  if (dots === 2) d <<= 2;
  else if (dots === 1) d <<= 1;
  if (triplet) d = (d % 2) ? d * 3 : (d / 2) * 3;
  return d;
}

// Shared duration interface (binary getDuration/getDurationType/...)
class DurTxtObj extends NWCTxtObj {
  constructor(type, s) {
    super(type, s);
    this.duration = 2; this.dots = 0; this.triplet = 0; this.attr = 0;
    this.slurFlag = false; this.lyricSyllable = 0;
  }
  applyDur(d) {
    this.duration = d.duration; this.dots = d.dots; this.triplet = d.triplet;
    this.attr |= d.attr; this.slurFlag = d.slurFlag;
  }
  getDuration() { return this.duration; }
  getDurationType() {
    let dt = this.triplet;
    if (this.dots === 2) dt |= DurationType.DotDot;
    else if (this.dots === 1) dt |= DurationType.Dot;
    return dt;
  }
  getDurationTicks(div) { return durationTicks(this.duration, this.dots, this.triplet, div); }
  getDivision() { return durationDivision(this.duration, this.dots, this.triplet); }
  getAttributes() { return this.attr; }
  getLyricSyllable() { return this.lyricSyllable; }
}

class NoteTxtObj extends DurTxtObj {
  constructor(s) { super(ObjType.Note, s); this.accidental = Accidental.Normal; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Dur:')) this.applyDur(parseDur(fieldValue(f)));
      else if (f.startsWith('Pos:')) {
        const p = parsePitch(fieldValue(f).split(',')[0]);
        if (p) {
          this.pos = p.pos; this.accidental = p.accidental;
          if (p.tie) this.attr |= NoteAttr.TieBeg;
        }
      } else if (f.startsWith('Opts:')) {
        const o = parseOpts(fieldValue(f));
        this.attr |= o.attr; this.lyricSyllable = o.lyricSyllable;
      } else if (f.startsWith('Visibility:')) this.parseCommon(f);
    }
  }
  getAccidental() { return this.accidental; }
  isStemUp() {
    const stem = this.attr & NoteAttr.StemMask;
    if (stem === NoteAttr.StemUp) return true;
    if (stem === NoteAttr.StemDown) return false;
    return this.pos > 0;
  }
  getOctaveStep(clefShift, measureAlter) {
    const p = clefShift + this.pos;
    const octave = Math.floor((4 * 7 - p + 6) / 7);
    const stepIdx = ((4 * 7 - p + 1) % 7 + 7) % 7;
    const step = String.fromCharCode(65 + stepIdx);
    const acc = this.accidental;
    let alter;
    if (acc <= Accidental.FlatFlat) {
      alter = [1, -1, 0, 2, -2][acc];
      measureAlter[stepIdx] = alter;
    } else {
      alter = measureAlter[stepIdx];
    }
    return { octave, step, alter };
  }
}

class RestTxtObj extends DurTxtObj {
  constructor(s, type = ObjType.Rest) { super(type, s); this.offset = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Dur:')) this.applyDur(parseDur(fieldValue(f)));
      else if (f.startsWith('Opts:')) {
        const o = parseOpts(fieldValue(f));
        this.attr |= o.attr; this.offset = o.offset;
      } else if (f.startsWith('Visibility:')) this.parseCommon(f);
    }
  }
  getOctaveStep(clefShift) {
    const p = clefShift + this.offset;
    const octave = Math.floor((4 * 7 - p + 6) / 7);
    const stepIdx = ((4 * 7 - p + 1) % 7 + 7) % 7;
    return { octave, step: String.fromCharCode(65 + stepIdx), hasPos: this.offset !== 0 };
  }
}

// Build child notes for a chord voice: one NoteTxtObj per position, sharing
// the voice's duration and attributes, with per-note accidental and tie.
function chordVoice(staff, posList, dur, attr, lyricSyllable) {
  const notes = [];
  for (const str of posList.split(',')) {
    const p = parsePitch(str);
    if (!p) continue;
    const n = new NoteTxtObj(staff);
    n.applyDur(dur);
    n.attr |= attr | (p.tie ? NoteAttr.TieBeg : 0);
    n.pos = p.pos; n.accidental = p.accidental; n.lyricSyllable = lyricSyllable;
    notes.push(n);
  }
  return notes;
}

function oppositeStem(attr) {
  const stem = attr & NoteAttr.StemMask;
  return (attr & ~NoteAttr.StemMask) |
    (stem === NoteAttr.StemUp ? NoteAttr.StemDown : NoteAttr.StemUp);
}

// Chord (NoteCM) and RestChord (RestCM). Pos/Dur is the main voice; Pos2/Dur2
// is the second voice of a split-stem chord, drawn with the opposite stem.
// Like the binary parser, the parent carries the shortest voice's duration
// (the chord's time advance) and each child keeps its own.
class ChordTxtObj extends DurTxtObj {
  constructor(s, isRest = false) {
    super(isRest ? ObjType.RestCM : ObjType.NoteCM, s);
    this.isRest = isRest; this.offset = 0; this.count = 0;
  }
  parse(fields) {
    let dur = null, dur2 = null, pos = '', pos2 = '';
    let opts = { attr: 0, lyricSyllable: 0, offset: 0 };
    for (const f of fields) {
      if (f.startsWith('Dur:')) dur = parseDur(fieldValue(f));
      else if (f.startsWith('Dur2:')) dur2 = parseDur(fieldValue(f));
      else if (f.startsWith('Pos:')) pos = fieldValue(f);
      else if (f.startsWith('Pos2:')) pos2 = fieldValue(f);
      else if (f.startsWith('Opts:')) opts = parseOpts(fieldValue(f));
      else if (f.startsWith('Visibility:')) this.parseCommon(f);
    }
    dur = dur || parseDur('4th');
    this.attr |= opts.attr; this.lyricSyllable = opts.lyricSyllable; this.offset = opts.offset;
    if (dur2 && !(opts.attr & NoteAttr.StemMask)) opts.attr |= NoteAttr.StemDown;

    const main = this.isRest ? [] : chordVoice(this.staff, pos, dur, opts.attr, opts.lyricSyllable);
    const second = dur2 ? chordVoice(this.staff, pos2, dur2,
      this.isRest ? opts.attr : oppositeStem(opts.attr), opts.lyricSyllable) : [];
    this.children = main.concat(second);
    this.count = this.children.length;

    // Parent duration: the rest for RestChord, else the shortest voice
    let advance = dur;
    if (!this.isRest && dur2 &&
        durationTicks(dur2.duration, dur2.dots, dur2.triplet, 768) < durationTicks(dur.duration, dur.dots, dur.triplet, 768)) {
      advance = dur2;
    }
    this.applyDur(advance);
    this.slurFlag = dur.slurFlag;
    if (main.length) { this.pos = main[0].pos; this.accidental = main[0].accidental; }
  }
  getAccidental() { return this.accidental ?? Accidental.Normal; }
}

// --- Staff post-processing ------------------------------------------------

function isDurational(obj) { return obj instanceof DurTxtObj; }

function notesOf(obj) {
  if (obj instanceof NoteTxtObj) return [obj];
  return obj.children || [];
}

// nwctxt marks "Slur" on every note slurred to the next one, and a tie as "^"
// on the starting pitch. The binary format instead stores explicit
// start/middle/end slur codes and a TieEnd bit on the receiving note, which
// is what the viewer's layout and the MusicXML writer expect.
function resolveSlursAndTies(staff) {
  const durs = staff.objects.filter(isDurational);
  for (let i = 0; i < durs.length; i++) {
    const cur = durs[i];
    const prevSlur = i > 0 && durs[i - 1].slurFlag;
    let code = 0;
    if (cur.slurFlag) code = prevSlur ? SLUR_MID : SLUR_START;
    else if (prevSlur) code = SLUR_END;
    if (code) {
      cur.attr |= code * NoteAttr.SlurBeg;
      for (const n of notesOf(cur)) if (n !== cur) n.attr |= code * NoteAttr.SlurBeg;
    }

    // Tie end: the next durational object's notes at the same pitch
    const next = durs[i + 1];
    if (!next) continue;
    const nextNotes = notesOf(next);
    for (const n of notesOf(cur)) {
      if (!(n.attr & NoteAttr.TieBeg)) continue;
      for (const m of nextNotes) if (m.pos === n.pos) m.attr |= NoteAttr.TieEnd;
    }
    if (next instanceof ChordTxtObj && nextNotes.some(m => m.attr & NoteAttr.TieEnd)) {
      next.attr |= NoteAttr.TieEnd;
    }
  }
}

// Split nwctxt lyric text into the binary parser's syllable format: each
// syllable is prefixed with ' ' (new word), '-' (continues a word) or '\r'
// (new line); the very first syllable has no prefix.
function splitLyricSyllables(text) {
  const out = [];
  let cur = '', sep = '';
  const flush = () => { if (cur) { out.push(sep + cur); cur = ''; sep = ''; } };
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') { flush(); if (out.length) sep = '\r'; }
    else if (/\s/.test(ch)) { flush(); if (out.length && sep !== '\r') sep = ' '; }
    else if (ch === '-') { if (cur) { flush(); sep = '-'; } }
    else cur += ch;
  }
  flush();
  return out;
}

function parseStaffProperties(staff, fields) {
  for (const f of fields) {
    const v = fieldValue(f);
    if (f.startsWith('Channel:')) staff.channel = parseInt(v) || 0;
    else if (f.startsWith('EndingBar:')) staff.endingBar = Math.max(0, ENDING_BARS.indexOf(v));
    // Binary stores the upper boundary as a negative offset; nwctxt writes it positive
    else if (f.startsWith('BoundaryTop:')) staff.boundaryTop = -(parseInt(v) || 0);
    else if (f.startsWith('BoundaryBottom:')) staff.boundaryBottom = parseInt(v) || 0;
    else if (f.startsWith('Lines:')) staff.lines = parseInt(v) || 5;
    else if (f.startsWith('Color:')) staff.color = Math.max(0, ['Default', 'Red', 'Green', 'Blue'].indexOf(v));
    else if (f.startsWith('WithNextStaff:')) {
      const w = v.split(',');
      staff.bracketWithNext = w.includes('Bracket');
      staff.braceWithNext = w.includes('Brace');
      staff.connectBarsWithNext = w.includes('ConnectBars');
      staff.layerWithNext = w.includes('Layer');
    }
  }
}

const OBJECT_CLASSES = {
  Clef: s => new ClefTxtObj(s),
  Key: s => new KeySigTxtObj(s),
  TimeSig: s => new TimeSigTxtObj(s),
  Bar: s => new BarLineTxtObj(s),
  Ending: s => new EndingTxtObj(s),
  Instrument: s => new InstrumentTxtObj(s),
  Tempo: s => new TempoTxtObj(s),
  Dynamic: s => new DynamicTxtObj(s),
  Note: s => new NoteTxtObj(s),
  Rest: s => new RestTxtObj(s),
  Chord: s => new ChordTxtObj(s),
  RestChord: s => new ChordTxtObj(s, true),
  SustainPedal: s => new PedalTxtObj(s),
  Flow: s => new FlowTxtObj(s),
  TempoVariance: s => new StyledTxtObj(ObjType.TempVar, s, TEMPVAR_STYLES),
  DynamicVariance: s => new StyledTxtObj(ObjType.DynVar, s, DYNVAR_STYLES),
  PerformanceStyle: s => new StyledTxtObj(ObjType.Perform, s, PERFORM_STYLES),
  Text: s => new TextTxtObj(s),
  Spacer: s => new SpacerTxtObj(s),
};

export function parseNWCTxt(text) {
  const file = new NWCFile();
  file.version = 0x024B;
  let staff = null;

  const finishStaff = () => { if (staff) resolveSlursAndTies(staff); };

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (line.startsWith('!NoteWorthyComposer-End')) break;
    if (!line.startsWith('|')) continue;

    const parts = splitFields(line);
    if (parts.length === 0) continue;
    const type = parts[0];
    const fields = parts.slice(1);

    if (type === 'SongInfo') {
      for (const f of fields) {
        const v = unquote(fieldValue(f));
        if (f.startsWith('Title:')) file.title = v;
        else if (f.startsWith('Author:')) file.author = v;
        else if (f.startsWith('Lyricist:')) file.lyricist = v;
        else if (f.startsWith('Copyright1:')) file.copyright1 = v;
        else if (f.startsWith('Copyright2:')) file.copyright2 = v;
        else if (f.startsWith('Comments:')) file.comment = v;
      }
    } else if (type === 'PgSetup') {
      for (const f of fields) {
        if (f.startsWith('AllowLayering:')) file.allowLayering = fieldValue(f) !== 'N';
        else if (f.startsWith('StartingBar:')) file.measureStart = parseInt(fieldValue(f)) || 1;
      }
    } else if (type === 'AddStaff') {
      finishStaff();
      staff = new NWCStaff(file);
      file.staffs.push(staff);
      for (const f of fields) {
        if (f.startsWith('Name:')) staff.name = unquote(fieldValue(f));
        else if (f.startsWith('Label:')) staff.label = unquote(fieldValue(f));
        else if (f.startsWith('Group:')) staff.group = unquote(fieldValue(f));
      }
    } else if (!staff) {
      continue;
    } else if (type === 'StaffProperties') {
      parseStaffProperties(staff, fields);
    } else if (type === 'StaffInstrument') {
      for (const f of fields) {
        if (f.startsWith('Patch:')) staff.patchName = parseInt(fieldValue(f)) || 0;
        else if (f.startsWith('Trans:')) staff.transposition = parseInt(fieldValue(f)) || 0;
      }
    } else if (/^Lyric\d+$/.test(type)) {
      const verse = parseInt(type.slice(5)) - 1;
      for (const f of fields) {
        if (f.startsWith('Text:')) staff.lyrics[verse] = splitLyricSyllables(unquote(fieldValue(f)));
      }
      for (let i = 0; i < verse; i++) if (!staff.lyrics[i]) staff.lyrics[i] = [];
    } else if (OBJECT_CLASSES[type]) {
      const obj = OBJECT_CLASSES[type](staff);
      obj.parse(fields);
      staff.objects.push(obj);
    }
  }
  finishStaff();

  return file;
}

export { splitLyricSyllables };
