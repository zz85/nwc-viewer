// Example: Using the shared NWC parser in the viewer
// This shows how src/nwc.js could optionally use the lib/nwc2xml parser

/*
// In src/nwc.js, you could add:

import { parseNWC as parseNWC2 } from '../lib/nwc-parser.js';

function decodeNwcArrayBuffer(arrayBuffer, useNewParser = false) {
  if (useNewParser) {
    // Use the more robust parser from nwc2xml
    try {
      const nwcFile = parseNWC2(arrayBuffer);
      // Convert to the format expected by the viewer
      return convertToViewerFormat(nwcFile);
    } catch (e) {
      console.warn('New parser failed, falling back to old parser:', e);
    }
  }
  
  // Original parser logic...
  var byteArray = new Uint8Array(arrayBuffer);
  // ... rest of original code
}

function convertToViewerFormat(nwcFile) {
  // Convert from nwc2xml format to viewer format
  return {
    header: {
      version: nwcFile.version,
      // ... map other fields
    },
    score: {
      staves: nwcFile.staffs.map(staff => ({
        tokens: staff.objects.map(obj => ({
          type: mapObjectType(obj.type),
          // ... map other properties
        }))
      }))
    }
  };
}
*/

// Benefits of using the shared parser:
// 1. Better compatibility with more NWC file versions
// 2. More robust error handling
// 3. Consistent parsing logic between viewer and converter
// 4. Easier to maintain - fix bugs in one place
