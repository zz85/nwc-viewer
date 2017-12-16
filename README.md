# nwc-viewer
This NoteworthyComposer file viewer attempts to renders music notation from nwc files without any installation required, using only the browser technologies like js and html.

If you are interested with this project, feel free to chat me up [@blurspline](https://twitter.com/blurspline) on twitter.

This project contains
- a binary file reader / parser
- nwc file decoder
- musical notation rendering on canvas using smufl font

## NWC File Format
I wrote a nwc parser/converter back in 2005 [nwc2ly.py](https://github.com/zz85/nwc2ly.py) using the "french cafe approach". The decoder used here was initially a port of the python version with additions to support versions 2.7 and nwctext.

## Music Notation Rendering
Although the purpose of this project is not solely music notation, my intention is to build a simple, basic but functional renderer for my own education purposes. Perhaps parts of it can be repurpose if there are intentions to extend the functionality of it.

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
- [x] Key Signatures
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

### Technical Road Map
- [ ] Audio Playback
- [ ] Note Editing
- [ ] Font loader

## Current API
1. NWC file format parsing
2. Musical intepretation of tokens
3. Notation representation of data
4. Rendering



