
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

function tokensToNotes(notes, token) {

}

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);

	var staves = data.score.staves;
	staves.map(stave => stave.tokens)


	vex2();
}

function vex2() {
	// Create an SVG renderer and attach it to the DIV element named "boo".
	var vf = new Vex.Flow.Factory({renderer: {elementId: 'easyscore'}});
	var score = vf.EasyScore();
	var system = vf.System({
		// debugFormatter: true
	});

	system.addStave({
		voices: [
			score.voice(score.notes('C#4/h, C#4'))
		]
	  })
	  .addClef('treble').addTimeSignature('4/4')
	  
	system.addStave({
		voices: [
			score.voice(score.notes('C#1/q, B2, A2/8, B2, C#3, D3'))
		]
	}).addClef('bass').addTimeSignature('4/4');

	system.addConnector()

	vf.draw();

	Object.assign(window, { score, system, vf })
}