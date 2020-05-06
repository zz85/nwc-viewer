# Notably
Notably is a musical viewer and player for NWC ([Noteworthy Composer](http://noteworthycomposer.com)) files. It runs in browser so it has cross platform compatability and doesn't require any software installation. It attempts to parse multiple version of nwc files (v1.5, v1.7, v2.2) and renders music notation. It usees browser based technologies like js, canvas and html.

If you encounter bugs, feel free to [submit an issue](https://github.com/zz85/nwc-viewer/issues) or a pull request.

And if you like this project, you can also chat me up [@blurspline on twitter](https://twitter.com/blurspline).

### [Try it](http://zz85.github.io/nwc-viewer/)

![screen shot](https://user-images.githubusercontent.com/314997/34420095-94df3818-ec42-11e7-9987-2d0bbe0cbdff.png)

## Changelog

5 May 2020
- Add support for loading nwc v1.55

### v1 "MVP" 28 December 2017
[Basic opening of some nwc files](https://github.com/zz85/nwc-viewer/releases/tag/v1)
- open more nwc files (1.75, 2, 2.75/nwctext)
- musicial alignment
- music playback via musical.js with abc export
- more accurate font loading via opentype.js

#### Possible Upcoming
- better scroll management
- better playback controls (stop, seek, highlight notes)
- simple exporting to lilypond and abc notation
- better nwc compatibility? (lyrics)
- midi keyboard output

### v0 "POC" 20 Nov 2017
Porting nwc2ly.py to js, basic notation rendering
- basic smufl font tests
- basic glyph renderings
- basic nwc file parsing

## Components
This project contains
- nwc file decoder, which includes a binary file reader / parser
- interpreter, that make sense of the notation objects
- musical notation rendering, using canvas and smufl font
- simple lilypond code exporter

## Progress

### NWC Parsing
- [x] 1.75
- [x] 2.75 (nwctext)

- [x] Convert to JSON format

### Typesetting (Layout)
- [x] Interpret JSON format and map to drawing symbols
- [x] Position by Note Value

### Drawing
- [x] Clefs
- [x] Time Signatures
- [x] Key Signatures
- [x] Noteheads
- [x] Staves
- [x] Accidentals
- [x] Stems & Flags
- [x] Barlines
- [x] Dots
- [x] Text 
- [ ] Beams
- [ ] Dynamics
- [ ] Tempo
- [ ] Harpins
- [ ] Slurs
- [ ] Braces
- [ ] Ending Barlines

### Technical Road Map
- [ ] Audio Playback
- [ ] Note Editing
- [x] Font loader

## Current API
1. NWC file format parsing
2. Musical intepretation of tokens
3. Notation representation of data
4. Rendering

### API

####  1. NWC parsing
```
decodeNwcArrayBuffer(bytearray)
```
(nwc.js) takes in a bytearray and returns an data object with the interpretation of the nwc contents.

####  2. Musical intepretation
(interpreter.js) uses SightReader to assign cumulative time values to notes. It also translate positions into musical values. The input tokens are modified in place with new properties

#### 3. Notation representation
(typeset.js) attempts to score the music by generating graphical tokens and calculating necessary positions.

#### 4. Rendering
(drawing.js) takes the graphical objects and renders them to a canvas target


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

## NWC File Format
I wrote a nwc parser/converter back in 2005 [nwc2ly.py](https://github.com/zz85/nwc2ly.py) using the "french cafe approach". The decoder used here was initially a port of the python version with additions to support versions 2.7 and nwctext.

## Music Notation Rendering
Although the purpose of this project is not solely music notation, my intention is to build a simple, basic but functional renderer for my own education purposes. Perhaps parts of it can be repurpose if there are intentions to extend the functionality of it.


### External Libs
- inflate.js - zlib inflating for nwc binary format
- bravura font - smufl music font
- musical.js - simple web audio wavetable audio library
- opentype.js - font loading
