// NWC Object classes
import { ObjType, NWC_Version, Accidental, NoteAttr, DurationType, BarStyle, FlowStyle } from './constants.js';

export class NWCObj {
  constructor(type, staff) { this.type = type; this.staff = staff; this.visible = 0; }
  get version() { return this.staff?.file?.version || 0; }
  load(r) {
    if (this.version >= NWC_Version.V170) {
      this.visible = r.readUint8();
      // In older formats, visibility value 3 means "Never" (index 5 in the visibility enum)
      if (this.version < NWC_Version.V200 && this.visible === 3) {
        this.visible = 5;
      }
    }
  }
}

export class ClefObj extends NWCObj {
  constructor(s) { super(ObjType.Clef, s); this.clefType = 0; this.octaveShift = 0; }
  load(r) { super.load(r); this.clefType = r.readInt16(); this.octaveShift = r.readInt16(); }
}

export class KeySigObj extends NWCObj {
  constructor(s) { super(ObjType.KeySig, s); this.flat = 0; this.sharp = 0; }
  load(r) {
    super.load(r);
    this.flat = r.readUint8(); r.skip(1);
    this.sharp = r.readUint8(); r.skip(7);
  }
  getChromAlter() {
    const ca = new Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
      if (this.sharp) ca[i] = (this.sharp >> i) & 1 ? 1 : 0;
      else if (this.flat) ca[i] = (this.flat >> i) & 1 ? -1 : 0;
    }
    return ca;
  }
  getFifths() {
    if (this.sharp) return bitcount(this.sharp);
    if (this.flat) return -bitcount(this.flat);
    return 0;
  }
}

export class BarLineObj extends NWCObj {
  constructor(s) { super(ObjType.BarLine, s); this.style = 0; this.repeatCount = 2; }
  load(r) { super.load(r); this.style = r.readUint8(); this.repeatCount = r.readUint8(); }
  getStyle() { return this.style & 0x7F; }
  systemBreak() { return (this.style & 0x80) !== 0; }
}

export class EndingObj extends NWCObj {
  constructor(s) { super(ObjType.Ending, s); this.style = 0; }
  load(r) { super.load(r); this.style = r.readUint8(); r.skip(1); }
}

export class InstrumentObj extends NWCObj {
  constructor(s) { super(ObjType.Instrument, s); this.name = ''; }
  load(r) {
    super.load(r);
    if (this.version < NWC_Version.V170) r.skip(6);
    else if (this.version < NWC_Version.V200) r.skip(8);
    else { r.skip(8); this.name = r.readStringNul(); r.skip(9); }
  }
}

export class TimeSigObj extends NWCObj {
  constructor(s) { super(ObjType.TimeSig, s); this.beats = 4; this.beatType = 2; this.style = 0; }
  load(r) { super.load(r); this.beats = r.readInt16(); this.beatType = r.readInt16(); this.style = r.readInt16(); }
  getBeatType() { return 1 << this.beatType; }
}

export class TempoObj extends NWCObj {
  constructor(s) { super(ObjType.Tempo, s); this.pos = 0; this.value = 120; this.base = 2; this.text = ''; }
  load(r) {
    super.load(r);
    this.pos = r.readInt8(); this.placement = r.readUint8();
    this.value = r.readInt16(); this.base = r.readUint8();
    if (this.version < NWC_Version.V170) r.skip(2);
    this.text = r.readStringNul();
  }
  getTempoNote() { return ['eighth', 'quarter', 'half'][Math.floor(this.base / 2)] || 'quarter'; }
  isDotted() { return this.base % 2 === 1; }
  getSpeed() { return this.value; }
}

export class DynamicObj extends NWCObj {
  constructor(s) { super(ObjType.Dynamic, s); this.pos = 0; this.style = 0; }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) {
      this.pos = r.readInt8(); this.placement = r.readUint8();
      this.style = r.readUint8(); r.skip(4);
    } else {
      this.placement = r.readUint8(); this.pos = r.readInt8();
      this.style = this.placement & 0x07; r.skip(4);
    }
  }
  getStyleName() { return ['ppp','pp','p','mp','mf','f','ff','fff'][this.style & 0x1F] || 'mf'; }
}

export class NoteObj extends NWCObj {
  constructor(s) { super(ObjType.Note, s); }
  load(r) {
    super.load(r);
    this.duration = r.readUint8();
    this.data2 = r.readBytes(3);
    this.attr1 = r.readBytes(2);
    this.pos = r.readInt8();
    this.attr2 = r.readBytes(1);
    if (this.version <= NWC_Version.V170) this.data3 = r.readBytes(2);
    this.stemLength = 7;
    if (this.version >= NWC_Version.V200 && (this.attr2[0] & 0x40)) this.stemLength = r.readUint8();
  }
  getDuration() { return this.duration & 0x0F; }
  getDurationType() {
    let dt = 0;
    if (this.attr1[0] & 0x01) dt |= DurationType.DotDot;
    else if (this.attr1[0] & 0x04) dt |= DurationType.Dot;
    if (this.data2[1] & 0x0C) dt |= (this.data2[1] & 0x0C);
    return dt;
  }
  getDurationTicks(div) {
    let d = div / (1 << this.getDuration());
    const dt = this.getDurationType();
    if (dt & DurationType.DotDot) d += d / 4;
    else if (dt & DurationType.Dot) d += d / 2;
    if (dt & DurationType.Triplet) d = d * 2 / 3;
    return Math.round(d * 4);
  }
  getDivision() {
    let d = 1 << this.getDuration();
    if (this.attr1[0] & 0x01) d <<= 2;
    else if (this.attr1[0] & 0x04) d <<= 1;
    if (this.data2[1] & 0x0C) d = (d % 2) ? d * 3 : (d / 2) * 3;
    return d;
  }
  getAccidental() { return this.attr2[0] & 0x07; }
  // LyricSyllable: 2-bit field from bits 7-8 of the second common-base uint16.
  // The second uint16 is data2[1] (low byte) + data2[2] (high byte) in LE.
  // Bits 7-8 = bit 7 of data2[1] + bit 0 of data2[2].
  // 0 = Default, 1 = Always, 2 = Never
  getLyricSyllable() {
    return ((this.data2[1] >> 7) & 1) | ((this.data2[2] & 1) << 1);
  }
  getAttributes() {
    let na = 0;
    if (this.attr1[1] & 0x20) na |= NoteAttr.Grace;
    if (this.attr1[1] & 0x04) na |= NoteAttr.Tenuto;
    na |= (this.attr1[1] & 0x03) * NoteAttr.SlurBeg;
    if (this.attr1[0] & 0x20) na |= NoteAttr.Accent;
    if (this.attr1[0] & 0x10) na |= NoteAttr.TieBeg;
    if (this.attr1[0] & 0x08) na |= NoteAttr.TieEnd;
    if (this.attr1[0] & 0x02) na |= NoteAttr.Staccato;
    na |= (this.data2[1] & 0x03) * NoteAttr.BeamBeg;
    if (this.attr1[1] & 0x80) na |= (this.data2[1] & 0x40) ? NoteAttr.SlurDirDown : NoteAttr.SlurDirUp;
    if (this.attr1[1] & 0x40) na |= (this.attr2[0] & 0x08) ? NoteAttr.TieDirDown : NoteAttr.TieDirUp;
    na |= ((this.data2[1] & 0x30) >> 4) * NoteAttr.StemUp;
    // Additional articulation flags from data2[2] and attr1 upper bits
    if (this.attr1[0] & 0x40) na |= NoteAttr.Sforzando;
    if (this.attr1[1] & 0x08) na |= NoteAttr.Marcato;
    if (this.data2[2] & 0x04) na |= NoteAttr.Crescendo;
    if (this.data2[2] & 0x08) na |= NoteAttr.Diminuendo;
    if (this.data2[2] & 0x10) na |= NoteAttr.Staccatissimo;
    if (this.data2[2] & 0x20) na |= NoteAttr.Fermata;
    return na;
  }
  isStemUp() {
    const na = this.getAttributes();
    if ((na & NoteAttr.StemMask) === NoteAttr.StemUp) return true;
    if ((na & NoteAttr.StemMask) === NoteAttr.StemDown) return false;
    return this.pos > 0;
  }
  getOctaveStep(clefShift, measureAlter) {
    const p = clefShift + this.pos;
    const octave = Math.floor((4 * 7 - p + 6) / 7);
    const stepIdx = ((4 * 7 - p + 1) % 7 + 7) % 7;
    const step = String.fromCharCode(65 + stepIdx);
    const acc = this.getAccidental();
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

export class RestObj extends NWCObj {
  constructor(s, type = ObjType.Rest) { super(type, s); }
  load(r) {
    super.load(r);
    this.duration = r.readUint8();
    this.data2 = r.readBytes(5);
    if (this.version <= NWC_Version.V150) { this.offset = this.data2[4]; }
    else { this.offset = r.readInt16(); }
  }
  getDuration() { return this.duration & 0x0F; }
  getDurationType() {
    let dt = 0;
    if (this.data2[3] & 0x01) dt |= DurationType.DotDot;
    else if (this.data2[3] & 0x04) dt |= DurationType.Dot;
    if (this.data2[1] & 0x0C) dt |= (this.data2[1] & 0x0C);
    return dt;
  }
  getDurationTicks(div) {
    let d = div / (1 << this.getDuration());
    const dt = this.getDurationType();
    if (dt & DurationType.DotDot) d += d / 4;
    else if (dt & DurationType.Dot) d += d / 2;
    if (dt & DurationType.Triplet) d = d * 2 / 3;
    return Math.round(d * 4);
  }
  getDivision() {
    let d = 1 << this.getDuration();
    if (this.data2[3] & 0x01) d <<= 2;
    else if (this.data2[3] & 0x04) d <<= 1;
    if (this.data2[1] & 0x0C) d = (d % 2) ? d * 3 : (d / 2) * 3;
    return d;
  }
  getOctaveStep(clefShift) {
    const p = clefShift + this.offset;
    const octave = Math.floor((4 * 7 - p + 6) / 7);
    const stepIdx = ((4 * 7 - p + 1) % 7 + 7) % 7;
    return { octave, step: String.fromCharCode(65 + stepIdx), hasPos: this.offset !== 0 };
  }
}

export class NoteCMObj extends NWCObj {
  constructor(s) { super(ObjType.NoteCM, s); this.children = []; }
  load(r) {
    super.load(r);
    const len = this.version <= NWC_Version.V170 ? 12 : 8;
    this.data1 = r.readBytes(len);
    this.stemLength = 7;
    if (this.version >= NWC_Version.V200 && (this.data1[7] & 0x40)) this.stemLength = r.readUint8();
    this.count = r.readInt16();
  }
  // data1 mirrors NoteObj byte layout: [duration, data2..., attr1..., pos, attr2]
  // The parent's duration is authoritative for all children in the chord.
  getDuration() { return this.data1[0] & 0x0F; }
  getDurationType() {
    // attr1[0] is at data1[4], same layout as NoteObj
    let dt = 0;
    if (this.data1[4] & 0x01) dt |= DurationType.DotDot;
    else if (this.data1[4] & 0x04) dt |= DurationType.Dot;
    if (this.data1[2] & 0x0C) dt |= (this.data1[2] & 0x0C);
    return dt;
  }
}

export class RestCMObj extends RestObj {
  constructor(s) { super(s, ObjType.RestCM); this.children = []; }
  load(r) { super.load(r); this.count = r.readInt16(); }
}

export class PedalObj extends NWCObj {
  constructor(s) { super(ObjType.Pedal, s); }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) { this.pos = r.readInt8(); this.placement = r.readUint8(); this.style = r.readUint8(); }
    else if (this.version <= NWC_Version.V155) { this.pos = r.readInt8(); r.skip(1); this.placement = r.readUint8(); this.style = r.readUint8(); }
    else { this.pos = r.readInt8(); this.style = r.readUint8(); this.placement = 0; }
  }
}

export class FlowDirObj extends NWCObj {
  constructor(s) { super(ObjType.FlowDir, s); }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) { this.pos = r.readInt8(); this.placement = r.readUint8(); this.style = r.readInt16(); }
    else { this.pos = -8; this.placement = 1; this.style = r.readInt16(); }
  }
  moveBeforeMeasure() { return this.style === FlowStyle.ToCoda; }
}

export class MPCObj extends NWCObj {
  constructor(s) { super(ObjType.MPC, s); }
  load(r) {
    super.load(r);
    this.pos = r.readInt8(); this.placement = r.readUint8();
    r.skip(this.version <= NWC_Version.V155 ? 0x1E : 32);
  }
}

export class TempVarObj extends NWCObj {
  constructor(s) { super(ObjType.TempVar, s); }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) { this.pos = r.readInt8(); this.placement = r.readUint8(); this.style = r.readUint8(); this.delay = r.readUint8(); }
    else { this.style = r.readUint8() & 0x0F; this.pos = r.readInt8(); this.placement = r.readUint8(); this.delay = r.readUint8(); }
    // Pre-V200 files store style values offset by -1; the native viewer adjusts style += 1 for values >= 1
    if (this.version < NWC_Version.V200 && this.style >= 1) {
      this.style = (this.style + 1) & 0xFF;
    }
  }
}

export class DynVarObj extends NWCObj {
  constructor(s) { super(ObjType.DynVar, s); }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) { this.pos = r.readInt8(); this.placement = r.readUint8(); this.style = r.readUint8(); }
    else { this.pos = r.readInt8(); this.style = r.readUint8(); this.placement = 0; }
  }
}

export class PerformObj extends NWCObj {
  constructor(s) { super(ObjType.Perform, s); }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) { this.pos = r.readInt8(); this.placement = r.readUint8(); this.style = r.readUint8(); }
    else { this.style = r.readUint8(); this.pos = r.readInt8(); this.placement = 0; }
  }
}

export class TextObj extends NWCObj {
  constructor(s) { super(ObjType.Text, s); this.text = ''; }
  load(r) {
    super.load(r);
    if (this.version >= NWC_Version.V170) { this.pos = r.readInt8(); r.skip(1); this.font = r.readUint8(); }
    else { this.font = r.readUint8(); this.pos = r.readInt8(); }
    this.text = r.readStringNul();
  }
}

// V205+ object types
export class SpacerObj extends NWCObj {
  constructor(s) { super(ObjType.Spacer, s); }
  load(r) { super.load(r); this.width = r.readUint8(); r.skip(2); }
}

function bitcount(b) { let c = 0; while (b) { c++; b &= b - 1; } return c; }

export function createObject(type, staff) {
  const classes = {
    [ObjType.Clef]: ClefObj, [ObjType.KeySig]: KeySigObj, [ObjType.BarLine]: BarLineObj,
    [ObjType.Ending]: EndingObj, [ObjType.Instrument]: InstrumentObj, [ObjType.TimeSig]: TimeSigObj,
    [ObjType.Tempo]: TempoObj, [ObjType.Dynamic]: DynamicObj, [ObjType.Note]: NoteObj,
    [ObjType.Rest]: RestObj, [ObjType.NoteCM]: NoteCMObj, [ObjType.Pedal]: PedalObj,
    [ObjType.FlowDir]: FlowDirObj, [ObjType.MPC]: MPCObj, [ObjType.TempVar]: TempVarObj,
    [ObjType.DynVar]: DynVarObj, [ObjType.Perform]: PerformObj, [ObjType.Text]: TextObj,
    [ObjType.RestCM]: RestCMObj, [ObjType.Spacer]: SpacerObj
  };
  return classes[type] ? new classes[type](staff) : null;
}
