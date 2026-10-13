// NWCTXT Writer — the inverse of nwctxt-parser.js.
//
// writeNWCTxt(file) turns a parsed NWCFile (binary or nwctxt source) into
// NWC 2.75 text. The binary parser skips some page/staff settings (margins,
// volume, pan, instrument names), which are written with NWC's defaults.
//
// For files that already contain nwctxt (.nwctxt, 2.75 .nwc), use
// extractNWCTxt() + patchSongInfo() instead: that keeps the original text
// byte for byte apart from the edited fields.
//
// toNWC275(text) wraps nwctxt in the NWC 2.75 binary container.
import { ObjType, NoteAttr, DurationType, Accidental, NWC_HEADER, NWZ_HEADER, NWC_Version } from './constants.js';
import { decodeString } from './reader.js';

const VISIBILITY = ['Default', 'Always', 'TopStaff', 'SingleStaff', 'MultiStaff', 'Never'];
const ACCIDENTALS = { [Accidental.Sharp]: '#', [Accidental.Flat]: 'b', [Accidental.Natural]: 'n',
  [Accidental.SharpSharp]: 'x', [Accidental.FlatFlat]: 'v' };
const DUR_NAMES = ['Whole', 'Half', '4th', '8th', '16th', '32nd', '64th'];
const TEXT_FONTS = ['StaffItalic', 'StaffBold', 'StaffLyric', 'PageTitleText', 'PageText', 'PageSmallText',
  'User1', 'User2', 'User3', 'User4', 'User5', 'User6', 'StaffSymbols'];
const DEFAULT_FONTS = [
  { name: 'Times New Roman', size: 10, bold: true, italic: true },
  { name: 'Times New Roman', size: 8, bold: true, italic: false },
  { name: 'Times New Roman', size: 7, bold: false, italic: false },
  { name: 'Times New Roman', size: 24, bold: true, italic: false },
  { name: 'Times New Roman', size: 12, bold: false, italic: false },
  { name: 'Times New Roman', size: 8, bold: false, italic: false },
];
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
const ENDING_BARS = ['Section Close', 'Master Repeat Close', 'Single', 'Double', 'Open (hidden)'];
const CLEF_TYPES = ['Treble', 'Bass', 'Alto', 'Tenor', 'Percussion'];
const TEMPO_BASES = ['Eighth', 'Eighth Dotted', 'Quarter', 'Quarter Dotted', 'Half', 'Half Dotted'];
const COLORS = ['Default', 'Red', 'Green', 'Blue'];
// Key signature step order (getChromAlter index: 0 = A ... 6 = G)
const SHARP_ORDER = [5, 2, 6, 3, 0, 4, 1]; // F C G D A E B
const FLAT_ORDER = [1, 4, 0, 3, 6, 2, 5];  // B E A D G C F
const STEP_NAMES = 'ABCDEFG';
const SLUR_START = 1, SLUR_END = 2, SLUR_MID = 3;

/** Quote a string value with nwctxt backslash escapes. */
function quote(s) {
  return '"' + String(s ?? '')
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\|/g, '\\|')
    .replace(/\r\n|\r|\n/g, '\\r\\n').replace(/\t/g, '\\t') + '"';
}

const line = (type, fields) => '|' + [type, ...fields.filter(Boolean)].join('|');
// Binary positions are stored negated (positive = below); nwctxt Pos is up-positive
const posField = (obj) => (obj.pos ? `Pos:${-obj.pos}` : '');
const visField = (obj) => (obj.visible ? `Visibility:${VISIBILITY[obj.visible] || 'Default'}` : '');

// --- Durational objects ---------------------------------------------------

function slurCode(attr) { return (attr & NoteAttr.SlurMask) / NoteAttr.SlurBeg; }

function durValue(obj) {
  const parts = [DUR_NAMES[obj.getDuration()] || '4th'];
  const dt = obj.getDurationType();
  if (dt & DurationType.DotDot) parts.push('DblDotted');
  else if (dt & DurationType.Dot) parts.push('Dotted');
  const tri = dt & DurationType.Triplet;
  if (tri === DurationType.TriStart) parts.push('Triplet=First');
  else if (tri === DurationType.TriCont) parts.push('Triplet');
  else if (tri === DurationType.TriStop) parts.push('Triplet=End');
  const attr = obj.getAttributes ? obj.getAttributes() : 0;
  const slur = slurCode(attr);
  if (slur === SLUR_START || slur === SLUR_MID) parts.push('Slur');
  if (attr & NoteAttr.Grace) parts.push('Grace');
  if (attr & NoteAttr.Staccato) parts.push('Staccato');
  if (attr & NoteAttr.Staccatissimo) parts.push('Staccatissimo');
  if (attr & NoteAttr.Accent) parts.push('Accent');
  if (attr & NoteAttr.Tenuto) parts.push('Tenuto');
  if (attr & NoteAttr.Marcato) parts.push('Marcato');
  return parts.join(',');
}

function optsValue(attr, { lyricSyllable = 0, offset = 0, extra = [] } = {}) {
  const opts = [];
  const stem = attr & NoteAttr.StemMask;
  if (stem === NoteAttr.StemUp) opts.push('Stem=Up');
  else if (stem === NoteAttr.StemDown) opts.push('Stem=Down');
  const beam = attr & NoteAttr.BeamMask;
  if (beam === NoteAttr.BeamBeg) opts.push('Beam=First');
  else if (beam === NoteAttr.BeamMid) opts.push('Beam');
  else if (beam === NoteAttr.BeamEnd) opts.push('Beam=End');
  const slurDir = attr & NoteAttr.SlurDirMask;
  if (slurDir === NoteAttr.SlurDirUp) opts.push('Slur=Upward');
  else if (slurDir === NoteAttr.SlurDirDown) opts.push('Slur=Downward');
  const tieDir = attr & NoteAttr.TieDirMask;
  if (tieDir === NoteAttr.TieDirUp) opts.push('Tie=Upward');
  else if (tieDir === NoteAttr.TieDirDown) opts.push('Tie=Downward');
  if (lyricSyllable === 1) opts.push('Lyric=Always');
  else if (lyricSyllable === 2) opts.push('Lyric=Never');
  // Rest offsets are stored negated (positive = below); nwctxt is up-positive
  if (offset) opts.push(`VertOffset=${-offset}`);
  if (attr & NoteAttr.Crescendo) opts.push('Crescendo');
  if (attr & NoteAttr.Diminuendo) opts.push('Diminuendo');
  if (attr & NoteAttr.Sforzando) opts.push('Sforzando');
  if (attr & NoteAttr.Fermata) opts.push('Fermata');
  opts.push(...extra);
  return opts.length ? `Opts:${opts.join(',')}` : '';
}

function pitchValue(note) {
  const attr = note.getAttributes ? note.getAttributes() : 0;
  return (ACCIDENTALS[note.getAccidental()] || '') + (-note.pos) + (attr & NoteAttr.TieBeg ? '^' : '');
}

const lyricOf = (obj) => (obj.getLyricSyllable ? obj.getLyricSyllable() : 0);
const sameDur = (a, b) => a.getDuration() === b.getDuration() && a.getDurationType() === b.getDurationType();
const stemOf = (n) => (n.getAttributes() & NoteAttr.StemMask);

// Chord voices: notes sharing the chord's duration and stem form the main
// voice (Pos/Dur); the rest are a split-stem second voice (Pos2/Dur2).
function chordLine(obj) {
  // Binary chords occasionally hold a rest member; nwctxt chords are notes only
  const notes = (obj.children || []).filter(n => n.type === ObjType.Note);
  if (!notes.length) return null;
  const first = notes[0];
  const main = notes.filter(n => sameDur(n, first) && stemOf(n) === stemOf(first));
  const second = notes.filter(n => !main.includes(n));
  const attr = first.getAttributes();
  // Order positions bottom-up like NWC does
  const pos = (list) => list.slice().sort((a, b) => b.pos - a.pos).map(pitchValue).join(',');
  const fields = [`Dur:${durValue(first)}`, `Pos:${pos(main)}`];
  if (second.length) fields.push(`Dur2:${durValue(second[0])}`, `Pos2:${pos(second)}`);
  // A split chord's second voice takes the opposite stem implicitly
  fields.push(optsValue(attr, { lyricSyllable: lyricOf(first) }), visField(obj));
  return line('Chord', fields);
}

function restChordLine(obj) {
  const notes = (obj.children || []).filter(n => n.type === ObjType.Note);
  const fields = [`Dur:${durValue(obj)}`];
  if (notes.length) {
    const pos = notes.slice().sort((a, b) => b.pos - a.pos).map(pitchValue).join(',');
    fields.push(`Dur2:${durValue(notes[0])}`, `Pos2:${pos}`);
  }
  const attr = notes.length ? notes[0].getAttributes() : 0;
  fields.push(optsValue(attr, { offset: obj.offset || 0, extra: obj.hideRest ? ['HideRest'] : [] }), visField(obj));
  return line('RestChord', fields);
}

// --- Other objects ----------------------------------------------------------

function keySignature(obj) {
  const alter = obj.getChromAlter();
  const names = [];
  for (const i of SHARP_ORDER) if (alter[i] === 1) names.push(STEP_NAMES[i] + '#');
  for (const i of FLAT_ORDER) if (alter[i] === -1) names.push(STEP_NAMES[i] + 'b');
  return names.length ? names.join(',') : 'C';
}

function timeSignature(obj) {
  if (obj.style === 1) return 'Common';
  if (obj.style === 2) return 'AllaBreve';
  return `${obj.beats}/${obj.getBeatType()}`;
}

function endings(style) {
  const list = [];
  for (let i = 0; i < 7; i++) if (style & (1 << i)) list.push(String(i + 1));
  if (style & 0x80) list.push('D');
  return list.join(',') || '1';
}

function objectLine(obj) {
  switch (obj.type) {
    case ObjType.Clef: {
      const shift = obj.octaveShift === 1 ? 'Octave Up' : obj.octaveShift === 2 ? 'Octave Down' : '';
      return line('Clef', [`Type:${CLEF_TYPES[obj.clefType] || 'Treble'}`, shift && `OctaveShift:${shift}`, visField(obj)]);
    }
    case ObjType.KeySig:
      return line('Key', [`Signature:${keySignature(obj)}`, visField(obj)]);
    case ObjType.TimeSig:
      return line('TimeSig', [`Signature:${timeSignature(obj)}`, visField(obj)]);
    case ObjType.BarLine: {
      const style = obj.getStyle();
      const repeat = (style === 5 || style === 7) && obj.repeatCount && obj.repeatCount !== 2 ? `Repeat:${obj.repeatCount}` : '';
      return line('Bar', [style ? `Style:${BAR_STYLES[style] || 'Single'}` : '', repeat,
        obj.systemBreak() ? 'SysBreak:Y' : '', visField(obj)]);
    }
    case ObjType.Ending:
      return line('Ending', [`Endings:${endings(obj.style)}`, obj.style & 0x100 ? 'ClosedBracket:Y' : '', visField(obj)]);
    case ObjType.Instrument:
      // Binary instrument changes keep only the name; NWC would reset the
      // patch, so they are left out rather than silently retuned
      return obj.patch != null ? line('Instrument', [`Name:${quote(obj.name)}`, `Patch:${obj.patch}`,
        `Trans:${obj.transposition || 0}`, visField(obj)]) : null;
    case ObjType.Tempo:
      return line('Tempo', [`Tempo:${obj.value}`, obj.base !== 2 ? `Base:${TEMPO_BASES[obj.base] || 'Quarter'}` : '',
        obj.text ? `Text:${quote(obj.text)}` : '', posField(obj), visField(obj)]);
    case ObjType.Dynamic:
      return line('Dynamic', [`Style:${DYNAMIC_STYLES[obj.style & 0x1F] || 'mf'}`, posField(obj), visField(obj)]);
    case ObjType.Note:
      return line('Note', [`Dur:${durValue(obj)}`, `Pos:${pitchValue(obj)}`,
        optsValue(obj.getAttributes(), { lyricSyllable: lyricOf(obj) }), visField(obj)]);
    case ObjType.Rest:
      return line('Rest', [`Dur:${durValue(obj)}`,
        optsValue(obj.getAttributes ? obj.getAttributes() : 0, { offset: obj.offset || 0 }), visField(obj)]);
    case ObjType.NoteCM:
      return chordLine(obj);
    case ObjType.RestCM:
      return restChordLine(obj);
    case ObjType.Pedal:
      return line('SustainPedal', [obj.style === 1 ? 'Status:Released' : '', posField(obj), visField(obj)]);
    case ObjType.FlowDir:
      return line('Flow', [`Style:${FLOW_STYLES[obj.style] || 'Fine'}`, posField(obj), visField(obj)]);
    case ObjType.TempVar:
      return line('TempoVariance', [`Style:${TEMPVAR_STYLES[obj.style] || 'Fermata'}`,
        obj.delay ? `Pause:${obj.delay}` : '', posField(obj), visField(obj)]);
    case ObjType.DynVar:
      return line('DynamicVariance', [`Style:${DYNVAR_STYLES[obj.style] || 'Crescendo'}`, posField(obj), visField(obj)]);
    case ObjType.Perform:
      return line('PerformanceStyle', [`Style:${PERFORM_STYLES[obj.style] || 'Dolce'}`, posField(obj), visField(obj)]);
    case ObjType.Text:
      return line('Text', [`Text:${quote(obj.text)}`, `Font:${TEXT_FONTS[obj.font] || 'StaffItalic'}`, posField(obj), visField(obj)]);
    case ObjType.Spacer:
      return line('Spacer', [`Width:${obj.width || 0}`, visField(obj)]);
    case ObjType.Boundary:
      // Only nwctxt sources have these; write them back as read
      return obj.fields ? line('Boundary', obj.fields) : null;
    default:
      return null; // MPC (MIDI controller) data isn't kept by the binary parser
  }
}

// --- Staff and file ---------------------------------------------------------

function lyricText(syllables) {
  // Syllables after the first carry their separator: ' ' new word, '-' same
  // word, '\r' new line. Spaces inside a syllable (blank placeholder
  // syllables) are written as '_' with UnderscoreAsSpace on.
  return syllables.map((s, i) => {
    const sep = i > 0 && /^[ \-\r\n]/.test(s) ? s[0] : '';
    return sep + s.slice(sep.length).replace(/ /g, '_');
  }).join('').replace(/\r\n|\r/g, '\n') + '\n';
}

function staffLines(staff, index, file) {
  const out = [];
  // Files before 2.0 have no separate label; NWC prints the staff name
  const label = staff.label || (file.version < NWC_Version.V200 ? staff.name : '');
  out.push(line('AddStaff', [`Name:${quote(staff.name || `Staff ${index + 1}`)}`,
    label ? `Label:${quote(label)}` : '', staff.labelAbbr ? `LabelAbbr:${quote(staff.labelAbbr)}` : '',
    `Group:${quote(staff.group || 'Standard')}`]));

  const withNext = [];
  if (staff.braceWithNext) withNext.push('Brace');
  if (staff.bracketWithNext) withNext.push('Bracket');
  if (staff.connectBarsWithNext) withNext.push('ConnectBars');
  if (staff.layerWithNext) withNext.push('Layer');
  out.push(line('StaffProperties', [`EndingBar:${ENDING_BARS[staff.endingBar] || 'Section Close'}`,
    `Visible:${staff.visible === false ? 'N' : 'Y'}`,
    `BoundaryTop:${Math.abs(staff.boundaryTop || 12)}`, `BoundaryBottom:${Math.abs(staff.boundaryBottom || 12)}`,
    `Lines:${staff.lines || 5}`, withNext.length ? `WithNextStaff:${withNext.join(',')}` : '',
    `Color:${COLORS[staff.color] || 'Default'}`]));
  // staff.channel is 0-15; nwctxt writes 1-16
  out.push(line('StaffProperties', [`Muted:${staff.muted ? 'Y' : 'N'}`, 'Volume:127', 'StereoPan:64', 'Device:0',
    `Channel:${Math.min(15, Math.max(0, staff.channel || 0)) + 1}`]));
  out.push(line('StaffInstrument', [`Patch:${staff.patchName || 0}`, `Trans:${staff.transposition || 0}`,
    'DynVel:10,30,45,60,75,92,108,127']));

  const lyrics = (staff.lyrics || []).filter(l => l && l.length);
  if (lyrics.length) {
    out.push(line('Lyrics', ['Placement:Bottom', 'Align:Standard Rules', 'Offset:0', 'UnderscoreAsSpace:Y']));
    staff.lyrics.forEach((syllables, i) => {
      if (syllables && syllables.length) out.push(line(`Lyric${i + 1}`, [`Text:${quote(lyricText(syllables))}`]));
    });
  }

  for (const obj of staff.objects) {
    const l = objectLine(obj);
    if (l) out.push(l);
  }
  return out;
}

/** Serialize an NWCFile as NWC 2.75 text (CRLF line endings). */
export function writeNWCTxt(file) {
  const out = ['!NoteWorthyComposer(2.75)'];
  out.push(line('SongInfo', [`Title:${quote(file.title)}`, `Author:${quote(file.author)}`,
    `Lyricist:${quote(file.lyricist)}`, `Copyright1:${quote(file.copyright1)}`,
    `Copyright2:${quote(file.copyright2)}`, file.comment ? `Comments:${quote(file.comment)}` : '']));
  out.push(line('PgSetup', [`StaffSize:${file.staffSize || 16}`, 'Zoom:4', 'TitlePage:Y', 'JustifyVertically:Y',
    'PrintSystemSepMark:N', 'ExtendLastSystem:N', 'DurationPadding:Y', 'PageNumbers:0',
    `StaffLabels:${file.staffLabels || 'None'}`, 'BarNumbers:None', `StartingBar:${file.measureStart || 1}`,
    file.allowLayering === false ? 'AllowLayering:N' : '']));
  for (let i = 0; i < 6; i++) {
    const f = file.fonts?.[i] || DEFAULT_FONTS[i];
    out.push(line('Font', [`Style:${TEXT_FONTS[i]}`, `Typeface:${quote(f.name || DEFAULT_FONTS[i].name)}`,
      `Size:${f.size || DEFAULT_FONTS[i].size}`, `Bold:${f.bold ? 'Y' : 'N'}`, `Italic:${f.italic ? 'Y' : 'N'}`, 'CharSet:0']));
  }
  out.push(line('PgMargins', ['Left:1.27', 'Top:1.27', 'Right:1.27', 'Bottom:1.27', 'Mirror:N']));
  file.staffs.forEach((staff, i) => out.push(...staffLines(staff, i, file)));
  out.push('!NoteWorthyComposer-End');
  return out.join('\r\n') + '\r\n';
}

// --- Text-preserving edits ----------------------------------------------------

/**
 * The nwctxt text embedded in a file, or null: plain .nwctxt files and NWC
 * 2.75 binaries (which store the song as nwctxt after a short header).
 * @param {Uint8Array} bytes - file contents, already inflated if [NWZ]
 */
export function extractNWCTxt(bytes) {
  const head = String.fromCharCode(...bytes.subarray(0, 20));
  if (head.startsWith('!NoteWorthyComposer')) return decodeString(bytes);
  if (!head.startsWith('[NoteWorthy ArtWare]')) return null;
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const idx = latin1.indexOf('!NoteWorthyComposer(');
  return idx >= 0 ? decodeString(bytes.subarray(idx)) : null;
}

const SONG_INFO_FIELDS = { title: 'Title', author: 'Author', lyricist: 'Lyricist',
  copyright1: 'Copyright1', copyright2: 'Copyright2', comment: 'Comments' };

/**
 * Replace SongInfo fields in nwctxt text, leaving every other line as is.
 * @param {object} info - { title, author, lyricist, copyright1, copyright2, comment }
 */
export function patchSongInfo(text, info) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  let idx = lines.findIndex(l => l.startsWith('|SongInfo|'));
  if (idx < 0) {
    lines.splice(1, 0, '|SongInfo|');
    idx = 1;
  }
  // Split on '|' outside quotes (values may contain escaped '|')
  const parts = [];
  let cur = '', inQuote = false;
  const l = lines[idx];
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === '\\' && i + 1 < l.length) { cur += c + l[++i]; continue; }
    if (c === '"') inQuote = !inQuote;
    if (c === '|' && !inQuote) { if (cur) parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur) parts.push(cur);

  for (const [key, name] of Object.entries(SONG_INFO_FIELDS)) {
    if (!(key in info)) continue;
    const field = `${name}:${quote(info[key])}`;
    const at = parts.findIndex(p => p.startsWith(name + ':'));
    if (at >= 0) parts[at] = field;
    else parts.push(field);
  }
  lines[idx] = '|' + parts.join('|');
  return lines.join(eol);
}

// --- NWC 2.75 binary container -------------------------------------------------

/**
 * Wrap nwctxt as an NWC 2.75 .nwc file: "[NWZ]\0" + zlib(header + text),
 * the layout NWC 2.75 itself writes.
 * @param {string} text - nwctxt
 * @param {function(Uint8Array): Uint8Array|Promise<Uint8Array>} deflate - zlib compressor
 */
export async function toNWC275(text, deflate) {
  const enc = new TextEncoder();
  // Header as written by NWC 2.75: product strings, version 0x024B, user
  // "N/A", a 22-character file id, then fixed fields (seen in real files)
  const idChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._';
  let id = '';
  for (let i = 0; i < 22; i++) id += idChars[Math.floor(Math.random() * idChars.length)];
  const header = new Uint8Array([
    ...enc.encode(NWC_HEADER), 0x4B, 0x02, 0x02, 0x00, 0x00, 0x00,
    ...enc.encode('N/A'), 0, ...enc.encode(id), 0,
    0x00, 0x00, 0xE4, 0x04, 0x00, 0x00, 0x00, 0x00, 0x24, 0x00,
  ]);
  const body = enc.encode(text);
  const plain = new Uint8Array(header.length + body.length);
  plain.set(header);
  plain.set(body, header.length);
  const packed = await deflate(plain);
  const out = new Uint8Array(6 + packed.length);
  out.set(enc.encode(NWZ_HEADER));
  out[5] = 0;
  out.set(packed, 6);
  return out;
}
