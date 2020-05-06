function tokenizeLyrics(lyrics) {
	var len = lyrics.length

	var cursor = 0
	var marker = -1

	var tokens = []

	while (cursor < len) {
		var char = lyrics[cursor]
		// /char == ' ' || char == '\t' ||
		if (/\s+/m.exec(char)) {
			/* white space */
			if (marker > -1 && cursor - marker > 1) {
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
			/* divider tokens */
			tokens.push(lyrics.substring(marker, cursor + 1))
			cursor++
			marker = cursor
			cursor++
		} else {
			// move the marker
			if (marker == -1) {
				marker = cursor
			}
			cursor++
		}
	}

	console.log('lyrics tokens', JSON.parse(JSON.stringify(tokens)))

	return tokens
}

// var ret = tokenizeLyrics('test 1  2    3 4 5')
// var ret = tokenizeLyrics('test hello- arr a-b-c-d  yoz-do  meh-3 4 5 a;b;c')

// console.log(ret);

export default tokenizeLyrics
