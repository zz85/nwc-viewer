
/**********************
 *
 *   Helpers
 *
 **********************/

function ajax(url, callback) {
	var oReq = new XMLHttpRequest();
	oReq.open('GET', url, true);
	oReq.responseType = 'arraybuffer';

	oReq.onload = function(oEvent) {
		console.log('ajax done for ', url);
		var arrayBuffer = oReq.response;
		callback(arrayBuffer);
	};

	oReq.send();
}

ajax('samples/anongs.nwc', processData);
// ajax('samples/adohn.nwc', processData);

setup(() => {
	score(data)
})

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	// vex2(data);

}

function score(data) {
	drawing = new Drawing(ctx)

	tokens = data.score.staves[0].tokens

	staveY = 160
	staveX = 40

	s = new Stave(600)
	s.moveTo(staveX, staveY)
	drawing.add(s)

	tokens.forEach(token => {
		const type = token.type;
		console.log(token)

		switch (type) {

			default:
				console.log(type)
				break;

			case 'Clef':
				// switch (token.clef) {
				// 	case 'treble':
				// 		clef = new Claire.TrebleClef()
				// 	default:
				// 		console.log('ERR unknown clef', token.clef)
				// }
				clef = new {
					treble: Claire.TrebleClef,
				}[token.clef]()

				clef.moveTo(staveX, staveY)
				drawing.add(clef)
				staveX += clef.width * 2
				break;
		}
	})

	drawing.draw(ctx)
}


