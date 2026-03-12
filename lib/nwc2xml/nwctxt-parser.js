// NWCTXT Parser for NWC 2.75+ files
import { NWCFile, NWCStaff } from './parser.js';
import { ObjType, Accidental, NoteAttr, DurationType } from './constants.js';

// Extract everything after the first colon in a field string.
// Using indexOf instead of split(':')[1] to correctly handle values that
// contain colons (e.g. URLs in copyright fields, tempo text, etc.).
function fieldValue(f) {
  const idx = f.indexOf(':');
  return idx === -1 ? '' : f.substring(idx + 1);
}

class NWCTxtObj {
  constructor(type, staff) { this.type = type; this.staff = staff; this.children = []; }
}

class ClefTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Clef, s); this.clefType = 0; this.octaveShift = 0; }
  parse(fields) {
    const types = { Treble: 0, Bass: 1, Alto: 2, Tenor: 3, Percussion: 4 };
    for (const f of fields) {
      if (f.startsWith('Type:')) this.clefType = types[fieldValue(f)] || 0;
      if (f.startsWith('OctaveShift:')) {
        const v = fieldValue(f);
        this.octaveShift = v.includes('Down') ? -1 : v.includes('Up') ? 1 : 0;
      }
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
      }
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
      }
    }
  }
  getBeatType() { return this.beatValue; }
}

class BarLineTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.BarLine, s); this.style = 0; this.repeatCount = 2; this._sysBreak = false; }
  parse(fields) {
    const styles = { Single: 0, Double: 1, SectionOpen: 2, SectionClose: 3, LocalRepeatOpen: 4, LocalRepeatClose: 5, MasterRepeatOpen: 6, MasterRepeatClose: 7 };
    for (const f of fields) {
      if (f.startsWith('Style:')) this.style = styles[fieldValue(f)] || 0;
      if (f.startsWith('Repeat:')) this.repeatCount = parseInt(fieldValue(f)) || 2;
      if (f.startsWith('SysBreak:') && fieldValue(f) === 'Y') this._sysBreak = true;
    }
  }
  getStyle() { return this.style; }
  systemBreak() { return this._sysBreak; }
}

const DUR_MAP = { Whole: 0, Half: 1, '4th': 2, '8th': 3, '16th': 4, '32nd': 5, '64th': 6 };

class NoteTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Note, s); this.duration = 2; this.pos = 0; this.accidental = Accidental.Normal; this.dots = 0; this.attr = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Dur:')) {
        const parts = fieldValue(f).split(',');
        this.duration = DUR_MAP[parts[0]] ?? 2;
        for (const p of parts) {
          if (p === 'Dotted') this.dots = 1;
          if (p === 'DblDotted') this.dots = 2;
          if (p === 'Triplet') this.attr |= DurationType.Triplet;
          if (p === 'Slur') this.attr |= NoteAttr.SlurBeg;
          if (p === 'Grace') this.attr |= NoteAttr.Grace;
        }
      }
      if (f.startsWith('Pos:')) {
        const pos = fieldValue(f).split(',')[0];
        const m = pos.match(/([#bnxv]?)(-?\d+)/);
        if (m) {
          // Negate to match binary parser convention (adapter will negate back)
          this.pos = -parseInt(m[2]);
          const acc = { '#': Accidental.Sharp, 'b': Accidental.Flat, 'n': Accidental.Natural, 'x': Accidental.SharpSharp, 'v': Accidental.FlatFlat };
          this.accidental = acc[m[1]] ?? Accidental.Normal;
        }
      }
      if (f.startsWith('Opts:')) {
        const opts = fieldValue(f);
        if (opts.includes('Tie')) this.attr |= NoteAttr.TieBeg;
        if (opts.includes('Accent')) this.attr |= NoteAttr.Accent;
        if (opts.includes('Staccato') && !opts.includes('Staccatissimo')) this.attr |= NoteAttr.Staccato;
        if (opts.includes('Staccatissimo')) this.attr |= NoteAttr.Staccatissimo;
        if (opts.includes('Tenuto')) this.attr |= NoteAttr.Tenuto;
        if (opts.includes('Marcato')) this.attr |= NoteAttr.Marcato;
        if (opts.includes('Sforzando')) this.attr |= NoteAttr.Sforzando;
        if (opts.includes('Fermata')) this.attr |= NoteAttr.Fermata;
        if (opts.includes('Beam=First')) this.attr |= NoteAttr.BeamBeg;
        if (opts.includes('Beam=End')) this.attr |= NoteAttr.BeamEnd;
        if (opts.includes('Stem=Up')) this.attr |= NoteAttr.StemUp;
        if (opts.includes('Stem=Down')) this.attr |= NoteAttr.StemDown;
      }
    }
  }
  getDuration() { return this.duration; }
  getDurationType() {
    let dt = this.attr & DurationType.Triplet;
    if (this.dots === 2) dt |= DurationType.DotDot;
    else if (this.dots === 1) dt |= DurationType.Dot;
    return dt;
  }
  getDurationTicks(div) {
    let d = div / (1 << this.duration);
    const dt = this.getDurationType();
    if (dt & DurationType.DotDot) d += d / 4;
    else if (dt & DurationType.Dot) d += d / 2;
    if (dt & DurationType.Triplet) d = d * 2 / 3;
    return Math.round(d * 4);
  }
  getDivision() {
    let d = 1 << this.duration;
    if (this.dots === 2) d <<= 2;
    else if (this.dots === 1) d <<= 1;
    if (this.attr & DurationType.Triplet) d = (d % 2) ? d * 3 : (d / 2) * 3;
    return d;
  }
  getAccidental() { return this.accidental; }
  getAttributes() { return this.attr; }
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

class RestTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Rest, s); this.duration = 2; this.dots = 0; this.attr = 0; this.offset = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Dur:')) {
        const parts = fieldValue(f).split(',');
        this.duration = DUR_MAP[parts[0]] ?? 2;
        for (const p of parts) {
          if (p === 'Dotted') this.dots = 1;
          if (p === 'DblDotted') this.dots = 2;
          if (p === 'Triplet') this.attr |= DurationType.Triplet;
        }
      }
      if (f.startsWith('Offset:')) this.offset = parseInt(fieldValue(f)) || 0;
    }
  }
  getDuration() { return this.duration; }
  getDurationType() {
    let dt = this.attr & DurationType.Triplet;
    if (this.dots === 2) dt |= DurationType.DotDot;
    else if (this.dots === 1) dt |= DurationType.Dot;
    return dt;
  }
  getDurationTicks(div) {
    let d = div / (1 << this.duration);
    const dt = this.getDurationType();
    if (dt & DurationType.DotDot) d += d / 4;
    else if (dt & DurationType.Dot) d += d / 2;
    if (dt & DurationType.Triplet) d = d * 2 / 3;
    return Math.round(d * 4);
  }
  getDivision() {
    let d = 1 << this.duration;
    if (this.dots === 2) d <<= 2;
    else if (this.dots === 1) d <<= 1;
    if (this.attr & DurationType.Triplet) d = (d % 2) ? d * 3 : (d / 2) * 3;
    return d;
  }
  getOctaveStep(clefShift) { return { octave: 4, step: 'B', hasPos: this.offset !== 0 }; }
}

class ChordTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.NoteCM, s); this.duration = 2; this.dots = 0; this.attr = 0; this.pos = 0; this.accidental = Accidental.Normal; this.children = []; this.count = 0; }
  parse(fields) {
    const positions = [];
    for (const f of fields) {
      if (f.startsWith('Dur:')) {
        const parts = fieldValue(f).split(',');
        this.duration = DUR_MAP[parts[0]] ?? 2;
        for (const p of parts) {
          if (p === 'Dotted') this.dots = 1;
          if (p === 'DblDotted') this.dots = 2;
          if (p === 'Triplet') this.attr |= DurationType.Triplet;
          if (p === 'Slur') this.attr |= NoteAttr.SlurBeg;
        }
      }
      if (f.startsWith('Pos:')) {
        for (const pos of fieldValue(f).split(',')) {
          const m = pos.match(/([#bnxv]?)(-?\d+)/);
          if (m) {
            const acc = { '#': Accidental.Sharp, 'b': Accidental.Flat, 'n': Accidental.Natural, 'x': Accidental.SharpSharp, 'v': Accidental.FlatFlat };
            // Negate to match binary parser convention (adapter will negate back)
            positions.push({ pos: -parseInt(m[2]), acc: acc[m[1]] ?? Accidental.Normal });
          }
        }
      }
      if (f.startsWith('Opts:')) {
        const opts = fieldValue(f);
        if (opts.includes('Tie')) this.attr |= NoteAttr.TieBeg;
        if (opts.includes('Stem=Up')) this.attr |= NoteAttr.StemUp;
        if (opts.includes('Stem=Down')) this.attr |= NoteAttr.StemDown;
      }
    }
    if (positions.length > 0) {
      this.pos = positions[0].pos;
      this.accidental = positions[0].acc;
    }
    // Include ALL notes as children (matching binary parser where count = total notes)
    this.count = positions.length;
    for (let i = 0; i < positions.length; i++) {
      const child = new NoteTxtObj(this.staff);
      child.duration = this.duration;
      child.pos = positions[i].pos;
      child.accidental = positions[i].acc;
      child.dots = this.dots;
      child.attr = this.attr;
      this.children.push(child);
    }
  }
  getDuration() { return this.duration; }
  getDurationType() {
    let dt = this.attr & DurationType.Triplet;
    if (this.dots === 2) dt |= DurationType.DotDot;
    else if (this.dots === 1) dt |= DurationType.Dot;
    return dt;
  }
  getDurationTicks(div) {
    let d = div / (1 << this.duration);
    const dt = this.getDurationType();
    if (dt & DurationType.DotDot) d += d / 4;
    else if (dt & DurationType.Dot) d += d / 2;
    if (dt & DurationType.Triplet) d = d * 2 / 3;
    return Math.round(d * 4);
  }
  getDivision() {
    let d = 1 << this.duration;
    if (this.dots === 2) d <<= 2;
    else if (this.dots === 1) d <<= 1;
    if (this.attr & DurationType.Triplet) d = (d % 2) ? d * 3 : (d / 2) * 3;
    return d;
  }
  getAccidental() { return this.accidental; }
  getAttributes() { return this.attr; }
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

class TempoTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Tempo, s); this.value = 120; this.base = 2; this.text = ''; this.dotted = false; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Tempo:')) this.value = parseInt(fieldValue(f)) || 120;
      if (f.startsWith('Base:')) {
        const b = fieldValue(f);
        if (b.includes('Dotted')) this.dotted = true;
        if (b.includes('Eighth')) this.base = 3;
        else if (b.includes('Half')) this.base = 1;
        else this.base = 2;
      }
      if (f.startsWith('Text:')) this.text = fieldValue(f).replace(/^"|"$/g, '');
    }
  }
  getTempoNote() { return ['half', 'half', 'quarter', 'eighth'][this.base] || 'quarter'; }
  isDotted() { return this.dotted; }
  getSpeed() { return this.value; }
}

class DynamicTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Dynamic, s); this.style = 4; }
  parse(fields) {
    const styles = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7 };
    for (const f of fields) {
      if (f.startsWith('Style:')) this.style = styles[fieldValue(f)] ?? 4;
    }
  }
  getStyleName() { return ['ppp','pp','p','mp','mf','f','ff','fff'][this.style] || 'mf'; }
}

class TextTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Text, s); this.text = ''; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Text:')) {
        const t = f.substring(5);
        this.text = t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
      }
    }
  }
}

class EndingTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.Ending, s); this.style = 0; }
  parse(fields) {
    for (const f of fields) {
      if (f.startsWith('Endings:')) {
        const e = fieldValue(f);
        if (e.includes('1')) this.style |= 1;
        if (e.includes('2')) this.style |= 2;
        if (e.includes('3')) this.style |= 4;
      }
    }
  }
}

class FlowTxtObj extends NWCTxtObj {
  constructor(s) { super(ObjType.FlowDir, s); this.style = 0; }
  parse(fields) {
    const styles = { Coda: 0, Segno: 1, Fine: 2, ToCoda: 3, DaCapo: 4, DCAlCoda: 5, DCAlFine: 6, DalSegno: 7, DSAlCoda: 8, DSAlFine: 9 };
    for (const f of fields) {
      if (f.startsWith('Style:')) this.style = styles[fieldValue(f).replace(/ /g, '')] ?? 0;
    }
  }
}

export function parseNWCTxt(text) {
  const file = new NWCFile();
  file.version = 0x024B;
  let staff = null;
  
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (line.startsWith('!NoteWorthyComposer-End')) break;
    
    if (line.startsWith('|')) {
      const parts = line.split('|').filter(p => p);
      if (parts.length === 0) continue;
      const type = parts[0];
      const fields = parts.slice(1);
      
      if (type === 'SongInfo') {
        for (const f of fields) {
          if (f.startsWith('Title:')) file.title = fieldValue(f).replace(/^"|"$/g, '');
          if (f.startsWith('Author:')) file.author = fieldValue(f).replace(/^"|"$/g, '');
          if (f.startsWith('Lyricist:')) file.lyricist = fieldValue(f).replace(/^"|"$/g, '');
          if (f.startsWith('Copyright1:')) file.copyright1 = fieldValue(f).replace(/^"|"$/g, '');
          if (f.startsWith('Copyright2:')) file.copyright2 = fieldValue(f).replace(/^"|"$/g, '');
        }
      } else if (type === 'AddStaff') {
        staff = new NWCStaff(file);
        file.staffs.push(staff);
        for (const f of fields) {
          if (f.startsWith('Name:')) staff.name = fieldValue(f).replace(/^"|"$/g, '');
          if (f.startsWith('Group:')) staff.group = fieldValue(f).replace(/^"|"$/g, '');
        }
      } else if (type === 'StaffProperties' && staff) {
        for (const f of fields) {
          if (f.startsWith('Channel:')) staff.channel = parseInt(fieldValue(f)) || 0;
        }
      } else if (type === 'StaffInstrument' && staff) {
        for (const f of fields) {
          if (f.startsWith('Patch:')) staff.patchName = parseInt(fieldValue(f)) || 0;
          if (f.startsWith('Trans:')) staff.transposition = parseInt(fieldValue(f)) || 0;
        }
      } else if (staff) {
        let obj = null;
        if (type === 'Clef') obj = new ClefTxtObj(staff);
        else if (type === 'Key') obj = new KeySigTxtObj(staff);
        else if (type === 'TimeSig') obj = new TimeSigTxtObj(staff);
        else if (type === 'Bar') obj = new BarLineTxtObj(staff);
        else if (type === 'Note') obj = new NoteTxtObj(staff);
        else if (type === 'Rest') obj = new RestTxtObj(staff);
        else if (type === 'Chord' || type === 'RestChord') obj = new ChordTxtObj(staff);
        else if (type === 'Tempo') obj = new TempoTxtObj(staff);
        else if (type === 'Dynamic') obj = new DynamicTxtObj(staff);
        else if (type === 'Text') obj = new TextTxtObj(staff);
        else if (type === 'Ending') obj = new EndingTxtObj(staff);
        else if (type === 'Flow') obj = new FlowTxtObj(staff);
        
        if (obj) {
          obj.parse(fields);
          staff.objects.push(obj);
        }
      }
    }
  }
  
  return file;
}
