
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


// v1.7 nwc
// ajax('samples/anongs.nwc', processData);
// ajax('samples/adohn.nwc', processData);
// ajax('samples/bwv140-2.nwc', processData);
// ajax('samples/carenot.nwc', processData);


// v2.75
// ajax('samples/AveMariaArcadelt.nwc', processData);

// ajax('samples/WhatChildIsThis.nwc', processData);


// ajax('samples/WeThreeKingsOfOrientAre.nwc', processData)

setup(() => {
	score(data)
})

function processData(payload) {
	data = decodeNwcArrayBuffer(payload);
	// vex2(data);
}
