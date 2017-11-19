# nwc-viewer
NoteworthyComposer file viewer that renders music notation in js and html. Do get in touch if you are interested with this.

This project contains
- a binary file reader / parser
- nwc file decoder
- musical notation rendering on canvas using smufl font

## NWC File Format
I wrote a nwc parser/converter back in 2005 [nwc2ly.py](https://github.com/zz85/nwc2ly.py) using the "french cafe approach". The decoder used here was initially a port of the python version with additions to support versions 2.7 and nwctext.

## Progress

### NWC Parsing
- [x] 1.75
- [x] 2.75 (nwctext)

- [x] Convert to JSON format

### Typesetting (Layout)
- [ ] Position by Note Value
- [x] Interpret JSON format and map to drawing symbols

### Drawing
- [x] Clefs
- [x] Time Signatures
- [ ] Key Signatures
- [x] Noteheads
- [x] Staves
- [ ] Accidentals
- [ ] Stems
- [ ] Barlines
- [ ] Dots
- [ ] Beams
- [ ] Text Dynamics
- [ ] Harpins
- [ ] Slurs

