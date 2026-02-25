// MusicXML Writer
import { ObjType, BarStyle, FlowStyle, NoteAttr, DurationType, GM_PATCHES } from './constants.js';
import { ClefObj, KeySigObj, BarLineObj, EndingObj, TimeSigObj, TempoObj, DynamicObj, 
         NoteObj, RestObj, NoteCMObj, RestCMObj, PedalObj, FlowDirObj, TextObj } from './objects.js';

const NOTE_TYPES = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th'];

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

class XMLWriter {
  constructor() { this.lines = []; this.indent = 0; }
  
  write(s) { this.lines.push('  '.repeat(this.indent) + s); }
  open(tag, attrs = {}) {
    const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('');
    this.write(`<${tag}${a}>`);
    this.indent++;
  }
  close(tag) { this.indent--; this.write(`</${tag}>`); }
  empty(tag, attrs = {}) {
    const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('');
    this.write(`<${tag}${a}/>`);
  }
  elem(tag, content, attrs = {}) {
    const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('');
    this.write(`<${tag}${a}>${escapeXml(content)}</${tag}>`);
  }
  toString() { return this.lines.join('\n'); }
}

export function toMusicXML(nwcFile) {
  const w = new XMLWriter();
  
  w.write('<?xml version="1.0" encoding="UTF-8"?>');
  w.write('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  w.open('score-partwise', { version: '4.0' });
  
  if (nwcFile.title) {
    w.open('work');
    w.elem('work-title', nwcFile.title);
    w.close('work');
  }
  
  w.open('identification');
  if (nwcFile.author) { w.open('creator', { type: 'composer' }); w.write(escapeXml(nwcFile.author)); w.close('creator'); }
  if (nwcFile.copyright1) w.elem('rights', nwcFile.copyright1);
  if (nwcFile.copyright2) w.elem('rights', nwcFile.copyright2);
  w.open('encoding');
  w.elem('software', 'nwc2musicxml');
  w.elem('encoding-date', new Date().toISOString().slice(0, 10));
  w.close('encoding');
  w.close('identification');
  
  // Part list
  w.open('part-list');
  nwcFile.staffs.forEach((staff, i) => {
    const id = `P${i + 1}`;
    w.open('score-part', { id });
    w.elem('part-name', staff.name || `Part ${i + 1}`);
    w.open('score-instrument', { id: `${id}-I1` });
    w.elem('instrument-name', GM_PATCHES[staff.patchName] || 'Piano');
    w.close('score-instrument');
    w.open('midi-instrument', { id: `${id}-I1` });
    w.elem('midi-channel', staff.channel + 1);
    w.elem('midi-program', staff.patchName + 1);
    w.close('midi-instrument');
    w.close('score-part');
  });
  w.close('part-list');
  
  // Parts
  nwcFile.staffs.forEach((staff, i) => {
    w.open('part', { id: `P${i + 1}` });
    writeStaff(w, staff, nwcFile.measureStart);
    w.close('part');
  });
  
  w.close('score-partwise');
  return w.toString();
}

function writeStaff(w, staff, measureNum) {
  const div = staff.getDivisions();
  let clefShift = 0;
  let measureAlter = new Array(7).fill(0);
  let systemAlter = new Array(7).fill(0);
  let curEnding = '';
  let lyricIdx = 0;
  let needNewMeasure = false;
  let curBarDuration = 4;
  
  w.open('measure', { number: measureNum });
  w.open('attributes');
  w.elem('divisions', div);
  w.close('attributes');
  
  const objs = staff.objects;
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    
    switch (obj.type) {
      case ObjType.Clef:
        writeClef(w, obj);
        clefShift = [0, 12, 0, 0][obj.clefType] || 0;
        break;
        
      case ObjType.KeySig:
        w.open('attributes');
        w.open('key');
        w.elem('fifths', obj.getFifths());
        w.close('key');
        w.close('attributes');
        systemAlter = obj.getChromAlter();
        measureAlter = [...systemAlter];
        break;
        
      case ObjType.TimeSig:
        w.open('attributes');
        w.open('time', obj.style === 1 ? { symbol: 'common' } : obj.style === 2 ? { symbol: 'cut' } : {});
        w.elem('beats', obj.beats);
        w.elem('beat-type', obj.getBeatType());
        w.close('time');
        w.close('attributes');
        curBarDuration = obj.beats;
        break;
        
      case ObjType.BarLine:
        const style = obj.getStyle();
        // Right barline
        if ([BarStyle.SectionClose, BarStyle.LocalClose, BarStyle.MasterClose].includes(style)) {
          w.open('barline', { location: 'right' });
          w.elem('bar-style', style === BarStyle.LocalClose ? 'light-heavy' : 'light-heavy');
          if (curEnding && [BarStyle.LocalClose, BarStyle.MasterClose].includes(style)) {
            w.empty('ending', { type: 'stop', number: curEnding });
            curEnding = '';
          }
          if ([BarStyle.LocalClose, BarStyle.MasterClose].includes(style)) {
            const attrs = { direction: 'backward' };
            if (style === BarStyle.LocalClose && obj.repeatCount !== 2) attrs.times = obj.repeatCount;
            w.empty('repeat', attrs);
          }
          w.close('barline');
        }
        
        if (needNewMeasure) {
          w.close('measure');
          measureNum++;
          measureAlter = [...systemAlter];
          w.open('measure', { number: measureNum });
        }
        needNewMeasure = false;
        
        // Check for ending
        let endingNum = '';
        for (let j = i + 1; j < objs.length; j++) {
          if (objs[j].type === ObjType.BarLine) break;
          if (objs[j].type === ObjType.Ending) {
            const nums = [];
            let e = objs[j].style, n = 1;
            while (e) { if (e & 1) nums.push(n); e >>= 1; n++; }
            endingNum = nums.join(', ');
            break;
          }
        }
        
        // Left barline
        if (endingNum || [BarStyle.Double, BarStyle.SectionOpen, BarStyle.LocalOpen, BarStyle.MasterOpen].includes(style)) {
          w.open('barline', { location: 'left' });
          if ([BarStyle.SectionOpen, BarStyle.MasterOpen, BarStyle.Double, BarStyle.LocalOpen].includes(style)) {
            w.elem('bar-style', 'heavy-light');
          }
          if (endingNum) {
            w.empty('ending', { type: 'start', number: endingNum });
            curEnding = endingNum;
          }
          if ([BarStyle.LocalOpen, BarStyle.MasterOpen].includes(style)) {
            w.empty('repeat', { direction: 'forward' });
          }
          w.close('barline');
        }
        break;
        
      case ObjType.Tempo:
        w.open('direction');
        w.open('direction-type');
        w.open('metronome', { parentheses: 'no' });
        w.elem('beat-unit', obj.getTempoNote());
        if (obj.isDotted()) w.empty('beat-unit-dot');
        w.elem('per-minute', obj.getSpeed());
        w.close('metronome');
        w.close('direction-type');
        w.empty('sound', { tempo: obj.value });
        w.close('direction');
        break;
        
      case ObjType.Dynamic:
        w.open('direction');
        w.open('direction-type');
        w.open('dynamics');
        w.empty(obj.getStyleName());
        w.close('dynamics');
        w.close('direction-type');
        w.close('direction');
        break;
        
      case ObjType.Note:
        needNewMeasure = true;
        writeNote(w, obj, div, clefShift, measureAlter, staff.lyrics, lyricIdx);
        if (canHaveLyric(obj.getAttributes())) lyricIdx++;
        break;
        
      case ObjType.Rest:
        needNewMeasure = true;
        writeRest(w, obj, div, clefShift, curBarDuration);
        break;
        
      case ObjType.NoteCM:
        needNewMeasure = true;
        let first = true;
        for (const child of obj.children) {
          if (child.type === ObjType.Note) {
            writeNote(w, child, div, clefShift, measureAlter, first ? staff.lyrics : [], first ? lyricIdx : -1, !first);
            first = false;
          }
        }
        if (!first && canHaveLyric(obj.children[0]?.getAttributes?.())) lyricIdx++;
        break;
        
      case ObjType.RestCM:
        needNewMeasure = true;
        let firstR = true;
        for (const child of obj.children) {
          if (child.type === ObjType.Note) {
            writeNote(w, child, div, clefShift, measureAlter, [], -1, !firstR);
            firstR = false;
          } else if (child.type === ObjType.Rest) {
            writeRest(w, child, div, clefShift, curBarDuration);
          }
        }
        break;
        
      case ObjType.Pedal:
        w.open('direction');
        w.open('direction-type');
        w.empty('pedal', { type: obj.style === 0 ? 'stop' : 'start' });
        w.close('direction-type');
        w.close('direction');
        break;
        
      case ObjType.FlowDir:
        writeFlowDir(w, obj);
        break;
        
      case ObjType.Text:
        w.open('direction');
        w.open('direction-type');
        w.elem('words', obj.text);
        w.close('direction-type');
        w.close('direction');
        break;
    }
  }
  
  // Ending barline
  writeEndingBar(w, staff.endingBar, curEnding);
  w.close('measure');
}

function writeClef(w, obj) {
  w.open('attributes');
  w.open('clef');
  const [sign, line] = [['G', 2], ['F', 4], ['C', 3], ['G', 2]][obj.clefType] || ['G', 2];
  w.elem('sign', sign);
  w.elem('line', line);
  if (obj.clefType === 3) w.elem('clef-octave-change', -1);
  w.close('clef');
  w.close('attributes');
}

function writeNote(w, obj, div, clefShift, measureAlter, lyrics, lyricIdx, isChord = false) {
  w.open('note');
  if (isChord) w.empty('chord');
  
  const na = obj.getAttributes();
  if (na & NoteAttr.Grace) w.empty('grace');
  
  const { octave, step, alter } = obj.getOctaveStep(clefShift, measureAlter);
  w.open('pitch');
  w.elem('step', step);
  if (alter) w.elem('alter', alter);
  w.elem('octave', octave);
  w.close('pitch');
  
  if (!(na & NoteAttr.Grace)) w.elem('duration', obj.getDurationTicks(div));
  
  // Ties
  if (na & NoteAttr.TieEnd) w.empty('tie', { type: 'stop' });
  if (na & NoteAttr.TieBeg) w.empty('tie', { type: 'start' });
  
  w.elem('type', NOTE_TYPES[obj.getDuration()] || 'quarter');
  
  const dt = obj.getDurationType();
  if (dt & DurationType.DotDot) { w.empty('dot'); w.empty('dot'); }
  else if (dt & DurationType.Dot) w.empty('dot');
  
  // Accidental
  const acc = obj.getAccidental();
  if (acc <= 4) {
    w.elem('accidental', ['sharp', 'flat', 'natural', 'sharp-sharp', 'flat-flat'][acc]);
  }
  
  // Triplet
  if (dt & DurationType.Triplet) {
    w.open('time-modification');
    w.elem('actual-notes', 3);
    w.elem('normal-notes', 2);
    w.close('time-modification');
  }
  
  // Stem
  if ((na & NoteAttr.StemMask) === NoteAttr.StemUp) w.elem('stem', 'up');
  else if ((na & NoteAttr.StemMask) === NoteAttr.StemDown) w.elem('stem', 'down');
  
  // Beam
  if (na & NoteAttr.BeamMask) {
    const beamType = { [NoteAttr.BeamBeg]: 'begin', [NoteAttr.BeamEnd]: 'end', [NoteAttr.BeamMid]: 'continue' }[na & NoteAttr.BeamMask];
    if (beamType) { w.open('beam', { number: 1 }); w.write(beamType); w.close('beam'); }
  }
  
  // Notations
  const hasTie = na & (NoteAttr.TieBeg | NoteAttr.TieEnd);
  const hasSlur = na & NoteAttr.SlurMask;
  const hasArt = na & (NoteAttr.Accent | NoteAttr.Staccato | NoteAttr.Tenuto | NoteAttr.Marcato | NoteAttr.Sforzando | NoteAttr.Staccatissimo);
  const hasTuplet = dt & DurationType.Triplet;
  
  const hasFermata = na & NoteAttr.Fermata;
  
  if (hasTie || hasSlur || hasArt || hasTuplet || hasFermata) {
    w.open('notations');
    if (na & NoteAttr.TieEnd) w.empty('tied', { type: 'stop' });
    if (na & NoteAttr.TieBeg) w.empty('tied', { type: 'start' });
    
    if (hasSlur) {
      const slurType = { [NoteAttr.SlurBeg]: 'start', [NoteAttr.SlurEnd]: 'stop', [NoteAttr.SlurMid]: 'continue' }[na & NoteAttr.SlurMask];
      if (slurType) w.empty('slur', { type: slurType, number: 1 });
    }
    
    if (hasTuplet) {
      if ((dt & DurationType.Triplet) === DurationType.TriStart) w.empty('tuplet', { type: 'start' });
      else if ((dt & DurationType.Triplet) === DurationType.TriStop) w.empty('tuplet', { type: 'stop' });
    }
    
    if (hasArt) {
      w.open('articulations');
      if (na & NoteAttr.Accent) w.empty('accent');
      if (na & NoteAttr.Staccato) w.empty('staccato');
      if (na & NoteAttr.Tenuto) w.empty('tenuto');
      if (na & NoteAttr.Marcato) w.empty('strong-accent');
      if (na & NoteAttr.Sforzando) w.empty('accent', { type: 'strong' });
      if (na & NoteAttr.Staccatissimo) w.empty('staccatissimo');
      w.close('articulations');
    }
    if (hasFermata) w.empty('fermata');
    w.close('notations');
  }
  
  // Lyrics
  if (lyrics.length && lyricIdx >= 0 && canHaveLyric(na)) {
    lyrics.forEach((lyric, li) => {
      if (lyricIdx < lyric.length) {
        let text = lyric[lyricIdx].trim();
        const next = lyric[lyricIdx + 1]?.trim() || '';
        let syllabic;
        if (text.startsWith('-')) {
          text = text.slice(1);
          syllabic = next.startsWith('-') ? 'middle' : 'end';
        } else {
          syllabic = next.startsWith('-') ? 'begin' : 'single';
        }
        w.open('lyric', { number: li + 1 });
        w.elem('syllabic', syllabic);
        w.elem('text', text);
        w.close('lyric');
      }
    });
  }
  
  w.close('note');
}

function writeRest(w, obj, div, clefShift, curBarDuration) {
  w.open('note');
  const { octave, step, hasPos } = obj.getOctaveStep(clefShift);
  if (hasPos) {
    w.open('rest');
    w.elem('display-step', step);
    w.elem('display-octave', octave);
    w.close('rest');
  } else {
    w.empty('rest');
  }
  let dur = obj.getDurationTicks(div);
  if (dur > curBarDuration * div) dur = curBarDuration * div;
  w.elem('duration', dur);
  w.elem('type', NOTE_TYPES[obj.getDuration()] || 'quarter');
  const dt = obj.getDurationType();
  if (dt & DurationType.DotDot) { w.empty('dot'); w.empty('dot'); }
  else if (dt & DurationType.Dot) w.empty('dot');
  w.close('note');
}

function writeFlowDir(w, obj) {
  w.open('direction');
  const fs = obj.style;
  if (fs === FlowStyle.Coda || fs === FlowStyle.Segno) {
    w.open('direction-type');
    w.empty(fs === FlowStyle.Coda ? 'coda' : 'segno');
    w.close('direction-type');
    w.empty('sound', fs === FlowStyle.Coda ? { coda: '' } : { segno: '' });
  } else {
    const texts = { [FlowStyle.Fine]: 'Fine', [FlowStyle.ToCoda]: 'To Coda', [FlowStyle.DaCapo]: 'D.C.',
      [FlowStyle.DCAlCoda]: 'D.C. al Coda', [FlowStyle.DCAlFine]: 'D.C. al Fine', [FlowStyle.DalSegno]: 'D.S.',
      [FlowStyle.DSAlCoda]: 'D.S. al Coda', [FlowStyle.DSAlFine]: 'D.S. al Fine' };
    if (texts[fs]) {
      w.open('direction-type');
      w.elem('words', texts[fs]);
      w.close('direction-type');
    }
    const sounds = { [FlowStyle.Fine]: { fine: '' }, [FlowStyle.ToCoda]: { tocoda: '' },
      [FlowStyle.DaCapo]: { dacapo: 'yes' }, [FlowStyle.DalSegno]: { dalsegno: '' } };
    if (sounds[fs]) w.empty('sound', sounds[fs]);
  }
  w.close('direction');
}

function writeEndingBar(w, style, curEnding) {
  const barStyles = [BarStyle.SectionClose, BarStyle.MasterClose, BarStyle.Single, BarStyle.Double, BarStyle.Hidden];
  const bs = barStyles[style] ?? BarStyle.Single;
  if (curEnding || bs !== BarStyle.Single) {
    w.open('barline', { location: 'right' });
    if (bs === BarStyle.SectionClose || bs === BarStyle.MasterClose) w.elem('bar-style', 'light-heavy');
    else if (bs === BarStyle.Double) w.elem('bar-style', 'light-light');
    else if (bs === BarStyle.Hidden) w.elem('bar-style', 'none');
    if (curEnding) w.empty('ending', { type: 'stop', number: curEnding });
    if (bs === BarStyle.MasterClose) w.empty('repeat', { direction: 'backward' });
    w.close('barline');
  }
}

function canHaveLyric(na) {
  if ((na & NoteAttr.SlurMask) === NoteAttr.SlurEnd || (na & NoteAttr.SlurMask) === NoteAttr.SlurMid) return false;
  if (na & NoteAttr.TieEnd) return false;
  return true;
}
