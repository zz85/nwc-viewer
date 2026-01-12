#!/bin/bash
BASE="https://nwc-scriptorium.org"

echo "# NWC Scriptorium - Recommended Music Catalog"
echo ""
echo "Source: https://nwc-scriptorium.org/recommended.html"
echo ""
echo "**Note:** These files are for private use only."
echo ""
echo "| File | Title | Composer | Duration | Submitter |"
echo "|------|-------|----------|----------|-----------|"

curl -s "$BASE/recommended.html" | grep -oE '/db/[a-z0-9_-]+\.id' | sed 's|/db/||;s|\.id||' | sort -u | while read id; do
  page=$(curl -s "$BASE/db/$id.id")
  nwc_path=$(echo "$page" | grep -oE 'href="[^"]+\.nwc"' | head -1 | sed 's/href="//;s/"$//')
  
  if [ -n "$nwc_path" ]; then
    filename=$(basename "$nwc_path" .nwc)
    title=$(echo "$page" | grep -o 'id="id-page-title">[^<]*<' | sed 's/id="id-page-title">//;s/<$//')
    composer=$(echo "$page" | sed -n 's/.*Composer:<\/th><td>\([^<]*\).*/\1/p' | head -1)
    duration=$(echo "$page" | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1)
    submitter=$(echo "$page" | sed -n 's/.*Submitter:<\/th><td>\([^<]*\).*/\1/p' | head -1)
    
    echo "| $filename | $title | $composer | $duration | $submitter |"
  fi
done
