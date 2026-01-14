# NWC to MusicXML Converter

Library and tools for converting Noteworthy Composer (NWC) files to MusicXML format.

## Architecture

The library is split into two main components:

1. **Parser** (`parser.js`, `nwctxt-parser.js`, `reader.js`) - Parses NWC files into a structured format
2. **Writer** (`writer.js`) - Converts parsed NWC data to MusicXML

This separation allows the parser to be reused independently for other purposes.

## Library Usage

### Parse NWC files

```javascript
import { parseNWC } from './lib/nwc2xml/index.js';

const buffer = // ... read NWC file as Uint8Array
const nwcFile = parseNWC(buffer);
// nwcFile contains: version, title, author, staffs[], etc.
```

### Convert to MusicXML

```javascript
import { convertNWCToMusicXML } from './lib/nwc2xml/index.js';

const buffer = // ... read NWC file as Uint8Array
const xml = convertNWCToMusicXML(buffer);
```

### Use parser separately

```javascript
import { parseNWC } from './lib/nwc-parser.js';

const nwcFile = parseNWC(buffer);
// Use parsed data for your own purposes
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
