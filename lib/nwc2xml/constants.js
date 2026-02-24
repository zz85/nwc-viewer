// NWC Constants and Enums
export const NWC_HEADER = '[NoteWorthy ArtWare]\0\0\0[NoteWorthy Composer]\0';
export const NWZ_HEADER = '[NWZ]';

export const NWC_Version = {
  V120: 0x0114, V130: 0x011E, V150: 0x0132, V155: 0x0137,
  V170: 0x0146, V175: 0x014B, V200: 0x0200, V201: 0x0201, V202: 0x0202, V205: 0x0205, V275: 0x024B
};

export const ObjType = {
  Clef: 0, KeySig: 1, BarLine: 2, Ending: 3, Instrument: 4, TimeSig: 5,
  Tempo: 6, Dynamic: 7, Note: 8, Rest: 9, NoteCM: 10, Pedal: 11,
  FlowDir: 12, MPC: 13, TempVar: 14, DynVar: 15, Perform: 16, Text: 17, RestCM: 18,
  User: 19, Spacer: 20, RestMultiBar: 21, Boundary: 22, Marker: 23
};

export const BarStyle = {
  Single: 0, Double: 1, SectionOpen: 2, SectionClose: 3,
  LocalOpen: 4, LocalClose: 5, MasterOpen: 6, MasterClose: 7, Hidden: 8
};

export const FlowStyle = {
  Coda: 0, Segno: 1, Fine: 2, ToCoda: 3, DaCapo: 4, DCAlCoda: 5,
  DCAlFine: 6, DalSegno: 7, DSAlCoda: 8, DSAlFine: 9
};

export const Accidental = { Sharp: 0, Flat: 1, Natural: 2, SharpSharp: 3, FlatFlat: 4, Normal: 5 };

export const NoteAttr = {
  Accent: 0x00001, Grace: 0x00002, Staccato: 0x00004, Tenuto: 0x00008,
  Marcato: 0x00010, Sforzando: 0x00020, Staccatissimo: 0x00040,
  Crescendo: 0x00080,  Diminuendo: 0x00100,
  BeamBeg: 0x00200, BeamEnd: 0x00400, BeamMid: 0x00600, BeamMask: 0x00600,
  SlurBeg: 0x00800, SlurEnd: 0x01000, SlurMid: 0x01800, SlurMask: 0x01800,
  SlurDirUp: 0x02000, SlurDirDown: 0x04000, SlurDirMask: 0x06000,
  StemUp: 0x08000, StemDown: 0x10000, StemMask: 0x18000,
  TieBeg: 0x20000, TieEnd: 0x40000,
  TieDirUp: 0x80000, TieDirDown: 0x100000, TieDirMask: 0x180000,
  Fermata: 0x200000,
};

export const DurationType = { Dot: 0x01, DotDot: 0x02, Triplet: 0x0C, TriStart: 0x04, TriCont: 0x08, TriStop: 0x0C };

export function isValidVersion(v) {
  return [NWC_Version.V130, NWC_Version.V150, NWC_Version.V155, NWC_Version.V170, NWC_Version.V175, NWC_Version.V200, NWC_Version.V201, NWC_Version.V202, NWC_Version.V205, NWC_Version.V275].includes(v);
}

export const GM_PATCHES = [
  'Acoustic Grand Piano','Bright Acoustic Piano','Electric Grand Piano','Honky-tonk Piano',
  'Electric Piano 1','Electric Piano 2','Harpsichord','Clavi','Celesta','Glockenspiel',
  'Music Box','Vibraphone','Marimba','Xylophone','Tubular Bells','Dulcimer','Drawbar Organ',
  'Percussive Organ','Rock Organ','Church Organ','Reed Organ','Accordion','Harmonica',
  'Tango Accordion','Acoustic Guitar (nylon)','Acoustic Guitar (steel)','Electric Guitar (jazz)',
  'Electric Guitar (clean)','Electric Guitar (muted)','Overdriven Guitar','Distortion Guitar',
  'Guitar harmonics','Acoustic Bass','Electric Bass (finger)','Electric Bass (pick)','Fretless Bass',
  'Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2','Violin','Viola','Cello','Contrabass',
  'Tremolo Strings','Pizzicato Strings','Orchestral Harp','Timpani','String Ensemble 1',
  'String Ensemble 2','SynthStrings 1','SynthStrings 2','Choir Aahs','Voice Oohs','Synth Voice',
  'Orchestra Hit','Trumpet','Trombone','Tuba','Muted Trumpet','French Horn','Brass Section',
  'SynthBrass 1','SynthBrass 2','Soprano Sax','Alto Sax','Tenor Sax','Baritone Sax','Oboe',
  'English Horn','Bassoon','Clarinet','Piccolo','Flute','Recorder','Pan Flute','Blown Bottle',
  'Shakuhachi','Whistle','Ocarina','Lead 1 (square)','Lead 2 (sawtooth)','Lead 3 (calliope)',
  'Lead 4 (chiff)','Lead 5 (charang)','Lead 6 (voice)','Lead 7 (fifths)','Lead 8 (bass + lead)',
  'Pad 1 (new age)','Pad 2 (warm)','Pad 3 (polysynth)','Pad 4 (choir)','Pad 5 (bowed)',
  'Pad 6 (metallic)','Pad 7 (halo)','Pad 8 (sweep)','FX 1 (rain)','FX 2 (soundtrack)',
  'FX 3 (crystal)','FX 4 (atmosphere)','FX 5 (brightness)','FX 6 (goblins)','FX 7 (echoes)',
  'FX 8 (sci-fi)','Sitar','Banjo','Shamisen','Koto','Kalimba','Bag pipe','Fiddle','Shanai',
  'Tinkle Bell','Agogo','Steel Drums','Woodblock','Taiko Drum','Melodic Tom','Synth Drum',
  'Reverse Cymbal','Guitar Fret Noise','Breath Noise','Seashore','Bird Tweet','Telephone Ring',
  'Helicopter','Applause','Gunshot'
];
