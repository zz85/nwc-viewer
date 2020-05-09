function tokenizeLyrics(lyrics) {
    // lyrics = lyrics.split('\n').join('')
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
// var test = `"Hark! The Her-ald An-gels sing,
// "Glo-ry to the new-born King;
// Peace on earth, and mer-cy mild,
// God and sin-ners re-con-ciled!"
// Joy-ful, all ye na-tions, rise.
// Join the tri-umph of the skies.
// With th' An-gel-ic Hosts pro-claim,
// "Christ is born in Beth-le-hem!"
// Hark! the her-ald an-gels sing,
// "Glo-ry to the new-born King."`
// var ret = tokenizeLyrics(test)
// console.log(ret);

export default tokenizeLyrics
