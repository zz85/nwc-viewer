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

var byteArray;

ajax('samples/anongs.nwc', received);

function hex(number) {
	return ('00' + (number || 0).toString(16)).slice(-2);
}

function binary(number) {
	return ('00000000' + (number || 0).toString(2)).slice(-8);
}

function string(number) {
	return (' ' + String.fromCharCode(number)).slice(-1);
}

function dump(byteArray) {
	for (var i = 0; i < byteArray.length; i+=4) {
		console.log(
			hex(byteArray[i]),
			hex(byteArray[i + 1]),
			hex(byteArray[i + 2]),
			hex(byteArray[i + 3]),

			binary(byteArray[i]),
			binary(byteArray[i + 1]),
			binary(byteArray[i + 2]),
			binary(byteArray[i + 3]),

			string(byteArray[i]),
			string(byteArray[i + 1]),
			string(byteArray[i + 2]),
			string(byteArray[i + 3])
		);
	}

}

function received(arrayBuffer) {
	byteArray = new Uint8Array(arrayBuffer);
	console.log('byteArray', byteArray);

	var nwz = byteArray.subarray(6);
	var inflate = new Zlib.Inflate(nwz);
	var plain = inflate.decompress();
	process(plain);
}

function process(bytes) {
	dump(bytes);
}
