# nwc-viewer
This NoteworthyComposer file viewer attempts to renders music notation from nwc files without any installation required, using only the browser technologies like js and html.

If you are interested with this project, feel free to chat me up [@blurspline](https://twitter.com/blurspline) on twitter.


## Components
This project contains
- nwc file decoder, which includes a binary file reader / parser
- interpreter, that make sense of the notation objects
- musical notation rendering, using canvas and smufl font
- simple lilypond code exporter

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
- [x] Position by Note Value
- [x] Interpret JSON format and map to drawing symbols

### Drawing
- [x] Clefs
- [x] Time Signatures
- [x] Key Signatures
- [x] Noteheads
- [x] Staves
- [ ] Accidentals
- [x] Stems & Flags
- [x] Barlines
- [x] Dots
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

## Internals

```
Parse Binary NWC => Tokens => Interpret => Scoring (Typesetting) => Drawing
```

This project follows much of the data structure of nwc files for simplicity.

A piece of music can be loaded either from a nwc file or from a blank slate.
When loading from a nwc file, it is parsed and converted into tokens.

These tokens are simple plain-old javascript / JSON objects. They are like AST tokens that can be processed pretty similarly to javascript parsing libs like esprima/acorn. They are data only and have no functions/classes. This allows flexibility in the processing, editing, manipulation of the tokens, without a lock in to an input API. In theory it would be simple to add new importers.

The tokens gets passed through a interpreter. These runs through the tokens and interpret them musically, deriving musical time values and absolute musical pitches for the objects.

Next, the scoring engine picks up the tokens and maps them to appropriate drawing symbols. It also lays them out and attach coordinates to the drawing objects.

Finally, the drawing system runs through all graphical objects and renders them on screen.