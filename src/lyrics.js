function tokenizeLyrics(lyrics) {
	var len = lyrics.length

	var cursor = 0
	var marker = -1

	var tokens = []

	while (cursor < len) {
		var char = lyrics[cursor]
		if (/\s+/m.exec(char)) {
			/* white space — word boundary */
			if (marker > -1 && cursor > marker) {
				tokens.push(lyrics.substring(marker, cursor))
			}
			marker = -1
			cursor++
		} else if (
			char == '-' ||
			char == ';' ||
			char == '.' ||
			char == '!' ||
			char == '_' ||
			char == ','
		) {
			/* divider tokens — append divider to the preceding text */
			if (marker === -1) {
				// Divider at start of a token (e.g. "-ald" from NWC).
				// This is a continuation marker, not a standalone syllable.
				// Skip it — the next characters form the real syllable.
				cursor++
				continue
			}
			tokens.push(lyrics.substring(marker, cursor + 1))
			cursor++
			marker = -1
		} else {
			// Regular character — start or continue accumulating
			if (marker == -1) {
				marker = cursor
			}
			cursor++
		}
	}

	// Flush any remaining word after the loop
	if (marker > -1 && marker < len) {
		tokens.push(lyrics.substring(marker, len))
	}

	return tokens
}

export default tokenizeLyrics
