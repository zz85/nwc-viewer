# NWC to MusicXML Converter

Library and tools for converting Noteworthy Composer (NWC) files to MusicXML format.

## Library

The conversion library is located in `lib/nwc2xml/` and can be imported as an ES module:

```javascript
import { convertNWCToMusicXML } from './lib/nwc2xml/index.js';

const buffer = // ... read NWC file as Uint8Array
const xml = convertNWCToMusicXML(buffer);
```

## CLI Tool

Convert NWC files to MusicXML from the command line:

```bash
# Convert to XML (output defaults to input.xml)
bun bin/nwc2xml.js song.nwc

# Specify output file
bun bin/nwc2xml.js song.nwc output.xml

# Show help
bun bin/nwc2xml.js --help
```

## Web Converter

Open `converter.html` in a browser for a drag-and-drop interface to convert NWC files to MusicXML.

Features:
- Drag and drop NWC files
- View converted XML in browser
- Download converted XML file

## Supported Features

- Staff properties and layout
- Notes, rests, and chords
- Time signatures and key signatures
- Clefs (treble, bass, alto, tenor)
- Dynamics and tempo markings
- Lyrics
- Articulations and ornaments
- Beaming and stems

## Credits

Based on the nwc2xml converter https://github.com/mzealey/nwc2xml and code originally developed for this project.
