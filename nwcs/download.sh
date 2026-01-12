#!/bin/bash
BASE="https://nwc-scriptorium.org"

curl -s "$BASE/recommended.html" | grep -oE '/db/[a-z0-9_-]+\.id' | sed 's|/db/||;s|\.id||' | sort -u | while read id; do
  page=$(curl -s "$BASE/db/$id.id")
  nwc_path=$(echo "$page" | grep -oE 'href="[^"]+\.nwc"' | head -1 | sed 's/href="//;s/"$//')
  
  if [ -n "$nwc_path" ]; then
    filename=$(basename "$nwc_path" .nwc)
    echo "Downloading $filename"
    
    # NWC needs Referer header
    curl -s -o "${filename}.nwc" -H "Referer: $BASE/db/$id.id" "$BASE$nwc_path"
    # MIDI
    curl -s -o "${filename}.mid" "$BASE/db/${filename}.dlmidi"
  fi
done
