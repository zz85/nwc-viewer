function ajax(url, callback) {
	var oReq = new XMLHttpRequest();
	oReq.open('GET', url, true);
	oReq.responseType = 'arraybuffer';

	oReq.onload = function(oEvent) {
		console.log('ajax done for ', url);
		var arrayBuffer = oReq.response;
		var byteArray = new Uint8Array(arrayBuffer);
		callback(byteArray);
	};

	oReq.send();
}

ajax('samples/anongs.nwc', function(buffers) {
	console.log('buffers', buffers);
});